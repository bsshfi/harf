/* حَرف | HARF — منطق التطبيق
   الرئيسية، السجل، الإعدادات، اللعبة الجماعية (تتكلم مع harf-api)، واللعب على ورقة. */
(function () {
  'use strict';
  const VERSION = CONFIG.VERSION, API = CONFIG.API, SITE = CONFIG.SITE, MAIL = CONFIG.MAIL;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- ثوابت ---------- */
  const COLORS = ['#2F6FDB', '#A13D8F', '#F5B62A', '#23854D', '#D4552B', '#0F8B8D', '#6A45C9', '#C2185B', '#7A5230', '#4A5A6A', '#E07A1F', '#3E8E3E'];
  const ALL_CATS = ['اسم', 'حيوان', 'نبات', 'جماد', 'بلاد', 'أكلة', 'مهنة', 'لون', 'فاكهة', 'مدينة', 'شي في البيت', 'شخصية كرتون', 'ماركة', 'رياضة'];
  const DEF = { cats: ['اسم', 'حيوان', 'نبات', 'جماد', 'بلاد'], rounds: 5, time: 90, mode: 'stop', hard: false };
  const ROUNDS = [3, 5, 7, 10], TIMES = [45, 60, 90, 120, 180], EXTRAS = [0, 15, 30, 45, 60];
  const EASY = 'ابتجحخدرزسشصطعفقكلمنهوي', HARD = 'ثذضظغ';
  const LNAME = { 'ا': 'الألف', 'ب': 'الباء', 'ت': 'التاء', 'ث': 'الثاء', 'ج': 'الجيم', 'ح': 'الحاء', 'خ': 'الخاء', 'د': 'الدال', 'ذ': 'الذال', 'ر': 'الراء', 'ز': 'الزاي', 'س': 'السين', 'ش': 'الشين', 'ص': 'الصاد', 'ض': 'الضاد', 'ط': 'الطاء', 'ظ': 'الظاء', 'ع': 'العين', 'غ': 'الغين', 'ف': 'الفاء', 'ق': 'القاف', 'ك': 'الكاف', 'ل': 'اللام', 'م': 'الميم', 'ن': 'النون', 'ه': 'الهاء', 'و': 'الواو', 'ي': 'الياء' };
  const showL = (l) => (l === 'ا' ? 'أ' : l || '');
  const IC = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    crown: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.9l10-6.5a1 1 0 0 0 0-1.7l-10-6.5A1 1 0 0 0 8 5.5z"/></svg>'
  };

  /* ---------- التخزين على الجهاز ---------- */
  const S = Object.assign({ name: '', color: 0, theme: 'auto', sound: true, vib: true, games: [], paperN: 0, active: null, last: null }, (() => { try { return JSON.parse(localStorage.getItem('harf') || '{}'); } catch (e) { return {}; } })());
  const save = () => { try { localStorage.setItem('harf', JSON.stringify(S)); } catch (e) {} };

  /* ---------- أدوات الواجهة ---------- */
  let toastT = 0;
  function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600); }
  let sheetOnClose = null;
  function sheet(html, after, onClose) {
    $('#sheet').innerHTML = '<div class="grip"></div>' + html;
    $('#sheetBg').classList.add('on'); $('#sheet').scrollTop = 0;
    sheetOnClose = onClose || null;
    if (after) after($('#sheet'));
  }
  function closeSheet() { $('#sheetBg').classList.remove('on'); const f = sheetOnClose; sheetOnClose = null; if (f) f(); }
  $('#sheetBg').addEventListener('click', (e) => { if (e.target.id === 'sheetBg') closeSheet(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  function confirmSheet(title, text, yes, onYes, danger) {
    sheet('<h2>' + esc(title) + '</h2><p>' + esc(text) + '</p><button class="link-btn ' + (danger ? 'danger' : 'primary') + '" id="cfYes">' + esc(yes) + '</button><button class="link-btn" id="cfNo">رجوع</button>', () => {
      $('#cfYes').onclick = () => { closeSheet(); onYes(); }; $('#cfNo').onclick = closeSheet;
    });
  }
  const ink = (c) => (c === 2 ? '#3A2A00' : '#fff');
  function av(name, color, cls, online) {
    const c = COLORS[color % COLORS.length] || COLORS[0];
    const ch = String(name || '؟').trim().charAt(0) || '؟';
    return '<span class="av ' + (cls || '') + '" style="background:' + c + ';color:' + ink(color) + '" aria-hidden="true">' + esc(ch) + (online ? '<i class="on"></i>' : '') + '</span>';
  }
  const fmtDate = (t) => { try { return new Date(t).toLocaleDateString('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return new Date(t).toDateString(); } };
  const fmtTime = (t) => { try { return new Date(t).toLocaleTimeString('ar-SA-u-nu-latn', { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } };
  const plural = (n, one, two, few, many) => n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? n + ' ' + few : n + ' ' + many;

  /* «الأسد» = «اسد»، «ة» = «ه»، «ى» = «ي» — نفس السيرفر */
  function norm(s) {
    let x = String(s || '').toLowerCase().replace(/[ً-ٰٟـ]/g, '')
      .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/[^ء-يa-z0-9]+/g, ' ').trim();
    if (x.length > 3 && x.startsWith('ال')) x = x.slice(2);
    return x.replace(/ /g, '');
  }

  /* ---------- الأصوات والاهتزاز ---------- */
  let AC = null;
  function tone(f, d, type, v, delay) {
    if (!S.sound) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === 'suspended') AC.resume();
      const t = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain();
      o.type = type || 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(v || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(AC.destination); o.start(t); o.stop(t + d + 0.03);
    } catch (e) {}
  }
  const SND = {
    tick: () => tone(880, 0.06, 'square', 0.03),
    spin: () => tone(400 + Math.random() * 500, 0.04, 'triangle', 0.025),
    ding: () => { tone(660, 0.15); tone(990, 0.3, 'sine', 0.08, 0.12); },
    go: () => tone(1180, 0.2, 'triangle', 0.08),
    stop: () => { tone(330, 0.18, 'sawtooth', 0.05); tone(250, 0.25, 'sawtooth', 0.05, 0.14); },
    win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, 'triangle', 0.07, i * 0.13)),
    pop: () => tone(520, 0.08, 'sine', 0.05)
  };
  const vib = (p) => { if (S.vib && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} };
  document.addEventListener('pointerdown', () => { try { if (S.sound && !AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC && AC.state === 'suspended') AC.resume(); } catch (e) {} }, { passive: true });

  /* ---------- التنقل ---------- */
  let current = 'home';
  function show(v) {
    current = v;
    const tab = v === 'game' || v === 'paper' ? '' : v;
    $$('.tabs button').forEach((b) => { b.classList.toggle('on', b.dataset.v === tab); b.setAttribute('aria-current', b.dataset.v === tab ? 'page' : 'false'); });
    $$('.view').forEach((s) => s.classList.toggle('on', s.id === 'v-' + v));
    document.body.classList.toggle('ingame', v === 'game' || v === 'paper');
    if (v === 'home') renderHome();
    if (v === 'history') renderHistory();
    if (v === 'settings') renderSettings();
    window.scrollTo(0, 0);
    if (v !== 'game') schedulePoll();
  }
  $$('.tabs button').forEach((b) => (b.onclick = () => show(b.dataset.v)));

  /* ---------- API ---------- */
  async function api(path, body) {
    try {
      const r = await fetch(API + path, body ? { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body) } : { cache: 'no-store' });
      const j = await r.json().catch(() => ({ error: 'http' }));
      if (!r.ok && !j.error) j.error = 'http';
      return j;
    } catch (e) { return { error: 'net' }; }
  }
  const ERR = {
    net: 'ما فيه اتصال بالإنترنت', notfound: 'ما لقينا لعبة بهالكود، تأكد منه', locked: 'المضيف قفل اللعبة', full: 'اللعبة مليانة (١٠ لاعبين)',
    name: 'اكتب اسمك', wait: 'محاولات كثيرة، انتظر شوي وجرّب', host: 'هذا للمضيف بس', busy: 'السيرفر مشغول، جرّب بعد شوي', server: 'صار خطأ، جرّب مرة ثانية', http: 'صار خطأ، جرّب مرة ثانية'
  };
  const errText = (e) => ERR[e] || ERR.server;

  /* ---------- السجل على الجهاز ---------- */
  function hist(g) { return S.games.find((x) => !x.paper && x.g === g); }
  function recordState(s) {
    const gm = s.game; let h = hist(gm.id);
    if (!h) { h = { g: gm.id, t: G.t, me: G.me, created: gm.created }; S.games.unshift(h); }
    h.name = gm.name; h.settings = gm.settings; h.status = gm.status; h.code = gm.code; h.host = gm.host === s.me; h.round = gm.round; h.rounds = gm.settings.rounds; h.letters = gm.used;
    h.players = s.players.filter((p) => p.gone !== 2).map((p) => ({ id: p.id, name: p.name, color: p.color, score: p.score }));
    if (s.results) { h.winners = s.results.winners; h.finished = gm.finished; h.rounds = s.results.rounds; }
    h.updated = Date.now();
    if (S.games.length > 300) S.games.length = 300;
    save();
  }

  /* ================= الرئيسية ================= */
  function renderHome() {
    const a = S.active && hist(S.active.g);
    $('#resumeBox').innerHTML = a ? '<button class="big-btn resume" id="btnResume"><span class="bi" style="background:linear-gradient(135deg,#4FC79A,#21875F)">' + IC.play + '</span><span><b>ارجع للعبة</b><small><bdi>#' + a.g + '</bdi> · ' + esc(a.name || '') + ' · ' + statusText(a.status) + '</small></span><svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg></button>' : '';
    if (a) $('#btnResume').onclick = () => enterGame(S.active.g, S.active.t, S.active.me);
    // بطل البيت: أكثر واحد فاز آخر ٣٠ يوم
    const since = Date.now() - 30 * 864e5, wins = {};
    S.games.forEach((x) => { if (x.status === 'done' && (x.finished || x.created) > since) (x.winners || []).forEach((n) => { wins[n] = (wins[n] || 0) + 1; }); });
    const top = Object.keys(wins).sort((p, q) => wins[q] - wins[p])[0];
    $('#champBox').innerHTML = top ? '<div class="gl champ"><span class="crown">' + IC.trophy + '</span><span><small>بطل الشهر</small><b>' + esc(top) + '</b> <small style="display:inline">· ' + plural(wins[top], 'فوز واحد', 'فوزين', 'انتصارات', 'انتصار') + '</small></span></div>' : '';
  }
  function statusText(st) { return { lobby: 'بانتظار اللاعبين', play: 'يلعبون الحين', review: 'وقت التصحيح', score: 'بين الجولات', done: 'انتهت' }[st] || ''; }
  $('#btnNew').onclick = () => openCreate();
  $('#btnJoin').onclick = () => openJoin('');
  $('#btnPaper').onclick = () => openPaperSetup();

  /* ---------- إنشاء لعبة ---------- */
  function settingsForm(st, withHead) {
    st = Object.assign({}, DEF, st || {});
    const cats = ALL_CATS.concat(st.cats.filter((c) => !ALL_CATS.includes(c)));
    return (withHead ? '<label class="flabel" for="cgName">اسم اللعبة</label><input class="tin" id="cgName" maxlength="40" placeholder="مثلاً: سهرة الخميس">' +
      '<label class="flabel" for="cgMe">اسمك</label><input class="tin" id="cgMe" maxlength="20" placeholder="اكتب اسمك" value="' + esc(S.name) + '">' +
      '<div class="flabel">لونك</div><div class="colors big" id="cgColor">' + COLORS.map((c, i) => '<button type="button" data-c="' + i + '" style="background:' + c + '" class="' + (i === S.color ? 'on' : '') + '" aria-label="لون ' + (i + 1) + '"></button>').join('') + '</div>' : '') +
      '<div class="flabel">الفئات <span style="font-weight:500">(من ٣ إلى ٨)</span></div><div class="catpick" id="cgCats">' +
      cats.map((c) => '<button type="button" class="' + (st.cats.includes(c) ? 'on' : '') + '" data-c="' + esc(c) + '">' + esc(c) + '</button>').join('') +
      '<button type="button" id="cgAddCat">+ فئة</button></div>' +
      '<div class="flabel">عدد الجولات</div><div class="seg wide" id="cgRounds">' + ROUNDS.map((n) => '<button type="button" data-v="' + n + '" class="' + (n === st.rounds ? 'on' : '') + '">' + n + '</button>').join('') + '</div>' +
      '<div class="flabel">وقت الجولة (ثانية)</div><div class="seg wide" id="cgTime">' + TIMES.map((n) => '<button type="button" data-v="' + n + '" class="' + (n === st.time ? 'on' : '') + '">' + n + '</button>').join('') + '</div>' +
      '<div class="flabel">متى تخلص الجولة؟</div><div class="seg wide" id="cgMode"><button type="button" data-v="stop" class="' + (st.mode === 'stop' ? 'on' : '') + '">ستوب!</button><button type="button" data-v="time" class="' + (st.mode === 'time' ? 'on' : '') + '">لين يخلص الوقت</button></div>' +
      '<p id="cgModeTxt" style="margin:8px 4px 0;font-size:13px"></p>' +
      '<div class="set" style="margin-top:12px"><div><span class="lbl">الحروف الصعبة<small>ث ذ ض ظ غ تطلع في العجلة</small></span><button type="button" class="switch" role="switch" id="cgHard" aria-checked="' + !!st.hard + '" aria-label="الحروف الصعبة"></button></div></div>';
  }
  function bindSettingsForm(root) {
    const seg = (id) => $$('#' + id + ' button', root).forEach((b) => (b.onclick = () => { $$('#' + id + ' button', root).forEach((x) => x.classList.toggle('on', x === b)); if (id === 'cgMode') modeTxt(); }));
    ['cgRounds', 'cgTime', 'cgMode'].forEach(seg);
    const modeTxt = () => { const m = $('#cgMode .on', root).dataset.v; $('#cgModeTxt', root).textContent = m === 'stop' ? 'أول واحد يكمّل كل الخانات يضغط «ستوب!» والباقين لهم ٥ ثواني.' : 'الكل ياخذ الوقت كامل، أو تخلص الجولة إذا الكل سلّم.'; };
    modeTxt();
    const bindCat = (b) => (b.onclick = () => { const on = $$('#cgCats button.on', root).length; if (!b.classList.contains('on') && on >= 8) { toast('أكثر شي ٨ فئات'); return; } b.classList.toggle('on'); });
    $$('#cgCats button[data-c]', root).forEach(bindCat);
    $('#cgAddCat', root).onclick = () => {
      const name = (prompt('اسم الفئة الجديدة (مثلاً: لاعب كورة)') || '').trim().slice(0, 20);
      if (!name) return;
      const b = document.createElement('button'); b.type = 'button'; b.dataset.c = name; b.textContent = name;
      $('#cgAddCat', root).before(b); bindCat(b); b.click();
    };
    $('#cgHard', root).onclick = (e) => { const b = e.currentTarget; b.setAttribute('aria-checked', b.getAttribute('aria-checked') !== 'true'); };
    $$('#cgColor button', root).forEach((b) => (b.onclick = () => $$('#cgColor button', root).forEach((x) => x.classList.toggle('on', x === b))));
  }
  function readSettingsForm(root) {
    return {
      cats: $$('#cgCats button.on', root).map((b) => b.dataset.c),
      rounds: +$('#cgRounds .on', root).dataset.v, time: +$('#cgTime .on', root).dataset.v,
      mode: $('#cgMode .on', root).dataset.v, hard: $('#cgHard', root).getAttribute('aria-checked') === 'true'
    };
  }
  function openCreate(prefill) {
    sheet('<h2>لعبة جديدة</h2><p>تاخذ رقم وكود سري من ٦ أرقام، وترسله لجماعتك.</p>' + settingsForm(prefill || S.last, true) +
      '<div class="err" id="cgErr"></div><button class="link-btn primary" id="cgGo">أنشئ اللعبة</button>', (root) => {
      bindSettingsForm(root);
      $('#cgGo').onclick = async (e) => {
        const btn = e.currentTarget, me = $('#cgMe').value.trim(), st = readSettingsForm(root);
        if (!me) { $('#cgErr').textContent = 'اكتب اسمك'; $('#cgMe').focus(); return; }
        if (st.cats.length < 3) { $('#cgErr').textContent = 'اختر ٣ فئات على الأقل'; return; }
        const color = +(($('#cgColor .on') || {}).dataset || {}).c || 0;
        S.name = me; S.color = color; S.last = st; save();
        btn.disabled = true; btn.textContent = 'لحظة…';
        const r = await api('/create', { name: $('#cgName').value.trim(), player: { name: me, color }, settings: st });
        btn.disabled = false; btn.textContent = 'أنشئ اللعبة';
        if (r.error) { $('#cgErr').textContent = errText(r.error); return; }
        closeSheet(); SND.pop();
        enterGame(r.g, r.t, r.me, r.state);
      };
    });
  }

  /* ---------- الدخول بالكود ---------- */
  function openJoin(code) {
    sheet('<h2>ادخل لعبة</h2><p>اطلب الكود من اللي أنشأ اللعبة، أو امسح الباركود من جهازه.</p>' +
      '<label class="flabel" for="jnCode">كود اللعبة</label><input class="tin codein" id="jnCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="------" value="' + esc(code || '') + '">' +
      '<div id="jnInfo" style="text-align:center;font-weight:700;margin-top:8px;min-height:24px"></div>' +
      '<label class="flabel" for="jnMe">اسمك</label><input class="tin" id="jnMe" maxlength="20" placeholder="اكتب اسمك" value="' + esc(S.name) + '">' +
      '<div class="flabel">لونك</div><div class="colors big" id="cgColor">' + COLORS.map((c, i) => '<button type="button" data-c="' + i + '" style="background:' + c + '" class="' + (i === S.color ? 'on' : '') + '" aria-label="لون ' + (i + 1) + '"></button>').join('') + '</div>' +
      '<div class="err" id="jnErr"></div><button class="link-btn primary" id="jnGo">ادخل</button>', (root) => {
      $$('#cgColor button', root).forEach((b) => (b.onclick = () => $$('#cgColor button', root).forEach((x) => x.classList.toggle('on', x === b))));
      const inp = $('#jnCode');
      let lastChk = '';
      const check = async () => {
        const c = inp.value.replace(/\D/g, '').slice(0, 6);
        if (inp.value !== c) inp.value = c;
        $('#jnErr').textContent = '';
        if (c.length < 6) { $('#jnInfo').textContent = ''; lastChk = ''; return; }
        if (c === lastChk) return; lastChk = c;
        const r = await api('/join', { code: c, check: 1 });
        if (inp.value !== c) return;
        $('#jnInfo').innerHTML = r.error ? '<span style="color:var(--bad)">' + esc(errText(r.error)) + '</span>' : '<span style="color:var(--good)">✓ ' + esc(r.name) + ' <span class="num">#' + r.g + '</span></span>';
        const mine = !r.error && hist(r.g);
        if (mine && mine.status !== 'done') { closeSheet(); toast('رجعناك لنفس اللعبة'); enterGame(mine.g, mine.t, mine.me, null, true); }
      };
      inp.addEventListener('input', check);
      if (code) check(); else setTimeout(() => inp.focus(), 250);
      $('#jnGo').onclick = async (e) => {
        const btn = e.currentTarget, c = inp.value.replace(/\D/g, ''), me = $('#jnMe').value.trim();
        if (c.length !== 6) { $('#jnErr').textContent = 'الكود ٦ أرقام'; inp.focus(); return; }
        if (!me) { $('#jnErr').textContent = 'اكتب اسمك'; $('#jnMe').focus(); return; }
        const color = +(($('#cgColor .on') || {}).dataset || {}).c || 0;
        S.name = me; S.color = color; save();
        btn.disabled = true; btn.textContent = 'لحظة…';
        const r = await api('/join', { code: c, player: { name: me, color } });
        btn.disabled = false; btn.textContent = 'ادخل';
        if (r.error) { $('#jnErr').textContent = errText(r.error); return; }
        closeSheet(); SND.pop();
        enterGame(r.g, r.t, r.me, r.state);
      };
    });
  }

  /* ================= اللعبة الجماعية ================= */
  const G = { g: 0, t: '', me: '', s: null, rev: 0, off: 0, pollT: 0, key: '', ans: [], saveT: 0, finalSent: false, failN: 0, revealed: false, cdLast: -1, tickLast: -1, viewCat: null, confetti: 0, spinT: 0 };
  const nowS = () => Date.now() + G.off;
  function enterGame(g, t, me, state, back) {
    if (G.g !== g) Object.assign(G, { g, t, me, s: null, rev: 0, key: '', ans: [], finalSent: false, viewCat: null, confetti: 0 });
    S.active = { g, t, me }; save();
    show('game');
    if (state) onState(state);
    else if (G.s && G.s.game.id === g) { G.key = ''; renderGame(); }
    else $('#v-game').innerHTML = '<div class="wait dots" style="margin-top:40vh">جاري الدخول</div>';
    if (back) api('/act', { g, t, a: 'back' }).then((r) => { if (!r.error) onState(r); });
    poll();
  }
  function leaveToHome() { show('home'); }
  async function poll() {
    clearTimeout(G.pollT);
    if (!G.g) return;
    const j = await api('/state?g=' + G.g + '&t=' + encodeURIComponent(G.t) + '&rev=' + (G.s ? G.rev : 0));
    if (j.error === 'net' || j.error === 'server' || j.error === 'http') { G.failN++; $('#net').hidden = G.failN < 3 || current !== 'game'; }
    else { G.failN = 0; $('#net').hidden = true; }
    if (j.kicked) return kicked();
    if (j.error === 'auth') return lost();
    if (j.now) G.off = j.now - Date.now();
    if (!j.error && !j.same) onState(j);
    schedulePoll();
  }
  function schedulePoll(ms) {
    clearTimeout(G.pollT);
    if (!G.g || !S.active || S.active.g !== G.g) return;
    const st = G.s && G.s.game.status;
    if (st === 'done') return;
    const d = ms != null ? ms : current !== 'game' ? 5000 : document.hidden ? 8000 : st === 'play' ? 900 : 1100;
    G.pollT = setTimeout(poll, d);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && G.g && S.active) poll(); });
  function kicked() {
    clearTimeout(G.pollT); const h = hist(G.g); if (h) { h.status = 'done'; h.kicked = true; }
    S.active = null; save();
    $('#v-game').innerHTML = '<div class="panel" style="margin-top:30vh;text-align:center"><h2>المضيف طلّعك من اللعبة</h2><button class="link-btn primary" id="kOk">رجوع</button></div>';
    $('#kOk').onclick = () => { G.g = 0; show('home'); };
  }
  function lost() {
    clearTimeout(G.pollT); S.active = null; save(); G.g = 0;
    toast('ما قدرنا نوصل لهاللعبة'); show('home');
  }

  function onState(s) {
    if (!s || !s.game) return;
    const prev = G.s;
    G.s = s; G.rev = s.rev; if (s.now) G.off = s.now - Date.now();
    recordState(s);
    if (s.game.status === 'done' && S.active && S.active.g === s.game.id) { S.active = null; save(); }
    // أصوات التحولات
    if (prev && prev.game.status !== s.game.status) {
      if (s.game.status === 'review') { SND.stop(); vib(120); }
      if (s.game.status === 'done') SND.win();
    }
    if (prev && !prev.game.stop_at && s.game.stop_at && s.game.stop_by !== s.me) { SND.stop(); vib([80, 60, 80]); }
    if (current === 'game') renderGame();
    else if (current === 'home') renderHome();
  }

  const meP = () => G.s.players.find((p) => p.id === G.s.me) || {};
  const isHost = () => G.s && G.s.game.host === G.s.me;
  const activePlayers = () => G.s.players.filter((p) => !p.gone);
  const pById = (id) => G.s.players.find((p) => p.id === id) || { name: '؟', color: 9 };

  function renderGame() {
    const s = G.s; if (!s) return;
    const gm = s.game;
    if (s.left) return rLeft();
    let key = gm.status + ':' + gm.round;
    if (gm.status === 'play') key += nowS() < gm.starts_at ? ':spin' : ':write';
    const full = key !== G.key; G.key = key;
    if (gm.status === 'lobby') rLobby();
    else if (gm.status === 'play') { if (nowS() < gm.starts_at) { if (full) rSpin(); } else if (full) rWrite(); else uWrite(); }
    else if (gm.status === 'review') rReview(full);
    else if (gm.status === 'score') rScore();
    else if (gm.status === 'done') rDone(full);
  }
  function gtop(sub, extra) {
    const gm = G.s.game;
    const chip = gm.status === 'lobby' ? (isHost() ? 'أنت المضيف' : 'بانتظار المضيف') : gm.status === 'done' ? 'انتهت' : 'الجولة ' + gm.round + ' من ' + gm.settings.rounds;
    return '<header class="gtop"><div class="gr"><button class="icb" id="gBack" aria-label="رجوع للرئيسية">' + IC.back + '</button>' +
      '<div class="gname"><b>' + esc(gm.name) + '</b><small><bdi>#' + gm.id + '</bdi>' + (sub ? ' · ' + sub : '') + '</small></div>' +
      '<span class="rchip">' + chip + '</span><button class="icb" id="gMenu" aria-label="خيارات">' + IC.more + '</button></div>' + (extra ? '<div class="gx">' + extra + '</div>' : '') + '</header>';
  }
  function bindTop() {
    $('#gBack').onclick = leaveToHome;
    $('#gMenu').onclick = openMenu;
  }
  function openMenu() {
    const gm = G.s.game, host = isHost(), done = gm.status === 'done';
    sheet('<h2>' + esc(gm.name) + ' <span class="num">#' + gm.id + '</span></h2><p>' + (done ? 'اللعبة انتهت وانحفظت في السجل.' : 'الكود: <b class="ltr">' + esc(gm.code || '') + '</b>') + '</p>' +
      (!done ? '<button class="link-btn" id="mShare">' + IC.share + 'شارك رابط الدخول</button>' : '') +
      (host ? '<button class="link-btn" id="mRename">غيّر اسم اللعبة</button>' : '') +
      '<button class="link-btn" id="mMe">غيّر اسمي ولوني</button>' +
      (host && !done ? '<button class="link-btn danger" id="mEnd">إنهاء اللعبة للكل</button>' : '') +
      (!done ? '<button class="link-btn danger" id="mLeave">اطلع من اللعبة</button>' : '') +
      '<button class="link-btn" id="mClose">إغلاق</button>', () => {
      const b = (id, f) => { const el = $('#' + id); if (el) el.onclick = f; };
      b('mShare', () => { closeSheet(); shareJoin(); });
      b('mRename', () => renameSheet());
      b('mMe', () => meSheet());
      b('mEnd', () => confirmSheet('إنهاء اللعبة؟', 'تنتهي للكل وتنحسب النتيجة على الجولات اللي خلصت.', 'إنهاء اللعبة', () => act({ a: 'end' }), true));
      b('mLeave', () => confirmSheet('تطلع من اللعبة؟', host ? 'الإدارة تنتقل لواحد ثاني، وتقدر ترجع بنفس الكود.' : 'تقدر ترجع بنفس الكود.', 'اطلع', async () => {
        await act({ a: 'leave' }); clearTimeout(G.pollT); S.active = null; save(); G.g = 0; show('home');
      }, true));
      b('mClose', closeSheet);
    });
  }
  function renameSheet() {
    sheet('<h2>اسم اللعبة</h2><input class="tin" id="rnName" maxlength="40" value="' + esc(G.s.game.name) + '"><button class="link-btn primary" id="rnGo">حفظ</button>', () => {
      $('#rnGo').onclick = async () => { const n = $('#rnName').value.trim(); if (!n) return; closeSheet(); await act({ a: 'rename', name: n }); };
    });
  }
  function meSheet() {
    const me = meP();
    sheet('<h2>اسمي ولوني</h2><input class="tin" id="meName" maxlength="20" value="' + esc(me.name) + '"><div class="colors big" id="cgColor" style="margin-top:14px">' + COLORS.map((c, i) => '<button type="button" data-c="' + i + '" style="background:' + c + '" class="' + (i === me.color ? 'on' : '') + '"></button>').join('') + '</div><button class="link-btn primary" id="meGo">حفظ</button>', (root) => {
      $$('#cgColor button', root).forEach((b) => (b.onclick = () => $$('#cgColor button', root).forEach((x) => x.classList.toggle('on', x === b))));
      $('#meGo').onclick = async () => {
        const n = $('#meName').value.trim(); if (!n) return;
        const color = +$('#cgColor .on').dataset.c;
        S.name = n; S.color = color; save(); closeSheet();
        await act({ a: 'me', player: { name: n, color } });
      };
    });
  }
  async function act(o) {
    const r = await api('/act', Object.assign({ g: G.g, t: G.t }, o));
    if (r.kicked) { kicked(); return r; }
    if (r.error) { if (r.error !== 'closed') toast(errText(r.error)); return r; }
    onState(r);
    return r;
  }
  const joinURL = () => SITE + '#j=' + (G.s.game.code || '');
  async function shareJoin() {
    const gm = G.s.game, text = 'تعال العب معنا «' + gm.name + '» في حَرف 🔤\nالكود: ' + gm.code + '\n' + joinURL();
    if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(text); toast('انسخ الرابط والكود'); } catch (e) { toast(joinURL()); }
  }
  function qrSVG(text) {
    try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch (e) { return ''; }
  }

  /* ----- غرفة الانتظار ----- */
  function rLobby() {
    const s = G.s, gm = s.game, host = isHost(), st = gm.settings, ps = activePlayers();
    $('#v-game').innerHTML = gtop('كود ' + gm.code) +
      '<div class="gl codebox"><div class="cl"><small>كود اللعبة</small><div class="code">' + esc(gm.code) + '</div><small>امسحوا الباركود أو اكتبوا الكود</small>' +
      '<div class="cbtns"><button id="lbCopy">' + 'نسخ الكود' + '</button><button id="lbShare">شارك الرابط</button></div></div>' +
      '<div class="qr" aria-label="باركود الدخول" role="img">' + qrSVG(joinURL()) + '</div></div>' +
      '<div class="panel"><h2>اللاعبين <span style="color:var(--dim);font-weight:500;font-size:14px">(' + ps.length + ')</span></h2>' +
      '<p class="sub">' + (host ? 'اضغط على أي لاعب تعطيه وقت إضافي أو تطلّعه.' : 'اضغط على اسمك تغيّره.') + '</p>' +
      '<div class="pls">' + ps.map((p) => '<button class="pl" data-p="' + p.id + '">' + av(p.name, p.color, '', p.on) +
        '<span class="pn"><b>' + esc(p.name) + (p.id === s.me ? ' (أنت)' : '') + '</b><small>' + (p.on ? 'متصل' : 'غير متصل') + '</small></span>' +
        (p.extra ? '<span class="pill extra">+' + p.extra + ' ث</span>' : '') + (p.id === gm.host ? '<span class="pill host">المضيف</span>' : '') + '</button>').join('') + '</div></div>' +
      '<div class="panel"><h2>الإعدادات</h2><div class="chips">' + st.cats.map((c) => '<span class="chip">' + esc(c) + '</span>').join('') + '</div>' +
      '<div class="chips"><span class="chip">' + st.rounds + ' جولات</span><span class="chip">' + st.time + ' ثانية</span><span class="chip">' + (st.mode === 'stop' ? 'ستوب!' : 'لين يخلص الوقت') + '</span>' + (st.hard ? '<span class="chip">الحروف الصعبة</span>' : '') + '</div>' +
      (host ? '<div class="row2"><button class="link-btn" id="lbEdit">تعديل الإعدادات</button><button class="link-btn" id="lbLock">' + (gm.locked ? 'افتح اللعبة' : 'اقفل اللعبة') + '</button></div>' : '') +
      (gm.locked ? '<p class="sub" style="margin-top:10px">اللعبة مقفولة، ما أحد جديد يقدر يدخل.</p>' : '') + '</div>' +
      (host ? '<div class="stickb"><button class="link-btn primary" id="lbStart"' + (ps.length < 1 ? ' disabled' : '') + '>ابدأ اللعب</button></div>' + (ps.length < 2 ? '<p class="wait">تقدر تبدأ لحالك، بس الحماس مع الجماعة</p>' : '')
        : '<p class="wait"><span class="dots">بانتظار المضيف يبدأ</span></p>');
    bindTop();
    $('#lbCopy').onclick = async () => { try { await navigator.clipboard.writeText(gm.code); toast('انسخ الكود'); } catch (e) { toast(gm.code); } };
    $('#lbShare').onclick = shareJoin;
    $$('.pl').forEach((b) => (b.onclick = () => playerSheet(b.dataset.p)));
    if (host) {
      $('#lbEdit').onclick = () => sheet('<h2>إعدادات اللعبة</h2>' + settingsForm(st, false) + '<button class="link-btn primary" id="stGo">حفظ</button>', (root) => {
        bindSettingsForm(root);
        $('#stGo').onclick = async () => { const n = readSettingsForm(root); if (n.cats.length < 3) { toast('اختر ٣ فئات على الأقل'); return; } S.last = n; save(); closeSheet(); await act({ a: 'settings', settings: n }); };
      });
      $('#lbLock').onclick = () => act({ a: 'lock', v: !gm.locked });
      $('#lbStart').onclick = async (e) => { e.currentTarget.disabled = true; SND.go(); await act({ a: 'start' }); };
    }
  }
  function playerSheet(pid) {
    const p = pById(pid), host = isHost(), mine = pid === G.s.me;
    if (!host && !mine) return;
    if (mine && !host) return meSheet();
    sheet('<div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">' + av(p.name, p.color, 'lg') + '<h2 style="margin:0">' + esc(p.name) + '</h2></div>' +
      '<div class="flabel">وقت إضافي (للصغار)</div><div class="seg wide" id="exSeg">' + EXTRAS.map((n) => '<button data-v="' + n + '" class="' + (n === (p.extra || 0) ? 'on' : '') + '">' + (n ? '+' + n : 'بدون') + '</button>').join('') + '</div>' +
      '<p style="margin-top:8px;font-size:13px">ثواني زيادة على وقت الجولة وبعد «ستوب!».</p>' +
      (mine ? '<button class="link-btn" id="psMe">غيّر اسمي ولوني</button>' : '<button class="link-btn danger" id="psKick">طلّعه من اللعبة</button>') +
      '<button class="link-btn" id="psClose">تم</button>', () => {
      $$('#exSeg button').forEach((b) => (b.onclick = async () => { $$('#exSeg button').forEach((x) => x.classList.toggle('on', x === b)); await act({ a: 'extra', player: pid, v: +b.dataset.v }); }));
      if ($('#psKick')) $('#psKick').onclick = () => confirmSheet('تطلّع ' + p.name + '؟', 'ما يقدر يرجع لهاللعبة.', 'طلّعه', () => act({ a: 'kick', player: pid }), true);
      if ($('#psMe')) $('#psMe').onclick = meSheet;
      $('#psClose').onclick = closeSheet;
    });
  }

  /* ----- العجلة ----- */
  function wheelSVG(letter) {
    const L = (EASY + (G.s.game.settings.hard ? HARD : '')).split('');
    const n = L.length, r = 41;
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1"/><circle cx="50" cy="50" r="34" fill="none" stroke="rgba(255,255,255,.3)" stroke-width=".6" stroke-dasharray="1.5 3"/>' +
      '<g class="ring" id="ring" style="transform-origin:50px 50px">' + L.map((ch, i) => {
        const a = -Math.PI / 2 + 2 * Math.PI * i / n, x = 50 + r * Math.cos(a), y = 50 + r * Math.sin(a) + 2.6;
        return '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="middle" font-family="Baloo Bhaijaan 2, sans-serif" font-weight="800" font-size="7.5" fill="#fff" opacity="' + (ch === letter ? 1 : 0.6) + '">' + showL(ch) + '</text>';
      }).join('') + '</g></svg>';
  }
  function rSpin() {
    const gm = G.s.game;
    G.revealed = false; G.cdLast = -1; G.finalSent = false; G.viewCat = null;
    $('#v-game').innerHTML = gtop() + '<div class="spin"><div class="lbl">الجولة ' + gm.round + ' من ' + gm.settings.rounds + '</div>' +
      '<div class="wheel">' + wheelSVG(gm.letter) + '<div class="bigtile" id="bt">؟</div></div>' +
      '<div class="lname" id="ln">&nbsp;</div><div class="cd" id="cd"></div></div>';
    bindTop();
    requestAnimationFrame(() => requestAnimationFrame(() => { const r = $('#ring'); if (r) r.style.transform = 'rotate(' + (1080 + Math.random() * 360) + 'deg)'; }));
    clearInterval(G.spinT);
    const pool = (EASY + (gm.settings.hard ? HARD : '')).split('');
    G.spinT = setInterval(() => {
      const left = gm.starts_at - nowS(), bt = $('#bt');
      if (!bt || G.key.indexOf(':spin') < 0) { clearInterval(G.spinT); return; }
      if (left > 3300) { bt.textContent = showL(pool[Math.floor(Math.random() * pool.length)]); SND.spin(); return; }
      if (!G.revealed) {
        G.revealed = true; bt.textContent = showL(gm.letter); bt.classList.add('pop');
        $('#ln').textContent = 'حرف ' + (LNAME[gm.letter] || ''); SND.ding(); vib(60);
      }
      const n = Math.ceil(left / 1000);
      if (n !== G.cdLast && n >= 1 && n <= 3) { G.cdLast = n; const cd = $('#cd'); cd.textContent = n; cd.classList.remove('go'); void cd.offsetWidth; cd.classList.add('go'); SND.tick(); }
      if (left <= 0) { clearInterval(G.spinT); SND.go(); vib(40); renderGame(); }
    }, 90);
  }

  /* ----- وقت الكتابة ----- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const myDeadline = () => { const gm = G.s.game, base = gm.stop_at ? Math.min(gm.ends_at, gm.stop_at + gm.stop_ms) : gm.ends_at; return base + (meP().extra || 0) * 1000; };
  const ansKey = () => 'harf-ans-' + G.g + '-' + G.s.game.round;
  function rWrite() {
    const s = G.s, gm = s.game, st = gm.settings;
    let local = null; try { local = JSON.parse(sessionStorage.getItem(ansKey()) || 'null'); } catch (e) {}
    const srv = s.mine || [];
    G.ans = st.cats.map((_, i) => (local && local[i]) || srv[i] || '');
    G.finalSent = false; G.tickLast = -1;
    $('#v-game').innerHTML = gtop() +
      '<div class="gl phead"><span class="ptile">' + showL(gm.letter) + '</span><span class="pm"><b>حرف ' + esc(LNAME[gm.letter] || '') + '</b><small>' + (st.mode === 'stop' ? 'كمّل كل الخانات واضغط «ستوب!»' : 'اكتب قبل ما يخلص الوقت') + '</small></span>' +
      '<span class="timer" id="tm"><svg viewBox="0 0 64 64"><circle class="tb" cx="32" cy="32" r="27"/><circle class="tf" id="tmf" cx="32" cy="32" r="27" stroke-dasharray="169.6" stroke-dashoffset="0"/></svg><b id="tmn"></b></span></div>' +
      '<div id="pBan"></div>' +
      '<div class="fields">' + st.cats.map((c, i) => '<div><div class="fld" id="f' + i + '"><div class="fi"><label for="in' + i + '">' + esc(c) + '</label><input id="in' + i + '" data-i="' + i + '" enterkeyhint="next" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="30" placeholder="' + esc(c) + ' بحرف ' + showL(gm.letter) + '…" value="' + esc(G.ans[i]) + '"></div>' +
        '<span class="ok" id="ok' + i + '" hidden>' + IC.check + '</span>' + (SR ? '<button class="mic" type="button" data-i="' + i + '" aria-label="اكتب ' + esc(c) + ' بصوتك">' + IC.mic + '</button>' : '') + '</div><div class="fwarn" id="w' + i + '" hidden></div></div>').join('') + '</div>' +
      '<div class="dones" id="pDones"></div><div class="stickb"><button class="link-btn primary" id="pAct"></button></div>';
    bindTop();
    $$('.fld input').forEach((inp) => {
      inp.addEventListener('input', () => { const i = +inp.dataset.i; G.ans[i] = inp.value; validate(i); queueSave(); actBtn(); });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const nx = $('#in' + (+inp.dataset.i + 1)); if (nx) nx.focus(); else inp.blur(); } });
    });
    $$('.fld .mic').forEach((b) => (b.onclick = () => listen(+b.dataset.i, b)));
    $('#pAct').onclick = onAct;
    st.cats.forEach((_, i) => validate(i));
    uWrite();
    if (!meP().done && nowS() < myDeadline()) { const first = G.ans.findIndex((x) => !x); if (first >= 0 && window.innerWidth > 700) $('#in' + first).focus(); }
  }
  function validate(i) {
    const v = G.ans[i], n = norm(v), L = norm(G.s.game.letter), f = $('#f' + i), w = $('#w' + i), ok = $('#ok' + i);
    if (!f) return;
    const bad = n && n[0] !== L;
    f.classList.toggle('warn', !!bad); ok.hidden = !n || bad;
    w.hidden = !bad; if (bad) w.textContent = '«' + v.trim() + '» ما تبدأ بحرف ' + showL(G.s.game.letter);
  }
  function queueSave() {
    try { sessionStorage.setItem(ansKey(), JSON.stringify(G.ans)); } catch (e) {}
    clearTimeout(G.saveT);
    G.saveT = setTimeout(() => sendAns('save'), 1200);
  }
  async function sendAns(a) {
    clearTimeout(G.saveT);
    if (!G.s || G.s.game.status !== 'play') return;
    const r = await api('/act', { g: G.g, t: G.t, a, round: G.s.game.round, answers: G.ans });
    if (r.error) { if (r.error === 'incomplete') toast('كمّل كل الخانات بكلمات تبدأ بالحرف'); else if (r.error !== 'closed' && a !== 'save') toast(errText(r.error)); return r; }
    if (a !== 'save') onState(r);
    return r;
  }
  function locked() { return meP().done || nowS() >= myDeadline() || G.s.game.status !== 'play'; }
  function actBtn() {
    const b = $('#pAct'); if (!b) return;
    const st = G.s.game.settings, done = meP().done, over = nowS() >= myDeadline();
    if (done) { b.disabled = true; b.textContent = 'سلّمت ✓ بانتظار الباقين'; return; }
    if (over) { b.disabled = true; b.textContent = 'خلص الوقت ⏰ نجمع الإجابات'; return; }
    if (st.mode === 'stop' && !G.s.game.stop_at) {
      const L = norm(G.s.game.letter), full = G.ans.every((x) => { const n = norm(x); return n && n[0] === L; });
      b.disabled = !full; b.textContent = full ? 'ستوب! خلصت' : 'ستوب! (كمّل كل الخانات صح)';
    } else { b.disabled = false; b.textContent = 'خلصت، سلّم إجاباتي'; }
  }
  async function onAct(e) {
    const b = e.currentTarget; b.disabled = true;
    const st = G.s.game.settings;
    if (st.mode === 'stop' && !G.s.game.stop_at) { SND.stop(); vib(100); await sendAns('stop'); }
    else await sendAns('done');
    actBtn();
  }
  function uWrite() {
    const s = G.s, gm = s.game;
    const lock = locked();
    $$('.fld input').forEach((i) => { i.disabled = lock; });
    $$('.fld .mic').forEach((i) => { i.disabled = lock; });
    if (lock) document.activeElement && document.activeElement.blur && document.activeElement.tagName === 'INPUT' && document.activeElement.blur();
    const ban = $('#pBan');
    if (ban) {
      if (gm.stop_at) {
        const who = gm.stop_by === s.me ? 'قلت ستوب!' : esc(pById(gm.stop_by).name) + ' قال ستوب!';
        ban.innerHTML = '<div class="banner stop"><span class="grow">' + who + (gm.stop_by === s.me ? ' الباقين لهم ثواني' : ' سلّم بسرعة') + '</span></div>';
      } else ban.innerHTML = '';
    }
    const ps = activePlayers(), d = $('#pDones');
    if (d) d.innerHTML = '<span>سلّموا:</span>' + ps.map((p) => av(p.name, p.color, 'sm' + (p.done ? ' d' : ''))).join('') + '<span>' + ps.filter((p) => p.done).length + ' من ' + ps.length + '</span>';
    actBtn();
  }
  function listen(i, btn) {
    if (!SR || locked()) return;
    try {
      const r = new SR(); r.lang = 'ar-SA'; r.interimResults = false; r.maxAlternatives = 1;
      btn.classList.add('rec');
      r.onresult = (e) => { const t = (e.results[0][0].transcript || '').trim(); if (!t) return; G.ans[i] = t; const inp = $('#in' + i); if (inp) inp.value = t; validate(i); queueSave(); actBtn(); };
      r.onend = () => btn.classList.remove('rec');
      r.onerror = () => { btn.classList.remove('rec'); toast('ما سمعتك، جرّب مرة ثانية أو اكتبها'); };
      r.start();
    } catch (e) { btn.classList.remove('rec'); }
  }

  /* ----- التصحيح والتصويت ----- */
  const ST_TXT = { uniq: 'فريدة +10', dup: 'مكررة +5', bad: 'حرف غلط', rej: 'مرفوضة', empty: '—' };
  function rReview(full) {
    const s = G.s, gm = s.game, st = gm.settings, host = isHost();
    if (full) G.viewCat = null;
    if (G.lastRcat !== gm.rcat) { G.viewCat = null; G.lastRcat = gm.rcat; }
    const c = G.viewCat != null ? G.viewCat : gm.rcat;
    const ids = Object.keys(s.review || {});
    const order = s.players.filter((p) => ids.includes(p.id));
    const myTotal = (s.roundTotals || {})[s.me] || 0;
    const sy = window.scrollY;
    $('#v-game').innerHTML = gtop() +
      '<div class="gl phead"><span class="ptile sm">' + showL(gm.letter) + '</span><span class="pm"><b>التصحيح</b><small>' + (host ? 'أنت تقلب الفئات، والكل يصوّت' : 'المضيف يقلب الفئات، وأنت صوّت') + '</small></span><span class="pill">مجموعك ' + myTotal + '</span></div>' +
      '<div class="cats">' + st.cats.map((x, i) => '<button data-c="' + i + '" class="' + (i === c ? 'on' : i <= gm.rcat ? 'seen' : '') + '">' + esc(x) + '</button>').join('') + '</div>' +
      '<div class="rtitle">' + esc(st.cats[c]) + ' بحرف ' + showL(gm.letter) + '<small>' + (c === gm.rcat ? 'الإجابة اللي ما يوافقون عليها أكثرهم ما تنحسب' : 'تشوف فئة غير اللي عند المضيف') + '</small></div>' +
      order.map((p) => {
        const e = s.review[p.id][c], mine = p.id === s.me, mv = (s.myVotes || {})[p.id + '|' + c];
        const stCls = e.tie ? 'tie' : e.st, stTxt = e.tie ? 'تعادل، المضيف يحسم' : ST_TXT[e.st];
        return '<div class="ans' + (mine ? ' me' : '') + '"><div class="a1">' + av(p.name, p.color) + '<span class="aw"><small>' + esc(p.name) + (mine ? ' (أنت)' : '') + '</small>' + (e.t ? '<b>' + esc(e.t) + '</b>' : '<b class="none">ما كتب شي</b>') + '</span>' +
          (host && e.t ? '<button class="st ' + stCls + '" data-p="' + p.id + '" data-c="' + c + '">' + stTxt + '</button>' : '<span class="st ' + stCls + '">' + stTxt + '</span>') + '</div>' +
          (e.t ? (mine ? '<div class="votes"><span class="q">رأيهم: ✓ ' + e.acc + ' · ✗ ' + e.rej + '</span></div>'
            : '<div class="votes"><span class="q">تنحسب؟</span><button class="vb yes' + (mv === 1 ? ' on' : '') + '" data-p="' + p.id + '" data-v="1">' + IC.check + e.acc + '</button><button class="vb no' + (mv === 0 ? ' on' : '') + '" data-p="' + p.id + '" data-v="0">' + IC.x + e.rej + '</button></div>') : '') +
          (e.ovr !== null ? '<div class="ovr">قرار المضيف: ' + (e.ovr ? 'تنحسب' : 'ما تنحسب') + '</div>' : '') + '</div>';
      }).join('') +
      (host ? '<div class="stickb">' + (gm.rcat < st.cats.length - 1 ? '<button class="link-btn primary" id="rvNext">الفئة الجاية: ' + esc(st.cats[gm.rcat + 1]) + '</button>' : '<button class="link-btn primary" id="rvNext">اعرض نتيجة الجولة</button>') + '</div>' +
        (gm.rcat < st.cats.length - 1 ? '<button class="txt-btn" id="rvFinish" style="display:block;margin:6px auto 0">خلّص التصحيح واعرض النتيجة</button>' : '') : '<p class="wait"><span class="dots">المضيف يقلب الفئات</span></p>');
    window.scrollTo(0, full ? 0 : sy);
    bindTop();
    $$('.cats button').forEach((b) => (b.onclick = () => { const i = +b.dataset.c; if (host) { G.viewCat = null; act({ a: 'cat', cat: i }); } else { G.viewCat = i; rReview(false); } }));
    $$('.vb').forEach((b) => (b.onclick = () => {
      const pid = b.dataset.p, v = +b.dataset.v, cur = (G.s.myVotes || {})[pid + '|' + c];
      SND.pop(); act({ a: 'vote', player: pid, cat: c, v: cur === v ? null : v });
    }));
    $$('button.st').forEach((b) => (b.onclick = () => decideSheet(b.dataset.p, +b.dataset.c)));
    if ($('#rvNext')) $('#rvNext').onclick = (e) => { e.currentTarget.disabled = true; act({ a: 'next' }); };
    if ($('#rvFinish')) $('#rvFinish').onclick = () => confirmSheet('تخلّص التصحيح؟', 'الفئات الباقية تنحسب مثل ما هي.', 'اعرض النتيجة', () => act({ a: 'next', finish: 1 }));
    const on = $('.cats button.on'); if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  }
  function decideSheet(pid, c) {
    const e = G.s.review[pid][c], p = pById(pid);
    sheet('<h2>قرار المضيف</h2><p>«' + esc(e.t) + '» من ' + esc(p.name) + ' · ✓ ' + e.acc + ' · ✗ ' + e.rej + '</p>' +
      '<button class="link-btn primary" data-v="1">تنحسب</button><button class="link-btn danger" data-v="0">ما تنحسب</button><button class="link-btn" data-v="-1">خلّها للتصويت</button>', (root) => {
      $$('button[data-v]', root).forEach((b) => (b.onclick = () => { const v = +b.dataset.v; closeSheet(); act({ a: 'decide', player: pid, cat: c, v: v < 0 ? null : v }); }));
    });
  }

  /* ----- نتيجة الجولة ----- */
  function ranking() {
    const ps = G.s.players.filter((p) => p.gone !== 2).slice().sort((a, b) => b.score - a.score);
    let rank = 0, prev = null;
    return ps.map((p, i) => { if (p.score !== prev) { rank = i + 1; prev = p.score; } return Object.assign({ rank }, p); });
  }
  function rScore() {
    const s = G.s, gm = s.game, st = gm.settings, host = isHost(), last = gm.round >= st.rounds;
    const rt = s.roundTotals || {}, rows = ranking();
    $('#v-game').innerHTML = gtop() +
      '<div class="gl phead"><span class="ptile sm">' + showL(gm.letter) + '</span><span class="pm"><b>نتيجة الجولة ' + gm.round + ' من ' + st.rounds + '</b><small>' + (rows[0] && rows[0].score ? esc(rows[0].name) + ' في الصدارة' : 'بداية حماسية') + '</small></span></div>' +
      '<div class="gl tbl"><div class="tr th"><span>#</span><span>اللاعب</span><span style="text-align:center">الجولة</span><span style="text-align:left">المجموع</span></div>' +
      rows.map((p) => '<div class="tr' + (p.rank === 1 && p.score ? ' lead' : '') + '"><span class="rk">' + p.rank + '</span><span class="who">' + av(p.name, p.color, 'sm') + '<b>' + esc(p.name) + '</b></span><span class="plus">+' + (rt[p.id] || 0) + '</span><span class="tot">' + p.score + '</span></div>').join('') + '</div>' +
      (host ? '<div class="stickb"><button class="link-btn primary" id="scNext">' + (last ? 'النتيجة النهائية' : 'الجولة الجاية') + '</button></div>' + (!last ? '<button class="txt-btn" id="scEnd" style="display:block;margin:6px auto 0">إنهاء اللعبة هنا</button>' : '')
        : '<p class="wait"><span class="dots">' + (last ? 'بانتظار المضيف يعرض النتيجة' : 'بانتظار المضيف يبدأ الجولة الجاية') + '</span></p>');
    bindTop();
    if ($('#scNext')) $('#scNext').onclick = (e) => { e.currentTarget.disabled = true; act({ a: 'next' }); };
    if ($('#scEnd')) $('#scEnd').onclick = () => confirmSheet('إنهاء اللعبة؟', 'النتيجة تنحسب على ' + gm.round + ' جولات.', 'إنهاء اللعبة', () => act({ a: 'end' }), true);
  }

  /* ----- نهاية اللعبة ----- */
  function podiumHTML(rows) {
    const p = (r, cls) => r ? '<div class="pod ' + cls + '">' + (cls === 'p1' ? '<span class="crown">' + IC.crown + '</span>' : '') + av(r.name, r.color, cls === 'p1' ? 'lg' : '') + '<span class="pnm">' + esc(r.name) + '</span><span class="pts">' + r.score + '</span><span class="blk">' + r.rank + '</span></div>' : '<div></div>';
    return '<div class="podium">' + p(rows[1], 'p2') + p(rows[0], 'p1') + p(rows[2], 'p3') + '</div>';
  }
  function roundsGrid(rounds, players) {
    if (!rounds || !rounds.length) return '';
    return '<div class="gl rgrid" style="padding:4px 10px"><table><tr><th>اللاعب</th>' + rounds.map((r) => '<th class="lt">' + showL(r.letter) + '</th>').join('') + '<th>المجموع</th></tr>' +
      players.map((p) => '<tr><td>' + esc(p.name) + '</td>' + rounds.map((r) => '<td>' + ((r.scores || {})[p.id] || 0) + '</td>').join('') + '<td><b>' + p.score + '</b></td></tr>').join('') + '</table></div>';
  }
  function rDone(full) {
    const s = G.s, gm = s.game, rows = (s.results && s.results.players) || ranking();
    const win = rows.filter((r) => r.rank === 1 && r.score > 0);
    $('#v-game').innerHTML = gtop('', '<div class="win-t">انتهت اللعبة</div><div class="win-n">' +
      (win.length ? (win.length > 1 ? 'تعادل! ' : 'الفايز: ') + esc(win.map((w) => w.name).join(' و ')) : 'ولا نقطة! نعيدها؟') + '</div>') +
      podiumHTML(rows) +
      '<div class="gl tbl">' + rows.map((p) => '<div class="tr' + (p.rank === 1 && p.score ? ' lead' : '') + '"><span class="rk">' + p.rank + '</span><span class="who">' + av(p.name, p.color, 'sm') + '<b>' + esc(p.name) + '</b></span><span></span><span class="tot">' + p.score + '</span></div>').join('') + '</div>' +
      roundsGrid(s.rounds, rows) +
      '<p class="wait">انحفظت في السجل: <bdi>#' + gm.id + '</bdi> · ' + esc(gm.name) + '</p>' +
      '<button class="link-btn primary" id="dnShare">' + IC.share + 'شارك النتيجة</button>' +
      '<div class="row2"><button class="link-btn" id="dnNew">لعبة جديدة</button><button class="link-btn" id="dnHome">الرئيسية</button></div>';
    bindTop();
    $('#dnShare').onclick = () => shareResult(gm.id, gm.name, rows, s.rounds);
    $('#dnNew').onclick = () => { G.g = 0; openCreate(gm.settings); };
    $('#dnHome').onclick = () => { G.g = 0; show('home'); };
    if (full && G.confetti !== gm.id) { G.confetti = gm.id; confetti(); }
  }
  function confetti() {
    const box = document.createElement('div'); box.className = 'confetti';
    const cols = ['#f5841f', '#ffb067', '#2BB3A3', '#0F7A71', '#f5b62a', '#c2185b', '#FFF4E2'];
    for (let i = 0; i < 70; i++) { const el = document.createElement('i'); el.style.left = Math.random() * 100 + '%'; el.style.background = cols[i % cols.length]; el.style.animationDuration = 2 + Math.random() * 2 + 's'; el.style.animationDelay = Math.random() * 0.8 + 's'; box.appendChild(el); }
    document.body.appendChild(box); setTimeout(() => box.remove(), 5200);
  }
  async function shareResult(id, name, rows, rounds) {
    const medal = ['🥇', '🥈', '🥉'];
    const text = 'حَرف 🔤 ' + (id ? '#' + id + ' · ' : '') + name + '\n' + rows.map((r) => (medal[r.rank - 1] || '•') + ' ' + r.name + ': ' + r.score).join('\n') +
      (rounds && rounds.length ? '\nالحروف: ' + rounds.map((r) => showL(r.letter)).join(' ') : '') + '\n' + SITE;
    if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(text); toast('انسخت النتيجة'); } catch (e) { toast('ما قدرنا ننسخ'); }
  }
  function rLeft() {
    $('#v-game').innerHTML = gtop() + '<div class="panel" style="text-align:center;margin-top:20vh"><h2>طلعت من اللعبة</h2><p class="sub">تقدر ترجع لها ما دامها شغالة.</p><button class="link-btn primary" id="lfBack">ارجع للعبة</button><button class="link-btn" id="lfHome">الرئيسية</button></div>';
    bindTop();
    $('#lfBack').onclick = () => act({ a: 'back' });
    $('#lfHome').onclick = () => { S.active = null; save(); G.g = 0; show('home'); };
  }

  /* ----- المؤقت: كل ربع ثانية ----- */
  setInterval(() => {
    if (current !== 'game' || !G.s || G.s.game.status !== 'play') return;
    const gm = G.s.game;
    if (G.key.endsWith(':spin')) { if (nowS() >= gm.starts_at + 300) renderGame(); return; }
    const dl = myDeadline(), left = dl - nowS(), total = gm.settings.time * 1000 + (meP().extra || 0) * 1000;
    const f = $('#tmf'), n = $('#tmn');
    if (f) { f.style.strokeDashoffset = (169.6 * (1 - Math.max(0, Math.min(1, left / total)))).toFixed(1); }
    if (n) n.textContent = Math.max(0, Math.ceil(left / 1000));
    const tm = $('#tm'); if (tm) tm.classList.toggle('low', left < 10000);
    const sec = Math.ceil(left / 1000);
    if (sec !== G.tickLast) { G.tickLast = sec; if (sec <= 5 && sec >= 1 && !meP().done) { SND.tick(); vib(20); } }
    if (left <= 0 && !G.finalSent) {
      G.finalSent = true;
      if (!meP().done) { sendAns('done'); }
      uWrite();
    }
  }, 250);

  /* ================= السجل ================= */
  function renderHistory() {
    const list = S.games.slice().sort((a, b) => (b.created || 0) - (a.created || 0));
    if (!list.length) {
      $('#histList').innerHTML = '<div class="gl empty" style="margin-top:14px"><div class="tiles"><span class="tile o">ح</span><span class="tile">ر</span><span class="tile">ف</span></div>ما لعبت للحين. أول لعبة تنحفظ هنا برقمها واسمها ونتيجتها.</div>';
      return;
    }
    $('#histList').innerHTML = '<div class="hhead"><h2>ألعابك</h2><span>' + list.length + ' لعبة</span></div>' + list.map((h, i) => {
      const live = !h.paper && h.status && h.status !== 'done';
      const ps = (h.players || []).slice().sort((a, b) => b.score - a.score);
      const win = h.winners && h.winners.length ? h.winners.join(' و ') : '';
      return '<button class="hist" data-i="' + S.games.indexOf(h) + '"><span class="h1"><span class="num">' + (h.paper ? 'ورقة ' + h.n : '#' + h.g) + '</span><span class="nm">' + esc(h.name || '') + '</span>' +
        (live ? '<span class="tag live">' + statusText(h.status) + '</span>' : h.paper ? '<span class="tag paper">على ورقة</span>' : h.kicked ? '<span class="tag half">طلعت منها</span>' : '') + '</span>' +
        '<span class="h2"><span class="avs">' + ps.slice(0, 5).map((p) => av(p.name, p.color || 0, 'sm')).join('') + '</span><span>' + fmtDate(h.created) + '</span>' +
        (win ? '<span class="win">' + IC.crown + esc(win) + '</span>' : '') + '</span></button>';
    }).join('');
    $$('.hist').forEach((b) => (b.onclick = () => openHist(S.games[+b.dataset.i])));
  }
  async function openHist(h) {
    if (!h) return;
    const ps = (h.players || []).slice().sort((a, b) => b.score - a.score);
    let rank = 0, prev = null; const rows = ps.map((p, i) => { if (p.score !== prev) { rank = i + 1; prev = p.score; } return Object.assign({ rank }, p); });
    const head = '<div class="ab-hero"><h2>' + esc(h.name || '') + '</h2><div class="v">' + (h.paper ? 'ورقة ' + h.n : '#' + h.g) + ' · ' + fmtDate(h.created) + ' ' + fmtTime(h.created) + '</div></div>';
    const live = !h.paper && h.status !== 'done' && !h.kicked;
    sheet(head + (rows.length ? podiumHTML(rows) : '') + '<div id="hDet"></div>' +
      (live ? '<button class="link-btn primary" id="hGo">ارجع للعبة</button>' : '') +
      (rows.length ? '<button class="link-btn" id="hShare">' + IC.share + 'شارك النتيجة</button>' : '') +
      (!h.paper && h.host ? '<button class="link-btn" id="hRen">غيّر الاسم</button>' : '') +
      (!live ? '<button class="link-btn" id="hAgain">العب مرة ثانية بنفس الإعدادات</button>' : '') +
      '<button class="link-btn danger" id="hDel">احذفها من سجلّي</button>', async () => {
      if ($('#hGo')) $('#hGo').onclick = () => { closeSheet(); enterGame(h.g, h.t, h.me, null, true); };
      if ($('#hShare')) $('#hShare').onclick = () => shareResult(h.paper ? 0 : h.g, h.name, rows, h.paper ? (h.letters || '').split('').map((l) => ({ letter: l })) : h.rounds_d);
      if ($('#hRen')) $('#hRen').onclick = () => sheet('<h2>اسم اللعبة</h2><input class="tin" id="rnName" maxlength="40" value="' + esc(h.name) + '"><button class="link-btn primary" id="rnGo">حفظ</button>', () => {
        $('#rnGo').onclick = async () => { const n = $('#rnName').value.trim(); if (!n) return; const r = await api('/act', { g: h.g, t: h.t, a: 'rename', name: n }); if (r.error) { toast(errText(r.error)); return; } h.name = n; save(); closeSheet(); renderHistory(); };
      });
      if ($('#hAgain')) $('#hAgain').onclick = () => { closeSheet(); if (h.paper) openPaperSetup(h); else openCreate(h.settings || S.last); };
      $('#hDel').onclick = () => confirmSheet('تحذفها من سجلّك؟', 'تنحذف من جهازك بس.', 'احذف', () => { S.games.splice(S.games.indexOf(h), 1); save(); renderHistory(); }, true);
      if (h.paper) { $('#hDet').innerHTML = h.letters ? '<p style="text-align:center;margin-top:12px">الحروف: <b class="fd">' + h.letters.split('').map(showL).join(' ') + '</b></p>' : ''; return; }
      $('#hDet').innerHTML = '<p class="wait dots">نجيب التفاصيل</p>';
      const d = await api('/game?g=' + h.g + '&t=' + encodeURIComponent(h.t));
      const box = $('#hDet'); if (!box) return;
      if (d.error) { box.innerHTML = '<p class="wait">' + (d.error === 'net' ? 'التفاصيل تحتاج إنترنت' : 'ما قدرنا نجيب التفاصيل') + '</p>'; return; }
      h.settings = d.game.settings; h.rounds_d = d.rounds; save();
      const pl = d.players.filter((p) => p.gone !== 2);
      const byRound = {};
      (d.answers || []).forEach((a) => { (byRound[a.round] = byRound[a.round] || []).push(a); });
      box.innerHTML = roundsGrid(d.rounds, pl.slice().sort((a, b) => b.score - a.score)) +
        (d.rounds || []).map((r) => '<details class="gl" style="margin-top:10px;padding:10px 14px"><summary style="font-weight:700;cursor:pointer">الجولة ' + r.round + ' · حرف <span class="fd" style="color:var(--accent)">' + showL(r.letter) + '</span></summary>' +
          d.game.settings.cats.map((c, ci) => '<div style="margin-top:8px"><div style="font-size:13px;color:var(--dim);font-weight:600">' + esc(c) + '</div>' +
            (byRound[r.round] || []).map((a) => { const p = pl.find((x) => x.id === a.player) || { name: '؟' }; const t = a.txt[ci] || ''; const rs = a.res ? a.res[ci] : null; return t ? '<div style="display:flex;justify-content:space-between;gap:8px;padding:3px 0"><span>' + esc(p.name) + ': <b>' + esc(t) + '</b></span><span class="st ' + (rs ? rs[0] : 'empty') + '" style="padding:2px 8px;font-size:12px">' + (rs ? '+' + rs[1] : '') + '</span></div>' : ''; }).join('') + '</div>').join('') + '</details>').join('');
    });
  }

  /* ================= اللعب على ورقة ================= */
  let P = null, paperT = 0;
  function openPaperSetup(prev) {
    const names = (prev && prev.players ? prev.players.map((p) => p.name) : [S.name || '']).filter(Boolean);
    const st = Object.assign({}, DEF, (prev && prev.settings) || S.last || {});
    sheet('<h2>العب على ورقة</h2><p>كل واحد يكتب في ورقة، والتطبيق يطلع الحرف ويشغّل الوقت ويجمع النقاط.</p>' +
      '<label class="flabel" for="ppName">اسم اللعبة</label><input class="tin" id="ppName" maxlength="40" placeholder="مثلاً: كشتة البر">' +
      '<div class="flabel">اللاعبين</div><div class="chips" id="ppPl"></div>' +
      '<div style="display:flex;gap:8px;margin-top:8px"><input class="tin" id="ppAdd" maxlength="20" placeholder="اسم لاعب" enterkeyhint="done"><button class="link-btn" id="ppAddB" style="margin:0;width:auto;padding:0 18px">إضافة</button></div>' +
      '<div class="flabel">عدد الجولات</div><div class="seg wide" id="cgRounds">' + ROUNDS.map((n) => '<button type="button" data-v="' + n + '" class="' + (n === st.rounds ? 'on' : '') + '">' + n + '</button>').join('') + '</div>' +
      '<div class="flabel">وقت الجولة (ثانية)</div><div class="seg wide" id="cgTime">' + TIMES.map((n) => '<button type="button" data-v="' + n + '" class="' + (n === st.time ? 'on' : '') + '">' + n + '</button>').join('') + '</div>' +
      '<div class="set" style="margin-top:12px"><div><span class="lbl">الحروف الصعبة<small>ث ذ ض ظ غ</small></span><button type="button" class="switch" role="switch" id="cgHard" aria-checked="' + !!st.hard + '" aria-label="الحروف الصعبة"></button></div></div>' +
      '<div class="err" id="ppErr"></div><button class="link-btn primary" id="ppGo">ابدأ</button>', (root) => {
      const list = names.slice();
      const draw = () => { $('#ppPl').innerHTML = list.map((n, i) => '<button class="chip" data-i="' + i + '">' + esc(n) + ' ✕</button>').join('') || '<span class="sub" style="font-size:13px;color:var(--dim)">أضف اللاعبين</span>'; $$('#ppPl button').forEach((b) => (b.onclick = () => { list.splice(+b.dataset.i, 1); draw(); })); };
      const add = () => { const v = $('#ppAdd').value.trim().slice(0, 20); if (!v) return; if (list.length >= 12) { toast('أكثر شي ١٢ لاعب'); return; } list.push(v); $('#ppAdd').value = ''; draw(); $('#ppAdd').focus(); };
      draw();
      $('#ppAddB').onclick = add;
      $('#ppAdd').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
      ['cgRounds', 'cgTime'].forEach((id) => $$('#' + id + ' button', root).forEach((b) => (b.onclick = () => $$('#' + id + ' button', root).forEach((x) => x.classList.toggle('on', x === b)))));
      $('#cgHard').onclick = (e) => { const b = e.currentTarget; b.setAttribute('aria-checked', b.getAttribute('aria-checked') !== 'true'); };
      $('#ppGo').onclick = () => {
        if ($('#ppAdd').value.trim()) add();
        if (!list.length) { $('#ppErr').textContent = 'أضف لاعب واحد على الأقل'; return; }
        S.paperN = (S.paperN || 0) + 1; save();
        P = { n: S.paperN, name: $('#ppName').value.trim() || 'ورقة ' + S.paperN, created: Date.now(), players: list.map((n, i) => ({ name: n, color: i % COLORS.length, score: 0 })),
          settings: { rounds: +$('#cgRounds .on').dataset.v, time: +$('#cgTime .on').dataset.v, hard: $('#cgHard').getAttribute('aria-checked') === 'true', cats: st.cats },
          round: 0, used: '', letter: '', phase: 'spin', ends: 0, pts: [] };
        closeSheet(); show('paper'); paperNext();
      };
    });
  }
  function pTop(extra) { return '<header class="gtop"><div class="gr"><button class="icb" id="ppBack" aria-label="رجوع">' + IC.back + '</button><div class="gname"><b>' + esc(P.name) + '</b><small>على ورقة</small></div><span class="rchip">' + (P.phase === 'done' ? 'انتهت' : 'الجولة ' + P.round + ' من ' + P.settings.rounds) + '</span></div>' + (extra ? '<div class="gx">' + extra + '</div>' : '') + '</header>'; }
  function pBind() { $('#ppBack').onclick = () => { if (P.phase === 'done') { P = null; show('home'); return; } confirmSheet('تطلع من اللعبة؟', 'النقاط اللي سجلتها تنحفظ في السجل.', 'اطلع', () => { paperSave(); P = null; clearInterval(paperT); show('home'); }); }; }
  function paperNext() {
    if (P.round >= P.settings.rounds) return paperDone();
    const pool = (EASY + (P.settings.hard ? HARD : '')).split('').filter((c) => !P.used.includes(c));
    if (!pool.length) return paperDone();
    P.round++; P.letter = pool[Math.floor(Math.random() * pool.length)]; P.used += P.letter; P.phase = 'spin';
    const t0 = Date.now();
    $('#v-paper').innerHTML = pTop() + '<div class="spin"><div class="lbl">الجولة ' + P.round + ' من ' + P.settings.rounds + '</div><div class="wheel"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1"/></svg><div class="bigtile" id="bt">؟</div></div><div class="lname" id="ln">&nbsp;</div><div class="cd" id="cd"></div></div>';
    pBind();
    clearInterval(paperT);
    let shown = false, cdl = -1;
    paperT = setInterval(() => {
      const el = Date.now() - t0, bt = $('#bt'); if (!bt) { clearInterval(paperT); return; }
      if (el < 3200) { bt.textContent = showL(pool[Math.floor(Math.random() * pool.length)]); SND.spin(); return; }
      if (!shown) { shown = true; bt.textContent = showL(P.letter); bt.classList.add('pop'); $('#ln').textContent = 'حرف ' + LNAME[P.letter]; SND.ding(); vib(60); }
      const n = Math.ceil((6500 - el) / 1000);
      if (n !== cdl && n >= 1 && n <= 3) { cdl = n; $('#cd').textContent = n; SND.tick(); }
      if (el >= 6500) { clearInterval(paperT); SND.go(); paperWrite(); }
    }, 90);
  }
  function paperWrite() {
    P.phase = 'write'; P.ends = Date.now() + P.settings.time * 1000;
    $('#v-paper').innerHTML = pTop() + '<div class="gl phead"><span class="ptile">' + showL(P.letter) + '</span><span class="pm"><b>حرف ' + LNAME[P.letter] + '</b><small>' + esc(P.settings.cats.join(' · ')) + '</small></span></div>' +
      '<div class="bigtimer"><svg viewBox="0 0 100 100"><circle class="tb" cx="50" cy="50" r="44"/><circle class="tf" id="ptf" cx="50" cy="50" r="44" stroke-dasharray="276.5" stroke-dashoffset="0"/></svg><b id="ptn"></b></div>' +
      '<button class="link-btn primary" id="ppStop">ستوب!</button>';
    pBind();
    const stop = () => { clearInterval(paperT); SND.stop(); vib(120); paperScore(); };
    $('#ppStop').onclick = stop;
    let last = -1;
    clearInterval(paperT);
    paperT = setInterval(() => {
      const left = P.ends - Date.now(), f = $('#ptf'); if (!f) { clearInterval(paperT); return; }
      f.style.strokeDashoffset = (276.5 * (1 - Math.max(0, left) / (P.settings.time * 1000))).toFixed(1);
      const s = Math.max(0, Math.ceil(left / 1000)); $('#ptn').textContent = s;
      if (s !== last) { last = s; if (s <= 5 && s >= 1) SND.tick(); }
      if (left <= 0) stop();
    }, 250);
  }
  function paperScore() {
    P.phase = 'score';
    const max = P.settings.cats.length * 10, cur = P.players.map(() => 0);
    $('#v-paper').innerHTML = pTop() + '<div class="gl phead"><span class="ptile sm">' + showL(P.letter) + '</span><span class="pm"><b>نقاط الجولة</b><small>فريدة ١٠ · مكررة ٥ · غلط أو فاضية صفر</small></span></div>' +
      '<div class="pls">' + P.players.map((p, i) => '<div class="pl">' + av(p.name, p.color) + '<span class="pn"><b>' + esc(p.name) + '</b><small>المجموع ' + p.score + '</small></span><span class="step"><button data-i="' + i + '" data-d="-5" aria-label="ناقص ٥">−</button><output id="po' + i + '">0</output><button data-i="' + i + '" data-d="5" aria-label="زائد ٥">+</button></span></div>').join('') + '</div>' +
      '<div class="stickb"><button class="link-btn primary" id="ppNext">' + (P.round >= P.settings.rounds ? 'النتيجة النهائية' : 'الجولة الجاية') + '</button></div>' + (P.round < P.settings.rounds ? '<button class="txt-btn" id="ppEnd" style="display:block;margin:6px auto 0">إنهاء اللعبة هنا</button>' : '');
    pBind();
    $$('.step button').forEach((b) => (b.onclick = () => { const i = +b.dataset.i; cur[i] = Math.max(0, Math.min(max, cur[i] + +b.dataset.d)); $('#po' + i).textContent = cur[i]; SND.pop(); }));
    const commit = () => { P.players.forEach((p, i) => { p.score += cur[i]; }); P.pts.push({ letter: P.letter, pts: cur.slice() }); paperSave(); };
    $('#ppNext').onclick = () => { commit(); paperNext(); };
    if ($('#ppEnd')) $('#ppEnd').onclick = () => { commit(); paperDone(); };
  }
  function paperSave() {
    let h = S.games.find((x) => x.paper && x.n === P.n);
    if (!h) { h = { paper: true, n: P.n, created: P.created }; S.games.unshift(h); }
    const ps = P.players.slice().sort((a, b) => b.score - a.score), top = ps[0] ? ps[0].score : 0;
    Object.assign(h, { name: P.name, status: 'done', players: P.players.map((p) => ({ name: p.name, color: p.color, score: p.score })), letters: P.pts.map((x) => x.letter).join(''), rounds: P.pts.length, settings: P.settings, winners: top ? ps.filter((p) => p.score === top).map((p) => p.name) : [], finished: Date.now() });
    save();
  }
  function paperDone() {
    clearInterval(paperT); P.phase = 'done'; paperSave();
    const ps = P.players.slice().sort((a, b) => b.score - a.score);
    let rank = 0, prev = null; const rows = ps.map((p, i) => { if (p.score !== prev) { rank = i + 1; prev = p.score; } return Object.assign({ rank }, p); });
    const win = rows.filter((r) => r.rank === 1 && r.score > 0);
    $('#v-paper').innerHTML = pTop('<div class="win-t">انتهت اللعبة</div><div class="win-n">' + (win.length ? 'الفايز: ' + esc(win.map((w) => w.name).join(' و ')) : 'نعيدها؟') + '</div>') +
      podiumHTML(rows) + '<div class="gl tbl">' + rows.map((p) => '<div class="tr"><span class="rk">' + p.rank + '</span><span class="who">' + av(p.name, p.color, 'sm') + '<b>' + esc(p.name) + '</b></span><span></span><span class="tot">' + p.score + '</span></div>').join('') + '</div>' +
      '<p class="wait">انحفظت في السجل: ورقة ' + P.n + ' · ' + esc(P.name) + '</p><button class="link-btn primary" id="ppShare">' + IC.share + 'شارك النتيجة</button><button class="link-btn" id="ppHome">الرئيسية</button>';
    pBind(); SND.win(); confetti();
    const n = P.name, letters = P.pts.map((x) => ({ letter: x.letter }));
    $('#ppShare').onclick = () => shareResult(0, n, rows, letters);
    $('#ppHome').onclick = () => { P = null; show('home'); };
  }

  /* ================= الإعدادات ================= */
  function renderSettings() {
    $('#setName').value = S.name || '';
    $('#setColor').innerHTML = COLORS.map((c, i) => '<button type="button" data-c="' + i + '" style="background:' + c + '" class="' + (i === S.color ? 'on' : '') + '" aria-label="لون ' + (i + 1) + '"></button>').join('');
    $$('#setColor button').forEach((b) => (b.onclick = () => { S.color = +b.dataset.c; save(); renderSettings(); }));
    $('#setSound').setAttribute('aria-checked', !!S.sound);
    $('#setVib').setAttribute('aria-checked', !!S.vib);
    $$('#setTheme button').forEach((b) => b.classList.toggle('on', b.dataset.v === (S.theme || 'auto')));
    $('#verVal').textContent = 'v' + VERSION;
    $('#aboutVer').textContent = 'حَرف · الإصدار ' + VERSION;
  }
  $('#setName').addEventListener('input', (e) => { S.name = e.target.value.trim().slice(0, 20); save(); });
  $('#setSound').onclick = () => { S.sound = !S.sound; save(); renderSettings(); if (S.sound) SND.pop(); };
  $('#setVib').onclick = () => { S.vib = !S.vib; save(); renderSettings(); vib(30); };
  $$('#setTheme button').forEach((b) => (b.onclick = () => { S.theme = b.dataset.v; save(); applyTheme(); renderSettings(); }));
  const lightMQ = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', S.theme || 'auto');
    const dark = S.theme === 'dark' || (S.theme !== 'light' && lightMQ && lightMQ.matches);
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#04211F' : '#0A5953';
  }
  if (lightMQ && lightMQ.addEventListener) lightMQ.addEventListener('change', applyTheme);

  const appName = 'حرف | Harf';
  const ABOUT_F = [
    ['👨‍👩‍👧‍👦', 'كل واحد من جهازه', 'أي أحد ينشئ لعبة، والباقين يدخلون بكود سري من ٦ أرقام أو بالباركود.'],
    ['🎡', 'عجلة الحروف', 'حرف جديد كل جولة وما يتكرر في نفس اللعبة، والحروف الصعبة اختيارية.'],
    ['✋', 'ستوب!', 'أول واحد يكمّل كل الخانات يوقف الجولة، والباقين لهم ٥ ثواني.'],
    ['✅', 'تصحيح بالتصويت', 'فريدة ١٠ ومكررة ٥، والإجابة المختلف عليها تتصوّت والمضيف يحسم.'],
    ['🧒', 'للصغار', 'وقت إضافي لأي لاعب، ويقدرون يكتبون بصوتهم.'],
    ['🏆', 'السجل', 'كل لعبة تنحفظ برقمها واسمها ونتيجة كل جولة.'],
    ['📝', 'على ورقة', 'بدون نت: يطلع الحرف ويشغّل الوقت ويجمع النقاط.']
  ];
  $('#setAbout').onclick = () => {
    const logo = $('.about .wamd').outerHTML;
    sheet('<div class="ab-hero"><img src="icons/icon-192.png" alt=""><h2>' + appName + '</h2><div class="v">v' + VERSION + '</div><div class="ab-tag">العبوا مع بعض، كل واحد من جهازه</div></div>' +
      '<div class="ab-text"><p>لعبة «إنسان حيوان نبات جماد بلاد» اللي نعرفها كلنا، بس على الجوال: العجلة تختار الحرف، والوقت يمشي، والتطبيق يصحح ويحسب النقاط.</p><p>يناسب العائلة والأصحاب، والكبير والصغير.</p></div>' +
      '<ul class="ab-list">' + ABOUT_F.map(([e, t, d]) => '<li><b>' + e + '</b><span><b>' + t + '</b><i>' + d + '</i></span></li>').join('') + '</ul>' +
      '<p class="ab-by">من تطوير</p>' + logo + '<button class="link-btn primary" id="abShare">مشاركة التطبيق</button><button class="link-btn" id="abClose">إغلاق</button>', () => {
      $('#abShare').onclick = shareApp; $('#abClose').onclick = closeSheet;
    });
  };
  async function shareApp() {
    const text = 'حَرف — إنسان حيوان نبات جماد بلاد، العبوها مع العائلة كل واحد من جواله 🔤\n' + SITE;
    if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(text); toast('تم نسخ الرابط'); } catch (e) { toast(SITE); }
  }
  $('#setShare').onclick = shareApp;
  $('#setContact').onclick = () => { location.href = 'mailto:' + MAIL + '?subject=' + encodeURIComponent('حَرف — تواصل v' + VERSION); };
  $('#setPrivacy').onclick = async () => {
    let body = '';
    try {
      const html = await (await fetch('privacy.html')).text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const main = doc.getElementById('ar');
      if (main) { main.querySelectorAll('script,style').forEach((x) => x.remove()); body = main.innerHTML; }
    } catch (e) {}
    if (!body) { toast('تعذّر الفتح، حاول مرة ثانية'); return; }
    sheet('<div class="ab-hero"><img src="icons/icon-192.png" alt=""><h2>سياسة الخصوصية</h2><div class="v">' + appName + '</div></div><div class="pv">' + body + '</div><button class="link-btn primary" id="pvClose">تم</button>', () => {
      $$('.pv a[href^="http"]').forEach((x) => { x.target = '_blank'; x.rel = 'noopener'; });
      $('#pvClose').onclick = closeSheet;
    });
  };
  $('#setUpdate').onclick = () => {
    if (!('serviceWorker' in navigator)) { toast('أنت على آخر إصدار'); return; }
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) { toast('أنت على آخر إصدار'); return; }
      reg.update().then(() => { if (reg.installing || reg.waiting) toast('يُحمَّل الإصدار الجديد…'); else toast('أنت على آخر إصدار ' + VERSION); }).catch(() => toast('لا يوجد اتصال للتحقق من التحديث'));
    });
  };

  /* ================= الإضافة للشاشة الرئيسية (نفس فلق) ================= */
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; setTimeout(renderGate, 0); });
  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const ua = navigator.userAgent;
  const isIOS = () => /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMobile = () => isIOS() || /android|mobi/i.test(ua);
  const inAppBrowser = () => /Instagram|FBAN|FBAV|FB_IAB|Snapchat|TikTok|musical_ly|Twitter|LinkedInApp|Line\//i.test(ua);
  const iosChrome = () => /CriOS|FxiOS|EdgiOS/i.test(ua);
  const deskChromium = () => !isMobile() && /Chrome|Chromium|Edg\//.test(ua) && !/OPR\/|Firefox/.test(ua);
  const deskSafari = () => !isMobile() && /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg\/|Firefox/.test(ua);
  const gateSupported = () => isMobile() || deskChromium() || deskSafari();
  const SH = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5A9BD8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
  const ADD = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5A9BD8" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
  const DOTS = '<svg width="22" height="22" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5" fill="none" stroke="#5A9BD8" stroke-width="1.6"/><circle cx="7.5" cy="12" r="1.5" fill="#5A9BD8"/><circle cx="12" cy="12" r="1.5" fill="#5A9BD8"/><circle cx="16.5" cy="12" r="1.5" fill="#5A9BD8"/></svg>';
  const INST = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5A9BD8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 7.5v6M9.5 11l2.5 2.5 2.5-2.5"/></svg>';
  function renderGate() {
    const g = $('#gate'); if (!g || g.hidden) return;
    const ol = (arr) => '<ol class="steps">' + arr.map((x) => '<li><span>' + x + '</span></li>').join('') + '</ol>';
    let steps = '', arrow = '';
    $('#gateInstall').hidden = true; $('#gateCopy').hidden = true;
    if (inAppBrowser()) { steps = ol(['هذا المتصفح داخل تطبيق آخر ولا يسمح بالإضافة', 'اضغط ⋯ أعلى الشاشة واختر «فتح في Safari» أو «فتح في المتصفح»', 'أو انسخ الرابط والصقه في Safari']); $('#gateCopy').hidden = false; arrow = 'top'; }
    else if (isIOS() && iosChrome()) { steps = ol(['اضغط زر المشاركة ' + SH + ' أعلى الشاشة بجانب العنوان', 'اختر «إضافة إلى الشاشة الرئيسية» ' + ADD, 'اضغط «إضافة»، ثم افتح حَرف من أيقونته']); arrow = 'top'; }
    else if (isIOS()) { steps = ol(['اضغط ' + DOTS + ' أسفل Safari، أو زر المشاركة ' + SH + ' إن ظهر لك مباشرة', 'اختر «مشاركة» ثم «إضافة إلى الشاشة الرئيسية» ' + ADD, 'اضغط «إضافة»، ثم افتح حَرف من أيقونته']); arrow = 'bottom'; }
    else if (deskChromium()) { if (deferredPrompt) $('#gateInstall').hidden = false; steps = ol(['اضغط أيقونة التثبيت ' + INST + ' في يمين شريط العنوان', 'أو من قائمة المتصفح ⋮ اختر «حفظ ومشاركة» ثم «تثبيت الصفحة كتطبيق»', 'اضغط «تثبيت»، ويفتح حَرف في نافذة خاصة كأي برنامج']); arrow = 'top'; }
    else if (deskSafari()) steps = ol(['من شريط القوائم أعلى الشاشة اختر «ملف»', 'اختر «إضافة إلى Dock» ثم «إضافة»', 'افتح حَرف من Dock كأي برنامج']);
    else if (deferredPrompt) $('#gateInstall').hidden = false;
    else { steps = ol(['اضغط ⋮ أعلى المتصفح', 'اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»']); arrow = 'top'; }
    $('#gateSteps').innerHTML = steps;
    $('#gateSub').textContent = isMobile() ? 'أضفه إلى شاشتك الرئيسية ليعمل كتطبيق كامل.' : 'ثبّته على جهازك ليعمل كبرنامج مستقل.';
    const a = $('#gateArrow'); a.className = 'gate-arrow ' + arrow; a.hidden = !arrow;
  }
  function openGate() {
    if (isStandalone()) { sheet('<h2>أضف حَرف إلى شاشتك</h2><p>حَرف مضاف إلى شاشتك الرئيسية ويعمل الآن كتطبيق.</p><button class="link-btn" id="instLater">إغلاق</button>', () => { $('#instLater').onclick = closeSheet; }); return; }
    closeSheet(); $('#gate').hidden = false; document.body.classList.add('gated'); renderGate();
  }
  function closeGate() { $('#gate').hidden = true; document.body.classList.remove('gated'); try { sessionStorage.setItem('harf-browse', '1'); } catch (e) {} }
  window.addEventListener('appinstalled', () => { $('#gate').hidden = true; document.body.classList.remove('gated'); });
  $('#gateSkip').onclick = closeGate;
  $('#gateInstall').onclick = () => { if (!deferredPrompt) return; deferredPrompt.prompt(); deferredPrompt.userChoice.finally(() => { deferredPrompt = null; renderGate(); }); };
  $('#gateCopy').onclick = () => { const url = location.href.split('#')[0]; (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('نُسخ الرابط')).catch(() => toast(url)); };
  $('#setInstall').onclick = openGate;

  /* منع التكبير بالضغط المزدوج أو القرص */
  ['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault(), { passive: false }));
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

  /* ================= البداية ================= */
  applyTheme();
  renderHome();
  try { const prev = localStorage.getItem('harf-ver'); if (prev && prev !== VERSION) setTimeout(() => toast('تم تحديث حَرف إلى الإصدار ' + VERSION), 600); localStorage.setItem('harf-ver', VERSION); } catch (e) {}
  // الدخول من الباركود أو الرابط: harf.wamdarc.com/#j=123456
  const hm = /[#&]j=(\d{6})/.exec(location.hash);
  if (hm) { history.replaceState(null, '', location.pathname); openJoin(hm[1]); }
  else if (S.active) enterGame(S.active.g, S.active.t, S.active.me);
  let browsing = false; try { browsing = sessionStorage.getItem('harf-browse') === '1'; } catch (e) {}
  if (!hm && !S.active && !isStandalone() && gateSupported() && !browsing) openGate();

  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    // التحديث التلقائي: يتحقق عند الفتح وكل ١٥ دقيقة، وبدون إنترنت يكمل على النسخة المحفوظة
    navigator.serviceWorker.register('sw.js').then((reg) => {
      const check = () => { if (navigator.onLine !== false) reg.update().catch(() => {}); };
      setInterval(check, 15 * 6e4);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
      window.addEventListener('online', check);
    }).catch(() => {});
    let reloaded = false;
    // لا نعيد التحميل وسط جولة: التحديث ينتظر لين ما يكون فيه كتابة
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      const busy = () => current === 'paper' || (current === 'game' && G.s && G.s.game.status === 'play');
      const go = () => { if (busy()) { setTimeout(go, 5000); return; } reloaded = true; location.reload(); };
      go();
    });
  }
})();
