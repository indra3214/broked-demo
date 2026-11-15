/* БРОКЕД демо — режим «Приложение для ПК» */
(function (B) {
  'use strict';
  const $ = B.$, $$ = B.$$;
  const D = B.Desk = {
    screen: 'terminal', sel: 'ZNTH', wlTab: 'all', ma: { 20: true, 50: false },
    t: { side: 'buy', acc: null, type: 'market', lots: 1, price: null, trigger: null, visible: 1, oco: false, ocoTrigger: null, touched: false },
    plan: null, planState: null, chart: null,
  };
  const TYPES = [['market', 'Рыночная'], ['limit', 'Лимитная'], ['stop', 'Стоп-лосс'], ['take', 'Тейк-профит'], ['iceberg', 'Айсберг']];
  const TYPE_NAME = { market: 'Рыночная', limit: 'Лимитная', stop: 'Стоп-лосс', take: 'Тейк-профит', iceberg: 'Айсберг' };
  const STATUS = { active: 'Активна', pending: 'Ожидает активации', filled: 'Исполнена', cancelled: 'Снята', rejected: 'Отклонена' };

  const ICON = {
    terminal: '<path d="M4 18l4-6 4 3 5-8 3 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    orders: '<path d="M4 8h16v11H4zM9 8V5h6v3M4 13h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    rebalance: '<path d="M12 3a9 9 0 1 0 9 9h-9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    deals: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    accounts: '<path d="M8 11V8a4 4 0 1 1 8 0v3M6 11h12v9H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  };
  D.mount = function (root) {
    const nav = [['terminal', 'Терминал'], ['orders', 'Портфель'], ['deals', 'Заявки и сделки', 'd-ord-badge'], ['rebalance', 'Ребалансировка', 'd-reb-badge'], ['accounts', 'Счета и ключи']];
    root.innerHTML = `
      <div class="aw-title">
        <span class="aw-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="aw-name">${B.logoIcon(16)}БРОКЕД</span>
        <span class="aw-lic" title="Лицензия привязана к этому ПК">Premium</span>
        <span class="aw-spacer"></span>
        <span class="aw-sync" id="d-sync" title="Позиции и деньги синхронизируются с сайтом"><i></i>Синхронизировано с сайтом</span>
      </div>
      <div class="aw-body">
        <nav class="aw-side" aria-label="Разделы приложения">
          ${nav.map(([k, n, badge]) => `<button data-dnav="${k}" id="d-nav-${k === 'rebalance' ? 'reb' : k}" title="${n}" aria-label="${n}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg><span class="tip">${n}</span>${badge ? `<em id="${badge}" hidden></em>` : ''}</button>`).join('')}
        </nav>
        <div class="aw-main" id="d-view"></div>
      </div>
      <div class="aw-status" id="d-status"></div>
      <div class="toasts desk" id="d-toasts" aria-live="polite"></div>
      <div class="aw-lock" id="d-lock" hidden><div class="aw-lock-card">${B.logoIcon(40)}<h3>Приложение доступно в Premium</h3><p>На текущем тарифе работает только аналитика на сайте. Торговля, заявки и ребалансировка в один клик – в Premium.</p><button class="btn-g" id="d-lock-up">Вернуть Premium</button></div></div>`;
    root.querySelector('#d-lock-up').onclick = () => { B.setPlan('Premium'); B.toast('#d-toasts', 'Premium подключён, приложение снова работает', 'good'); };
    root.querySelector('.aw-side').addEventListener('click', e => { const b = e.target.closest('[data-dnav]'); if (b) D.go(b.dataset.dnav); });
  };

  D.planChanged = function (name) {
    const lock = $('#d-lock'); if (lock) lock.hidden = name === 'Premium';
    const lic = $('.aw-lic'); if (lic) lic.textContent = name;
    if (name !== 'Premium' && D.ticket) D.ticket.close();
  };
  D.go = function (screen) {
    if (D.ticket) D.ticket.close();
    D.screen = screen;
    $$('.aw-side button').forEach(b => b.classList.toggle('on', b.dataset.dnav === screen));
    const v = $('#d-view');
    const am = $('.aw-main'); if (am) am.scrollTop = 0;
    B.scrollFrameTop && B.scrollFrameTop($('#desk-frame'));
    ({ terminal: renderTerminal, orders: renderOrders, deals: renderDeals, rebalance: renderReb, accounts: renderAccounts })[screen](v);
    D.update(true);
    B.emitUI && B.emitUI('desk:' + screen);
  };

  D.update = function (force) {
    updateStatus();
    if (B.App.mode !== 'desk' && !force) return;
    if (D.screen === 'terminal') updateTerminal();
    if (D.screen === 'orders') updateOrdersPage();
    if (D.screen === 'deals') updateDeals();
    if (D.ticket) updateTicket();
    if (D.screen === 'rebalance') updateReb();
    if (D.screen === 'accounts' && force) updateAccounts();
  };

  function updateStatus() {
    const S = B.S(); const st = $('#d-status'); if (!st) return;
    const ago = S.lastSync ? Math.max(0, Math.round((Date.now() - S.lastSync) / 1000)) : null;
    const pings = B.BROKERS.map(b => b.ping); 
    st.innerHTML = `<span><i class="dot ok"></i>Основная сессия · <b class="num">${B.timeOf(S.tick)}</b></span>
      <span class="hide-s" title="${B.BROKERS.map(b => b.name + ': ' + b.ping + ' мс').join(', ')}">${pings.length ? 'Брокеры онлайн: ' + B.BROKERS.length + ' · ' + Math.min(...pings) + '–' + Math.max(...pings) + ' мс' : 'Брокеры не подключены'}</span>
      <span class="sp"></span><span class="hide-s">Сайт: ${ago == null ? 'ждёт сделок' : ago < 2 ? 'синхронизировано только что' : 'синхронизировано ' + ago + ' с назад'}</span>`;
    const pend = S.orders.filter(o => o.status === 'active' || o.status === 'pending').length;
    const ob = $('#d-ord-badge'); if (ob) { ob.hidden = !pend; ob.textContent = pend; }
    const rb = $('#d-reb-badge'); if (rb) { rb.hidden = !(D.plan && D.planState !== 'done'); rb.textContent = '1'; }
  }

  /* ================= ТЕРМИНАЛ ================= */
  function eligibleAccs(t) {
    const ins = B.IMAP[t]; const S = B.S();
    return B.ACCOUNTS.filter(a => (ins.type === 'fut' ? a.fut : !a.fut) && S.trade[a.id]).map(a => a.id);
  }
  function pickAcc(t, side) {
    const accs = eligibleAccs(t); if (!accs.length) return null;
    if (side === 'sell') { const withPos = accs.filter(id => B.position(id, t)); if (withPos.length) return withPos.sort((a, b) => B.position(b, t).qty - B.position(a, t).qty)[0]; }
    return accs.sort((a, b) => B.freeCash(b) - B.freeCash(a))[0];
  }
  function capOk(br, type) { return !br ? false : type === 'stop' ? br.caps.stop : type === 'take' ? br.caps.take : type === 'iceberg' ? br.caps.iceberg : true; }

  D.side = 'book'; D.ticket = null;
  D.select = function (t, opts) {
    opts = opts || {};
    D.sel = t;
    const T = D.t;
    if (opts.side) T.side = opts.side;
    if (opts.type) T.type = opts.type;
    if (opts.lots) T.lots = opts.lots;
    T.acc = opts.acc || (eligibleAccs(t).includes(T.acc) ? T.acc : pickAcc(t, T.side));
    if (!eligibleAccs(t).includes(T.acc)) T.acc = pickAcc(t, T.side);
    const q = B.quote(t);
    T.price = opts.price != null ? opts.price : (T.side === 'buy' ? q.bid : q.ask);
    T.touched = opts.price != null; T.trigger = null; T.ocoTrigger = null;
    const br = T.acc ? B.BMAP[B.ACCMAP[T.acc].broker] : null;
    if (!capOk(br, T.type)) T.type = 'market';
    if (D.screen === 'terminal' && $('#d-term')) { renderHead(); renderSide(); updateTerminal(); }
    if (opts.ticket) D.openTicket(); else renderTicket();
  };

  // заявка открывается окном поверх терминала по кнопкам «Купить» и «Продать», клику по стакану или графику
  D.openTicket = function (opts) {
    opts = opts || {};
    if (B.Web && B.Web.tariff !== 'Premium') return;
    const T = D.t, q = B.quote(D.sel);
    if (opts.side) { T.side = opts.side; if (T.side === 'sell') T.acc = pickAcc(D.sel, 'sell') || T.acc; else if (!eligibleAccs(D.sel).includes(T.acc)) T.acc = pickAcc(D.sel, 'buy'); }
    if (opts.price != null) { if (T.type === 'market' || T.type === 'stop' || T.type === 'take') T.type = 'limit'; T.price = opts.price; T.touched = true; }
    else if (!T.touched) T.price = T.side === 'buy' ? q.bid : q.ask;
    if (!D.ticket) {
      const m = B.modal(`<div class="tk-top" id="tk-top"></div><div id="tk-box"></div>`, { host: $('#desk-frame'), cls: 'desk-modal tk-modal', onClose: () => { D.ticket = null; } });
      const box = m.el.querySelector('#tk-box');
      box.addEventListener('input', onTicketInput); box.addEventListener('change', onTicketInput); box.addEventListener('click', onTicketClick);
      D.ticket = m;
    }
    renderTicket();
    B.emitUI && B.emitUI('ticket:open');
  };
  function renderTicket() {
    const box = $('#tk-box'); if (!box || !D.ticket) return;
    box.innerHTML = ticketHTML(); updateTicket();
  }
  D.showSide = function (s) { D.side = s; if ($('#d-term')) { renderSide(); updateTerminal(); } };

  // Раскладка по образцу Финама: слева список бумаг, по центру шапка бумаги и график,
  // справа заявка, стакан и торговые данные, снизу портфель со счётом и сводкой.
  function renderTerminal(v) {
    if (!D.t.acc) D.select(D.sel);
    v.innerHTML = `
      <div class="term no-bottom" id="d-term">
        <aside class="t-wl" id="d-wl">
          <div class="wl-head"><b>Инструменты</b><div class="seg tiny"><button data-wl="all">Все</button><button data-wl="mine">Мои</button></div></div>
          <div class="wl-cols"><span>Инструмент</span><span>Цена / изм.</span></div>
          <div class="wl-list" id="d-wl-list"></div>
        </aside>
        <div class="t-head" id="d-head"></div>
        <section class="t-chartcard">
          <div class="t-tools"><span class="tf" title="Таймфрейм: день">1Д</span><button data-ma="20" class="ma20" aria-pressed="false">MA 20</button><button data-ma="50" class="ma50" aria-pressed="false">MA 50</button><span class="t-ohlc num" id="d-ohlc"></span></div>
          <div class="t-chart" id="d-chart"><canvas id="d-cv" aria-label="Свечной график"></canvas></div>
        </section>
        <aside class="t-side" id="d-side">
          <div class="ts-tabs" role="tablist" aria-label="Правая панель">
            <button data-pane="book" role="tab">Стакан</button><button data-pane="info" role="tab">Торги</button><button data-pane="news" role="tab">Новости</button>
          </div>
          <div class="ts-body" id="d-sidebody"></div>
        </aside>
      </div>`;
    D.chart = new B.CandleChart($('#d-cv'));
    const term = $('#d-term');
    term.addEventListener('click', onTermClick);
    renderHead(); renderSide();
  }

  function onTermClick(e) {
    const T = D.t;
    const pane = e.target.closest('[data-pane]'); if (pane) { D.showSide(pane.dataset.pane); return; }
    const quick = e.target.closest('[data-quick]');
    if (quick) { D.openTicket({ side: quick.dataset.quick }); return; }
    const ma = e.target.closest('[data-ma]'); if (ma) { D.ma[ma.dataset.ma] = !D.ma[ma.dataset.ma]; updateTerminal(); return; }
    const wl = e.target.closest('[data-wl]'); if (wl) { D.wlTab = wl.dataset.wl; updateTerminal(); return; }
    const row = e.target.closest('[data-t]'); if (row) { D.select(row.dataset.t); return; }
    const bk = e.target.closest('[data-px]');
    if (bk) { D.openTicket({ side: bk.dataset.bside === 'ask' ? 'buy' : 'sell', price: +bk.dataset.px }); return; }
    onTableClick(e);
  }

  function onTableClick(e) {
    const c = e.target.closest('[data-cancel]'); if (c) { B.cancel(+c.dataset.cancel); D.update(true); return; }
    const x = e.target.closest('[data-close]');
    if (x) {
      const [acc, t] = x.dataset.close.split('|'); const p = B.position(acc, t); const ins = B.IMAP[t]; if (!p) return;
      const side = p.qty > 0 ? 'sell' : 'buy';
      // защитные заявки по этой бумаге больше не нужны: снимаем их, иначе они держат бумаги в резерве
      const prot = B.S().orders.filter(o => o.acc === acc && o.t === t && o.side === side && (o.status === 'active' || o.status === 'pending'));
      prot.forEach(o => B.cancel(o.id));
      const r = B.place({ acc, t, side, type: 'market', lots: Math.floor(Math.abs(p.qty) / ins.lot) });
      if (!r.ok) B.toast('#d-toasts', B.esc(r.err), 'bad');
      else if (prot.length) B.toast('#d-toasts', 'Позиция закрыта, снято защитных заявок: ' + prot.length, 'info');
      D.update(true); return;
    }
    const nk = e.target.closest('[data-nk]'); const nw = nk && B.newsByKey(nk.dataset.nk);
    if (nw) { B.newsModal(nw, { host: $('#desk-frame'), assetLabel: 'Открыть в терминале', onAsset: t => { if (D.screen !== 'terminal') D.go('terminal'); D.select(t); } }); return; }
    const s = e.target.closest('[data-pick]'); if (s) { if (D.screen !== 'terminal') D.go('terminal'); D.select(s.dataset.pick); }
  }

  /* шапка инструмента */
  function renderHead() {
    const h = $('#d-head'); if (!h) return;
    const t = D.sel, ins = B.IMAP[t];
    h.innerHTML = `
      <div class="th-card">
        <svg class="th-search" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <span class="th-name"><b>${B.esc(ins.n)}</b><small><i class="dot ok"></i>${t} · ДЕМО · <span id="d-time" class="num"></span></small></span>
        <span class="th-px"><b class="num" id="d-px"></b><small class="num" id="d-chg"></small></span>
      </div>
      <span class="th-trade"><button class="th-order buy" data-quick="buy">Купить</button><button class="th-order sell" data-quick="sell">Продать</button></span>
      <span class="th-meta" id="d-meta"></span>`;
  }
  function updateHead() {
    if (!$('#d-px')) return;
    const S = B.S(), t = D.sel, ins = B.IMAP[t], px = S.prices[t], prev = B.prevClose(t);
    $('#d-px').textContent = B.px(t, px) + (ins.type === 'fut' ? '' : ' ₽');
    const c = $('#d-chg'); c.className = 'num ' + B.cls(px - prev); c.textContent = B.signed(px - prev, B.dec(t) ? 2 : 0) + ' (' + B.pct((px - prev) / prev).replace(/^[+−]/, '') + ')';
    $('#d-time').textContent = B.timeOf(S.tick);
    const meta = ins.type === 'fut' ? `ГО ${B.rub(px * ins.mult * ins.go, 0)} · экспирация ${ins.exp}` : ins.type === 'bond' ? `купон ${B.num(ins.coupon, 1)} % · погашение ${ins.mat}` : `${ins.sector} · лот ${ins.lot} шт.`;
    $('#d-meta').textContent = meta;
    const cc = S.cur[t]; const o = $('#d-ohlc');
    if (o) o.innerHTML = `O <b>${B.px(t, cc.o)}</b> H <b>${B.px(t, cc.h)}</b> L <b>${B.px(t, cc.l)}</b> C <b>${B.px(t, cc.c)}</b> <span class="${B.cls(cc.c - cc.o)}">${B.pct((cc.c - cc.o) / cc.o)}</span>`;
  }

  /* боковая панель */
  function renderSide() {
    const body = $('#d-sidebody'); if (!body) return;
    $$('#d-side [data-pane]').forEach(b => { const on = b.dataset.pane === D.side; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    $('#d-side').dataset.active = D.side;
    if (D.side === 'news') { body.innerHTML = `<div class="ts-news" id="d-snews"></div>`; D.newsTop = null; }
    else if (D.side === 'book') body.innerHTML = `<div class="bk-head"><span>Цена</span><span>Лоты</span></div><div class="book-body" id="d-book-body"></div><div class="bk-foot muted" id="d-book-foot"></div>`;
    else body.innerHTML = `<div class="ti" id="d-info"></div>`;
  }

  function listHTML() {
    const S = B.S(); const t = D.sel;
    const mine = new Set(); B.ACCOUNTS.forEach(a => Object.keys(S.acc[a.id].pos).forEach(x => mine.add(x)));
    const items = B.INSTR.filter(i => D.wlTab === 'all' || mine.has(i.t));
    return items.map(i => {
      const px = S.prices[i.t], prev = B.prevClose(i.t), d = (px - prev) / prev;
      const h = S.hist[i.t].slice(-24).map(c => c.c); h.push(px);
      return `<button class="wl-row ${i.t === t ? 'on' : ''}" data-t="${i.t}" title="${B.esc(i.n)}">
        <i class="wl-logo" style="background:${i.color}">${i.t[0]}</i>
        <span class="wl-name"><b>${B.esc(i.n)}</b><small>${i.t}${mine.has(i.t) ? '<em class="wl-mine" title="В портфеле"></em>' : ''}</small></span>
        ${B.spark(h, 44, 22, h[h.length - 1] >= h[0] ? '#50F08C' : '#FF5A6E')}
        <span class="wl-px"><b class="num">${B.px(i.t, px)}</b><small class="num ${B.cls(d)}">${B.pct(d)}</small></span></button>`;
    }).join('') || '<p class="empty">Нет бумаг в портфеле</p>';
  }
  // вкладка «Торги» – как у Финама: лучшие цены, диапазоны, данные дня
  function infoHTML() {
    const S = B.S(), t = D.sel, ins = B.IMAP[t], px = S.prices[t], prev = B.prevClose(t), cc = S.cur[t];
    const bk = B.book(t, 1), hist = S.hist[t];
    const lo = Math.min(cc.l, ...hist.map(c => c.l)), hi = Math.max(cc.h, ...hist.map(c => c.h));
    const range = (l, h, label) => `<div class="ti-range"><div><b class="num">${B.px(t, l)}</b><span>${label}</span><b class="num">${B.px(t, h)}</b></div><i><s style="left:${((px - l) / (h - l || 1) * 100).toFixed(1)}%"></s></i></div>`;
    const row = (k, v) => `<div class="ti-row"><span>${k}</span><b class="num">${v}</b></div>`;
    return `<div class="ti-ba"><div><small>Bid</small><b class="num up">${B.px(t, bk.bids[0].price)}</b><small>объём ${B.num(bk.bids[0].lots)}</small></div><div><small>Ask</small><b class="num down">${B.px(t, bk.asks[0].price)}</b><small>объём ${B.num(bk.asks[0].lots)}</small></div></div>
      ${range(cc.l, cc.h, 'Дневной диапазон')}${range(lo, hi, 'За ' + (hist.length + 1) + ' дн.')}
      ${row('Последняя цена', B.px(t, px))}${row('Изменение цены', `<span class="${B.cls(px - prev)}">${B.signed(px - prev, B.dec(t) ? 2 : 0)} (${B.pct((px - prev) / prev)})</span>`)}
      ${row('Открытие', B.px(t, cc.o))}${row('Максимум', B.px(t, cc.h))}${row('Минимум', B.px(t, cc.l))}${row('Закрытие вчера', B.px(t, prev))}
      ${row('Лот', ins.lot + (ins.type === 'fut' ? ' контр.' : ' шт.'))}${row('Шаг цены', B.px(t, ins.step))}`;
  }

  /* форма заявки */
  function ticketHTML() {
    const T = D.t; const t = D.sel; const ins = B.IMAP[t];
    const accs = eligibleAccs(t);
    if (!accs.includes(T.acc)) T.acc = pickAcc(t, T.side);
    if (!T.acc) return `<div class="tk-nokey"><b>Торговля пока закрыта</b><p>${B.ACCOUNTS.length ? 'Брокеры подключены ключами «только чтение»: приложение видит счета, но не может выставлять заявки. Чтобы торговать, выдайте отдельный ключ с правом на торговлю.' : 'Сначала подключите брокера в разделе «Счета и ключи».'}</p><button class="btn-d" data-gokeys>Открыть «Счета и ключи»</button></div>`;
    const br = B.BMAP[B.ACCMAP[T.acc].broker];
    const missing = TYPES.filter(([k]) => !capOk(br, k)).map(([, n]) => n.toLowerCase());
    const step = ins.step, dec = B.dec(t);
    return `<div class="tk" id="d-ticket">
      <div class="tk-side" role="tablist"><button data-tside="buy" class="buy ${T.side === 'buy' ? 'on' : ''}">Купить</button><button data-tside="sell" class="sell ${T.side === 'sell' ? 'on' : ''}">Продать</button></div>
      <label class="tk-fld"><span>Счёт</span><select id="tk-acc">${accs.map(id => `<option value="${id}" ${id === T.acc ? 'selected' : ''}>${B.accLabel(id)} ${B.ACCMAP[id].num}</option>`).join('')}</select></label>
      <div class="tk-info" id="tk-info"></div>
      <label class="tk-fld"><span>Тип заявки</span><select id="tk-type">${TYPES.map(([k, n]) => `<option value="${k}" ${T.type === k ? 'selected' : ''} ${capOk(br, k) ? '' : 'disabled'}>${n}${capOk(br, k) ? '' : ' – нет у брокера'}</option>`).join('')}</select></label>
      <div class="tk-fld"><span class="tk-lbl">Лоты <small>· в лоте ${ins.lot} ${ins.type === 'fut' ? 'контр.' : 'шт.'}</small><button class="tk-max" data-q="1" id="tk-max"></button></span>
        <span class="stepper"><button data-lots="-1" aria-label="Меньше">−</button><input id="tk-lots" type="number" min="1" step="1" value="${T.lots}" aria-label="Количество лотов"><button data-lots="1" aria-label="Больше">+</button></span></div>
      ${T.type === 'limit' || T.type === 'iceberg' ? `<label class="tk-fld"><span>Цена</span><input id="tk-price" type="number" step="${step}" value="${T.price != null ? (+T.price).toFixed(dec) : ''}"></label>` : ''}
      ${T.type === 'iceberg' ? `<label class="tk-fld"><span>Видимая часть, лотов</span><input id="tk-vis" type="number" min="1" step="1" value="${T.visible}"></label>` : ''}
      ${T.type === 'stop' || T.type === 'take' ? `<label class="tk-fld"><span>Цена активации</span><input id="tk-trg" type="number" step="${step}" value="${T.trigger != null ? (+T.trigger).toFixed(dec) : ''}" placeholder="${defTrigger(T.type)}"></label>` : ''}
      ${T.type === 'stop' && br.caps.take ? `<label class="tk-check"><input type="checkbox" id="tk-oco" ${T.oco ? 'checked' : ''}>Связать с тейк-профитом</label>
        ${T.oco ? `<label class="tk-fld"><span>Тейк-профит</span><input id="tk-oco-trg" type="number" step="${step}" value="${T.ocoTrigger != null ? (+T.ocoTrigger).toFixed(dec) : ''}" placeholder="${defTrigger('take')}"></label>
        <p class="tk-note">${br.caps.oco ? 'Брокер снимет вторую заявку сам' : 'Вторую заявку снимет приложение, пока оно запущено'}</p>` : ''}` : ''}
      <div class="tk-sum" id="tk-sum"></div>
      <div class="tk-err" id="tk-err" hidden></div>
      <button class="tk-go ${T.side}" id="tk-go"></button>
      ${missing.length ? `<p class="tk-note">${br.name} не поддерживает: ${missing.join(', ')}</p>` : ''}
    </div>`;
  }
  function defTrigger(type) {
    const q = B.quote(D.sel); const T = D.t; const up = (type === 'take') === (T.side === 'sell');
    return B.px(D.sel, up ? q.ask * 1.02 : q.bid * 0.98);
  }
  function onTicketInput(e) {
    if (!D.ticket) return;
    const T = D.t; const id = e.target.id;
    if (id === 'tk-acc') { if (e.type === 'change') { T.acc = e.target.value; renderTicket(); } return; }
    if (id === 'tk-type') { if (e.type === 'change') { T.type = e.target.value; if ((T.type === 'limit' || T.type === 'iceberg') && !T.touched) { const q = B.quote(D.sel); T.price = T.side === 'buy' ? q.bid : q.ask; } renderTicket(); } return; }
    if (id === 'tk-oco') { if (e.type === 'change') { T.oco = e.target.checked; renderTicket(); } return; }
    if (id === 'tk-lots') T.lots = Math.max(0, Math.floor(+e.target.value || 0));
    if (id === 'tk-price') { T.price = +e.target.value; T.touched = true; }
    if (id === 'tk-trg') T.trigger = +e.target.value;
    if (id === 'tk-vis') T.visible = Math.floor(+e.target.value || 0);
    if (id === 'tk-oco-trg') T.ocoTrigger = +e.target.value;
    updateTicket();
  }
  function onTicketClick(e) {
    if (e.target.closest('[data-gokeys]')) { if (D.ticket) D.ticket.close(); D.go('accounts'); return; }
    const T = D.t; const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tside) { T.side = b.dataset.tside; const q = B.quote(D.sel); if (!T.touched) T.price = T.side === 'buy' ? q.bid : q.ask; T.trigger = null; if (T.side === 'sell') T.acc = pickAcc(D.sel, 'sell') || T.acc; renderTicket(); return; }
    if (b.dataset.lots) { T.lots = Math.max(1, T.lots + +b.dataset.lots); $('#tk-lots').value = T.lots; updateTicket(); return; }
    if (b.dataset.q) { T.lots = Math.max(1, maxLots()); $('#tk-lots').value = T.lots; updateTicket(); return; }
    if (b.id === 'tk-go') submit();
  }
  function maxLots() {
    const T = D.t, t = D.sel, ins = B.IMAP[t], q = B.quote(t);
    if (!T.acc) return 0;
    if (ins.type !== 'fut' && T.side === 'sell') { const p = B.position(T.acc, t); return p ? Math.floor(p.qty / ins.lot) : 0; }
    const px = T.type === 'limit' || T.type === 'iceberg' ? (T.price || q.ask) : q.ask;
    const per = ins.type === 'fut' ? px * ins.mult * ins.go + 2 : px * ins.lot * (1 + B.BMAP[B.ACCMAP[T.acc].broker].fee);
    return Math.max(0, Math.floor(B.freeCash(T.acc) / per));
  }
  function updateTicket() {
    const T = D.t, t = D.sel, ins = B.IMAP[t];
    const top = $('#tk-top');
    if (top) { const S = B.S(), px = S.prices[t], prev = B.prevClose(t); top.innerHTML = `<i class="pdot big" style="background:${ins.color}"></i><span><b>${B.esc(ins.n)}</b><small>${t} · ${B.CLASS[ins.type].name}</small></span><span class="tk-px"><b class="num">${B.px(t, px)}</b><small class="num ${B.cls(px - prev)}">${B.pct((px - prev) / prev)}</small></span>`; }
    if (!$('#tk-sum') || !T.acc) return;
    const q = B.quote(t);
    const px = T.type === 'market' ? (T.side === 'buy' ? q.ask : q.bid) : (T.type === 'limit' || T.type === 'iceberg') ? (T.price || 0) : (T.trigger || (T.side === 'buy' ? q.ask : q.bid));
    const qty = T.lots * ins.lot;
    const pos = B.position(T.acc, t);
    $('#tk-info').innerHTML = `Доступно <b class="num">${B.rub(B.freeCash(T.acc), 0)}</b> · в портфеле <b class="num">${pos ? B.num(pos.qty) : 0}</b>`;
    $('#tk-max').textContent = 'макс. ' + B.num(maxLots());
    const total = ins.type === 'fut' ? B.goRequired(t, qty, px) : qty * px;
    const fee = ins.type === 'fut' ? qty * 2 : B.brokerFee(T.acc, t, qty, px);
    $('#tk-sum').innerHTML = `<div><span>${ins.type === 'fut' ? 'Гарантийное обеспечение' : T.type === 'market' ? 'Сумма ≈' : 'Сумма'}</span><b class="num">${B.rub(total, 0)}</b></div><div class="muted"><span>Комиссия</span><span class="num">${B.rub(fee, 2)}</span></div>`;
    $('#tk-go').textContent = (T.side === 'buy' ? 'Купить ' : 'Продать ') + B.num(qty) + ' ' + (ins.type === 'fut' ? 'контр.' : 'шт.') + (T.type === 'market' ? ' по рынку' : '');
  }

  function submit(confirmed) {
    const T = D.t, t = D.sel, ins = B.IMAP[t];
    const o = { acc: T.acc, t, side: T.side, type: T.type, lots: T.lots, price: T.price, trigger: T.trigger || null, visible: T.visible };
    if ((T.type === 'stop' || T.type === 'take') && !o.trigger) o.trigger = parseRu(defTrigger(T.type));
    if (T.type === 'stop' && T.oco) o.oco = { type: 'take', trigger: T.ocoTrigger || parseRu(defTrigger('take')) };
    const err = B.validate(o);
    const box = $('#tk-err');
    if (err) { box.hidden = false; box.textContent = err; return; }
    box.hidden = true;
    const q = B.quote(t); const px = T.type === 'market' ? (T.side === 'buy' ? q.ask : q.bid) : (o.price || o.trigger);
    const amount = T.lots * ins.lot * px * (ins.type === 'fut' ? ins.mult : 1);
    if (!confirmed && amount > 100000) { confirmBox(o, amount); return; }
    const r = B.place(o);
    if (!r.ok) { box.hidden = false; box.textContent = r.err; return; }
    if (r.order.status === 'rejected') { box.hidden = false; box.textContent = r.order.reason; return; }
    const lbl = `${T.side === 'buy' ? 'Покупка' : 'Продажа'} ${B.num(T.lots * ins.lot)} ${ins.type === 'fut' ? 'контр.' : 'шт.'} ${t}`;
    if (T.type !== 'market') B.toast('#d-toasts', `<b>Заявка выставлена</b><br>${TYPE_NAME[T.type]} · ${lbl}${o.oco ? ' + тейк-профит' : ''}`, 'info');
    T.trigger = null; T.ocoTrigger = null; T.touched = false;
    if (D.ticket) D.ticket.close();
    updateTerminal();
    B.emitUI && B.emitUI('order:placed');
  }
  function parseRu(s) { return +String(s).replace(/\s| | /g, '').replace(',', '.'); }
  function confirmBox(o, amount) {
    const ins = B.IMAP[o.t];
    const m = B.modal(`<h3>Подтвердите заявку</h3>
      <div class="cf ${o.side}"><b>${o.side === 'buy' ? 'Купить' : 'Продать'}</b> ${B.num(o.lots * ins.lot)} ${ins.type === 'fut' ? 'контр.' : 'шт.'} ${B.esc(ins.n)}</div>
      <div class="cf-grid"><span>Тип</span><b>${TYPE_NAME[o.type]}</b><span>Счёт</span><b>${B.accLabel(o.acc)}</b><span>${ins.type === 'fut' ? 'Объём' : 'Сумма'}</span><b class="num">${B.rub(amount, 0)}</b></div>
      <p class="muted small">Заявки дороже 100 000 ₽ всегда подтверждаются. Порог меняется в настройках.</p>
      <div class="m-actions"><button class="btn-d ghost" id="cf-no">Отмена</button><button class="btn-d ${o.side}" id="cf-yes">Подтвердить</button></div>`, { host: $('.appwin'), cls: 'desk-modal' });
    m.el.querySelector('#cf-no').onclick = m.close;
    m.el.querySelector('#cf-yes').onclick = () => { m.close(); submit(true); };
  }

  function updateTerminal() {
    const S = B.S(); if (!$('#d-term')) return;
    const t = D.sel, ins = B.IMAP[t];
    updateHead();
    $$('#d-term [data-ma]').forEach(b => { b.classList.toggle('on', !!D.ma[b.dataset.ma]); b.setAttribute('aria-pressed', !!D.ma[b.dataset.ma]); });
    // график
    const lines = [];
    S.orders.filter(o => o.t === t && (o.status === 'active' || o.status === 'pending')).forEach(o => {
      const lv = o.type === 'limit' || o.type === 'iceberg' ? o.price : o.trigger;
      lines.push({ price: lv, color: o.type === 'stop' ? '#FF5A6E' : o.type === 'take' ? '#50F08C' : '#A24DF0', text: `${TYPE_NAME[o.type]} · ${o.lots} л. · ${B.px(t, lv)}`, dash: true });
    });
    let qtySum = 0, costSum = 0;
    B.ACCOUNTS.forEach(a => { const p = S.acc[a.id].pos[t]; if (p) { qtySum += p.qty; costSum += p.cost; } });
    if (qtySum) { const avg = costSum / qtySum / (ins.type === 'fut' ? ins.mult : 1); lines.push({ price: avg, color: '#F7B84B', text: `Ср. цена ${B.px(t, avg)}` }); }
    D.chart.set({
      candles: S.hist[t].concat([S.cur[t]]), count: 90, fmt: v => B.px(t, v), label: i => B.dateShort(i), lines,
      ma: [D.ma[20] && { n: 20, color: '#A24DF0' }, D.ma[50] && { n: 50, color: '#5EA8FF' }].filter(Boolean),
      onPick: p => D.openTicket({ price: Math.round(p / ins.step) * ins.step }),
    });
    // боковая панель
    $$('#d-wl [data-wl]').forEach(b => b.classList.toggle('on', b.dataset.wl === D.wlTab));
    const wl = $('#d-wl-list'); if (wl) wl.innerHTML = listHTML();
    if (D.side === 'info') { const ib = $('#d-info'); if (ib) ib.innerHTML = infoHTML(); }
    else if (D.side === 'book') {
      const bk = B.book(t, 9); const maxL = Math.max(...bk.asks.map(x => x.lots), ...bk.bids.map(x => x.lots));
      const row = (x, side) => `<button class="bk ${side}" data-px="${x.price}" data-bside="${side}" title="Лимитная заявка по ${B.px(t, x.price)}"><span class="bk-bar" style="width:${(x.lots / maxL * 100).toFixed(1)}%"></span><span class="num">${B.px(t, x.price)}</span><span class="num">${x.mine ? '<em>●</em> ' : ''}${B.num(x.lots)}</span></button>`;
      $('#d-book-body').innerHTML = bk.asks.slice().reverse().map(x => row(x, 'ask')).join('') + `<div class="bk-mid"><span class="num">${B.px(t, S.prices[t])}</span><small>спред ${B.px(t, bk.spread)}</small></div>` + bk.bids.map(x => row(x, 'bid')).join('');
      $('#d-book-foot').textContent = 'Нажмите на цену – откроется лимитная заявка';
    } else if (D.side === 'news') {
      const nb = $('#d-snews'); const top = (B.newsOf(t)[0] || null), sig = t + ':' + (top ? B.newsKey(top) : '');
      if (nb && sig !== D.newsTop) { D.newsTop = sig; nb.innerHTML = newsList(t); }
    }
    updateTicket();
  }

  function ordTable(compact, liveOnly) {
    const S = B.S();
    let list = S.orders.filter(o => !liveOnly || o.status === 'active' || o.status === 'pending').slice(0, compact ? 30 : 200);
    if (!list.length) return `<p class="empty">${liveOnly ? 'Активных заявок нет.' : 'Заявок пока нет.'} Выставить заявку можно в терминале кнопками «Купить» и «Продать».</p>`;
    return `<div class="dcards">${list.map(o => {
      const ins = B.IMAP[o.t];
      const lv = o.type === 'market' ? (o.fillPrice != null ? B.px(o.t, o.fillPrice) : 'по рынку') : B.px(o.t, o.type === 'limit' || o.type === 'iceberg' ? o.price : o.trigger);
      const live = o.status === 'active' || o.status === 'pending';
      const chips = (o.group ? '<span class="chip">связка' + (o.appManaged ? ' · ведёт приложение' : '') + '</span>' : '') + (o.type === 'iceberg' ? '<span class="chip">видно ' + o.visible + '</span>' : '') + (o.src === 'rebalance' ? '<span class="chip">ребаланс</span>' : '');
      return `<article class="dcard ord st-${o.status}">
        <button class="dc-name" data-pick="${o.t}"><i class="pdot" style="background:${ins.color}"></i><span><b>${o.t} <em class="${o.side === 'buy' ? 'up' : 'down'}">${o.side === 'buy' ? 'покупка' : 'продажа'}</em></b><small>${B.accLabel(o.acc)}</small></span></button>
        <div class="dc-nums"><span><small>${TYPE_NAME[o.type]}</small><b class="num">${o.lots} лот. · ${lv}</b></span><span class="r"><small class="num">${B.dateShort(o.created.day)} ${B.timeOf(o.created.tick)}</small><span class="ost ${o.status}">${STATUS[o.status]}</span></span></div>
        ${chips ? `<div class="dc-chips">${chips}</div>` : ''}${o.reason ? `<p class="dc-note">${B.esc(o.reason)}</p>` : ''}
        ${live ? `<div class="dc-foot"><span></span><button class="mini" data-cancel="${o.id}">Снять</button></div>` : ''}
      </article>`;
    }).join('')}</div>`;
  }
  // все сделки: из приложения, по плану ребалансировки и загруженные из истории брокера при подключении
  const SRC = { manual: 'из приложения', rebalance: 'ребалансировка', broker: 'история брокера', import: 'импорт при подключении' };
  D.trdShow = 40;
  function tradesTable() {
    const S = B.S(); const all = S.ops.filter(o => o.k === 'trade' && !o.j).reverse();
    const list = all.slice(0, D.trdShow);
    if (!list.length) return '<p class="empty">Сделок пока нет</p>';
    return `<div class="dcards">${list.map(o => {
      const ins = B.IMAP[o.t];
      return `<article class="dcard trd">
        <button class="dc-name" data-pick="${o.t}"><i class="pdot" style="background:${ins.color}"></i><span><b>${o.t} <em class="${o.qty > 0 ? 'up' : 'down'}">${o.qty > 0 ? 'покупка' : 'продажа'}</em></b><small>${B.accLabel(o.acc)}</small></span></button>
        <div class="dc-nums"><span><small>Исполнено</small><b class="num">${B.num(Math.abs(o.qty))} × ${B.px(o.t, o.price)}</b></span><span class="r"><small class="num">${B.dateShort(o.day)} ${B.timeOf(o.tick)}</small><b class="num muted">комиссия ${B.rub(o.fee, 2)}</b></span></div>
        <div class="dc-foot"><span class="chip">${SRC[o.src] || o.src}</span>${S.sync[o.acc] ? '<span class="ok-t">На сайте</span>' : '<span class="muted">Синхронизация выключена</span>'}</div>
      </article>`;
    }).join('')}</div>${all.length > list.length ? `<div class="more-row"><button class="btn-t" data-more>Показать ещё (${all.length - list.length})</button></div>` : ''}`;
  }
  function newsList(t) {
    const ins = B.IMAP[t], list = B.newsOf(t).slice(0, 15);
    const head = `<div class="sn-h">Новости: ${B.esc(ins.n)}</div>`;
    if (!list.length) return head + `<p class="muted sn-empty">${ins.type === 'stock' ? 'По этой компании пока нет новостей. Новые появятся здесь, как только выйдут.' : 'По этой бумаге новости не выходят. Здесь показываются новости компаний-эмитентов акций.'}</p>`;
    return head + `<ul class="news">${list.map(n => `<li><span class="fd">${B.dateShort(n.day)} ${B.timeOf(n.tick)}</span><button class="news-open" data-nk="${B.newsKey(n)}">${B.esc(n.text)}</button></li>`).join('')}</ul>`;
  }

  /* ================= ЗАЯВКИ И СДЕЛКИ ================= */
  D.dealsTab = 'live';
  function renderDeals(v) {
    v.innerHTML = `<div class="dpage deals"><div class="dpage-h"><h2>Заявки и сделки</h2><p class="muted">Связанные заявки, которые брокер не поддерживает, ведёт приложение.</p></div>
      <div class="pf-accs" id="dl-tabs"></div>
      <section class="pane"><div class="bt-body tall" id="dl-body"></div></section></div>`;
    const root = v.querySelector('.dpage');
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-dl]'); if (b) { D.dealsTab = b.dataset.dl; D.trdShow = 40; updateDeals(); return; }
      if (e.target.closest('[data-more]')) { D.trdShow += 40; updateDeals(); return; }
      onTableClick(e);
    });
  }
  function updateDeals() {
    const body = $('#dl-body'); if (!body) return;
    const S = B.S(); const live = S.orders.filter(o => o.status === 'active' || o.status === 'pending');
    const nTr = S.ops.filter(o => o.k === 'trade' && !o.j).length;
    $('#dl-tabs').innerHTML = [['live', 'Активные', live.length], ['all', 'Все заявки', S.orders.length], ['trd', 'История сделок', nTr]].map(([k, n, c]) => `<button data-dl="${k}" class="${D.dealsTab === k ? 'on' : ''}">${n}${c ? ` <small>${c}</small>` : ''}</button>`).join('');
    body.innerHTML = D.dealsTab === 'trd' ? tradesTable() : D.dealsTab === 'live' ? ordTable(false, true) : ordTable(false);
  }

  /* ================= ПОРТФЕЛЬ ================= */
  D.pfAcc = 'all'; D.pfCls = 'all'; D.pfSort = 'value';
  const PF_SORT = { value: ['По стоимости', (x, y) => y.value - x.value], pl: ['По доходности', (x, y) => y.plPct - x.plPct], day: ['За день', (x, y) => y.dpct - x.dpct], name: ['По названию', (x, y) => x.ins.n.localeCompare(y.ins.n, 'ru')] };
  function renderOrders(v) {
    const S = B.S();
    v.innerHTML = `<div class="dpage pf"><div class="dpage-h"><h2>Портфель</h2></div>
      <section class="pane pf-sum" id="pf-sum"></section>
      <div class="pf-accs" id="pf-accs"><button data-pfacc="all">Все счета</button>${B.ACCOUNTS.map(a => `<button data-pfacc="${a.id}"><i class="bdot" style="background:${B.BMAP[a.broker].color}"></i>${B.accLabel(a.id)}</button>`).join('')}</div>
      <section class="pane"><div class="pane-h"><span>Позиции</span><span id="pf-npos"></span></div>
        <div class="pf-tools"><div class="pf-cls" id="pf-cls"></div>
          <label class="pf-sort"><span>Сортировка</span><select id="pf-sort">${Object.entries(PF_SORT).map(([k, v]) => `<option value="${k}" ${D.pfSort === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></label></div>
        <div id="pf-pos"></div></section>
</div>`;
    const root = v.querySelector('.dpage');
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-pfacc]'); if (b) { D.pfAcc = b.dataset.pfacc; updateOrdersPage(); return; }
      const c = e.target.closest('[data-pfcls]'); if (c) { D.pfCls = c.dataset.pfcls; updateOrdersPage(); return; }
      onTableClick(e);
    });
    root.querySelector('#pf-sort').onchange = e => { D.pfSort = e.target.value; updateOrdersPage(); };
  }
  function updateOrdersPage() {
    if (!$('#pf-pos')) return;
    if (!B.ACCMAP[D.pfAcc]) D.pfAcc = 'all';
    $$('#pf-accs [data-pfacc]').forEach(b => b.classList.toggle('on', b.dataset.pfacc === D.pfAcc));
    const accs = new Set(D.pfAcc === 'all' ? B.ACCOUNTS.map(x => x.id) : [D.pfAcc]);
    const snap = B.snapshot({ accs, cls: new Set(B.CLS_KEYS) });
    const all = snap.value - snap.dep, prevVal = snap.value - snap.dayChg;
    $('#pf-sum').innerHTML = `<div class="pf-total"><small>Стоимость портфеля</small><b class="num">${B.rub(snap.value, 2)}</b></div>
      <div class="pf-k"><small>За сегодня</small><b class="num ${B.cls(snap.dayChg)}">${B.srub(snap.dayChg, 0)} <span>${B.pct(prevVal ? snap.dayChg / prevVal : 0)}</span></b></div>
      <div class="pf-k"><small>За всё время</small><b class="num ${B.cls(all)}">${B.srub(all, 0)} <span>${B.pct(snap.dep ? all / snap.dep : 0)}</span></b></div>
      <div class="pf-k"><small>Свободные деньги</small><b class="num">${B.rub(snap.cls.cash, 0)}</b></div>
      ${snap.cls.fut ? `<div class="pf-k"><small>Срочный рынок, ГО</small><b class="num">${B.rub(snap.cls.fut, 0)} <span class="${B.cls(snap.vm)}">вар. маржа ${B.srub(snap.vm, 0)}</span></b></div>` : ''}`;
    // по одной строке на бумагу и счёт, группы по классам – как в приложениях брокеров
    const kinds = ['stock', 'bond', 'fund', 'fut'];
    const cnt = k => snap.positions.filter(p => k === 'all' || p.ins.type === k).length;
    if (D.pfCls !== 'all' && !cnt(D.pfCls)) D.pfCls = 'all';
    $('#pf-cls').innerHTML = ['all', ...kinds].filter(k => k === 'all' || cnt(k)).map(k => `<button data-pfcls="${k}" class="${D.pfCls === k ? 'on' : ''}">${k === 'all' ? 'Все бумаги' : B.CLASS[k].name}<em>${cnt(k)}</em></button>`).join('');
    const groups = kinds.filter(k => D.pfCls === 'all' || D.pfCls === k).map(k => ({ k, items: snap.positions.filter(p => p.ins.type === k).sort(PF_SORT[D.pfSort][1]) })).filter(g => g.items.length);
    $('#pf-npos').textContent = snap.positions.length ? snap.positions.length + ' поз.' : '';
    $('#pf-pos').innerHTML = groups.length ? groups.map(g => `<div class="pf-group"><div class="pf-gh"><span>${B.CLASS[g.k].name}</span><b class="num">${B.rub(g.items.reduce((s, x) => s + x.value, 0), 0)}</b></div>
      ${g.items.map(p => {
        const fut = p.ins.type === 'fut';
        return `<div class="pf-row">
          <button class="pf-name" data-pick="${p.t}"><i class="pdot" style="background:${p.ins.color}"></i><span><b>${B.esc(p.ins.n)}</b><small>${p.t}${D.pfAcc === 'all' ? ' · ' + B.accLabel(p.acc) : ''}</small></span></button>
          <span class="pf-q"><b class="num">${fut ? (p.qty > 0 ? 'лонг ' : 'шорт ') + Math.abs(p.qty) + ' контр.' : B.num(p.qty) + ' шт.'}</b><small class="num">средняя ${B.px(p.t, p.avg)}</small></span>
          <span class="pf-p"><b class="num">${B.px(p.t, p.price)}</b><small class="num ${B.cls(p.dpct)}">${B.pct(p.dpct)} за день</small></span>
          <span class="pf-v"><b class="num">${fut ? 'ГО ' + B.rub(p.go, 0) : B.rub(p.value, 0)}</b><small class="num ${B.cls(p.pl)}">${B.srub(p.pl, 0)} · ${B.pct(p.plPct)}</small></span>
          <button class="mini" data-close="${p.acc}|${p.t}" aria-label="Закрыть позицию ${p.t}">Закрыть</button>
        </div>`;
      }).join('')}</div>`).join('') : '<p class="empty">На этом счёте нет позиций. Купить бумагу можно в терминале.</p>';
  }

  /* ================= РЕБАЛАНСИРОВКА ================= */
  D.receivePlan = function (plan, local) {
    D.plan = { rows: plan.rows.map(r => Object.assign({ on: true, status: 'wait' }, r)), devBefore: plan.devBefore, devAfter: plan.devAfter, at: { day: B.S().day, tick: B.S().tick }, local: !!local };
    D.planState = 'ready';
    if (local) { updateReb(); return; }
    B.toast('#d-toasts', '<b>Получен план ребалансировки</b><br>' + plan.rows.length + ' сделок · проверьте и подтвердите', 'info', 5000);
    D.go('rebalance');
  };
  function renderReb(v) {
    v.innerHTML = `<div class="dpage" id="d-reb"></div>`;
    $('#d-reb').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'rb-web') { B.App.setMode('web'); B.Web.go('rebalance'); }
      if (b.id === 'rb-run') runPlan();
      const W = B.Web;
      if (b.dataset.rbstep) { const k = b.dataset.k; W.target[k] = Math.max(0, Math.min(100, W.target[k] + +b.dataset.rbstep)); W.plan = null; updateReb(true); }
      if (b.dataset.rbpreset === 'strat') { W.target = W.reb.defaultTarget(); W.plan = null; updateReb(true); }
      if (b.dataset.rbpreset === 'cur') { const c = W.reb.currentShares(); W.reb.RK.forEach(k => W.target[k] = Math.round(c[k])); const sm = W.reb.RK.reduce((a, k) => a + W.target[k], 0); W.target.cash = Math.max(0, W.target.cash + 100 - sm); W.plan = null; updateReb(true); }
      if (b.dataset.rbmode) { W.rebMode = b.dataset.rbmode; updateReb(true); }
      if (b.id === 'rb-calc') { const plan = B.rebalancePlan(W.target, W.rebMode, W.reb.rebAccs()); if (!plan.rows.length) { B.toast('#d-toasts', 'Портфель уже соответствует цели – сделки не нужны', 'info'); return; } D.receivePlan(plan, true); }
      if (b.id === 'rb-clear') { D.plan = null; D.planState = null; updateReb(true); }
    });
    $('#d-reb').addEventListener('input', e => { const i = e.target.closest('[data-rbtg]'); if (!i) return; B.Web.target[i.dataset.rbtg] = Math.max(0, Math.min(100, Math.round(+i.value || 0))); B.Web.plan = null; updateReb(); });
    $('#d-reb').addEventListener('change', e => { const c = e.target.closest('[data-row]'); if (c && D.plan) { D.plan.rows[+c.dataset.row].on = c.checked; updateReb(); } });
  }
  function calcView(box, full) {
    const W = B.Web, R = W.reb; if (!W.target) W.target = R.defaultTarget();
    const cur = R.currentShares(), sum = R.RK.reduce((a, k) => a + W.target[k], 0);
    if (full || box.dataset.view !== 'calc') {
      box.dataset.view = 'calc';
      box.innerHTML = `<div class="dpage-h"><h2>Ребалансировка</h2><p class="muted">Задайте целевую структуру и рассчитайте план прямо здесь – или получите его с сайта. Заявки отправляются только после вашего подтверждения.</p></div>
        <section class="pane"><div class="pane-h"><span>Целевая структура</span><div class="seg tiny"><button data-rbpreset="strat">По профилю</button><button data-rbpreset="cur">Текущие доли</button></div></div>
          <div class="rbc">${R.RK.map(k => `<div class="rbc-row"><span class="rbc-name"><i class="bdot" style="background:${B.CLASS[k].color}"></i>${B.CLASS[k].name}</span><span class="rbc-cur num" data-rbcur="${k}"></span>
            <span class="stepper"><button data-rbstep="-5" data-k="${k}" aria-label="Уменьшить">−</button><input data-rbtg="${k}" type="number" min="0" max="100" value="${W.target[k]}" aria-label="Цель ${B.CLASS[k].name}"><button data-rbstep="5" data-k="${k}" aria-label="Увеличить">+</button></span></div>`).join('')}</div>
          <div class="rbc-foot"><span id="rbc-sum"></span><div class="seg tiny"><button data-rbmode="buy" class="${W.rebMode === 'buy' ? 'on' : ''}">Только докупать</button><button data-rbmode="full" class="${W.rebMode === 'full' ? 'on' : ''}">Покупать и продавать</button></div></div>
        </section>
        <div class="rb-foot"><span class="muted">Срочный счёт не участвует. Учитываются счета с включённой синхронизацией.</span><button class="btn-d" id="rb-calc">Рассчитать план</button></div>`;
    }
    R.RK.forEach(k => { const c = box.querySelector(`[data-rbcur="${k}"]`); if (c) c.textContent = 'сейчас ' + B.num(cur[k], 1) + ' %'; });
    const sEl = $('#rbc-sum'); if (sEl) { sEl.textContent = sum === 100 ? 'Сумма долей: 100 %' : 'Сумма долей должна быть 100 %, сейчас ' + sum + ' %'; sEl.className = sum === 100 ? 'ok-t' : 'down'; }
    const cb = $('#rb-calc'); if (cb) cb.disabled = sum !== 100;
  }
  function updateReb(full) {
    const box = $('#d-reb'); if (!box) return;
    const P = D.plan;
    if (!P) { calcView(box, full); return; }
    box.dataset.view = 'plan';
    const rows = P.rows;
    const on = rows.filter(r => r.on);
    const SL = { wait: 'Ожидает', run: 'Отправляется…', done: 'Исполнена', fail: 'Отклонена', skip: 'Пропущена' };
    box.innerHTML = `<div class="dpage-h"><h2>План ребалансировки</h2><p class="muted">${P.local ? 'Рассчитан в приложении' : 'Получен с сайта'} ${B.dateShort(P.at.day)} в ${B.timeOf(P.at.tick)}. Отклонение от цели: ${B.num(P.devBefore, 1)} → ${B.num(P.devAfter, 1)} п.п. Сначала исполняются продажи, чтобы освободить деньги.</p></div>
      <section class="pane"><table class="dt"><thead><tr><th></th><th>Действие</th><th>Инструмент</th><th>Счёт</th><th class="r">Лоты</th><th class="r">Сумма</th><th>Статус</th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td><input type="checkbox" data-row="${i}" ${r.on ? 'checked' : ''} ${D.planState !== 'ready' ? 'disabled' : ''} aria-label="Включить сделку"></td><td><span class="${r.side === 'buy' ? 'up' : 'down'}">${r.side === 'buy' ? 'Купить' : 'Продать'}</span></td><td>${B.esc(B.IMAP[r.t].n)} <small class="muted">${r.t}</small></td><td>${B.accLabel(r.acc)}</td><td class="r num">${r.lots}</td><td class="r num">${B.rub(r.amount, 0)}</td><td><span class="ost ${r.status === 'done' ? 'filled' : r.status === 'fail' ? 'rejected' : r.status === 'run' ? 'active' : 'pending'}">${SL[r.status]}</span>${r.err ? `<small class="muted ord-reason">${B.esc(r.err)}</small>` : ''}</td></tr>`).join('')}
      </tbody></table></section>
      <div class="rb-foot">${D.planState === 'ready' ? `<span class="muted">Будет отправлено заявок: ${on.length}. Тип – рыночные.</span><button class="btn-d ghost" id="rb-clear">Отклонить план</button><button class="btn-d" id="rb-run" ${on.length ? '' : 'disabled'}>Исполнить ${on.length} заявок</button>`
        : D.planState === 'run' ? `<span class="muted">Исполнение… не закрывайте приложение</span><div class="prog"><i style="width:${rows.filter(r => r.status === 'done' || r.status === 'fail' || r.status === 'skip').length / rows.length * 100}%"></i></div>`
          : `<span class="ok-t">Готово: исполнено ${rows.filter(r => r.status === 'done').length} из ${rows.filter(r => r.on).length}. Результат отправлен на сайт.</span><button class="btn-d ghost" id="rb-clear">Закрыть план</button><button class="btn-d" id="rb-web">Посмотреть портфель на сайте</button>`}</div>`;
    if (D.planState === 'done') { const bw = $('#rb-web'); if (bw) bw.onclick = () => { B.App.setMode('web'); B.Web.go('portfolio'); }; }
  }
  function runPlan() {
    const P = D.plan; if (!P || D.planState !== 'ready') return;
    D.planState = 'run';
    const queue = P.rows.map((r, i) => i).filter(i => P.rows[i].on).sort((a, b) => (P.rows[a].side === 'sell' ? 0 : 1) - (P.rows[b].side === 'sell' ? 0 : 1));
    P.rows.forEach(r => { if (!r.on) r.status = 'skip'; });
    const S0 = B.S();
    const next = () => {
      if (B.S() !== S0 || D.plan !== P) return;
      if (!queue.length) { D.planState = 'done'; updateReb(); B.toast('#d-toasts', '<b>Ребалансировка завершена</b><br>Портфель на сайте обновлён', 'good', 5000); B.emitUI && B.emitUI('reb:done'); return; }
      const r = P.rows[queue.shift()]; r.status = 'run'; updateReb();
      setTimeout(() => {
        if (B.S() !== S0 || D.plan !== P) return;
        const res = B.place({ acc: r.acc, t: r.t, side: r.side, type: 'market', lots: r.lots, src: 'rebalance' });
        if (!res.ok) { r.status = 'fail'; r.err = res.err; }
        else if (res.order.status === 'rejected') { r.status = 'fail'; r.err = res.order.reason; }
        else r.status = 'done';
        updateReb(); next();
      }, B.reduced ? 120 : 420);
    };
    next();
  }

  /* ================= СЧЕТА И КЛЮЧИ ================= */
  function renderAccounts(v) {
    v.innerHTML = `<div class="dpage" id="d-acc"></div>`;
    const box = $('#d-acc');
    box.addEventListener('change', e => {
      const c = e.target.closest('[data-tg]'); if (!c) return;
      const [kind, id] = c.dataset.tg.split('|');
      if (kind === 'sync') { B.setSync(id, c.checked); B.toast('#d-toasts', c.checked ? 'Синхронизация включена: данные счёта снова на сайте' : 'Синхронизация выключена: сайт больше не получает данные этого счёта', c.checked ? 'good' : 'warn'); }
      if (kind === 'trade') B.setTrade(id, c.checked);
      updateAccounts();
    });
    box.addEventListener('toggle', e => { if (e.target.matches('details.mx')) D.mxOpen = e.target.open; }, true);
    box.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'acc-connect') D.connectWizard();
      if (b.dataset.tkey) D.tradeKeyModal(b.dataset.tkey);
      if (b.dataset.key) B.toast('#d-toasts', 'Ключ показан только при вводе. После сохранения он хранится зашифрованным и не выводится целиком.', 'info');
    });
  }
  const canConnect = () => B.unlinked().length > 0 || !B.isExtraConnected();
  function updateAccounts() {
    const box = $('#d-acc'); if (!box) return;
    const S = B.S();
    const yn = v => v ? '<span class="ok-t">✓</span>' : '<span class="muted">–</span>';
    box.innerHTML = `<div class="dpage-h"><h2>Счета и ключи</h2><p class="muted">Ключи брокеров хранятся только на этом компьютере. На сайт уходят позиции и деньги, ключи – никогда.</p></div>
      <div class="key-strip"><span class="lock">${'<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 11V8a4 4 0 1 1 8 0v3M6 11h12v9H6z" fill="none" stroke="currentColor" stroke-width="2"/></svg>'}</span><span><b>Ключи зашифрованы на этом ПК</b> <span class="muted">· AES-256, мастер-ключ в хранилище ОС</span></span><button class="btn-d" id="acc-connect" ${canConnect() ? '' : 'disabled'}>${canConnect() ? '+ Подключить брокера' : 'Все брокеры подключены'}</button></div>
      <div class="brk-grid">${B.BROKERS.map(br => {
        const accs = B.ACCOUNTS.filter(a => a.broker === br.id); const ro = S.rights[br.id] !== 'trade';
        return `<section class="pane brk" data-brk="${br.id}"><div class="brk-h"><i class="bdot" style="background:${br.color}"></i><b>${br.name}</b><span class="ok-pill">Подключено · ${br.ping} мс</span></div>
          <div class="brk-key"><span>Ключ</span><code>${accs[0].key}</code></div>
          <div class="brk-rights ${ro ? 'ro' : 'rw'}"><span>${ro ? 'Права ключа: <b>только чтение</b>' : 'Права ключа: <b>чтение и торговля</b>'}</span>${ro ? `<button class="btn-d sm" data-tkey="${br.id}">Выдать ключ на торговлю</button>` : ''}</div>
          ${accs.map(a => { const v = B.snapshot({ accs: new Set([a.id]), cls: new Set(B.CLS_KEYS) }).value; return `<div class="brk-acc"><span><b>${a.name}</b><small>${a.num} · ${B.rub(v, 0)}</small></span>
            <label class="sw ${ro ? 'off' : ''}" ${ro ? 'title="Ключ «только чтение» не может выставлять заявки"' : ''}><input type="checkbox" data-tg="trade|${a.id}" ${S.trade[a.id] ? 'checked' : ''} ${ro ? 'disabled' : ''}><span>Торговля</span></label>
            <label class="sw"><input type="checkbox" data-tg="sync|${a.id}" ${S.sync[a.id] ? 'checked' : ''}><span>Синхронизация с сайтом</span></label></div>`; }).join('')}
        </section>`;
      }).join('')}</div>
      ${B.BROKERS.length ? `<details class="pane mx" ${D.mxOpen ? 'open' : ''}><summary class="pane-h"><span>Возможности брокеров</span><span class="muted small">какие заявки поддерживает каждый брокер</span></summary>
        <div class="table-scroll"><table class="dt matrix"><thead><tr><th></th>${B.BROKERS.map(b => `<th class="c">${b.short}</th>`).join('')}</tr></thead><tbody>
        ${[['Стоп-лосс', 'stop'], ['Тейк-профит', 'take'], ['Связанные заявки у брокера', 'oco'], ['Айсберг-заявки', 'iceberg'], ['Срочный рынок', 'fut'], ['Вечерняя сессия', 'evening']].map(([n, k]) => `<tr><td>${n}</td>${B.BROKERS.map(b => `<td class="c">${yn(b.caps[k])}</td>`).join('')}</tr>`).join('')}
        <tr><td>Комиссия, акции</td>${B.BROKERS.map(b => `<td class="c num">${b.feeText}</td>`).join('')}</tr></tbody></table></div></details>` : ''}`;
  }

  /* Подключение брокера: брокер → ключ и его права → проверка. Ключ по умолчанию «только чтение». */
  const DEMO_KEYS = { sev: 'sk_live_demo_4e1b7c09d2a91F', vos: 't.demo_9c27e4b1f8a0Qm7x', yug: 'yg-demo-51d0a7e2b93c0d', zap: 'zp_demo_7f3c91a0be52d4e881kd' };
  const CAPS_TEXT = br => [br.caps.stop && 'стоп', br.caps.take && 'тейк', br.caps.oco && 'связанные', br.caps.iceberg && 'айсберг', br.caps.fut && 'срочный рынок'].filter(Boolean).join(', ') || 'только рыночные и лимитные';
  D.connectWizard = function (pre, opts) {
    opts = opts || {};
    if (!canConnect()) { B.toast('#d-toasts', 'Все демо-брокеры уже подключены', 'info'); return; }
    const S = B.S();
    const list = B.ALL_BROKERS.concat([B.EXTRA.broker]);
    const m = B.modal(`<div class="wz" id="wz">
      <ol class="wz-steps"><li class="on">Брокер</li><li>Ключ</li><li>Проверка</li></ol>
      <div class="wz-body" id="wz-body"></div></div>`, { host: $('.appwin'), cls: 'desk-modal wz-modal', onClose: () => { D.wizard = null; } });
    D.wizard = m;
    const body = m.el.querySelector('#wz-body'); const steps = m.el.querySelectorAll('.wz-steps li');
    let rights = 'read';
    const pickStep = () => {
      body.innerHTML = `<h3>Выберите брокера</h3>
        <div class="wz-brokers">${list.map(b => S.linked[b.id]
          ? `<button disabled><i class="bdot" style="background:${b.color}"></i>${b.name}<small>подключён</small></button>`
          : `<button class="pick" data-wzpick="${b.id}"><i class="bdot" style="background:${b.color}"></i>${b.name}<small>${CAPS_TEXT(b)}</small></button>`).join('')}</div>
        <p class="muted small">Все брокеры в демо вымышлены. В продукте по ТЗ: Т-Инвестиции, Финам, Алор и БКС.</p>`;
      body.querySelectorAll('[data-wzpick]').forEach(b => b.onclick = () => keyStep(list.find(x => x.id === b.dataset.wzpick)));
    };
    const keyStep = br => {
      steps[1].classList.add('on');
      body.innerHTML = `<h3>Вставьте API-ключ</h3><p class="muted small">Ключ выпускается в личном кабинете брокера. Для аналитики хватит прав «только чтение»: с таким ключом нельзя ни купить, ни продать, ни вывести деньги.</p>
        <div class="wz-rights" role="radiogroup" aria-label="Права ключа">
          <button data-wzr="read" class="on" role="radio" aria-checked="true"><b>Только чтение</b><small>Позиции, деньги, история. Рекомендуем начать с него</small></button>
          <button data-wzr="trade" role="radio" aria-checked="false"><b>Чтение и торговля</b><small>Плюс заявки из приложения. Можно выдать позже</small></button></div>
        <label class="tk-fld"><span>API-ключ · ${br.name}</span><input id="wz-key" type="password" autocomplete="off" placeholder="Вставьте ключ" value="${DEMO_KEYS[br.id]}"></label>
        <p class="tk-note">Ключ сохранится только на этом ПК в зашифрованном виде и никогда не будет отправлен на сервер.</p>
        <div class="m-actions"><button class="btn-d" id="wz-check">Проверить и подключить</button></div>`;
      body.querySelectorAll('[data-wzr]').forEach(b => b.onclick = () => { rights = b.dataset.wzr; body.querySelectorAll('[data-wzr]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); });
      m.el.querySelector('#wz-check').onclick = () => {
        if (!m.el.querySelector('#wz-key').value.trim()) { B.toast('#d-toasts', 'Вставьте ключ', 'warn'); return; }
        checkStep(br);
      };
      B.emitUI && B.emitUI('wz:key');
    };
    const checkStep = br => {
      steps[2].classList.add('on');
      body.innerHTML = `<h3>Проверяем ключ…</h3><ul class="wz-log" id="wz-log"></ul>`;
      const log = m.el.querySelector('#wz-log');
      const accs = br.id === 'zap' ? [B.EXTRA.account] : B.ALL_ACCOUNTS.filter(a => a.broker === br.id);
      const lines = ['Ключ принят брокером', 'Права ключа: ' + (rights === 'trade' ? 'чтение и торговля' : 'только чтение'),
        (accs.length > 1 ? 'Найдены счета: ' : 'Найден счёт: ') + accs.map(a => a.name + ' ' + a.num).join(', '),
        'Ключ зашифрован (AES-256) и сохранён на этом ПК', 'Загружена история операций', 'На сайт отправлен снимок портфеля, ключ не передаётся'];
      let i = 0; const iv = setInterval(() => {
        if (!m.el.isConnected) { clearInterval(iv); return; }
        log.insertAdjacentHTML('beforeend', `<li>✓ ${lines[i]}</li>`); i++;
        if (i >= lines.length) {
          clearInterval(iv);
          if (br.id === 'zap') { B.connectExtra(); if (rights !== 'trade') B.setRights('zap', 'read'); } else B.linkBroker(br.id, rights);
          m.el.querySelector('h3').textContent = br.name + ' подключён';
          const more = canConnect() && B.unlinked().length;
          body.insertAdjacentHTML('beforeend', `<div class="m-actions">${more ? '<button class="btn-d ghost" id="wz-more">Подключить ещё одного</button>' : ''}<button class="btn-d" id="wz-done">Готово</button></div>`);
          m.el.querySelector('#wz-done').onclick = () => { m.close(); if (D.screen === 'accounts') updateAccounts(); else D.go('accounts'); };
          const mb = m.el.querySelector('#wz-more'); if (mb) mb.onclick = () => { steps[1].classList.remove('on'); steps[2].classList.remove('on'); rights = 'read'; pickStep(); };
          B.toast('#d-toasts', `<b>${br.name} подключён</b><br>Счета и история уже на сайте`, 'good', 5000);
        }
      }, B.reduced ? 90 : opts.fast ? 180 : 360);
    };
    pickStep();
    const pb = pre && list.find(x => x.id === pre && !S.linked[x.id]); if (pb) keyStep(pb);
    return m;
  };

  /* Отдельный ключ на торговлю: выдаётся осознанно, после ключа «только чтение» */
  D.tradeKeyModal = function (id) {
    const br = B.BMAP[id]; if (!br) return;
    const m = B.modal(`<div class="wz tkm">
      <span class="eyebrow">${br.name}</span><h3>Ключ на торговлю</h3>
      <p class="muted small">Сейчас приложение только читает счета. Ключ с правом на торговлю позволит выставлять и снимать заявки у этого брокера. Вывод денег через API недоступен ни с каким ключом.</p>
      <label class="tk-fld"><span>Торговый API-ключ</span><input id="tkm-key" type="password" autocomplete="off" value="${DEMO_KEYS[id]}_trade"></label>
      <label class="tk-check"><input type="checkbox" id="tkm-ok">Понимаю: с этим ключом приложение сможет совершать сделки от моего имени</label>
      <p class="tk-note">Ключ хранится только на этом ПК. Каждую заявку вы подтверждаете сами, а торговлю по счёту можно выключить одним переключателем.</p>
      <div class="m-actions"><button class="btn-d ghost" id="tkm-no">Отмена</button><button class="btn-d" id="tkm-yes" disabled>Сохранить ключ</button></div></div>`, { host: $('.appwin'), cls: 'desk-modal wz-modal', onClose: () => { D.tkm = null; } });
    D.tkm = m;
    const ok = m.el.querySelector('#tkm-ok'), yes = m.el.querySelector('#tkm-yes');
    ok.onchange = () => { yes.disabled = !ok.checked; };
    m.el.querySelector('#tkm-no').onclick = m.close;
    yes.onclick = () => {
      B.setRights(id, 'trade'); m.close(); if (D.screen === 'accounts') updateAccounts();
      B.toast('#d-toasts', `<b>Торговля включена: ${br.name}</b><br>Заявки по счетам этого брокера доступны в терминале`, 'good', 5000);
      B.emitUI && B.emitUI('rights:trade');
    };
  };

  /* ---------- события ---------- */
  B.on('fill', o => {
    if (o.src === 'rebalance') return;
    const ins = B.IMAP[o.t];
    B.toast('#d-toasts', `<b>Заявка исполнена</b><br>${o.side === 'buy' ? 'Покупка' : 'Продажа'} ${B.num(o.lots * ins.lot)} ${ins.type === 'fut' ? 'контр.' : 'шт.'} ${o.t} по ${B.px(o.t, o.fillPrice)} · ${B.accLabel(o.acc)}`, 'good');
  });
  B.on('order', o => { if (o.status === 'rejected' && o.type !== 'market') B.toast('#d-toasts', `<b>Заявка #${o.id} отклонена</b><br>${B.esc(o.reason)}`, 'bad'); });
  B.on('news', n => { if (B.App.mode === 'desk' && n.t) B.toast('#d-toasts', `<b>Новость</b> · ${B.esc(n.text)}`, n.dir > 0 ? 'good' : 'bad', 3200); });
})(window.B);
