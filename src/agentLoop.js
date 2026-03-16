import { API_URL, BASE_DELAY, SYSTEM_PROMPT, SYSTEM_PROMPT_TODO } from './config.js';
import { executeCommand, executeCurl } from './executor.js';

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

async function runTodoPlanner({ initialPrompt, getVfs, addChatMsg, addAiMemoryMsg, setStatus }) {
  setStatus({ text: 'Membuat rencana Todo...', type: 'active' });
  const files = Object.keys(getVfs()).sort();
  const ctx = files.length === 0 ? 'Kosong' : files.map(f => `#root/${f}`).join(', ');
  const todoPayload =
    `${SYSTEM_PROMPT_TODO}\n\n[Struktur File Saat Ini: ${ctx}]\n\n` +
    `Instruksi User: ${initialPrompt}\n\nPuruAI-Todo, buat rencana singkat:`;

  const todoResp = await fetchAI(todoPayload);
  const msg = `SystemLog (Todo Plan):\n${todoResp}`;
  addChatMsg({ role: 'system', text: msg });
  addAiMemoryMsg({ role: 'system', text: msg });
}

/**
 * Main agent loop — runs entirely in the browser, no backend needed.
 *
 * Callbacks:
 *   getVfs()            → current VFS object
 *   updateVfs(newVfs)   → update VFS state
 *   getAiMemory()       → current AI memory array
 *   addChatMsg(msg)     → append to chat history
 *   addAiMemoryMsg(msg) → append to AI memory
 *   clearAiMemory()     → clear AI memory (called on stop)
 *   setStatus({text, type}) → update status indicator
 *   stopLoop()          → signal loop to stop
 *   shouldContinue()    → returns true if loop should keep running
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
  let errorCount = 0;

  addChatMsg({ role: 'user', text: initialPrompt });
  addAiMemoryMsg({ role: 'user', text: initialPrompt });
  setStatus({ text: 'Berpikir...', type: 'active' });

  while (shouldContinue()) {
    try {
      // Build prompt
      const files = Object.keys(getVfs()).sort();
      const vfsContext = files.length === 0 ? 'Kosong' : files.map(f => `#root/${f}`).join(', ');
      const memory = getAiMemory();
      const historyLog = memory.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
      const fullPrompt =
        `${SYSTEM_PROMPT}\n\n[Context VFS Saat Ini: ${vfsContext}]\n\n` +
        `Riwayat:\n${historyLog}\n\nPuruAI, berikan tindakan Anda selanjutnya!`;

      setStatus({ text: 'Berpikir...', type: 'active' });
      const aiResponse = await fetchAI(fullPrompt);

      addChatMsg({ role: 'ai', text: aiResponse });
      addAiMemoryMsg({ role: 'ai', text: aiResponse });

      // Execute command on current VFS
      const execResult = executeCommand(aiResponse, getVfs());

      if (execResult === null) {
        const w = 'SystemLog (Warning): Tidak ada tag <execution> valid ditemukan.';
        addChatMsg({ role: 'system', text: w });
        addAiMemoryMsg({ role: 'system', text: w });
      } else if (execResult.action === 'stop') {
        if (execResult.newVfs) updateVfs(execResult.newVfs);
        const doneMsg =
          'Agent selesai. Semua ingatan AI telah dihapus (File VFS tetap aman). ' +
          'Anda dapat mengunduh atau memberi instruksi baru.';
        addChatMsg({ role: 'system', text: doneMsg });
        clearAiMemory();
        setStatus({ text: 'Selesai', type: 'done' });
        stopLoop();
        break;
      } else if (execResult.action === 'todo') {
        const replanMsg = 'SystemLog (Re-Planning): AI meminta pembaruan rencana Todo...';
        addChatMsg({ role: 'system', text: replanMsg });
        addAiMemoryMsg({ role: 'system', text: replanMsg });
        try {
          await runTodoPlanner({ initialPrompt, getVfs, addChatMsg, addAiMemoryMsg, setStatus });
        } catch (e) {
          const errMsg = `SystemLog (Todo Error): Gagal membuat rencana baru - ${e.message}`;
          addChatMsg({ role: 'system', text: errMsg });
          addAiMemoryMsg({ role: 'system', text: errMsg });
        }
      } else if (execResult.action === 'curl') {
        // Async curl via browser fetch
        try {
          const output = await executeCurl(execResult.curlCmd);
          const sysMsg = `SystemLog (curl): ${output}`;
          addChatMsg({ role: 'system', text: sysMsg });
          addAiMemoryMsg({ role: 'system', text: sysMsg });
        } catch (e) {
          const sysMsg = `SystemLog (curl Error): ${e.message}. (Catatan: CORS mungkin memblokir request ini di browser)`;
          addChatMsg({ role: 'system', text: sysMsg });
          addAiMemoryMsg({ role: 'system', text: sysMsg });
        }
        errorCount = 0;
      } else {
        // write / remove / move / read / all / error
        if (execResult.newVfs) updateVfs(execResult.newVfs);
        const sysMsg = `SystemLog (${execResult.action}): ${execResult.log}`;
        addChatMsg({ role: 'system', text: sysMsg });
        addAiMemoryMsg({ role: 'system', text: sysMsg });
        errorCount = 0;
      }

      if (!shouldContinue()) break;
      setStatus({ text: `Jeda ${BASE_DELAY / 1000}s...`, type: 'idle' });
      await sleep(BASE_DELAY);
    } catch (e) {
      errorCount++;
      const backoffSec = (BASE_DELAY / 1000) * Math.pow(2, errorCount);
      const errMsg = `SystemLog (API Error): ${e.message}. Retry dalam ${backoffSec}s (Ke-${errorCount})`;
      addChatMsg({ role: 'system', text: errMsg });
      addAiMemoryMsg({ role: 'system', text: errMsg });
      setStatus({ text: `Error. Wait ${backoffSec}s`, type: 'error' });
      await sleep(backoffSec * 1000);
      if (errorCount > 4) {
        addChatMsg({ role: 'system', text: 'Terlalu banyak error. Loop dihentikan paksa.' });
        setStatus({ text: 'Terhenti', type: 'idle' });
        stopLoop();
        break;
      }
    }
  }
}
