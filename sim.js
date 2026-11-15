/* БрокЕд демо — движок симуляции. Все бумаги, брокеры и котировки вымышленные. */
window.B = window.B || {};
(function (B) {
  'use strict';

  /* ---------- случайность ---------- */
  function mulberry(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let rnd = Math.random;
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const r2 = v => Math.round(v * 100) / 100;

  /* ---------- справочники ---------- */
  const TPD = 40;     // тиков в торговом дне
  const HIST = 120;   // дней истории до старта игры

  const INSTR = [
    { t: 'VLKN', n: 'Вулкан Энерго', type: 'stock', sector: 'Нефть и газ', lot: 10, p0: 412.5, step: 0.1, vol: 0.014, beta: 1.0, drift: 0.0003, color: '#F59E0B', pe: 5.8, dy: 9.2 },
    { t: 'ZNTH', n: 'Зенит Банк', type: 'stock', sector: 'Финансы', lot: 10, p0: 287.6, step: 0.05, vol: 0.012, beta: 1.15, drift: 0.0004, color: '#38BDF8', pe: 4.1, dy: 11.5 },
    { t: 'NBLA', n: 'Небула Софт', type: 'stock', sector: 'IT', lot: 1, p0: 4850, step: 1, vol: 0.022, beta: 1.35, drift: 0.0008, color: '#C084FC', pe: 22.4, dy: 0.8 },
    { t: 'MRDN', n: 'Меридиан Телеком', type: 'stock', sector: 'Телеком', lot: 10, p0: 238.1, step: 0.05, vol: 0.010, beta: 0.7, drift: 0.0002, color: '#F472B6', pe: 9.7, dy: 7.1 },
    { t: 'KRST', n: 'Кристалл Металл', type: 'stock', sector: 'Металлы', lot: 1, p0: 1540, step: 0.5, vol: 0.017, beta: 1.1, drift: 0.0001, color: '#94A3B8', pe: 7.3, dy: 6.4 },
    { t: 'AVRR', n: 'Аврора Ритейл', type: 'stock', sector: 'Потребительский', lot: 1, p0: 3120, step: 1, vol: 0.013, beta: 0.85, drift: 0.0005, color: '#FB7185', pe: 12.9, dy: 4.0 },
    { t: 'SVTR', n: 'Северный Транзит', type: 'stock', sector: 'Транспорт', lot: 100, p0: 86.42, step: 0.01, vol: 0.019, beta: 1.2, drift: 0.0, color: '#2DD4BF', pe: 6.2, dy: 3.3 },
    { t: 'GS29', n: 'ГосОблигация 2029', type: 'bond', sector: 'Гос. облигации', lot: 1, p0: 931.4, step: 0.1, vol: 0.0016, beta: 0.08, drift: 0.00025, color: '#86EFAC', coupon: 8.5, mat: '15.08.2029' },
    { t: 'GS36', n: 'ГосОблигация 2036', type: 'bond', sector: 'Гос. облигации', lot: 1, p0: 812.6, step: 0.1, vol: 0.0035, beta: 0.15, drift: 0.0003, color: '#4ADE80', coupon: 7.1, mat: '20.03.2036' },
    { t: 'VLB3', n: 'Вулкан Энерго БО-03', type: 'bond', sector: 'Корп. облигации', lot: 1, p0: 986.0, step: 0.1, vol: 0.0022, beta: 0.1, drift: 0.0002, color: '#FCD34D', coupon: 12.4, mat: '01.06.2028' },
    { t: 'DIDX', n: 'ДемоИндекс БПИФ', type: 'fund', sector: 'Фонды', lot: 1, p0: 12.48, step: 0.01, vol: 0.002, beta: 1, drift: 0, color: '#A78BFA', ter: '0,6 %' },
    { t: 'GLDF', n: 'Фонд Золото', type: 'fund', sector: 'Фонды', lot: 1, p0: 21.7, step: 0.01, vol: 0.009, beta: -0.15, drift: 0.0004, color: '#FACC15', ter: '0,8 %' },
    { t: 'DIX-12', n: 'Фьючерс ДемоИндекс 12.26', type: 'fut', sector: 'Срочный рынок', lot: 1, p0: 3010, step: 1, vol: 0.002, beta: 1, drift: 0, color: '#60A5FA', mult: 10, go: 0.13, exp: '17.12.2026', under: 'ДемоИндекс' },
    { t: 'ENR-12', n: 'Фьючерс Энергосырьё 12.26', type: 'fut', sector: 'Срочный рынок', lot: 1, p0: 78.4, step: 0.01, vol: 0.02, beta: 0.4, drift: 0.0002, color: '#FB923C', mult: 100, go: 0.16, exp: '17.12.2026', under: 'Энергосырьё' },
  ];
  const IMAP = {}; INSTR.forEach(i => IMAP[i.t] = i);

  const CLASS = {
    stock: { name: 'Акции', color: '#A24DF0' },
    bond: { name: 'Облигации', color: '#50F08C' },
    fund: { name: 'Фонды', color: '#5EA8FF' },
    fut: { name: 'Срочный рынок', color: '#F7B84B' },
    cash: { name: 'Деньги', color: '#77737F' },
  };
  const CLS_KEYS = ['stock', 'bond', 'fund', 'fut', 'cash'];

  const BROKERS = [
    { id: 'sev', name: 'Брокер Север', short: 'Север', color: '#A24DF0', fee: 0.0005, feeText: '0,05 %', caps: { stop: true, take: true, oco: false, iceberg: true, fut: false, evening: true }, ping: 14 },
    { id: 'vos', name: 'Инвест Восток', short: 'Восток', color: '#5EA8FF', fee: 0.0004, feeText: '0,04 %', caps: { stop: true, take: true, oco: true, iceberg: false, fut: true, evening: true }, ping: 9 },
    { id: 'yug', name: 'Капитал Юг', short: 'Юг', color: '#F7B84B', fee: 0.003, feeText: '0,3 %', caps: { stop: false, take: false, oco: false, iceberg: false, fut: false, evening: false }, ping: 31 },
  ];
  const BMAP = {}; BROKERS.forEach(b => BMAP[b.id] = b);

  const ACCOUNTS = [
    { id: 'sev-b', broker: 'sev', name: 'Брокерский', num: '…4821', key: 'sk_live_••••••••••a91F' },
    { id: 'sev-i', broker: 'sev', name: 'ИИС', num: '…1907', key: 'sk_live_••••••••••a91F' },
    { id: 'vos-b', broker: 'vos', name: 'Брокерский', num: '…3350', key: 't.••••••••••••Qm7x' },
    { id: 'vos-f', broker: 'vos', name: 'Срочный рынок', num: '…7712', fut: true, key: 't.••••••••••••Qm7x' },
    { id: 'yug-b', broker: 'yug', name: 'Брокерский', num: '…0264', key: 'yg-••••••••••••3c0d' },
  ];
  const ACCMAP = {}; ACCOUNTS.forEach(a => ACCMAP[a.id] = a);
  // полный список демо-брокеров: в «пути клиента» они подключаются по одному, а BROKERS и ACCOUNTS хранят только подключённых
  const ALL_BROKERS = BROKERS.slice(), ALL_ACCOUNTS = ACCOUNTS.slice();
  const known = () => ALL_ACCOUNTS.concat(ACCMAP['zap-b'] ? [ACCMAP['zap-b']] : []);

  const STRATS = {
    cons: { name: 'Консервативная', short: 'Консерватор', w: { stock: 0.2, bond: 0.58, fund: 0.15, fut: 0, cash: 0.07 }, k: { stock: 2, bond: 3, fund: 1 }, text: 'Основа – облигации, немного акций и фонд. Срочный рынок не используется.' },
    mod: { name: 'Умеренная', short: 'Умеренный', w: { stock: 0.44, bond: 0.3, fund: 0.12, fut: 0.07, cash: 0.07 }, k: { stock: 4, bond: 2, fund: 2 }, text: 'Акции и облигации примерно поровну, небольшая позиция во фьючерсе на индекс.' },
    aggr: { name: 'Агрессивная', short: 'Агрессор', w: { stock: 0.62, bond: 0.07, fund: 0.08, fut: 0.15, cash: 0.08 }, k: { stock: 6, bond: 1, fund: 1 }, text: 'Ставка на рост акций и фьючерсы, облигаций почти нет.' },
  };

  const NEWS_POS = ['{n}: квартальная прибыль выше прогнозов', '{n} объявила обратный выкуп акций', '{n} получила крупный контракт', 'Аналитики повысили целевую цену {n}', '{n} утвердила рекордные дивиденды'];
  const NEWS_NEG = ['{n}: выручка снизилась на 8 % год к году', 'Регулятор начал проверку {n}', '{n} перенесла запуск ключевого проекта', 'Рейтинговое агентство ухудшило прогноз по {n}', 'Крупный акционер {n} продаёт пакет'];
  const NEWS_MKT_POS = ['Демо-ЦБ неожиданно снизил ключевую ставку', 'Приток частных инвесторов на биржу – рекорд месяца', 'Индекс растёт на сильной макростатистике'];
  const NEWS_MKT_NEG = ['Демо-ЦБ ужесточил риторику по ставке', 'Индекс снижается на слабой промышленной статистике', 'Инвесторы фиксируют прибыль перед выходными'];

  /* ---------- даты ---------- */
  const D0 = new Date(2026, 3, 20);
  const dateCache = [];
  function dateOf(day) {
    if (dateCache[day]) return dateCache[day];
    let d = new Date(D0), n = 0;
    while (n < day) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) n++; }
    dateCache[day] = d; return d;
  }
  const WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  B.dateShort = day => { const d = dateOf(day); return d.getDate() + ' ' + MON[d.getMonth()]; };
  B.dateFull = day => { const d = dateOf(day); return WD[d.getDay()] + ', ' + String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear(); };
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  B.isoOf = day => iso(dateOf(day));
  // дата из поля ввода -> торговый день; выходные сдвигаются на пятницу
  B.dayOfIso = str => { let d = 0; while (d < S.day && iso(dateOf(d + 1)) <= str) d++; return d; };
  B.timeOf = tick => { const m = 600 + Math.round(tick * 520 / TPD); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

  /* ---------- состояние ---------- */
  let S;
  const listeners = {};
  B.on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
  const emit = (ev, data) => (listeners[ev] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });

  function emptyState() { return { cash: 0, dep: 0, income: 0, realized: 0, fees: 0, pos: {} }; }
  const newCandle = p => ({ o: p, h: p, l: p, c: p });

  /* ---------- учёт операций ---------- */
  function applyOp(st, op) {
    switch (op.k) {
      case 'dep': st.cash += op.amt; st.dep += op.amt; break;
      case 'wd': st.cash -= op.amt; st.dep -= op.amt; break;
      case 'inc': st.cash += op.amt; st.income += op.amt; break;
      case 'fee': st.cash -= op.amt; st.fees += op.amt; break;
      case 'trade': {
        const ins = IMAP[op.t]; const fut = ins.type === 'fut'; const m = fut ? ins.mult : 1;
        const p = st.pos[op.t] || (st.pos[op.t] = { qty: 0, cost: 0, go: 0 });
        st.cash -= op.qty * op.price * m + op.fee; st.fees += op.fee;
        const q0 = p.qty, q = op.qty;
        if (q0 === 0 || Math.sign(q0) === Math.sign(q)) {
          p.qty += q; p.cost += q * op.price * m; if (fut) p.go += Math.abs(q) * op.price * m * ins.go;
        } else {
          const close = Math.min(Math.abs(q), Math.abs(q0)) * Math.sign(q);
          const avg = p.cost / q0; const goPer = p.go / Math.abs(q0);
          st.realized += -close * (op.price * m - avg);
          p.cost += close * avg; p.go -= Math.abs(close) * goPer; p.qty += close;
          const rest = q - close;
          if (rest !== 0) { p.qty += rest; p.cost += rest * op.price * m; if (fut) p.go += Math.abs(rest) * op.price * m * ins.go; }
        }
        if (Math.abs(p.qty) < 1e-9) delete st.pos[op.t];
        break;
      }
    }
  }

  function classesOf(st, priceOf) {
    const r = { stock: 0, bond: 0, fund: 0, fut: 0, cash: st.cash };
    for (const t in st.pos) {
      const p = st.pos[t], ins = IMAP[t];
      if (ins.type === 'fut') { const n = p.qty * priceOf(t) * ins.mult; r.fut += n - p.cost + p.go; r.cash += p.cost - p.go; }
      else r[ins.type] += p.qty * priceOf(t);
    }
    return r;
  }

  function addOp(op) {
    op.id = S.opId++;
    S.ops.push(op);
    applyOp(S.acc[op.acc], op);
    return op;
  }

  /* ---------- журнал сделок: портфели, которые пользователь ведёт вручную ---------- */
  // операции журнала лежат в общей ленте по дате, поэтому графики и метрики считаются так же, как для брокерских счетов
  B.journalCreate = id => { if (S.acc[id]) return; S.acc[id] = emptyState(); S.sync[id] = true; S.journals[id] = true; };
  B.isJournal = id => !!(S && S.journals && S.journals[id]);
  function replayJournal(id) { const st = emptyState(); S.ops.forEach(o => { if (o.acc === id) applyOp(st, o); }); S.acc[id] = st; }
  B.journalAdd = function (id, op) {
    B.journalCreate(id);
    op.acc = id; op.j = true; op.src = 'journal'; op.id = S.opId++;
    if (op.tick == null) op.tick = op.day < S.day ? TPD : S.tick;
    let i = S.ops.length; while (i > 0 && (S.ops[i - 1].day > op.day || (S.ops[i - 1].day === op.day && S.ops[i - 1].tick > op.tick))) i--;
    S.ops.splice(i, 0, op);
    replayJournal(id); emit('journal', id);
    return op;
  };
  B.journalRemove = function (id, opId) {
    const i = S.ops.findIndex(o => o.id === opId && o.acc === id); if (i < 0) return;
    S.ops.splice(i, 1); replayJournal(id); emit('journal', id);
  };
  B.journalDrop = id => { S.ops = S.ops.filter(o => o.acc !== id); delete S.acc[id]; delete S.journals[id]; delete S.sync[id]; };
  B.closeOf = (t, day) => day >= S.day ? S.prices[t] : S.hist[t][day].c;

  /* ---------- цены ---------- */
  function tickPrices() {
    const sd = Math.sqrt(1 / TPD);
    let mf = 0.0105 * sd * gauss() + 0.0004 / TPD;
    if (S.mshock) { mf += S.mshock.per; if (--S.mshock.n <= 0) S.mshock = null; }
    S.idx *= Math.exp(mf);
    const ic = S.idxCur; ic.c = S.idx; if (S.idx > ic.h) ic.h = S.idx; if (S.idx < ic.l) ic.l = S.idx;
    for (const ins of INSTR) {
      let r = ins.beta * mf + ins.vol * sd * gauss() + ins.drift / TPD;
      const sh = S.shocks[ins.t]; if (sh) { r += sh.per; if (--sh.n <= 0) delete S.shocks[ins.t]; }
      const p = Math.max(ins.step * 2, S.prices[ins.t] * Math.exp(r));
      S.prices[ins.t] = p;
      const c = S.cur[ins.t]; c.c = p; if (p > c.h) c.h = p; if (p < c.l) c.l = p;
    }
  }

  function makeNews(live) {
    if (rnd() < 0.25) {
      const pos = rnd() < 0.55;
      const arr = pos ? NEWS_MKT_POS : NEWS_MKT_NEG, tpl = Math.floor(rnd() * arr.length);
      const n = { day: S.day, tick: S.tick, text: arr[tpl], dir: pos ? 1 : -1, t: null, kind: pos ? 'mpos' : 'mneg', tpl };
      const total = (pos ? 1 : -1) * (0.008 + rnd() * 0.015);
      S.mshock = { per: total / 10, n: 10 };
      if (live) { S.news.unshift(n); emit('news', n); }
      return;
    }
    const ins = pick(INSTR.filter(i => i.type === 'stock'));
    const pos = rnd() < 0.55;
    const total = (pos ? 1 : -1) * (0.02 + rnd() * 0.035);
    S.shocks[ins.t] = { per: total / 10, n: 10 };
    const arr = pos ? NEWS_POS : NEWS_NEG, tpl = Math.floor(rnd() * arr.length);
    const n = { day: S.day, tick: S.tick, text: arr[tpl].replace('{n}', ins.n), dir: pos ? 1 : -1, t: ins.t, kind: pos ? 'pos' : 'neg', tpl };
    if (live) { S.news.unshift(n); if (S.news.length > 40) S.news.pop(); keepNews(n); emit('news', n); }
  }
  // архив новостей по каждой бумаге, чтобы в карточке бумаги не терялись старые
  function keepNews(n) { const a = S.newsBy[n.t] || (S.newsBy[n.t] = []); a.unshift(n); if (a.length > 30) a.pop(); }
  B.newsOf = t => (S.newsBy[t] || []);

  /* ---------- полный текст новости ----------
     Текст собирается из шаблонов: у каждого заголовка свой первый абзац, дальше общие абзацы
     про реакцию рынка и мнение аналитиков. Пропуски заполняются названием компании, сектором
     и случайными числами. Генератор чисел привязан к самой новости, поэтому при повторном
     открытии текст тот же, а ход игры (цены, сделки) от чтения новостей не меняется. */
  const NB = {
    pos: [
      ['{n} отчиталась за квартал: чистая прибыль выросла на {p1} % год к году и составила {b1} млрд ₽, что на {p2} % выше консенсус-прогноза аналитиков.', 'Компания {n} опубликовала квартальную отчётность. Прибыль превысила ожидания рынка на {p2} %, рентабельность выросла до {p3} %.'],
      ['Совет директоров {n} одобрил программу обратного выкупа акций на сумму до {b1} млрд ₽. Выкуп продлится {m} месяцев.', 'Компания {n} начинает выкуп собственных акций: на программу направят до {b1} млрд ₽, это около {p3} % капитализации.'],
      ['{n} подписала контракт на {b1} млрд ₽ сроком на {m} месяцев. Это крупнейшее соглашение в истории компании.', 'Компания {n} сообщила о новом долгосрочном контракте. Его объём оценивается в {b1} млрд ₽, поставки начнутся в следующем квартале.'],
      ['Аналитики компании {a} повысили целевую цену акций {n} на {p2} % и сохранили рекомендацию «покупать».', 'Сразу два инвестдома, включая {a}, улучшили прогноз по {n}. Новая целевая цена выше текущей на {p2} %.'],
      ['Совет директоров {n} рекомендовал дивиденды, которые дают доходность около {d} % к текущей цене. Это рекорд за всю историю выплат.', '{n} направит на дивиденды {p3} % чистой прибыли. Дивидендная доходность составит около {d} %.'],
    ],
    neg: [
      ['{n} отчиталась о снижении выручки на 8 % год к году, до {b1} млрд ₽. Компания объясняет это слабым спросом в секторе «{s}».', 'Квартальная выручка {n} упала на 8 %. Менеджмент ожидает восстановления не раньше чем через {m} месяцев.'],
      ['Регулятор демо-рынка начал внеплановую проверку {n}. Компания заявила, что сотрудничает с проверяющими и не ожидает существенных последствий.', 'В отношении {n} начата проверка регулятора. Итоги обещают подвести в течение {m} месяцев.'],
      ['{n} перенесла запуск ключевого проекта на {m} месяцев. Затраты на проект могут вырасти на {p2} %.', 'Компания {n} сообщила о задержке крупного проекта. Новый срок запуска сдвинут на {m} месяцев.'],
      ['Рейтинговое агентство {a} изменило прогноз по рейтингу {n} со «стабильного» на «негативный».', 'Агентство {a} ухудшило прогноз по {n}, сославшись на рост долговой нагрузки на {p2} % за год.'],
      ['Один из крупных акционеров {n} продаёт пакет в {p1} % акций через ускоренное размещение. Цена размещения ниже рыночной на {p2} %.', 'Крупный акционер {n} объявил о продаже части пакета. На рынок выйдет около {p1} % акций компании.'],
    ],
    mpos: [
      ['Демо-ЦБ снизил ключевую ставку на {bp} базисных пунктов, хотя большинство аналитиков ждали сохранения. Регулятор допускает дальнейшее смягчение.', 'Ключевая ставка снижена на {bp} б.п. Демо-ЦБ указал на замедление инфляции.'],
      ['Число частных инвесторов на демо-бирже за месяц выросло на {p2} %. Объём их покупок акций стал рекордным.', 'Биржа сообщила о рекордном притоке частных инвесторов: за месяц открыто {k} тыс. новых счетов.'],
      ['ДемоИндекс растёт после выхода сильной статистики: промышленное производство прибавило {p1} % год к году.', 'Макростатистика оказалась лучше ожиданий, и индекс прибавляет вслед за ней.'],
    ],
    mneg: [
      ['Демо-ЦБ ужесточил риторику: регулятор допустил повышение ставки на следующем заседании, если инфляция не начнёт замедляться.', 'Риторика Демо-ЦБ оказалась жёстче ожиданий. Рынок закладывает более высокую ставку на {m} месяцев вперёд.'],
      ['ДемоИндекс снижается после слабой промышленной статистики: производство сократилось на {p1} % год к году.', 'Промышленная статистика вышла хуже прогноза, индекс отступает.'],
      ['Перед выходными инвесторы фиксируют прибыль после роста индекса на {p2} % за месяц.', 'Индекс корректируется: участники рынка закрывают позиции после сильного месяца.'],
    ],
    sys: [
      ['Основная торговая сессия на демо-бирже открылась в 10:00. Котировки, бумаги и брокеры в демо вымышлены, цены меняются в реальном времени.'],
      ['Стартовый капитал 3 000 000 ₽ распределён по трём брокерам по выбранной стратегии. Структуру портфеля можно посмотреть на сайте, а торговать – в приложении для ПК.'],
    ],
  };
  const NB_REACT = {
    pos: ['Акции {t} отреагировали ростом в первые минуты после публикации.', 'Бумаги {t} растут, объём торгов выше среднего.', 'Покупатели активизировались в бумагах {t}, спрос в стакане заметно вырос.'],
    neg: ['Акции {t} снижаются после публикации, объём продаж вырос.', 'Бумаги {t} под давлением, продавцы доминируют в стакане.', 'Инвесторы восприняли новость негативно, котировки {t} снижаются.'],
    mpos: ['Растут почти все бумаги индекса, сильнее других – цикличные сектора.', 'Покупки идут широким фронтом, облигации тоже дорожают.'],
    mneg: ['Снижаются почти все бумаги индекса, облигации тоже дешевеют.', 'Продажи идут широким фронтом, защитные активы держатся лучше рынка.'],
  };
  const NB_VIEW = {
    pos: ['«Новость подтверждает наш позитивный взгляд на компанию», – считают в компании {a}.', 'По мнению аналитиков компании {a}, эффект на финансы компании проявится в ближайшие {m} месяцев.'],
    neg: ['«Рынок может переоценить негатив, но краткосрочно давление сохранится», – отмечают в компании {a}.', 'В компании {a} считают, что новость уже частично заложена в цену.'],
    mpos: ['В компании {a} ожидают, что позитивный настрой сохранится до конца недели.'],
    mneg: ['В компании {a} советуют не торопиться с покупками до прояснения ситуации.'],
  };
  const NB_HOUSES = ['«Демо-Капитал»', '«Север Аналитика»', '«Восток Инвест Ресёрч»', '«Рейтинг-Демо»', '«Южный инвестдом»'];
  B.newsBody = function (n) {
    let h = 2166136261 ^ (S.seed >>> 0); const str = n.text + '|' + n.day + '|' + n.tick;
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    const r = mulberry(h >>> 0); const pk = a => a[Math.floor(r() * a.length)]; const ri = (a, b) => a + Math.floor(r() * (b - a + 1));
    const ins = n.t && IMAP[n.t];
    const vars = { n: ins ? ins.n : '', t: n.t || '', s: ins ? ins.sector : '', a: pk(NB_HOUSES), p1: ri(3, 18), p2: ri(4, 25), p3: ri(8, 40), b1: ri(2, 60), m: ri(3, 12), d: ins && ins.dy ? (ins.dy + 2).toFixed(1).replace('.', ',') : ri(8, 14), bp: pk([25, 50, 75, 100]), k: ri(120, 480) };
    const fill = x => x.replace(/\{(\w+)\}/g, (_, k) => vars[k] != null ? vars[k] : '');
    const kind = n.kind || (n.t ? (n.dir > 0 ? 'pos' : 'neg') : n.dir > 0 ? 'mpos' : n.dir < 0 ? 'mneg' : 'sys');
    const leads = (NB[kind] || NB.sys)[n.tpl != null ? n.tpl : 0] || NB.sys[0];
    const out = [fill(pk(leads))];
    if (NB_REACT[kind]) out.push(fill(pk(NB_REACT[kind])));
    if (NB_VIEW[kind]) out.push(fill(pk(NB_VIEW[kind])));
    return { paras: out, source: kind === 'sys' ? 'Демо-биржа' : pk(['Интерфакс-Демо', 'ДемоФинанс', 'Лента рынков', 'Прайм-Демо']) };
  };

  /* ---------- распределение капитала ---------- */
  function noisyWeights(w) {
    const r = {}; let s = 0;
    for (const k in w) { r[k] = w[k] * (0.8 + rnd() * 0.4); s += r[k]; }
    for (const k in r) r[k] /= s;
    return r;
  }
  function dirichlet(n, min) {
    let a = Array.from({ length: n }, () => -Math.log(rnd() + 1e-9));
    const s = a.reduce((x, y) => x + y, 0); a = a.map(x => x / s);
    a = a.map(x => Math.max(min, x)); const s2 = a.reduce((x, y) => x + y, 0);
    return a.map(x => x / s2);
  }
  function brokerFee(acc, t, qty, price) {
    const ins = IMAP[t];
    if (ins.type === 'fut') return Math.abs(qty) * 2;
    return r2(Math.abs(qty) * price * BMAP[ACCMAP[acc].broker].fee);
  }

  function invest(day, total) {
    const priceOf = t => S.hist[t][day].c;
    const w = S.weights;
    const futAmt = total * w.fut;
    const nonFut = total - futAmt;
    const accs = ['sev-b', 'sev-i', 'vos-b', 'yug-b'];
    const shares = dirichlet(accs.length, 0.12);
    accs.forEach((id, i) => {
      const amt = Math.round(nonFut * shares[i] / 1000) * 1000;
      addOp({ k: 'dep', day, tick: TPD, acc: id, amt, src: 'broker' });
      ['stock', 'bond', 'fund'].forEach(c => {
        const budget = amt * w[c] / (1 - w.fut);
        if (budget < 2000) return;
        const pool = shuffle(S.picks[c]);
        const n = Math.max(1, Math.min(pool.length, 1 + Math.floor(rnd() * 3)));
        const parts = dirichlet(n, 0.2);
        for (let j = 0; j < n; j++) {
          const ins = IMAP[pool[j]]; const pr = priceOf(ins.t);
          const lots = Math.floor(budget * parts[j] / (pr * ins.lot));
          if (lots < 1) continue;
          const qty = lots * ins.lot;
          addOp({ k: 'trade', day, tick: TPD, acc: id, t: ins.t, qty, price: r2(pr), fee: brokerFee(id, ins.t, qty, pr), src: 'broker' });
        }
      });
    });
    if (futAmt > 0) {
      const amt = Math.round(futAmt / 1000) * 1000;
      addOp({ k: 'dep', day, tick: TPD, acc: 'vos-f', amt, src: 'broker' });
      const futs = S.strategyKey === 'aggr' ? ['DIX-12', 'ENR-12'] : ['DIX-12'];
      futs.forEach(t => {
        const ins = IMAP[t]; const pr = priceOf(t);
        const goBudget = amt * 0.5 / futs.length;
        const n = Math.floor(goBudget / (pr * ins.mult * ins.go));
        if (n < 1) return;
        const dir = (t === 'ENR-12' && rnd() < 0.4) ? -1 : 1;
        addOp({ k: 'trade', day, tick: TPD, acc: 'vos-f', t, qty: n * dir, price: r2(pr), fee: n * 2, src: 'broker' });
      });
    }
  }

  const DIV_DAYS = { VLKN: 55, ZNTH: 95, MRDN: HIST + 4, AVRR: HIST + 9, KRST: HIST + 14, SVTR: HIST + 22 };
  function dayEvents(day, live) {
    const priceOf = t => (live ? S.prices[t] : S.hist[t][day].c);
    const bonds = INSTR.filter(i => i.type === 'bond');
    for (const acc of known()) {
      const st = S.acc[acc.id];
      bonds.forEach((b, bi) => {
        const p = st.pos[b.t];
        if (!p || day % 30 !== (bi * 7 + 5) % 30) return;
        const amt = r2(p.qty * 1000 * b.coupon / 100 * 30 / 365);
        const op = addOp({ k: 'inc', sub: 'coupon', day, tick: TPD, acc: acc.id, t: b.t, amt, src: 'broker' });
        if (live) emit('income', op);
      });
      for (const t in DIV_DAYS) {
        if (DIV_DAYS[t] !== day) continue;
        const p = st.pos[t]; if (!p) continue;
        const amt = r2(p.qty * priceOf(t) * IMAP[t].dy / 100 * 0.87);
        const op = addOp({ k: 'inc', sub: 'div', day, tick: TPD, acc: acc.id, t, amt, src: 'broker' });
        if (live) emit('income', op);
      }
    }
  }

  /* ---------- инициализация ---------- */
  B.init = function (seed) {
    seed = seed >>> 0 || ((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
    rnd = mulberry(seed);
    const ei = ACCOUNTS.findIndex(a => a.id === 'zap-b'); if (ei >= 0) { ACCOUNTS.splice(ei, 1); delete ACCMAP['zap-b']; }
    const bi = BROKERS.findIndex(b => b.id === 'zap'); if (bi >= 0) { BROKERS.splice(bi, 1); delete BMAP.zap; }
    BROKERS.length = 0; ALL_BROKERS.forEach(b => BROKERS.push(b));
    ACCOUNTS.length = 0; ALL_ACCOUNTS.forEach(a => ACCOUNTS.push(a));
    S = {
      linked: {}, rights: {},
      seed, day: 0, tick: 0, prices: {}, hist: {}, cur: {}, idx: 3000, idxHist: [], idxCur: null,
      shocks: {}, mshock: null, news: [], newsBy: {}, ops: [], orders: [], opId: 1, ordId: 1, acc: {},
      sync: {}, trade: {}, lastSync: 0, booted: false, journals: {},
    };
    ACCOUNTS.forEach(a => { S.acc[a.id] = emptyState(); S.sync[a.id] = true; S.trade[a.id] = true; });
    BROKERS.forEach(b => { S.linked[b.id] = true; S.rights[b.id] = 'trade'; });

    const keys = Object.keys(STRATS);
    S.strategyKey = keys[Math.floor(rnd() * keys.length)];
    S.strategy = STRATS[S.strategyKey];
    S.weights = noisyWeights(S.strategy.w);
    const byType = ty => INSTR.filter(i => i.type === ty).map(i => i.t);
    S.picks = {
      stock: shuffle(byType('stock')).slice(0, S.strategy.k.stock + (rnd() < 0.5 ? 1 : 0)),
      bond: shuffle(byType('bond')).slice(0, S.strategy.k.bond),
      fund: shuffle(byType('fund')).slice(0, S.strategy.k.fund),
    };

    INSTR.forEach(i => { S.prices[i.t] = i.p0 * (0.96 + rnd() * 0.08); S.hist[i.t] = []; });
    const total1 = 2400000, total2 = 600000;
    for (let d = 0; d < HIST; d++) {
      S.day = d;
      INSTR.forEach(i => S.cur[i.t] = newCandle(S.prices[i.t]));
      S.idxCur = newCandle(S.idx);
      if (rnd() < 0.18) makeNews(false);
      for (let k = 0; k < TPD; k++) tickPrices();
      INSTR.forEach(i => S.hist[i.t].push(S.cur[i.t]));
      S.idxHist.push(S.idxCur);
      if (d === 0) invest(0, total1);
      if (d === 78) invest(78, total2);
      dayEvents(d, false);
    }
    S.day = HIST; S.tick = 0;
    INSTR.forEach(i => S.cur[i.t] = newCandle(S.prices[i.t]));
    S.idxCur = newCandle(S.idx);
    // стартовая лента новостей
    const startNews = [
      { text: 'Демо-биржа открыла основную торговую сессию', dir: 0 },
      { text: S.strategy.name + ' стратегия: капитал 3 000 000 ₽ распределён по трём брокерам', dir: 0 },
    ];
    startNews.forEach((n, i) => S.news.unshift({ day: HIST, tick: 0, text: n.text, dir: n.dir, t: null, kind: 'sys', tpl: i }));
    // немного прошлых новостей по компаниям, без влияния на цены
    INSTR.filter(i => i.type === 'stock').forEach(ins => {
      const k = 1 + Math.floor(rnd() * 3);
      const days = Array.from({ length: k }, () => HIST - 1 - Math.floor(rnd() * 40)).sort((a, b) => a - b);
      days.forEach(day => {
        const pos = rnd() < 0.55, arr = pos ? NEWS_POS : NEWS_NEG, tpl = Math.floor(rnd() * arr.length);
        keepNews({ day, tick: Math.floor(rnd() * TPD), text: arr[tpl].replace('{n}', ins.n), dir: pos ? 1 : -1, t: ins.t, kind: pos ? 'pos' : 'neg', tpl });
      });
    });
    S.booted = true;
    emit('init', S);
  };

  /* ---------- ход времени ---------- */
  function endDay() {
    dayEvents(S.day, true);
    INSTR.forEach(i => S.hist[i.t].push(S.cur[i.t]));
    S.idxHist.push(S.idxCur);
    S.day++; S.tick = 0;
    INSTR.forEach(i => S.cur[i.t] = newCandle(S.prices[i.t]));
    S.idxCur = newCandle(S.idx);
    // экспирация не наступает в рамках демо; новый день
    emit('day', S.day);
  }

  B.step = function () {
    tickPrices();
    if (rnd() < 1 / (TPD * 1.3)) makeNews(true);
    processOrders();
    S.tick++;
    if (S.tick >= TPD) endDay();
    emit('tick');
  };

  /* ---------- котировки и стакан ---------- */
  function decimalsOf(step) { return Math.max(0, -Math.floor(Math.log10(step) + 1e-9)); }
  B.dec = t => decimalsOf(IMAP[t].step);
  B.quote = function (t) {
    const ins = IMAP[t], p = S.prices[t], st = ins.step;
    const bid = Math.floor(p / st) * st;
    return { bid: +bid.toFixed(6), ask: +(bid + st).toFixed(6), last: p };
  };
  function hash(a, b, c) { let h = 2166136261 ^ a; h = Math.imul(h ^ b, 16777619); h = Math.imul(h ^ c, 16777619); h ^= h >>> 13; h = Math.imul(h, 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  B.book = function (t, depth) {
    depth = depth || 10;
    const ins = IMAP[t], q = B.quote(t), st = ins.step;
    const code = t.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
    const phase = Math.floor((S.day * TPD + S.tick) / 2);
    const base = ins.type === 'fut' ? 60 : ins.type === 'bond' ? 400 : Math.max(20, 60000 / (q.last * ins.lot));
    const mk = (side, i) => {
      const price = +(side === 'ask' ? q.ask + i * st : q.bid - i * st).toFixed(6);
      let lots = Math.round(base * (0.25 + 1.6 * hash(code, i * 7 + (side === 'ask' ? 1 : 2), phase)) * (1 + i * 0.12));
      if (hash(code, i + 50, Math.floor(phase / 5)) > 0.93) lots *= 6;
      let mine = 0;
      S.orders.forEach(o => {
        if (o.t !== t || (o.status !== 'active') || (o.type !== 'limit' && o.type !== 'iceberg')) return;
        if ((side === 'ask') !== (o.side === 'sell')) return;
        if (Math.abs(o.price - price) < st / 2) mine += o.type === 'iceberg' ? Math.min(o.visible, o.lots - o.filledLots) : o.lots;
      });
      return { price, lots: lots + mine, mine };
    };
    const asks = [], bids = [];
    for (let i = 0; i < depth; i++) { asks.push(mk('ask', i)); bids.push(mk('bid', i)); }
    return { asks, bids, spread: q.ask - q.bid };
  };

  /* ---------- торговля ---------- */
  B.freeCash = function (accId) { return classesOf(S.acc[accId], t => S.prices[t]).cash; };
  B.position = (accId, t) => S.acc[accId].pos[t];
  B.goRequired = (t, lots, price) => { const i = IMAP[t]; return lots * price * i.mult * i.go; };

  function exec(acc, t, qty, price, src, order) {
    const fee = brokerFee(acc, t, qty, price);
    const op = addOp({ k: 'trade', day: S.day, tick: S.tick, acc, t, qty, price: r2(price), fee, src: src || 'manual', orderId: order ? order.id : null });
    S.lastSync = Date.now();
    emit('trade', op);
    return op;
  }

  function checkFunds(acc, t, side, lots, price) {
    const ins = IMAP[t]; const qty = lots * ins.lot;
    if (ins.type === 'fut') {
      const pos = S.acc[acc].pos[t]; const cur = pos ? pos.qty : 0;
      const signed = side === 'buy' ? qty : -qty;
      const opening = Math.max(0, Math.abs(cur + signed) - Math.abs(cur));
      const need = B.goRequired(t, opening, price) + qty * 2;
      if (need > B.freeCash(acc) + 1e-6) return 'Недостаточно свободных средств для гарантийного обеспечения: нужно ' + B.rub(need, 0) + ', доступно ' + B.rub(B.freeCash(acc), 0);
      return null;
    }
    if (side === 'buy') {
      const cost = qty * price + brokerFee(acc, t, qty, price);
      if (cost > B.freeCash(acc) + 1e-6) return 'Недостаточно средств: нужно ' + B.rub(cost, 0) + ', на счёте ' + B.rub(B.freeCash(acc), 0);
    } else {
      const pos = S.acc[acc].pos[t];
      if (!pos || pos.qty < qty) return 'На счёте только ' + (pos ? pos.qty : 0) + ' шт. Короткие продажи акций в демо отключены';
    }
    return null;
  }

  B.validate = function (o) {
    const ins = IMAP[o.t]; const acc = ACCMAP[o.acc]; const br = BMAP[acc.broker];
    if (!S.trade[o.acc]) return 'Торговля по этому счёту выключена в разделе «Счета»';
    if (ins.type === 'fut' && !acc.fut) return 'Фьючерсы торгуются только на срочном счёте';
    if (ins.type !== 'fut' && acc.fut) return 'На срочном счёте можно торговать только фьючерсами';
    if (!(o.lots >= 1) || Math.floor(o.lots) !== o.lots) return 'Укажите целое число лотов, не меньше 1';
    if ((o.type === 'stop') && !br.caps.stop) return br.name + ' не принимает стоп-заявки';
    if ((o.type === 'take') && !br.caps.take) return br.name + ' не принимает тейк-профит';
    if (o.type === 'iceberg' && !br.caps.iceberg) return br.name + ' не поддерживает айсберг-заявки';
    if ((o.type === 'limit' || o.type === 'iceberg') && !(o.price > 0)) return 'Укажите цену';
    if ((o.type === 'stop' || o.type === 'take') && !(o.trigger > 0)) return 'Укажите цену активации';
    const q = B.quote(o.t);
    if (o.type === 'stop') {
      if (o.side === 'sell' && o.trigger >= q.bid) return 'Стоп на продажу должен быть ниже текущей цены, иначе он сработает сразу';
      if (o.side === 'buy' && o.trigger <= q.ask) return 'Стоп на покупку должен быть выше текущей цены';
    }
    if (o.type === 'take') {
      if (o.side === 'sell' && o.trigger <= q.bid) return 'Тейк-профит на продажу должен быть выше текущей цены';
      if (o.side === 'buy' && o.trigger >= q.ask) return 'Тейк-профит на покупку должен быть ниже текущей цены';
    }
    if (o.type === 'iceberg' && !(o.visible >= 1 && o.visible < o.lots)) return 'Видимая часть должна быть меньше общего объёма';
    const refPrice = o.type === 'market' ? (o.side === 'buy' ? q.ask : q.bid) : (o.type === 'limit' || o.type === 'iceberg') ? o.price : o.trigger;
    if (ins.type !== 'fut' && o.side === 'sell') {
      const pos = S.acc[o.acc].pos[o.t]; const live = S.orders.filter(x => x.acc === o.acc && x.t === o.t && x.side === 'sell' && (x.status === 'active' || x.status === 'pending'));
      // связка стоп + тейк исполнится только одной ногой, поэтому резервирует бумаги один раз
      const grp = {}; let reserved = 0;
      live.forEach(x => { const q = (x.lots - x.filledLots) * ins.lot; if (x.group != null) grp[x.group] = Math.max(grp[x.group] || 0, q); else reserved += q; });
      for (const g in grp) reserved += grp[g];
      const have = (pos ? pos.qty : 0);
      if (have < o.lots * ins.lot) return 'На счёте только ' + have + ' шт.';
      if (o.type === 'market' && have - reserved < o.lots * ins.lot) return 'Часть бумаг зарезервирована активными заявками: свободно ' + Math.max(0, have - reserved) + ' шт.';
      return null;
    }
    return checkFunds(o.acc, o.t, o.side, o.lots, refPrice);
  };

  B.place = function (o) {
    const err = B.validate(o);
    if (err) return { ok: false, err };
    const ins = IMAP[o.t];
    const order = {
      id: S.ordId++, acc: o.acc, t: o.t, side: o.side, type: o.type, lots: o.lots, filledLots: 0,
      price: o.price || null, trigger: o.trigger || null, visible: o.visible || null,
      status: o.type === 'market' ? 'active' : (o.type === 'stop' || o.type === 'take') ? 'pending' : 'active',
      created: { day: S.day, tick: S.tick }, src: o.src || 'manual', group: null, appManaged: false, fillPrice: null, reason: '',
    };
    S.orders.unshift(order);
    if (o.type === 'market') {
      const q = B.quote(o.t);
      const px = o.side === 'buy' ? q.ask : q.bid;
      fill(order, px);
      emit('order', order);
      return { ok: true, order };
    }
    if (o.oco && o.oco.trigger) {
      const br = BMAP[ACCMAP[o.acc].broker];
      const sib = {
        id: S.ordId++, acc: o.acc, t: o.t, side: o.side, type: o.oco.type, lots: o.lots, filledLots: 0, price: null,
        trigger: o.oco.trigger, visible: null, status: 'pending', created: { day: S.day, tick: S.tick }, src: o.src || 'manual',
        group: order.id, appManaged: !br.caps.oco, fillPrice: null, reason: '',
      };
      order.group = order.id; order.appManaged = !br.caps.oco;
      S.orders.unshift(sib);
    }
    emit('order', order);
    return { ok: true, order };
  };

  function fill(order, px) {
    const ins = IMAP[order.t];
    const lots = order.lots - order.filledLots;
    const err = checkFunds(order.acc, order.t, order.side, lots, px);
    if (err) { order.status = 'rejected'; order.reason = err; emit('order', order); return; }
    exec(order.acc, order.t, (order.side === 'buy' ? 1 : -1) * lots * ins.lot, px, order.src, order);
    order.filledLots = order.lots; order.status = 'filled'; order.fillPrice = px;
    order.done = { day: S.day, tick: S.tick };
    if (order.group) {
      S.orders.forEach(x => {
        if (x !== order && x.group === order.group && (x.status === 'active' || x.status === 'pending')) {
          x.status = 'cancelled'; x.reason = 'Исполнена связанная заявка #' + order.id + (order.appManaged ? ' · снята приложением' : ' · снята брокером');
          emit('order', x);
        }
      });
    }
    emit('fill', order);
  }

  function processOrders() {
    for (const o of S.orders) {
      if (o.status !== 'active' && o.status !== 'pending') continue;
      if (o.type === 'market') continue;
      const q = B.quote(o.t);
      if (o.type === 'limit' || o.type === 'iceberg') {
        if (o.side === 'buy' && q.ask <= o.price) fill(o, Math.min(o.price, q.ask));
        else if (o.side === 'sell' && q.bid >= o.price) fill(o, Math.max(o.price, q.bid));
      } else if (o.type === 'stop') {
        if (o.side === 'sell' && q.bid <= o.trigger) fill(o, q.bid);
        else if (o.side === 'buy' && q.ask >= o.trigger) fill(o, q.ask);
      } else if (o.type === 'take') {
        if (o.side === 'sell' && q.bid >= o.trigger) fill(o, q.bid);
        else if (o.side === 'buy' && q.ask <= o.trigger) fill(o, q.ask);
      }
    }
  }

  B.cancel = function (id) {
    const o = S.orders.find(x => x.id === id);
    if (!o || (o.status !== 'active' && o.status !== 'pending')) return;
    o.status = 'cancelled'; o.reason = 'Снята пользователем';
    if (o.group) S.orders.forEach(x => { if (x !== o && x.group === o.group && (x.status === 'active' || x.status === 'pending')) { x.status = 'cancelled'; x.reason = 'Снята вместе со связанной'; } });
    emit('order', o);
  };

  B.deposit = function (acc, amt) {
    const op = addOp({ k: 'dep', day: S.day, tick: S.tick, acc, amt, src: 'broker' });
    S.lastSync = Date.now();
    emit('trade', op);
    return op;
  };

  /* подключение нового брокера: история операций подгружается из отчёта брокера */
  B.EXTRA = { broker: { id: 'zap', name: 'Брокер Запад', short: 'Запад', color: '#2DD4BF', fee: 0.0006, feeText: '0,06 %', caps: { stop: true, take: true, oco: true, iceberg: true, fut: false, evening: true }, ping: 18 },
    account: { id: 'zap-b', broker: 'zap', name: 'Брокерский', num: '…5530', key: 'zp_••••••••••••81kd' } };
  B.connectExtra = function () {
    if (ACCMAP['zap-b']) return null;
    const br = B.EXTRA.broker, a = B.EXTRA.account;
    BROKERS.push(br); BMAP[br.id] = br; ACCOUNTS.push(a); ACCMAP[a.id] = a;
    S.acc[a.id] = emptyState(); S.sync[a.id] = true; S.trade[a.id] = true; S.linked[br.id] = true; S.rights[br.id] = 'trade';
    addOp({ k: 'dep', day: S.day, tick: S.tick, acc: a.id, amt: 250000, src: 'import' });
    [['DIDX', 0.45], ['GS29', 0.3], ['MRDN', 0.15]].forEach(([t, w]) => {
      const ins = IMAP[t]; const px = B.quote(t).ask; const lots = Math.floor(250000 * w / (px * ins.lot));
      if (lots > 0) addOp({ k: 'trade', day: S.day, tick: S.tick, acc: a.id, t, qty: lots * ins.lot, price: r2(px), fee: 0, src: 'import' });
    });
    S.lastSync = Date.now();
    emit('connect', a.id); emit('sync', a.id);
    return a.id;
  };
  B.isExtraConnected = () => !!ACCMAP['zap-b'];

  /* путь клиента: брокеры подключаются по одному, сначала ключом «только чтение» */
  B.ALL_BROKERS = ALL_BROKERS; B.ALL_ACCOUNTS = ALL_ACCOUNTS;
  B.unlinkAll = function () {
    BROKERS.length = 0; ACCOUNTS.length = 0; S.linked = {}; S.rights = {};
    ALL_ACCOUNTS.forEach(a => { S.sync[a.id] = false; S.trade[a.id] = false; });
    emit('sync', null);
  };
  B.linkBroker = function (id, rights) {
    if (S.linked[id]) return false;
    S.linked[id] = true; S.rights[id] = rights || 'read';
    BROKERS.length = 0; ALL_BROKERS.forEach(b => { if (S.linked[b.id]) BROKERS.push(b); }); if (BMAP.zap && S.linked.zap) BROKERS.push(BMAP.zap);
    ACCOUNTS.length = 0; ALL_ACCOUNTS.forEach(a => { if (S.linked[a.broker]) ACCOUNTS.push(a); }); if (ACCMAP['zap-b']) ACCOUNTS.push(ACCMAP['zap-b']);
    ALL_ACCOUNTS.filter(a => a.broker === id).forEach(a => { S.sync[a.id] = true; S.trade[a.id] = rights === 'trade'; });
    S.lastSync = Date.now();
    emit('connect', id); ALL_ACCOUNTS.filter(a => a.broker === id).forEach(a => emit('sync', a.id));
    return true;
  };
  B.setRights = function (id, rights) {
    S.rights[id] = rights;
    ACCOUNTS.filter(a => a.broker === id).forEach(a => { S.trade[a.id] = rights === 'trade'; });
    emit('sync', id);
  };
  B.unlinked = () => ALL_BROKERS.filter(b => !S.linked[b.id]);

  B.setSync = (acc, on) => { S.sync[acc] = on; emit('sync', acc); };
  B.setTrade = (acc, on) => { S.trade[acc] = on; emit('sync', acc); };

  /* ---------- аналитика ---------- */
  B.priceOn = (t, day) => (day < S.day ? S.hist[t][day].c : S.prices[t]);
  B.prevClose = t => S.hist[t][S.day - 1].c;

  // серия по дням для фильтра {accs:Set, cls:Set}
  B.series = function (filter) {
    const n = S.day + 1;
    const out = { val: new Float64Array(n), inv: new Float64Array(n), flow: new Float64Array(n), idx: new Float64Array(n), inc: new Float64Array(n) };
    const sts = {}; known().forEach(a => sts[a.id] = emptyState()); for (const id in S.journals) sts[id] = emptyState();
    const ops = S.ops; let oi = 0;
    const cls = filter.cls;
    for (let d = 0; d < n; d++) {
      let flow = 0, inc = 0;
      while (oi < ops.length && ops[oi].day === d) {
        const op = ops[oi++];
        if (filter.accs.has(op.acc)) {
          if (op.k === 'dep' || op.k === 'wd') { if (cls.has('cash')) flow += op.k === 'dep' ? op.amt : -op.amt; }
          else if (op.k === 'inc') { inc += op.amt; }
          else if (op.k === 'trade') {
            const ins = IMAP[op.t]; let into;
            if (ins.type === 'fut') {
              const cur = sts[op.acc].pos[op.t]; const q0 = cur ? cur.qty : 0;
              into = (Math.abs(q0 + op.qty) - Math.abs(q0)) * op.price * ins.mult * ins.go;
            } else into = op.qty * op.price;
            if (cls.has(ins.type)) flow += into;
            if (cls.has('cash')) flow -= into;
          }
        }
        applyOp(sts[op.acc], op);
      }
      const priceOf = d < S.day ? (t => S.hist[t][d].c) : (t => S.prices[t]);
      let v = 0, inv = 0;
      filter.accs.forEach(id => { const c = classesOf(sts[id], priceOf); cls.forEach(k => v += c[k]); inv += sts[id].dep; });
      out.val[d] = v; out.inv[d] = inv; out.flow[d] = flow; out.inc[d] = inc;
      out.idx[d] = d < S.day ? S.idxHist[d].c : S.idx;
    }
    return out;
  };

  B.twr = function (ser, from) {
    const n = ser.val.length; const res = new Float64Array(n - from); let acc = 1; res[0] = 0;
    for (let d = from + 1; d < n; d++) {
      const prev = ser.val[d - 1];
      const r = prev > 1 ? (ser.val[d] - prev - ser.flow[d]) / prev : 0;
      acc *= 1 + r; res[d - from] = acc - 1;
    }
    return res;
  };

  B.snapshot = function (filter) {
    const priceOf = t => S.prices[t];
    const prevOf = t => S.hist[t][S.day - 1].c;
    const cls = { stock: 0, bond: 0, fund: 0, fut: 0, cash: 0 };
    let dep = 0, income = 0, fees = 0, realized = 0, dayChg = 0, vm = 0;
    const positions = [];
    filter.accs.forEach(id => {
      const st = S.acc[id]; const c = classesOf(st, priceOf);
      CLS_KEYS.forEach(k => cls[k] += c[k]);
      dep += st.dep; income += st.income; fees += st.fees; realized += st.realized;
      for (const t in st.pos) {
        const p = st.pos[t], ins = IMAP[t];
        if (!filter.cls.has(ins.type)) continue;
        const m = ins.type === 'fut' ? ins.mult : 1;
        const price = priceOf(t), prev = prevOf(t);
        const value = ins.type === 'fut' ? p.go + (p.qty * price * m - p.cost) : p.qty * price;
        const pl = p.qty * price * m - p.cost;
        const dchg = p.qty * (price - prev) * m;
        if (ins.type === 'fut') vm += dchg;
        dayChg += dchg;
        positions.push({ acc: id, t, ins, qty: p.qty, avg: p.cost / p.qty / m, price, prev, value, pl, plPct: pl / Math.abs(p.cost), dchg, dpct: (price - prev) / prev, go: p.go });
      }
    });
    let value = 0; filter.cls.forEach(k => value += cls[k]);
    return { cls, value, dep, income, fees, realized, dayChg, vm, positions };
  };

  B.dayIncome = function (filter) {
    return S.ops.filter(o => o.k === 'inc' && o.day === S.day - 1 && filter.accs.has(o.acc));
  };

  /* ---------- ребалансировка ---------- */
  B.rebalanceBase = function (accs) {
    const priceOf = t => S.prices[t];
    const tot = { stock: 0, bond: 0, fund: 0, cash: 0 };
    accs.forEach(id => { const c = classesOf(S.acc[id], priceOf); ['stock', 'bond', 'fund', 'cash'].forEach(k => tot[k] += c[k]); });
    return tot;
  };

  B.rebalancePlan = function (target, mode, accs) {
    accs = accs.filter(id => !ACCMAP[id].fut && S.trade[id]);
    const base = B.rebalanceBase(accs);
    const V = base.stock + base.bond + base.fund + base.cash;
    const keys = ['stock', 'bond', 'fund'];
    const want = {}; keys.forEach(k => want[k] = V * target[k] / 100);
    const cashTarget = V * target.cash / 100;
    const diff = {}; keys.forEach(k => diff[k] = want[k] - base[k]);
    const free = {}; accs.forEach(id => free[id] = B.freeCash(id));
    const rows = [];
    const priceOf = t => S.prices[t];
    // продажи
    if (mode === 'full') {
      keys.forEach(k => {
        if (diff[k] >= -500) return;
        let need = -diff[k];
        const holds = [];
        accs.forEach(id => { const st = S.acc[id]; for (const t in st.pos) if (IMAP[t].type === k) holds.push({ id, t, val: st.pos[t].qty * priceOf(t), qty: st.pos[t].qty }); });
        const totalVal = holds.reduce((s, h) => s + h.val, 0);
        holds.forEach(h => {
          const ins = IMAP[h.t]; const px = B.quote(h.t).bid;
          const share = need * h.val / totalVal;
          let lots = Math.min(Math.floor(h.qty / ins.lot), Math.round(share / (px * ins.lot)));
          if (lots < 1) return;
          const amount = lots * ins.lot * px;
          rows.push({ side: 'sell', acc: h.id, t: h.t, lots, qty: lots * ins.lot, price: px, amount, fee: brokerFee(h.id, h.t, lots * ins.lot, px) });
          free[h.id] += amount;
        });
      });
    }
    // покупки
    let budget = accs.reduce((s, id) => s + free[id], 0) - cashTarget;
    const deficits = keys.filter(k => diff[k] > 500).map(k => ({ k, d: diff[k] }));
    const defSum = deficits.reduce((s, x) => s + x.d, 0);
    if (budget > 0 && defSum > 0) {
      const scale = Math.min(1, budget / defSum);
      const DEF = { stock: 'ZNTH', bond: 'GS29', fund: 'DIDX' };
      deficits.forEach(({ k, d }) => {
        let money = d * scale;
        const held = {};
        accs.forEach(id => { const st = S.acc[id]; for (const t in st.pos) if (IMAP[t].type === k) held[t] = (held[t] || 0) + st.pos[t].qty * priceOf(t); });
        let list = Object.keys(held); if (!list.length) { list = [DEF[k]]; held[DEF[k]] = 1; }
        const hv = list.reduce((s, t) => s + held[t], 0);
        list.forEach(t => {
          const ins = IMAP[t]; const px = B.quote(t).ask;
          let part = money * held[t] / hv;
          while (part > px * ins.lot) {
            const id = accs.slice().sort((a, b) => free[b] - free[a])[0];
            const maxLots = Math.floor(Math.min(part, free[id]) / (px * ins.lot * 1.004));
            if (maxLots < 1) break;
            const amount = maxLots * ins.lot * px;
            const ex = rows.find(r => r.side === 'buy' && r.acc === id && r.t === t);
            if (ex) { ex.lots += maxLots; ex.qty += maxLots * ins.lot; ex.amount += amount; ex.fee = brokerFee(id, t, ex.qty, px); }
            else rows.push({ side: 'buy', acc: id, t, lots: maxLots, qty: maxLots * ins.lot, price: px, amount, fee: brokerFee(id, t, maxLots * ins.lot, px) });
            free[id] -= amount; part -= amount;
          }
        });
      });
    }
    const minAmt = Math.max(3000, V * 0.002);
    for (let i = rows.length - 1; i >= 0; i--) if (rows[i].amount < minAmt) rows.splice(i, 1);
    const after = Object.assign({}, base);
    rows.forEach(r => { const k = IMAP[r.t].type; const s = r.side === 'buy' ? 1 : -1; after[k] += s * r.amount; after.cash -= s * r.amount + r.fee; });
    const dev = obj => { const tot = obj.stock + obj.bond + obj.fund + obj.cash; return ['stock', 'bond', 'fund', 'cash'].reduce((m, k) => Math.max(m, Math.abs(obj[k] / tot * 100 - target[k])), 0); };
    return { rows, base, after, V, devBefore: dev(base), devAfter: dev(after), accs };
  };

  /* ---------- экспорт ---------- */
  B.INSTR = INSTR; B.IMAP = IMAP; B.CLASS = CLASS; B.CLS_KEYS = CLS_KEYS; B.BROKERS = BROKERS; B.BMAP = BMAP;
  B.ACCOUNTS = ACCOUNTS; B.ACCMAP = ACCMAP; B.STRATS = STRATS; B.TPD = TPD; B.HIST = HIST;
  B.S = () => S;
  B.brokerFee = brokerFee;
  B.syncedAccs = () => ACCOUNTS.filter(a => S.sync[a.id]).map(a => a.id);
})(window.B);
