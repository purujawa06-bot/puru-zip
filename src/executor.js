/**
 * Execute a command string on the in-memory VFS.
 * Returns { action, log, newVfs? } or null if no <execution> tag found.
 *
 * Supported commands:
 *   listFile()
 *   readFile(["#root/a.ext","#root/b.ext"])
 *   writeFile("#root/file.ext")<content>...</content>
 *   deleteFile(["#root/a.ext","#root/b.ext"])
 *   searchText(["term1","term2"])
 *   moveFile({"file":"#root/old.ext","to":"#root/new.ext"})
 *   stop
 */
export function executeCommand(commandStr, vfs) {
  try {
    const execMatch = commandStr.match(/<execution>([\s\S]*?)<\/execution>/i);
    if (!execMatch) return null;

    const cmdBody = execMatch[1].trim();

    // ── stop ──────────────────────────────────────────────────────────────────
    if (cmdBody === 'stop') {
      return { action: 'stop', log: 'Selesai. File siap untuk diunduh.' };
    }

    // ── listFile() ────────────────────────────────────────────────────────────
    if (/^listFile\(\s*\)/.test(cmdBody)) {
      const files = Object.keys(vfs).sort();
      const log = files.length === 0
        ? 'Project kosong. Tidak ada file.'
        : 'Daftar file:\n' + files.map(f => `#root/${f}`).join('\n');
      return { action: 'listFile', log };
    }

    // ── readFile([...]) ───────────────────────────────────────────────────────
    if (cmdBody.startsWith('readFile(')) {
      const argMatch = cmdBody.match(/^readFile\(([\s\S]+?)\)\s*$/);
      if (!argMatch) throw new Error('Format readFile tidak valid.');
      const paths = parseJsonArray(argMatch[1]);
      const results = [];
      for (const p of paths) {
        const cleanPath = p.replace(/^#root\//, '').trim();
        if (!(cleanPath in vfs)) {
          results.push(`[${p}]: File tidak ditemukan.`);
        } else {
          const content = vfs[cleanPath];
          if (content && content.startsWith('[BINARY:')) {
            results.push(`[${p}]:\n[File Binary/Media — tidak dapat dibaca sebagai teks]`);
          } else {
            results.push(`[${p}]:\n${content}`);
          }
        }
      }
      return { action: 'readFile', log: results.join('\n\n---\n\n') };
    }

    // ── writeFile("#root/file")<content>...</content> ─────────────────────────
    if (cmdBody.startsWith('writeFile(')) {
      const fnArgMatch = cmdBody.match(/^writeFile\(\s*"([^"]+)"\s*\)/);
      if (!fnArgMatch) throw new Error('Format writeFile tidak valid. Gunakan: writeFile("#root/namafile.ext")');
      const cleanPath = fnArgMatch[1].replace(/^#root\//, '').trim();
      const contentMatch = cmdBody.match(/<content>([\s\S]*?)<\/content>/i);
      if (!contentMatch) throw new Error('Tag <content>...</content> tidak ditemukan dalam writeFile.');
      const newVfs = { ...vfs, [cleanPath]: contentMatch[1] };
      return { action: 'writeFile', log: `Berhasil menulis: #root/${cleanPath}`, newVfs };
    }

    // ── deleteFile([...]) ─────────────────────────────────────────────────────
    if (cmdBody.startsWith('deleteFile(')) {
      const argMatch = cmdBody.match(/^deleteFile\(([\s\S]+?)\)\s*$/);
      if (!argMatch) throw new Error('Format deleteFile tidak valid.');
      const paths = parseJsonArray(argMatch[1]);
      const newVfs = { ...vfs };
      const deleted = [];
      const notFound = [];
      for (const p of paths) {
        const cleanPath = p.replace(/^#root\//, '').trim();
        if (cleanPath in newVfs) {
          delete newVfs[cleanPath];
          deleted.push(`#root/${cleanPath}`);
        } else {
          notFound.push(p);
        }
      }
      let log = deleted.length > 0 ? `Berhasil dihapus: ${deleted.join(', ')}` : '';
      if (notFound.length > 0) log += `\nTidak ditemukan: ${notFound.join(', ')}`;
      return { action: 'deleteFile', log: log.trim(), newVfs };
    }

    // ── searchText([...]) ─────────────────────────────────────────────────────
    if (cmdBody.startsWith('searchText(')) {
      const argMatch = cmdBody.match(/^searchText\(([\s\S]+?)\)\s*$/);
      if (!argMatch) throw new Error('Format searchText tidak valid.');
      const terms = parseJsonArray(argMatch[1]);
      const results = [];
      for (const [filename, content] of Object.entries(vfs)) {
        if (!content || content.startsWith('[BINARY:')) continue;
        for (const term of terms) {
          if (content.includes(term)) {
            const lines = content.split('\n');
            const matchLines = lines
              .map((line, i) => ({ line, i }))
              .filter(({ line }) => line.includes(term))
              .slice(0, 5)
              .map(({ line, i }) => `  L${i + 1}: ${line.trim()}`);
            results.push(`#root/${filename} [term: "${term}"]:\n${matchLines.join('\n')}`);
          }
        }
      }
      const log = results.length === 0
        ? `Tidak ada file yang mengandung: ${terms.map(t => `"${t}"`).join(', ')}`
        : results.join('\n\n');
      return { action: 'searchText', log };
    }

    // ── moveFile({file:"...",to:"..."}) ───────────────────────────────────────
    if (cmdBody.startsWith('moveFile(')) {
      const argMatch = cmdBody.match(/^moveFile\(([\s\S]+?)\)\s*$/);
      if (!argMatch) throw new Error('Format moveFile tidak valid.');
      const { file, to } = parseJsonObject(argMatch[1]);
      if (!file || !to) throw new Error('moveFile membutuhkan key "file" dan "to".');
      const srcPath = file.replace(/^#root\//, '').trim();
      const dstPath = to.replace(/^#root\//, '').trim();
      if (!(srcPath in vfs)) throw new Error(`File tidak ditemukan: ${file}`);
      const newVfs = { ...vfs, [dstPath]: vfs[srcPath] };
      delete newVfs[srcPath];
      return { action: 'moveFile', log: `Berhasil dipindah: ${file} → ${to}`, newVfs };
    }

    throw new Error('Perintah tidak dikenali: ' + cmdBody.slice(0, 60));
  } catch (e) {
    return { action: 'error', log: `ERROR: ${e.message}` };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse a JSON array, tolerating single quotes */
function parseJsonArray(str) {
  const cleaned = str.trim().replace(/'/g, '"');
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error('Diharapkan array JSON.');
  return parsed;
}

/** Parse a JSON object, tolerating single quotes and unquoted keys */
function parseJsonObject(str) {
  let cleaned = str.trim().replace(/'/g, '"');
  // Quote unquoted keys: { file: → { "file":
  cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  return JSON.parse(cleaned);
}
