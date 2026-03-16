import {
  API_URL, BASE_DELAY,
  SYSTEM_PROMPT, SYSTEM_PROMPT_THINKER,
  SYSTEM_PROMPT_TODO, SYSTEM_PROMPT_REVIEWER
} from './config.js';
import { executeCommand, executeCurl } from './executor.js';

const MAX_LOOP_ITERATIONS = 15;

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

// ── Helper: build context strings ─────────────────────────────────────────────
function buildCtx(getVfs) {
  const files = Object.keys(getVfs()).sort();
  return files.length === 0 ? 'Kosong' : files.map(f => `#root/${f}`).join(', ');
}

function buildHistory(getAiMemory) {
  const mem = getAiMemory();
  return mem.length === 0
    ? '(Belum ada riwayat)'
    : mem.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
}

// ── Step 1 & Loop Step 5/8/11…: Thinker Self-Ask ─────────────────────────────
async function runThinker({ label, initialPrompt, getVfs, getAiMemory, addChatMsg, addAiMemoryMsg, setStatus }) {
  setStatus({ text: label, type: 'active' });

  const payload =
    `${SYSTEM_PROMPT_THINKER}\n\n` +
    `[Struktur File Saat Ini: ${buildCtx(getVfs)}]\n\n` +
    `Riwayat:\n${buildHistory(getAiMemory)}\n\n` +
    `Instruksi User: ${initialPrompt}\n\n` +
    `PuruAI-Thinker, refleksikan dan ajukan pertanyaan kepada diri sendiri:`;

  const resp = await fetchAI(payload);
  const msg = `SystemLog (Thinker):\n${resp}`;
  addChatMsg({ role: 'system', text: msg });
  addAiMemoryMsg({ role: 'system', text: msg });
}

// ── Step 2: Baca Struktur & File ──────────────────────────────────────────────
async function runReadPhase({ initialPrompt, getVfs, updateVfs, getAiMemory, addChatMsg, addAiMemoryMsg, setStatus }) {
  setStatus({ text: 'Step 2: Mempelajari struktur & membaca file...', type: 'active' });

  // Auto: jalankan 'all' untuk mendapatkan daftar file
  const allResult = executeCommand('<execution>all <path>#root/</path></execution>', getVfs());
  if (allResult && allResult.newVfs) updateVfs(allResult.newVfs);
  const structLog = `SystemLog (all): ${allResult ? allResult.log : 'Struktur file dibaca.'}`;
  addChatMsg({ role: 'system', text: structLog });
  addAiMemoryMsg({ role: 'system', text: structLog });

  // AI membaca file-file relevan (max 5 putaran)
  for (let r = 0; r < 5; r++) {
    const fullPrompt =
      `${SYSTEM_PROMPT}\n\n` +
      `[Context VFS Saat Ini: ${buildCtx(getVfs)}]\n\n` +
      `Riwayat:\n${buildHistory(getAiMemory)}\n\n` +
      `Anda sedang di FASE BACA (Step 2). Baca file-file yang paling relevan untuk memahami kode yang ada. ` +
      `Jika sudah cukup, gunakan <execution>stop</execution> untuk lanjut ke perencanaan.\n\n` +
      `PuruAI, file apa yang perlu dibaca?`;

    const aiResp = await fetchAI(fullPrompt);
    addChatMsg({ role: 'ai', text: aiResp });
    addAiMemoryMsg({ role: 'ai', text: aiResp });

    const execResult = executeCommand(aiResp, getVfs());
    if (execResult === null) break;

    // Jika AI mengatakan stop/todo → selesai fase baca
    if (execResult.action === 'stop' || execResult.action === 'todo' || execResult.action === 'review') break;

    if (execResult.newVfs) updateVfs(execResult.newVfs);
    const sysMsg = `SystemLog (${execResult.action}): ${execResult.log}`;
    addChatMsg({ role: 'system', text: sysMsg });
    addAiMemoryMsg({ role: 'system', text: sysMsg });
    await sleep(BASE_DELAY);
  }
}

// ── Step 3 & Loop Step 6/9/12…: Todo Planner ─────────────────────────────────
async function runTodoPlanner({ label, initialPrompt, getVfs, getAiMemory, addChatMsg, addAiMemoryMsg, setStatus }) {
  setStatus({ text: label, type: 'active' });

  const payload =
    `${SYSTEM_PROMPT_TODO}\n\n` +
    `[Struktur File Saat Ini: ${buildCtx(getVfs)}]\n\n` +
    `Riwayat:\n${buildHistory(getAiMemory)}\n\n` +
    `Instruksi User: ${initialPrompt}\n\n` +
    `PuruAI-Todo, buat/perbarui rencana berdasarkan progres terkini:`;

  const resp = await fetchAI(payload);
  const msg = `SystemLog (Todo Plan):\n${resp}`;
  addChatMsg({ role: 'system', text: msg });
  addAiMemoryMsg({ role: 'system', text: msg });
}

// ── Loop Step 4/7/10…: Execute ────────────────────────────────────────────────
// Returns: 'stop' jika AI selesai, 'continue' jika lanjut
async function runExecuteStep({ label, initialPrompt, getVfs, updateVfs, getAiMemory, addChatMsg, addAiMemoryMsg, setStatus }) {
  setStatus({ text: label, type: 'active' });

  const fullPrompt =
    `${SYSTEM_PROMPT}\n\n` +
    `[Context VFS Saat Ini: ${buildCtx(getVfs)}]\n\n` +
    `Riwayat:\n${buildHistory(getAiMemory)}\n\n` +
    `PuruAI, eksekusi langkah berikutnya dari rencana Todo!`;

  const aiResponse = await fetchAI(fullPrompt);
  addChatMsg({ role: 'ai', text: aiResponse });
  addAiMemoryMsg({ role: 'ai', text: aiResponse });

  const execResult = executeCommand(aiResponse, getVfs());

  if (execResult === null) {
    const w = 'SystemLog (Warning): Tidak ada tag <execution> valid ditemukan.';
    addChatMsg({ role: 'system', text: w });
    addAiMemoryMsg({ role: 'system', text: w });
    return 'continue';
  }

  if (execResult.action === 'stop') {
    if (execResult.newVfs) updateVfs(execResult.newVfs);
    addChatMsg({ role: 'system', text: 'SystemLog: AI menandai tugas selesai.' });
    addAiMemoryMsg({ role: 'system', text: 'SystemLog: AI menandai tugas selesai.' });
    return 'stop';
  }

  if (execResult.action === 'curl') {
    try {
      const output = await executeCurl(execResult.curlCmd);
      const sysMsg = `SystemLog (curl): ${output}`;
      addChatMsg({ role: 'system', text: sysMsg });
      addAiMemoryMsg({ role: 'system', text: sysMsg });
    } catch (e) {
      const sysMsg = `SystemLog (curl Error): ${e.message}. (CORS mungkin memblokir request ini di browser)`;
      addChatMsg({ role: 'system', text: sysMsg });
      addAiMemoryMsg({ role: 'system', text: sysMsg });
    }
    return 'continue';
  }

  if (execResult.newVfs) updateVfs(execResult.newVfs);
  const sysMsg = `SystemLog (${execResult.action}): ${execResult.log}`;
  addChatMsg({ role: 'system', text: sysMsg });
  addAiMemoryMsg({ role: 'system', text: sysMsg });
  return 'continue';
}

// ── Final Step: Reviewer ──────────────────────────────────────────────────────
async function runReviewer({ initialPrompt, getVfs, getAiMemory, addChatMsg, addAiMemoryMsg, setStatus }) {
  setStatus({ text: 'Review Final: Meninjau kualitas perubahan...', type: 'active' });

  const payload =
    `${SYSTEM_PROMPT_REVIEWER}\n\n` +
    `[Struktur File Saat Ini: ${buildCtx(getVfs)}]\n\n` +
    `Riwayat:\n${buildHistory(getAiMemory)}\n\n` +
    `Instruksi Asli User: ${initialPrompt}\n\n` +
    `PuruAI-Reviewer, tinjau kualitas seluruh perubahan:`;

  const reviewResp = await fetchAI(payload);

  const verdictMatch = reviewResp.match(/<verdict>(.*?)<\/verdict>/i);
  const notesMatch   = reviewResp.match(/<notes>([\s\S]*?)<\/notes>/i);

  const verdict = verdictMatch ? verdictMatch[1].trim() : 'NEEDS_ADJUSTMENT';
  const notes   = notesMatch   ? notesMatch[1].trim()   : reviewResp;
  const icon    = verdict.toUpperCase() === 'APPROVED' ? '✅' : '⚠️';

  const msg = `SystemLog (Reviewer) ${icon}:\nVerdict: ${verdict}\n${notes}`;
  addChatMsg({ role: 'system', text: msg });
  addAiMemoryMsg({ role: 'system', text: msg });

  return verdict.toUpperCase();
}

/**
 * ════════════════════════════════════════════════════════════════
 *  MAIN AGENT LOOP — Alur Kerja Otonom Puru AI
 * ════════════════════════════════════════════════════════════════
 *
 *  FASE INISIALISASI:
 *    Step 1  → Thinker Self-Ask (refleksi awal)
 *    Step 2  → Baca struktur & isi file (read phase)
 *    Step 3  → Todo Agent (buat rencana awal)
 *
 *  LOOP EKSEKUSI (maks 15 iterasi):
 *    Step 4  → Eksekusi
 *    Step 5  → Thinker Self-Ask
 *    Step 6  → Todo Agent (update progres)
 *    Step 7  → Eksekusi
 *    Step 8  → Thinker Self-Ask
 *    Step 9  → Todo Agent
 *    ... (berulang hingga 15 iterasi atau AI menandai stop)
 *
 *  FASE FINAL:
 *    Step 15 → Review (Reviewer Agent)
 *              → APPROVED: selesai
 *              → NEEDS_ADJUSTMENT: 1 eksekusi koreksi → selesai
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

  // Wrapper aman: jalankan fn, tangkap error, jangan crash loop
  const safe = async (fn, label) => {
    if (!shouldContinue()) return;
    try {
      await fn();
    } catch (e) {
      const errMsg = `SystemLog (Error — ${label}): ${e.message}`;
      addChatMsg({ role: 'system', text: errMsg });
      addAiMemoryMsg({ role: 'system', text: errMsg });
    }
  };

  // ╔══════════════════════════════════╗
  // ║   FASE 1: INISIALISASI           ║
  // ╚══════════════════════════════════╝

  // Step 1: Thinker Self-Ask
  await safe(() => runThinker({
    label: '🧠 Step 1 — Thinker: Refleksi & Self-Ask awal...',
    initialPrompt, getVfs, getAiMemory, addChatMsg, addAiMemoryMsg, setStatus,
  }), 'Thinker Init');
  if (!shouldContinue()) return;
  await sleep(BASE_DELAY);

  // Step 2: Baca Struktur & File
  await safe(() => runReadPhase({
    initialPrompt, getVfs, updateVfs, getAiMemory, addChatMsg, addAiMemoryMsg, setStatus,
  }), 'Read Phase');
  if (!shouldContinue()) return;
  await sleep(BASE_DELAY);

  // Step 3: Todo Awal
  await safe(() => runTodoPlanner({
    label: '📋 Step 3 — Todo: Membuat rencana awal...',
    initialPrompt, getVfs, getAiMemory, addChatMsg, addAiMemoryMsg, setStatus,
  }), 'Todo Init');
  if (!shouldContinue()) return;
  await sleep(BASE_DELAY);

  // ╔══════════════════════════════════════════════════════╗
  // ║   FASE 2: LOOP EKSEKUSI (maks 15 iterasi)           ║
  // ╚══════════════════════════════════════════════════════╝
  let loopStopped = false;

  for (let i = 1; i <= MAX_LOOP_ITERATIONS; i++) {
    if (!shouldContinue()) break;

    const iterLabel = `${i}/${MAX_LOOP_ITERATIONS}`;

    // ── Eksekusi ──────────────────────────────────────────
    let signal = 'continue';
    try {
      signal = await runExecuteStep({
        label: `⚙️ Loop ${iterLabel} — Eksekusi langkah...`,
        initialPrompt, getVfs, updateVfs, getAiMemory, addChatMsg, addAiMemoryMsg, setStatus,
      });
    } catch (e) {
      const errMsg = `SystemLog (Error Eksekusi #${i}): ${e.message}`;
      addChatMsg({ role: 'system', text: errMsg });
      addAiMemoryMsg({ role: 'system', text: errMsg });
    }

    if (signal === 'stop' || !shouldContinue()) {
      loopStopped = true;
      break;
    }
    await sleep(BASE_DELAY);
    if (!shouldContinue()) break;

    // ── Thinker Self-Ask ──────────────────────────────────
    await safe(() => runThinker({
      label: `🧠 Loop ${iterLabel} — Thinker: Refleksi progres...`,
      initialPrompt, getVfs, getAiMemory, addChatMsg, addAiMemoryMsg, setStatus,
    }), `Thinker Loop ${i}`);
    if (!shouldContinue()) break;
    await sleep(BASE_DELAY);
    if (!shouldContinue()) break;

    // ── Todo Update ───────────────────────────────────────
    await safe(() => runTodoPlanner({
      label: `📋 Loop ${iterLabel} — Todo: Update rencana...`,
      initialPrompt, getVfs, getAiMemory, addChatMsg, addAiMemoryMsg, setStatus,
    }), `Todo Loop ${i}`);
    if (!shouldContinue()) break;
    await sleep(BASE_DELAY);
  }

  if (!shouldContinue()) return;

  // ╔══════════════════════════════════╗
  // ║   FASE 3: REVIEW FINAL           ║
  // ╚══════════════════════════════════╝
  let verdict = 'NEEDS_ADJUSTMENT';
  await safe(async () => {
    verdict = await runReviewer({
      initialPrompt, getVfs, getAiMemory, addChatMsg, addAiMemoryMsg, setStatus,
    });
  }, 'Reviewer');
  if (!shouldContinue()) return;

  // Jika ada yang perlu diperbaiki: 1 eksekusi koreksi final
  if (verdict !== 'APPROVED' && shouldContinue()) {
    await sleep(BASE_DELAY);
    addChatMsg({ role: 'system', text: 'SystemLog (Adjustment): Melakukan penyesuaian final berdasarkan catatan Reviewer...' });
    addAiMemoryMsg({ role: 'system', text: 'SystemLog (Adjustment): Melakukan penyesuaian final berdasarkan catatan Reviewer...' });

    await safe(() => runExecuteStep({
      label: '🔧 Adjustment Final — Eksekusi penyesuaian...',
      initialPrompt, getVfs, updateVfs, getAiMemory, addChatMsg, addAiMemoryMsg, setStatus,
    }), 'Final Adjustment');
  }

  // ── Selesai ────────────────────────────────────────────
  const doneMsg =
    'Agent selesai. Semua ingatan AI telah dihapus (File VFS tetap aman). ' +
    'Anda dapat mengunduh atau memberi instruksi baru.';
  addChatMsg({ role: 'system', text: doneMsg });
  clearAiMemory();
  setStatus({ text: 'Selesai ✅', type: 'done' });
  stopLoop();
}
