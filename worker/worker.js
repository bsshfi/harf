/* حَرف | HARF — السيرفر (Cloudflare Worker + D1 باسم harf)
   لعبة «إنسان حيوان نبات جماد بلاد» جماعية:
   - أي أحد ينشئ لعبة، فتاخذ رقم (#) واسم وكود سري من ٦ أرقام، والباقين يدخلون بالكود.
   - كل جهاز له مفتاح خاص (token) ما يطلع لغيره، وما أحد يشوف إجابات غيره وقت الكتابة.
   - اللعبة تنحفظ برقمها واسمها وجولاتها ونتائجها وتبقى في السجل.
   - التحديث بالسحب: الجهاز يسأل كل ثانية تقريباً، والسيرفر يرد {same:1} إذا ما تغيّر شي (قراءة صف واحد).
   - «ملفي»: كل جهاز له ملف (رمز ٨ أرقام للاسترجاع) تنربط فيه ألعابه، و«قروب اللعب» يجمع العائلة: سجل مشترك وألعاب تطلع لهم بدون كود.
   - /stats للوحة الإدارة admin.wamdarc.com (بنفس مفتاح الإدارة، يتحقق منه عن طريق siraj-api أو ADMIN_KEY).
   الربط المطلوب: قاعدة D1 باسم DB، وربط SIRAJ بخادم سِراج (wrangler.toml). الجداول تنشأ لحالها أول مرة. */

const ORIGINS = ['https://harf.wamdarc.com', 'https://bsshfi.github.io'];
const MAX_PLAYERS = 10;
const EASY = 'ابتجحخدرزسشصطعفقكلمنهوي';   // ٢٣ حرف
const HARD = 'ثذضظغ';                      // الحروف الصعبة (اختيارية)
const ROUNDS = [3, 5, 7, 10];
const TIMES = [45, 60, 90, 120, 180];
const EXTRAS = [0, 15, 30, 45, 60];
const SPIN_MS = 7000;         // العجلة + العد التنازلي قبل الكتابة
const STOP_MS = 5000;         // بعد «ستوب!» الباقين لهم ٥ ثواني
const GRACE_MS = 2500;        // سماح لوصول آخر حفظ
const HOST_IDLE = 60e3;       // المضيف غايب أكثر من دقيقة ← الإدارة تنتقل لغيره
const ONLINE_MS = 12e3;
const SEEN_EVERY = 10e3;
const IDLE_GAME = 12 * 3600e3; // الكود ينتهي بعد ١٢ ساعة بدون نشاط
const LIVE_MS = 3 * 3600e3;    // لعبة القروب تطلع «شغالة» للأفراد إذا تحركت آخر ٣ ساعات

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    // DEV_ORIGIN للتجربة المحلية فقط (wrangler dev --var) — غير موجود في السيرفر الحقيقي
    const allow = ORIGINS.includes(origin) || /^https:\/\/([a-z0-9-]+\.)?wamdarc\.com$/.test(origin) || (env.DEV_ORIGIN && origin === env.DEV_ORIGIN) ? origin : ORIGINS[0];
    const cors = {
      'Access-Control-Allow-Origin': allow,
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Admin-Key',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

    try {
      await ensureSchema(env);
      const url = new URL(req.url);
      const p = url.pathname.replace(/\/+$/, '');
      const q = url.searchParams;
      const now = Date.now();
      const ip = req.headers.get('CF-Connecting-IP') || 'local';

      if (p === '' || p === '/health') return json({ ok: true, app: 'harf', service: 'harf-api', now });

      /* لوحة الإدارة */
      if (p === '/stats' && req.method === 'GET') {
        const gate = await adminGate(req, env.DB, () => isAdmin(req, env));
        if (gate !== 'ok') return json({ error: gate === 'locked' ? 'locked' : 'unauthorized' }, gate === 'locked' ? 429 : 401);
        return json(await stats(env, now));
      }

      /* إنشاء لعبة */
      if (p === '/create' && req.method === 'POST') {
        const b = await body(req);
        if (!(await bump(env, 'c:' + ip, 40, 3600e3, now))) return json({ error: 'wait' }, 429);
        const me = cleanPlayer(b.player);
        if (!me.name) return json({ error: 'name' }, 400);
        const st = cleanSettings(b.settings);
        let code = null;
        for (let i = 0; i < 10 && !code; i++) {
          const c = code6();
          const x = await env.DB.prepare("SELECT id FROM games WHERE code = ? AND status <> 'done' AND updated > ?").bind(c, now - IDLE_GAME).first();
          if (!x) code = c;
        }
        if (!code) return json({ error: 'busy' }, 503);
        const pid = rnd(10), tok = rnd(24);
        const name = clip(b.name, 40);
        const prof = await profByTok(env, b.ptok);
        const grp = prof && prof.grp && b.group ? prof.grp : null;
        const ins = await env.DB.prepare("INSERT INTO games (code, name, host, status, settings, created, updated, grp) VALUES (?, ?, ?, 'lobby', ?, ?, ?, ?)")
          .bind(code, name || 'لعبة', pid, JSON.stringify(st), now, now, grp).run();
        const gid = ins.meta.last_row_id;
        const w = [env.DB.prepare('INSERT INTO players (id, game, token, name, color, joined, seen, ord, prof) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)').bind(pid, gid, tok, me.name, me.color, now, now, prof ? prof.id : null)];
        if (prof) w.push(env.DB.prepare('INSERT OR IGNORE INTO pgames (prof, game, player, token) VALUES (?, ?, ?, ?)').bind(prof.id, gid, pid, tok));
        if (!name) w.push(env.DB.prepare('UPDATE games SET name = ? WHERE id = ?').bind('لعبة ' + gid, gid));
        await env.DB.batch(w);
        await daily(env, now, 'games');
        const g = await auth(env, gid, tok);
        return json({ ok: 1, g: gid, t: tok, me: pid, state: await fullState(env, g, now) });
      }

      /* الدخول بالكود */
      if (p === '/join' && req.method === 'POST') {
        const b = await body(req);
        if (await blocked(env, 'j:' + ip, 12, now)) return json({ error: 'wait' }, 429);
        const code = String(b.code || '').replace(/[^0-9٠-٩]/g, '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
        const g0 = code.length === 6 ? await env.DB.prepare("SELECT * FROM games WHERE code = ? AND status <> 'done' AND updated > ? ORDER BY id DESC LIMIT 1").bind(code, now - IDLE_GAME).first() : null;
        if (!g0) { await bump(env, 'j:' + ip, 12, 600e3, now); return json({ error: 'notfound' }, 404); }
        if (b.check) return json({ ok: 1, g: g0.id, name: g0.name, status: g0.status, locked: !!g0.locked });
        if (g0.locked) return json({ error: 'locked' }, 403);
        const me = cleanPlayer(b.player);
        if (!me.name) return json({ error: 'name' }, 400);
        const cnt = await env.DB.prepare('SELECT COUNT(*) n, COALESCE(MAX(ord), 0) o FROM players WHERE game = ? AND gone = 0').bind(g0.id).first();
        if (cnt.n >= MAX_PLAYERS) return json({ error: 'full' }, 403);
        const pid = rnd(10), tok = rnd(24);
        const prof = await profByTok(env, b.ptok);
        const w = [
          env.DB.prepare('INSERT INTO players (id, game, token, name, color, joined, seen, ord, prof) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(pid, g0.id, tok, me.name, me.color, now, now, cnt.o + 1, prof ? prof.id : null),
          env.DB.prepare('UPDATE games SET rev = rev + 1, updated = ? WHERE id = ?').bind(now, g0.id)
        ];
        if (prof) w.push(env.DB.prepare('INSERT OR IGNORE INTO pgames (prof, game, player, token) VALUES (?, ?, ?, ?)').bind(prof.id, g0.id, pid, tok));
        await env.DB.batch(w);
        const g = await auth(env, g0.id, tok);
        return json({ ok: 1, g: g0.id, t: tok, me: pid, state: await fullState(env, g, now) });
      }

      /* حالة اللعبة (يسأل عنها الجهاز كل ثانية تقريباً) */
      if (p === '/state' && req.method === 'GET') {
        const gid = +q.get('g') || 0, tok = q.get('t') || '', rev = +q.get('rev') || 0;
        let g = await auth(env, gid, tok);
        if (!g) return json({ error: 'auth' }, 401);
        if (g.pgone === 2) return json({ kicked: 1, now });
        let changed = false;
        const w = [];
        if (now - (g.pseen || 0) > SEEN_EVERY) w.push(env.DB.prepare('UPDATE players SET seen = ? WHERE id = ?').bind(now, g.pid));
        // المضيف طلع أو غاب: الإدارة تنتقل للي يسأل الحين (موجود أكيد)
        if (g.status !== 'done' && !g.pgone && g.host !== g.pid && (g.hgone || now - (g.hseen || 0) > HOST_IDLE)) {
          w.push(env.DB.prepare('UPDATE games SET host = ?, rev = rev + 1, updated = ? WHERE id = ? AND host = ?').bind(g.pid, now, g.id, g.host));
          changed = true;
        }
        if (w.length) await env.DB.batch(w);
        if (g.status === 'play' && await maybeClose(env, g, now)) changed = true;
        if (changed) g = await auth(env, gid, tok);
        if (rev && rev === g.rev) return json({ same: 1, now, rev: g.rev });
        return json(await fullState(env, g, now));
      }

      /* تفاصيل لعبة للسجل (كل الجولات والإجابات) */
      if (p === '/game' && req.method === 'GET') {
        const gid = +q.get('g') || 0;
        let g = q.get('t') ? await auth(env, gid, q.get('t')) : null;
        if (!g && q.get('ptok')) {
          const prof = await profByTok(env, q.get('ptok'));
          const row = prof && await env.DB.prepare('SELECT g.*, (SELECT player FROM pgames WHERE prof = ?1 AND game = g.id LIMIT 1) AS pid FROM games g WHERE g.id = ?2').bind(prof.id, gid).first();
          if (row && (row.pid || (row.grp && row.grp === prof.grp))) { g = row; g.pid = row.pid || ''; g.pgone = 0; }
        }
        if (!g) return json({ error: 'auth' }, 401);
        const st = await fullState(env, g, now);
        const rows = (await env.DB.prepare('SELECT round, player, txt, res FROM answers WHERE game = ? ORDER BY round').bind(g.id).all()).results || [];
        st.answers = rows.map((r) => ({ round: r.round, player: r.player, txt: parse(r.txt, []), res: parse(r.res, null) }));
        return json(st);
      }

      /* ===== ملفي ===== */
      if (p === '/me') {
        if (req.method === 'GET') {
          const prof = await profByTok(env, q.get('tok'));
          if (!prof) return json({ error: 'auth' }, 401);
          return json(await meData(env, prof, now));
        }
        const b = await body(req);
        if (b.a === 'new') {
          if (!(await bump(env, 'p:' + ip, 30, 3600e3, now))) return json({ error: 'wait' }, 429);
          const me = cleanPlayer({ name: b.name, color: b.color });
          const code = await newCode(env), tok = rnd(32);
          const ins = await env.DB.prepare('INSERT INTO profiles (code, tok, name, color, created, seen) VALUES (?, ?, ?, ?, ?, ?)').bind(code, tok, me.name, me.color, now, now).run();
          return json({ ok: 1, id: ins.meta.last_row_id, tok, code });
        }
        let prof = await profByTok(env, b.tok);
        if (!prof) return json({ error: 'auth' }, 401);
        if (b.a === 'me') {
          const me = cleanPlayer({ name: b.name, color: b.color });
          await env.DB.prepare('UPDATE profiles SET name = ?, color = ? WHERE id = ?').bind(me.name || prof.name, me.color, prof.id).run();
        }
        if (b.a === 'sync') await syncProfile(env, prof, b, now);
        if (b.a === 'paperdel') await env.DB.prepare('DELETE FROM ppaper WHERE prof = ? AND pid = ?').bind(prof.id, clip(b.pid, 40)).run();
        if (b.a === 'hide') await env.DB.prepare('DELETE FROM pgames WHERE prof = ? AND game = ?').bind(prof.id, +b.g || 0).run();
        prof = await profByTok(env, b.tok);
        return json(await meData(env, prof, now));
      }

      /* استرجاع الملف برمزه (ويندمج فيه ملف هالجهاز) */
      if (p === '/restore' && req.method === 'POST') {
        const b = await body(req);
        if (await blocked(env, 'r:' + ip, 12, now)) return json({ error: 'wait' }, 429);
        const code = digits(b.code);
        const target = code.length === 8 ? await env.DB.prepare('SELECT * FROM profiles WHERE code = ?').bind(code).first() : null;
        if (!target) {
          await bump(env, 'r:' + ip, 12, 600e3, now);
          const isGroup = code.length === 8 && await env.DB.prepare('SELECT id FROM pgroups WHERE code = ?').bind(code).first();
          return json({ error: isGroup ? 'isgroup' : 'nocode' }, 404);
        }
        const cur = await profByTok(env, b.tok);
        if (cur && cur.id !== target.id) await mergeProfiles(env, cur, target);
        const fresh = await env.DB.prepare('SELECT * FROM profiles WHERE id = ?').bind(target.id).first();
        await tagGroupGames(env, fresh.grp);
        return json(Object.assign({ ok: 1, tok: target.tok }, await meData(env, fresh, now)));
      }

      /* ===== قروب اللعب ===== */
      if (p === '/group' && req.method === 'POST') {
        const b = await body(req);
        let prof = await profByTok(env, b.tok);
        if (!prof) return json({ error: 'auth' }, 401);
        const DB = env.DB;
        if (b.a === 'create') {
          const name = clip(b.name, 30);
          if (!name) return json({ error: 'gname' }, 400);
          if (!(await bump(env, 'gc:' + ip, 10, 3600e3, now))) return json({ error: 'wait' }, 429);
          const code = await newCode(env);
          const ins = await DB.prepare('INSERT INTO pgroups (code, name, owner, created) VALUES (?, ?, ?, ?)').bind(code, name, prof.id, now).run();
          await DB.prepare('UPDATE profiles SET grp = ? WHERE id = ?').bind(ins.meta.last_row_id, prof.id).run();
        } else if (b.a === 'join') {
          if (await blocked(env, 'r:' + ip, 12, now)) return json({ error: 'wait' }, 429);
          const code = digits(b.code);
          const gr = code.length === 8 ? await DB.prepare('SELECT * FROM pgroups WHERE code = ?').bind(code).first() : null;
          if (!gr) {
            await bump(env, 'r:' + ip, 12, 600e3, now);
            const isProf = code.length === 8 && await DB.prepare('SELECT id FROM profiles WHERE code = ?').bind(code).first();
            return json({ error: isProf ? 'isprofile' : 'nogroup' }, 404);
          }
          if (b.check) return json({ ok: 1, name: gr.name, members: (await DB.prepare('SELECT COUNT(*) n FROM profiles WHERE grp = ?').bind(gr.id).first()).n });
          await DB.prepare('UPDATE profiles SET grp = ? WHERE id = ?').bind(gr.id, prof.id).run();
          await tagGroupGames(env, gr.id);
        } else if (b.a === 'leave') {
          const gid = prof.grp;
          await DB.prepare('UPDATE profiles SET grp = NULL WHERE id = ?').bind(prof.id).run();
          if (gid) {   // صاحب القروب طلع: تنتقل لأقدم واحد باقي
            const gr = await DB.prepare('SELECT owner FROM pgroups WHERE id = ?').bind(gid).first();
            if (gr && gr.owner === prof.id) {
              const nx = await DB.prepare('SELECT id FROM profiles WHERE grp = ? ORDER BY created LIMIT 1').bind(gid).first();
              await DB.prepare('UPDATE pgroups SET owner = ? WHERE id = ?').bind(nx ? nx.id : null, gid).run();
            }
          }
        } else if (b.a === 'kick' || b.a === 'rename' || b.a === 'newcode') {
          const gr = prof.grp && await DB.prepare('SELECT * FROM pgroups WHERE id = ?').bind(prof.grp).first();
          if (!gr || gr.owner !== prof.id) return json({ error: 'owner' }, 403);
          if (b.a === 'kick' && +b.prof !== prof.id) await DB.prepare('UPDATE profiles SET grp = NULL WHERE id = ? AND grp = ?').bind(+b.prof || 0, gr.id).run();
          if (b.a === 'rename') { const name = clip(b.name, 30); if (name) await DB.prepare('UPDATE pgroups SET name = ? WHERE id = ?').bind(name, gr.id).run(); }
          if (b.a === 'newcode') await DB.prepare('UPDATE pgroups SET code = ? WHERE id = ?').bind(await newCode(env), gr.id).run();
        } else return json({ error: 'action' }, 400);
        prof = await profByTok(env, b.tok);
        return json(await meData(env, prof, now));
      }

      /* ألعاب القروب الشغالة (الرئيسية تسأل عنها كل شوي) */
      if (p === '/live' && req.method === 'GET') {
        const prof = await profByTok(env, q.get('tok'));
        if (!prof) return json({ error: 'auth' }, 401);
        if (now - (prof.seen || 0) > 60e3) await env.DB.prepare('UPDATE profiles SET seen = ? WHERE id = ?').bind(now, prof.id).run();
        return json({ now, live: await liveGames(env, prof, now) });
      }

      /* الأفعال */
      if (p === '/act' && req.method === 'POST') {
        const b = await body(req);
        let g = await auth(env, +b.g || 0, String(b.t || ''));
        if (!g) return json({ error: 'auth' }, 401);
        if (g.pgone === 2) return json({ kicked: 1, now });
        const r = await act(env, g, b, now);
        if (r && r.error) return json(r, r.code || 400);
        g = await auth(env, g.id, String(b.t));
        return json(await fullState(env, g, now));
      }

      return json({ error: 'notfound' }, 404);
    } catch (e) {
      return json({ error: 'server', detail: String(e && e.message || e).slice(0, 200) }, 500);
    }
  }
};

/* ===================== الأفعال ===================== */
async function act(env, g, b, now) {
  const st = parse(g.settings, {});
  const isHost = g.host === g.pid;
  const DB = env.DB;
  const bumpRev = (extra = '', ...args) => DB.prepare('UPDATE games SET rev = rev + 1, updated = ?' + extra + ' WHERE id = ?').bind(now, ...args, g.id);
  const hostOnly = () => (isHost ? null : { error: 'host', code: 403 });

  if (g.pgone === 1 && b.a !== 'back') return { error: 'left', code: 403 };

  switch (b.a) {
    case 'back': {   // رجع بعد ما طلع
      await DB.batch([DB.prepare('UPDATE players SET gone = 0, seen = ? WHERE id = ?').bind(now, g.pid), bumpRev()]);
      return null;
    }
    case 'me': {     // تعديل اسمي ولوني
      const me = cleanPlayer(b.player);
      if (!me.name) return { error: 'name' };
      await DB.batch([DB.prepare('UPDATE players SET name = ?, color = ? WHERE id = ?').bind(me.name, me.color, g.pid), bumpRev()]);
      return null;
    }
    case 'rename': {
      if (!isHost) return hostOnly();
      const name = clip(b.name, 40);
      if (!name) return { error: 'name' };
      await DB.batch([bumpRev(', name = ?', name)]);
      return null;
    }
    case 'settings': {
      if (!isHost) return hostOnly();
      if (g.status !== 'lobby' && g.status !== 'score') return { error: 'status' };
      const s2 = cleanSettings(b.settings);
      if (g.status === 'score') s2.rounds = Math.max(s2.rounds, g.round);
      await DB.batch([bumpRev(', settings = ?', JSON.stringify(s2))]);
      return null;
    }
    case 'lock': {
      if (!isHost) return hostOnly();
      await DB.batch([bumpRev(', locked = ?', b.v ? 1 : 0)]);
      return null;
    }
    case 'extra': {
      if (!isHost) return hostOnly();
      const v = EXTRAS.includes(+b.v) ? +b.v : 0;
      await DB.batch([DB.prepare('UPDATE players SET extra = ? WHERE id = ? AND game = ?').bind(v, String(b.player || ''), g.id), bumpRev()]);
      return null;
    }
    case 'kick': {
      if (!isHost) return hostOnly();
      if (b.player === g.pid) return { error: 'self' };
      await DB.batch([DB.prepare('UPDATE players SET gone = 2 WHERE id = ? AND game = ?').bind(String(b.player || ''), g.id), bumpRev()]);
      if (g.status === 'play') await maybeClose(env, await authById(env, g.id, g.pid), now);
      return null;
    }
    case 'leave': {
      const w = [DB.prepare('UPDATE players SET gone = 1 WHERE id = ?').bind(g.pid)];
      if (isHost && g.status !== 'done') {
        const nx = await DB.prepare('SELECT id FROM players WHERE game = ? AND gone = 0 AND id <> ? ORDER BY seen DESC LIMIT 1').bind(g.id, g.pid).first();
        if (nx) w.push(DB.prepare('UPDATE games SET host = ? WHERE id = ?').bind(nx.id, g.id));
      }
      w.push(bumpRev());
      await DB.batch(w);
      if (g.status === 'play') await maybeClose(env, g, now);
      return null;
    }
    case 'start': {
      if (!isHost) return hostOnly();
      if (g.status !== 'lobby') return { error: 'status' };
      await startRound(env, g, st, now);
      return null;
    }
    case 'save':
    case 'done':
    case 'stop': {
      if (g.status !== 'play' || +b.round !== g.round) return { error: 'closed', code: 409 };
      const me = await DB.prepare('SELECT extra, done FROM players WHERE id = ?').bind(g.pid).first();
      const base = g.stop_at ? Math.min(g.ends_at, g.stop_at + STOP_MS) : g.ends_at;
      if (now < g.starts_at - 1500) return { error: 'early', code: 409 };
      if (now > base + (me.extra || 0) * 1000 + GRACE_MS) return { error: 'closed', code: 409 };
      const cats = st.cats || [];
      const txt = cats.map((_, i) => clip(Array.isArray(b.answers) ? b.answers[i] : '', 30));
      const w = [DB.prepare('INSERT INTO answers (game, round, player, txt) VALUES (?, ?, ?, ?) ON CONFLICT(game, round, player) DO UPDATE SET txt = excluded.txt').bind(g.id, g.round, g.pid, JSON.stringify(txt))];
      if (b.a === 'stop') {
        if (st.mode !== 'stop') return { error: 'mode' };
        const L = norm(g.letter);
        if (txt.some((x) => { const n = norm(x); return !n || n[0] !== L; })) return { error: 'incomplete' };
        w.push(DB.prepare('UPDATE players SET done = 1 WHERE id = ?').bind(g.pid));
        if (!g.stop_at) w.push(DB.prepare('UPDATE games SET stop_by = ?, stop_at = ?, rev = rev + 1, updated = ? WHERE id = ? AND stop_at IS NULL').bind(g.pid, now, now, g.id));
        else w.push(bumpRev());
      } else if (b.a === 'done') {
        w.push(DB.prepare('UPDATE players SET done = 1 WHERE id = ?').bind(g.pid), bumpRev());
      }
      await DB.batch(w);
      if (b.a !== 'save') await maybeClose(env, await authById(env, g.id, g.pid), now);
      return null;
    }
    case 'vote':
    case 'decide': {
      if (g.status !== 'review') return { error: 'status' };
      if (b.a === 'decide' && !isHost) return hostOnly();
      const target = String(b.player || ''), cat = +b.cat;
      if (!(cat >= 0 && cat < (st.cats || []).length)) return { error: 'cat' };
      if (b.a === 'vote' && target === g.pid) return { error: 'self' };
      const voter = b.a === 'decide' ? '#' : g.pid;
      const v = b.v === 1 || b.v === 0 ? b.v : null;
      const w = [v === null
        ? DB.prepare('DELETE FROM votes WHERE game = ? AND round = ? AND player = ? AND cat = ? AND voter = ?').bind(g.id, g.round, target, cat, voter)
        : DB.prepare('INSERT INTO votes (game, round, player, cat, voter, v) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(game, round, player, cat, voter) DO UPDATE SET v = excluded.v').bind(g.id, g.round, target, cat, voter, v)];
      w.push(bumpRev());
      await DB.batch(w);
      return null;
    }
    case 'cat': {     // المضيف يتنقل بين الفئات وقت التصحيح
      if (!isHost) return hostOnly();
      if (g.status !== 'review') return { error: 'status' };
      const c = Math.max(0, Math.min((st.cats || []).length - 1, +b.cat || 0));
      await DB.batch([bumpRev(', rcat = ?', c)]);
      return null;
    }
    case 'next': {
      if (!isHost) return hostOnly();
      if (g.status === 'review') {
        if (g.rcat < (st.cats || []).length - 1 && !b.finish) { await DB.batch([bumpRev(', rcat = rcat + 1')]); return null; }
        await finalizeRound(env, g, st, now);
        return null;
      }
      if (g.status === 'score') {
        if (g.round >= (st.rounds || 5)) await finishGame(env, g, now);
        else await startRound(env, g, st, now);
        return null;
      }
      return { error: 'status' };
    }
    case 'end': {
      if (!isHost) return hostOnly();
      if (g.status === 'done') return null;
      if (g.status === 'review') { await finalizeRound(env, g, st, now); g = await authById(env, g.id, g.pid); }
      await finishGame(env, g, now);
      return null;
    }
  }
  return { error: 'action' };
}

async function startRound(env, g, st, now) {
  const used = g.used || '';
  const pool = (EASY + (st.hard ? HARD : '')).split('').filter((ch) => !used.includes(ch));
  if (!pool.length) return finishGame(env, g, now);
  const letter = pool[rndInt(pool.length)];
  const starts = now + SPIN_MS, ends = starts + (st.time || 90) * 1000;
  const r = await env.DB.prepare("UPDATE games SET status = 'play', round = round + 1, letter = ?, used = used || ?, starts_at = ?, ends_at = ?, stop_by = NULL, stop_at = NULL, rcat = 0, rev = rev + 1, updated = ? WHERE id = ? AND status = ? AND round = ?")
    .bind(letter, letter, starts, ends, now, g.id, g.status, g.round).run();
  if (r.meta.changes) await env.DB.prepare('UPDATE players SET done = 0 WHERE game = ?').bind(g.id).run();
}

/* إغلاق الكتابة: خلص الوقت (مع وقت الصغار الإضافي) أو الكل سلّم */
async function maybeClose(env, g, now) {
  if (!g || g.status !== 'play') return false;
  const ps = (await env.DB.prepare('SELECT extra, done FROM players WHERE game = ? AND gone = 0').bind(g.id).all()).results || [];
  const base = g.stop_at ? Math.min(g.ends_at, g.stop_at + STOP_MS) : g.ends_at;
  const last = ps.reduce((m, p) => Math.max(m, base + (p.extra || 0) * 1000), base);
  // كل لاعب يا سلّم يا خلص وقته
  const allDone = ps.length > 0 && ps.every((p) => p.done || now > base + (p.extra || 0) * 1000 + GRACE_MS);
  if (!allDone && now <= last + GRACE_MS) return false;
  const r = await env.DB.prepare("UPDATE games SET status = 'review', rcat = 0, rev = rev + 1, updated = ? WHERE id = ? AND status = 'play' AND round = ?").bind(now, g.id, g.round).run();
  return r.meta.changes > 0;
}

/* اعتماد نتيجة الجولة: تنحفظ نقاط كل إجابة ومجموع كل لاعب */
async function finalizeRound(env, g, st, now) {
  const DB = env.DB;
  const r = await DB.prepare("UPDATE games SET status = 'score', rev = rev + 1, updated = ? WHERE id = ? AND status = 'review' AND round = ?").bind(now, g.id, g.round).run();
  if (!r.meta.changes) return;
  const { ps, ans, votes } = await roundData(env, g);
  const sc = scoreRound(g.letter, st.cats || [], ps, ans, votes);
  const w = [DB.prepare('INSERT OR REPLACE INTO rounds (game, round, letter, scores) VALUES (?, ?, ?, ?)').bind(g.id, g.round, g.letter, JSON.stringify(sc.totals))];
  for (const pid in sc.totals) if (sc.totals[pid]) w.push(DB.prepare('UPDATE players SET score = score + ? WHERE id = ?').bind(sc.totals[pid], pid));
  for (const a of ans) {
    const per = sc.per[a.player];
    if (per) w.push(DB.prepare('UPDATE answers SET res = ? WHERE game = ? AND round = ? AND player = ?').bind(JSON.stringify(per.map((e) => [e.st, e.pts])), g.id, g.round, a.player));
  }
  await DB.batch(w);
}

async function finishGame(env, g, now) {
  const ps = (await env.DB.prepare('SELECT id, name, color, score, gone FROM players WHERE game = ? AND gone <> 2 ORDER BY score DESC, ord').bind(g.id).all()).results || [];
  let rank = 0, prev = null;
  const players = ps.map((p, i) => { if (p.score !== prev) { rank = i + 1; prev = p.score; } return { id: p.id, name: p.name, color: p.color, score: p.score, rank }; });
  const rounds = await env.DB.prepare('SELECT COUNT(*) n FROM rounds WHERE game = ?').bind(g.id).first();
  const results = { players, rounds: rounds.n, winners: players.filter((p) => p.rank === 1 && p.score > 0).map((p) => p.name) };
  await env.DB.prepare("UPDATE games SET status = 'done', finished = ?, results = ?, rev = rev + 1, updated = ? WHERE id = ? AND status <> 'done'")
    .bind(now, JSON.stringify(results), now, g.id).run();
  await env.DB.prepare('UPDATE games SET grp = (SELECT f.grp FROM players p JOIN profiles f ON f.id = p.prof WHERE p.game = ?1 AND f.grp IS NOT NULL GROUP BY f.grp HAVING COUNT(DISTINCT f.id) >= 2 LIMIT 1) WHERE id = ?1 AND grp IS NULL').bind(g.id).run();
}

/* ===================== ملفي وقروب اللعب ===================== */
async function profByTok(env, tok) {
  tok = String(tok || '');
  if (tok.length < 20) return null;
  return env.DB.prepare('SELECT * FROM profiles WHERE tok = ?').bind(tok).first();
}
const digits = (s) => String(s || '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\D/g, '');
async function newCode(env) {   // ٨ أرقام، ما تتكرر بين الملفات والقروبات
  for (let i = 0; i < 20; i++) {
    const c = String(10000000 + rndInt(90000000));
    const a = await env.DB.prepare('SELECT (SELECT COUNT(*) FROM profiles WHERE code = ?1) + (SELECT COUNT(*) FROM pgroups WHERE code = ?1) n').bind(c).first();
    if (!a.n) return c;
  }
  throw new Error('code');
}
/* يرفع الجهاز ألعابه القديمة (بمفتاح اللاعب كإثبات) وألعاب الورقة */
async function syncProfile(env, prof, b, now) {
  const DB = env.DB, w = [];
  const games = (Array.isArray(b.games) ? b.games : []).slice(0, 300);
  for (const x of games) {
    const r = await DB.prepare('SELECT id FROM players WHERE game = ? AND token = ?').bind(+x.g || 0, String(x.t || '')).first();
    if (!r) continue;
    w.push(DB.prepare('INSERT OR IGNORE INTO pgames (prof, game, player, token) VALUES (?, ?, ?, ?)').bind(prof.id, +x.g, r.id, String(x.t)));
    w.push(DB.prepare('UPDATE players SET prof = ? WHERE id = ? AND prof IS NULL').bind(prof.id, r.id));
  }
  for (const x of (Array.isArray(b.paper) ? b.paper : []).slice(0, 300)) {
    const pid = clip(x.pid, 40), data = String(x.data || '');
    if (!pid || data.length > 20000) continue;
    w.push(DB.prepare('INSERT INTO ppaper (prof, pid, data, updated) VALUES (?, ?, ?, ?) ON CONFLICT(prof, pid) DO UPDATE SET data = excluded.data, updated = excluded.updated').bind(prof.id, pid, data, now));
  }
  const me = cleanPlayer({ name: b.name, color: b.color });
  w.push(DB.prepare('UPDATE profiles SET seen = ?, name = COALESCE(NULLIF(?, \'\'), name), color = ? WHERE id = ?').bind(now, me.name, me.color, prof.id));
  for (let i = 0; i < w.length; i += 90) await DB.batch(w.slice(i, i + 90));
  if (prof.grp) await tagGroupGames(env, prof.grp);
}
/* استرجاع: ملف هالجهاز يندمج في الملف اللي رمزه انكتب، والقديم ينحذف */
async function mergeProfiles(env, from, to) {
  const DB = env.DB;
  await DB.batch([
    DB.prepare('INSERT OR IGNORE INTO pgames (prof, game, player, token) SELECT ?, game, player, token FROM pgames WHERE prof = ?').bind(to.id, from.id),
    DB.prepare('DELETE FROM pgames WHERE prof = ?').bind(from.id),
    DB.prepare('INSERT OR IGNORE INTO ppaper (prof, pid, data, updated) SELECT ?, pid, data, updated FROM ppaper WHERE prof = ?').bind(to.id, from.id),
    DB.prepare('DELETE FROM ppaper WHERE prof = ?').bind(from.id),
    DB.prepare('UPDATE players SET prof = ? WHERE prof = ?').bind(to.id, from.id),
    DB.prepare('UPDATE profiles SET grp = COALESCE(grp, ?) WHERE id = ?').bind(from.grp, to.id),
    DB.prepare('UPDATE pgroups SET owner = ? WHERE owner = ?').bind(to.id, from.id),
    DB.prepare('DELETE FROM profiles WHERE id = ?').bind(from.id)
  ]);
}
/* الألعاب اللي لعبها اثنين أو أكثر من أفراد القروب تنضاف لسجله */
async function tagGroupGames(env, grp) {
  if (!grp) return;
  await env.DB.prepare('UPDATE games SET grp = ?1 WHERE grp IS NULL AND id IN (SELECT p.game FROM players p JOIN profiles f ON f.id = p.prof WHERE f.grp = ?1 GROUP BY p.game HAVING COUNT(DISTINCT f.id) >= 2)').bind(grp).run();
}
async function liveGames(env, prof, now) {
  if (!prof.grp) return [];
  const rows = (await env.DB.prepare("SELECT g.id, g.name, g.code, g.status, g.round, g.settings, g.locked, (SELECT COUNT(*) FROM players p WHERE p.game = g.id AND p.gone = 0) players, (SELECT player FROM pgames WHERE prof = ?1 AND game = g.id LIMIT 1) mine, (SELECT name FROM players p WHERE p.id = g.host) hostname FROM games g WHERE g.grp = ?2 AND g.status <> 'done' AND g.updated > ?3 ORDER BY g.id DESC LIMIT 5")
    .bind(prof.id, prof.grp, now - LIVE_MS).all()).results || [];
  return rows.map((r) => ({ id: r.id, name: r.name, code: r.code, status: r.status, round: r.round, rounds: parse(r.settings, {}).rounds, players: r.players, mine: r.mine || null, host: r.hostname, locked: !!r.locked }));
}
/* كل بيانات «ملفي»: ألعابي وألعاب القروب والورقة والقروب نفسه */
async function meData(env, prof, now) {
  const DB = env.DB;
  const sel = 'FROM games g WHERE g.id IN (SELECT game FROM pgames WHERE prof = ?1) OR (?2 IS NOT NULL AND g.grp = ?2)';
  let rows = (await DB.prepare('SELECT g.id, g.name, g.status, g.round, g.letter, g.created, g.updated, g.finished, g.results, g.settings, g.grp, g.host, g.code, g.used ' + sel + ' ORDER BY g.id DESC LIMIT 300').bind(prof.id, prof.grp).all()).results || [];
  // ألعاب وقفت أكثر من ١٢ ساعة بدون ما تكمل: تنقفل وتنحسب نتيجتها على الجولات اللي خلصت
  const idle = rows.filter((r) => r.status !== 'done' && (r.updated || 0) < now - IDLE_GAME).slice(0, 10);
  for (const r of idle) {
    const full = await DB.prepare('SELECT *, NULL AS pid FROM games WHERE id = ?').bind(r.id).first();
    if (full.status === 'review') await finalizeRound(env, full, parse(full.settings, {}), now);
    await finishGame(env, await DB.prepare('SELECT * FROM games WHERE id = ?').bind(r.id).first(), now);
  }
  if (idle.length) rows = (await DB.prepare('SELECT g.id, g.name, g.status, g.round, g.letter, g.created, g.updated, g.finished, g.results, g.settings, g.grp, g.host, g.code, g.used ' + sel + ' ORDER BY g.id DESC LIMIT 300').bind(prof.id, prof.grp).all()).results || [];
  const [links, pls, paper] = await Promise.all([
    DB.prepare('SELECT game, player, token FROM pgames WHERE prof = ?').bind(prof.id).all(),
    DB.prepare('SELECT p.game, p.id, p.name, p.color, p.score, p.prof FROM players p WHERE p.gone <> 2 AND p.game IN (SELECT g.id ' + sel + ')').bind(prof.id, prof.grp).all(),
    DB.prepare('SELECT pid, data FROM ppaper WHERE prof = ? ORDER BY updated DESC LIMIT 300').bind(prof.id).all()
  ]);
  const lk = {}; for (const l of links.results || []) lk[l.game] = l;
  const pg = {}; for (const p of pls.results || []) (pg[p.game] = pg[p.game] || []).push({ id: p.id, name: p.name, color: p.color, score: p.score, prof: p.prof });
  const games = rows.map((r) => {
    const res = parse(r.results, null), st = parse(r.settings, {});
    return {
      g: r.id, t: lk[r.id] ? lk[r.id].token : null, me: lk[r.id] ? lk[r.id].player : null, name: r.name, status: r.status, round: r.round,
      rounds: res ? res.rounds : r.round, created: r.created, finished: r.finished, updated: r.updated, grp: r.grp, letters: r.used || '',
      host: !!(lk[r.id] && lk[r.id].player === r.host), winners: res ? res.winners : [], settings: st, code: r.status === 'done' ? null : r.code,
      players: pg[r.id] || []
    };
  });
  let group = null;
  if (prof.grp) {
    const gr = await DB.prepare('SELECT * FROM pgroups WHERE id = ?').bind(prof.grp).first();
    const mem = (await DB.prepare('SELECT id, name, color, seen FROM profiles WHERE grp = ? ORDER BY created').bind(prof.grp).all()).results || [];
    if (gr) {
      // بطل القروب: عدد مرات الفوز لكل فرد في ألعاب القروب اللي كملت
      const champ = {};
      for (const m of mem) champ[m.id] = { prof: m.id, name: m.name, color: m.color, wins: 0, games: 0, points: 0 };
      for (const gm of games) {
        if (gm.grp !== gr.id || gm.status !== 'done') continue;
        const top = Math.max(0, ...gm.players.map((x) => x.score));
        const seen = new Set();
        for (const pl of gm.players) {
          const c = champ[pl.prof]; if (!c || seen.has(pl.prof)) continue;
          seen.add(pl.prof); c.games++; c.points += pl.score; if (top > 0 && pl.score === top) c.wins++;
        }
      }
      group = { id: gr.id, name: gr.name, code: gr.code, owner: gr.owner === prof.id, created: gr.created,
        members: mem.map((m) => ({ id: m.id, name: m.name, color: m.color, me: m.id === prof.id, on: now - (m.seen || 0) < 5 * 60e3, owner: m.id === gr.owner })),
        champ: Object.values(champ).sort((a, b) => b.wins - a.wins || b.points - a.points) };
    }
  }
  return {
    now, profile: { id: prof.id, code: prof.code, name: prof.name, color: prof.color }, group, games,
    paper: (paper.results || []).map((x) => ({ pid: x.pid, data: x.data })), live: await liveGames(env, prof, now)
  };
}

/* ===================== الحالة الكاملة ===================== */
async function fullState(env, g, now) {
  const st = parse(g.settings, {});
  const ps = (await env.DB.prepare('SELECT id, name, color, extra, score, gone, done, seen FROM players WHERE game = ? ORDER BY ord').bind(g.id).all()).results || [];
  const out = {
    now, rev: g.rev, me: g.pid, left: g.pgone === 1,
    game: {
      id: g.id, name: g.name, code: g.status === 'done' ? null : g.code, status: g.status, settings: st, round: g.round, letter: g.letter, used: g.used || '',
      starts_at: g.starts_at, ends_at: g.ends_at, stop_by: g.stop_by, stop_at: g.stop_at, stop_ms: STOP_MS, rcat: g.rcat, host: g.host, locked: !!g.locked,
      created: g.created, finished: g.finished
    },
    players: ps.map((p) => ({ id: p.id, name: p.name, color: p.color, extra: p.extra, score: p.score, gone: p.gone, done: p.done, on: now - (p.seen || 0) < ONLINE_MS }))
  };
  if (g.status === 'play') {
    const a = await env.DB.prepare('SELECT txt FROM answers WHERE game = ? AND round = ? AND player = ?').bind(g.id, g.round, g.pid).first();
    out.mine = a ? parse(a.txt, []) : [];
  }
  if (g.status === 'review' || g.status === 'score') {
    const { ps: rp, ans, votes } = await roundData(env, g);
    const sc = scoreRound(g.letter, st.cats || [], rp, ans, votes);
    const mv = {};
    for (const v of votes) if (v.voter === g.pid) mv[v.player + '|' + v.cat] = v.v;
    for (const pid in sc.per) sc.per[pid].forEach((e) => { delete e.n; });
    out.review = sc.per; out.roundTotals = sc.totals; out.myVotes = mv;
  }
  if (g.status === 'score' || g.status === 'done') {
    out.rounds = ((await env.DB.prepare('SELECT round, letter, scores FROM rounds WHERE game = ? ORDER BY round').bind(g.id).all()).results || [])
      .map((r) => ({ round: r.round, letter: r.letter, scores: parse(r.scores, {}) }));
  }
  if (g.status === 'done') out.results = parse(g.results, null);
  return out;
}

async function roundData(env, g) {
  const [ps, ans, votes] = await Promise.all([
    env.DB.prepare('SELECT id, gone FROM players WHERE game = ? AND gone <> 2 ORDER BY ord').bind(g.id).all(),
    env.DB.prepare('SELECT player, txt FROM answers WHERE game = ? AND round = ?').bind(g.id, g.round).all(),
    env.DB.prepare('SELECT player, cat, voter, v FROM votes WHERE game = ? AND round = ?').bind(g.id, g.round).all()
  ]);
  const a = (ans.results || []).map((r) => ({ player: r.player, txt: parse(r.txt, []) }));
  const has = new Set(a.map((x) => x.player));
  return { ps: (ps.results || []).filter((p) => !p.gone || has.has(p.id)), ans: a, votes: votes.results || [] };
}

/* ===================== التصحيح والنقاط =====================
   فريدة ١٠ · مكررة ٥ · فاضية أو غلط صفر.
   الإجابة مقبولة إلا إذا اللي رفضوها أكثر من اللي قبلوها، وقرار المضيف يحسم أي شي. */
function scoreRound(letter, cats, ps, ans, votes) {
  const L = norm(letter || '');
  const vmap = {};
  for (const v of votes) (vmap[v.player + '|' + v.cat] = vmap[v.player + '|' + v.cat] || []).push(v);
  const per = {}, totals = {};
  for (const p of ps) { per[p.id] = cats.map(() => ({ t: '', st: 'empty', pts: 0, acc: 0, rej: 0, ovr: null, tie: false })); totals[p.id] = 0; }
  for (const a of ans) if (per[a.player]) per[a.player].forEach((e, i) => { e.t = String(a.txt[i] || ''); });
  for (let c = 0; c < cats.length; c++) {
    const groups = {};
    for (const pid in per) {
      const e = per[pid][c];
      e.n = norm(e.t);
      for (const v of vmap[pid + '|' + c] || []) { if (v.voter === '#') e.ovr = v.v; else if (v.v) e.acc++; else e.rej++; }
      if (!e.n) { e.st = 'empty'; continue; }
      const right = e.n[0] === L;
      let ok;
      if (e.ovr !== null) ok = !!e.ovr;
      else if (!right) ok = false;
      else ok = !(e.rej > e.acc);
      e.tie = right && e.ovr === null && e.rej > 0 && e.rej === e.acc;
      if (!ok) { e.st = !right && e.ovr === null ? 'bad' : 'rej'; continue; }
      (groups[e.n] = groups[e.n] || []).push(e);
    }
    for (const k in groups) for (const e of groups[k]) { e.st = groups[k].length > 1 ? 'dup' : 'uniq'; e.pts = groups[k].length > 1 ? 5 : 10; }
    for (const pid in per) totals[pid] += per[pid][c].pts;
  }
  return { per, totals };
}

/* «الأسد» = «اسد» = «أسد»، و«ة» = «ه»، و«ى» = «ي»، بدون تشكيل */
function norm(s) {
  let x = String(s || '').toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[^ء-يa-z0-9]+/g, ' ').trim();
  if (x.length > 3 && x.startsWith('ال')) x = x.slice(2);
  return x.replace(/ /g, '');
}

/* ===================== لوحة الإدارة ===================== */
async function stats(env, now) {
  const DAY = 864e5, today0 = Date.parse(new Date(now + 3 * 3600e3).toISOString().slice(0, 10) + 'T00:00:00+03:00');
  const one = (sql, ...a) => env.DB.prepare(sql).bind(...a).first();
  const [g, p, live, online, rounds, recent, days, pr] = await Promise.all([
    one("SELECT COUNT(*) total, SUM(created >= ?) today, SUM(created >= ?) week, SUM(status = 'done') done FROM games", today0, now - 7 * DAY),
    one('SELECT COUNT(*) total, SUM(joined >= ?) today FROM players WHERE gone <> 2', today0),
    one("SELECT COUNT(*) n FROM games WHERE status <> 'done' AND updated > ?", now - 10 * 60e3),
    one('SELECT COUNT(*) n FROM players WHERE gone = 0 AND seen > ?', now - ONLINE_MS),
    one('SELECT COUNT(*) n FROM rounds'),
    env.DB.prepare('SELECT g.id, g.name, g.status, g.round, g.created, g.updated, (SELECT COUNT(*) FROM players p WHERE p.game = g.id AND p.gone <> 2) players FROM games g ORDER BY g.id DESC LIMIT 12').all(),
    env.DB.prepare("SELECT day, n FROM daily WHERE k = 'games' ORDER BY day DESC LIMIT 30").all(),
    one('SELECT (SELECT COUNT(*) FROM profiles) profiles, (SELECT COUNT(*) FROM pgroups) groups, (SELECT COUNT(*) FROM profiles WHERE grp IS NOT NULL) inGroups, (SELECT COUNT(*) FROM ppaper) paper')
  ]);
  const total = g.total || 0, players = p.total || 0;
  return {
    subs: 0, games: total, gamesToday: g.today || 0, gamesWeek: g.week || 0, finished: g.done || 0, liveGames: live.n || 0,
    players, playersToday: p.today || 0, online: online.n || 0, rounds: rounds.n || 0, avgPlayers: total ? Math.round(players / total * 10) / 10 : 0,
    recent: recent.results || [], daily: days.results || [],
    profiles: pr.profiles || 0, groups: pr.groups || 0, inGroups: pr.inGroups || 0, paper: pr.paper || 0
  };
}

/* مفتاح الإدارة: ADMIN_KEY هنا إن وُجد، وإلا نتأكد منه عند siraj-api (نفس المفتاح لكل خوادم ومض آرك) */
const normKey = (k) => String(k || '').replace(/[٠-٩]/g, (x) => '٠١٢٣٤٥٦٧٨٩'.indexOf(x)).replace(/[۰-۹]/g, (x) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(x)).replace(/\s+/g, '');
const adminOk = new Map();
async function isAdmin(req, env) {
  let k = req.headers.get('X-Admin-Key') || (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  try { k = decodeURIComponent(k); } catch (e) {}
  const a = normKey(k);
  if (!a) return false;
  if (env.ADMIN_KEY) {
    const b = normKey(env.ADMIN_KEY);
    if (a.length !== b.length) return false;
    let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return r === 0;
  }
  const h = await sha('adm:' + a), hit = adminOk.get(h);
  if (hit && hit > Date.now()) return true;
  try {
    // Cloudflare يمنع خادم يكلّم خادم ثاني على workers.dev بـ fetch العادي، فنستخدم الربط المباشر SIRAJ
    const r = env.SIRAJ ? await env.SIRAJ.fetch('https://siraj-api/stats', { headers: { Authorization: 'Bearer ' + encodeURIComponent(a) } }) : null;
    if (r && r.ok) { adminOk.set(h, Date.now() + 10 * 60e3); return true; }
  } catch (e) {}
  return false;
}
/* قفل مؤقت بعد محاولات خاطئة كثيرة (مثل نَبْض) */
const AF = { ipMax: 20, ipLock: 30 * 60e3, allMax: 100, allLock: 15 * 60e3, win: 36e5 };
async function adminGate(req, db, check) {
  const now = Date.now();
  const raw = (req.headers.get('X-Admin-Key') || req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!raw) return 'bad';
  const ip = (await sha('af:' + (req.headers.get('CF-Connecting-IP') || 'local'))).slice(0, 24);
  await db.prepare('CREATE TABLE IF NOT EXISTS afail (ip TEXT PRIMARY KEY, n INTEGER, last INTEGER, lock INTEGER)').run();
  const rows = (await db.prepare("SELECT ip, n, last, lock FROM afail WHERE ip IN (?, '*')").bind(ip).all()).results || [];
  if (rows.some((r) => r.lock > now)) return 'locked';
  if (await check()) {
    if (rows.some((r) => r.ip === ip)) await db.prepare('DELETE FROM afail WHERE ip = ?').bind(ip).run();
    return 'ok';
  }
  const st = [];
  for (const [k, max, lock] of [[ip, AF.ipMax, AF.ipLock], ['*', AF.allMax, AF.allLock]]) {
    const r = rows.find((x) => x.ip === k);
    const n = (r && r.last > now - AF.win ? r.n : 0) + 1;
    st.push(db.prepare('INSERT INTO afail (ip, n, last, lock) VALUES (?, ?, ?, ?) ON CONFLICT(ip) DO UPDATE SET n = excluded.n, last = excluded.last, lock = excluded.lock')
      .bind(k, n >= max ? 0 : n, now, n >= max ? now + lock : 0));
  }
  await db.batch(st);
  return 'bad';
}
async function sha(s) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ===================== أدوات ===================== */
async function auth(env, gid, tok) {
  if (!gid || !tok) return null;
  return env.DB.prepare('SELECT g.*, p.id AS pid, p.seen AS pseen, p.gone AS pgone, h.seen AS hseen, h.gone AS hgone FROM games g JOIN players p ON p.game = g.id AND p.token = ?1 LEFT JOIN players h ON h.id = g.host WHERE g.id = ?2')
    .bind(tok, gid).first();
}
async function authById(env, gid, pid) {
  return env.DB.prepare('SELECT g.*, p.id AS pid, p.seen AS pseen, p.gone AS pgone, h.seen AS hseen, h.gone AS hgone FROM games g JOIN players p ON p.game = g.id AND p.id = ?1 LEFT JOIN players h ON h.id = g.host WHERE g.id = ?2')
    .bind(pid, gid).first();
}

function cleanSettings(s) {
  s = s || {};
  let cats = Array.isArray(s.cats) ? s.cats.map((c) => clip(c, 20)).filter(Boolean) : [];
  cats = cats.filter((c, i) => cats.indexOf(c) === i).slice(0, 8);
  if (cats.length < 3) cats = ['اسم', 'حيوان', 'نبات', 'جماد', 'بلاد'];
  return {
    cats,
    rounds: ROUNDS.includes(+s.rounds) ? +s.rounds : 5,
    time: TIMES.includes(+s.time) ? +s.time : 90,
    mode: s.mode === 'time' ? 'time' : 'stop',
    hard: !!s.hard
  };
}
function cleanPlayer(p) {
  p = p || {};
  const c = +p.color;
  return { name: clip(p.name, 20), color: c >= 0 && c < 12 ? Math.floor(c) : 0 };
}

let schemaReady = false;
async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS games (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, name TEXT NOT NULL, host TEXT, status TEXT NOT NULL, settings TEXT NOT NULL, round INTEGER DEFAULT 0, letter TEXT, used TEXT DEFAULT '', starts_at INTEGER, ends_at INTEGER, stop_by TEXT, stop_at INTEGER, rcat INTEGER DEFAULT 0, locked INTEGER DEFAULT 0, rev INTEGER DEFAULT 1, created INTEGER NOT NULL, updated INTEGER, finished INTEGER, results TEXT)"),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS games_code ON games (code)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, game INTEGER NOT NULL, token TEXT NOT NULL, name TEXT NOT NULL, color INTEGER DEFAULT 0, extra INTEGER DEFAULT 0, score INTEGER DEFAULT 0, joined INTEGER, seen INTEGER, gone INTEGER DEFAULT 0, done INTEGER DEFAULT 0, ord INTEGER DEFAULT 0)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS players_game ON players (game)'),
    env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS players_tok ON players (game, token)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS answers (game INTEGER NOT NULL, round INTEGER NOT NULL, player TEXT NOT NULL, txt TEXT, res TEXT, PRIMARY KEY (game, round, player))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS votes (game INTEGER NOT NULL, round INTEGER NOT NULL, player TEXT NOT NULL, cat INTEGER NOT NULL, voter TEXT NOT NULL, v INTEGER NOT NULL, PRIMARY KEY (game, round, player, cat, voter))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS rounds (game INTEGER NOT NULL, round INTEGER NOT NULL, letter TEXT, scores TEXT, PRIMARY KEY (game, round))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS lim (k TEXT PRIMARY KEY, n INTEGER NOT NULL, until INTEGER NOT NULL)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS daily (day TEXT NOT NULL, k TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, k))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, tok TEXT UNIQUE, name TEXT, color INTEGER DEFAULT 0, grp INTEGER, created INTEGER, seen INTEGER)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS profiles_grp ON profiles (grp)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS pgames (prof INTEGER NOT NULL, game INTEGER NOT NULL, player TEXT NOT NULL, token TEXT NOT NULL, PRIMARY KEY (prof, game, player))'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS pgames_game ON pgames (game)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS ppaper (prof INTEGER NOT NULL, pid TEXT NOT NULL, data TEXT, updated INTEGER, PRIMARY KEY (prof, pid))'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS pgroups (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE, name TEXT NOT NULL, owner INTEGER, created INTEGER)')
  ]);
  // أعمدة جديدة على جداول قديمة (تنضاف مرة وحدة)
  const cols = async (t) => ((await env.DB.prepare('PRAGMA table_info(' + t + ')').all()).results || []).map((c) => c.name);
  if (!(await cols('players')).includes('prof')) await env.DB.prepare('ALTER TABLE players ADD COLUMN prof INTEGER').run();
  if (!(await cols('games')).includes('grp')) await env.DB.prepare('ALTER TABLE games ADD COLUMN grp INTEGER').run();
  await env.DB.batch([
    env.DB.prepare('CREATE INDEX IF NOT EXISTS players_prof ON players (prof)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS games_grp ON games (grp)')
  ]);
  schemaReady = true;
}

async function bump(env, k, max, win, now) {
  const r = await env.DB.prepare('SELECT n, until FROM lim WHERE k = ?').bind(k).first();
  if (r && r.until > now) {
    if (r.n >= max) return false;
    await env.DB.prepare('UPDATE lim SET n = n + 1 WHERE k = ?').bind(k).run();
    return true;
  }
  await env.DB.prepare('INSERT INTO lim (k, n, until) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = 1, until = excluded.until').bind(k, now + win).run();
  return true;
}
async function blocked(env, k, max, now) {
  const r = await env.DB.prepare('SELECT n, until FROM lim WHERE k = ?').bind(k).first();
  return !!(r && r.until > now && r.n >= max);
}
async function daily(env, now, k) {
  const day = new Date(now + 3 * 3600e3).toISOString().slice(0, 10);
  await env.DB.prepare('INSERT INTO daily (day, k, n) VALUES (?, ?, 1) ON CONFLICT(day, k) DO UPDATE SET n = n + 1').bind(day, k).run();
}

async function body(req) { try { return await req.json(); } catch (e) { return {}; } }
function parse(s, d) { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } }
function clip(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n); }
function rndInt(n) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
function rnd(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, (b) => (b % 36).toString(36)).join(''); }
function code6() { return String(100000 + rndInt(900000)); }

