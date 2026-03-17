import { API_URL, API_MODEL, CHAT_MODE, BASE_DELAY, SYSTEM_PROMPT } from './config.js';
import { executeCommand } from './executor.js';

const MAX_LOOP_ITERATIONS = 30;

// ── Exponential Backoff Config ─────────────────────────────────────────────
const MAX_RETRIES  = 4;      // maks percobaan ulang setelah gagal
const BACKOFF_BASE = 2000;   // ms — delay awal (2 detik)
const BACKOFF_MAX  = 32000;  // ms — batas atas delay (32 detik)
const JITTER_MS    = 500;    // ms — jitter acak agar tidak thundering herd

// HTTP status yang layak di-retry (rate limit, server error, gateway error)
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Kirim prompt ke NoteGPT API via SSE streaming.
 * Setiap chunk SSE berbentuk: data: {"text":"...","reasoning":"..."}
 * atau data: {"text":"","done":true} / data: {"type":"finish"}
 *
 * Returns: { text: string, reasoning: string }
 *
 * Callbacks:
 *   onReasoning(chunk)  — dipanggil tiap chunk reasoning masuk
 *   onText(chunk)       — dipanggil tiap chunk text masuk
 *   onRetry(n, delayMs) — dipanggil saat akan retry karena error
 */
async function fetchAI(promptText, { onReasoning, onText, onRetry } = {}) {
  let attempt = 0;

  while (true) {
    let response;
    try {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt:    promptText,
          model:     API_MODEL,
          chat_mode: CHAT_MODE,
        }),
      });
    } catch (networkErr) {
      if (attempt >= MAX_RETRIES) throw networkErr;
      attempt++;
      const delay = Math.round(Math.min(BACKOFF_BASE * Math.pow(2, attempt - 1), BACKOFF_MAX) + Math.random() * JITTER_MS);
      if (onRetry) onRetry(attempt, delay);
      await sleep(delay);
      continue;
    }

    // Status tidak retryable (misal 401, 403) → lempar langsung
    if (!response.ok && !RETRYABLE_STATUS.has(response.status)) {
      throw new Error(`HTTP error ${response.status} (tidak di-retry)`);
    }

    // Status retryable (429, 5xx)
    if (!response.ok) {
      if (attempt >= MAX_RETRIES) throw new Error(`HTTP error ${response.status} — gagal setelah ${MAX_RETRIES} retry`);
      attempt++;
      const delay = Math.round(Math.min(BACKOFF_BASE * Math.pow(2, attempt - 1), BACKOFF_MAX) + Math.random() * JITTER_MS);
      if (onRetry) onRetry(attempt, delay);
      await sleep(delay);
      continue;
    }

    // ── Baca SSE stream ──────────────────────────────────────────────────
    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText      = '';
    let fullReasoning = '';
    let buffer        = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Proses tiap baris SSE yang sudah lengkap
        const lines = buffer.split('\n');
        buffer = lines.pop(); // simpan baris terakhir yang belum tentu lengkap

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;

          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          let parsed;
          try { parsed = JSON.parse(jsonStr); } catch { continue; }

          // Sinyal selesai
          if (parsed.done === true || parsed.type === 'finish') continue;

          if (parsed.reasoning) {
            fullReasoning += parsed.reasoning;
            if (onReasoning) onReasoning(parsed.reasoning);
          }
          if (parsed.text) {
            fullText += parsed.text;
            if (onText) onText(parsed.text);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { text: fullText.trim(), reasoning: fullReasoning.trim() };
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

    // ── Panggil AI (SSE streaming + exponential backoff) ──────────────────
    let aiResult;
    try {
      aiResult = await fetchAI(fullPrompt, {
        onRetry: (attempt, delayMs) => {
          const secs = (delayMs / 1000).toFixed(1);
          const retryMsg = `SystemLog (Retry ${attempt}/${MAX_RETRIES}): API error — mencoba ulang dalam ${secs}s...`;
          addChatMsg({ role: 'system', text: retryMsg });
          setStatus({ text: `Retry ${attempt}/${MAX_RETRIES} — tunggu ${secs}s...`, type: 'error' });
        },
      });
    } catch (e) {
      const errMsg = `SystemLog (Error jaringan): ${e.message}`;
      addChatMsg({ role: 'system', text: errMsg });
      addAiMemoryMsg({ role: 'system', text: errMsg });
      break;
    }

    // Pulihkan status active setelah retry berhasil
    setStatus({ text: `Iterasi ${i}/${MAX_LOOP_ITERATIONS}...`, type: 'active' });

    // ── Tampilkan reasoning (jika ada) ────────────────────────────────────
    if (aiResult.reasoning) {
      addChatMsg({ role: 'reasoning', text: aiResult.reasoning });
    }

    const aiResponse = aiResult.text;
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
