/* БрокЕд демо — режим «Сайт» */
(function (B) {
  'use strict';
  const $ = B.$, $$ = B.$$;
  const W = B.Web = {
    screen: 'portfolio', period: 63, mode: 'value', struct: 'type', posTab: 'all', mkTab: 'all', mkSearch: '',
    target: null, rebMode: 'buy', plan: null, filter: null, chart: null, dirty: true,
  };
  const URLS = { portfolio: 'портфель', analytics: 'аналитика', markets: 'рынки', news: 'новости', rebalance: 'ребалансировка', tariffs: 'тарифы', account: 'кабинет' };
  const CLS = () => B.CLASS;

  // портфели: сохранённые наборы счетов и классов под разные задачи. Фильтр – временный вид внутри портфеля.
  W.pfs = [
    { id: 'all', name: 'Весь капитал', goal: 'Всё вместе', accs: null, cls: null, target: 0 },
    { id: 'iis', name: 'Пенсия', goal: 'Пенсия', accs: ['sev-i'], cls: null, target: 1500000 },
    { id: 'jr', kind: 'journal', name: 'Мой журнал', goal: 'Трейдинг', target: 0, sample: true },
  ];
  // журнал: портфель без брокера, сделки вносятся вручную, как в TradingView и трекерах
  const jid = pf => 'j:' + pf.id;
  W.isJ = pf => (pf || W.pf()).kind === 'journal';
  B.journalName = id => { const pf = W.pfs.find(x => jid(x) === id); return pf ? 'Журнал · ' + pf.name : 'Журнал'; };
  function ensureJournals() {
    W.pfs.forEach(pf => {
      if (!W.isJ(pf) || B.isJournal(jid(pf))) return;
      B.journalCreate(jid(pf));
      if (pf.sample) seedJournal(jid(pf));
    });
  }
  function seedJournal(id) {
    const S = B.S(), d = S.day;
    const px = (t, day) => B.closeOf(t, day);
    B.journalAdd(id, { k: 'dep', day: d - 62, amt: 300000, note: 'Стартовый депозит' });
    B.journalAdd(id, { k: 'trade', day: d - 60, t: 'ZNTH', qty: 300, price: px('ZNTH', d - 60), fee: 26, note: 'Вход после отчётности, цель +15 %' });
    B.journalAdd(id, { k: 'trade', day: d - 52, t: 'GS29', qty: 80, price: px('GS29', d - 52), fee: 22, note: 'Подушка в облигациях' });
    B.journalAdd(id, { k: 'trade', day: d - 41, t: 'DIDX', qty: 4000, price: px('DIDX', d - 41), fee: 15, note: 'Индекс на остаток' });
    B.journalAdd(id, { k: 'trade', day: d - 18, t: 'ZNTH', qty: -100, price: px('ZNTH', d - 18), fee: 9, note: 'Зафиксировал треть позиции' });
    B.journalAdd(id, { k: 'inc', sub: 'div', day: d - 9, t: 'ZNTH', amt: 3180, note: 'Дивиденды после налога' });
  }
  W.pfId = 'all'; let pfSeq = 0;
  W.pf = () => W.pfs.find(x => x.id === W.pfId) || W.pfs[0];
  W.resetFilter = function () {
    const pf = W.pf();
    if (W.isJ(pf)) { ensureJournals(); W.filter = { accs: new Set([jid(pf)]), cls: new Set(B.CLS_KEYS) }; return; }
    W.filter = { accs: new Set(pf.accs ? pf.accs.filter(id => B.ACCMAP[id]) : B.syncedAccs()), cls: new Set(pf.cls || B.CLS_KEYS) };
  };
  W.pfLimit = () => W.tariff === 'Free' ? 3 : Infinity;
  W.effFilter = function () {
    const S = B.S();
    return { accs: new Set([...W.filter.accs].filter(id => S.sync[id])), cls: W.filter.cls };
  };

  W.mount = function (root) {
    root.innerHTML = `
      <div class="br-bar">
        <span class="br-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="br-nav" aria-hidden="true">‹ ›</span>
        <div class="br-url"><svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 10V8a6 6 0 1 1 12 0v2h1v12H5V10h1Zm2 0h8V8a4 4 0 1 0-8 0v2Z" fill="currentColor"/></svg><span>брокед.демо/<b id="w-url">портфель</b></span></div>
        <span class="br-kind">Браузер</span>
      </div>
      <div class="site">
        <header class="site-head">
          <a class="site-logo" href="#" data-nav="portfolio" aria-label="БрокЕд, на главную">${B.logoIcon(34)}${B.wordmark()}</a>
          <nav class="site-nav" aria-label="Разделы сайта">
            <button data-nav="portfolio">Портфель</button><button data-nav="analytics">Аналитика</button><button data-nav="markets">Рынки</button><button data-nav="news">Новости<em class="nav-badge" id="w-news-badge" hidden></em></button><button data-nav="tariffs">Тарифы</button>
          </nav>
          <button class="site-user" data-nav="account" aria-label="Личный кабинет"><span class="plan-badge">Premium</span><span class="avatar">ДИ</span><span class="su-name">Кабинет</span></button>
        </header>
        <div id="w-view" class="site-view"></div>
        <div class="toasts" id="w-toasts" aria-live="polite"></div>
      </div>`;
    root.addEventListener('click', e => {
      const n = e.target.closest('[data-nav]'); if (n) { e.preventDefault(); W.go(n.dataset.nav); }
      const p = $('#w-filters'); if (p && !p.hidden && !e.target.closest('.fwrap')) { p.hidden = true; const fb = $('#w-fbtn'); if (fb) fb.setAttribute('aria-expanded', false); }
    });
  };

  W.go = function (screen) {
    // ребалансировка живёт внутри портфеля: старые ссылки ведут туда и прокручивают к ней
    const toReb = screen === 'rebalance'; if (toReb) screen = 'portfolio';
    W.screen = screen;
    $('#w-url').textContent = URLS[screen];
    $$('.site-nav button').forEach(b => b.classList.toggle('on', b.dataset.nav === screen));
    $('#web-frame .site-user').classList.toggle('on', screen === 'account');
    const v = $('#w-view');
    v.scrollTop = 0;
    ({ portfolio: renderPortfolio, analytics: renderAnalytics, markets: renderMarkets, news: renderNews, rebalance: renderRebalance, tariffs: renderTariffs, account: renderAccount })[screen](v);
    W.update(true);
    const sc = $('#web-frame .site'); if (sc) sc.scrollTop = 0;
    B.scrollFrameTop && B.scrollFrameTop($('#web-frame'));
    if (toReb) { const r = $('#w-reb'); if (r) r.scrollIntoView({ block: 'start' }); }
    B.emitUI && B.emitUI('web:' + screen);
  };

  W.update = function (force) {
    if (B.App.mode !== 'web' && !force) return;
    const f = ({ portfolio: updatePortfolio, analytics: updateAnalytics, markets: updateMarkets, news: updateNews, account: updateAccount })[W.screen];
    if (f) f();
    newsBadge();
  };

  /* ================= ПОРТФЕЛЬ ================= */
  function renderPortfolio(v) {
    v.innerHTML = `
      <div class="w-bar">
        <div class="w-title"><h1>Портфель</h1>
          ${filterBtn()}
        </div>
        <div class="w-actions" id="w-actions"></div>
      </div>
      <div class="pf-tabs" id="w-pfs"></div>
      <div class="w-grid">
        <div class="w-main">
          <section class="card stats" id="w-stats"></section>
          <section class="card" id="w-journal" hidden></section>
          <section class="card" id="w-poscard">
            <div class="card-head center">
              <div class="seg pills" id="w-postabs"><button data-pt="all">Все</button><button data-pt="up">Рост</button><button data-pt="down">Падение</button></div>
            </div>
            <div id="w-pos"></div>
          </section>
        </div>
        <aside class="w-side">
          <section class="card ana-teaser" id="w-anacard"></section>
          <section class="card" id="w-hints"></section>
          <section class="card" id="w-feed"></section>
        </aside>
      </div>
      <section class="w-reb" id="w-reb"></section>`;
    v.querySelector('.w-actions').addEventListener('click', e => {
      const a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'buy') B.App.openTrade(null);
      if (a.dataset.act === 'jtrade') journalModal('buy');
      if (a.dataset.act === 'jcash') journalModal('cash');
      if (a.dataset.act === 'jimport') importModal();
      if (a.dataset.act === 'deposit') depositModal();
      if (a.dataset.act === 'broker') { B.App.setMode('desk'); B.Desk.go('accounts'); B.Desk.connectWizard && B.Desk.connectWizard(); }
    });
    $('#w-anacard').addEventListener('click', e => { if (e.target.closest('[data-goana]')) W.go('analytics'); });
    $('#w-postabs').addEventListener('click', e => { const b = e.target.closest('[data-pt]'); if (b) { W.posTab = b.dataset.pt; updatePortfolio(); } });
    $('#w-pos').addEventListener('click', e => { const c = e.target.closest('[data-asset]'); if (c) assetModal(c.dataset.asset); });
    $('#w-hints').addEventListener('click', e => {
      const b = e.target.closest('[data-hint]'); if (!b) return;
      const h = b.dataset.hint;
      if (h === 'rebalance') W.go('rebalance');
      if (h === 'sync') { B.App.setMode('desk'); B.Desk.go('accounts'); }
      if (h.startsWith('asset:')) assetModal(h.slice(6));
      if (h.startsWith('news:')) { const n = B.newsByKey(h.slice(5)); if (n) openNews(n); }
    });
    bindPfTabs();
    $('#w-journal').addEventListener('click', e => {
      const x = e.target.closest('[data-jdel]'); if (x) { B.journalRemove(jid(W.pf()), +x.dataset.jdel); updatePortfolio(); B.toast('#w-toasts', 'Операция удалена из журнала', 'info'); return; }
      const a = e.target.closest('[data-jadd]'); if (a) journalModal(a.dataset.jadd);
      if (e.target.closest('[data-jmore]')) { W.jShow += 15; updateJournal(); }
    });
    renderPfTabs();
    renderFilters();
    renderRebalance($('#w-reb'));
    pfMode();
  }
  function bindPfTabs() {
    $('#w-pfs').addEventListener('click', e => {
      const b = e.target.closest('[data-pf]'); if (b) { selectPf(b.dataset.pf); return; }
      if (e.target.closest('[data-pfnew]')) { if (W.pfs.length >= W.pfLimit()) upsell('Pro', 'На тарифе Free можно вести до 3 портфелей. В Pro и Premium – без ограничений.'); else pfModal(null); return; }
      if (e.target.closest('[data-pfedit]')) pfModal(W.pf());
    });
    $('#w-fbtn').onclick = e => { e.stopPropagation(); const p = $('#w-filters'); p.hidden = !p.hidden; $('#w-fbtn').setAttribute('aria-expanded', !p.hidden); };
    $('#w-filters').addEventListener('click', e => e.stopPropagation());
  }
  function selectPf(id) { W.pfId = id; W.jShow = 15; W.resetFilter(); renderPfTabs(); renderFilters(); pfMode(); updatePortfolio(); }
  W.selectPf = selectPf;
  function journalEmpty() {
    $$('.w-grid .card').forEach(c => { if (c.id !== 'w-stats') c.classList.add('j-hide'); });
    $('#w-stats').innerHTML = `<div class="j-empty"><b>Журнал «${B.esc(W.pf().name)}» пока пуст</b>
      <p class="muted">Внесите сделку вручную: бумагу, дату, цену и количество. Можно начать с пополнения или загрузить отчёт брокера в CSV. Покупать через нас не нужно – журнал просто считает результат.</p>
      <div class="j-empty-act"><button class="btn-g" data-act="jtrade">+ Первая сделка</button><button class="btn-t" data-act="jcash">Пополнение</button><button class="btn-t" data-act="jimport">Импорт CSV</button></div></div>`;
    $('#w-stats').querySelector('.j-empty-act').onclick = e => { const a = e.target.closest('[data-act]'); if (!a) return; ({ jtrade: () => journalModal('buy'), jcash: () => journalModal('cash'), jimport: importModal })[a.dataset.act](); };
  }

  /* ---------- журнал сделок ---------- */
  W.jShow = 15;
    function opRow(o) {
    const ins = o.t && B.IMAP[o.t];
    let kind, what = '', amt, cls = '';
    if (o.k === 'trade') { kind = o.qty > 0 ? 'Покупка' : 'Продажа'; cls = o.qty > 0 ? 'buy' : 'sell'; what = `${B.num(Math.abs(o.qty))} шт. × ${B.px(o.t, o.price)}`; amt = (o.qty > 0 ? '−' : '+') + B.rub(Math.abs(o.qty) * o.price + (o.qty > 0 ? o.fee : -o.fee), 0); }
    else if (o.k === 'dep') { kind = 'Пополнение'; amt = '+' + B.rub(o.amt, 0); cls = 'dep'; }
    else if (o.k === 'wd') { kind = 'Вывод'; amt = '−' + B.rub(o.amt, 0); cls = 'wd'; }
    else if (o.k === 'inc') { kind = o.sub === 'coupon' ? 'Купон' : 'Дивиденд'; amt = '+' + B.rub(o.amt, 2); cls = 'inc'; }
    else { kind = 'Комиссия, налог'; amt = '−' + B.rub(o.amt, 2); cls = 'fee'; }
    return `<tr><td class="num">${B.dateShort(o.day)}</td><td><span class="jtag ${cls}">${kind}</span></td>
      <td>${ins ? `<b>${o.t}</b> <small class="muted">${B.esc(ins.n)}</small>` : '<span class="muted">—</span>'}</td><td class="num">${what}</td>
      <td class="r num">${amt}${o.fee && o.k === 'trade' ? `<small class="muted">комиссия ${B.rub(o.fee, 2)}</small>` : ''}</td>
      <td class="jnote">${o.note ? B.esc(o.note) : ''}</td><td class="r"><button class="jdel" data-jdel="${o.id}" aria-label="Удалить операцию">×</button></td></tr>`;
  }
  function updateJournal() {
    const box = $('#w-journal'); if (!box || box.hidden) return;
    const id = jid(W.pf()); const ops = B.S().ops.filter(o => o.acc === id).reverse();
    const sig = ops.length + ':' + (ops[0] ? ops[0].id : 0) + ':' + W.jShow;
    if (box.dataset.sig === sig) return; box.dataset.sig = sig;
    box.innerHTML = `<div class="card-head"><h2>Журнал сделок</h2><div class="j-add"><button class="btn-t sm" data-jadd="buy">+ Сделка</button><button class="btn-t sm" data-jadd="inc">+ Дивиденд</button><button class="btn-t sm" data-jadd="fee">+ Комиссия</button></div></div>
      <div class="table-scroll"><table class="j-table"><thead><tr><th>Дата</th><th>Операция</th><th>Бумага</th><th>Кол-во × цена</th><th class="r">Сумма</th><th>Заметка</th><th></th></tr></thead>
      <tbody>${ops.slice(0, W.jShow).map(opRow).join('')}</tbody></table></div>
      ${ops.length > W.jShow ? `<div class="more-row"><button class="btn-t" data-jmore>Показать ещё (${ops.length - W.jShow})</button></div>` : ''}
      <p class="muted small">Журнал не связан с брокером: операции вносятся вручную и не исполняются. Цены, графики и метрики считаются по котировкам демо-биржи.</p>`;
  }
  function journalModal(type) {
    const S = B.S(); const id = jid(W.pf()); ensureJournals();
    const st = S.acc[id]; const held = Object.keys(st.pos);
    const tradable = B.INSTR.filter(i => i.type !== 'fut');
    const today = B.isoOf(S.day), min = B.isoOf(0);
    // у каждого действия своё окно: сделка, движение денег, выплата, расход
    const isTrade = type === 'buy' || type === 'sell';
    const V = isTrade ? { ico: '⇄', h: 'Сделка в журнале', p: 'Покупка или продажа бумаги. Цена подставится по закрытию выбранного дня, её можно поменять на свою.', ok: 'Записать сделку' }
      : type === 'cash' ? { ico: '₽', h: 'Пополнение или вывод', p: 'Деньги, которые вы завели на счёт или сняли с него. От них считается доходность журнала.', ok: 'Записать' }
      : type === 'inc' ? { ico: '%', h: 'Дивиденд или купон', p: 'Выплата по бумаге из журнала. Тип выплаты определится сам: по акции – дивиденд, по облигации – купон.', ok: 'Записать выплату' }
      : { ico: '−', h: 'Комиссия или налог', p: 'Расходы, которые не привязаны к сделке: обслуживание счёта, депозитарий, налог.', ok: 'Записать расход' };
    const m = B.modal(`<div class="j-mh"><i class="j-ico ${type}" aria-hidden="true">${V.ico}</i><div><h3>${V.h}</h3><p class="muted small">${V.p}</p></div></div>
      ${isTrade ? '<div class="seg j-side" id="j-types"><button data-jt="buy">Покупка</button><button data-jt="sell">Продажа</button></div>' : ''}
      <div id="j-form"></div>
      <div class="err" id="j-err" hidden></div>
      <div class="m-actions"><span class="muted small" id="j-sum"></span><button class="btn-g" id="j-ok">${V.ok}</button></div>`, { host: $('#web-frame'), cls: 'j-modal j-' + (isTrade ? 'trade' : type) });
    const F = m.el.querySelector('#j-form'); const q = sel => m.el.querySelector(sel);
    let touched = false;
    // выбор бумаги: поле поиска с выпадающим списком, фильтр по тикеру и названию
    const TYPE_N = { stock: 'Акция', bond: 'Облигация', fund: 'Фонд' };
    const insLabel = i => `${i.n} · ${i.t}`;
    const insPick = (list, sel) => `<div class="fld"><label for="j-t-q">Бумага</label><div class="j-combo">
      <input id="j-t-q" type="text" role="combobox" aria-expanded="false" aria-controls="j-t-list" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="Начните вводить тикер или название" value="${B.esc(insLabel(B.IMAP[sel]))}">
      <button type="button" class="j-combo-btn" tabindex="-1" aria-label="Показать все бумаги"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <input id="j-t" type="hidden" value="${sel}">
      <ul id="j-t-list" class="j-combo-list" role="listbox" hidden></ul></div></div>`;
    function wirePick(list) {
      const inp = q('#j-t-q'), hid = q('#j-t'), ul = q('#j-t-list'), btn = q('.j-combo-btn');
      let shown = [], hi = 0;
      const render = all => {
        const s = all ? '' : inp.value.trim().toLowerCase();
        shown = s ? list.filter(i => i.t.toLowerCase().includes(s) || i.n.toLowerCase().includes(s)) : list.slice();
        // точное совпадение тикера и начало строки поднимаем наверх
        if (s) shown.sort((a, b) => rank(a, s) - rank(b, s));
        hi = Math.max(0, shown.findIndex(i => i.t === hid.value)); if (s) hi = 0;
        ul.innerHTML = shown.length ? shown.map((i, k) => `<li role="option" id="j-opt-${k}" data-t="${i.t}" class="${k === hi ? 'hi' : ''}${i.t === hid.value ? ' sel' : ''}" aria-selected="${i.t === hid.value}">
            <b>${i.t}</b><span class="j-combo-n">${B.esc(i.n)}</span><small class="muted">${type === 'sell' || type === 'inc' ? B.num(Math.abs(st.pos[i.t].qty)) + ' шт.' : TYPE_N[i.type] || ''}</small></li>`).join('')
          : '<li class="j-combo-empty muted">Ничего не нашлось</li>';
        ul.hidden = false; inp.setAttribute('aria-expanded', 'true');
        inp.setAttribute('aria-activedescendant', shown.length ? 'j-opt-' + hi : '');
      };
      const rank = (i, s) => i.t.toLowerCase() === s ? 0 : i.t.toLowerCase().startsWith(s) ? 1 : i.n.toLowerCase().startsWith(s) ? 2 : 3;
      const close = () => { ul.hidden = true; inp.setAttribute('aria-expanded', 'false'); inp.value = insLabel(B.IMAP[hid.value]); };
      const move = d => { if (!shown.length) return; hi = (hi + d + shown.length) % shown.length; ul.querySelectorAll('[role=option]').forEach((li, k) => li.classList.toggle('hi', k === hi)); const li = ul.children[hi]; li.scrollIntoView({ block: 'nearest' }); inp.setAttribute('aria-activedescendant', li.id); };
      const choose = t => { const ch = t !== hid.value; hid.value = t; close(); if (ch) hid.dispatchEvent(new Event('change', { bubbles: true })); };
      inp.addEventListener('focus', () => { inp.select(); render(true); });
      inp.addEventListener('click', () => { if (ul.hidden) { inp.select(); render(true); } });
      inp.addEventListener('input', e => { e.stopPropagation(); render(false); });
      inp.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (ul.hidden) render(true); else move(e.key === 'ArrowDown' ? 1 : -1); }
        else if (e.key === 'Enter') { e.preventDefault(); if (!ul.hidden && shown[hi]) choose(shown[hi].t); }
        else if (e.key === 'Escape' && !ul.hidden) { e.stopPropagation(); close(); }
        else if (e.key === 'Tab' && !ul.hidden && inp.value.trim() && shown[hi]) choose(shown[hi].t);
      });
      inp.addEventListener('blur', close);
      ul.addEventListener('mousedown', e => { const li = e.target.closest('[data-t]'); if (li) { e.preventDefault(); choose(li.dataset.t); } });
      btn.addEventListener('mousedown', e => { e.preventDefault(); if (ul.hidden) { inp.focus(); render(true); } else close(); });
    }
    const draw = () => {
      m.el.querySelectorAll('[data-jt]').forEach(b => b.classList.toggle('on', b.dataset.jt === type));
      const okb = q('#j-ok'); if (okb && isTrade) okb.className = type === 'sell' ? 'btn-g sell' : 'btn-g';
      touched = false;
      const dateF = `<label class="fld"><span>Дата</span><input id="j-date" type="date" min="${min}" max="${today}" value="${today}"></label>`;
      const noteF = `<label class="fld"><span>Заметка <small class="muted">· почему вошли, план выхода</small></span><input id="j-note" maxlength="128" placeholder="Например, покупка на просадке после новостей"></label>`;
      if (type === 'buy' || type === 'sell') {
        const list = type === 'sell' ? tradable.filter(i => held.includes(i.t)) : tradable;
        if (!list.length) { F.innerHTML = '<p class="empty">В журнале нет бумаг для продажи. Сначала добавьте покупку.</p>'; return upd(); }
        F.innerHTML = `${insPick(list, list[0].t)}
          <div class="pf-two">${dateF}<label class="fld"><span>Количество, шт.</span><input id="j-qty" type="number" min="1" step="1" value="${type === 'sell' ? Math.abs(st.pos[list[0].t].qty) : 10}"></label></div>
          <div class="pf-two"><label class="fld"><span>Цена, ₽</span><input id="j-price" type="number" min="0" step="0.01"></label><label class="fld"><span>Комиссия, ₽</span><input id="j-fee" type="number" min="0" step="0.01" value="0"></label></div>
          ${type === 'buy' ? '<label class="tk-check j-cover"><input type="checkbox" id="j-cover" checked><span id="j-cover-t">Добавить пополнение, если денег в журнале не хватает</span></label>' : ''}${noteF}`;
        wirePick(list);
      } else if (type === 'cash') {
        F.innerHTML = `<div class="seg small" id="j-dir"><button data-dir="dep" class="on">Пополнение</button><button data-dir="wd">Вывод</button></div>
          <div class="pf-two">${dateF}<label class="fld"><span>Сумма, ₽</span><input id="j-amt" type="number" min="1" step="1000" value="100000"></label></div>${noteF}`;
      } else if (type === 'inc') {
        const list = tradable.filter(i => held.includes(i.t) && i.type !== 'fund');
        if (!list.length) { F.innerHTML = '<p class="empty">Дивиденды и купоны вносятся по бумагам из журнала. Сначала добавьте покупку акции или облигации.</p>'; return upd(); }
        F.innerHTML = `${insPick(list, list[0].t)}
          <div class="pf-two">${dateF}<label class="fld"><span>Сумма выплаты, ₽</span><input id="j-amt" type="number" min="0.01" step="0.01" value="1000"></label></div>${noteF}`;
        wirePick(list);
      } else {
        F.innerHTML = `<div class="pf-two">${dateF}<label class="fld"><span>Сумма, ₽</span><input id="j-amt" type="number" min="0.01" step="0.01" value="500"></label></div>${noteF}`;
      }
      upd();
    };
    const day = () => { const d = q('#j-date'); return d && d.value ? B.dayOfIso(d.value) : S.day; };
    function upd() {
      const t = q('#j-t'), pr = q('#j-price'), sum = q('#j-sum'), ok = q('#j-ok');
      ok.disabled = !q('#j-form input, #j-form select');
      if (t && pr && !touched) pr.value = (+B.closeOf(t.value, day())).toFixed(B.dec(t.value) || 2);
      if (t && pr) {
        const cost = (+q('#j-qty').value || 0) * (+pr.value || 0) + (+q('#j-fee').value || 0);
        sum.textContent = (type === 'buy' ? 'Спишется ' : 'Поступит ') + B.rub(type === 'buy' ? cost : cost - 2 * (+q('#j-fee').value || 0), 2);
        const cv = q('#j-cover-t'); if (cv) { const short = cost - st.cash; cv.textContent = short > 0 ? `Добавить пополнение на недостающие ${B.rub(short, 0)}` : 'Денег в журнале хватает'; q('#j-cover').disabled = short <= 0; }
      } else sum.textContent = '';
    }
    if (isTrade) m.el.querySelector('#j-types').onclick = e => { const b = e.target.closest('[data-jt]'); if (b) { type = b.dataset.jt; draw(); } };
    F.addEventListener('input', e => { if (e.target.id === 'j-price') touched = true; upd(); });
    F.addEventListener('change', e => { if (e.target.id === 'j-t' && type === 'sell') q('#j-qty').value = Math.abs(st.pos[e.target.value].qty); if (e.target.id === 'j-t' || e.target.id === 'j-date') touched = false; upd(); });
    F.addEventListener('click', e => { const b = e.target.closest('[data-dir]'); if (b) m.el.querySelectorAll('[data-dir]').forEach(x => x.classList.toggle('on', x === b)); });
    q('#j-ok').onclick = () => {
      const err = q('#j-err'); const fail = t => { err.hidden = false; err.textContent = t; };
      const d = day(), note = (q('#j-note') || {}).value || '';
      if (type === 'buy' || type === 'sell') {
        const t = q('#j-t').value, qty = Math.floor(+q('#j-qty').value || 0), price = +q('#j-price').value, fee = Math.max(0, +q('#j-fee').value || 0);
        if (qty <= 0) return fail('Укажите количество');
        if (!(price > 0)) return fail('Укажите цену');
        if (type === 'sell' && qty > Math.abs(st.pos[t].qty)) return fail('В журнале только ' + B.num(st.pos[t].qty) + ' шт. Короткие продажи журнал не ведёт.');
        if (type === 'buy') { const short = qty * price + fee - st.cash; if (short > 0 && q('#j-cover').checked) B.journalAdd(id, { k: 'dep', day: d, amt: Math.ceil(short), note: 'Пополнение под покупку ' + t }); }
        B.journalAdd(id, { k: 'trade', day: d, t, qty: type === 'buy' ? qty : -qty, price, fee, note });
      } else {
        const amt = +q('#j-amt').value; if (!(amt > 0)) return fail('Укажите сумму');
        if (type === 'cash') B.journalAdd(id, { k: m.el.querySelector('[data-dir].on').dataset.dir, day: d, amt, note });
        else if (type === 'inc') { const t = q('#j-t').value; B.journalAdd(id, { k: 'inc', sub: B.IMAP[t].type === 'bond' ? 'coupon' : 'div', day: d, t, amt, note }); }
        else B.journalAdd(id, { k: 'fee', day: d, amt, note });
      }
      m.close(); updatePortfolio(); B.toast('#w-toasts', 'Операция добавлена в журнал', 'good');
    };
    draw();
  }
  W.journalModal = journalModal;
  // импорт: CSV из отчёта брокера в простом формате; файл можно перетащить, есть шаблон и пример
  const CSV_HEAD = 'date,type,ticker,qty,price,fee';
  const CSV_TYPES = { buy: 'Покупка', sell: 'Продажа', deposit: 'Пополнение', withdraw: 'Вывод', dividend: 'Дивиденд', fee: 'Комиссия' };
  function parseCsv(csv) {
    const S = B.S();
    return csv.trim().split(/\r?\n/).filter(l => l.trim()).filter((l, i) => !(i === 0 && /date/i.test(l))).map(line => {
      // русский Excel пишет «;» между полями и запятую в дробях: тогда запятая – это часть числа, а не разделитель
      const semi = /[;\t]/.test(line);
      const [date, type, t, qty, price, fee] = line.split(semi ? /[;\t]/ : ',').map(x => (x || '').trim()).map((x, i) => semi && i > 2 ? x.replace(/\s/g, '').replace(',', '.') : x);
      const ty = (type || '').toLowerCase(), ins = B.IMAP[(t || '').toUpperCase()];
      const r = { date, ty, t: ins ? ins.t : (t || '').toUpperCase(), qty: +qty || 0, price: +price || 0, fee: +fee || 0, err: '' };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) r.err = 'дата не в формате ГГГГ-ММ-ДД';
      else if (!CSV_TYPES[ty]) r.err = 'неизвестная операция';
      else if ((ty === 'buy' || ty === 'sell' || ty === 'dividend') && !ins) r.err = t ? 'нет такой бумаги' : 'нужен тикер';
      else if ((ty === 'buy' || ty === 'sell') && !(r.qty > 0 && r.price > 0)) r.err = 'нужны количество и цена';
      else if (ty !== 'buy' && ty !== 'sell' && !((r.price || r.qty) > 0)) r.err = 'нужна сумма';
      r.day = Math.max(0, Math.min(S.day, B.dayOfIso(date) || 0));
      return r;
    });
  }
  function importModal() {
    const id = jid(W.pf());
    const m = B.modal(`<div class="j-mh"><i class="j-ico imp" aria-hidden="true">⇪</i><div><h3>Импорт сделок из CSV</h3><p class="muted small">Подойдёт выгрузка из отчёта брокера, приведённая к шаблону. Перед импортом покажем, что распознано.</p></div></div>
      <label class="j-drop" id="j-drop"><input id="j-file" type="file" accept=".csv,text/csv,text/plain">
        <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M12 15V4m0 0l-4 4m4-4l4 4M5 15v4h14v-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <b id="j-dt">Перетащите файл сюда или выберите на компьютере</b><small class="muted" id="j-ds">CSV, разделитель – запятая или точка с запятой</small></label>
      <div id="j-prev"></div>
      <details class="j-fmt"><summary>Формат файла</summary>
        <p class="muted small">Шесть столбцов: дата, операция, тикер, количество, цена, комиссия. Операции: ${Object.entries(CSV_TYPES).map(([k, n]) => `<code>${k}</code> ${n.toLowerCase()}`).join(', ')}. Для денег и выплат сумма пишется в столбец цены.</p>
        <pre class="j-csv">${CSV_HEAD}\n2026-08-03,deposit,,,150000,\n2026-08-04,buy,KRST,30,1215.4,18\n2026-09-10,dividend,KRST,,2100,</pre></details>
      <div class="m-actions j-iact"><button class="link" id="j-tpl">Скачать шаблон</button><span class="sp"></span><button class="btn-t" id="j-sample">Подставить пример</button><button class="btn-g" id="j-iok" disabled>Импортировать</button></div>`, { host: $('#web-frame'), cls: 'j-modal' });
    const q = x => m.el.querySelector(x);
    let rows = [];
    const show = (csv, name) => {
      rows = parseCsv(csv); const ok = rows.filter(r => !r.err);
      q('#j-drop').classList.add('has');
      q('#j-dt').textContent = name; q('#j-ds').textContent = `Строк: ${rows.length} · распознано: ${ok.length}${rows.length - ok.length ? ' · с ошибками: ' + (rows.length - ok.length) : ''} · выбрать другой файл`;
      q('#j-prev').innerHTML = rows.length ? `<div class="table-scroll j-ptab"><table><thead><tr><th>Дата</th><th>Операция</th><th>Бумага</th><th class="r">Кол-во</th><th class="r">Цена / сумма</th><th></th></tr></thead><tbody>${rows.slice(0, 6).map(r => `<tr class="${r.err ? 'bad' : ''}"><td class="num">${B.esc(r.date)}</td><td>${CSV_TYPES[r.ty] || B.esc(r.ty)}</td><td>${B.esc(r.t || '—')}</td><td class="r num">${r.qty ? B.num(r.qty) : ''}</td><td class="r num">${r.price ? B.num(r.price, 2) : ''}</td><td>${r.err ? `<span class="j-bad">${r.err}</span>` : '<span class="j-ok">✓</span>'}</td></tr>`).join('')}</tbody></table></div>${rows.length > 6 ? `<p class="muted small">и ещё ${rows.length - 6} строк</p>` : ''}` : '<p class="err">В файле не нашлось строк с операциями</p>';
      const b = q('#j-iok'); b.disabled = !ok.length; b.textContent = ok.length ? `Импортировать ${ok.length} ${B.plural(ok.length, 'операцию', 'операции', 'операций')}` : 'Импортировать';
    };
    const read = f => { if (!f) return; const r = new FileReader(); r.onload = () => show(String(r.result), f.name); r.readAsText(f); };
    q('#j-file').onchange = e => read(e.target.files[0]);
    const dz = q('#j-drop');
    ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('over'); }));
    dz.addEventListener('drop', e => read(e.dataTransfer.files[0]));
    q('#j-tpl').onclick = () => {
      const url = URL.createObjectURL(new Blob(['﻿' + CSV_HEAD + '\n'], { type: 'text/csv' }));
      const a = document.createElement('a'); a.href = url; a.download = 'brokED-import.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    q('#j-sample').onclick = () => {
      const S = B.S(); const d1 = B.isoOf(S.day - 40), d2 = B.isoOf(S.day - 39), d3 = B.isoOf(S.day - 20), d4 = B.isoOf(S.day - 6);
      show(`${CSV_HEAD}\n${d1},deposit,,,150000,\n${d2},buy,KRST,30,${B.closeOf('KRST', S.day - 39).toFixed(1)},18\n${d3},buy,GS29,40,${B.closeOf('GS29', S.day - 20).toFixed(2)},6\n${d4},dividend,KRST,,2100,`, 'Пример отчёта брокера');
    };
    q('#j-iok').onclick = () => {
      let n = 0;
      rows.filter(r => !r.err).forEach(r => {
        const note = 'Импорт CSV', ins = B.IMAP[r.t];
        if (r.ty === 'buy' || r.ty === 'sell') B.journalAdd(id, { k: 'trade', day: r.day, t: r.t, qty: r.ty === 'buy' ? r.qty : -r.qty, price: r.price, fee: r.fee, note });
        else if (r.ty === 'deposit' || r.ty === 'withdraw') B.journalAdd(id, { k: r.ty === 'deposit' ? 'dep' : 'wd', day: r.day, amt: r.price || r.qty, note });
        else if (r.ty === 'dividend') B.journalAdd(id, { k: 'inc', sub: ins.type === 'bond' ? 'coupon' : 'div', day: r.day, t: r.t, amt: r.price || r.qty, note });
        else B.journalAdd(id, { k: 'fee', day: r.day, amt: r.price || r.qty, note });
        n++;
      });
      const bad = rows.length - n;
      m.close(); updatePortfolio();
      B.toast('#w-toasts', `Импортировано операций: ${n}${bad ? ', пропущено строк: ' + bad : ''}`, n ? 'good' : 'warn');
    };
  }
  // журнал и брокерский портфель отличаются кнопками и набором карточек
  function pfMode() {
    const j = W.isJ();
    const fw0 = $('.w-title .fwrap'); if (fw0) fw0.hidden = j;
    const act = $('#w-actions'); if (!act || W.screen !== 'portfolio') return;
    act.innerHTML = j ? `<button class="btn-g" data-act="jtrade">+ Сделка</button><button class="btn-t" data-act="jcash">Пополнение / вывод</button><button class="btn-t" data-act="jimport">Импорт CSV</button>`
      : `<button class="btn-g" data-act="buy">Купить активы</button><button class="btn-t" data-act="deposit">Пополнить</button><button class="btn-t" data-act="broker">+ Брокер</button>`;
    $('#w-journal').hidden = !j;
    const fw = $('.w-title .fwrap'); if (fw) fw.hidden = j;
    const rb = $('#w-reb'); if (rb) rb.hidden = j;
  }
  function renderPfTabs() {
    const box = $('#w-pfs'); if (!box) return;
    const lim = W.pfLimit();
    box.innerHTML = W.pfs.map(pf => `<button data-pf="${pf.id}" class="${pf.id === W.pfId ? 'on' : ''} ${W.isJ(pf) ? 'jr' : ''}"><b>${W.isJ(pf) ? '<i class="jr-ico" aria-hidden="true">✎</i>' : ''}${B.esc(pf.name)}</b><small>${pfSub(pf)}</small></button>`).join('')
      + `<button class="pf-new" data-pfnew>+ Портфель${lim !== Infinity ? `<small>${W.pfs.length} из ${lim} на Free</small>` : ''}</button>`
      + (W.pfId !== 'all' ? '<button class="link pf-edit" data-pfedit>Настроить портфель</button>' : '');
  }
  function pfSub(pf) {
    const t = pf.target ? 'цель ' + (pf.target >= 1e6 ? B.num(pf.target / 1e6, 1) + ' млн ₽' : B.num(pf.target / 1e3, 0) + ' тыс ₽') : '';
    const base = pf.goal !== pf.name ? pf.goal + (t ? ' · ' + t : '') : t || (W.isJ(pf) ? '' : 'свой набор счетов');
    return B.esc(W.isJ(pf) ? 'журнал' + (base ? ' · ' + base : '') : base);
  }
  const GOALS = ['Пенсия', 'Подушка безопасности', 'Дивиденды', 'Крупная покупка', 'Образование детей', 'Трейдинг', 'Другое'];
  function pfModal(pf) {
    const S = B.S(); const isNew = !pf;
    const accs = new Set(pf ? (pf.accs || B.syncedAccs()) : []); const cls = new Set(pf ? (pf.cls || B.CLS_KEYS) : B.CLS_KEYS);
    const m = B.modal(`<h3>${isNew ? 'Новый портфель' : 'Настройки портфеля'}</h3>
      <p class="muted">Портфель – это набор счетов под отдельную задачу. Один счёт может входить в несколько портфелей.</p>
      ${isNew ? `<div class="fld"><span>Как вести</span><div class="seg pf-kind" id="pf-kind"><button data-kind="journal" class="on">Журнал: вношу сделки сам</button><button data-kind="broker">Счета брокеров из приложения</button></div></div>` : ''}
      <label class="fld"><span>Название</span><input id="pf-name" maxlength="28" value="${pf ? B.esc(pf.name) : ''}" placeholder="Например, Дивиденды"></label>
      <div class="pf-two"><label class="fld"><span>Задача</span><select id="pf-goal">${GOALS.map(g => `<option ${pf && pf.goal === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      <label class="fld"><span>Цель, ₽ (необязательно)</span><input id="pf-target" type="number" min="0" step="10000" inputmode="numeric" value="${pf && pf.target ? pf.target : ''}" placeholder="1 000 000"></label></div>
      <div class="pf-two"><label class="fld"><span>Бенчмарк <small class="muted">· с чем сравнивать</small></span><select id="pf-bench">${Object.entries(BENCH).map(([k, b]) => `<option value="${k}" ${(pf ? W.benchKey(pf) : 'idx') === k ? 'selected' : ''}>${b.n}</option>`).join('')}</select></label>
      <label class="fld"><span>Безрисковая ставка, % годовых</span><input id="pf-rf" type="number" min="0" max="50" step="0.25" inputmode="decimal" value="${pf ? W.rfOf(pf) : 16}"></label></div>
      <p class="muted small pf-rfnote">Бенчмарк нужен для сравнения доходности, беты и альфы. Ставка – для коэффициентов Шарпа и Сортино: обычно берут ключевую ставку или доходность коротких ОФЗ.</p>
      <div class="fld pf-brk"><span>Счета</span><div class="fchips">${B.ACCOUNTS.map(a => `<button class="fchip ${accs.has(a.id) ? 'on' : ''}" data-pa="${a.id}" ${S.sync[a.id] ? '' : 'disabled title="Синхронизация выключена"'}><i class="bdot" style="background:${B.BMAP[a.broker].color}"></i>${B.accLabel(a.id)}</button>`).join('')}</div></div>
      <div class="fld pf-brk"><span>Классы активов</span><div class="fchips">${B.CLS_KEYS.map(k => `<button class="fchip cls ${cls.has(k) ? 'on' : ''}" data-pc="${k}" style="--c:${B.CLASS[k].color}">${B.CLASS[k].name}</button>`).join('')}</div></div>
      <div class="err" id="pf-err" hidden></div>
      <div class="m-actions">${isNew ? '' : '<button class="link danger" id="pf-del">Удалить портфель</button>'}<button class="btn-g" id="pf-ok">${isNew ? 'Создать' : 'Сохранить'}</button></div>`, { host: $('#web-frame') });
    let kind = pf ? (pf.kind || 'broker') : 'journal';
    const showKind = () => { m.el.querySelectorAll('.pf-brk').forEach(x => x.hidden = kind === 'journal'); m.el.querySelectorAll('[data-kind]').forEach(x => x.classList.toggle('on', x.dataset.kind === kind)); };
    showKind();
    m.el.addEventListener('click', e => {
      const kb = e.target.closest('[data-kind]'); if (kb) { kind = kb.dataset.kind; showKind(); return; }
      const a = e.target.closest('[data-pa]'), c = e.target.closest('[data-pc]');
      if (a) { const id = a.dataset.pa; accs.has(id) ? accs.delete(id) : accs.add(id); a.classList.toggle('on', accs.has(id)); }
      if (c) { const k = c.dataset.pc; if (cls.has(k) && cls.size > 1) cls.delete(k); else cls.add(k); c.classList.toggle('on', cls.has(k)); }
    });
    const del = m.el.querySelector('#pf-del');
    if (del) del.onclick = () => { if (W.isJ(pf)) B.journalDrop(jid(pf)); W.pfs = W.pfs.filter(x => x !== pf); m.close(); selectPf('all'); B.toast('#w-toasts', 'Портфель удалён. Счета и бумаги остались на месте.', 'info'); };
    m.el.querySelector('#pf-ok').onclick = () => {
      const name = m.el.querySelector('#pf-name').value.trim(); const err = m.el.querySelector('#pf-err');
      if (!name) { err.hidden = false; err.textContent = 'Введите название'; return; }
      if (kind !== 'journal' && !accs.size) { err.hidden = false; err.textContent = 'Выберите хотя бы один счёт'; return; }
      const rfv = +m.el.querySelector('#pf-rf').value;
      if (!(rfv >= 0 && rfv <= 50)) { err.hidden = false; err.textContent = 'Ставка должна быть от 0 до 50 %'; return; }
      const data = { name, goal: m.el.querySelector('#pf-goal').value, target: Math.max(0, +m.el.querySelector('#pf-target').value || 0), bench: m.el.querySelector('#pf-bench').value, rf: rfv };
      if (kind !== 'journal') Object.assign(data, { accs: [...accs], cls: cls.size === B.CLS_KEYS.length ? null : [...cls] });
      let id = W.pfId;
      if (isNew) { const np = Object.assign({ id: 'p' + (++pfSeq), kind }, data); W.pfs.push(np); id = np.id; } else Object.assign(pf, data);
      m.close(); selectPf(id);
      if (isNew && kind === 'journal') setTimeout(() => journalModal('buy'), 50);
      B.toast('#w-toasts', isNew ? `Портфель «${B.esc(name)}» создан` : 'Портфель сохранён', 'good');
    };
  }
  // окно «нужен тариф выше»
  function upsell(plan, text) {
    const m = B.modal(`<h3>Доступно в ${plan}</h3><p>${text || (plan === 'Premium' ? 'Торговля и исполнение плана в один клик работают через приложение для ПК, оно входит в Premium.' : 'Расширенные метрики и расчёт ребалансировки входят в Pro и Premium.')}</p>
      <p class="muted small">В демо оплата не проводится, тариф можно сменить в любой момент.</p>
      ${plan === 'Premium' && W.pfs.some(x => W.isJ(x)) ? '<p class="up-alt">Без Premium сделки можно вести вручную: внесите покупку в журнал, и сайт посчитает результат.</p>' : ''}
      <div class="m-actions"><button class="btn-t" id="up-tariffs">Сравнить тарифы</button>${plan === 'Premium' && W.pfs.some(x => W.isJ(x)) ? '<button class="btn-t" id="up-j">Внести в журнал</button>' : ''}<button class="btn-g" id="up-ok">Подключить ${plan}</button></div>`, { host: $('#web-frame') });
    const uj = m.el.querySelector('#up-j');
    if (uj) uj.onclick = () => { m.close(); if (W.screen !== 'portfolio') W.go('portfolio'); selectPf(W.pfs.find(x => W.isJ(x)).id); journalModal('buy'); };
    m.el.querySelector('#up-tariffs').onclick = () => { m.close(); W.go('tariffs'); };
    m.el.querySelector('#up-ok').onclick = () => { m.close(); B.setPlan(plan); B.toast('#w-toasts', `Тариф изменён: <b>${plan}</b>`, 'good'); };
  }
  W.upsell = upsell;

  function renderFilters() {
    const box = $('#w-filters'); if (!box) return;
    const S = B.S();
    const accChips = B.BROKERS.map(br => {
      const accs = B.ACCOUNTS.filter(a => a.broker === br.id);
      return `<div class="fgroup"><button class="fchip broker" data-fb="${br.id}" style="--c:${br.color}">${br.short}</button>${accs.map(a => {
        const off = !S.sync[a.id];
        return `<button class="fchip ${W.filter.accs.has(a.id) && !off ? 'on' : ''} ${off ? 'nosync' : ''}" data-fa="${a.id}" ${off ? 'title="Синхронизация выключена в приложении"' : ''}>${a.name}${off ? ' · нет синхр.' : ''}</button>`;
      }).join('')}</div>`;
    }).join('');
    const clsChips = B.CLS_KEYS.map(k => `<button class="fchip cls ${W.filter.cls.has(k) ? 'on' : ''}" data-fc="${k}" style="--c:${B.CLASS[k].color}">${B.CLASS[k].name}</button>`).join('');
    box.innerHTML = `<div class="frow"><span class="flabel">Брокеры и счета</span><div class="fchips">${accChips}</div></div><div class="frow"><span class="flabel">Классы активов</span><div class="fchips">${clsChips}</div></div><div class="ffoot"><button class="freset" data-freset>Сбросить</button><button class="btn-g sm" data-fclose>Готово</button></div>`;
    const synced = B.ACCOUNTS.filter(a => S.sync[a.id]).length;
    const nAcc = [...W.filter.accs].filter(id => S.sync[id]).length;
    const clsNames = B.CLS_KEYS.filter(k => W.filter.cls.has(k)).map(k => B.CLASS[k].name.toLowerCase());
    const sum = $('#w-fsum'); if (sum) sum.textContent = (nAcc === synced ? 'Все счета' : nAcc + ' из ' + synced + ' счетов') + ' · ' + (clsNames.length === 5 ? 'все активы' : clsNames.length <= 2 ? clsNames.join(', ') : clsNames.slice(0, 2).join(', ') + ' +' + (clsNames.length - 2));
    const fb = $('#w-fbtn'); if (fb) fb.classList.toggle('active', nAcc !== synced || clsNames.length !== 5);
    box.onclick = e => {
      const a = e.target.closest('[data-fa]'), b = e.target.closest('[data-fb]'), c = e.target.closest('[data-fc]'), r = e.target.closest('[data-freset]');
      if (a) { const id = a.dataset.fa; if (!S.sync[id]) { B.toast('#w-toasts', 'Этот счёт не синхронизируется. Включите синхронизацию в приложении, раздел «Счета».', 'warn'); return; } toggleAcc(id); }
      if (b) { const ids = B.ACCOUNTS.filter(x => x.broker === b.dataset.fb && S.sync[x.id]).map(x => x.id); const allOn = ids.every(id => W.filter.accs.has(id)); ids.forEach(id => allOn ? W.filter.accs.delete(id) : W.filter.accs.add(id)); if (!W.filter.accs.size) ids.forEach(id => W.filter.accs.add(id)); }
      if (c) { const k = c.dataset.fc; if (W.filter.cls.has(k)) { if (W.filter.cls.size > 1) W.filter.cls.delete(k); } else W.filter.cls.add(k); }
      if (r) W.resetFilter();
      if (e.target.closest('[data-fclose]')) { box.hidden = true; const fb = $('#w-fbtn'); if (fb) fb.setAttribute('aria-expanded', false); return; }
      if (a || b || c || r) { renderFilters(); updatePortfolio(); }
    };
  }
  function toggleAcc(id) {
    if (W.filter.accs.has(id)) { if (W.filter.accs.size > 1) W.filter.accs.delete(id); else B.toast('#w-toasts', 'Оставьте выбранным хотя бы один счёт', 'warn'); }
    else W.filter.accs.add(id);
  }
  W.refreshFilters = renderFilters;

  function goalHTML(value) {
    const pf = W.pf(); if (!pf.target) return '';
    const p = Math.min(1, value / pf.target);
    return `<div class="st-goal"><div><span>Цель «${B.esc(pf.goal)}»</span><b class="num">${B.rub(value, 0)} из ${B.rub(pf.target, 0)}</b><em class="num">${B.num(p * 100, 1)} %</em></div><i><s style="width:${(p * 100).toFixed(1)}%"></s></i></div>`;
  }
  // риск и доходность по дневным доходностям портфеля без учёта пополнений; бета и альфа – к выбранному бенчмарку
  function updateMetrics(ser, bench) {
    const box = $('#w-metrics'); if (!box) return;
    const k = W.benchKey(), rfY = W.rfOf();
    const head = `<div class="card-head"><h2>Риск и доходность</h2><span class="muted small">годовые · ставка ${B.num(rfY, 1)} %</span></div>`;
    const n = ser.val.length; const r = [], m = [];
    for (let d = 1; d < n; d++) { const pv = ser.val[d - 1]; if (pv > 1) { r.push((ser.val[d] - pv - ser.flow[d]) / pv); m.push(bench ? bench[d] / bench[d - 1] - 1 : 0); } }
    const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
    const mr = mean(r), mm = mean(m);
    const sd = Math.sqrt(mean(r.map(x => (x - mr) ** 2))) || 1e-9;
    const dd = Math.sqrt(mean(r.map(x => Math.min(0, x) ** 2))) || 1e-9;
    const cov = mean(r.map((x, i) => (x - mr) * (m[i] - mm))), vm = mean(m.map(x => (x - mm) ** 2));
    let peak = 0, mdd = 0, acc = 1; r.forEach(x => { acc *= 1 + x; peak = Math.max(peak, acc); mdd = Math.min(mdd, acc / peak - 1); });
    const rf = rfY / 100 / 252;
    const hasB = bench && k !== 'dep' && vm > 1e-12; const beta = hasB ? cov / vm : null;
    const alpha = hasB ? (mr - rf - beta * (mm - rf)) * 252 : null;
    const bn = BENCH[k].n;
    const vals = [['Шарп', B.num((mr - rf) / sd * Math.sqrt(252), 2), 'доходность сверх ставки на единицу риска'], ['Сортино', B.num((mr - rf) / dd * Math.sqrt(252), 2), 'то же, но считает только падения'],
      ['Бета', hasB ? B.num(beta, 2) : '—', hasB ? 'чувствительность к бенчмарку «' + bn + '»' : 'нужен рыночный бенчмарк'], ['Альфа', hasB ? B.pct(alpha, 1) : '—', hasB ? 'доходность сверх ожидаемой при такой бете' : 'нужен рыночный бенчмарк'],
      ['Волатильность', B.num(sd * Math.sqrt(252) * 100, 1) + ' %', 'разброс доходности за год'], ['Макс. просадка', B.num(mdd * 100, 1) + ' %', 'худшее падение от пика']];
    const locked = W.tariff === 'Free';
    box.classList.toggle('locked', locked);
    box.innerHTML = head + `<div class="mx-grid">${vals.map(([kk, v, h]) => `<div class="mx"><span>${kk}</span><b class="num">${locked ? '0,00' : v}</b><small>${B.esc(h)}</small></div>`).join('')}</div>`
      + (locked ? `<div class="lock-over"><b>Метрики риска – в Pro</b><span>Шарп, Сортино, бета, альфа и просадка для каждого портфеля</span><button class="btn-g sm" data-up="Pro">Открыть в Pro</button></div>` : '');
  }

  function periodStart(n, len) { return Math.max(0, len - 1 - n); }

  // бенчмарк – с чем сравнивать портфель; безрисковая ставка – для Шарпа, Сортино и альфы
  const BENCH = { idx: { n: 'ДемоИндекс', s: 'индекс' }, DIDX: { n: 'ДемоИндекс БПИФ', s: 'БПИФ' }, GS29: { n: 'ГосОблигация 2029', s: 'облигация' }, GLDF: { n: 'Фонд Золото', s: 'золото' }, dep: { n: 'Депозит по безрисковой ставке', s: 'депозит' }, none: { n: 'Без бенчмарка', s: '' } };
  W.BENCH = BENCH;
  W.benchKey = pf => (pf || W.pf()).bench || 'idx';
  W.rfOf = pf => { const v = (pf || W.pf()).rf; return v == null ? 16 : v; };
  function benchSeries(ser) {
    const S = B.S(), k = W.benchKey(), n = ser.val.length;
    if (k === 'none') return null;
    if (k === 'idx') return ser.idx;
    if (k === 'dep') { const g = Math.pow(1 + W.rfOf() / 100, 1 / 252); return Array.from({ length: n }, (_, d) => Math.pow(g, d)); }
    const h = S.hist[k]; return Array.from({ length: n }, (_, d) => d < h.length ? h[d].c : S.prices[k]);
  }
  // общий расчёт для портфеля и аналитики
  function calc() {
    const S = B.S();
    if (W.isJ()) ensureJournals();
    const f = W.effFilter();
    if (W.isJ() && !S.ops.some(o => o.acc === jid(W.pf()))) return { empty: true };
    if (!f.accs.size) return { noacc: true };
    const snap = B.snapshot(f), ser = B.series(f), len = ser.val.length;
    const merged = {};
    snap.positions.forEach(p => {
      const m = merged[p.t] || (merged[p.t] = { t: p.t, ins: p.ins, qty: 0, value: 0, dchg: 0, pl: 0, accs: new Set(), price: p.price, prev: p.prev, go: 0 });
      m.qty += p.qty; m.value += p.value; m.dchg += p.dchg; m.pl += p.pl; m.accs.add(B.ACCMAP[p.acc] ? B.BMAP[B.ACCMAP[p.acc].broker].short : 'журнал'); m.go += p.go;
    });
    return { S, f, snap, ser, len, merged, bench: benchSeries(ser), allCls: f.cls.size === 5 };
  }
  const PERIODS = [[21, '1 месяц'], [63, '3 месяца'], [100, '5 месяцев'], [9999, 'Всё время']];

  function updatePortfolio() {
    if (W.screen === 'analytics') return updateAnalytics();
    if (!$('#w-stats')) return;
    const c = calc();
    if (c.empty) { journalEmpty(); return; }
    $$('.w-grid .j-hide').forEach(x => x.classList.remove('j-hide'));
    if (c.noacc) { $('#w-stats').innerHTML = '<p class="empty">Нет данных по выбранным счетам. Включите синхронизацию в приложении.</p>'; return; }
    const { S, f, snap, ser, len, merged, bench, allCls } = c;
    const prevVal = ser.val[len - 2];
    const dayChg = snap.value - prevVal - ser.flow[len - 1];
    const dayPct = dayChg / prevVal;
    const profit = snap.value - snap.dep;
    const twrAll = B.twr(ser, 0); const twr = twrAll[twrAll.length - 1];
    const benchR = bench ? bench[len - 1] / bench[0] - 1 : null;
    const freeCash = snap.cls.cash;
    $('#w-stats').innerHTML = `
      <div class="st-main">
        <span class="eyebrow">Стоимость портфеля</span>
        <div class="st-value num">${B.rub(snap.value, 2)}</div>
        <div class="st-chg ${B.cls(dayChg)} num">${B.srub(dayChg, 2)} <span>${B.pct(dayPct)}</span> <em>за сегодня</em></div>
      </div>
      <div class="st-grid">
        <div class="st"><span>Прибыль за всё время</span><b class="num ${B.cls(profit)}">${allCls ? B.srub(profit, 0) : '—'}</b><small>вложено ${B.rub(snap.dep, 0)}</small></div>
        <div class="st"><span>Доходность</span><b class="num ${B.cls(twr)}">${B.pct(twr, 1)}</b><small>${bench ? BENCH[W.benchKey()].s + ' ' + B.pct(benchR, 1) : 'за всё время'}</small></div>
        <div class="st"><span>Свободные деньги</span><b class="num ${freeCash < 0 ? 'down' : ''}">${B.rub(freeCash, 0)}</b><small>${B.num(freeCash / snap.value * 100, 1)} % портфеля</small></div>
      </div>${goalHTML(snap.value)}`;
    updateJournal();

    // позиции
    $$('#w-postabs button').forEach(b => b.classList.toggle('on', b.dataset.pt === W.posTab));
    let list = Object.values(merged);
    if (W.posTab === 'up') list = list.filter(p => p.price >= p.prev);
    if (W.posTab === 'down') list = list.filter(p => p.price < p.prev);
    const groups = ['stock', 'bond', 'fund', 'fut'].map(k => ({ k, items: list.filter(p => p.ins.type === k).sort((a, b) => b.value - a.value) })).filter(g => g.items.length);
    $('#w-pos').innerHTML = groups.length ? groups.map(g => `
      <div class="pgroup"><div class="pgroup-h"><span>${B.CLASS[g.k].name}</span><b class="num">${g.k === 'fut' ? '<em class="' + B.cls(snap.vm) + '">вар. маржа ' + B.srub(snap.vm, 0) + '</em> · ГО ' : ''}${B.rub(g.items.reduce((s, x) => s + x.value, 0), 0)}</b></div>
      ${g.items.map(p => {
        const dp = (p.price - p.prev) / p.prev; const tone = dp > 0.0005 ? 'up' : dp < -0.0005 ? 'down' : 'flat';
        const fut = p.ins.type === 'fut';
        return `<button class="pcard ${tone}" data-asset="${p.t}">
          <i class="pdot" style="background:${p.ins.color}"></i>
          <span class="pname"><b>${B.esc(p.ins.n)}</b><small>${p.t} · ${fut ? (p.qty > 0 ? 'лонг ' : 'шорт ') + Math.abs(p.qty) + ' контр.' : B.num(p.qty) + ' шт.'} · ${[...p.accs].join(', ')}</small></span>
          <span class="pval"><b class="num">${fut ? 'ГО ' + B.rub(p.go, 0) : B.rub(p.value, 0)}</b><small class="num ${tone}">${B.srub(p.dchg, 0)} ${B.pct(dp)}</small></span>
        </button>`;
      }).join('')}</div>`).join('') : '<p class="empty">Нет бумаг по выбранным фильтрам</p>';

    // переход в аналитику: короткая выжимка
    const tt = B.twr(ser, periodStart(63, len)); const r3 = tt[tt.length - 1];
    const b3 = bench ? bench[len - 1] / bench[periodStart(63, len)] - 1 : null;
    const segs = B.CLS_KEYS.filter(k => f.cls.has(k)).map(k => ({ k, v: Math.max(0, snap.cls[k]) })); const st = segs.reduce((s, x) => s + x.v, 0) || 1;
    $('#w-anacard').innerHTML = `<div class="card-head"><h2>Аналитика</h2><button class="link" data-goana>Открыть →</button></div>
      <div class="at-row"><span>За 3 месяца</span><b class="num ${B.cls(r3)}">${B.pct(r3, 1)}</b>${bench ? `<small class="num">${BENCH[W.benchKey()].s} ${B.pct(b3, 1)}</small>` : ''}</div>
      <div class="at-bar">${segs.map(x => `<i style="width:${(x.v / st * 100).toFixed(1)}%;background:${B.CLASS[x.k].color}" title="${B.CLASS[x.k].name}"></i>`).join('')}</div>
      <p class="muted small">График, структура, риск, сравнение с бенчмарком и выплаты – на настраиваемом дашборде.</p>`;

    // подсказки
    const hints = [];
    const offSync = B.ACCOUNTS.filter(a => !S.sync[a.id]);
    offSync.forEach(a => hints.push({ lvl: 'warn', t: 'Счёт ' + B.accLabel(a.id) + ' не синхронизируется', d: 'Данные с него не попадают на сайт. Ключ по-прежнему хранится только на вашем ПК.', a: 'sync', al: 'Открыть приложение' }));
    const cashShare = snap.cls.cash / snap.value;
    if (allCls && cashShare > 0.1 && !W.isJ()) hints.push({ lvl: 'info', t: 'Свободные деньги – ' + B.num(cashShare * 100, 0) + ' % портфеля', d: 'Их можно распределить по целевой структуре в один клик.', a: 'rebalance', al: 'Ребалансировка' });
    const inc = S.ops.filter(o => o.k === 'inc' && f.accs.has(o.acc)).slice(-1)[0];
    if (inc) hints.push({ lvl: 'good', t: (inc.sub === 'coupon' ? 'Купон' : 'Дивиденды') + ' ' + B.srub(inc.amt, 2), d: B.IMAP[inc.t].n + ' · ' + B.accLabel(inc.acc) + ' · ' + B.dateShort(inc.day), a: 'asset:' + inc.t, al: 'К бумаге' });
    if (snap.positions.some(p => p.ins.type === 'fut')) hints.push({ lvl: 'info', t: 'Экспирация фьючерсов 17.12.2026', d: 'Позиции на срочном рынке нужно закрыть или перенести на следующий контракт.' });
    const held = new Set(snap.positions.map(p => p.t));
    const nn = S.news.find(n => n.t && held.has(n.t));
    if (nn) hints.push({ lvl: nn.dir > 0 ? 'good' : 'bad', t: 'Новость по вашей бумаге', d: nn.text, a: 'news:' + B.newsKey(nn), al: 'Читать' });
    $('#w-hints').innerHTML = `<div class="card-head"><h2>Подсказки</h2><span class="count">${hints.length}</span></div>` +
      (hints.length ? hints.slice(0, 2).map(h => `<div class="hint ${h.lvl}"><b>${B.esc(h.t)}</b><p>${B.esc(h.d)}</p>${h.a ? `<button class="link" data-hint="${h.a}">${h.al} →</button>` : ''}</div>`).join('') : '<p class="empty">Всё в порядке</p>');

    // лента операций
    const ops = S.ops.filter(o => f.accs.has(o.acc)).slice(-5).reverse();
    $('#w-feed').innerHTML = `<div class="card-head"><h2>Последние операции</h2></div><ul class="feed">${ops.map(o => {
      let title, amt, cls = '';
      if (o.k === 'dep') { title = 'Пополнение'; amt = B.srub(o.amt, 0); cls = 'up'; }
      else if (o.k === 'wd') { title = 'Вывод'; amt = B.srub(-o.amt, 0); }
      else if (o.k === 'fee') { title = 'Комиссия, налог'; amt = B.srub(-o.amt, 2); }
      else if (o.k === 'inc') { title = (o.sub === 'coupon' ? 'Купон · ' : 'Дивиденды · ') + B.IMAP[o.t].n; amt = B.srub(o.amt, 2); cls = 'up'; }
      else { const ins = B.IMAP[o.t]; const buy = o.qty > 0; title = (buy ? 'Покупка · ' : 'Продажа · ') + ins.n; amt = (ins.type === 'fut' ? B.num(Math.abs(o.qty)) + ' контр. × ' : B.num(Math.abs(o.qty)) + ' шт. × ') + B.px(o.t, o.price); }
      const src = o.j ? '<span class="src">журнал</span>' : o.src === 'manual' ? '<span class="src app">из приложения</span>' : o.src === 'rebalance' ? '<span class="src app">ребалансировка</span>' : o.src === 'import' ? '<span class="src app">новый брокер</span>' : '<span class="src">брокер</span>';
      return `<li class="${o.fresh ? 'fresh' : ''}"><span class="fd">${B.dateShort(o.day)}<br>${B.timeOf(Math.min(o.tick, B.TPD))}</span><span class="ft"><b>${B.esc(title)}</b><small>${B.accLabel(o.acc)} ${src}</small></span><span class="fa num ${cls}">${amt}</span></li>`;
    }).join('')}</ul>`;
    updateRebalance(false);
  }

  /* ================= АНАЛИТИКА: настраиваемый дашборд ================= */
  const WIDGETS = { chart: 'График портфеля', bench: 'Сравнение с бенчмарком', metrics: 'Риск и доходность', struct: 'Структура', movers: 'Лидеры и аутсайдеры', income: 'Дивиденды и купоны', goal: 'Цель портфеля' };
  const DASH_DEF = [{ id: 'chart', size: 'full' }, { id: 'bench', size: 'half' }, { id: 'metrics', size: 'half' }, { id: 'struct', size: 'half' }, { id: 'movers', size: 'half' }, { id: 'income', size: 'half' }, { id: 'goal', size: 'half' }];
  const DASH_KEY = 'brokED-dash-v1';
  function loadDash() {
    try {
      const v = JSON.parse(localStorage.getItem(DASH_KEY));
      if (Array.isArray(v) && v.length && v.every(x => x && WIDGETS[x.id])) { DASH_DEF.forEach(d => { if (!v.some(x => x.id === d.id)) v.push(Object.assign({}, d, { hidden: true })); }); return v; }
    } catch (e) { /* хранилище недоступно – берём раскладку по умолчанию */ }
    return DASH_DEF.map(x => Object.assign({}, x));
  }
  function saveDash() { try { localStorage.setItem(DASH_KEY, JSON.stringify(W.dash)); } catch (e) { /* не страшно */ } }
  W.dash = loadDash(); W.dashEdit = false;

  function filterBtn() {
    return `<div class="fwrap"><button class="fbtn" id="w-fbtn" aria-expanded="false" aria-controls="w-filters"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M4 5h16l-6 7v6l-4 2v-8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg><span id="w-fsum"></span><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg></button>
            <div class="fpop" id="w-filters" hidden></div></div>`;
  }
  function renderAnalytics(v) {
    v.innerHTML = `
      <div class="w-bar">
        <div class="w-title"><h1>Аналитика</h1>${filterBtn()}</div>
        <div class="w-actions"><button class="btn-t" id="dash-edit" aria-pressed="false"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>Настроить дашборд</button></div>
      </div>
      <div class="pf-tabs" id="w-pfs"></div>
      <div class="dash-bar" id="dash-bar" hidden></div>
      <div id="w-dash-msg" hidden></div>
      <div class="dash" id="w-dash"></div>`;
    bindPfTabs();
    const root = v;
    root.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('#dash-edit') || t.closest('[data-ddone]')) { W.dashEdit = !W.dashEdit; drawDash(); return; }
      const mv = t.closest('[data-dmv]'); if (mv) { moveW(mv.closest('[data-w]').dataset.w, +mv.dataset.dmv); return; }
      const sz = t.closest('[data-dsz]'); if (sz) { const w = W.dash.find(x => x.id === sz.closest('[data-w]').dataset.w); w.size = w.size === 'full' ? 'half' : 'full'; saveDash(); drawDash(); return; }
      const hd = t.closest('[data-dhide]'); if (hd) { W.dash.find(x => x.id === hd.closest('[data-w]').dataset.w).hidden = true; saveDash(); drawDash(); return; }
      const sh = t.closest('[data-dshow]'); if (sh) { const w = W.dash.find(x => x.id === sh.dataset.dshow); w.hidden = false; W.dash = W.dash.filter(x => x !== w).concat(w); saveDash(); drawDash(); return; }
      if (t.closest('[data-dreset]')) { W.dash = DASH_DEF.map(x => Object.assign({}, x)); saveDash(); drawDash(); return; }
      const m = t.closest('[data-mode]'); if (m) { W.mode = m.dataset.mode; updateAnalytics(); return; }
      const p = t.closest('[data-period]'); if (p) { W.period = +p.dataset.period; updateAnalytics(); return; }
      const s = t.closest('[data-st]'); if (s) { W.struct = s.dataset.st; updateAnalytics(); return; }
      const u = t.closest('[data-up]'); if (u) { upsell(u.dataset.up); return; }
      const a = t.closest('[data-asset]'); if (a) { assetModal(a.dataset.asset); return; }
      const gp = t.closest('.gl-item[data-pf]'); if (gp) { selectPf(gp.dataset.pf); return; }
      if (t.closest('[data-goedit]')) { pfModal(W.pf()); return; }
      if (t.closest('[data-goport]')) { W.go('portfolio'); return; }
    });
    root.addEventListener('change', e => { const s = e.target.closest('[data-bsel]'); if (s) { W.pf().bench = s.value; updateAnalytics(); } });
    // перетаскивание виджетов в режиме настройки
    let drag = null;
    root.addEventListener('dragstart', e => { const w = e.target.closest('.dw'); if (!w || !W.dashEdit) return; drag = w.dataset.w; w.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', drag); } catch (x) { /* старые браузеры */ } });
    root.addEventListener('dragend', () => { drag = null; $$('.dw.dragging, .dw.drop-before, .dw.drop-after').forEach(x => x.classList.remove('dragging', 'drop-before', 'drop-after')); });
    root.addEventListener('dragover', e => {
      const w = e.target.closest('.dw'); if (!drag || !w || w.dataset.w === drag) return; e.preventDefault();
      const r = w.getBoundingClientRect(); const after = (e.clientY - r.top) > r.height / 2 || (r.height < 220 && (e.clientX - r.left) > r.width / 2);
      $$('.dw.drop-before, .dw.drop-after').forEach(x => x.classList.remove('drop-before', 'drop-after'));
      w.classList.add(after ? 'drop-after' : 'drop-before');
    });
    root.addEventListener('drop', e => {
      const w = e.target.closest('.dw'); if (!drag || !w) return; e.preventDefault();
      const after = w.classList.contains('drop-after'); const src = W.dash.find(x => x.id === drag);
      W.dash = W.dash.filter(x => x !== src); const i = W.dash.findIndex(x => x.id === w.dataset.w);
      W.dash.splice(after ? i + 1 : i, 0, src); drag = null; saveDash(); drawDash();
    });
    renderPfTabs();
    renderFilters();
    pfMode();
    drawDash();
  }
  function moveW(id, dir) {
    const vis = W.dash.filter(x => !x.hidden); const i = vis.findIndex(x => x.id === id), j = i + dir;
    if (j < 0 || j >= vis.length) return;
    const a = W.dash.indexOf(vis[i]), b = W.dash.indexOf(vis[j]);
    [W.dash[a], W.dash[b]] = [W.dash[b], W.dash[a]]; saveDash(); drawDash();
  }
  function widgetBody(id) {
    if (id === 'chart') return `<section class="card chart-card" id="w-chartcard">
            <div class="card-head">
              <h2>График портфеля</h2>
              <div class="seg" role="tablist" aria-label="Режим графика">
                <button data-mode="value" role="tab">Стоимость</button><button data-mode="dyn" role="tab">Доходность</button>
              </div>
            </div>
            <div class="legend" id="w-legend"></div>
            <div class="chart-wrap"><canvas id="w-chart" aria-label="График стоимости портфеля"></canvas><div class="chart-tip" id="w-tip" hidden></div></div>
            <div class="periods" id="w-periods"></div>
          </section>`;
    if (id === 'bench') return `<section class="card" id="w-bench"><div class="card-head"><h2>Сравнение с бенчмарком</h2><select class="bsel" data-bsel aria-label="Бенчмарк"></select></div><div class="bn-body"></div></section>`;
    return `<section class="card" id="w-${id}"></section>`;
  }
  function drawDash() {
    const box = $('#w-dash'); if (!box) return;
    const ed = W.dashEdit; const vis = W.dash.filter(x => !x.hidden), hid = W.dash.filter(x => x.hidden);
    const eb = $('#dash-edit'); if (eb) { eb.classList.toggle('on', ed); eb.setAttribute('aria-pressed', ed); eb.lastChild.textContent = ed ? 'Готово' : 'Настроить дашборд'; }
    box.classList.toggle('editing', ed);
    const bar = $('#dash-bar'); bar.hidden = !ed;
    bar.innerHTML = `<div class="db-l"><b>Настройка дашборда</b><span class="muted small">Перетащите виджет за заголовок или двигайте стрелками. Ширину и видимость меняют кнопки на виджете.</span></div>
      <div class="db-hidden">${hid.length ? '<span class="muted small">Скрытые:</span>' + hid.map(w => `<button class="fchip" data-dshow="${w.id}">+ ${WIDGETS[w.id]}</button>`).join('') : '<span class="muted small">Все виджеты на экране</span>'}</div>
      <div class="db-r"><button class="link" data-dreset>Сбросить</button><button class="btn-g sm" data-ddone>Готово</button></div>`;
    box.innerHTML = vis.map((w, i) => `<div class="dw ${w.size}" data-w="${w.id}" ${ed ? 'draggable="true"' : ''}>
      ${ed ? `<div class="dw-tools"><span class="dw-grip" aria-hidden="true">⠿</span><span class="dw-name">${WIDGETS[w.id]}</span>
        <button data-dmv="-1" ${i === 0 ? 'disabled' : ''} aria-label="Выше" title="Выше">↑</button><button data-dmv="1" ${i === vis.length - 1 ? 'disabled' : ''} aria-label="Ниже" title="Ниже">↓</button>
        <button data-dsz title="Ширина">${w.size === 'full' ? 'Половина' : 'Во всю ширину'}</button><button data-dhide aria-label="Скрыть виджет" title="Скрыть">✕</button></div>` : ''}
      ${widgetBody(w.id)}</div>`).join('') || `<div class="card empty-dash"><p>На дашборде нет виджетов.</p><button class="btn-g sm" data-dreset>Вернуть виджеты по умолчанию</button></div>`;
    W.chart = $('#w-chart') ? new B.LineChart($('#w-chart'), $('#w-tip')) : null;
    updateAnalytics();
  }
  W.drawDash = drawDash;

  function updateAnalytics() {
    const box = $('#w-dash'); if (!box) return;
    const c = calc(); const msg = $('#w-dash-msg');
    if (c.empty || c.noacc) {
      msg.hidden = false; box.hidden = true;
      msg.innerHTML = c.empty ? `<div class="card j-empty"><b>В журнале «${B.esc(W.pf().name)}» пока нет операций</b><p class="muted">Аналитика появится после первой сделки или пополнения.</p><div class="j-empty-act"><button class="btn-g" data-goport>Перейти к журналу</button></div></div>` : '<div class="card"><p class="empty">Нет данных по выбранным счетам. Включите синхронизацию в приложении.</p></div>';
      return;
    }
    msg.hidden = true; box.hidden = false;
    W.dash.filter(x => !x.hidden).forEach(w => WUPD[w.id](c));
  }
  const WUPD = {
    chart(c) {
      if (!W.chart) return;
      const { ser, len, bench, allCls } = c;
      const from = periodStart(W.period, len);
      const labels = []; for (let d = from; d < len; d++) labels.push(B.dateShort(d));
      $$('#w-chartcard [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === W.mode));
      let series;
      if (W.mode === 'value') {
        series = [
          { name: 'Стоимость', data: Array.from(ser.val.slice(from)), color: '#A24DF0', fill: 'rgba(162,77,240,0.32)', width: 2.2 },
          { name: 'Вложено', data: Array.from(ser.inv.slice(from)), color: '#77737F', dash: true, width: 1.4 },
        ];
        if (!allCls) series.pop();
        W.chart.set({ labels, series, yfmt: (v, full) => full ? B.rub(v, 0) : B.compact(v) });
      } else {
        const t = B.twr(ser, from);
        series = [{ name: 'Портфель', data: Array.from(t), color: '#A24DF0', width: 2.2 }];
        if (bench) { const b0 = bench[from]; series.push({ name: BENCH[W.benchKey()].n, data: Array.from(bench.slice(from)).map(x => x / b0 - 1), color: '#50F08C', width: 1.6 }); }
        W.chart.set({ labels, series, zero: true, yfmt: v => B.pct(v, 1) });
      }
      $('#w-legend').innerHTML = series.map(s => `<span><i style="background:${s.color};${s.dash ? 'border-top:2px dashed ' + s.color + ';background:none;height:0' : ''}"></i>${B.esc(s.name)}</span>`).join('') + (W.mode === 'value' ? (allCls ? '<span class="leg-note">пунктир – сумма пополнений</span>' : '') : '<span class="leg-note">без учёта пополнений</span>');
      $('#w-periods').innerHTML = PERIODS.map(([n, l]) => {
        const fr = periodStart(n, len); const tt = B.twr(ser, fr); const r = tt[tt.length - 1];
        return `<button data-period="${n}" class="${W.period === n ? 'on' : ''}"><span>${l}</span><b class="num ${B.cls(r)}">${B.pct(r, 1)}</b></button>`;
      }).join('');
    },
    bench(c) {
      const box = $('#w-bench'); if (!box) return;
      const k = W.benchKey(); const sel = box.querySelector('[data-bsel]');
      if (sel.dataset.k !== k) { sel.dataset.k = k; sel.innerHTML = Object.entries(BENCH).map(([kk, b]) => `<option value="${kk}" ${kk === k ? 'selected' : ''}>${b.n}</option>`).join(''); }
      const { ser, len, bench } = c;
      const rows = PERIODS.map(([n, l]) => {
        const fr = periodStart(n, len); const tt = B.twr(ser, fr); const r = tt[tt.length - 1];
        const b = bench ? bench[len - 1] / bench[fr] - 1 : null;
        return `<tr><td>${l}</td><td class="r num ${B.cls(r)}">${B.pct(r, 1)}</td>${bench ? `<td class="r num ${B.cls(b)}">${B.pct(b, 1)}</td><td class="r num ${B.cls(r - b)}"><b>${(r - b >= 0 ? '+' : '−') + B.num(Math.abs(r - b) * 100, 1)} п.п.</b></td>` : ''}</tr>`;
      }).join('');
      box.querySelector('.bn-body').innerHTML = `<div class="table-scroll"><table class="bn-table"><thead><tr><th>Период</th><th class="r">Портфель</th>${bench ? '<th class="r">Бенчмарк</th><th class="r">Разница</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>
        <p class="muted small">${bench ? 'Разница в процентных пунктах: плюс – портфель обгоняет бенчмарк. ' : 'Выберите бенчмарк, чтобы сравнить портфель с рынком. '}Безрисковая ставка ${B.num(W.rfOf(), 1)} % годовых${W.pfId === 'all' ? '' : ' – меняется в настройках портфеля'}.</p>`;
    },
    metrics(c) { updateMetrics(c.ser, c.bench); },
    struct(c) { updateStruct(c); },
    movers(c) {
      const box = $('#w-movers'); if (!box) return;
      const list = Object.values(c.merged).filter(p => p.ins.type !== 'fut' && p.value - p.pl > 1).map(p => Object.assign({}, p, { r: p.pl / (p.value - p.pl) })).sort((a, b) => b.r - a.r);
      const row = p => `<button class="mv-row" data-asset="${p.t}"><i class="pdot" style="background:${p.ins.color}"></i><span><b>${B.esc(p.ins.n)}</b><small>${p.t} · ${B.rub(p.value, 0)}</small></span><em class="num ${B.cls(p.r)}">${B.pct(p.r, 1)}<small>${B.srub(p.pl, 0)}</small></em></button>`;
      const n = Math.min(3, Math.floor(list.length / 2)) || Math.min(1, list.length);
      box.innerHTML = `<div class="card-head"><h2>Лидеры и аутсайдеры</h2><span class="muted small">прибыль с покупки</span></div>` + (list.length < 2 ? '<p class="empty">Нужно хотя бы две бумаги</p>'
        : `<div class="mv-cols"><div><h4>Лучшие</h4>${list.slice(0, n).map(row).join('')}</div><div><h4>Отстающие</h4>${list.slice(-n).reverse().map(row).join('')}</div></div>`);
    },
    income(c) {
      const box = $('#w-income'); if (!box) return;
      const { S, f, snap } = c; const MON = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
      const iso = B.isoOf(S.day); let y = +iso.slice(0, 4), mo = +iso.slice(5, 7);
      const months = []; for (let i = 0; i < 6; i++) { months.unshift({ key: y + '-' + String(mo).padStart(2, '0'), name: MON[mo - 1], div: 0, cpn: 0 }); if (--mo === 0) { mo = 12; y--; } }
      const ops = S.ops.filter(o => o.k === 'inc' && f.accs.has(o.acc));
      ops.forEach(o => { const m = months.find(x => x.key === B.isoOf(o.day).slice(0, 7)); if (m) m[o.sub === 'coupon' ? 'cpn' : 'div'] += o.amt; });
      const total = months.reduce((s, m) => s + m.div + m.cpn, 0), max = Math.max(1, ...months.map(m => m.div + m.cpn));
      box.innerHTML = `<div class="card-head"><h2>Дивиденды и купоны</h2><span class="num inc-tot">${B.rub(total, 0)}<small>за 6 месяцев</small></span></div>
        <div class="inc-bars">${months.map(m => `<div class="ib" title="${m.name}: ${B.rub(m.div + m.cpn, 0)}"><span class="ib-v num">${m.div + m.cpn ? B.compact(m.div + m.cpn) : ''}</span><div class="ib-col"><i class="cpn" style="height:${(m.cpn / max * 100).toFixed(1)}%"></i><i class="div" style="height:${(m.div / max * 100).toFixed(1)}%"></i></div><small>${m.name}</small></div>`).join('')}</div>
        <div class="legend"><span><i style="background:#A24DF0"></i>Дивиденды</span><span><i style="background:#86EFAC"></i>Купоны</span><span class="leg-note">≈ ${B.num(total * 2 / snap.value * 100, 1)} % стоимости в год</span></div>`;
    },
    goal(c) {
      const box = $('#w-goal'); if (!box) return;
      const pf = W.pf(); const v = c.snap.value;
      if (W.pfId === 'all') {
        // на «Весь капитал» – сводка целей по всем портфелям
        const goals = W.pfs.filter(x => x.id !== 'all' && x.target).map(x => ({ pf: x, v: pfValue(x) }));
        box.innerHTML = `<div class="card-head"><h2>Цели портфелей</h2></div>` + (goals.length ? `<div class="gl-list">${goals.map(g => { const q = Math.min(1, g.v / g.pf.target); return `<button class="gl-item" data-pf="${g.pf.id}"><span><b>${B.esc(g.pf.name)}</b><small>${B.esc(g.pf.goal)} · ${B.rub(g.v, 0)} из ${B.rub(g.pf.target, 0)}</small></span><em class="num">${B.num(q * 100, 0)} %</em><i><s style="width:${(q * 100).toFixed(1)}%"></s></i></button>`; }).join('')}</div><p class="muted small">Цель задаётся в настройках каждого портфеля.</p>` : '<p class="muted">Ни у одного портфеля пока нет цели. Выберите портфель во вкладках выше и задайте её в настройках.</p>');
        return;
      }
      if (!pf.target) { box.innerHTML = `<div class="card-head"><h2>Цель портфеля</h2></div><p class="muted">Для этого портфеля цель не задана.</p><button class="btn-t sm" data-goedit>Задать цель</button>`; return; }
      const p = Math.min(1, v / pf.target); const twr = B.twr(c.ser, 0); const tr = twr[twr.length - 1];
      const g = Math.pow(1 + tr, 252 / Math.max(20, c.len - 1)) - 1; const left = pf.target - v;
      const months = left > 0 && g > 0.001 ? Math.ceil(Math.log(pf.target / v) / Math.log(1 + g) * 12) : null;
      box.innerHTML = `<div class="card-head"><h2>Цель «${B.esc(pf.goal)}»</h2><button class="link" data-goedit>Изменить</button></div>
        <div class="gl-ring">${B.donut([{ label: 'Выполнено', v: p, color: '#50F08C' }, { label: 'Осталось', v: 1 - p, color: '#2E2C33' }], 132, 14, [B.num(p * 100, 0) + ' %', 'выполнено'])}
        <div class="gl-txt"><div><span>Сейчас</span><b class="num">${B.rub(v, 0)}</b></div><div><span>Цель</span><b class="num">${B.rub(pf.target, 0)}</b></div><div><span>Осталось</span><b class="num">${left > 0 ? B.rub(left, 0) : 'цель достигнута'}</b></div></div></div>
        <p class="muted small">${left <= 0 ? 'Можно поставить новую цель.' : months ? `Если доходность останется как сейчас (${B.pct(g, 1)} годовых), цель будет достигнута примерно через ${months} ${B.plural(months, 'месяц', 'месяца', 'месяцев')}. Это оценка, а не прогноз.` : 'При текущей доходности срок оценить нельзя: пополнения ускорят путь к цели.'}</p>`;
    },
  };

  function pfValue(pf) {
    if (W.isJ(pf)) { ensureJournals(); return B.snapshot({ accs: new Set([jid(pf)]), cls: new Set(B.CLS_KEYS) }).value; }
    const S = B.S(); const accs = (pf.accs || B.syncedAccs()).filter(id => S.sync[id]);
    return accs.length ? B.snapshot({ accs: new Set(accs), cls: new Set(pf.cls || B.CLS_KEYS) }).value : 0;
  }
  function updateStruct(c) {
    const box = $('#w-struct'); if (!box) return;
    const { f, snap, merged } = c;
    const tabs = [['type', 'Классы'], ['asset', 'Активы'], ['broker', 'Брокеры'], ['sector', 'Секторы']];
    let segs = [];
    if (W.struct === 'type') segs = B.CLS_KEYS.filter(k => f.cls.has(k)).map(k => ({ label: B.CLASS[k].name, v: snap.cls[k], color: B.CLASS[k].color })).filter(s => Math.abs(s.v) > 0.5);
    if (W.struct === 'asset') {
      segs = Object.values(merged).map(p => ({ label: p.ins.n, v: p.value, color: p.ins.color })).sort((a, b) => b.v - a.v);
      if (f.cls.has('cash')) segs.push({ label: 'Деньги', v: snap.cls.cash, color: B.CLASS.cash.color });
      const tot = segs.reduce((s, x) => s + x.v, 0); const small = segs.filter(s => s.v / tot < 0.03);
      if (small.length > 1) { segs = segs.filter(s => s.v / tot >= 0.03); segs.push({ label: 'Прочее', v: small.reduce((s, x) => s + x.v, 0), color: '#4A4752' }); }
    }
    if (W.struct === 'broker') segs = B.BROKERS.map(br => { let v = 0; f.accs.forEach(id => { if (!B.ACCMAP[id] || B.ACCMAP[id].broker !== br.id) return; const s1 = B.snapshot({ accs: new Set([id]), cls: f.cls }); v += s1.value; }); return { label: br.name, v, color: br.color }; }).filter(s => s.v > 0);
    if (W.struct === 'broker' && W.isJ()) segs = [{ label: 'Журнал (без брокера)', v: snap.value, color: '#A24DF0' }];
    if (W.struct === 'sector') {
      const m = {}; snap.positions.forEach(p => { m[p.ins.sector] = (m[p.ins.sector] || 0) + p.value; });
      const pal = ['#A24DF0', '#50F08C', '#5EA8FF', '#F7B84B', '#F472B6', '#2DD4BF', '#FB923C', '#C4B5FD', '#86EFAC', '#FCD34D', '#94A3B8'];
      segs = Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v], i) => ({ label: k, v, color: pal[i % pal.length] }));
    }
    const tot = segs.reduce((s, x) => s + x.v, 0) || 1;
    box.innerHTML = `
      <div class="card-head"><h2>Структура</h2></div>
      <div class="seg small st-tabs">${tabs.map(([k, l]) => `<button data-st="${k}" class="${W.struct === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="struct">${B.donut(segs, 200, 26, [B.compact(tot), W.struct === 'asset' ? Object.keys(merged).length + ' бумаг' : 'итого, ₽'])}
        <ul class="slist">${segs.map(s => `<li><i style="background:${s.color}"></i><span>${B.esc(s.label)}</span><b class="num">${B.num(s.v / tot * 100, 1)}%</b></li>`).join('')}</ul>
      </div>`;
  }
  /* ---------- модалки ---------- */
  function depositModal() {
    const S = B.S();
    const accs = B.ACCOUNTS.filter(a => S.sync[a.id]);
    const m = B.modal(`<h3>Внести депозит</h3><p class="muted">В реальном продукте пополнение приходит от брокера автоматически. В демо можно пополнить счёт вручную.</p>
      <label class="fld"><span>Счёт</span><select id="dep-acc">${accs.map(a => `<option value="${a.id}">${B.accLabel(a.id)} ${a.num}</option>`).join('')}</select></label>
      <label class="fld"><span>Сумма, ₽</span><input id="dep-amt" type="number" min="1000" step="1000" value="100000" inputmode="numeric"></label>
      <div class="err" id="dep-err" hidden></div>
      <div class="m-actions"><button class="btn-g" id="dep-ok">Пополнить</button></div>`, { host: $('#web-frame') });
    m.el.querySelector('#dep-ok').onclick = () => {
      const amt = +m.el.querySelector('#dep-amt').value;
      if (!(amt >= 1000 && amt <= 10000000)) { const e = m.el.querySelector('#dep-err'); e.hidden = false; e.textContent = 'Введите сумму от 1 000 до 10 000 000 ₽'; return; }
      B.deposit(m.el.querySelector('#dep-acc').value, amt); m.close();
      B.toast('#w-toasts', 'Счёт пополнен на ' + B.rub(amt, 0), 'good');
    };
  }

  function assetModal(t) {
    const S = B.S(); const ins = B.IMAP[t];
    const pos = B.ACCOUNTS.map(a => ({ a, p: S.acc[a.id].pos[t] })).filter(x => x.p);
    const metrics = ins.type === 'stock' ? [['Сектор', ins.sector], ['P/E', B.num(ins.pe, 1)], ['Див. доходность', B.num(ins.dy, 1) + ' %'], ['Лот', ins.lot + ' шт.']]
      : ins.type === 'bond' ? [['Тип', ins.sector], ['Купон', B.num(ins.coupon, 1) + ' % годовых'], ['Погашение', ins.mat], ['Номинал', '1 000 ₽']]
        : ins.type === 'fund' ? [['Тип', 'БПИФ'], ['Комиссия фонда', ins.ter], ['Лот', '1 пай'], ['Базовый актив', ins.t === 'DIDX' ? 'ДемоИндекс' : 'Золото']]
          : [['Базовый актив', ins.under], ['Экспирация', ins.exp], ['ГО на контракт', B.rub(B.quote(t).last * ins.mult * ins.go, 0)], ['Множитель', '×' + ins.mult]];
    const m = B.modal(`
      <div class="am-head"><i class="pdot big" style="background:${ins.color}"></i><div><h3>${B.esc(ins.n)}</h3><span class="muted">${t} · ${B.CLASS[ins.type].name} · Демо-биржа</span></div>
        <div class="am-price"><b class="num" id="am-px"></b><span class="num" id="am-chg"></span></div></div>
      <div class="chart-wrap small"><canvas id="am-chart"></canvas><div class="chart-tip" id="am-tip" hidden></div></div>
      <div class="am-metrics">${metrics.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>
      <div class="am-cols">
        <div><h4>Мои позиции</h4>${pos.length ? pos.map(x => `<div class="am-row"><span>${B.accLabel(x.a.id)}</span><b class="num">${ins.type === 'fut' ? x.p.qty + ' контр.' : B.num(x.p.qty) + ' шт.'}</b></div>`).join('') : '<p class="muted">Бумаги нет в портфеле</p>'}</div>
        <div><h4>Где купить</h4>${B.BROKERS.map(br => {
          const ok = ins.type === 'fut' ? br.caps.fut : true;
          return `<div class="am-row ${ok ? '' : 'off'}"><span><i class="bdot" style="background:${br.color}"></i>${br.name}</span><b>${ok ? 'комиссия ' + (ins.type === 'fut' ? '2 ₽/контр.' : br.feeText) : 'нет срочного счёта'}</b></div>`;
        }).join('')}</div>
      </div>
      <div class="m-actions"><span class="muted small">Торговля доступна в приложении для ПК</span><button class="btn-g" id="am-buy">Купить в приложении</button></div>`, { host: $('#web-frame'), cls: 'wide' });
    const ch = new B.LineChart(m.el.querySelector('#am-chart'), m.el.querySelector('#am-tip'));
    const draw = () => {
      if (!m.el.isConnected) return;
      const S2 = B.S(); const n = Math.min(90, S2.day);
      const data = S2.hist[t].slice(-n).map(c => c.c); data.push(S2.prices[t]);
      const labels = []; for (let d = S2.day - n; d <= S2.day; d++) labels.push(B.dateShort(d));
      const up = data[data.length - 1] >= data[0];
      ch.set({ labels, series: [{ name: 'Цена', data, color: up ? '#50F08C' : '#FF5A6E', fill: up ? 'rgba(80,240,140,0.18)' : 'rgba(255,90,110,0.18)' }], yfmt: v => B.px(t, v), padL: 64 });
      const px = S2.prices[t], prev = B.prevClose(t);
      m.el.querySelector('#am-px').textContent = B.px(t, px) + (ins.type === 'fut' ? ' пт' : ' ₽');
      const c = m.el.querySelector('#am-chg'); c.className = 'num ' + B.cls(px - prev); c.textContent = B.pct((px - prev) / prev) + ' за день';
    };
    draw(); const iv = setInterval(() => { if (!m.el.isConnected) clearInterval(iv); else draw(); }, 600);
    m.el.querySelector('#am-buy').onclick = () => { m.close(); B.App.openTrade(t); };
  }
  W.assetModal = assetModal;

  /* ================= РЫНКИ ================= */
  function renderMarkets(v) {
    const tabs = [['all', 'Все'], ['stock', 'Акции'], ['bond', 'Облигации'], ['fund', 'Фонды'], ['fut', 'Фьючерсы']];
    v.innerHTML = `
      <div class="page-head"><div><span class="eyebrow">Демо-биржа · котировки вымышленные</span><h1>Рынки</h1></div>
        <label class="search"><span class="sr-only">Поиск</span><input id="mk-q" type="search" placeholder="Тикер или название" value="${B.esc(W.mkSearch)}"></label></div>
      <div class="seg pills" id="mk-tabs">${tabs.map(([k, l]) => `<button data-mk="${k}" class="${W.mkTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <p class="mk-delay" id="mk-delay" hidden></p>
      <section class="card flush"><div class="table-scroll"><table class="mk-table">
        <thead><tr><th>Инструмент</th><th class="r">Цена</th><th class="r">За день</th><th class="r hide-s">30 дней</th><th class="hide-s">Сектор</th><th class="r hide-s">Доходность</th></tr></thead>
        <tbody id="mk-body"></tbody></table></div></section>`;
    $('#mk-tabs').onclick = e => { const b = e.target.closest('[data-mk]'); if (!b) return; W.mkTab = b.dataset.mk; $$('#mk-tabs button').forEach(x => x.classList.toggle('on', x === b)); updateMarkets(); };
    $('#mk-q').oninput = e => { W.mkSearch = e.target.value; updateMarkets(); };
    $('#mk-body').onclick = e => { const r = e.target.closest('[data-asset]'); if (r) assetModal(r.dataset.asset); };
    $('#mk-delay').onclick = e => { if (e.target.closest('[data-up]')) upsell('Pro', 'Котировки в реальном времени, скринеры и расширенные метрики входят в Pro и Premium.'); };
  }
  // на Free котировки по закрытию прошлого торгового дня: в ускоренной игре задержку в минутах не заметить
  function marketPrices() {
    const S = B.S(); if (W.tariff !== 'Free') return { prices: S.prices, prev: B.prevClose, note: '' };
    const prices = {}; B.INSTR.forEach(i => prices[i.t] = S.hist[i.t][S.day - 1].c);
    return { prices, prev: t => S.hist[t][Math.max(0, S.day - 2)].c, note: B.dateShort(S.day - 1) };
  }
  function updateMarkets() {
    const body = $('#mk-body'); if (!body) return;
    const S0 = B.S(); const mp = marketPrices(); const S = { prices: mp.prices, hist: S0.hist }; const q = W.mkSearch.trim().toLowerCase();
    const dn = $('#mk-delay'); if (dn) { dn.hidden = !mp.note; dn.innerHTML = mp.note ? `На тарифе Free цены по закрытию торгов ${mp.note}. <button class="link" data-up="Pro">В реальном времени – в Pro</button>` : ''; }
    const rows = B.INSTR.filter(i => (W.mkTab === 'all' || i.type === W.mkTab) && (!q || i.t.toLowerCase().includes(q) || i.n.toLowerCase().includes(q)));
    body.innerHTML = rows.map(i => {
      const px = S.prices[i.t], prev = mp.prev(i.t), d = (px - prev) / prev;
      const h = S.hist[i.t].slice(-30).map(c => c.c); h.push(px);
      const y = i.type === 'stock' ? 'див. ' + B.num(i.dy, 1) + ' %' : i.type === 'bond' ? 'купон ' + B.num(i.coupon, 1) + ' %' : i.type === 'fut' ? 'ГО ' + B.num(i.go * 100, 0) + ' %' : i.ter;
      return `<tr data-asset="${i.t}" tabindex="0"><td><span class="mk-name"><i class="pdot" style="background:${i.color}"></i><span><b>${B.esc(i.n)}</b><small>${i.t}</small></span></span></td>
        <td class="r num">${B.px(i.t, px)}</td><td class="r num ${B.cls(d)}">${B.pct(d)}</td><td class="r hide-s">${B.spark(h, 96, 28, h[h.length - 1] >= h[0] ? '#50F08C' : '#FF5A6E')}</td>
        <td class="hide-s muted">${i.sector}</td><td class="r hide-s muted">${y}</td></tr>`;
    }).join('') || '<tr><td colspan="6" class="empty">Ничего не найдено</td></tr>';
  }

  /* ================= НОВОСТИ ================= */
  W.newsTab = 'all'; W.newsSeen = null;
  function heldTickers() { const S = B.S(); const h = new Set(); B.ACCOUNTS.forEach(a => { if (S.sync[a.id]) for (const t in S.acc[a.id].pos) h.add(t); }); return h; }
  function newsBadge() {
    const el = $('#w-news-badge'); if (!el) return;
    const S = B.S(); if (W.screen === 'news') W.newsSeen = S.news[0] || null;
    let n = 0; for (const x of S.news) { if (x === W.newsSeen) break; n++; }
    if (W.newsSeen === null && W.screen !== 'news') n = 0;
    el.hidden = !n; el.textContent = n > 9 ? '9+' : n;
  }
  function renderNews(v) {
    if (W.newsSeen === null) W.newsSeen = B.S().news[0] || null;
    if (W.newsTab !== 'mine') W.newsTab = 'all';
    v.innerHTML = `
      <div class="page-head"><h1>Новости</h1>
        <div class="seg" id="nw-tabs"><button data-nw="all" class="${W.newsTab === 'all' ? 'on' : ''}">Все</button><button data-nw="mine" class="${W.newsTab === 'mine' ? 'on' : ''}">Мои бумаги</button></div></div>
      <section class="card flush"><div class="nw-list" id="nw-list"></div></section>`;
    $('#nw-tabs').onclick = e => { const b = e.target.closest('[data-nw]'); if (!b) return; W.newsTab = b.dataset.nw; $$('#nw-tabs button').forEach(x => x.classList.toggle('on', x === b)); updateNews(); };
    $('#nw-list').onclick = e => {
      const r = e.target.closest('[data-asset]'); if (r) { assetModal(r.dataset.asset); return; }
      const a = e.target.closest('[data-nk]'); const n = a && B.newsByKey(a.dataset.nk); if (n) openNews(n);
    };
  }
  function openNews(n) { B.newsModal(n, { host: $('#web-frame'), onAsset: assetModal }); }
  W.openNews = openNews;
  // лента как в брокерских приложениях: время, заголовок и бумага, к которой относится новость
  function updateNews() {
    const box = $('#nw-list'); if (!box) return;
    const S = B.S(); const held = heldTickers();
    const list = S.news.filter(n => W.newsTab === 'all' || (n.t && held.has(n.t)));
    box.innerHTML = list.length ? list.map(n => {
      const ins = n.t && B.IMAP[n.t];
      let tag = '';
      if (ins) { const px = S.prices[n.t], prev = B.prevClose(n.t), d = (px - prev) / prev;
        tag = `<button class="nw-tag" data-asset="${n.t}"><i class="pdot" style="background:${ins.color}"></i>${n.t}<span class="num ${B.cls(d)}">${B.pct(d)}</span></button>`; }
      return `<article class="nw-item" data-nk="${B.newsKey(n)}" tabindex="0" role="button" aria-label="Читать: ${B.esc(n.text)}"><span class="nw-time num">${B.dateShort(n.day)}<br>${B.timeOf(n.tick)}</span><div class="nw-body"><p>${B.esc(n.text)}</p>${tag}</div></article>`;
    }).join('') : `<p class="empty">${W.newsTab === 'mine' ? 'По вашим бумагам новостей пока нет' : 'Новостей пока нет'}</p>`;
  }

  /* ================= РЕБАЛАНСИРОВКА ================= */
  const RK = ['stock', 'bond', 'fund', 'cash'];
  function rebAccs() { const S = B.S(); return B.ACCOUNTS.filter(a => !a.fut && S.sync[a.id]).map(a => a.id); }
  function currentShares() {
    const b = B.rebalanceBase(rebAccs()); const tot = RK.reduce((s, k) => s + b[k], 0) || 1;
    const r = {}; RK.forEach(k => r[k] = b[k] / tot * 100); return r;
  }
  function defaultTarget() {
    const st = B.S().strategyKey;
    return st === 'cons' ? { stock: 25, bond: 55, fund: 15, cash: 5 } : st === 'mod' ? { stock: 45, bond: 35, fund: 15, cash: 5 } : { stock: 65, bond: 15, fund: 15, cash: 5 };
  }
  function renderRebalance(v) {
    if (!W.target) W.target = defaultTarget();
    if (W.tariff === 'Free') {
      v.innerHTML = `<div class="reb-root"><div class="reb-head"><h2>Ребалансировка</h2></div>
        <section class="card reb-locked"><b>Расчёт ребалансировки – в Pro</b><p class="muted">Задаёте целевую структуру, сайт считает, какие бумаги и у какого брокера докупить или продать. В Premium план исполняется в приложении в один клик.</p><button class="btn-g" data-up="Pro">Открыть в Pro</button></section></div>`;
      v.querySelector('[data-up]').onclick = () => upsell('Pro');
      return;
    }
    v.innerHTML = `<div class="reb-root">
      <div class="reb-head"><h2>Ребалансировка</h2>
        <p class="muted">Задайте целевую структуру, и сайт посчитает, какие сделки и у какого брокера к ней приведут. Исполнить план можно в приложении для ПК: там же доступен такой же расчёт.</p></div>
      <div class="reb-grid">
        <section class="card" id="reb-target"></section>
        <section class="card" id="reb-preview"></section>
      </div>
      <section class="card" id="reb-plan"></section></div>`;
    const root = v.firstElementChild;
    root.addEventListener('click', onRebClick);
    root.addEventListener('input', e => {
      const inp = e.target.closest('[data-tg]'); if (!inp) return;
      W.target[inp.dataset.tg] = Math.max(0, Math.min(100, Math.round(+inp.value || 0))); W.plan = null; updateRebalance(false);
    });
    updateRebalance(true);
  }
  function onRebClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.step) { const k = b.dataset.k; W.target[k] = Math.max(0, Math.min(100, W.target[k] + +b.dataset.step)); W.plan = null; updateRebalance(true); }
    if (b.dataset.preset === 'cur') { const c = currentShares(); RK.forEach(k => W.target[k] = Math.round(c[k])); fixSum(); W.plan = null; updateRebalance(true); }
    if (b.dataset.preset === 'eq') { W.target = { stock: 30, bond: 30, fund: 30, cash: 10 }; W.plan = null; updateRebalance(true); }
    if (b.dataset.preset === 'strat') { W.target = defaultTarget(); W.plan = null; updateRebalance(true); }
    if (b.dataset.rm) { W.rebMode = b.dataset.rm; W.plan = null; updateRebalance(true); }
    if (b.id === 'reb-calc') { W.plan = B.rebalancePlan(W.target, W.rebMode, rebAccs()); updateRebalance(true); B.emitUI && B.emitUI('reb:calc'); }
    if (b.id === 'reb-up') { upsell('Premium'); return; }
    if (b.id === 'reb-send') {
      if (!W.plan || !W.plan.rows.length) return;
      B.Desk.receivePlan(W.plan);
      B.toast('#w-toasts', 'План отправлен в приложение', 'good');
      setTimeout(() => B.App.setMode('desk'), 450);
    }
  }
  W.reb = { RK, currentShares, defaultTarget, rebAccs };
  function fixSum() { const s = RK.reduce((a, k) => a + W.target[k], 0); W.target.cash += 100 - s; if (W.target.cash < 0) { W.target.stock += W.target.cash; W.target.cash = 0; } }
  function updateRebalance(full) {
    const tb = $('#reb-target'); if (!tb) return;
    const cur = currentShares();
    const sum = RK.reduce((a, k) => a + W.target[k], 0);
    if (full || !tb.querySelector('[data-tg]')) {
      tb.innerHTML = `<div class="card-head"><h2>Целевая структура</h2><div class="seg small"><button data-preset="strat">По профилю</button><button data-preset="cur">Текущие доли</button><button data-preset="eq">Равные доли</button></div></div>
        <table class="tg-table"><thead><tr><th>Класс</th><th class="r">Сейчас</th><th class="c">Цель, %</th><th class="r">Отклонение</th></tr></thead><tbody>
        ${RK.map(k => `<tr><td><i class="bdot" style="background:${B.CLASS[k].color}"></i>${B.CLASS[k].name}</td><td class="r num" data-cur="${k}"></td>
          <td class="c"><span class="stepper"><button data-step="-5" data-k="${k}" aria-label="Уменьшить">−</button><input data-tg="${k}" type="number" min="0" max="100" value="${W.target[k]}" aria-label="Цель ${B.CLASS[k].name}"><button data-step="5" data-k="${k}" aria-label="Увеличить">+</button></span></td>
          <td class="r num" data-dev="${k}"></td></tr>`).join('')}
        </tbody></table>
        <div class="tg-foot"><span id="tg-sum"></span>
          <div class="seg small"><button data-rm="buy" class="${W.rebMode === 'buy' ? 'on' : ''}">Только докупать</button><button data-rm="full" class="${W.rebMode === 'full' ? 'on' : ''}">Покупать и продавать</button></div></div>
        <p class="muted small">Срочный счёт в ребалансировке не участвует. Учитываются счета с включённой синхронизацией.</p>
        <button class="btn-g wide" id="reb-calc">Рассчитать план</button>`;
    }
    RK.forEach(k => {
      const c = tb.querySelector(`[data-cur="${k}"]`); if (c) c.textContent = B.num(cur[k], 1) + ' %';
      const d = tb.querySelector(`[data-dev="${k}"]`); if (d) { const dv = cur[k] - W.target[k]; d.textContent = (dv > 0 ? '+' : dv < 0 ? '−' : '') + B.num(Math.abs(dv), 1) + ' п.п.'; d.className = 'r num ' + (Math.abs(dv) > 5 ? 'warn' : 'muted'); }
    });
    const s = $('#tg-sum'); if (s) { s.textContent = sum === 100 ? 'Сумма долей: 100 %' : 'Сумма долей должна быть 100 %, сейчас ' + sum + ' %'; s.className = sum === 100 ? 'ok' : 'err-t'; }
    const calc = $('#reb-calc'); if (calc) calc.disabled = sum !== 100;

    const pv = $('#reb-preview');
    const p = W.plan;
    const segsOf = obj => RK.map(k => ({ label: B.CLASS[k].name, v: Math.max(0, obj[k]), color: B.CLASS[k].color }));
    if (p) {
      const tot = RK.reduce((a, k) => a + p.after[k], 0);
      pv.innerHTML = `<div class="card-head"><h2>Было → станет</h2></div>
        <div class="ba"><div><span class="eyebrow">Сейчас</span>${B.donut(segsOf(p.base), 160, 22, [B.num(p.devBefore, 1), 'п.п. откл.'])}</div><span class="ba-arrow">→</span><div><span class="eyebrow">После плана</span>${B.donut(segsOf(p.after), 160, 22, [B.num(p.devAfter, 1), 'п.п. откл.'])}</div></div>
        <table class="ba-table"><thead><tr><th></th><th class="r">Сейчас</th><th class="r">После</th><th class="r">Цель</th></tr></thead><tbody>
        ${RK.map(k => `<tr><td><i class="bdot" style="background:${B.CLASS[k].color}"></i>${B.CLASS[k].name}</td><td class="r num">${B.num(p.base[k] / p.V * 100, 1)}</td><td class="r num"><b>${B.num(p.after[k] / tot * 100, 1)}</b></td><td class="r num">${W.target[k]}</td></tr>`).join('')}</tbody></table>
        <p class="ba-note">Максимальное отклонение от цели снизится с <b>${B.num(p.devBefore, 1)}</b> до <b>${B.num(p.devAfter, 1)}</b> п.п.</p>`;
    } else {
      pv.innerHTML = `<div class="card-head"><h2>Сейчас</h2></div><div class="ba single">${B.donut(segsOf(B.rebalanceBase(rebAccs())), 180, 24, ['', ''])}</div><p class="muted center">Задайте цель и нажмите «Рассчитать план», чтобы увидеть, как изменится портфель.</p>`;
    }
    const pl = $('#reb-plan');
    if (!p) { pl.hidden = true; return; }
    pl.hidden = false;
    const buys = p.rows.filter(r => r.side === 'buy'), sells = p.rows.filter(r => r.side === 'sell');
    const turnover = p.rows.reduce((s, r) => s + r.amount, 0), fees = p.rows.reduce((s, r) => s + r.fee, 0);
    pl.innerHTML = `<div class="card-head"><h2>План сделок</h2><span class="count">${p.rows.length}</span></div>
      ${p.rows.length ? `<div class="table-scroll"><table class="plan-table"><thead><tr><th>Действие</th><th>Инструмент</th><th>Брокер и счёт</th><th class="r">Лоты</th><th class="r">Цена</th><th class="r">Сумма</th><th class="r">Комиссия</th></tr></thead><tbody>
      ${sells.concat(buys).map(r => `<tr><td><span class="tag ${r.side}">${r.side === 'buy' ? 'Купить' : 'Продать'}</span></td><td><b>${B.esc(B.IMAP[r.t].n)}</b> <small class="muted">${r.t}</small></td><td>${B.accLabel(r.acc)}</td><td class="r num">${r.lots}</td><td class="r num">${B.px(r.t, r.price)}</td><td class="r num">${B.rub(r.amount, 0)}</td><td class="r num muted">${B.rub(r.fee, 2)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="plan-foot"><span>Оборот <b class="num">${B.rub(turnover, 0)}</b></span><span>Комиссии <b class="num">${B.rub(fees, 2)}</b></span><span>Брокер выбирается по наибольшему остатку денег на счёте</span>
        ${W.tariff === 'Premium' ? '<button class="btn-g ghost" id="reb-send">Передать план в приложение</button>' : '<button class="btn-g ghost" id="reb-up">Исполнить в один клик – Premium</button>'}</div>
      <p class="disclaimer">Расчёт выполнен по заданной вами структуре и не является индивидуальной инвестиционной рекомендацией.</p>`
        : '<p class="empty">Портфель уже соответствует цели, сделки не нужны. В режиме «Только докупать» нужны свободные деньги.</p>'}`;
  }


  /* ================= ЛИЧНЫЙ КАБИНЕТ ================= */
  // всё в кабинете демонстрационное: настройки живут только в этой вкладке
  W.acct = { twofa: true, auto: true, others: true, notif: { trade: true, inc: true, news: true, drift: true, digest: false } };
  const NOTIF = [['trade', 'Сделки из приложения', 'Когда заявка исполнена у брокера'], ['inc', 'Купоны и дивиденды', 'Поступления на любой из счетов'], ['news', 'Новости по моим бумагам', 'Только по бумагам из портфеля'], ['drift', 'Отклонение от целевой структуры', 'Если доля класса ушла больше чем на 5 п.п.'], ['digest', 'Еженедельный отчёт на почту', 'Итоги недели по портфелю']];
  const sw = (key, on, label) => `<button class="ac-sw ${on ? 'on' : ''}" data-tg="${key}" role="switch" aria-checked="${on}" aria-label="${label}"><i></i></button>`;
  function renderAccount(v) {
    const S = B.S(); const st = B.STRATS[S.strategyKey];
    const pay = [0, 1, 2].map(i => ({ day: S.day - 30 * i - 4 }));
    v.innerHTML = `
      <div class="page-head"><div><span class="eyebrow">Демо-аккаунт · данные вымышленные</span><h1>Личный кабинет</h1></div></div>
      <div class="ac-grid"><div class="ac-col">
        <section class="card ac-profile">
          <div class="ac-me"><span class="avatar big">ДИ</span><div><h2>Демо Инвестор</h2><span class="muted">demo@брокед.демо · +7 900 ···-··-17</span></div></div>
          <div class="ac-kv">
            <div><span>Стратегия</span><b>${st.name}</b></div>
            <div><span>Стартовый капитал</span><b class="num">${B.rub(3000000, 0)}</b></div>
            <div><span>В сервисе с</span><b>${B.dateShort(S.day - 120)}</b></div>
            <div><span>Квал. инвестор</span><b>Нет</b></div>
          </div>
        </section>
        <section class="card ac-brokers">
          <div class="card-head"><h2>Брокеры и счета</h2><button class="btn-t sm" data-ac="broker">+ Брокер</button></div>
          <div id="ac-accs"></div>
        </section>
        <section class="card ac-notif">
          <div class="card-head"><h2>Уведомления</h2></div>
          ${NOTIF.map(([k, t, d]) => `<div class="ac-row"><span><b>${t}</b><small class="muted">${d}</small></span>${sw('n:' + k, W.acct.notif[k], t)}</div>`).join('')}
        </section>
        <section class="card ac-pay">
          <div class="card-head"><h2>История платежей</h2></div>
          ${pay.map(p => `<div class="ac-row"><span>${B.dateShort(p.day)} · Premium, 1 месяц</span><b class="num">${B.rub(1500, 0)}</b></div>`).join('')}
          <p class="muted small">Чеки приходят на почту. В демо платежи не проводятся.</p>
        </section>
        </div><div class="ac-col">
        <section class="card ac-plan">
          <div class="card-head"><h2>Подписка</h2><span class="plan-badge">${W.tariff}</span></div>
          <div class="ac-price"><b class="num">${PLANS[W.tariff].p} ₽</b><span class="muted"> / мес</span></div>
          <div class="ac-row"><span>Следующее списание</span><b>${W.tariff === 'Free' ? 'нет' : B.dateShort(S.day + 26)}</b></div>
          <div class="ac-row"><span>Автопродление</span>${sw('auto', W.acct.auto, 'Автопродление')}</div>
          <div class="ac-row"><span>Карта</span><b>•••• 4417</b></div>
          <button class="btn-t wide" data-nav="tariffs">Сменить тариф</button>
        </section>
        <section class="card ac-device">
          <div class="card-head"><h2>Приложение для ПК</h2></div>
          <div class="ac-dev"><span class="ac-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 5h18v11H3zM8 20h8M12 16v4" fill="none" stroke="currentColor" stroke-width="2"/></svg></span>
            <div><b>DEMO-PC · Windows 11</b><span class="muted" id="ac-sync"></span></div></div>
          <div class="ac-row"><span>Версия</span><b>БрокЕд 1.0 (демо)</b></div>
          <div class="ac-row"><span>Торговля</span>${W.tariff === 'Premium' ? '<b class="up">разрешена</b>' : '<b class="down">нужен Premium</b>'}</div>
          <button class="btn-g wide" data-ac="desk">Открыть приложение</button>
        </section>
        <section class="card ac-sec">
          <div class="card-head"><h2>Безопасность</h2></div>
          <div class="ac-row"><span>Вход по коду из приложения (2FA)</span>${sw('twofa', W.acct.twofa, 'Двухфакторная защита')}</div>
          <div class="ac-row"><span>Пароль</span><button class="link" data-ac="pwd">Сменить</button></div>
          <h4>Активные сессии</h4>
          <div class="ac-row"><span>Браузер · это устройство</span><b class="up">сейчас</b></div>
          <div class="ac-row"><span>Приложение · DEMO-PC<small class="muted">доверенное устройство, не завершается</small></span><b class="muted">онлайн</b></div>
          <div id="ac-others">${sessionsHTML()}</div>
        </section>
        </div>
      </div>`;
    v.querySelector('.ac-grid').addEventListener('click', e => {
      const t = e.target.closest('[data-tg]');
      if (t) {
        const k = t.dataset.tg; let on;
        if (k.startsWith('n:')) on = W.acct.notif[k.slice(2)] = !W.acct.notif[k.slice(2)];
        else if (k.startsWith('sync:')) { on = !B.S().sync[k.slice(5)]; B.setSync(k.slice(5), on); updateAccount(); }
        else on = W.acct[k] = !W.acct[k];
        t.classList.toggle('on', on); t.setAttribute('aria-checked', on);
        if (k.startsWith('sync:')) B.toast('#w-toasts', on ? 'Счёт снова учитывается в аналитике' : 'Счёт скрыт из аналитики сайта', 'sync');
        return;
      }
      const a = e.target.closest('[data-ac]'); if (!a) return;
      const act = a.dataset.ac;
      if (act === 'desk') B.App.setMode('desk');
      if (act === 'broker') { B.App.setMode('desk'); B.Desk.go('accounts'); B.Desk.connectWizard && B.Desk.connectWizard(); }
      if (act === 'pwd') B.toast('#w-toasts', 'В демо пароль не меняется', 'info');
      if (act === 'logout') { W.acct.others = false; const o = $('#ac-others'); if (o) o.innerHTML = sessionsHTML(); B.toast('#w-toasts', 'Сессии на телефоне и в Chrome завершены', 'good'); }
      if (act === 'plan') tariffModal(a.dataset.plan);
    });
    updateAccount();
  }
  function sessionsHTML() {
    return W.acct.others ? `<div class="ac-row"><span>Телефон · Safari, Москва</span><b class="muted">2 дня назад</b></div>
      <div class="ac-row"><span>Браузер · Chrome, Казань</span><b class="muted">неделю назад</b></div>
      <button class="link danger" data-ac="logout">Завершить другие сессии</button>` : '<p class="muted small ac-done">Других сессий нет</p>';
  }
  function updateAccount() {
    const box = $('#ac-accs'); if (!box) return;
    const S = B.S();
    box.innerHTML = B.BROKERS.map(br => {
      const accs = B.ACCOUNTS.filter(a => a.broker === br.id); if (!accs.length) return '';
      return `<div class="ac-br"><div class="ac-brh"><i class="bdot" style="background:${br.color}"></i><b>${br.name}</b><span class="muted small">подключён через приложение</span></div>
        ${accs.map(a => `<div class="ac-row"><span><b>${a.name} <span class="muted">${a.num}</span></b><small class="muted">${S.sync[a.id] ? 'синхронизирован, ' + B.rub(B.snapshot({ accs: new Set([a.id]), cls: new Set(B.CLS_KEYS) }).value, 0) : 'не учитывается в аналитике'}</small></span>${sw('sync:' + a.id, S.sync[a.id], 'Синхронизация ' + a.name)}</div>`).join('')}</div>`;
    }).join('');
    const sec = Math.max(0, Math.round((Date.now() - (S.lastSync || Date.now())) / 1000));
    const el = $('#ac-sync'); if (el) el.textContent = 'Синхронизация с сайтом: ' + (sec < 5 ? 'только что' : sec < 60 ? sec + ' с назад' : Math.round(sec / 60) + ' мин назад');
  }

  /* ================= ТАРИФЫ ================= */
  const PLANS = {
    Free: { p: '0', f: ['До 3 портфелей', 'Журнал сделок: покупки, продажи, дивиденды и комиссии вручную', 'Импорт CSV из отчётов брокеров', 'Графики и структура портфеля', 'Котировки по закрытию дня'], off: ['Метрики риска', 'Ребалансировка', 'Приложение для ПК и автосинхронизация'] },
    Pro: { p: '900', f: ['Портфели и журналы без ограничений', 'Шарп, Сортино, бета, просадка', 'Скринеры и котировки в реальном времени', 'Расчёт ребалансировки'], off: ['Приложение для ПК и торговля'] },
    Premium: { p: '1 500', f: ['Всё из Pro', 'Приложение для ПК: торговля у всех брокеров', 'Автосинхронизация счетов с сайтом, без ручного ввода', 'Ребалансировка в один клик', 'Стоп-заявки, связанные заявки, срочный рынок'], off: [] },
  };
  const RANK = { Free: 0, Pro: 1, Premium: 2 };
  W.tariff = 'Premium';
  // смена тарифа в демо: без оплаты, но с последствиями – без Premium приложение для ПК закрыто
  B.setPlan = function (name) {
    W.tariff = name;
    $$('.plan-badge').forEach(el => { el.textContent = name; el.classList.toggle('free', name === 'Free'); });
    B.Desk && B.Desk.planChanged && B.Desk.planChanged(name);
    W.delay = null;
    if (['tariffs', 'account', 'portfolio', 'markets'].includes(W.screen)) W.go(W.screen);
  };
  function tariffModal(name) {
    const up = RANK[name] > RANK[W.tariff];
    const m = B.modal(`<h3>${up ? 'Подключить' : 'Перейти на'} ${name}?</h3>
      <p>${name === 'Premium' ? 'Вернутся приложение для ПК, торговля у всех брокеров и ребалансировка в один клик.' : name === 'Pro' ? 'Аналитика и расчёт ребалансировки останутся, но приложение для ПК и торговля станут недоступны.' : 'Останется базовая аналитика. Приложение для ПК, торговля и ребалансировка станут недоступны.'}</p>
      <div class="ac-row"><span>Стоимость</span><b class="num">${PLANS[name].p} ₽ / мес</b></div>
      <p class="muted small">${up ? 'Первые 7 дней бесплатно. ' : 'Изменение вступит в силу сразу. '}В демо оплата не проводится, вернуться можно в любой момент.</p>
      <div class="m-actions"><button class="btn-t" id="tf-no">Отмена</button><button class="btn-g" id="tf-yes">${up ? 'Подключить' : 'Перейти'}</button></div>`, { host: $('#web-frame') });
    m.el.querySelector('#tf-no').onclick = m.close;
    m.el.querySelector('#tf-yes').onclick = () => { m.close(); B.setPlan(name); B.toast('#w-toasts', `Тариф изменён: <b>${name}</b>`, 'good'); };
  }
  function renderTariffs(v) {
    v.innerHTML = `<div class="page-head"><div><span class="eyebrow">Цены предварительные</span><h1>Тарифы</h1><p class="lead">Аналитика бесплатна. Торговля через приложение для ПК – в Premium. Пробный период 7 дней.</p></div></div>
      <div class="tariffs">${Object.entries(PLANS).map(([n, t]) => { const cur = n === W.tariff; return `<section class="card tariff ${cur ? 'hot' : ''}">${cur ? '<span class="tag-hot">Ваш тариф</span>' : ''}<h2>${n}</h2><div class="price"><b class="num">${t.p}</b> ₽ / мес</div>
        <ul>${t.f.map(x => `<li class="yes">${x}</li>`).join('')}${t.off.map(x => `<li class="no">${x}</li>`).join('')}</ul>
        <button class="btn-g ${cur ? '' : 'ghost'} wide" data-plan="${n}" ${cur ? 'disabled' : ''}>${cur ? 'Подключён' : RANK[n] > RANK[W.tariff] ? 'Попробовать 7 дней' : 'Перейти на ' + n}</button></section>`; }).join('')}</div>`;
    v.querySelector('.tariffs').onclick = e => { const b = e.target.closest('[data-plan]'); if (b && !b.disabled) tariffModal(b.dataset.plan); };
  }

  /* ---------- события симуляции ---------- */
  B.on('trade', op => {
    const S = B.S();
    if (!S.sync[op.acc]) return;
    op.fresh = true; setTimeout(() => { op.fresh = false; }, 6000);
    if (op.src === 'broker' && op.k !== 'dep') return;
    if (B.App.mode === 'web' && op.k === 'trade') {
      const ins = B.IMAP[op.t];
      B.toast('#w-toasts', `<b>Синхронизировано из приложения</b><br>${op.qty > 0 ? 'Покупка' : 'Продажа'} ${B.esc(ins.n)} · ${B.num(Math.abs(op.qty))} ${ins.type === 'fut' ? 'контр.' : 'шт.'}`, 'sync');
    }
  });
  B.on('income', op => {
    if (B.App.mode === 'web' && B.S().sync[op.acc]) B.toast('#w-toasts', `${op.sub === 'coupon' ? 'Купон' : 'Дивиденды'} по ${B.esc(B.IMAP[op.t].n)}: ${B.srub(op.amt, 2)}`, 'good');
  });
  B.on('sync', acc => { if (W.filter && B.S().sync[acc]) W.filter.accs.add(acc); renderFilters(); });
})(window.B);
