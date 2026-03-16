const _expandState = {};

if (typeof window !== 'undefined') {
  window.toggleExpand = function (uid) {
    const shortEl = document.getElementById('exec-short-' + uid);
    const fullEl  = document.getElementById('exec-full-' + uid);
    const btn     = document.getElementById('btn-expand-' + uid);
    if (!shortEl || !fullEl || !btn) return;
    _expandState[uid] = !_expandState[uid];
    if (_expandState[uid]) {
      shortEl.style.display = 'none';
      fullEl.style.display  = 'block';
      btn.textContent = 'Sembunyikan ↑';
    } else {
      shortEl.style.display = 'block';
      fullEl.style.display  = 'none';
      btn.textContent = 'Baca Selengkapnya ↓';
    }
  };
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTodoBlock(inner) {
  const itemRe = /<index_(\d+)>([\s\S]*?)<\/index_\d+>/gi;
  const items  = [];
  let im;
  while ((im = itemRe.exec(inner)) !== null) {
    items.push({ num: parseInt(im[1]), text: im[2].trim() });
  }
  items.sort((a, b) => a.num - b.num);

  const stepsHtml = items.length > 0
    ? items.map(i =>
        `<div class="todo-step">` +
          `<div class="todo-badge">${i.num}</div>` +
          `<span style="color:#e2e8f0;font-size:13px;line-height:1.6;">${escHtml(i.text)}</span>` +
        `</div>`
      ).join('')
    : `<div style="color:#94a3b8;font-size:12px;padding:4px 0;">${escHtml(inner.trim())}</div>`;

  return `<div class="xml-todo-card">` +
    `<div class="xml-todo-header">` +
      `<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#2dd4bf" stroke-width="2">` +
        `<path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>` +
      `</svg>` +
      `<span style="color:#5eead4;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;">Rencana Todo</span>` +
      `<span style="color:#0d9488;font-size:10px;margin-left:auto;">${items.length} langkah</span>` +
    `</div>` +
    `<div style="padding:10px 12px;display:flex;flex-direction:column;gap:6px;">${stepsHtml}</div>` +
  `</div>`;
}

function renderExecutionBlock(inner) {
  const uid     = Math.random().toString(36).substr(2, 7);
  const trimmed = inner.trim();
  const cmdName = (trimmed.split(/[\s<\n]/)[0] || trimmed).toLowerCase();

  const cmdMeta = {
    write:  { color: '#93c5fd', bg: 'rgba(30,64,175,0.3)'   },
    read:   { color: '#fde68a', bg: 'rgba(120,83,19,0.3)'   },
    all:    { color: '#d1d5db', bg: 'rgba(75,85,99,0.3)'    },
    remove: { color: '#fca5a5', bg: 'rgba(127,29,29,0.3)'   },
    move:   { color: '#c4b5fd', bg: 'rgba(91,33,182,0.3)'   },
    curl:   { color: '#fdba74', bg: 'rgba(124,45,18,0.3)'   },
    stop:   { color: '#f87171', bg: 'rgba(153,27,27,0.4)'   },
    todo:   { color: '#5eead4', bg: 'rgba(13,148,136,0.3)'  },
  };
  const meta    = cmdMeta[cmdName] || { color: '#86efac', bg: 'rgba(20,83,45,0.3)' };
  const isLong  = trimmed.length > 220;
  const preview = isLong ? trimmed.slice(0, 220) : trimmed;

  const btnHtml = isLong
    ? `<button id="btn-expand-${uid}" class="read-more-btn" onclick="window.toggleExpand('${uid}')">Baca Selengkapnya ↓</button>`
    : '';
  const fullPre = isLong
    ? `<pre id="exec-full-${uid}" class="exec-pre" style="display:none;">${escHtml(trimmed)}</pre>`
    : '';

  return `<div class="xml-exec-card">` +
    `<div class="xml-exec-header">` +
      `<div style="display:flex;align-items:center;gap:7px;">` +
        `<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#60a5fa" stroke-width="2">` +
          `<path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>` +
        `</svg>` +
        `<span style="color:#93c5fd;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;">execution</span>` +
        `<span class="cmd-badge" style="color:${meta.color};background:${meta.bg};">${escHtml(cmdName)}</span>` +
      `</div>` +
      btnHtml +
    `</div>` +
    `<pre id="exec-short-${uid}" class="exec-pre">${escHtml(preview)}` +
      (isLong ? `<span style="color:#4b5563;">...</span>` : '') +
    `</pre>` +
    fullPre +
  `</div>`;
}

export function renderMessage(text, role) {
  if (!text) return '';
  if (role === 'user') {
    return `<span style="white-space:pre-wrap;">${escHtml(text)}</span>`;
  }

  const segments = [];
  const tagRe    = /<(todo|execution)>([\s\S]*?)<\/(todo|execution)>/gi;
  let cursor = 0, m;

  while ((m = tagRe.exec(text)) !== null) {
    if (m.index > cursor) {
      segments.push({ type: 'text', content: text.slice(cursor, m.index) });
    }
    segments.push({ type: m[1].toLowerCase(), inner: m[2] });
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) {
    segments.push({ type: 'text', content: text.slice(cursor) });
  }
  if (segments.length === 0) {
    segments.push({ type: 'text', content: text });
  }

  let html = '';
  for (const seg of segments) {
    if (seg.type === 'text') {
      const t = seg.content.trim();
      if (t) html += `<span style="white-space:pre-wrap;word-break:break-word;">${escHtml(t)}</span>`;
    } else if (seg.type === 'todo') {
      html += renderTodoBlock(seg.inner);
    } else if (seg.type === 'execution') {
      html += renderExecutionBlock(seg.inner);
    }
  }
  return html || `<span style="white-space:pre-wrap;">${escHtml(text)}</span>`;
}
