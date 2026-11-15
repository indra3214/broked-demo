/* БРОКЕД демо — общие элементы интерфейса: форматирование, графики, всплывашки */
(function (B) {
  'use strict';
  const nf0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nfd = {};
  const nfDec = d => nfd[d] || (nfd[d] = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d }));

  B.rub = (v, dec) => (dec === 0 ? nf0 : nf2).format(v) + ' ₽';
  B.num = (v, dec) => nfDec(dec == null ? 0 : dec).format(v);
  B.plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };
  B.px = (t, v) => nfDec(B.dec(t)).format(v);
  B.signed = (v, dec) => (v > 0 ? '+' : v < 0 ? '−' : '') + (dec === 0 ? nf0 : nf2).format(Math.abs(v));
  B.srub = (v, dec) => B.signed(v, dec) + ' ₽';
  B.pct = (v, dec) => (v > 0 ? '+' : v < 0 ? '−' : '') + nfDec(dec == null ? 2 : dec).format(Math.abs(v * 100)) + ' %';
  B.cls = v => (v > 1e-9 ? 'up' : v < -1e-9 ? 'down' : 'flat');
  B.compact = v => {
    const a = Math.abs(v);
    if (a >= 1e6) return nfDec(2).format(v / 1e6) + ' млн';
    if (a >= 1e3) return nfDec(0).format(v / 1e3) + ' тыс';
    return nf0.format(v);
  };
  B.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  B.$ = (sel, root) => (root || document).querySelector(sel);
  B.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  B.accLabel = id => { const a = B.ACCMAP[id]; if (!a) return B.journalName ? B.journalName(id) : 'Журнал'; return B.BMAP[a.broker].short + ' · ' + a.name; };
  B.reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- логотип ---------- */
  B.logoIcon = (size, cls) => `<svg class="${cls || ''}" width="${size}" height="${size}" viewBox="0 0 1024 1024" aria-hidden="true">
    <path d="M443 217 A380 380 0 1 0 823 597 L443 597 Z" fill="none" stroke="#7C0DC9" stroke-width="54" stroke-linejoin="miter"/>
    <path d="M540 99 A395 395 0 0 1 935 494 L540 494 Z" fill="none" stroke="#50F08C" stroke-width="54"/>
    <path d="M308 832 L430 757 L510 795 L615 685" fill="none" stroke="#50F08C" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M568 672 L640 657 L627 722 Z" fill="#50F08C"/></svg>`;
  B.wordmark = () => `<span class="wordmark">БРОК<b>ЕД</b></span>`;

  /* ---------- графики ---------- */
  function setupCanvas(cv) {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(10, r.width), h = Math.max(10, r.height);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }
  function niceTicks(min, max, n) {
    const span = max - min || 1; const raw = span / n; const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const st = [1, 2, 2.5, 5, 10].map(x => x * mag).find(x => span / x <= n) || mag * 10;
    const out = []; for (let v = Math.ceil(min / st) * st; v <= max + 1e-9; v += st) out.push(+v.toFixed(10));
    return out;
  }
  const COL = { grid: 'rgba(255,255,255,0.06)', axis: '#77737F', text: '#9D99A7' };

  /* Линейный график: series [{data, color, fill, dash, width}], labels[], yfmt */
  B.LineChart = class {
    constructor(cv, tip) {
      this.cv = cv; this.tip = tip; this.hover = -1; this.opts = null;
      cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); this.mx = e.clientX - r.left; this.draw(); });
      cv.addEventListener('mouseleave', () => { this.mx = null; this.draw(); if (this.tip) this.tip.hidden = true; });
    }
    set(opts) { this.opts = opts; this.draw(); }
    draw() {
      const o = this.opts; if (!o || !this.cv.isConnected) return;
      const { ctx, w, h } = setupCanvas(this.cv);
      ctx.clearRect(0, 0, w, h);
      const padL = o.padL || 72, padR = 14, padT = 12, padB = 24;
      const n = o.labels.length; if (n < 2) return;
      let mn = Infinity, mx = -Infinity;
      o.series.forEach(s => s.data.forEach(v => { if (v < mn) mn = v; if (v > mx) mx = v; }));
      if (o.zero) { mn = Math.min(mn, 0); mx = Math.max(mx, 0); }
      const pad = (mx - mn) * 0.08 || Math.abs(mx) * 0.02 || 1; mn -= pad; mx += pad;
      const X = i => padL + (w - padL - padR) * i / (n - 1);
      const Y = v => padT + (h - padT - padB) * (1 - (v - mn) / (mx - mn));
      ctx.font = '11px "JetBrains Mono", ui-monospace, monospace'; ctx.textBaseline = 'middle';
      niceTicks(mn, mx, 4).forEach(v => {
        const y = Y(v); ctx.strokeStyle = COL.grid; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
        ctx.fillStyle = COL.text; ctx.textAlign = 'right'; ctx.fillText(o.yfmt(v), padL - 8, y);
      });
      if (o.zero) { ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.moveTo(padL, Y(0)); ctx.lineTo(w - padR, Y(0)); ctx.stroke(); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor((w - padL) / 80))));
      for (let i = 0; i < n; i += every) { ctx.fillStyle = COL.text; ctx.fillText(o.labels[i], Math.min(Math.max(X(i), padL + 20), w - 30), h - 6); }
      o.series.forEach(s => {
        ctx.beginPath(); s.data.forEach((v, i) => i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)));
        if (s.fill) {
          ctx.save(); ctx.lineTo(X(n - 1), h - padB); ctx.lineTo(X(0), h - padB); ctx.closePath();
          const g = ctx.createLinearGradient(0, padT, 0, h - padB); g.addColorStop(0, s.fill); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g; ctx.fill(); ctx.restore();
          ctx.beginPath(); s.data.forEach((v, i) => i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)));
        }
        ctx.setLineDash(s.dash ? [5, 5] : []); ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; ctx.lineJoin = 'round'; ctx.stroke(); ctx.setLineDash([]);
        const lv = s.data[n - 1]; ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(X(n - 1), Y(lv), 3.5, 0, Math.PI * 2); ctx.fill();
      });
      if (this.mx != null && this.mx >= padL) {
        const i = Math.max(0, Math.min(n - 1, Math.round((this.mx - padL) / (w - padL - padR) * (n - 1))));
        const x = X(i);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, h - padB); ctx.stroke();
        o.series.forEach(s => { ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(x, Y(s.data[i]), 4, 0, Math.PI * 2); ctx.fill(); });
        if (this.tip) {
          this.tip.hidden = false;
          this.tip.innerHTML = `<div class="tip-date">${o.labels[i]}</div>` + o.series.filter(s => s.name).map(s => `<div><i style="background:${s.color}"></i>${s.name}<b>${o.yfmt(s.data[i], true)}</b></div>`).join('');
          const tw = this.tip.offsetWidth; this.tip.style.left = (x + tw + 24 > w ? x - tw - 12 : x + 12) + 'px'; this.tip.style.top = padT + 'px';
        }
      }
    }
  };

  /* Свечной график */
  B.CandleChart = class {
    constructor(cv) {
      this.cv = cv; this.opts = null;
      cv.addEventListener('mousemove', e => { const r = cv.getBoundingClientRect(); this.mx = e.clientX - r.left; this.my = e.clientY - r.top; this.draw(); });
      cv.addEventListener('mouseleave', () => { this.mx = null; this.draw(); });
      cv.addEventListener('click', () => { if (this.opts && this.opts.onPick && this.hoverPrice) this.opts.onPick(this.hoverPrice); });
    }
    set(opts) { this.opts = opts; this.draw(); }
    draw() {
      const o = this.opts; if (!o || !this.cv.isConnected) return;
      const { ctx, w, h } = setupCanvas(this.cv);
      ctx.clearRect(0, 0, w, h);
      const padL = 8, padR = 64, padT = 10, padB = 22;
      const all = o.candles; const N = Math.min(all.length, o.count || 70);
      const cs = all.slice(all.length - N); const off = all.length - N;
      let mn = Infinity, mx = -Infinity;
      cs.forEach(c => { if (c.l < mn) mn = c.l; if (c.h > mx) mx = c.h; });
      (o.lines || []).forEach(l => { if (l.price < mn) mn = l.price; if (l.price > mx) mx = l.price; });
      const pad = (mx - mn) * 0.06 || 1; mn -= pad; mx += pad;
      const cw = (w - padL - padR) / N;
      const X = i => padL + cw * (i + 0.5);
      const Y = v => padT + (h - padT - padB) * (1 - (v - mn) / (mx - mn));
      ctx.font = '11px "JetBrains Mono", ui-monospace, monospace'; ctx.textBaseline = 'middle';
      niceTicks(mn, mx, 6).forEach(v => {
        const y = Y(v); ctx.strokeStyle = COL.grid; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
        ctx.fillStyle = COL.text; ctx.textAlign = 'left'; ctx.fillText(o.fmt(v), w - padR + 6, y);
      });
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const lstep = Math.max(1, Math.ceil(N / Math.max(2, Math.floor((w - padL - padR) / 72)))); for (let i = 0; i < N; i += lstep) { ctx.fillStyle = COL.text; ctx.fillText(o.label(off + i), X(i), h - 6); }
      const up = '#50F08C', dn = '#FF5A6E';
      cs.forEach((c, i) => {
        const col = c.c >= c.o ? up : dn; const x = X(i);
        ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, Y(c.h)); ctx.lineTo(x, Y(c.l)); ctx.stroke();
        const y1 = Y(Math.max(c.o, c.c)), y2 = Y(Math.min(c.o, c.c));
        ctx.fillStyle = col; ctx.fillRect(x - Math.max(1, cw * 0.32), y1, Math.max(2, cw * 0.64), Math.max(1, y2 - y1));
      });
      // скользящие средние
      (o.ma || []).forEach(m => {
        ctx.beginPath(); let started = false;
        for (let i = 0; i < N; i++) {
          const gi = off + i; if (gi < m.n - 1) continue;
          let s = 0; for (let k = gi - m.n + 1; k <= gi; k++) s += all[k].c; const v = s / m.n;
          if (!started) { ctx.moveTo(X(i), Y(v)); started = true; } else ctx.lineTo(X(i), Y(v));
        }
        ctx.strokeStyle = m.color; ctx.lineWidth = 1.5; ctx.stroke();
      });
      // линии заявок и позиций
      (o.lines || []).forEach(l => {
        const y = Y(l.price);
        ctx.setLineDash(l.dash ? [4, 4] : []); ctx.strokeStyle = l.color; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = '600 10px Manrope, system-ui, sans-serif'; const tw = ctx.measureText(l.text).width + 10;
        ctx.fillStyle = l.color; ctx.fillRect(padL + 4, y - 9, tw, 18);
        ctx.fillStyle = '#0A090D'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(l.text, padL + 9, y + 0.5);
      });
      // последняя цена
      const last = cs[N - 1].c, ly = Y(last);
      ctx.fillStyle = last >= cs[N - 1].o ? up : dn; ctx.fillRect(w - padR + 1, ly - 9, padR - 2, 18);
      ctx.fillStyle = '#0A090D'; ctx.font = '600 11px "JetBrains Mono", monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(o.fmt(last), w - padR + 5, ly + 0.5);
      // перекрестие
      this.hoverPrice = null;
      if (this.mx != null && this.mx < w - padR) {
        const v = mn + (1 - (this.my - padT) / (h - padT - padB)) * (mx - mn);
        this.hoverPrice = v;
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.moveTo(padL, this.my); ctx.lineTo(w - padR, this.my); ctx.moveTo(this.mx, padT); ctx.lineTo(this.mx, h - padB); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#3A3842'; ctx.fillRect(w - padR + 1, this.my - 9, padR - 2, 18);
        ctx.fillStyle = '#F3F1F6'; ctx.fillText(o.fmt(v), w - padR + 5, this.my + 0.5);
        const i = Math.floor((this.mx - padL) / cw);
        if (i >= 0 && i < N) {
          const c = cs[i]; ctx.font = '11px "JetBrains Mono", monospace'; ctx.fillStyle = COL.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
          ctx.fillText(`${o.label(off + i)}  О ${o.fmt(c.o)}  М ${o.fmt(c.h)}  Н ${o.fmt(c.l)}  З ${o.fmt(c.c)}`, padL + 4, padT);
        }
      }
    }
  };

  /* Кольцевая диаграмма (SVG) */
  B.donut = function (segs, size, thick, center) {
    const r = (size - thick) / 2, c = 2 * Math.PI * r;
    const total = segs.reduce((s, x) => s + Math.max(0, x.v), 0) || 1;
    let acc = 0;
    const arcs = segs.filter(s => s.v > 0).map(s => {
      const len = s.v / total * c; const gap = segs.length > 1 ? Math.min(3, len * 0.3) : 0;
      const el = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${thick}" stroke-dasharray="${Math.max(0, len - gap)} ${c}" stroke-dashoffset="${-acc}" transform="rotate(-90 ${size / 2} ${size / 2})"><title>${B.esc(s.label)}</title></circle>`;
      acc += len; return el;
    }).join('');
    return `<svg viewBox="0 0 ${size} ${size}" class="donut" role="img" aria-label="Структура"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="${thick}"/>${arcs}
      <text x="50%" y="46%" text-anchor="middle" class="donut-big">${center[0]}</text><text x="50%" y="60%" text-anchor="middle" class="donut-small">${center[1]}</text></svg>`;
  };

  B.spark = function (data, w, h, color) {
    let mn = Math.min(...data), mx = Math.max(...data); if (mx === mn) mx = mn + 1;
    const pts = data.map((v, i) => (i / (data.length - 1) * w).toFixed(1) + ',' + (h - 2 - (v - mn) / (mx - mn) * (h - 4)).toFixed(1)).join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  };

  /* ---------- всплывающие уведомления ---------- */
  B.toast = function (host, html, kind, ms) {
    const box = typeof host === 'string' ? B.$(host) : host; if (!box) return;
    const el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.innerHTML = html;
    box.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, ms || 3800);
    while (box.children.length > 4) box.firstChild.remove();
  };

  /* ---------- модальное окно ---------- */
  B.modal = function (html, opts) {
    opts = opts || {};
    const wrap = document.createElement('div'); wrap.className = 'modal-wrap ' + (opts.cls || '');
    wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><button class="modal-x" aria-label="Закрыть">×</button>${html}</div>`;
    (opts.host || document.body).appendChild(wrap);
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); opts.onClose && opts.onClose(); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) close(); });
    wrap.querySelector('.modal-x').onclick = close;
    return { el: wrap.querySelector('.modal'), close };
  };

  // новости: у каждой свой ключ, чтобы клик открывал именно ту, что видна, даже если лента успела сдвинуться
  let newsSeq = 0;
  B.newsKey = n => n.key || (n.key = 'n' + (++newsSeq));
  B.newsByKey = k => { const S = B.S(); return S.news.find(n => n.key === k) || Object.values(S.newsBy || {}).flat().find(n => n.key === k); };
  B.newsModal = function (n, opts) {
    const body = B.newsBody(n); const ins = n.t && B.IMAP[n.t];
    const m = B.modal(`<article class="nw-read">
      <span class="eyebrow">${B.esc(body.source)} · ${B.dateFull(n.day)}, ${B.timeOf(n.tick)}</span>
      <h3>${B.esc(n.text)}</h3>
      ${body.paras.map(p => `<p>${B.esc(p)}</p>`).join('')}
      <p class="nw-note">Текст новости собран генератором из шаблонов, компании и аналитики вымышленные.</p>
      ${ins ? `<div class="m-actions"><span class="nw-chip"><i class="pdot" style="background:${ins.color}"></i><b>${B.esc(ins.n)}</b> ${n.t}</span><button class="btn-g" data-open-asset="${n.t}">${opts.assetLabel || 'Открыть бумагу'}</button></div>` : ''}
    </article>`, { host: opts.host, cls: 'news-m' });
    const b = m.el.querySelector('[data-open-asset]');
    if (b) b.onclick = () => { m.close(); opts.onAsset && opts.onAsset(n.t); };
    return m;
  };
})(window.B);
