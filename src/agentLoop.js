import { API_URL, BASE_DELAY, SYSTEM_PROMPT } from './config.js';
import { executeCommand } from './executor.js';

const MAX_LOOP_ITERATIONS = 30;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAI(promptText) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: promptText }),
  });
  if (!response.ok) throw new Error(`HTTP error ${response.status}`);
  const data = await response.json();
  return data.result.answer;
}

/**
 * ════════════════════════════════════════════════════════════════
 *  AGENT LOOP — AI bebas bertindak tanpa intervensi sistem
 *
 *  Alur sederhana per iterasi:
 *    1. Kirim riwayat + konteks VFS ke AI
 *    2. AI merespons dengan satu <execution>...</execution>
 *    3. Eksekusi perintah → catat log ke riwayat
 *    4. Ulangi hingga AI mengeluarkan <execution>stop</execution>
 *       atau iterasi maks tercapai
 * ════════════════════════════════════════════════════════════════
 */
export async function agentLoop({
  initialPrompt,
  getVfs,
  updateVfs,
  getAiMemory,
  addChatMsg,
  addAiMemoryMsg,
  clearAiMemory,
  setStatus,
  stopLoop,
  shouldContinue,
}) {
  addChatMsg({ role: 'user', text: initialPrompt });
  addAiMemoryMsg({ role: 'user', text: initialPrompt });

  for (let i = 1; i <= MAX_LOOP_ITERATIONS; i++) {
    if (!shouldContinue()) break;

    setStatus({ text: `Iterasi ${i}/${MAX_LOOP_ITERATIONS}...`, type: 'active' });

    // ── Bangun prompt ──────────────────────────────────────────────────────
    const files = Object.keys(getVfs()).sort();
    const fileList = files.length === 0 ? 'Kosong' : files.map(f => `#root/${f}`).join(', ');

    const mem = getAiMemory();
    const history = mem.length === 0
      ? '(Belum ada riwayat)'
      : mem.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');

    const fullPrompt =
      `${SYSTEM_PROMPT}\n\n` +
      `[File saat ini: ${fileList}]\n\n` +
      `Riwayat:\n${history}\n\n` +
      `Lanjutkan.`;

    // ── Panggil AI ─────────────────────────────────────────────────────────
    let aiResponse;
    try {
      aiResponse = await fetchAI(fullPrompt);
    } catch (e) {
      const errMsg = `SystemLog (Error jaringan): ${e.message}`;
      addChatMsg({ role: 'system', text: errMsg });
      addAiMemoryMsg({ role: 'system', text: errMsg });
      break;
    }

    addChatMsg({ role: 'ai', text: aiResponse });
    addAiMemoryMsg({ role: 'ai', text: aiResponse });

    // ── Parse & eksekusi ───────────────────────────────────────────────────
    const execResult = executeCommand(aiResponse, getVfs());

    if (execResult === null) {
      // AI tidak mengeluarkan tag execution — hentikan loop
      const w = 'SystemLog: Tidak ada tag <execution> ditemukan. Loop dihentikan.';
      addChatMsg({ role: 'system', text: w });
      addAiMemoryMsg({ role: 'system', text: w });
      break;
    }

    if (execResult.action === 'stop') {
      if (execResult.newVfs) updateVfs(execResult.newVfs);
      addChatMsg({ role: 'system', text: 'SystemLog: AI menandai tugas selesai.' });
      break;
    }

    if (execResult.newVfs) updateVfs(execResult.newVfs);

    const sysMsg = `SystemLog (${execResult.action}): ${execResult.log}`;
    addChatMsg({ role: 'system', text: sysMsg });
    addAiMemoryMsg({ role: 'system', text: sysMsg });

    await sleep(BASE_DELAY);
  }

  if (!shouldContinue()) return;

  // ── Selesai ────────────────────────────────────────────────────────────────
  const doneMsg =
    'Agent selesai. Ingatan AI telah dihapus (file VFS tetap aman). ' +
    'Anda dapat mengunduh atau memberi instruksi baru.';
  addChatMsg({ role: 'system', text: doneMsg });
  clearAiMemory();
  setStatus({ text: 'Selesai ✅', type: 'done' });
  stopLoop();
}
