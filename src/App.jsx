import { useState, useRef, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import { agentLoop } from './agentLoop.js';
import { renderMessage } from './renderer.js';

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconUser   = () => <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>;
const IconSystem = () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>;
const IconAI     = () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>;
const IconSend   = () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg>;
const IconMenu   = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>;
const IconChat   = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>;
const IconFiles  = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>;
const IconFile   = () => <svg className="w-5 h-5 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>;
const IconDl     = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>;
const IconPlus   = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>;
const IconUpload = () => <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>;
const IconAttach = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>;
const IconGitHub = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>;
const IconKey    = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"/></svg>;
const IconTrash  = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>;
const IconEdit   = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>;
const IconCheck  = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>;

// ─── Status color map ─────────────────────────────────────────────────────────
const STATUS_COLOR = {
  idle:   'bg-gray-500',
  active: 'bg-blue-500 blink',
  error:  'bg-red-500 blink',
  done:   'bg-green-500',
};

// ─── GitHub API helpers ───────────────────────────────────────────────────────
function parseRepoUrl(input) {
  const clean = input.trim().replace(/\.git$/, '').replace(/\/$/, '');
  const m = clean.match(/(?:github\.com\/)?([^/\s]+)\/([^/\s]+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

async function fetchGitHubTree(owner, repo, branch, token) {
  const headers = { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' };
  let ref = branch;
  if (!ref) {
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!r.ok) throw new Error(`Repo tidak ditemukan (${r.status}). Cek nama repo & token.`);
    const data = await r.json();
    ref = data.default_branch;
  }
  const r2 = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`, { headers });
  if (!r2.ok) throw new Error(`Gagal mengambil tree (${r2.status})`);
  const tree = await r2.json();
  return { tree: tree.tree.filter(f => f.type === 'blob'), branch: ref };
}

async function fetchFileContent(owner, repo, path, token) {
  const headers = { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' };
  const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, { headers });
  if (!r.ok) throw new Error(`Gagal mengambil ${path} (${r.status})`);
  const data = await r.json();
  return { content: data.content.replace(/\n/g, ''), encoding: data.encoding };
}

async function pushToGitHub(owner, repo, branch, token, vfs, commitMessage) {
  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`, { headers });
  if (!refRes.ok) throw new Error(`Gagal mengambil ref: ${refRes.status}`);
  const refData = await refRes.json();
  const latestCommitSha = refData.object.sha;

  const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}`, { headers });
  if (!commitRes.ok) throw new Error(`Gagal mengambil commit: ${commitRes.status}`);
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;

  const treeItems = [];
  for (const [path, content] of Object.entries(vfs)) {
    if (path.startsWith('_context_upload/')) continue;
    if (typeof content === 'string' && content.startsWith('[BINARY:')) {
      // Binary files: create blob via /git/blobs with base64 encoding to avoid corruption
      const blobRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
        method: 'POST', headers,
        body: JSON.stringify({ content: content.slice(8, -1), encoding: 'base64' }),
      });
      if (!blobRes.ok) {
        const err = await blobRes.json().catch(() => ({}));
        throw new Error(`Gagal membuat blob untuk ${path}: ${err.message || blobRes.status}`);
      }
      const blobData = await blobRes.json();
      treeItems.push({ path, mode: '100644', type: 'blob', sha: blobData.sha });
    } else {
      treeItems.push({ path, mode: '100644', type: 'blob', content: content });
    }
  }

  const newTreeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
    method: 'POST', headers,
    body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems }),
  });
  if (!newTreeRes.ok) {
    const err = await newTreeRes.json().catch(() => ({}));
    throw new Error(`Gagal membuat tree: ${err.message || newTreeRes.status}`);
  }
  const newTreeData = await newTreeRes.json();

  const newCommitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
    method: 'POST', headers,
    body: JSON.stringify({
      message: commitMessage || `PuruAI: update ${new Date().toISOString()}`,
      tree: newTreeData.sha,
      parents: [latestCommitSha],
    }),
  });
  if (!newCommitRes.ok) {
    const err = await newCommitRes.json().catch(() => ({}));
    throw new Error(`Gagal membuat commit: ${err.message || newCommitRes.status}`);
  }
  const newCommitData = await newCommitRes.json();

  const updateRefRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH', headers,
    body: JSON.stringify({ sha: newCommitData.sha }),
  });
  if (!updateRefRes.ok) {
    const err = await updateRefRes.json().catch(() => ({}));
    throw new Error(`Gagal update ref: ${err.message || updateRefRes.status}`);
  }

  return newCommitData.sha;
}

// ─── Token Modal ──────────────────────────────────────────────────────────────
function TokenModal({ onSave, onCancel, existingToken }) {
  const [val, setVal] = useState(existingToken || '');
  const [show, setShow] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-gray-800 rounded-2xl border border-gray-600 shadow-2xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center text-gray-300"><IconKey /></div>
          <h3 className="text-base font-bold text-white">GitHub Personal Access Token</h3>
        </div>
        <p className="text-xs text-gray-400 mb-3 leading-relaxed mt-2">
          Token dibutuhkan untuk akses repo & push ke GitHub. Disimpan di <span className="text-blue-400 font-mono">localStorage</span> browser kamu.
        </p>
        <a href="https://github.com/settings/tokens/new?scopes=repo&description=PuruAI" target="_blank" rel="noopener noreferrer"
          className="text-xs text-blue-400 hover:text-blue-300 underline mb-4 block">
          → Buat token baru di GitHub (perlu scope: repo)
        </a>
        <div className="relative mb-4">
          <input
            type={show ? 'text' : 'password'}
            value={val}
            onChange={e => setVal(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            className="w-full bg-gray-900 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono pr-24"
          />
          <button onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-xs">
            {show ? 'Sembunyikan' : 'Tampilkan'}
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-600 transition-colors">Batal</button>
          <button onClick={() => val.trim() && onSave(val.trim())} disabled={!val.trim()}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-40 transition-colors">
            Simpan Token
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── GitHub Import Screen ─────────────────────────────────────────────────────
function GitHubImportScreen({ token, onImport, onCancel }) {
  const [repoInput, setRepoInput] = useState('');
  const [branch,    setBranch]    = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [progress,  setProgress]  = useState('');

  const handleImport = async () => {
    const parsed = parseRepoUrl(repoInput);
    if (!parsed) { setError('Format tidak valid. Gunakan: owner/repo atau URL GitHub.'); return; }
    setLoading(true); setError(''); setProgress('Mengambil struktur repo...');
    try {
      const { tree, branch: resolvedBranch } = await fetchGitHubTree(parsed.owner, parsed.repo, branch || null, token);
      setProgress(`Ditemukan ${tree.length} file. Mengunduh...`);
      const vfs = {};
      const BATCH = 5;
      for (let i = 0; i < tree.length; i += BATCH) {
        const batch = tree.slice(i, i + BATCH);
        await Promise.all(batch.map(async (item) => {
          try {
            const { content, encoding } = await fetchFileContent(parsed.owner, parsed.repo, item.path, token);
            if (encoding === 'base64') {
              const BINARY_EXTS = /\.(png|jpg|jpeg|gif|webp|ico|bmp|tiff|mp3|mp4|wav|ogg|webm|avi|mov|pdf|woff|woff2|ttf|eot|otf|zip|gz|tar|bin|exe|dll|so|dylib)$/i;
              if (BINARY_EXTS.test(item.path)) {
                // File binary: simpan base64 langsung agar tidak rusak
                vfs[item.path] = `[BINARY:${content}]`;
              } else {
                try { vfs[item.path] = decodeURIComponent(escape(atob(content))); }
                catch { vfs[item.path] = `[BINARY:${content}]`; }
              }
            } else {
              vfs[item.path] = content;
            }
          } catch { /* skip unreadable files */ }
        }));
        setProgress(`Mengunduh file... (${Math.min(i + BATCH, tree.length)}/${tree.length})`);
      }
      onImport(vfs, { owner: parsed.owner, repo: parsed.repo, branch: resolvedBranch });
    } catch (err) { setError(err.message); }
    setLoading(false); setProgress('');
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
      <div className="w-full max-w-sm bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700">
        <button onClick={onCancel} className="text-gray-500 hover:text-gray-300 text-xs mb-5 flex items-center gap-1">← Kembali</button>
        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 bg-gray-700 rounded-xl flex items-center justify-center"><IconGitHub /></div>
          <div>
            <h2 className="text-base font-bold text-white">Import dari GitHub</h2>
            <p className="text-xs text-gray-500">Clone repo ke Virtual File System</p>
          </div>
        </div>

        <label className="text-xs text-gray-400 font-medium block mb-1">Repository</label>
        <input type="text" value={repoInput} onChange={e => { setRepoInput(e.target.value); setError(''); }}
          placeholder="owner/repo atau https://github.com/..." disabled={loading}
          className="w-full bg-gray-900 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 mb-3 font-mono" />

        <label className="text-xs text-gray-400 font-medium block mb-1">
          Branch <span className="text-gray-600">(opsional)</span>
        </label>
        <input type="text" value={branch} onChange={e => setBranch(e.target.value)}
          placeholder="main (default: branch utama repo)" disabled={loading}
          className="w-full bg-gray-900 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 mb-4 font-mono" />

        {error && <div className="bg-red-900/40 border border-red-700 text-red-300 text-xs rounded-lg p-3 mb-4">{error}</div>}
        {loading && progress && (
          <div className="bg-blue-900/40 border border-blue-700 text-blue-300 text-xs rounded-lg p-3 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-400 blink shrink-0"></span>{progress}
          </div>
        )}

        <button onClick={handleImport} disabled={loading || !repoInput.trim()}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold py-3 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
          {loading
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>Mengimpor...</>
            : <><IconGitHub /> Impor Repository</>}
        </button>
      </div>
    </div>
  );
}

// ─── Push Modal ───────────────────────────────────────────────────────────────
function PushModal({ githubInfo, token, vfsRef, onClose }) {
  const [msg,     setMsg]     = useState('');
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState('');
  const [error,   setError]   = useState('');

  const handlePush = async () => {
    setLoading(true); setError(''); setDone('');
    try {
      const sha = await pushToGitHub(
        githubInfo.owner, githubInfo.repo, githubInfo.branch, token,
        vfsRef.current, msg || `PuruAI: update ${new Date().toLocaleString('id-ID')}`
      );
      setDone(sha.slice(0, 7));
    } catch (err) { setError(err.message); }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-gray-800 rounded-2xl border border-gray-600 shadow-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center"><IconGitHub /></div>
          <div>
            <h3 className="text-base font-bold text-white">Push ke GitHub</h3>
            <p className="text-xs text-gray-500 font-mono">{githubInfo.owner}/{githubInfo.repo}:{githubInfo.branch}</p>
          </div>
        </div>

        {!done ? (
          <>
            <label className="text-xs text-gray-400 font-medium block mb-1">Pesan Commit</label>
            <input type="text" value={msg} onChange={e => setMsg(e.target.value)} disabled={loading}
              placeholder={`PuruAI: update ${new Date().toLocaleString('id-ID')}`}
              className="w-full bg-gray-900 border border-gray-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 mb-4" />
            {error && <div className="bg-red-900/40 border border-red-700 text-red-300 text-xs rounded-lg p-3 mb-4">{error}</div>}
            <div className="flex gap-2">
              <button onClick={onClose} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-600 disabled:opacity-40 transition-colors">Batal</button>
              <button onClick={handlePush} disabled={loading}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-500 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                {loading
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>Pushing...</>
                  : 'Push'}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="w-12 h-12 bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-3 text-green-400"><IconCheck /></div>
            <p className="text-white font-semibold mb-1">Push Berhasil!</p>
            <p className="text-xs text-gray-400 font-mono mb-3">Commit: {done}</p>
            <a href={`https://github.com/${githubInfo.owner}/${githubInfo.repo}/commit/${done}`}
              target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline block mb-4">
              → Lihat commit di GitHub
            </a>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-gray-700 text-gray-300 text-sm font-medium hover:bg-gray-600 transition-colors">Tutup</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Collapsible Message Content ─────────────────────────────────────────────
const MSG_COLLAPSE_THRESHOLD = 500; // chars — pesan lebih panjang dari ini akan dilipat

function MessageContent({ text, role }) {
  const isLong = text.length > MSG_COLLAPSE_THRESHOLD;
  const [expanded, setExpanded] = useState(false);

  const displayText = isLong && !expanded
    ? text.slice(0, MSG_COLLAPSE_THRESHOLD) + '…'
    : text;

  return (
    <div>
      <div
        className={`leading-relaxed break-words ${role === 'system' ? 'font-mono text-xs' : 'text-sm'}`}
        dangerouslySetInnerHTML={{ __html: renderMessage(displayText, role) }}
      />
      {isLong && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-2 text-[11px] font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
        >
          {expanded ? '▲ Tutup' : '▼ Baca Selengkapnya'}
        </button>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,         setScreen]         = useState('setup');
  const [activeTab,      setActiveTab]      = useState('chat');
  const [chatHistory,    setChatHistory]    = useState([]);
  const [vfs,            setVfs]            = useState({});
  const [isLooping,      setIsLooping]      = useState(false);
  const [statusText,     setStatusText]     = useState('Ready');
  const [statusType,     setStatusType]     = useState('idle');
  const [userInput,      setUserInput]      = useState('');
  const [isMenuOpen,     setIsMenuOpen]     = useState(false);
  const [githubToken,    setGithubToken]    = useState(() => localStorage.getItem('puruai_github_token') || '');
  const [githubInfo,     setGithubInfo]     = useState(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showPushModal,  setShowPushModal]  = useState(false);
  const [tokenEditMode,  setTokenEditMode]  = useState(false);

  const vfsRef           = useRef({});
  const aiMemoryRef      = useRef([]);
  const isLoopingRef     = useRef(false);
  const chatRef          = useRef([]);
  const chatContainerRef = useRef(null);
  const textareaRef      = useRef(null);

  useEffect(() => { vfsRef.current = vfs; }, [vfs]);
  useEffect(() => { chatRef.current = chatHistory; }, [chatHistory]);
  useEffect(() => {
    if (chatContainerRef.current) chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }, [chatHistory]);

  const addChatMsg = useCallback((msg) => {
    chatRef.current = [...chatRef.current, msg];
    setChatHistory([...chatRef.current]);
  }, []);
  const addAiMemoryMsg = useCallback((msg) => { aiMemoryRef.current = [...aiMemoryRef.current, msg]; }, []);
  const clearAiMemory  = useCallback(() => { aiMemoryRef.current = []; }, []);
  const updateVfs = useCallback((newVfs) => { vfsRef.current = newVfs; setVfs({ ...newVfs }); }, []);
  const setStatus = useCallback(({ text, type }) => {
    setStatusText(text); setStatusType(type);
    if ((type === 'done' || type === 'idle') && !isLoopingRef.current) setIsLooping(false);
  }, []);
  const stopLoop       = useCallback(() => { isLoopingRef.current = false; setIsLooping(false); }, []);
  const shouldContinue = useCallback(() => isLoopingRef.current, []);

  const sendPrompt = useCallback(() => {
    const text = userInput.trim();
    if (!text || isLoopingRef.current) return;
    isLoopingRef.current = true;
    setIsLooping(true);
    setUserInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    if (statusType === 'done') setStatusType('idle');
    agentLoop({ initialPrompt: text, getVfs: () => vfsRef.current, updateVfs, getAiMemory: () => aiMemoryRef.current, addChatMsg, addAiMemoryMsg, clearAiMemory, setStatus, stopLoop, shouldContinue });
  }, [userInput, statusType, updateVfs, addChatMsg, addAiMemoryMsg, clearAiMemory, setStatus, stopLoop, shouldContinue]);

  const startFreshProject = useCallback(() => {
    vfsRef.current = {}; aiMemoryRef.current = []; chatRef.current = [];
    setVfs({}); setChatHistory([]); setGithubInfo(null);
    setIsLooping(false); setStatusText('Ready'); setStatusType('idle');
    setActiveTab('chat'); setScreen('workspace');
  }, []);

  const startGitHubImport = useCallback(() => {
    if (!githubToken) { setShowTokenModal(true); }
    else setScreen('github-import');
  }, [githubToken]);

  const handleTokenSave = useCallback((token) => {
    localStorage.setItem('puruai_github_token', token);
    setGithubToken(token); setShowTokenModal(false); setTokenEditMode(false);
    if (!tokenEditMode) setScreen('github-import');
  }, [tokenEditMode]);

  const handleTokenDelete = useCallback(() => {
    localStorage.removeItem('puruai_github_token');
    setGithubToken(''); setIsMenuOpen(false);
  }, []);

  const handleGitHubImport = useCallback((importedVfs, info) => {
    vfsRef.current = importedVfs; aiMemoryRef.current = [];
    const sysMsg = { role: 'system', text: `✅ Berhasil import dari GitHub: ${info.owner}/${info.repo} (branch: ${info.branch}) — ${Object.keys(importedVfs).length} file dimuat.` };
    chatRef.current = [sysMsg];
    setVfs({ ...importedVfs }); setChatHistory([sysMsg]); setGithubInfo(info);
    setScreen('workspace'); setStatusText('Ready'); setStatusType('idle'); setActiveTab('chat');
  }, []);

  const clearSession = useCallback(() => {
    aiMemoryRef.current = [];
    chatRef.current = [{ role: 'system', text: 'Sistem dikosongkan. File project Anda tetap aman.' }];
    setChatHistory([...chatRef.current]);
    isLoopingRef.current = false; setIsLooping(false); setStatusType('idle'); setStatusText('Ready');
  }, []);

  const resetAll = useCallback(() => {
    vfsRef.current = {}; aiMemoryRef.current = []; chatRef.current = []; isLoopingRef.current = false;
    setVfs({}); setChatHistory([]); setGithubInfo(null); setIsLooping(false);
    setStatusType('idle'); setStatusText('Ready'); setScreen('setup'); setIsMenuOpen(false);
  }, []);

  const handleZipUpload = useCallback(async (e) => {
    const file = e.target.files[0]; if (!file) return;
    setStatusText('Extracting ZIP...'); setStatusType('active');
    try {
      const zip = await JSZip.loadAsync(file);
      const newVfs = {}; const promises = [];
      const BINARY_EXTS = /\.(png|jpg|jpeg|gif|webp|ico|bmp|tiff|mp3|mp4|wav|ogg|webm|avi|mov|pdf|woff|woff2|ttf|eot|otf|zip|gz|tar|bin|exe|dll|so|dylib)$/i;
      zip.forEach((relPath, entry) => {
        if (entry.dir) return;
        if (BINARY_EXTS.test(relPath)) {
          // Baca langsung sebagai base64 agar tidak rusak
          promises.push(entry.async('base64').then(b64 => { newVfs[relPath] = `[BINARY:${b64}]`; }));
        } else {
          promises.push(entry.async('string').then(c => { newVfs[relPath] = c; }).catch(() => entry.async('base64').then(b64 => { newVfs[relPath] = `[BINARY:${b64}]`; })));
        }
      });
      await Promise.all(promises);
      vfsRef.current = newVfs; aiMemoryRef.current = [];
      const sysMsg = { role: 'system', text: `Berhasil memuat ZIP: ${file.name}` };
      chatRef.current = [sysMsg]; setVfs({ ...newVfs }); setChatHistory([sysMsg]);
      setGithubInfo(null); setScreen('workspace'); setStatusText('Ready'); setStatusType('idle');
    } catch (err) { alert('Gagal mengekstrak ZIP: ' + err.message); setStatusText('Error'); setStatusType('error'); }
    e.target.value = '';
  }, []);

  const handleContextUpload = useCallback(async (e) => {
    const file = e.target.files[0]; if (!file || isLoopingRef.current) return;
    setStatusText('Uploading Konteks...'); setStatusType('active');
    try {
      const isText = file.type.startsWith('text/') || /\.(js|ts|jsx|tsx|json|md|txt|html|css|py|sh|yaml|yml|xml|csv)$/i.test(file.name);
      let content;
      if (isText) { content = await file.text(); }
      else {
        const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
        content = `[BINARY:${b64}]`;
      }
      const path = `_context_upload/${file.name}`;
      const newVfs = { ...vfsRef.current, [path]: content };
      vfsRef.current = newVfs; setVfs({ ...newVfs });
      const msg = { role: 'system', text: `User telah mengunggah file konteks: #root/_context_upload/${file.name}` };
      addChatMsg(msg); addAiMemoryMsg(msg);
    } catch (err) { alert('Gagal mengupload file konteks: ' + err.message); }
    setStatusText('Ready'); setStatusType('idle'); e.target.value = '';
  }, [addChatMsg, addAiMemoryMsg]);

  const downloadZip = useCallback(async () => {
    const zip = new JSZip();
    for (const [path, content] of Object.entries(vfsRef.current)) {
      if (path.startsWith('_context_upload/')) continue;
      if (typeof content === 'string' && content.startsWith('[BINARY:')) { zip.file(path, content.slice(8, -1), { base64: true }); }
      else { zip.file(path, content); }
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `PuruAI_Project_${Date.now()}.zip`; a.click(); URL.revokeObjectURL(url);
  }, []);

  const resizeTextarea = useCallback((el) => {
    el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 128) + 'px';
  }, []);

  const filesList = Object.keys(vfs).sort();

  return (
    <div className="bg-gray-900 text-gray-100 font-sans h-[100dvh] flex flex-col overflow-hidden">

      {/* ── Modals ── */}
      {showTokenModal && (
        <TokenModal
          existingToken={githubToken}
          onSave={handleTokenSave}
          onCancel={() => { setShowTokenModal(false); setTokenEditMode(false); }}
        />
      )}
      {showPushModal && githubInfo && (
        <PushModal githubInfo={githubInfo} token={githubToken} vfsRef={vfsRef} onClose={() => setShowPushModal(false)} />
      )}

      {/* ── Header ── */}
      <header className="bg-gray-800 border-b border-gray-700 p-3 flex justify-between items-center shrink-0 z-20 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-500 rounded flex items-center justify-center font-bold text-white text-sm">P</div>
          <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-teal-400">PuruAI</h1>
        </div>
        <div className="flex items-center gap-2 relative">
          <div className="text-[10px] sm:text-xs font-medium text-gray-400 bg-gray-900 px-3 py-1.5 rounded-full flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${STATUS_COLOR[statusType] || STATUS_COLOR.idle}`}></span>
            <span>{statusText}</span>
          </div>
          {screen === 'workspace' && (
            <div className="relative">
              <button onClick={() => setIsMenuOpen(v => !v)} className="p-1.5 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 focus:outline-none transition-colors">
                <IconMenu />
              </button>
              {isMenuOpen && (
                <div className="absolute right-0 top-10 w-56 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-gray-700" onMouseLeave={() => setIsMenuOpen(false)}>
                  {/* GitHub Token */}
                  <div className="px-4 py-3">
                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-2 flex items-center gap-1"><IconKey /> GitHub Token</p>
                    {githubToken ? (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-green-400 font-mono flex-1 truncate">••••{githubToken.slice(-6)}</span>
                        <button onClick={() => { setTokenEditMode(true); setShowTokenModal(true); setIsMenuOpen(false); }} className="text-gray-400 hover:text-white p-1.5 rounded transition-colors" title="Edit"><IconEdit /></button>
                        <button onClick={handleTokenDelete} className="text-red-500 hover:text-red-400 p-1.5 rounded transition-colors" title="Hapus"><IconTrash /></button>
                      </div>
                    ) : (
                      <button onClick={() => { setTokenEditMode(true); setShowTokenModal(true); setIsMenuOpen(false); }} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">+ Tambah Token</button>
                    )}
                  </div>
                  <button onClick={() => { clearSession(); setIsMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 hover:text-white flex items-center gap-2 transition-colors">
                    <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    Clear Percakapan
                  </button>
                  <button onClick={() => { resetAll(); setIsMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 flex items-center gap-2 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                    Reset All (Ke Menu Utama)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── Setup Screen ── */}
      {screen === 'setup' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
          <div className="w-full max-w-sm bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-700">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-white mb-2">Mulai Project</h2>
              <p className="text-gray-400 text-xs">Pilih cara memulai. PuruAI berjalan sepenuhnya di browser.</p>
            </div>

            {/* 1. Fresh project */}
            <button onClick={startFreshProject}
              className="w-full mb-3 bg-blue-600 active:bg-blue-700 text-white font-semibold py-3.5 px-4 rounded-xl transition-all flex items-center gap-3 text-sm shadow-lg shadow-blue-500/20">
              <div className="w-8 h-8 bg-blue-500/50 rounded-lg flex items-center justify-center shrink-0"><IconPlus /></div>
              <div className="text-left">
                <div>Buat Project Baru</div>
                <div className="text-xs text-blue-300/70 font-normal">Mulai dari canvas kosong</div>
              </div>
            </button>

            <div className="relative flex items-center py-2 mb-3">
              <div className="flex-grow border-t border-gray-700"></div>
              <span className="flex-shrink-0 mx-3 text-gray-600 text-xs font-medium">ATAU</span>
              <div className="flex-grow border-t border-gray-700"></div>
            </div>

            {/* 2. Upload ZIP */}
            <label htmlFor="zipUpload"
              className="w-full cursor-pointer bg-gray-700/60 hover:bg-gray-700 border border-gray-600 text-white font-medium py-3.5 px-4 rounded-xl transition-all flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-gray-600 rounded-lg flex items-center justify-center shrink-0"><IconUpload /></div>
              <div className="text-left">
                <div className="text-sm">Upload ZIP Project</div>
                <div className="text-xs text-gray-400 font-normal">Lanjutkan project yang sudah ada</div>
              </div>
            </label>
            <input type="file" id="zipUpload" className="hidden" accept=".zip" onChange={handleZipUpload} />

            {/* 3. Import GitHub */}
            <button onClick={startGitHubImport}
              className="w-full bg-gray-700/60 hover:bg-gray-700 border border-gray-600 text-white font-medium py-3.5 px-4 rounded-xl transition-all flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-600 rounded-lg flex items-center justify-center shrink-0"><IconGitHub /></div>
              <div className="text-left">
                <div className="text-sm">Import dari GitHub</div>
                <div className="text-xs text-gray-400 font-normal">Clone repo ke Virtual File System</div>
              </div>
            </button>

            {githubToken && (
              <p className="text-[10px] text-center text-gray-600 mt-4 flex items-center justify-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>
                GitHub token tersimpan
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── GitHub Import Screen ── */}
      {screen === 'github-import' && (
        <GitHubImportScreen token={githubToken} onImport={handleGitHubImport} onCancel={() => setScreen('setup')} />
      )}

      {/* ── Workspace Screen ── */}
      {screen === 'workspace' && (
        <main className="flex-1 flex flex-col overflow-hidden relative">

          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-3 pb-28 space-y-3">
                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`rounded-xl border p-3 text-sm ${
                    msg.role === 'user'   ? 'bg-blue-900/50 border-blue-700 ml-auto max-w-[90%]' :
                    msg.role === 'system' ? 'bg-gray-800/80 border-gray-700/60 w-full' :
                                            'bg-gray-800 border-gray-700 mr-auto max-w-[95%]'}`}>
                    <div className={`font-bold text-[11px] mb-2 uppercase tracking-wider flex items-center gap-1.5 ${
                      msg.role === 'user' ? 'text-blue-400' : msg.role === 'system' ? 'text-yellow-500' : 'text-teal-400'}`}>
                      {msg.role === 'user' ? <IconUser /> : msg.role === 'system' ? <IconSystem /> : <IconAI />}
                      <span>{msg.role === 'user' ? 'You' : msg.role === 'system' ? 'System Log' : 'PuruAI'}</span>
                    </div>
                    <MessageContent text={msg.text} role={msg.role} />
                  </div>
                ))}

                {statusType === 'done' && (
                  <div className="pt-4 flex justify-center gap-3 flex-wrap">
                    <button onClick={downloadZip}
                      className="bg-green-600 active:bg-green-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg flex items-center gap-2 animate-bounce">
                      <IconDl /> Download ZIP
                    </button>
                    {githubInfo && githubToken && (
                      <button onClick={() => setShowPushModal(true)}
                        className="bg-gray-700 active:bg-gray-600 border border-gray-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2">
                        <IconGitHub /> Push ke GitHub
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="absolute bottom-0 left-0 w-full bg-gray-900 border-t border-gray-800 p-2 sm:p-3 z-10 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.5)]">
                <div className="flex items-end gap-2">
                  <label htmlFor="contextUpload"
                    className={`cursor-pointer p-2.5 bg-gray-800 text-gray-400 hover:text-white rounded-xl border border-gray-700 transition-colors shrink-0 ${isLooping ? 'opacity-50 pointer-events-none' : ''}`}>
                    <IconAttach />
                  </label>
                  <input type="file" id="contextUpload" className="hidden" onChange={handleContextUpload} disabled={isLooping} />
                  <textarea ref={textareaRef} value={userInput}
                    onChange={(e) => { setUserInput(e.target.value); resizeTextarea(e.target); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) sendPrompt(); }}
                    disabled={isLooping} placeholder="Instruksikan AI... (Ctrl+Enter untuk kirim)" rows={1}
                    className="flex-1 bg-gray-800 text-white border border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-all disabled:opacity-50 resize-none overflow-y-auto min-h-[42px] max-h-32" />
                  <button onClick={sendPrompt} disabled={!userInput.trim() || isLooping}
                    className="bg-blue-600 active:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white p-2.5 rounded-xl font-semibold transition-all shrink-0">
                    <IconSend />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
              <div className="p-3 border-b border-gray-800 bg-gray-800 text-xs font-semibold flex justify-between items-center gap-2">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-gray-400 text-[10px] uppercase tracking-wider">Virtual File System</span>
                  {githubInfo && (
                    <span className="text-[10px] text-green-400 font-mono flex items-center gap-1 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block shrink-0"></span>
                      {githubInfo.owner}/{githubInfo.repo}:{githubInfo.branch}
                    </span>
                  )}
                  <span className="bg-gray-700 px-2 py-0.5 rounded text-gray-300 w-max text-[11px]">#root/</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {githubInfo && githubToken && (
                    <button onClick={() => setShowPushModal(true)}
                      className="bg-gray-700 hover:bg-gray-600 border border-gray-500 text-white px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-colors">
                      <IconGitHub /> Push
                    </button>
                  )}
                  <button onClick={downloadZip}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 shadow-md transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    ZIP
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 pb-10">
                {filesList.length === 0
                  ? <div className="text-center text-gray-600 text-sm mt-10 italic">Tidak ada file.</div>
                  : filesList.map(file => (
                    <div key={file} className="flex items-center gap-3 py-2 px-3 border-b border-gray-800 text-sm text-gray-300 break-all">
                      <IconFile /><span className="flex-1">{file}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </main>
      )}

      {screen === 'workspace' && (
        <nav className="bg-gray-800 border-t border-gray-700 flex justify-around items-center h-14 shrink-0 z-30 shadow-[0_-5px_10px_rgba(0,0,0,0.2)]">
          <button onClick={() => setActiveTab('chat')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 h-full transition-colors ${activeTab === 'chat' ? 'text-blue-400' : 'text-gray-500'}`}>
            <IconChat /><span className="text-[10px] font-medium">Chat</span>
          </button>
          <button onClick={() => setActiveTab('files')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 h-full transition-colors ${activeTab === 'files' ? 'text-blue-400' : 'text-gray-500'}`}>
            <IconFiles /><span className="text-[10px] font-medium">Files ({filesList.length})</span>
          </button>
        </nav>
      )}
    </div>
  );
}
