/* БРОКЕД демо 2 — каркас: режимы, время, старт игры, путь клиента */
(function (B) {
  'use strict';
  const $ = B.$, $$ = B.$$;
  const App = B.App = { mode: 'web', speed: 1, paused: true, timer: null, unseen: 0 };
  const uiListeners = [];
  B.emitUI = ev => uiListeners.slice().forEach(fn => fn(ev));
  B.onUI = fn => { uiListeners.push(fn); return () => { const i = uiListeners.indexOf(fn); if (i >= 0) uiListeners.splice(i, 1); }; };

  /* ---------- режимы ---------- */
  App.setMode = function (mode) {
    if (App.mode === mode) return;
    App.mode = mode;
    $('#web-frame').hidden = mode !== 'web';
    $('#desk-frame').hidden = mode !== 'desk';
    $$('.db-switch [data-mode]').forEach(b => { b.classList.toggle('on', b.dataset.mode === mode); b.setAttribute('aria-selected', b.dataset.mode === mode); });
    if (mode === 'web') { App.unseen = 0; badge(); B.Web.go(B.Web.screen); }
    else B.Desk.go(B.Desk.screen);
    const st = $('.stage'); st.classList.remove('flip'); void st.offsetWidth; st.classList.add('flip');
    B.emitUI('mode:' + mode);
  };
  App.openTrade = function (t) {
    if (B.Web.tariff !== 'Premium') { if (App.mode !== 'web') App.setMode('web'); B.Web.upsell('Premium'); return; }
    App.setMode('desk');
    B.Desk.go('terminal');
    if (t) B.Desk.select(t, { side: 'buy', ticket: true }); else B.Desk.openTicket({ side: 'buy' });
    B.toast('#d-toasts', t ? 'Открыта заявка по ' + t + ' – переход с сайта по ссылке приложения' : 'Торговля идёт в приложении для ПК', 'info', 2600);
  };
  function badge() { const b = $('#web-badge'); if (!b) return; b.hidden = !App.unseen; b.textContent = App.unseen; }

  // при переходе на другую страницу окно показывается с самого начала, если его верх ушёл под панель демо
  B.scrollFrameTop = function (frame) {
    if (!frame || frame.hidden) return;
    const bar = $('.demo-bar'); const top = frame.getBoundingClientRect().top - (bar ? bar.offsetHeight : 0);
    if (top < 0) window.scrollBy(0, top - 4);
  };

  /* ---------- время ---------- */
  const SPEEDS = { 1: 500, 4: 125 };
  function loop() {
    clearInterval(App.timer);
    if (App.paused) return;
    App.timer = setInterval(() => { B.step(); }, SPEEDS[App.speed]);
  }
  App.play = function (on) { App.paused = !on; loop(); renderClock(); };
  App.setSpeed = function (s) { App.speed = s; loop(); renderClock(); };

  /* Пока кнопка мыши или палец прижаты, экран не перерисовывается: иначе кнопка под курсором
     заменяется новой между нажатием и отпусканием, и клик теряется. Отложенное обновление
     выполняется сразу после отпускания, когда клик уже обработан. */
  let raf = 0, pressed = false, pending = false;
  function schedule() {
    if (pressed) { pending = true; return; }
    if (raf) return; raf = requestAnimationFrame(() => { raf = 0; B.Web.update(); B.Desk.update(); renderClock(); });
  }
  document.addEventListener('pointerdown', () => { pressed = true; }, true);
  const release = () => { if (!pressed) return; pressed = false; if (pending) { pending = false; setTimeout(schedule, 0); } };
  document.addEventListener('pointerup', release, true);
  document.addEventListener('pointercancel', release, true);
  window.addEventListener('blur', release);

  function renderClock() {
    const S = B.S(); if (!S) return;
    const day = S.day - B.HIST + 1;
    $('#db-clock').innerHTML = `<b class="num">${B.dateFull(S.day)}</b><span class="num">${B.timeOf(S.tick)}</span><small><span class="db-prof">${S.strategy.short}</span> · день ${day} <em class="db-day" aria-hidden="true"><i style="width:${(S.tick / B.TPD * 100).toFixed(1)}%"></i></em></small>`;
    $('#db-play').innerHTML = App.paused ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg><span>Пуск</span>' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor"/></svg><span>Пауза</span>';
    $('#db-play').setAttribute('aria-label', App.paused ? 'Запустить время' : 'Поставить на паузу');
    $$('[data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed === App.speed));
  }

  /* ---------- старт игры ---------- */
  function newGame(seed) {
    Guide.stop();
    if (B.Desk.wizard) B.Desk.wizard.close(); if (B.Desk.tkm) B.Desk.tkm.close();
    B.init(seed);
    B.Web.resetFilter(); B.Web.target = null; B.Web.plan = null;
    B.Desk.plan = null; B.Desk.planState = null; B.Desk.t.acc = null; B.Desk.sel = 'ZNTH';
    setWebOnb(null); setDeskOnb(null);
    B.Web.go('portfolio');
    if (App.mode !== 'web') App.setMode('web');
    renderClock();
  }
  const allFilter = () => ({ accs: new Set(B.syncedAccs()), cls: new Set(B.CLS_KEYS) });

  const CHAPTERS = [
    ['Регистрация', 'Лендинг и аккаунт на сайте'],
    ['Приложение', 'Установка на ПК и вход'],
    ['Брокеры', 'API-ключи «только чтение»'],
    ['Аналитика', 'Все счета в одном портфеле'],
    ['Торговля', 'Ключ на торговлю и первая сделка'],
    ['Ребалансировка', 'План на сайте, исполнение в приложении'],
  ];

  function intro() {
    App.play(false);
    const m = B.modal(`
      <div class="intro">
        <div class="intro-logo">${B.logoIcon(56)}${B.wordmark()}</div>
        <span class="eyebrow">Демо · все бумаги, брокеры и котировки вымышлены</span>
        <h2>Пройдите путь клиента от регистрации до первой сделки</h2>
        <p class="lead">Вы начнёте с пустого кабинета, как новый пользователь: создадите аккаунт, установите приложение, подключите брокеров и увидите, как три счёта собираются в один портфель.</p>
        <ol class="road">${CHAPTERS.map(([n, d], i) => `<li><span class="road-n">${i + 1}</span><b>${n}</b><small>${d}</small></li>`).join('')}</ol>
        <div class="intro-go"><button class="btn-g big" id="intro-tour">Начать путь · 5 минут</button><button class="btn-g ghost big" id="intro-free">Сразу в готовый кабинет</button></div>
        <p class="muted small">Любой шаг можно выполнить кнопкой «Сделать за меня» на нижней панели. Ключи в демо ненастоящие, деньги тоже.</p>
      </div>`, { cls: 'intro-wrap', onClose: () => { if (!Guide.on && !B.Onb.web) App.play(true); } });
    m.el.querySelector('#intro-tour').onclick = () => { m.close(); Guide.start(); };
    m.el.querySelector('#intro-free').onclick = () => { m.close(); };
  }

  /* ---------- экраны до первого брокера: лендинг, регистрация, пустой кабинет, установка, вход ---------- */
  const Onb = B.Onb = { web: null, desk: null };
  const USER = { name: 'Демо Инвестор', mail: 'demo@брокед.демо' };
  const LOCK = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 11V8a4 4 0 1 1 8 0v3M6 11h12v9H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
  const flow = () => `<div class="flow" aria-label="Схема: брокеры, приложение на вашем ПК, сайт">
      <div class="flow-node"><span class="eyebrow">Брокеры</span><div class="flow-brk">${B.ALL_BROKERS.map(b => `<span><i class="bdot" style="background:${b.color}"></i>${b.short}</span>`).join('')}</div><small>счета и заявки</small></div>
      <div class="flow-link"><i></i><i></i><i></i><em>API</em></div>
      <div class="flow-node pc"><span class="eyebrow">Ваш компьютер</span><b>${LOCK} Приложение БРОКЕД</b><small>ключи зашифрованы и хранятся здесь</small></div>
      <div class="flow-link out"><i></i><i></i><i></i><em>снимки</em></div>
      <div class="flow-node"><span class="eyebrow">Сайт</span><b>Аналитика</b><small>позиции и деньги, без ключей</small></div>
    </div>`;

  function setWebOnb(state) {
    Onb.web = state;
    const site = $('#web-frame .site'), box = $('#w-onb'); if (!site || !box) return;
    site.classList.toggle('onb-full', state === 'landing' || state === 'signup');
    site.classList.toggle('onb-view', state === 'empty');
    box.hidden = !state; site.scrollTop = 0;
    if (!state) { box.innerHTML = ''; $('#w-url').textContent = 'портфель'; return; }
    if (state === 'landing') {
      $('#w-url').textContent = '';
      box.innerHTML = `<div class="lp">
        <header class="lp-head"><span class="site-logo">${B.logoIcon(34)}${B.wordmark()}</span><span class="lp-sp"></span><button class="link" id="lp-how">Как это работает</button><button class="btn-g sm ghost" id="lp-cta2">Создать аккаунт</button></header>
        <section class="lp-hero">
          <span class="eyebrow">Единое окно управления инвестициями</span>
          <h1>Все брокерские счета <em>в одном окне</em></h1>
          <p class="lead">Сайт собирает портфель со всех брокеров в одну аналитику. Приложение для ПК подключается к брокерам по API, а ключи от счетов хранит только на вашем компьютере.</p>
          <div class="lp-cta"><button class="btn-g big" id="lp-cta">Создать аккаунт</button><span class="muted small">Аналитика бесплатна · Premium 7 дней на пробу</span></div>
        </section>
        <section class="lp-flow" id="lp-flow">${flow()}</section>
        <section class="lp-feats">
          <article class="card"><span class="lp-ico">1</span><h3>Единый портфель</h3><p>Сколько всего денег, какие бумаги и какая доходность: одна цифра вместо трёх приложений и таблицы в Excel.</p></article>
          <article class="card"><span class="lp-ico">2</span><h3>Ключи остаются у вас</h3><p>API-ключ не уходит на сервер. Сайт получает от приложения только снимки портфеля: позиции и деньги.</p></article>
          <article class="card"><span class="lp-ico">3</span><h3>Торговля из одного окна</h3><p>Заявки у разных брокеров выставляются из одного терминала, а сделка сразу видна в аналитике.</p></article>
        </section>
        <p class="lp-foot muted small">Инвестируй умно, управляй легко. Демонстрация продукта: брокеры, бумаги и котировки вымышлены.</p>
      </div>`;
      const open = () => setWebOnb('signup');
      $('#lp-cta').onclick = open; $('#lp-cta2').onclick = open;
      $('#lp-how').onclick = () => $('#lp-flow').scrollIntoView({ block: 'center', behavior: B.reduced ? 'auto' : 'smooth' });
    }
    if (state === 'signup') {
      $('#w-url').textContent = 'регистрация';
      box.innerHTML = `<div class="su">
        <button class="link su-back" id="su-back">← На главную</button>
        <form class="card su-card" id="su-form" autocomplete="off">
          <div class="intro-logo">${B.logoIcon(40)}${B.wordmark()}</div>
          <h2>Создайте аккаунт</h2>
          <label class="fld"><span>Имя</span><input id="su-name" value="${USER.name}" required></label>
          <label class="fld"><span>Электронная почта</span><input id="su-mail" value="${USER.mail}" required></label>
          <label class="fld"><span>Пароль</span><input id="su-pass" type="password" value="demo-password" required minlength="8"></label>
          <div class="su-plan"><b>Premium, 7 дней бесплатно</b><span>Аналитика, приложение для ПК и торговля. Карта не нужна, тариф можно сменить в кабинете.</span></div>
          <label class="tk-check"><input type="checkbox" id="su-ok" checked>Согласен на обработку персональных данных</label>
          <button class="btn-g wide" id="su-go" type="submit">Зарегистрироваться</button>
          <p class="muted small">Пароль хранится в виде хеша Argon2id. Ключи брокеров на сайте не вводятся совсем: для них есть приложение.</p>
        </form>
      </div>`;
      $('#su-back').onclick = () => setWebOnb('landing');
      $('#su-form').onsubmit = e => {
        e.preventDefault();
        if (!$('#su-ok').checked) { B.toast('#w-toasts', 'Отметьте согласие на обработку данных', 'warn'); return; }
        USER.name = $('#su-name').value.trim() || USER.name;
        setWebOnb('empty');
        B.toast('#w-toasts', '<b>Аккаунт создан</b><br>Подключён пробный Premium на 7 дней', 'good', 4500);
      };
    }
    if (state === 'empty') {
      $('#w-url').textContent = 'кабинет';
      box.innerHTML = `<div class="site-view oe">
        <div class="page-head"><div><span class="eyebrow">Аккаунт создан · Premium, 7 дней бесплатно</span><h1>Добро пожаловать, ${B.esc(USER.name.split(' ')[0])}</h1>
          <p class="lead">В кабинете пока пусто: сайт ничего не знает о ваших счетах. Данные появятся, когда приложение для ПК подключится к брокерам.</p></div></div>
        <div class="oe-grid">
          <section class="card oe-main"><ol class="oe-steps">
            <li class="cur"><span class="oe-n">1</span><div><b>Скачайте приложение для ПК</b><p>Оно подключается к брокерам по API и передаёт на сайт снимки портфеля.</p>
              <div class="oe-dl"><button class="btn-g" id="onb-dl">Скачать для Windows · 48 МБ</button><div class="prog oe-prog" id="onb-prog" hidden><i style="width:0"></i></div></div></div></li>
            <li><span class="oe-n">2</span><div><b>Подключите брокера по API-ключу</b><p>Ключ вводится в приложении и остаётся на вашем компьютере. Начните с ключа «только чтение».</p></div></li>
            <li><span class="oe-n">3</span><div><b>Портфель появится здесь</b><p>Позиции, деньги и история сделок со всех счетов соберутся в одну аналитику.</p></div></li>
          </ol></section>
          <aside class="oe-side">
            <section class="card oe-soon"><span class="tag-soon">Скоро</span><b>Загрузка отчётов брокера</b><p class="muted">Импорт отчётов без приложения и ключей сейчас в разработке.</p><button class="btn-g ghost sm" disabled>Загрузить отчёт</button></section>
            <section class="card oe-see"><b>Что получит сайт</b><ul><li class="yes">Позиции и остатки денег</li><li class="yes">Историю сделок и выплат</li><li class="no">API-ключи</li><li class="no">Логин и пароль от брокера</li></ul></section>
          </aside>
        </div>
        <div class="oe-ghost" aria-hidden="true"><i></i><i></i><i></i></div>
      </div>`;
      $('#onb-dl').onclick = startDownload;
    }
  }
  function startDownload() {
    const btn = $('#onb-dl'), pr = $('#onb-prog'); if (!btn) return;
    if (Onb.desk && Onb.desk !== 'none') { App.setMode('desk'); return; }
    if (btn.disabled) return;
    btn.disabled = true; btn.textContent = 'Скачивается…'; pr.hidden = false;
    let p = 0; const iv = setInterval(() => {
      p = Math.min(100, p + 9 + Math.random() * 14); const i = pr.firstElementChild; if (!i || !i.isConnected) { clearInterval(iv); return; }
      i.style.width = p + '%';
      if (p >= 100) {
        clearInterval(iv); btn.disabled = false; btn.textContent = 'Открыть установщик'; pr.hidden = true;
        if (Onb.desk === 'none') setDeskOnb('install');
        B.toast('#w-toasts', 'Файл BROKED-Setup.exe скачан', 'good');
        setTimeout(() => { if (Onb.desk === 'install' && App.mode === 'web') App.setMode('desk'); }, B.reduced ? 100 : 700);
      }
    }, B.reduced ? 30 : 110);
  }

  function setDeskOnb(state) {
    Onb.desk = state;
    const frame = $('#desk-frame'), box = $('#d-onb'); if (!frame || !box) return;
    frame.classList.toggle('onb', !!state); box.hidden = !state;
    if (!state) { box.innerHTML = ''; return; }
    if (state === 'none') {
      box.innerHTML = `<div class="do-card"><span class="do-ico">${B.logoIcon(44)}</span><h3>Приложение ещё не установлено</h3><p class="muted">Это окно показывает компьютер клиента. Установщик скачивается на сайте, в личном кабинете.</p><button class="btn-d" id="do-web">Перейти на сайт</button></div>`;
      $('#do-web').onclick = () => App.setMode('web');
    }
    if (state === 'install') {
      box.innerHTML = `<div class="do-card ins"><div class="ins-h">${B.logoIcon(30)}<div><b>Установка БРОКЕД</b><small>BROKED-Setup.exe · версия 0.9, демо</small></div></div>
        <p>Приложение подключается к брокерам по API, показывает терминал и передаёт на сайт снимки портфеля. Ключи брокеров остаются на этом компьютере.</p>
        <ul class="ins-list"><li>Папка установки: C:\\Program Files\\BROKED</li><li>Хранилище ключей: защищённое хранилище Windows</li><li>Автозапуск: выключен</li></ul>
        <div class="prog" id="ins-prog" hidden><i style="width:0"></i></div><ul class="wz-log" id="ins-log"></ul>
        <div class="m-actions"><button class="btn-d" id="ins-go">Установить</button></div></div>`;
      $('#ins-go').onclick = runInstall;
    }
    if (state === 'login') {
      box.innerHTML = `<form class="do-card lg" id="lg-form"><div class="ins-h">${B.logoIcon(30)}<div><b>Вход в БРОКЕД</b><small>тот же аккаунт, что на сайте</small></div></div>
        <label class="tk-fld"><span>Электронная почта</span><input id="lg-mail" value="${USER.mail}"></label>
        <label class="tk-fld"><span>Пароль</span><input id="lg-pass" type="password" value="demo-password"></label>
        <p class="tk-note">Лицензия привязывается к этому компьютеру. Без связи с сервером приложение работает до 72 часов.</p>
        <div class="m-actions"><span class="muted small" id="lg-st"></span><button class="btn-d" id="lg-go" type="submit">Войти</button></div></form>`;
      $('#lg-form').onsubmit = e => {
        e.preventDefault(); const b = $('#lg-go'); if (b.disabled) return; b.disabled = true; $('#lg-st').textContent = 'Проверяем лицензию…';
        setTimeout(() => { if (Onb.desk !== 'login') return; setDeskOnb('first'); B.toast('#d-toasts', '<b>Вход выполнен</b><br>Лицензия Premium привязана к этому ПК', 'good', 4500); }, B.reduced ? 80 : 650);
      };
    }
    if (state === 'first') {
      box.innerHTML = `<div class="fb">
        <div class="fb-l"><span class="eyebrow">Первый запуск</span><h2>Подключите первого брокера</h2>
          <p class="muted">Выберите брокера и вставьте API-ключ из его личного кабинета. Для начала хватит ключа «только чтение»: с ним приложение видит счета, но не может торговать.</p>
          <div class="wz-brokers fb-list" id="fb-list">${B.ALL_BROKERS.map(b => { const n = B.ALL_ACCOUNTS.filter(a => a.broker === b.id).length; return `<button class="pick" data-fbpick="${b.id}"><i class="bdot" style="background:${b.color}"></i>${b.name}<small>${n} ${n === 1 ? 'счёт' : 'счёта'}</small></button>`; }).join('')}</div>
          <p class="tk-note">Все брокеры в демо вымышлены.</p></div>
        <div class="fb-r"><span class="eyebrow">Как это устроено</span>${flow()}
          <ul class="fb-facts"><li>Ключ шифруется AES-256, мастер-ключ лежит в хранилище ОС</li><li>На сайт уходят позиции, деньги и сделки</li><li>Сервер БРОКЕД ключ не получает и не хранит</li></ul></div>
      </div>`;
      $('#fb-list').onclick = e => { const b = e.target.closest('[data-fbpick]'); if (b) B.Desk.connectWizard(b.dataset.fbpick); };
    }
  }
  function runInstall() {
    const btn = $('#ins-run') || $('#ins-go'), pr = $('#ins-prog'), log = $('#ins-log'); if (!btn || btn.disabled) return;
    if (btn.dataset.run) { setDeskOnb('login'); return; }
    btn.disabled = true; btn.textContent = 'Установка…'; pr.hidden = false;
    const lines = ['Файлы распакованы', 'Создано зашифрованное хранилище ключей', 'Ярлык добавлен на рабочий стол'];
    let i = 0; const iv = setInterval(() => {
      if (!log.isConnected) { clearInterval(iv); return; }
      log.insertAdjacentHTML('beforeend', `<li>✓ ${lines[i]}</li>`); i++; pr.firstElementChild.style.width = (i / lines.length * 100) + '%';
      if (i >= lines.length) { clearInterval(iv); btn.disabled = false; btn.textContent = 'Запустить БРОКЕД'; btn.dataset.run = '1'; btn.id = 'ins-run'; }
    }, B.reduced ? 60 : 420);
  }
  // первый брокер подключён: пустые экраны больше не нужны, время пошло
  B.on('connect', () => {
    if (Onb.desk) { setDeskOnb(null); B.Desk.go('accounts'); }
    if (Onb.web) { setWebOnb(null); B.Web.resetFilter(); B.Web.go('portfolio'); }
    else { B.Web.resetFilter(); B.Web.refreshFilters && B.Web.refreshFilters(); }
    if (Guide.on && App.paused) App.play(true);
  });

  /* ---------- путь клиента: нижняя панель с шагами и рамка вокруг нужного элемента ---------- */
  const Guide = B.Guide = { on: false, i: 0, flags: {}, t0: 0 };
  const vis = sel => { const el = sel && $(sel); if (!el) return null; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? el : null; };
  const firstVis = (...sels) => { for (const s of sels) if (vis(s)) return s; return null; };
  function bestTradeBroker() {
    const rows = B.BROKERS.map(br => ({ br, cash: B.ACCOUNTS.filter(a => a.broker === br.id && !a.fut).reduce((s, a) => s + B.freeCash(a.id), 0) })).sort((a, b) => b.cash - a.cash);
    return rows.length ? rows[0].br.id : null;
  }
  function prepBuy() {
    const S = B.S();
    const accs = B.ACCOUNTS.filter(a => !a.fut && S.trade[a.id]).sort((a, b) => B.freeCash(b.id) - B.freeCash(a.id));
    if (!accs.length) { B.Desk.go('accounts'); B.toast('#d-toasts', 'Сначала выдайте ключ на торговлю и включите торговлю по счёту', 'warn'); return false; }
    const acc = accs[0].id; const cash = B.freeCash(acc);
    const all = B.INSTR.filter(i => i.type === 'stock').map(i => ({ i, lotCost: B.quote(i.t).ask * i.lot })).sort((a, b) => b.lotCost - a.lotCost);
    const cands = all.filter(x => x.lotCost * 2 < cash * 0.5);
    const c = cands[Math.floor(cands.length / 2)] || cands[0] || all[all.length - 1];
    const lots = Math.max(1, Math.min(Math.floor(60000 / c.lotCost), Math.floor(cash * 0.3 / c.lotCost)));
    Guide.buy = { acc, t: c.i.t };
    if (B.Desk.screen !== 'terminal') B.Desk.go('terminal');
    B.Desk.t.side = 'buy'; B.Desk.t.type = 'market';
    B.Desk.select(c.i.t, { acc, side: 'buy', type: 'market', lots, ticket: true });
    return true;
  }
  const rebStage = () => { const D = B.Desk, W = B.Web; return D.planState === 'done' ? 'done' : D.planState === 'run' ? 'run' : D.plan ? 'app' : W.plan ? (W.plan.rows.length ? 'send' : 'none') : 'calc'; };

  const STEPS = [
    { id: 'landing', ch: 0, mode: 'web', title: 'Клиент приходит на сайт',
      text: 'Это лендинг: что такое БРОКЕД и чем он отличается. Нажмите «Создать аккаунт».',
      target: () => '#lp-cta', check: () => Onb.web !== 'landing', auto: () => setWebOnb('signup') },
    { id: 'signup', ch: 0, mode: 'web', title: 'Регистрация',
      text: 'Поля уже заполнены демо-данными. Ключи брокеров на сайте не спрашивают. Нажмите «Зарегистрироваться».',
      target: () => '#su-go', check: () => Onb.web !== 'signup' && Onb.web !== 'landing', auto: () => { if (Onb.web === 'landing') setWebOnb('signup'); const f = $('#su-form'); if (f) f.requestSubmit(); } },
    { id: 'download', ch: 1, mode: 'web', title: 'Пустой кабинет',
      text: 'Аккаунт есть, а данных нет: сайт сам к брокерам не ходит. Скачайте приложение для ПК.',
      target: () => '#onb-dl', check: () => Onb.desk !== 'none', auto: startDownload },
    { id: 'install', ch: 1, mode: 'desk', title: 'Установка приложения',
      text: 'Установщик открылся на компьютере клиента. Нажмите «Установить», а потом «Запустить БРОКЕД».',
      target: () => firstVis('#ins-run', '#ins-go'), check: () => Onb.desk !== 'install' && Onb.desk !== 'none', auto: () => { const b = $('#ins-run') || $('#ins-go'); if (b) b.click(); } },
    { id: 'login', ch: 1, mode: 'desk', title: 'Вход в приложение',
      text: 'Тот же аккаунт, что на сайте. После входа лицензия привязывается к этому ПК.',
      target: () => '#lg-go', check: () => Onb.desk !== 'login' && Onb.desk !== 'install' && Onb.desk !== 'none', auto: () => { const f = $('#lg-form'); if (f) f.requestSubmit(); } },
    { id: 'link1', ch: 2, mode: 'desk', title: 'Первый брокер, ключ «только чтение»',
      text: 'Выберите брокера, оставьте права «Только чтение» и нажмите «Проверить и подключить». Ключ шифруется и остаётся на ПК.',
      target: () => firstVis('#wz-done', '#wz-check', '.wz-modal .modal', '#fb-list'), check: () => B.BROKERS.length >= 1 && !B.Desk.wizard,
      auto: () => {
        if (B.BROKERS.length) { if (B.Desk.wizard) B.Desk.wizard.close(); return; }
        if (vis('#wz-check')) { $('#wz-check').click(); return; }
        if (vis('#wz-log')) return; // проверка ключа уже идёт
        if (B.Desk.wizard) B.Desk.wizard.close();
        B.Desk.connectWizard(B.ALL_BROKERS[0].id, { fast: true });
      } },
    { id: 'site1', ch: 2, mode: 'web', manual: true, title: 'Портфель появился на сайте',
      text: () => `Счета первого брокера уже в кабинете: позиции, деньги и история. Ключ при этом остался в приложении.`,
      enter: () => { if (B.Web.screen !== 'portfolio') B.Web.go('portfolio'); }, target: () => '#w-stats', ready: () => B.Web.screen === 'portfolio' },
    { id: 'linkrest', ch: 2, mode: 'desk', title: 'Остальные брокеры',
      text: () => `Счета у клиента не в одном месте. Подключите остальных брокеров: «Счета и ключи», затем «+ Подключить брокера». Осталось: ${B.unlinked().map(b => b.short).join(', ') || 'никого'}.`,
      enter: () => { if (B.Desk.screen !== 'accounts') B.Desk.go('accounts'); }, target: () => firstVis('#wz-done', '#wz-check', '.wz-modal .modal', '#acc-connect'),
      check: () => B.unlinked().length === 0 && !B.Desk.wizard,
      auto: () => { if (B.Desk.wizard) B.Desk.wizard.close(); const n = B.unlinked().length; B.unlinked().forEach(b => B.linkBroker(b.id, 'read')); if (B.Desk.screen !== 'accounts') B.Desk.go('accounts'); else B.Desk.update(true); if (n) B.toast('#d-toasts', '<b>Все брокеры подключены</b><br>Ключи «только чтение», счета уже на сайте', 'good', 4500); } },
    { id: 'analytics', ch: 3, mode: 'web', manual: true, title: 'Все счета в одном окне',
      text: () => { const n = B.ACCOUNTS.length; return `${B.BROKERS.length} ${plural(B.BROKERS.length, 'брокер', 'брокера', 'брокеров')}, ${n} ${plural(n, 'счёт', 'счёта', 'счетов')}, один портфель на ${B.rub(B.snapshot(allFilter()).value, 0)}. Откройте «Аналитику»: доходность, структура и сравнение с индексом по всему капиталу сразу.`; },
      target: () => B.Web.screen === 'analytics' ? '#w-chartcard' : '.site-nav [data-nav="analytics"]', ready: () => B.Web.screen === 'analytics', show: () => B.Web.go('analytics') },
    { id: 'tradekey', ch: 4, mode: 'desk', title: 'Ключ на торговлю',
      text: 'Пока приложение только читает счета. Чтобы торговать, клиент отдельно и осознанно выдаёт торговый ключ. Нажмите «Выдать ключ на торговлю» у любого брокера.',
      enter: () => { if (B.Desk.screen !== 'accounts') B.Desk.go('accounts'); }, target: () => firstVis('#tkm-yes:not(:disabled)', '.tkm .tk-check', '[data-tkey]'),
      check: () => B.BROKERS.some(b => B.S().rights[b.id] === 'trade') && !B.Desk.tkm,
      auto: () => { if (B.Desk.tkm) B.Desk.tkm.close(); const id = bestTradeBroker(); if (!id) return; B.setRights(id, 'trade'); if (B.Desk.screen !== 'accounts') B.Desk.go('accounts'); else B.Desk.update(true); B.toast('#d-toasts', `<b>Торговля включена: ${B.BMAP[id].name}</b>`, 'good'); } },
    { id: 'buy', ch: 4, mode: 'desk', title: 'Первая сделка',
      text: 'Это терминал: одна заявка для любого подключённого брокера. Форма уже заполнена, нажмите зелёную кнопку покупки.',
      enter: () => { prepBuy(); }, target: () => firstVis('#tk-go', '.tk-modal .modal') || (B.Desk.screen === 'terminal' ? '#d-chart' : '#d-nav-terminal'),
      check: () => !!Guide.flags.bought, show: () => { if (!$('#tk-go')) prepBuy(); },
      auto: () => { if (!$('#tk-go') && !prepBuy()) return; const b = $('#tk-go'); if (b) b.click(); } },
    { id: 'seetrade', ch: 4, mode: 'web', manual: true, title: 'Сделка уже на сайте',
      text: 'Покупка пришла из приложения сама, с пометкой «из приложения». Стоимость и структура портфеля пересчитаны.',
      enter: () => { if (B.Web.screen !== 'portfolio') B.Web.go('portfolio'); }, target: () => '#w-feed', ready: () => B.Web.screen === 'portfolio' },
    { id: 'rebalance', ch: 5, mode: () => (rebStage() === 'app' || rebStage() === 'run') ? 'desk' : 'web', title: 'Ребалансировка',
      text: () => ({ calc: 'Клиент задаёт целевую структуру, сайт считает сделки. Нажмите «Рассчитать план».', send: 'План готов: видно, что и у какого брокера купить. Нажмите «Передать план в приложение».', none: 'Портфель уже соответствует цели, сделки не нужны. Можно идти дальше.', app: 'Сайт сам не торгует: план пришёл в приложение. Проверьте его и нажмите «Исполнить».', run: 'Приложение отправляет заявки брокерам по очереди…', done: 'Готово.' })[rebStage()],
      enter: () => { if (App.mode === 'web' && rebStage() !== 'app') B.Web.go('rebalance'); if (App.mode === 'desk' && B.Desk.plan && B.Desk.screen !== 'rebalance') B.Desk.go('rebalance'); },
      target: () => ({ calc: '#reb-calc', send: '#reb-send', none: '#reb-plan', app: '#rb-run', run: '#d-reb', done: null })[rebStage()],
      check: () => rebStage() === 'done' || !!Guide.flags.rebSkip, manualWhen: () => rebStage() === 'none',
      auto: () => { const st = rebStage(), b = st === 'calc' ? $('#reb-calc') : st === 'send' ? $('#reb-send') : st === 'app' ? $('#rb-run') : null; if (st === 'none') Guide.flags.rebSkip = true; else if (b) b.click(); else if (st === 'calc') B.Web.go('rebalance'); } },
  ];
  function plural(n, one, few, many) { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; }
  const modeOf = s => typeof s.mode === 'function' ? s.mode() : s.mode;
  const MODE_NAME = { web: 'Сайт', desk: 'Приложение для ПК' };

  Guide.start = function () {
    Guide.stop();
    B.init(); B.Web.resetFilter(); B.Web.target = null; B.Web.plan = null;
    B.Desk.plan = null; B.Desk.planState = null; B.Desk.t.acc = null; B.Desk.sel = 'ZNTH';
    B.unlinkAll(); B.Web.resetFilter();
    if (App.mode !== 'web') App.setMode('web');
    B.Web.go('portfolio'); B.Desk.go('terminal');
    B.Web.rebMode = 'full';
    setWebOnb('landing'); setDeskOnb('none');
    App.play(false);
    Guide.on = true; Guide.i = 0; Guide.flags = {}; Guide.t0 = Date.now(); Guide.key = null; Guide.sig = null; Guide.entered = null; Guide.busy = false;
    let g = $('#guide'); if (!g) { g = document.createElement('div'); g.id = 'guide'; g.className = 'guide'; g.setAttribute('role', 'region'); g.setAttribute('aria-label', 'Путь клиента'); document.body.appendChild(g); const r = document.createElement('div'); r.id = 'g-ring'; r.hidden = true; document.body.appendChild(r); }
    g.hidden = false; document.documentElement.classList.add('guided');
    g.onclick = onGuideClick;
    if (window.ResizeObserver && !Guide.ro) { Guide.ro = new ResizeObserver(() => document.documentElement.style.setProperty('--guide-h', (g.hidden ? 0 : g.offsetHeight) + 'px')); Guide.ro.observe(g); }
    renderGuide(true);
    const loop = () => { if (!Guide.on) return; tick(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    renderClock();
  };
  Guide.stop = function () {
    Guide.on = false;
    const g = $('#guide'); if (g) g.hidden = true; const r = $('#g-ring'); if (r) r.hidden = true;
    document.documentElement.classList.remove('guided'); document.documentElement.style.setProperty('--guide-h', '0px');
  };
  // выход из пути: всё подключается, как в готовом кабинете
  function freeMode() {
    Guide.stop();
    if (B.Desk.wizard) B.Desk.wizard.close(); if (B.Desk.tkm) B.Desk.tkm.close();
    B.unlinked().forEach(b => B.linkBroker(b.id, 'trade'));
    B.BROKERS.forEach(b => { if (B.S().rights[b.id] !== 'trade') B.setRights(b.id, 'trade'); });
    setWebOnb(null); setDeskOnb(null);
    B.Web.resetFilter(); B.Web.go(B.Web.screen); B.Desk.go(B.Desk.screen);
    App.play(true);
  }
  function onGuideClick(e) {
    const b = e.target.closest('button'); if (!b || Guide.busy) return;
    const s = STEPS[Guide.i]; if (!s) return;
    if (b.id === 'g-skip') { freeMode(); B.toast(App.mode === 'web' ? '#w-toasts' : '#d-toasts', 'Путь пропущен: все брокеры подключены, можно исследовать самостоятельно', 'info', 4500); return; }
    if (b.id === 'g-back') { App.setMode(modeOf(s)); return; }
    const need = modeOf(s);
    if (b.id === 'g-show') { goThere(s); return; }
    if (b.id === 'g-next') {
      if (App.mode !== need || (s.ready && !s.ready())) { goThere(s); return; }
      if (s.manualWhen && s.manualWhen()) { s.auto(); return; }
      advance();
    }
    if (b.id === 'g-auto') { if (App.mode !== need) App.setMode(need); enter(s, true); s.auto(); }
  }
  function goThere(s) {
    const need = modeOf(s); if (App.mode !== need) App.setMode(need);
    enter(s, true); if (s.show) s.show();
    Guide.key = null;
  }
  function enter(s, force) {
    const k = Guide.i + ':' + App.mode; if (!force && Guide.entered === k) return;
    Guide.entered = k; if (s.enter && App.mode === modeOf(s)) s.enter();
  }
  function advance() {
    if (Guide.busy) return; Guide.busy = true;
    const g = $('#guide'); if (g) g.classList.add('done');
    setTimeout(() => {
      Guide.busy = false; if (g) g.classList.remove('done'); if (!Guide.on) return;
      Guide.i++; Guide.key = null; Guide.entered = null;
      if (Guide.i >= STEPS.length) { finale(); return; }
      renderGuide(true);
    }, B.reduced ? 60 : 520);
  }
  function renderGuide(full) {
    const g = $('#guide'), s = STEPS[Guide.i]; if (!g || !s) return;
    const need = modeOf(s), away = App.mode !== need;
    const text = typeof s.text === 'function' ? s.text() : s.text;
    const manual = s.manual || (s.manualWhen && s.manualWhen());
    const ready = !away && (!s.ready || s.ready());
    const sig = [Guide.i, away, text, manual, ready].join('|');
    if (!full && sig === Guide.sig) return; Guide.sig = sig;
    g.innerHTML = `
      <ol class="g-ch" aria-label="Этапы пути">${CHAPTERS.map(([n], i) => `<li class="${i < s.ch ? 'ok' : i === s.ch ? 'on' : ''}"><i>${i < s.ch ? '✓' : i + 1}</i><span>${n}</span></li>`).join('')}</ol>
      <div class="g-body"><span class="g-n">Шаг ${Guide.i + 1} из ${STEPS.length}${away ? ` · <b>перейдите в «${MODE_NAME[need]}»</b>` : ''}</span><h3>${s.title}</h3><p>${text}</p></div>
      <div class="g-act"><button class="link" id="g-skip">Пропустить путь</button>
        ${manual ? `<button class="btn-g sm" id="g-next">${ready ? 'Дальше' : away ? 'Открыть «' + MODE_NAME[need] + '»' : 'Показать'}</button>`
          : `<button class="btn-g sm ghost" id="g-show">Показать, где</button><button class="btn-g sm" id="g-auto">Сделать за меня</button>`}</div>
      <div class="g-bar"><i style="width:${(Guide.i / STEPS.length * 100).toFixed(1)}%"></i></div>`;
  }
  let lastCheck = 0;
  function tick() {
    const s = STEPS[Guide.i]; if (!s) return;
    const now = performance.now();
    if (now - lastCheck > 150 && !Guide.busy) {
      lastCheck = now;
      if (!s.manual && s.check && s.check()) { advance(); return; }
      if (App.mode === modeOf(s)) enter(s);
      renderGuide(false);
    }
    placeRing(s);
  }
  function placeRing(s) {
    const ring = $('#g-ring'); if (!ring) return;
    const need = modeOf(s);
    let sel = App.mode !== need ? `.db-switch [data-mode="${need}"]` : (s.target ? s.target() : null);
    const el = Guide.busy ? null : vis(sel);
    if (!el) { ring.hidden = true; return; }
    if (Guide.key !== sel) {
      Guide.key = sel;
      const r0 = el.getBoundingClientRect(); const bar = $('.demo-bar'), g = $('#guide');
      const top = bar ? bar.getBoundingClientRect().bottom : 0, bot = innerHeight - (g ? g.offsetHeight : 0);
      if (r0.top < top + 8 || r0.bottom > bot - 8) el.scrollIntoView({ block: r0.height > (bot - top) * 0.7 ? 'start' : 'center', behavior: B.reduced ? 'auto' : 'smooth' });
    }
    const er = el.getBoundingClientRect(); const pad = 6; const rad = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    const bar = $('.demo-bar'), g = $('#guide'); const m = 6;
    let L = m, T = (bar && !el.closest('.demo-bar') ? bar.getBoundingClientRect().bottom : 0) + m, R = innerWidth - m, Bt = innerHeight - (g ? g.offsetHeight : 0) - m;
    const sc = el.closest('.modal, .aw-main, .site');
    if (sc && innerWidth > 980) { const c = sc.getBoundingClientRect(); L = Math.max(L, c.left + 2); T = Math.max(T, c.top + 2); R = Math.min(R, c.right - 2); Bt = Math.min(Bt, c.bottom - 2); }
    // липкая шапка сайта закрывает верх прокручиваемой области: рамка не должна на неё заезжать
    const sh = sc && sc.classList.contains('site') && !el.closest('.site-head') && sc.querySelector(':scope > .site-head');
    if (sh && getComputedStyle(sh).position === 'sticky' && sh.offsetHeight) T = Math.max(T, sh.getBoundingClientRect().bottom + 4);
    const x1 = Math.max(er.left - pad, L), y1 = Math.max(er.top - pad, T), x2 = Math.min(er.right + pad, R), y2 = Math.min(er.bottom + pad, Bt);
    if (x2 - x1 < 20 || y2 - y1 < 20) { ring.hidden = true; return; }
    ring.hidden = false;
    Object.assign(ring.style, { left: x1 + 'px', top: y1 + 'px', width: (x2 - x1) + 'px', height: (y2 - y1) + 'px', borderRadius: (rad ? Math.min(rad + pad, 34) : 12) + 'px' });
  }
  // Та же Google-таблица, что и у форм лендинга (Apps Script)
  const FEEDBACK_URL = 'https://script.google.com/macros/s/AKfycbyChZqdywa2G9eK2qW3UskL-0WVUiueKzcmLva8crNjA908nAFF8qJiyc6CYjttaxMK/exec';
  function finale() {
    const S = B.S(); const snap = B.snapshot(allFilter());
    const sec = Math.round((Date.now() - Guide.t0) / 1000);
    const deals = S.ops.filter(o => o.k === 'trade' && (o.src === 'manual' || o.src === 'rebalance')).length;
    Guide.stop();
    const m = B.modal(`<div class="intro fin">
        <div class="intro-logo">${B.logoIcon(56)}${B.wordmark()}</div>
        <span class="eyebrow">Путь клиента пройден за ${sec >= 60 ? Math.floor(sec / 60) + ' мин ' : ''}${sec % 60} с</span>
        <h2>От пустого кабинета до управляемого портфеля</h2>
        <div class="fin-grid">
          <div><b class="num">${B.BROKERS.length}</b><span>${plural(B.BROKERS.length, 'брокер', 'брокера', 'брокеров')} в одном окне</span></div>
          <div><b class="num">${B.ACCOUNTS.length}</b><span>${plural(B.ACCOUNTS.length, 'счёт', 'счёта', 'счетов')} в одном портфеле</span></div>
          <div><b class="num">${deals}</b><span>${plural(deals, 'сделка', 'сделки', 'сделок')} из приложения</span></div>
          <div class="key"><b class="num">0</b><span>ключей на сервере</span></div>
        </div>
        <p class="lead">Капитал ${B.rub(snap.value, 0)} теперь виден целиком. Сайт получил только позиции и деньги, а ключи и заявки остались на компьютере клиента.</p>
        <form class="fb" id="fin-fb" novalidate>
          <b class="fb-h">Как вам демо? Оцените, это займёт 10 секунд</b>
          <div class="fb-stars" role="radiogroup" aria-label="Оценка">${[1,2,3,4,5].map(n => `<button type="button" data-v="${n}" aria-label="${n} из 5">★</button>`).join('')}</div>
          <textarea name="message" rows="2" maxlength="1000" placeholder="Что понравилось, чего не хватило, что непонятно?"></textarea>
          <div class="fb-row"><input name="contact" maxlength="120" placeholder="Telegram или e-mail, если хотите ответа (необязательно)"><button class="btn-g" type="submit">Отправить</button></div>
          <span class="fb-note"></span>
        </form>
        <div class="intro-go"><a class="btn-g big" href="../#beta">Хочу ранний доступ</a><button class="btn-g ghost big" id="fin-free">Исследовать самостоятельно</button></div>
        <button class="link" id="fin-again">Пройти путь заново</button>
      </div>`, { cls: 'intro-wrap', onClose: () => { if (!Guide.on) freeMode(); } });
    m.el.querySelector('#fin-free').onclick = () => m.close();
    m.el.querySelector('#fin-again').onclick = () => { m.close(); Guide.start(); };
    const fb = m.el.querySelector('#fin-fb'); let rate = 0;
    const note = (t, k) => { const n = fb.querySelector('.fb-note'); n.textContent = t; n.className = 'fb-note ' + (k || ''); };
    fb.querySelectorAll('.fb-stars button').forEach(b => b.onclick = () => {
      rate = +b.dataset.v; fb.querySelectorAll('.fb-stars button').forEach(x => x.classList.toggle('on', +x.dataset.v <= rate)); note('');
    });
    fb.onsubmit = e => {
      e.preventDefault();
      const text = fb.message.value.trim();
      if (!rate && !text) { note('Поставьте оценку или напишите пару слов', 'warn'); return; }
      const data = {
        formType: 'Demo Feedback', contact: fb.contact.value.trim(),
        message: `Оценка: ${rate ? rate + '/5' : 'нет'}. ${text}`.trim() + ` [путь за ${sec} с, сделок: ${deals}]`,
        timestamp: new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }) + ' (МСК)'
      };
      const btn = fb.querySelector('[type=submit]'); btn.disabled = true;
      fetch(FEEDBACK_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data).toString() })
        .then(() => { fb.innerHTML = '<b class="fb-h">Спасибо! Отзыв отправлен команде БРОКЕД 💚</b>'; fb.classList.add('done'); })
        .catch(() => { btn.disabled = false; note('Не получилось отправить. Проверьте интернет и попробуйте ещё раз', 'warn'); });
    };
  }
  B.onUI(ev => {
    if (!Guide.on) return;
    const s = STEPS[Guide.i];
    if (ev === 'order:placed' && s && s.id === 'buy') Guide.flags.bought = true;
    if (ev.startsWith('mode:')) { Guide.key = null; renderGuide(true); }
  });

  /* ---------- сборка ---------- */
  function boot() {
    const root = $('#app');
    root.innerHTML = `
      <header class="demo-bar">
        <div class="db-brand"><a class="db-home" href="../" title="На главную страницу БРОКЕД">${B.logoIcon(28)}${B.wordmark()}</a><span class="db-demo">Демо · данные вымышлены</span><a class="db-site" href="../">← На сайт</a></div>
        <div class="db-switch" role="tablist" aria-label="Компонент продукта">
          <button data-mode="web" role="tab" class="on" aria-selected="true"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 9h18" stroke="currentColor" stroke-width="2"/></svg>Сайт<em id="web-badge" hidden></em></button>
          <span class="sync-link" id="sync-link" aria-hidden="true"><i></i><i></i><i></i></span>
          <button data-mode="desk" role="tab" aria-selected="false"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 20h8M12 16v4" stroke="currentColor" stroke-width="2"/></svg>Приложение для ПК</button>
        </div>
        <div class="db-ctl">
          <div class="db-clock" id="db-clock"></div>
          <button class="db-btn" id="db-play"></button>
          <span class="db-speed" aria-label="Скорость времени"><button data-speed="1">1×</button><button data-speed="4">4×</button></span>
          <button class="db-btn ghost" id="db-tour">Путь клиента</button>
          <button class="db-btn ghost" id="db-new" title="Новый случайный портфель">Новая игра</button>
        </div>
      </header>
      <main class="stage">
        <section id="web-frame" class="browser" aria-label="Сайт БРОКЕД"></section>
        <section id="desk-frame" class="appwin" aria-label="Приложение БРОКЕД для ПК" hidden></section>
      </main>`;
    // высота панели демо – чтобы меню приложения прилипало сразу под ней
    const bar = $('.demo-bar'); const setBar = () => document.documentElement.style.setProperty('--bar-h', bar.offsetHeight + 'px');
    setBar(); if (window.ResizeObserver) new ResizeObserver(setBar).observe(bar);
    B.Web.mount($('#web-frame'));
    B.Desk.mount($('#desk-frame'));
    $('#web-frame .site').insertAdjacentHTML('beforeend', '<div id="w-onb" class="w-onb" hidden></div>');
    // уведомления сайта живут в окне браузера, а не в прокручиваемой странице: иначе они уезжают вместе с контентом
    $('#web-frame').appendChild($('#w-toasts'));
    $('#desk-frame .aw-body').insertAdjacentHTML('beforebegin', '<div id="d-onb" class="aw-onb" hidden></div>');
    $('.db-switch').addEventListener('click', e => { const b = e.target.closest('[data-mode]'); if (b) App.setMode(b.dataset.mode); });
    $('#db-play').onclick = () => App.play(App.paused);
    $$('[data-speed]').forEach(b => b.onclick = () => App.setSpeed(+b.dataset.speed));
    $('#db-tour').onclick = () => { Guide.start(); };
    $('#db-new').onclick = () => { newGame(); intro(); };

    B.on('tick', schedule);
    B.on('trade', op => {
      const S = B.S();
      if (S.sync[op.acc] && op.k === 'trade' && (op.src === 'manual' || op.src === 'rebalance')) {
        const l = $('#sync-link'); l.classList.remove('pulse'); void l.offsetWidth; l.classList.add('pulse');
        const ds = $('#d-sync'); if (ds) { ds.classList.remove('pulse'); void ds.offsetWidth; ds.classList.add('pulse'); }
        if (App.mode === 'desk') { App.unseen++; badge(); }
      }
      schedule();
    });
    B.on('order', schedule); B.on('sync', schedule); B.on('connect', schedule);
    window.addEventListener('resize', () => { B.Web.update(true); B.Desk.update(true); });
    document.addEventListener('keydown', e => { if (e.code === 'Space' && !e.target.closest('input,select,textarea,button')) { e.preventDefault(); App.play(App.paused); } });

    newGame();
    intro();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.B);
