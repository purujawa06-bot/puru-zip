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

// ─── Status color map ─────────────────────────────────────────────────────────
const STATUS_COLOR = {
  idle:   'bg-gray-500',
  active: 'bg-blue-500 blink',
  error:  'bg-red-500 blink',
  done:   'bg-green-500',
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,      setScreen]      = useState('setup');    // 'setup' | 'workspace'
  const [activeTab,   setActiveTab]   = useState('chat');
  const [chatHistory, setChatHistory] = useState([]);
  const [vfs,         setVfs]         = useState({});         // { 'path': 'content' }
  const [isLooping,   setIsLooping]   = useState(false);
  const [statusText,  setStatusText]  = useState('Ready');
  const [statusType,  setStatusType]  = useState('idle');
  const [userInput,   setUserInput]   = useState('');
  const [isMenuOpen,  setIsMenuOpen]  = useState(false);

  // Refs for async agent loop (avoid stale closures)
  const vfsRef        = useRef({});
  const aiMemoryRef   = useRef([]);
  const isLoopingRef  = useRef(false);
  const chatRef       = useRef([]);
  const chatContainerRef = useRef(null);
  const textareaRef   = useRef(null);

  // ── Sync refs when state changes ──
  useEffect(() => { vfsRef.current = vfs; }, [vfs]);
  useEffect(() => { chatRef.current = chatHistory; }, [chatHistory]);

  // ── Auto-scroll chat ──
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // ── Agent callbacks (stable refs) ──
  const addChatMsg = useCallback((msg) => {
    chatRef.current = [...chatRef.current, msg];
    setChatHistory([...chatRef.current]);
  }, []);

  const addAiMemoryMsg = useCallback((msg) => {
    aiMemoryRef.current = [...aiMemoryRef.current, msg];
  }, []);

  const clearAiMemory = useCallback(() => {
    aiMemoryRef.current = [];
  }, []);

  const updateVfs = useCallback((newVfs) => {
    vfsRef.current = newVfs;
    setVfs({ ...newVfs });
  }, []);

  const setStatus = useCallback(({ text, type }) => {
    setStatusText(text);
    setStatusType(type);
    if (type === 'done' || type === 'idle') {
      if (!isLoopingRef.current) setIsLooping(false);
    }
  }, []);

  const stopLoop = useCallback(() => {
    isLoopingRef.current = false;
    setIsLooping(false);
  }, []);

  const shouldContinue = useCallback(() => isLoopingRef.current, []);

  // ── Send prompt ──
  const sendPrompt = useCallback(() => {
    const text = userInput.trim();
    if (!text || isLoopingRef.current) return;

    isLoopingRef.current = true;
    setIsLooping(true);
    setUserInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    if (statusType === 'done') setStatusType('idle');

    agentLoop({
      initialPrompt: text,
      getVfs:         () => vfsRef.current,
      updateVfs,
      getAiMemory:    () => aiMemoryRef.current,
      addChatMsg,
      addAiMemoryMsg,
      clearAiMemory,
      setStatus,
      stopLoop,
      shouldContinue,
    });
  }, [userInput, statusType, updateVfs, addChatMsg, addAiMemoryMsg, clearAiMemory, setStatus, stopLoop, shouldContinue]);

  // ── Start fresh project ──
  const startFreshProject = useCallback(() => {
    vfsRef.current = {};
    aiMemoryRef.current = [];
    chatRef.current = [];
    setVfs({});
    setChatHistory([]);
    setIsLooping(false);
    setStatusText('Ready');
    setStatusType('idle');
    setActiveTab('chat');
    setScreen('workspace');
  }, []);

  // ── Clear session (chat only) ──
  const clearSession = useCallback(() => {
    aiMemoryRef.current = [];
    chatRef.current = [{ role: 'system', text: 'Sistem dikosongkan. File project Anda tetap aman.' }];
    setChatHistory([...chatRef.current]);
    isLoopingRef.current = false;
    setIsLooping(false);
    setStatusType('idle');
    setStatusText('Ready');
  }, []);

  // ── Reset all ──
  const resetAll = useCallback(() => {
    vfsRef.current = {};
    aiMemoryRef.current = [];
    chatRef.current = [];
    isLoopingRef.current = false;
    setVfs({});
    setChatHistory([]);
    setIsLooping(false);
    setStatusType('idle');
    setStatusText('Ready');
    setScreen('setup');
    setIsMenuOpen(false);
  }, []);

  // ── ZIP upload ──
  const handleZipUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setStatusText('Extracting ZIP...');
    setStatusType('active');
    try {
      const zip = await JSZip.loadAsync(file);
      const newVfs = {};
      const promises = [];

      zip.forEach((relPath, entry) => {
        if (entry.dir) return;
        promises.push(
          entry.async('string')
            .then(content => { newVfs[relPath] = content; })
            .catch(() =>
              entry.async('base64').then(b64 => { newVfs[relPath] = `[BINARY:${b64}]`; })
            )
        );
      });

      await Promise.all(promises);
      vfsRef.current = newVfs;
      aiMemoryRef.current = [];
      const sysMsg = { role: 'system', text: `Berhasil memuat ZIP: ${file.name}` };
      chatRef.current = [sysMsg];
      setVfs({ ...newVfs });
      setChatHistory([sysMsg]);
      setScreen('workspace');
      setStatusText('Ready');
      setStatusType('idle');
    } catch (err) {
      alert('Gagal mengekstrak ZIP: ' + err.message);
      setStatusText('Error');
      setStatusType('error');
    }
    e.target.value = '';
  }, []);

  // ── Context file upload ──
  const handleContextUpload = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file || isLoopingRef.current) return;
    setStatusText('Uploading Konteks...');
    setStatusType('active');
    try {
      const isText = file.type.startsWith('text/') || /\.(js|ts|jsx|tsx|json|md|txt|html|css|py|sh|yaml|yml|xml|csv)$/i.test(file.name);
      let content;
      if (isText) {
        content = await file.text();
      } else {
        const b64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result.split(',')[1]);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        content = `[BINARY:${b64}]`;
      }
      const path = `_context_upload/${file.name}`;
      const newVfs = { ...vfsRef.current, [path]: content };
      vfsRef.current = newVfs;
      setVfs({ ...newVfs });

      const msg = { role: 'system', text: `User telah mengunggah file konteks: #root/_context_upload/${file.name}` };
      addChatMsg(msg);
      addAiMemoryMsg(msg);
    } catch (err) {
      alert('Gagal mengupload file konteks: ' + err.message);
    }
    setStatusText('Ready');
    setStatusType('idle');
    e.target.value = '';
  }, [addChatMsg, addAiMemoryMsg]);

  // ── Download ZIP ──
  const downloadZip = useCallback(async () => {
    const zip = new JSZip();
    for (const [path, content] of Object.entries(vfsRef.current)) {
      if (path.startsWith('_context_upload/')) continue;
      if (typeof content === 'string' && content.startsWith('[BINARY:')) {
        const b64 = content.slice(8, -1);
        zip.file(path, b64, { base64: true });
      } else {
        zip.file(path, content);
      }
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `PuruAI_Project_${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── Textarea auto-resize ──
  const resizeTextarea = useCallback((el) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 128) + 'px';
  }, []);

  const filesList = Object.keys(vfs).sort();

  // ─────────────────────────────── RENDER ────────────────────────────────────
  return (
    <div className="bg-gray-900 text-gray-100 font-sans h-[100dvh] flex flex-col overflow-hidden">

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
              <button
                onClick={() => setIsMenuOpen(v => !v)}
                className="p-1.5 bg-gray-700 text-gray-300 rounded-md hover:bg-gray-600 focus:outline-none transition-colors"
              >
                <IconMenu />
              </button>
              {isMenuOpen && (
                <div
                  className="absolute right-0 top-10 w-48 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-gray-700"
                  onMouseLeave={() => setIsMenuOpen(false)}
                >
                  <button
                    onClick={() => { clearSession(); setIsMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-gray-700 hover:text-white flex items-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                    Clear Percakapan
                  </button>
                  <button
                    onClick={() => { resetAll(); setIsMenuOpen(false); }}
                    className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 flex items-center gap-2 transition-colors"
                  >
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
              <p className="text-gray-400 text-xs">Pilih mode untuk memulai. PuruAI berjalan sepenuhnya di browser.</p>
            </div>
            <button
              onClick={startFreshProject}
              className="w-full mb-5 bg-blue-600 active:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-blue-500/20"
            >
              <IconPlus /> Buat Project Baru
            </button>
            <div className="relative flex items-center py-2 mb-5">
              <div className="flex-grow border-t border-gray-700"></div>
              <span className="flex-shrink-0 mx-4 text-gray-500 text-xs font-medium">ATAU</span>
              <div className="flex-grow border-t border-gray-700"></div>
            </div>
            <label
              htmlFor="zipUpload"
              className="w-full cursor-pointer bg-gray-700 active:bg-gray-600 border border-dashed border-gray-500 text-white font-medium py-4 px-4 rounded-xl transition-all flex flex-col items-center justify-center gap-2"
            >
              <IconUpload />
              <span className="text-sm text-gray-300">Upload ZIP Project</span>
              <span className="text-xs text-gray-500">Lanjutkan project yang sudah ada</span>
            </label>
            <input type="file" id="zipUpload" className="hidden" accept=".zip" onChange={handleZipUpload} />
          </div>
        </div>
      )}

      {/* ── Workspace Screen ── */}
      {screen === 'workspace' && (
        <main className="flex-1 flex flex-col overflow-hidden relative">

          {/* Tab: Chat */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-3 pb-28 space-y-3">
                {chatHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl border p-3 text-sm ${
                      msg.role === 'user'   ? 'bg-blue-900/50 border-blue-700 ml-auto max-w-[90%]' :
                      msg.role === 'system' ? 'bg-gray-800/80 border-gray-700/60 w-full' :
                                              'bg-gray-800 border-gray-700 mr-auto max-w-[95%]'
                    }`}
                  >
                    <div className={`font-bold text-[11px] mb-2 uppercase tracking-wider flex items-center gap-1.5 ${
                      msg.role === 'user'   ? 'text-blue-400' :
                      msg.role === 'system' ? 'text-yellow-500' :
                                              'text-teal-400'
                    }`}>
                      {msg.role === 'user'   ? <IconUser /> :
                       msg.role === 'system' ? <IconSystem /> :
                                               <IconAI />}
                      <span>{msg.role === 'user' ? 'You' : msg.role === 'system' ? 'System Log' : 'PuruAI'}</span>
                    </div>
                    <div
                      className={`leading-relaxed break-words ${msg.role === 'system' ? 'font-mono text-xs' : 'text-sm'}`}
                      dangerouslySetInnerHTML={{ __html: renderMessage(msg.text, msg.role) }}
                    />
                  </div>
                ))}

                {statusType === 'done' && (
                  <div className="pt-4 flex justify-center">
                    <button
                      onClick={downloadZip}
                      className="bg-green-600 active:bg-green-700 text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all shadow-lg flex items-center gap-2 animate-bounce"
                    >
                      <IconDl /> Download ZIP Sekarang
                    </button>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="absolute bottom-0 left-0 w-full bg-gray-900 border-t border-gray-800 p-2 sm:p-3 z-10 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.5)]">
                <div className="flex items-end gap-2">
                  <label
                    htmlFor="contextUpload"
                    className={`cursor-pointer p-2.5 bg-gray-800 text-gray-400 hover:text-white rounded-xl border border-gray-700 transition-colors shrink-0 ${isLooping ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <IconAttach />
                  </label>
                  <input type="file" id="contextUpload" className="hidden" onChange={handleContextUpload} disabled={isLooping} />
                  <textarea
                    ref={textareaRef}
                    value={userInput}
                    onChange={(e) => { setUserInput(e.target.value); resizeTextarea(e.target); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) sendPrompt(); }}
                    disabled={isLooping}
                    placeholder="Instruksikan AI... (Ctrl+Enter untuk kirim)"
                    rows={1}
                    className="flex-1 bg-gray-800 text-white border border-gray-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500 transition-all disabled:opacity-50 resize-none overflow-y-auto min-h-[42px] max-h-32"
                  />
                  <button
                    onClick={sendPrompt}
                    disabled={!userInput.trim() || isLooping}
                    className="bg-blue-600 active:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white p-2.5 rounded-xl font-semibold transition-all shrink-0"
                  >
                    <IconSend />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tab: Files */}
          {activeTab === 'files' && (
            <div className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
              <div className="p-3 border-b border-gray-800 bg-gray-800 text-xs font-semibold flex justify-between items-center">
                <div className="flex flex-col gap-1">
                  <span className="text-gray-400">VIRTUAL FILE SYSTEM (In-Browser)</span>
                  <span className="bg-gray-700 px-2 py-0.5 rounded text-gray-300 w-max">#root/</span>
                </div>
                <button
                  onClick={downloadZip}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 shadow-md transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  Download ZIP
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 pb-10">
                {filesList.length === 0 ? (
                  <div className="text-center text-gray-600 text-sm mt-10 italic">Tidak ada file.</div>
                ) : (
                  filesList.map(file => (
                    <div key={file} className="flex items-center gap-3 py-2 px-3 border-b border-gray-800 text-sm text-gray-300 break-all">
                      <IconFile />
                      <span className="flex-1">{file}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      )}

      {/* ── Bottom Navbar ── */}
      {screen === 'workspace' && (
        <nav className="bg-gray-800 border-t border-gray-700 flex justify-around items-center h-14 shrink-0 z-30 shadow-[0_-5px_10px_rgba(0,0,0,0.2)]">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 h-full transition-colors ${activeTab === 'chat' ? 'text-blue-400' : 'text-gray-500'}`}
          >
            <IconChat />
            <span className="text-[10px] font-medium">Chat</span>
          </button>
          <button
            onClick={() => setActiveTab('files')}
            className={`flex-1 flex flex-col items-center justify-center gap-1 h-full transition-colors ${activeTab === 'files' ? 'text-blue-400' : 'text-gray-500'}`}
          >
            <IconFiles />
            <span className="text-[10px] font-medium">Files ({filesList.length})</span>
          </button>
        </nav>
      )}
    </div>
  );
}
