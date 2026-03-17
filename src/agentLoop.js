import { API_URL, BASE_DELAY, SYSTEM_PROMPT } from './config.js';
import { executeCommand } from './executor.js';

const MAX_LOOP_ITERATIONS = 30;

// ── Exponential Backoff Config ─────────────────────────────────────────────
const MAX_RETRIES   = 4;       // maks percobaan ulang setelah gagal
const BACKOFF_BASE  = 2000;    // ms — delay awal (2 detik)
const BACKOFF_MAX   = 32000;   // ms — batas atas delay (32 detik)
const JITTER_MS     = 500;     // ms — jitter acak agar tidak thundering herd

// HTTP status yang layak di-retry (rate limit, server error, gateway error)
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch ke Gemini API dengan exponential backoff otomatis.
 * Retry dilakukan jika:
 *   - Status HTTP masuk RETRYABLE_STATUS (429, 5xx)
 *   - Terjadi network error (fetch throw)
 * Non-retryable error (4xx lain) langsung dilempar.
 */
async function fetchAI(promptText, onRetry) {
  let attempt = 0;

  while (true) {
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.result.answer;
      }

      // Jika status tidak retryable → lempar langsung
      if (!RETRYABLE_STATUS.has(response.status)) {
        throw new Error(`HTTP error ${response.status} (tidak di-retry)`);
      }

      // Status retryable — cek apakah masih ada sisa percobaan
      if (attempt >= MAX_RETRIES) {
        throw new Error(`HTTP error ${response.status} — gagal setelah ${MAX_RETRIES} retry`);
      }

    } catch (networkErr) {
      // Network error (offline, timeout, dll)
      if (attempt >= MAX_RETRIES) throw networkErr;
      // Jika error bukan dari blok fetch (sudah di-throw manual), teruskan
      if (networkErr.message.includes('tidak di-retry')) throw networkErr;
      if (networkErr.message.includes('gagal setelah')) throw networkErr;
    }

    // ── Hitung delay backoff ─────────────────────────────────────────────
    attempt++;
    const backoff = Math.min(BACKOFF_BASE * Math.pow(2, attempt - 1), BACKOFF_MAX);
    const jitter   = Math.random() * JITTER_MS;
    const delay    = Math.round(backoff + jitter);

    if (onRetry) onRetry(attempt, delay);
    await sleep(delay);
  }
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

    // ── Panggil AI (dengan exponential backoff) ────────────────────────────
    let aiResponse;
    try {
      aiResponse = await fetchAI(fullPrompt, (attempt, delayMs) => {
        const secs = (delayMs / 1000).toFixed(1);
        const retryMsg = `SystemLog (Retry ${attempt}/${MAX_RETRIES}): API error — mencoba ulang dalam ${secs}s...`;
        addChatMsg({ role: 'system', text: retryMsg });
        setStatus({ text: `Retry ${attempt}/${MAX_RETRIES} — tunggu ${secs}s...`, type: 'error' });
      });
    } catch (e) {
      const errMsg = `SystemLog (Error jaringan): ${e.message}`;
      addChatMsg({ role: 'system', text: errMsg });
      addAiMemoryMsg({ role: 'system', text: errMsg });
      break;
    }

    // Pulihkan status active setelah retry berhasil
    setStatus({ text: `Iterasi ${i}/${MAX_LOOP_ITERATIONS}...`, type: 'active' });

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
