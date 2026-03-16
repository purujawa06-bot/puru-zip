/**
 * Execute a command string on the in-memory VFS.
 * Returns { action, log, newVfs? } or null if no <execution> tag found.
 * For curl, returns { action: 'curl', curlCmd } — caller handles async fetch.
 */
export function executeCommand(commandStr, vfs) {
  try {
    const execMatch = commandStr.match(/<execution>([\s\S]*?)<\/execution>/i);
    if (!execMatch) return null;

    const cmdBody = execMatch[1].trim();

    // ── stop ──────────────────────────────────────────────────────────
    if (cmdBody === 'stop') {
      return { action: 'stop', log: 'Berhasil dihentikan. Siap untuk diunduh.' };
    }

    // ── todo ──────────────────────────────────────────────────────────
    if (cmdBody === 'todo') {
      return { action: 'todo', log: 'AI meminta pembuatan ulang rencana Todo.' };
    }

    // ── review ────────────────────────────────────────────────────────
    if (cmdBody === 'review') {
      return { action: 'review', log: 'AI meminta tinjauan kualitas oleh Reviewer Agent.' };
    }

    // ── all ───────────────────────────────────────────────────────────
    if (cmdBody.startsWith('all')) {
      const files = Object.keys(vfs).sort();
      const log = files.length === 0
        ? 'Project kosong.'
        : 'Daftar file:\n' + files.map(f => `#root/${f}`).join('\n');
      return { action: 'all', log: `Berhasil membaca struktur.\n${log}` };
    }

    // ── read ──────────────────────────────────────────────────────────
    if (cmdBody.startsWith('read')) {
      const pathMatch = cmdBody.match(/<path>(.*?)<\/path>/i);
      if (!pathMatch) throw new Error('Tag <path> tidak ditemukan.');
      const cleanPath = pathMatch[1].replace('#root/', '').trim();
      if (!(cleanPath in vfs)) throw new Error(`File ${cleanPath} tidak ditemukan.`);
      const content = vfs[cleanPath];
      if (content && content.startsWith('[BINARY:')) {
        return { action: 'read', log: `Isi dari ${cleanPath}:\n[File Binary/Media tidak dapat dibaca sebagai teks]` };
      }
      return { action: 'read', log: `Isi dari ${cleanPath}:\n${content}` };
    }

    // ── write ─────────────────────────────────────────────────────────
    if (cmdBody.startsWith('write')) {
      const pathMatch = cmdBody.match(/<path>(.*?)<\/path>/i);
      const contentMatch = cmdBody.match(/<content>([\s\S]*?)<\/content>/i);
      if (!pathMatch || !contentMatch) throw new Error('Tag <path> atau <content> tidak lengkap.');
      const cleanPath = pathMatch[1].replace('#root/', '').trim();
      const newVfs = { ...vfs, [cleanPath]: contentMatch[1] };
      return { action: 'write', log: `Berhasil menulis ke file ${cleanPath}.`, newVfs };
    }

    // ── remove ────────────────────────────────────────────────────────
    if (cmdBody.startsWith('remove')) {
      const pathMatch = cmdBody.match(/<path>(.*?)<\/path>/i);
      if (!pathMatch) throw new Error('Tag <path> tidak ditemukan.');
      const cleanPath = pathMatch[1].replace('#root/', '').trim();
      if (!(cleanPath in vfs)) throw new Error(`File ${cleanPath} tidak ditemukan.`);
      const newVfs = { ...vfs };
      delete newVfs[cleanPath];
      return { action: 'remove', log: `File ${cleanPath} berhasil dihapus.`, newVfs };
    }

    // ── move ──────────────────────────────────────────────────────────
    if (cmdBody.startsWith('move')) {
      const pathMatch = cmdBody.match(/<path>(.*?)<\/path>/i);
      const toMatch = cmdBody.match(/<to>(.*?)<\/to>/i);
      if (!pathMatch || !toMatch) throw new Error('Tag <path> atau <to> tidak ditemukan.');
      const srcPath = pathMatch[1].replace('#root/', '').trim();
      const dstPath = toMatch[1].replace('#root/', '').trim();
      if (!(srcPath in vfs)) throw new Error(`File sumber ${srcPath} tidak ditemukan.`);
      const newVfs = { ...vfs, [dstPath]: vfs[srcPath] };
      delete newVfs[srcPath];
      return { action: 'move', log: `Berhasil memindahkan/rename: ${srcPath} -> ${dstPath}`, newVfs };
    }

    // ── curl (browser fetch) ──────────────────────────────────────────
    if (cmdBody.startsWith('curl')) {
      const contentMatch = cmdBody.match(/<content>([\s\S]*?)<\/content>/i);
      if (!contentMatch) throw new Error('Tag <content> tidak ditemukan untuk perintah curl.');
      const curlCmd = contentMatch[1].trim();
      if (!curlCmd.startsWith('curl ')) throw new Error('Hanya perintah curl yang diperbolehkan.');
      return { action: 'curl', log: '', curlCmd };
    }

    throw new Error('Perintah tidak dikenali.');
  } catch (e) {
    return { action: 'error', log: `ERROR: ${e.message}` };
  }
}

/**
 * Execute a curl-style command using browser fetch.
 * Supports basic GET/POST with headers and JSON body.
 * Note: CORS restrictions apply in browser environment.
 */
export async function executeCurl(curlCmd) {
  const urlMatch = curlCmd.match(/https?:\/\/[^\s"']+/);
  if (!urlMatch) throw new Error('URL tidak ditemukan dalam perintah curl.');

  const url = urlMatch[0];
  const isPost = /-X\s+POST/i.test(curlCmd);
  const isPut  = /-X\s+PUT/i.test(curlCmd);
  const isDelete = /-X\s+DELETE/i.test(curlCmd);

  const method = isPost ? 'POST' : isPut ? 'PUT' : isDelete ? 'DELETE' : 'GET';

  // Parse headers: -H "Key: Value"
  const headers = {};
  for (const hm of curlCmd.matchAll(/-H\s+"([^"]+)"/g)) {
    const colonIdx = hm[1].indexOf(':');
    if (colonIdx !== -1) {
      headers[hm[1].slice(0, colonIdx).trim()] = hm[1].slice(colonIdx + 1).trim();
    }
  }

  // Parse body: -d 'body' or -d "body"
  const dataMatch = curlCmd.match(/-d\s+'([^']*)'/) || curlCmd.match(/-d\s+"([^"]*)"/);
  const opts = { method, headers };
  if (dataMatch) opts.body = dataMatch[1];

  const response = await fetch(url, opts);
  const text = await response.text();
  const truncated = text.length > 2000 ? text.slice(0, 2000) + '\n... [Terpotong karena terlalu panjang]' : text;
  return `Eksekusi selesai dengan kode ${response.status}.\nOutput:\n${truncated}`;
}
