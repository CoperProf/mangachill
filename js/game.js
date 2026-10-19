// ====== MangaChill — moteur du jeu ======
const SAVE_KEY = 'mangachill-save-v2';
const MAX_LVL = 100;
const TEAM_SIZE = 6;

const $ = (s) => document.querySelector(s);
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : Math.floor(n).toLocaleString('fr-FR');
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
function pickWeighted(arr) {
  const tot = arr.reduce((s, x) => s + x[1], 0);
  let r = Math.random() * tot;
  for (const x of arr) if ((r -= x[1]) < 0) return x[0];
  return arr[0][0];
}

// ---------- État ----------
function newState() {
  return {
    v: 1, started: false, gold: 150, gems: 20,
    items: { ramen: 3, scroll: 5, gscroll: 0, book: 0, sbook: 0, orb: 0, fragbox: 0 },
    roster: {}, team: [], frags: {}, dex: {},
    zone: null, tokens: {}, evoItems: {}, levelCap: LEVEL_CAP_START, tower: 0, endgame: 0,
    stats: { kills: 0, caught: 0, bosses: 0, sanct: 0, tokens: 0, pulls: 0, goldEarned: 0 },
    ach: {}, autoScroll: true, autoGold: false, speed: 1,
    dojo: { lvl: 1, slots: [] },
    last: Date.now(),
  };
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const d = Object.assign(newState(), parsed);
    d.stats = Object.assign(newState().stats, d.stats);
    // sauvegarde d'avant la Tour : on ne fait pas redescendre les personnages déjà haut niveau
    if (!('levelCap' in parsed)) {
      const top = Math.max(0, ...Object.values(d.roster || {}).map((m) => m.lvl));
      d.levelCap = Math.min(100, Math.max(LEVEL_CAP_START, Math.ceil(top / 10) * 10));
    }
    return d;
  } catch (e) { return null; }
}
function save() {
  S.last = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* stockage indisponible */ }
}
let S = load() || newState();
let B = null;          // combat en cours (non sauvegardé)
let LOG = [];
let tab = 'explore';
let lastTick = Date.now();
let accDojo = 0, accSave = 0, accAch = 0;

// ---------- Personnages ----------
const xpNeed = (l) => Math.floor(8 * Math.pow(l, 1.6)) + 10;
const ownedCount = () => Object.keys(S.roster).length;
const maxLevel = () => Math.max(0, ...Object.values(S.roster).map((m) => m.lvl));
function statMult(m) { return (1 + 0.12 * (m.stars || 0)) * (m.shiny ? 1.15 : 1) * (1 + EVO_BONUS * (m.evo || 0)); }
function calcStats(id, lvl, m = {}) {
  const b = CH[id].b, k = statMult(m);
  const f = (x) => Math.floor(((x * 2 * lvl) / 50 + 5) * k);
  return { hp: Math.floor(((b[0] * 2 * lvl) / 50 + lvl + 10) * k), atk: f(b[1]), def: f(b[2]), spd: f(b[3]) };
}
const statsOf = (m) => calcStats(m.id, m.lvl, m);
function hpOf(m) {
  const mx = statsOf(m).hp;
  if (m.hp == null || m.hp > mx) m.hp = mx;
  return m.hp;
}
// evo : forme actuelle (0 = forme de base) ; chaque forme remplace et renforce la technique signature
function movesOf(id, lvl, evo = 0) {
  const c = CH[id];
  const sig = evo > 0 && c.evos ? c.evos[evo - 1].sig : c.sig;
  const mv = [{ n: TYPE_MOVES[c.type][0], p: 40, cd: 0, t: c.type, at: 1 }];
  mv.push({ n: TYPE_MOVES[c.type][1], p: 75, cd: 2, t: c.type, at: 10 });
  mv.push({ n: sig, p: 115 + 20 * evo, cd: 4, t: c.type, at: 20, sig: true });
  mv.push({ n: TYPE_MOVES[c.t2][1], p: 75, cd: 2, t: c.t2, at: 30 });
  return mv.filter((m) => m.at <= lvl);
}
function allMovesOf(id, evo = 0) { return movesOf(id, 999, evo); }
// nom affiché, avec la forme actuelle
function cname(id, m) {
  const c = CH[id];
  return m && m.evo && c.evos ? `${esc(c.n)} <span class="evoname">${esc(c.evos[m.evo - 1].n)}</span>` : esc(c.n);
}
const evoCls = (m) => (m && m.evo ? ` evo evo${m.evo}` : '');
function teamMembers() { return S.team.map((id) => S.roster[id]).filter(Boolean); }
function priceOf(it) { return it.scale ? Math.floor(it.p * (1 + maxLevel() / 15)) : it.p; }
const teamMax = () => Math.max(1, ...teamMembers().map((m) => m.lvl));

// cap : niveau au-delà duquel le personnage ne gagne plus d'XP (zone trop facile)
function gainXp(m, xp, silent, cap = MAX_LVL) {
  cap = Math.min(cap, MAX_LVL, S.levelCap);   // le niveau max est bloqué par la Tour
  if (m.lvl >= cap) return;
  const before = statsOf(m).hp, oldLvl = m.lvl;
  m.xp += Math.floor(xp);
  while (m.lvl < cap && m.xp >= xpNeed(m.lvl)) { m.xp -= xpNeed(m.lvl); m.lvl++; }
  if (m.lvl >= cap) m.xp = 0;
  if (m.lvl > oldLvl) {
    hpOf(m); m.hp = Math.min(statsOf(m).hp, m.hp + statsOf(m).hp - before);
    if (!silent) {
      log(`⬆️ <b>${CH[m.id].n}</b> passe au niveau ${m.lvl} !`, 'lvl');
      for (const mv of allMovesOf(m.id)) if (mv.at > oldLvl && mv.at <= m.lvl) toast(`${CH[m.id].n} apprend <b>${mv.n}</b> !`, 'good');
    }
  }
}

function recruit(id, shiny, lvl, why) {
  const c = CH[id], ex = S.roster[id];
  S.dex[id] = S.dex[id] || { seen: 1 };
  if (!ex) {
    S.roster[id] = { id, lvl: Math.max(1, Math.min(lvl, S.levelCap)), xp: 0, stars: 0, shiny: !!shiny, hp: null };
    S.stats.caught++;
    if (S.team.length < TEAM_SIZE && !S.dojo.slots.includes(id)) S.team.push(id);
    toast(`${shiny ? '🌟 ' : ''}<b>${c.n}</b> rejoint ton clan${why ? ' ' + why : ''} !`, 'catch');
    return 'new';
  }
  if (shiny && !ex.shiny) {
    ex.shiny = true;
    toast(`🌟 <b>${c.n}</b> s'est éveillé !`, 'catch');
    return 'awaken';
  }
  const fr = RARITY[c.r].frag * (shiny ? 3 : 1);
  S.frags[id] = (S.frags[id] || 0) + fr;
  toast(`+${fr} fragments de <b>${c.n}</b>`, 'info');
  return 'frag';
}
const starCost = (m) => (m.stars + 1) * 20;

// ---------- Zones actives (rotation de 12 h) ----------
let ROT = null, ROT_SLOT = -1;
function activeZones() {
  const slot = rotationSlot();
  if (slot !== ROT_SLOT) { ROT_SLOT = slot; const subs = rotation(slot); ROT = { subs, hunts: huntsOf(subs) }; }
  return ROT;
}
function zoneById(id) { const a = activeZones(); return a.subs.concat(a.hunts).find((z) => z.id === id); }
function curZone() { return zoneById(S.zone); }
const xpCap = (z) => (z ? Math.min(MAX_LVL, z.lv[1] + XP_MARGIN) : MAX_LVL);
const battleCap = () => Math.min(S.levelCap, B && B.sanct ? MAX_LVL : xpCap(curZone()));
function rotLeft() {
  const ms = (rotationSlot() + 1) * ROTATION_MS - Date.now();
  return `${Math.floor(ms / 3600000)} h ${String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0')}`;
}

// ---------- Combat ----------
function activeMember() {
  if (!B) return null;
  let m = S.roster[B.active];
  if (m && S.team.includes(m.id) && hpOf(m) > 0) return m;
  m = teamMembers().find((x) => hpOf(x) > 0);
  if (m) { B.active = m.id; B.pcd = {}; B.redraw = true; }
  return m || null;
}
function spawn() {
  const z = curZone();
  if (!z) { B = null; return; }
  const id = pickWeighted(z.pool);
  makeBattle(id, rand(z.lv[0], z.lv[1]), Math.random() < 1 / 150, z.kind === 'hunt' ? 'hunt' : null, z.id);
}
// Tour : on affronte l'équipe de l'étage dans l'ordre, sans soin complet entre deux adversaires
function startTower(k) {
  const f = TOWER[k];
  if (!f || k !== S.tower || (B && B.sanct) || !S.team.length) return;
  healAll(1); LOG = [];
  log(`🗼 Étage ${k + 1} : <b>${f.n}</b> — ${f.ids.length} adversaires t'attendent !`, 'boss');
  nextTowerFoe({ k, idx: 0 });
}
// Boss de fin de jeu : un seul adversaire avec plusieurs barres de vie
function startFinal(i) {
  const b = ENDGAME[i];
  if (!b || !b.id || S.tower < TOWER.length || i > S.endgame || (B && B.sanct) || !S.team.length) return;
  healAll(1); LOG = [];
  SIM = true; try { makeBattle(b.id, b.lv, false, 'final', 'final'); } finally { SIM = false; }
  const e = B.enemy, k = FINAL_TIERS[b.bars];
  e.st = { hp: Math.floor(e.st.hp * k.hp), atk: Math.floor(e.st.atk * k.atk), def: Math.floor(e.st.def * k.def), spd: Math.floor(e.st.spd * k.spd) };
  e.hp = e.st.hp; e.bars = b.bars; e.barsLeft = b.bars;
  B.final = i; B.redraw = false; renderArena();
  log(`☠️ <b>${esc(b.t)}</b> apparaît : ${b.bars} barres de vie !`, 'boss');
}
function breakBar() {
  const e = B.enemy;
  e.barsLeft--; e.hp = e.st.hp; e.st.atk = Math.floor(e.st.atk * FINAL_RAGE);
  log(`💢 Une barre de vie de <b>${esc(ENDGAME[B.final].t)}</b> se brise ! Il entre en rage (${e.barsLeft} restante${e.barsLeft > 1 ? 's' : ''}).`, 'boss');
  if (!quiet()) { const pw = $('#ePw'); if (pw) { pw.classList.remove('rage'); void pw.offsetWidth; pw.classList.add('rage'); } }
}
function finalDown() {
  const i = B.final, b = ENDGAME[i], k = FINAL_TIERS[b.bars], first = i === S.endgame;
  const xp = RARITY[CH[b.id].r].xp * b.lv / 7 * 4, cur = activeMember();
  teamMembers().forEach((m) => gainXp(m, m === cur ? xp : xp * 0.6, false, S.levelCap));
  const gems = first ? k.gems : Math.floor(k.gems / 5);
  S.gems += gems; S.stats.kills++;
  if (first) S.endgame = i + 1;
  log(`🏆 <b>${esc(b.t)}</b> est vaincu ! +${gems} 💎`, 'catch');
  toast(`🏆 <b>${esc(b.t)}</b> vaincu !<br>+${gems} 💎${first && ENDGAME[i + 1] ? `<br>Nouveau défi : <b>${esc(ENDGAME[i + 1].t)}</b>` : ''}`, 'catch');
  B.phase = 'win'; B.timer = 3000;
  checkAch(); refreshSoft();
}
function nextTowerFoe(t) {
  const f = TOWER[t.k];
  makeBattle(f.ids[t.idx], f.lv, false, 'tower', 'tower');
  B.tower = t;
  if (t.idx === f.ids.length - 1) { B.enemy.st.hp = Math.floor(B.enemy.st.hp * TOWER_LEADER_HP / TOWER_HP); B.enemy.hp = B.enemy.st.hp; B.enemy.leader = true; }
}
// kind : null (sauvage), 'hunt' (chasse aux boss), 'sanct' (raid légendaire / mythique) ou 'tower' (Tour)
function makeBattle(id, lvl, shiny, kind, zoneId) {
  const st = calcStats(id, lvl, { shiny });
  if (kind === 'final') { /* stats appliquées par startFinal */ }
  if (kind === 'tower') { st.hp = Math.floor(st.hp * TOWER_HP); st.atk = Math.floor(st.atk * TOWER_ATK); }
  if (kind === 'hunt') { st.hp = Math.floor(st.hp * 2); st.atk = Math.floor(st.atk * 1.1); }
  if (kind === 'sanct') { const k = SANCT[CH[id].r]; st.hp = Math.floor(st.hp * k.hp); st.atk = Math.floor(st.atk * k.atk); }
  S.dex[id] = S.dex[id] || { seen: 0 }; S.dex[id].seen++;
  // parchemins automatiques (pas dans les raids : 20 % fixes)
  let scroll = null;
  const own = S.roster[id];
  if (kind !== 'sanct' && kind !== 'tower' && kind !== 'final' && (!own || (shiny && !own.shiny))) {
    const premium = CH[id].r === 'E' || shiny || kind === 'hunt';
    if (S.autoGold && premium && S.items.gscroll > 0) { S.items.gscroll--; scroll = 'g'; }
    else if (S.autoScroll && S.items.scroll > 0) { S.items.scroll--; scroll = 'n'; }
  }
  const prevActive = B && B.active;
  B = { zone: zoneId, sanct: kind === 'sanct' || kind === 'tower' || kind === 'final', enemy: { id, lvl, shiny, kind, boss: !!kind, st, hp: st.hp, g: 0, cd: {} }, active: prevActive, pg: 0, pcd: {}, phase: 'fight', timer: 0, scroll, redraw: true };
  activeMember();
  const nm = `<b>${CH[id].n}</b>`;
  if (kind === 'final') { /* annoncé par startFinal */ }
  else if (kind === 'tower') log(`🗼 ${nm} (Nv ${lvl}) entre dans l'arène !`, 'boss');
  else if (kind === 'sanct') log(`🏯 ${nm} (${RARITY[CH[id].r].n}, Nv ${lvl}) t'attend dans la zone de raid !`, 'boss');
  else if (kind === 'hunt') log(`👑 Le boss ${nm} (Nv ${lvl}) surgit !`, 'boss');
  else log(`${shiny ? '🌟 ' + nm + ' (éveillé)' : nm} sauvage apparaît ! (Nv ${lvl})`, shiny ? 'catch' : '');
  if (S.team.length) teamMembers().forEach((m) => { m.hp = Math.min(statsOf(m).hp, hpOf(m) + Math.ceil(statsOf(m).hp * 0.12)); });
  renderArena();
}
function chooseMove(id, lvl, cds, defType, evo = 0) {
  let best = null, bv = -1;
  for (const mv of movesOf(id, lvl, evo)) {
    if ((cds[mv.n] || 0) > 0) continue;
    const v = mv.p * typeMult(mv.t, defType) * (mv.t === CH[id].type ? 1.2 : 1);
    if (v > bv) { bv = v; best = mv; }
  }
  return best;
}
function act(isPlayer) {
  const m = activeMember(); const e = B.enemy;
  if (!m) return;
  const A = isPlayer ? { id: m.id, lvl: m.lvl, st: statsOf(m), cds: B.pcd } : { id: e.id, lvl: e.lvl, st: e.st, cds: e.cd };
  const D = isPlayer ? { id: e.id, st: e.st } : { id: m.id, st: statsOf(m) };
  const mv = chooseMove(A.id, A.lvl, A.cds, CH[D.id].type, isPlayer ? m.evo || 0 : 0);
  for (const k in A.cds) if (A.cds[k] > 0) A.cds[k]--;
  A.cds[mv.n] = mv.cd;
  const eff = typeMult(mv.t, CH[D.id].type);
  const stab = mv.t === CH[A.id].type ? 1.2 : 1;
  const crit = Math.random() < 0.07;
  let d = (((2 * A.lvl) / 5 + 2) * mv.p * A.st.atk / D.st.def / 50 + 2) * eff * stab * (crit ? 1.5 : 1) * (0.85 + Math.random() * 0.15);
  d = Math.max(1, Math.floor(d));
  if (isPlayer) e.hp = Math.max(0, e.hp - d); else m.hp = Math.max(0, hpOf(m) - d);
  fx(isPlayer ? 'e' : 'p', d, eff, crit, mv);
  if (mv.sig) log(`💥 <b>${CH[A.id].n}</b> utilise <i>${mv.n}</i> ! (${d})`, 'sig');
  if (isPlayer && e.hp <= 0) { if (e.barsLeft > 1) breakBar(); else enemyDown(); }
  else if (!isPlayer && m.hp <= 0) playerDown(m);
}
function enemyDown() {
  if (B.enemy.kind === 'tower') { towerFoeDown(); return; }
  if (B.enemy.kind === 'final') { finalDown(); return; }
  const e = B.enemy, c = CH[e.id], r = RARITY[c.r];
  const xp = r.xp * e.lvl / 7 * (e.kind === 'hunt' ? 2 : e.kind === 'sanct' ? 4 : 1);
  const gold = Math.floor((5 + e.lvl * 1.5) * (e.kind === 'hunt' ? 3 : e.kind === 'sanct' ? 10 : 1));
  const cur = activeMember(), cap = battleCap();
  teamMembers().forEach((m) => gainXp(m, m === cur ? xp : xp * 0.6, false, cap));
  S.gold += gold; S.stats.goldEarned += gold; S.stats.kills++;
  log(`✅ ${c.n} est vaincu ! +${fmt(gold)} 🪙 +${Math.floor(xp)} XP${cur && cur.lvl >= cap ? ` <small>(XP bloquée au Nv ${cap} dans cette zone)</small>` : ''}`, 'win');
  if (Math.random() < 0.05) { const g = rand(1, 3); S.gems += g; log(`💎 Tu trouves ${g} gemme${g > 1 ? 's' : ''} !`, 'catch'); }
  const chance = e.kind === 'sanct' ? r.catch : r.catch * (B.scroll === 'g' ? 5 : B.scroll === 'n' ? 2 : 1) * (e.shiny ? 2 : 1);
  if (Math.random() < Math.min(1, chance)) {
    const res = recruit(e.id, e.shiny, e.lvl);
    log(res === 'new' ? `🎉 <b>${c.n}</b> accepte de te suivre !` : res === 'awaken' ? `🌟 ${c.n} s'éveille !` : `🧩 ${c.n} te donne des fragments.`, 'catch');
  } else if (e.kind === 'sanct') log(`${c.n} refuse de te suivre… (20 % de chance)`, 'lose');
  if (e.kind === 'hunt') {
    S.stats.bosses++;
    if (Math.random() < TOKEN_DROP) {
      S.tokens[c.s] = (S.tokens[c.s] || 0) + 1; S.stats.tokens++;
      log(`🎟️ <b>Token ${SERIES[c.s]}</b> obtenu ! (${S.tokens[c.s]})`, 'catch');
      toast(`🎟️ Token <b>${SERIES[c.s]}</b> obtenu ! Tu en as ${S.tokens[c.s]}.`, 'catch');
    }
  }
  if (e.kind === 'sanct') S.stats.sanct++;
  const it = EVO_ITEMS[c.s];
  if (it && Math.random() < EVO_DROP[e.kind || 'sub']) {
    const n = e.kind === 'sanct' ? 2 : 1;
    S.evoItems[c.s] = (S.evoItems[c.s] || 0) + n;
    log(`${it.i} <b>${it.n}</b> trouvé${n > 1 ? ' ×' + n : ''} ! (${S.evoItems[c.s]})`, 'catch');
    toast(`${it.i} Objet d'évolution : <b>${it.n}</b> (${S.evoItems[c.s]})`, 'catch');
  }
  B.phase = 'win'; B.timer = e.kind === 'sanct' ? 2500 : 1100;
  refreshSoft();
}
function towerFoeDown() {
  const t = B.tower, f = TOWER[t.k], c = CH[B.enemy.id];
  const xp = RARITY[c.r].xp * f.lv / 7 * 2, cur = activeMember();
  teamMembers().forEach((m) => gainXp(m, m === cur ? xp : xp * 0.6, false, S.levelCap));
  S.stats.kills++;
  log(`✅ ${c.n} est vaincu ! (${t.idx + 1}/${f.ids.length})`, 'win');
  B.phase = 'win';
  if (t.idx < f.ids.length - 1) { B.timer = 900; B.towerNext = { k: t.k, idx: t.idx + 1 }; refreshSoft(); return; }
  // étage vaincu
  S.tower = t.k + 1;
  const old = S.levelCap;
  S.levelCap = Math.max(S.levelCap, f.cap);
  S.gems += f.gems; const gold = f.lv * 60; S.gold += gold; S.stats.goldEarned += gold;
  log(`🏆 Étage ${t.k + 1} conquis : <b>${f.n}</b> ! +${f.gems} 💎 +${fmt(gold)} 🪙`, 'catch');
  toast(`🏆 <b>${f.n}</b> vaincus !${S.levelCap > old ? `<br>🔓 Niveau max : <b>${old} → ${S.levelCap}</b>` : ''}<br>+${f.gems} 💎`, 'catch');
  B.timer = 3000;
  checkAch(); refreshSoft();
}
function playerDown(m) {
  log(`💀 <b>${CH[m.id].n}</b> est K.O. !`, 'lose');
  const next = teamMembers().find((x) => hpOf(x) > 0);
  if (next) { B.active = next.id; B.pcd = {}; B.pg = 0; B.redraw = true; renderArena(); return; }
  log(`😵 Ton équipe est épuisée… repos de 5 secondes.`, 'lose');
  if (B.final != null) toast(`${esc(ENDGAME[B.final].t)} est trop puissant… renforce ton équipe (étoiles, évolutions, types) et retente !`, 'bad');
  else if (B.tower) toast(`Défaite à l'étage ${B.tower.k + 1} (${TOWER[B.tower.k].n}). Entraîne-toi et retente ta chance !`, 'bad');
  else if (B.sanct) toast(`${CH[B.enemy.id].n} t'a vaincu… Les tokens sont perdus, entraîne-toi encore !`, 'bad');
  else if (B.enemy.boss) toast(`Le boss ${CH[B.enemy.id].n} est trop fort… entraîne-toi encore !`, 'bad');
  B.phase = 'recover'; B.timer = 5000;
}
function healAll(r = 1) { teamMembers().forEach((m) => { m.hp = Math.min(statsOf(m).hp, hpOf(m) + Math.ceil(statsOf(m).hp * r)); }); }
function battleTick(dt) {
  if (S.zone && !curZone()) {
    S.zone = null;
    if (!(B && B.sanct)) B = null;
    toast('🔄 Nouvelle rotation ! Choisis une nouvelle zone.', 'info');
    if (tab === 'explore' && !quiet()) renderExplore();
  }
  if (!S.team.length) { if (B) { B = null; renderArena(); } return; }
  if (!(B && B.sanct)) {
    if (!S.zone) { if (B) { B = null; renderArena(); } return; }
    if (!B || B.zone !== S.zone) { spawn(); return; }
  }
  const f = dt * S.speed;
  if (B.phase !== 'fight') {
    B.timer -= f;
    if (B.timer <= 0) {
      if (B.phase === 'recover') healAll(1);
      if (B.phase === 'win' && B.towerNext) { nextTowerFoe(B.towerNext); return; }
      if (B.sanct) { B = null; if (S.zone) spawn(); else renderArena(); if (tab === 'tower' && !quiet()) renderTower(); return; }
      spawn();
    }
    updateArena(); return;
  }
  const m = activeMember();
  if (!m) { B.phase = 'recover'; B.timer = 5000; return; }
  const ps = statsOf(m), es = B.enemy.st, avg = (ps.spd + es.spd) / 2;
  B.pg += 8 * (f / 100) * ps.spd / avg;
  B.enemy.g += 8 * (f / 100) * es.spd / avg;
  let guard = 0;
  while (B.phase === 'fight' && (B.pg >= 100 || B.enemy.g >= 100) && guard++ < 6) {
    if (B.pg >= B.enemy.g) { B.pg -= 100; act(true); } else { B.enemy.g -= 100; act(false); }
  }
  if (B.redraw) renderArena(); else updateArena();
}

// ---------- Boucle ----------
// Le jeu tourne aussi quand l'onglet est caché : une horloge dans un Web Worker (peu ralentie par le
// navigateur) appelle tick(), et si le navigateur a quand même mis la page en pause, le temps écoulé est
// rejoué combat par combat (jusqu'à 10 min ; au-delà, estimation comme pour le hors-ligne).
const CATCHUP_MAX = 10 * 60 * 1000;
let SIM = false;                   // rattrapage en cours : aucun rendu
const quiet = () => SIM || document.hidden;
function tick() {
  const now = Date.now();
  let dt = now - lastTick; lastTick = now;
  if (dt <= 0) return;
  if (dt > CATCHUP_MAX) { offline(dt, !document.hidden); return; }
  if (dt <= 150) { step(dt); return; }
  const wasSim = SIM;
  SIM = true;
  try { while (dt > 0) { const d = Math.min(100, dt); step(d); dt -= d; } } finally { SIM = wasSim; }
  save();
  if (!quiet()) renderTab();
}
function step(dt) {
  accDojo += dt; accSave += dt; accAch += dt;
  if (accDojo >= 1000) { dojoTick(accDojo / 1000); accDojo = 0; }
  if (S.started) battleTick(dt);
  if (accAch >= 2000) { checkAch(); accAch = 0; if (!quiet()) { renderTop(); const rt = $('#rotTimer'); if (rt) rt.textContent = rotLeft(); } }
  if (accSave >= 5000 && !SIM) { save(); accSave = 0; }
}
// le dojo entraîne jusqu'au niveau du meilleur membre de l'équipe
const dojoRate = () => (2 + teamMax() * 0.5) * (1 + (S.dojo.lvl - 1) * 0.25);
const dojoCap = () => teamMax();
function dojoTick(sec) {
  S.dojo.slots = S.dojo.slots.filter((id) => S.roster[id] && !S.team.includes(id));
  S.dojo.slots.forEach((id) => gainXp(S.roster[id], dojoRate() * sec, true, dojoCap()));
  if (tab === 'dojo' && !quiet()) updateDojo();
}
function offline(ms, modal) {
  const sec = Math.min(ms / 1000, 12 * 3600);
  if (sec < 60) return;
  const lvBefore = {}; Object.values(S.roster).forEach((m) => (lvBefore[m.id] = m.lvl));
  dojoTick(sec);
  let kills = 0, gold = 0;
  const z = curZone();
  if (z && S.team.length) {
    const avgTeam = teamMembers().reduce((s, m) => s + m.lvl, 0) / S.team.length;
    const zl = (z.lv[0] + z.lv[1]) / 2;
    const eff = Math.max(0.1, Math.min(1, avgTeam / zl));      // une équipe trop faible gagne moins
    kills = Math.floor(sec / 10 * eff);
    gold = Math.floor(kills * (5 + zl * 1.5));
    const xp = kills * 50 * zl / 7;
    teamMembers().forEach((m) => gainXp(m, xp * 0.7, true, xpCap(z)));
    S.gold += gold; S.stats.goldEarned += gold; S.stats.kills += kills;
  }
  const ups = Object.values(S.roster).filter((m) => m.lvl > lvBefore[m.id]).map((m) => `<li>${CH[m.id].n} : Nv ${lvBefore[m.id]} → <b>${m.lvl}</b></li>`).join('');
  const t = sec >= 3600 ? `${Math.floor(sec / 3600)} h ${Math.floor((sec % 3600) / 60)} min` : `${Math.floor(sec / 60)} min`;
  const html = `<h2>Pendant ton absence (${t})</h2>
    <p>Ton clan a continué de s'entraîner !</p>
    <div class="offline-grid"><div>⚔️ <b>${fmt(kills)}</b> combats gagnés</div><div>🪙 <b>+${fmt(gold)}</b> pièces</div></div>
    ${ups ? `<ul class="ups">${ups}</ul>` : ''}
    <button class="btn primary" data-act="closeModal">Continuer</button>`;
  if (modal) openModal(html); else if (kills || ups) toast(`De retour ! +${fmt(gold)} 🪙, ${fmt(kills)} combats`, 'good');
}

// ---------- Succès ----------
function checkAch() {
  for (const a of ACHIEVEMENTS) {
    if (!S.ach[a.id] && a.t(S)) {
      S.ach[a.id] = Date.now(); S.gems += a.g;
      toast(`🏆 Succès : <b>${a.n}</b> (+${a.g} 💎)`, 'catch');
    }
  }
}

// ---------- Interface : utilitaires ----------
function toast(html, kind = 'info') {
  if (quiet()) return;             // résumé affiché au retour sur l'onglet
  const el = document.createElement('div');
  el.className = `toast ${kind}`; el.innerHTML = html;
  $('#toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 3600);
  setTimeout(() => el.remove(), 4100);
}
function log(html, cls = '') {
  LOG.unshift({ html, cls });
  if (LOG.length > 40) LOG.pop();
  const el = !quiet() && $('#log');
  if (el) {
    const d = document.createElement('div'); d.className = 'l ' + cls; d.innerHTML = html;
    el.prepend(d);
    while (el.children.length > 40) el.lastChild.remove();
  }
}
function openModal(html, cls = '') {
  $('#modal').className = 'modal show ' + cls;
  $('#modalBody').innerHTML = html;
}
function closeModal() { $('#modal').className = 'modal'; }
function typeBadge(t) { return `<span class="tb" style="--t:${TYPES[t].c}">${TYPES[t].i} ${t}</span>`; }
function rarBadge(r) { return `<span class="rb" style="--r:${RARITY[r].c}">${RARITY[r].n}</span>`; }
function stars(n) { return n ? `<span class="stars">${'★'.repeat(n)}</span>` : ''; }
function portrait(id, cls = '', opt = {}) {
  const c = CH[id];
  const size = /big|huge/.test(cls) ? 'large' : 'medium';
  const ini = c.n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2);
  return `<div class="portrait ${cls} ${opt.flip ? 'flip' : ''}" style="--t:${TYPES[c.type].c};--r:${RARITY[c.r].c}" data-ini="${esc(ini)}"><img src="${IMG_BASE}${size}/${c.img}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="imgFail(this)"></div>`;
}
function imgFail(img) { const p = img.parentElement; img.remove(); if (p) p.classList.add('noimg'); }
const seriesChars = {};
CHARS.forEach((c) => (seriesChars[c.s] = seriesChars[c.s] || []).push(c.id));
const seriesOwned = (s) => (seriesChars[s] || []).filter((id) => S.roster[id]).length;
function charCard(id, extra = '') {
  const c = CH[id], m = S.roster[id], seen = S.dex[id];
  if (!m) {
    return `<div class="ccard ${seen ? 'seen' : 'unknown'}" data-act="detail" data-arg="${id}">
      ${portrait(id, seen ? 'gray' : 'sil')}<div class="cname">${seen ? c.n : '???'}</div><div class="cmeta">${seen ? typeBadge(c.type) : '&nbsp;'}</div></div>`;
  }
  const inTeam = S.team.includes(id), inDojo = S.dojo.slots.includes(id);
  return `<div class="ccard r-${c.r} ${m.shiny ? 'shiny' : ''}" data-act="detail" data-arg="${id}">
    ${inTeam ? '<span class="tag team">Équipe</span>' : inDojo ? '<span class="tag dojo">Dojo</span>' : ''}
    ${portrait(id, evoCls(m))}
    <div class="cname">${cname(id, m)} ${stars(m.stars)}</div>
    <div class="cmeta"><span class="lv">Nv ${m.lvl}</span> ${TYPES[c.type].i}</div>${extra}</div>`;
}

// ---------- Personnages d'une zone (clic droit / appui long) ----------
function openZoneInfo(zid) {
  const z = zoneById(zid);
  if (!z) return;
  const ids = z.pool.map((p) => p[0]).sort((a, b) => RAR_ORDER[CH[a].r] - RAR_ORDER[CH[b].r] || CH[a].power - CH[b].power);
  const own = ids.filter((id) => S.roster[id]).length, seen = ids.filter((id) => S.dex[id] && !S.roster[id]).length;
  const title = z.kind === 'hunt' ? 'Chasse : ' + SERIES[z.u] : z.n;
  openModal(`<h2>${z.kind === 'hunt' ? '👑' : z.i} ${esc(title)}</h2>
    <p class="series">${esc(SERIES[z.u])}${z.kind === 'hunt' ? ' · boss rares et épiques' : ' · ' + TIERS[z.k].n} · Nv ${z.lv[0]}–${z.lv[1]} · XP jusqu'au Nv ${xpCap(z)}</p>
    <div class="zlegend"><span>${EVO_ITEMS[z.u].i} ${esc(EVO_ITEMS[z.u].n)} : ${Math.round(EVO_DROP[z.kind === 'hunt' ? 'hunt' : 'sub'] * 1000) / 10} % par victoire</span><span>🎴 <b>${own}</b> recrutés</span><span>👁️ <b>${seen}</b> vus</span><span>❓ <b>${ids.length - own - seen}</b> jamais vus</span><span>${ids.length} au total</span></div>
    <div class="grid">${ids.map((id) => charCard(id, S.roster[id] || S.dex[id] ? `<div class="cmeta">${rarBadge(CH[id].r)}</div>` : '')).join('')}</div>`, 'wide');
}

// ---------- Rendu : barre du haut ----------
function renderTop() {
  $('#gold').textContent = fmt(S.gold);
  $('#gems').textContent = fmt(S.gems);
  $('#ownedTop').textContent = `${ownedCount()}/${CHARS.length}`;
  $('#tokTop').textContent = Object.values(S.tokens).reduce((a, b) => a + b, 0);
  $('#capTop').textContent = S.levelCap;
  document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('on', b.dataset.arg === tab));
}
function setTab(t) {
  tab = t; renderTop();
  document.querySelectorAll('.page').forEach((p) => p.classList.toggle('show', p.id === 'page-' + t));
  renderTab();
}
function renderTab() {
  ({ explore: renderExplore, team: renderTeam, collection: renderCollection, shop: renderShop, summon: renderSummon, dojo: renderDojo, boss: renderBoss, tower: renderTower, ach: renderAch, options: renderOptions }[tab])();
}
function refreshSoft() {
  if (quiet()) return;
  renderTop();
  if (tab === 'explore') renderZones();
}
function refreshView() {
  renderTop();
  if (tab === 'explore') renderExplore();
  else if (tab !== 'shop' && tab !== 'summon' && tab !== 'options') renderTab();
}

// ---------- Rendu : exploration ----------
function renderExplore() { renderZones(); renderArena(); }
function renderZones() {
  const a = activeZones();
  const card = (z) => {
    const hunt = z.kind === 'hunt', tok = S.tokens[z.u] || 0;
    return `<div class="zone ${S.zone === z.id ? 'on' : ''} ${z.kind}" data-act="zone" data-arg="${z.id}" style="--z1:${z.bg[0]};--z2:${z.bg[1]}">
      <span class="zi">${hunt ? '👑' : z.i}</span>
      <div class="zt"><b>${hunt ? 'Chasse : ' + esc(SERIES[z.u]) : esc(z.n)}</b>
        <small>${hunt ? `🎟️ ${tok} token${tok > 1 ? 's' : ''} · boss rares/épiques` : `${esc(SERIES[z.u])} · ${TIERS[z.k].n} · 🎴 ${z.pool.filter((p) => S.roster[p[0]]).length}/${z.pool.length}`}</small>
        <small>Nv ${z.lv[0]}–${z.lv[1]} · XP jusqu'au Nv ${xpCap(z)}</small></div></div>`;
  };
  $('#zoneList').innerHTML = `<div class="zhead">🔄 Rotation <small>change dans <b id="rotTimer">${rotLeft()}</b></small></div>
    <p class="zhint">Clic droit (ou appui long) sur une zone : voir ses personnages</p>
    ${a.subs.map(card).join('')}
    <div class="zhead">👑 Chasses aux boss <small>1 chance sur 50 : token</small></div>
    ${a.hunts.map(card).join('')}
    <button class="btn sanctbtn" data-act="tab" data-arg="boss">⚔️ Raids légendaires et mythiques</button>`;
}
function renderArena() {
  const el = $('#battle');
  if (!el || quiet()) return;
  if (B) B.redraw = false;
  if (!S.team.length) {
    el.innerHTML = `<div class="empty"><h2>Ton équipe est vide</h2><p>Ajoute des personnages depuis l'onglet <b>Équipe</b>.</p><button class="btn primary" data-act="tab" data-arg="team">Gérer l'équipe</button></div>`;
    return;
  }
  const z = B && B.final != null ? { n: `Boss de fin de jeu : ${ENDGAME[B.final].t}`, i: '☠️', bg: ENDGAME[B.final].bg, u: CH[B.enemy.id].s }
    : B && B.tower ? { n: `Tour — Étage ${B.tower.k + 1} : ${TOWER[B.tower.k].n} (${B.tower.idx + 1}/${TOWER[B.tower.k].ids.length})`, i: '🗼', bg: TOWER[B.tower.k].bg, u: CH[B.enemy.id].s }
    : B && B.sanct ? { n: 'Raid : ' + CH[B.enemy.id].n, i: '⚔️', bg: ['#3a0a1a', '#ff3b7a'], u: CH[B.enemy.id].s } : curZone();
  if (!z || !B) {
    el.innerHTML = `<div class="empty"><div class="big-emoji">🗺️</div><h2>Choisis une zone à explorer</h2>
      <p>Toutes les 12 heures, 5 sous-univers venant de 5 univers différents sont ouverts, du niveau débutant au niveau maître. Ton équipe combat automatiquement.</p>
      <p>Attention : dans une zone, tes personnages arrêtent de gagner de l'XP à partir de 10 niveaux au-dessus du niveau maximum de la zone.</p></div>`;
    return;
  }
  const e = B.enemy, ec = CH[e.id], m = activeMember();
  const pc = m ? CH[m.id] : null, cap = battleCap();
  el.innerHTML = `
  <div class="arena" style="--z1:${z.bg[0]};--z2:${z.bg[1]}">
    <div class="ahead"><span>${z.i} ${esc(z.n)} <small class="useries">${esc(SERIES[z.u])}${B.sanct ? '' : ` · XP jusqu'au Nv ${cap}`}</small></span>
      <span class="spd">${[1, 2, 3].map((s) => `<button class="${S.speed === s ? 'on' : ''}" data-act="speed" data-arg="${s}">×${s}</button>`).join('')}</span></div>
    <div class="fighters">
      <div class="fcard pl">
        ${m ? `<div class="fh"><b>${cname(m.id, m)}</b>${stars(m.stars)} <span class="lv">Nv ${m.lvl}</span></div>
        <div class="fh2">${typeBadge(pc.type)}</div>
        <div class="pw ${m.shiny ? 'shiny' : ''}" id="pPw">${portrait(m.id, 'big' + evoCls(m), { flip: true })}</div>
        <div class="bar hp"><i id="pHp"></i><span id="pHpT"></span></div>
        <div class="bar gauge"><i id="pG"></i></div>
        <div class="xpline"><div class="bar xp"><i id="pXp"></i></div></div>` : ''}
      </div>
      <div class="vs">VS</div>
      <div class="fcard en ${e.boss ? 'boss' : ''}">
        <div class="fh"><b>${e.shiny ? '🌟 ' : ''}${ec.n}</b> <span class="lv">Nv ${e.lvl}</span></div>
        <div class="fh2">${typeBadge(ec.type)} ${rarBadge(ec.r)} ${e.kind === 'hunt' ? '<span class="rb" style="--r:#ff3b5c">BOSS</span>' : e.kind === 'sanct' ? '<span class="rb" style="--r:#ff3b7a">RAID · 20 %</span>' : e.kind === 'tower' ? `<span class="rb" style="--r:#c0c8d8">${e.leader ? 'CHEF · ' : ''}TOUR · non recrutable</span>` : e.kind === 'final' ? `<span class="rb" style="--r:#ff3b5c">BOSS FINAL${FINAL_TIERS[e.bars] ? ' · ' + FINAL_TIERS[e.bars].n : ''}</span>` : ''} ${e.kind === 'tower' || e.kind === 'final' ? '' : S.roster[e.id] ? '<span class="owned" title="Déjà recruté">✔</span>' : '<span class="owned new" title="Pas encore recruté">NEW</span>'}</div>
        <div class="pw ${e.shiny ? 'shiny' : ''}" id="ePw">${portrait(e.id, 'big')}</div>
        ${e.bars ? '<div class="hpbars" id="eBars"></div>' : ''}
        <div class="bar hp ${e.bars ? 'multi' : ''}"><i id="eHp"></i><span id="eHpT"></span></div>
        <div class="bar gauge"><i id="eG"></i></div>
        <div class="scrollinfo">${B.scroll === 'g' ? '🏮 Parchemin doré actif (×5)' : B.scroll === 'n' ? '📜 Parchemin actif (×2)' : ''}</div>
      </div>
    </div>
    <div id="phaseMsg" class="phase"></div>
    <div class="actions">
      <button class="btn" data-act="ramen">🍜 Ramen <small>(${S.items.ramen})</small></button>
      <label class="tog"><input type="checkbox" data-act="autoScroll" ${S.autoScroll ? 'checked' : ''}> 📜 auto <small>(${S.items.scroll})</small></label>
      <label class="tog"><input type="checkbox" data-act="autoGold" ${S.autoGold ? 'checked' : ''}> 🏮 auto <small>(${S.items.gscroll})</small></label>
      ${B.sanct ? '<button class="btn ghost" data-act="giveup">🏳️ Abandonner</button>' : '<button class="btn ghost" data-act="retreat">🏳️ Retraite</button>'}
    </div>
    <div class="bench" id="bench">${teamMembers().map((x) => `
      <div class="bm ${m && x.id === m.id ? 'on' : ''} ${hpOf(x) <= 0 ? 'ko' : ''}" data-act="switch" data-arg="${x.id}" title="Faire entrer ${CH[x.id].n}">
        ${portrait(x.id, 'small')}<div class="bmi"><b>${CH[x.id].n}</b><small>Nv ${x.lvl}${x.lvl >= cap ? (x.lvl >= S.levelCap ? ' <span class="xpmax" title="Niveau max bloqué par la Tour">🔒 Nv max</span>' : ' <span class="xpmax" title="Ce personnage ne gagne plus d’XP dans cette zone">XP max</span>') : ''}</small><div class="bar hp mini"><i id="bh-${x.id}"></i></div></div></div>`).join('')}
    </div>
  </div>
  <div class="log" id="log">${LOG.map((l) => `<div class="l ${l.cls}">${l.html}</div>`).join('')}</div>`;
  updateArena();
}
function setBar(id, pct, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.width = Math.max(0, Math.min(100, pct)) + '%';
  if (cls) el.parentElement.className = 'bar hp ' + (el.parentElement.classList.contains('mini') ? 'mini ' : '') + (pct < 25 ? 'low' : pct < 55 ? 'mid' : '');
}
function updateArena() {
  if (quiet() || tab !== 'explore' || !B || !$('#eHp')) return;
  const e = B.enemy, m = activeMember();
  setBar('eHp', (e.hp / e.st.hp) * 100, true);
  $('#eHpT').textContent = `${fmt(e.hp)} / ${fmt(e.st.hp)}`;
  const eb = $('#eBars');
  if (eb) {
    eb.innerHTML = Array.from({ length: e.bars }, (_, i) => `<i class="${i < e.barsLeft ? 'on' : ''}"></i>`).join('') + `<b>×${e.barsLeft}</b>`;
    $('#eHp').parentElement.dataset.left = e.barsLeft;
  }
  setBar('eG', e.g);
  if (m) {
    const st = statsOf(m);
    setBar('pHp', (hpOf(m) / st.hp) * 100, true);
    $('#pHpT').textContent = `${fmt(m.hp)} / ${fmt(st.hp)}`;
    setBar('pG', B.pg);
    setBar('pXp', m.lvl >= MAX_LVL ? 100 : (m.xp / xpNeed(m.lvl)) * 100);
  }
  teamMembers().forEach((x) => setBar('bh-' + x.id, (hpOf(x) / statsOf(x).hp) * 100, true));
  document.querySelectorAll('.bm').forEach((b) => b.classList.toggle('ko', hpOf(S.roster[b.dataset.arg]) <= 0));
  const ph = $('#phaseMsg');
  ph.textContent = B.phase === 'recover' ? `😵 Récupération… ${Math.ceil(B.timer / 1000)}s` : B.phase === 'win' ? '✨ Victoire !' : '';
  ph.className = 'phase ' + B.phase;
}
function fx(side, dmg, eff, crit, mv) {
  if (quiet() || tab !== 'explore') return;
  const target = document.getElementById(side === 'e' ? 'ePw' : 'pPw');
  const src = document.getElementById(side === 'e' ? 'pPw' : 'ePw');
  if (!target) return;
  target.classList.remove('hit'); void target.offsetWidth; target.classList.add('hit');
  if (src) { src.classList.remove('lunge', 'lunge-r'); void src.offsetWidth; src.classList.add(side === 'e' ? 'lunge' : 'lunge-r'); }
  const n = document.createElement('div');
  n.className = 'dmg' + (crit ? ' crit' : '') + (eff > 1 ? ' super' : eff < 1 ? ' weak' : '');
  n.style.setProperty('--t', TYPES[mv.t].c);
  n.innerHTML = `${mv.sig ? `<small>${esc(mv.n)}</small>` : ''}${TYPES[mv.t].i} ${dmg}${crit ? '!' : ''}${eff > 1 ? '<small>Super efficace</small>' : eff < 1 ? '<small>Peu efficace</small>' : ''}`;
  n.style.left = 30 + Math.random() * 40 + '%';
  target.appendChild(n);
  setTimeout(() => n.remove(), 1000);
}

// ---------- Filtres de listes (équipe, encyclopédie, dojo) ----------
const FILTER_DEFAULTS = {
  team: { q: '', u: 'all', sort: 'lvl', limit: 120 },
  collection: { q: '', u: 'naruto', sort: 'rank', own: 'all', limit: 120 },
  dojo: { q: '', u: 'all', sort: 'lvl', limit: 60 },
};
const FILTERS = JSON.parse(JSON.stringify(FILTER_DEFAULTS));
const SORTS = [['lvl', 'Niveau'], ['rar', 'Rareté'], ['rank', 'Popularité'], ['type', 'Type'], ['name', 'Nom']];
const norm = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function filterBar(key) {
  const f = FILTERS[key];
  return `<div class="filters" data-fkey="${key}">
    <input type="search" placeholder="🔎 Rechercher un personnage…" value="${esc(f.q)}" data-filter="q">
    ${key === 'collection' ? '' : `<select data-filter="u"><option value="all">Tous les univers</option>${UNIVERSES.map((u) => `<option value="${u.id}" ${f.u === u.id ? 'selected' : ''}>${u.i} ${esc(u.n)}</option>`).join('')}</select>`}
    <select data-filter="sort">${SORTS.map(([k, l]) => `<option value="${k}" ${f.sort === k ? 'selected' : ''}>Tri : ${l}</option>`).join('')}</select>
    ${key === 'collection' ? `<select data-filter="own">${[['all', 'Tous'], ['own', 'Recrutés'], ['miss', 'Manquants']].map(([k, l]) => `<option value="${k}" ${f.own === k ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}
  </div>`;
}
function filterIds(key, ids) {
  const f = FILTERS[key], q = norm(f.q.trim());
  const ro = RAR_ORDER;
  const out = ids.filter((id) => {
    const c = CH[id];
    if (f.u !== 'all' && c.s !== f.u && !q) return false;
    if (f.own === 'own' && !S.roster[id]) return false;
    if (f.own === 'miss' && S.roster[id]) return false;
    if (q && !(norm(c.n).includes(q) && (key !== 'collection' || S.dex[id] || S.roster[id]))) return false;
    return true;
  });
  const lv = (id) => (S.roster[id] ? S.roster[id].lvl : -1);
  const cmp = {
    lvl: (a, b) => lv(b) - lv(a) || CH[b].fav - CH[a].fav,
    rar: (a, b) => ro[CH[a].r] - ro[CH[b].r] || lv(b) - lv(a),
    rank: (a, b) => CH[b].fav - CH[a].fav,
    type: (a, b) => CH[a].type.localeCompare(CH[b].type) || lv(b) - lv(a),
    name: (a, b) => CH[a].n.localeCompare(CH[b].n),
  }[f.sort];
  return out.sort(cmp);
}
function fillList(key) {
  const el = document.getElementById('list-' + key);
  if (!el) return;
  let ids, card = (id) => charCard(id);
  if (key === 'team') ids = Object.keys(S.roster);
  if (key === 'collection') ids = CHARS.map((c) => c.id);
  if (key === 'dojo') {
    ids = Object.keys(S.roster).filter((id) => !S.team.includes(id) && !S.dojo.slots.includes(id) && S.roster[id].lvl < MAX_LVL);
    card = (id) => `<div class="pick" data-act="todojo" data-arg="${id}">${charCard(id).replace('data-act="detail"', '')}</div>`;
  }
  ids = filterIds(key, ids);
  const f = FILTERS[key];
  el.innerHTML = ids.length
    ? `<div class="grid">${ids.slice(0, f.limit).map(card).join('')}</div>
       ${ids.length > f.limit ? `<button class="btn more" data-act="more" data-arg="${key}">Afficher plus (${ids.length - f.limit} restants)</button>` : ''}`
    : '<p class="muted">Aucun personnage ne correspond.</p>';
}

// ---------- Rendu : équipe ----------
function renderTeam() {
  const slots = [];
  for (let i = 0; i < TEAM_SIZE; i++) {
    const id = S.team[i];
    slots.push(id ? `<div class="slot filled">${charCard(id)}
      <div class="slotbtns"><button data-act="move" data-arg="${i}:-1" ${i === 0 ? 'disabled' : ''}>◀</button><button data-act="unteam" data-arg="${id}">✕</button><button data-act="move" data-arg="${i}:1" ${i === S.team.length - 1 ? 'disabled' : ''}>▶</button></div></div>`
      : `<div class="slot empty">Emplacement libre</div>`);
  }
  $('#page-team').innerHTML = `
    <h1>Équipe <small>${S.team.length}/${TEAM_SIZE}</small></h1>
    <p class="hint">Le premier personnage entre en combat en premier. Tous les membres gagnent de l'XP (100% pour le combattant actif, 60% pour les autres). Clique sur un personnage pour le gérer.</p>
    <div class="teamslots">${slots.join('')}</div>
    <div class="rowhead"><h2>Ton clan <small>${ownedCount()} personnages</small></h2></div>
    ${filterBar('team')}
    <div id="list-team"></div>`;
  fillList('team');
}

// ---------- Rendu : encyclopédie ----------
function renderCollection() {
  const f = FILTERS.collection;
  $('#page-collection').innerHTML = `<h1>Encyclopédie <small>${ownedCount()}/${CHARS.length} recrutés</small></h1>
    <div class="typechart"><b>Efficacités :</b> ${Object.keys(STRONG).map((t) => `<span>${TYPES[t].i} ${t} ➜ ${STRONG[t].map((x) => TYPES[x].i).join(' ')}</span>`).join('')}</div>
    <div class="uchips">${UNIVERSES.map((u) => {
      const o = seriesOwned(u.id), t = seriesChars[u.id].length;
      return `<button class="uchip ${f.u === u.id ? 'on' : ''} ${o === t ? 'done' : ''}" data-act="setU" data-arg="${u.id}" style="--z1:${u.bg[0]};--z2:${u.bg[1]}">${u.i} ${esc(u.n)} <small>${o}/${t}</small></button>`;
    }).join('')}</div>
    ${filterBar('collection')}
    <div id="list-collection"></div>`;
  fillList('collection');
}
function whereFound(id) {
  const c = CH[id], out = [], act = activeZones();
  if (c.sub) {
    const z = SUBZONES[c.sub];
    out.push(`${z.i} ${esc(SERIES[c.s])} — ${esc(z.n)} (${TIERS[z.k].n}, Nv ${z.lv[0]}–${z.lv[1]})${act.subs.some((x) => x.id === z.id) ? ' · <b>en rotation en ce moment !</b>' : ''}`);
  }
  if (c.r === 'R' || c.r === 'E') out.push(`👑 Chasse aux boss de ${esc(SERIES[c.s])}${act.hunts.some((h) => h.u === c.s) ? ' · <b>disponible en ce moment !</b>' : ''}`);
  if (c.r === 'L' || c.r === 'M') out.push(`⚔️ Raid ${RARITY[c.r].n.toLowerCase()} : ${SANCT[c.r].cost} token${SANCT[c.r].cost > 1 ? 's' : ''} ${esc(SERIES[c.s])} par combat, 20 % de chance de recrutement`);
  else out.push('🎴 Invocation');
  return out;
}
function openDetail(id) {
  const c = CH[id], m = S.roster[id], seen = S.dex[id];
  if (!m) {
    openModal(`<div class="detail">
      <div class="dleft">${portrait(id, 'huge ' + (seen ? 'gray' : 'sil'))}</div>
      <div class="dright"><h2>${seen ? c.n : '???'}</h2>
      ${seen ? `<div class="badges">${typeBadge(c.type)} ${rarBadge(c.r)} ${c.evos ? `<span class="rb" style="--r:#6ad0ff">✦ ${c.evos.length} évolution${c.evos.length > 1 ? 's' : ''}</span>` : ''}</div><p class="series">${SERIES[c.s]} · ❤️ ${fmt(c.fav)}</p>` : `<p>Personnage de <b>${SERIES[c.s]}</b> jamais rencontré.</p>`}
      <h3>Où le trouver</h3><ul>${whereFound(id).map((w) => `<li>${seen ? w : '???'}</li>`).join('')}</ul>
      <button class="btn" data-act="closeModal">Fermer</button></div></div>`);
    return;
  }
  const st = statsOf(m), inTeam = S.team.includes(id), inDojo = S.dojo.slots.includes(id);
  const fr = S.frags[id] || 0, cost = starCost(m);
  const statRow = (k, l, v, base) => `<div class="srow"><span>${l}</span><div class="sbar"><i style="width:${Math.min(100, (base / 115) * 100)}%"></i></div><b>${fmt(v)}</b></div>`;
  openModal(`<div class="detail">
    <div class="dleft ${m.shiny ? 'shiny' : ''}">${portrait(id, 'huge' + evoCls(m))}
      <div class="stars big">${'★'.repeat(m.stars)}<span class="off">${'★'.repeat(5 - m.stars)}</span></div>
    </div>
    <div class="dright">
      <h2>${m.shiny ? '🌟 ' : ''}${cname(id, m)} <span class="lv">Nv ${m.lvl}</span></h2>
      <div class="badges">${typeBadge(c.type)} ${rarBadge(c.r)} ${m.shiny ? '<span class="rb" style="--r:#ffd23f">Éveillé</span>' : ''}</div>
      <p class="series">${SERIES[c.s]}${c.sub ? ' · ' + esc(SUBZONES[c.sub].n) : ''} · ❤️ ${fmt(c.fav)} fans</p>
      <div class="bar xp"><i style="width:${m.lvl >= MAX_LVL ? 100 : (m.xp / xpNeed(m.lvl)) * 100}%"></i></div>
      <small class="muted">${m.lvl >= MAX_LVL ? 'Niveau max' : m.lvl >= S.levelCap ? `🔒 Niveau max actuel (${S.levelCap}) : bats l'étage suivant de la Tour pour le relever` : `${fmt(m.xp)} / ${fmt(xpNeed(m.lvl))} XP`}</small>
      <div class="stats">${statRow('hp', 'PV', st.hp, c.b[0])}${statRow('atk', 'ATQ', st.atk, c.b[1])}${statRow('def', 'DÉF', st.def, c.b[2])}${statRow('spd', 'VIT', st.spd, c.b[3])}</div>
      <h3>Techniques</h3>
      <div class="moves">${allMovesOf(id, m.evo || 0).map((mv) => `<div class="mv ${mv.at > m.lvl ? 'locked' : ''} ${mv.sig ? 'sig' : ''}" style="--t:${TYPES[mv.t].c}">
        <b>${TYPES[mv.t].i} ${mv.n}</b><small>Puiss. ${mv.p} · recharge ${mv.cd} ${mv.at > m.lvl ? `· 🔒 Nv ${mv.at}` : ''}</small></div>`).join('')}</div>
      ${evoSection(id, m)}
      <h3>Fragments : ${fr} ${m.stars < 5 ? `/ ${cost}` : ''}</h3>
      <div class="dbtns">
        ${inTeam ? `<button class="btn" data-act="unteam" data-arg="${id}">Retirer de l'équipe</button>` : `<button class="btn primary" data-act="toteam" data-arg="${id}" ${S.team.length >= TEAM_SIZE ? 'disabled' : ''}>Ajouter à l'équipe</button>`}
        ${!inTeam ? (inDojo ? `<button class="btn" data-act="undojo" data-arg="${id}">Sortir du dojo</button>` : `<button class="btn" data-act="todojo" data-arg="${id}" ${S.dojo.slots.length >= S.dojo.lvl ? 'disabled' : ''}>🥋 Envoyer au dojo</button>`) : ''}
        <button class="btn" data-act="star" data-arg="${id}" ${m.stars >= 5 || fr < cost ? 'disabled' : ''}>⭐ Monter d'une étoile</button>
        <button class="btn" data-act="use" data-arg="book:${id}" ${!S.items.book || m.lvl >= S.levelCap ? 'disabled' : ''}>📘 Manuel (${S.items.book})</button>
        <button class="btn" data-act="use" data-arg="sbook:${id}" ${!S.items.sbook || m.lvl >= S.levelCap ? 'disabled' : ''}>📕 Grimoire (${S.items.sbook})</button>
        ${!m.shiny ? `<button class="btn gold" data-act="use" data-arg="orb:${id}" ${!S.items.orb ? 'disabled' : ''}>🔮 Éveiller (${S.items.orb})</button>` : ''}
      </div>
    </div></div>`);
}

function evoSection(id, m) {
  const c = CH[id];
  if (!c.evos) return '';
  const it = EVO_ITEMS[c.s], have = S.evoItems[c.s] || 0, cur = m.evo || 0, next = c.evos[cur];
  return `<h3>✦ Évolutions <small>${it.i} ${esc(it.n)} : ${have}</small></h3>
    <div class="evos">${['Forme de base', ...c.evos.map((e) => e.n)].map((n, i) => `<span class="evostep ${i === cur ? 'on' : i < cur ? 'done' : ''}">${esc(n)}</span>`).join('<i>➜</i>')}</div>
    ${next ? `<button class="btn evo-btn" data-act="evolve" data-arg="${id}" ${have < next.cost || m.lvl < next.lvl ? 'disabled' : ''}>
      ✦ Évoluer en ${esc(next.n)} — ${next.cost} ${it.i} · Nv ${next.lvl}${m.lvl < next.lvl ? ' requis' : ''}</button>
      <small class="muted">+${Math.round(EVO_BONUS * 100)} % de stats, nouvelle technique : ${esc(next.sig)}. L'objet se trouve en combat dans les zones ${esc(SERIES[c.s])} (plus souvent en chasse, garanti en raid).</small>`
    : '<p class="muted">Forme finale atteinte !</p>'}`;
}

// ---------- Rendu : boutique ----------
function renderShop() {
  $('#page-shop').innerHTML = `<h1>Boutique d'Ichiraku</h1>
    <div class="shop">${SHOP.map((it) => {
      const p = priceOf(it), cur = it.gems ? '💎' : '🪙', have = it.gems ? S.gems : S.gold;
      return `<div class="item"><div class="ii">${it.i}</div><div class="it"><b>${it.n}</b><small>${it.d}</small><span class="own">Possédé : ${S.items[it.id] || 0}</span></div>
      <div class="ib"><button class="btn primary" data-act="buy" data-arg="${it.id}:1" ${have < p ? 'disabled' : ''}>${fmt(p)} ${cur}</button>
      <button class="btn" data-act="buy" data-arg="${it.id}:10" ${have < p * 10 ? 'disabled' : ''}>×10</button></div></div>`;
    }).join('')}
    <div class="item"><div class="ii">💱</div><div class="it"><b>Change</b><small>Convertis 1 000 pièces en 10 gemmes.</small></div>
      <div class="ib"><button class="btn primary" data-act="exchange" ${S.gold < 1000 ? 'disabled' : ''}>1 000 🪙</button></div></div>
    </div>`;
}
function buy(id, n) {
  const it = SHOP.find((x) => x.id === id), cost = priceOf(it) * n;
  if (it.gems ? S.gems < cost : S.gold < cost) return;
  if (it.gems) S.gems -= cost; else S.gold -= cost;
  if (id === 'fragbox') {
    const ids = Object.keys(S.roster);
    if (!ids.length) { S.gems += cost; return; }
    const got = {};
    for (let i = 0; i < n; i++) { const t = ids[rand(0, ids.length - 1)]; S.frags[t] = (S.frags[t] || 0) + 30; got[t] = (got[t] || 0) + 30; }
    toast('🧩 ' + Object.entries(got).map(([t, v]) => `${CH[t].n} +${v}`).join(', '), 'good');
  } else {
    S.items[id] = (S.items[id] || 0) + n;
    toast(`Acheté : ${it.i} ${it.n} ×${n}`, 'good');
  }
  renderTop(); renderShop();
}

// ---------- Rendu : invocation ----------
const SUMMON_RATES = [['C', 70], ['R', 22], ['E', 8]];
function summonPool() { return CHARS.filter((c) => c.r === 'C' || c.r === 'R' || c.r === 'E').map((c) => c.id); }
function renderSummon() {
  const pool = summonPool();
  const counts = { C: 0, R: 0, E: 0 };
  pool.forEach((id) => counts[CH[id].r]++);
  $('#page-summon').innerHTML = `<h1>Autel d'Invocation</h1>
    <div class="banner">
      <div class="bportraits">${activeZones().subs.map((z) => z.pool.map((p) => p[0]).filter((id) => CH[id].r === 'E')[0]).filter(Boolean).map((id) => portrait(id, 'big')).join('')}</div>
      <div class="btext"><h2>Invocation des héros</h2>
        <p>Invoque un personnage commun, rare ou épique au hasard parmi les ${fmt(pool.length)} de tous les univers. Les légendaires et mythiques ne s'obtiennent que dans les raids. Les doublons donnent des fragments.</p>
        <div class="rates">${SUMMON_RATES.map(([r, p]) => `<span style="--r:${RARITY[r].c}">${RARITY[r].n} ${p}% <small>(${fmt(counts[r])})</small></span>`).join('')}</div>
        <div class="sbtns"><button class="btn primary" data-act="summon" data-arg="1" ${S.gems < 50 ? 'disabled' : ''}>Invoquer ×1 — 50 💎</button>
        <button class="btn gold" data-act="summon" data-arg="10" ${S.gems < 450 ? 'disabled' : ''}>Invoquer ×10 — 450 💎</button></div>
        <small class="muted">Les gemmes s'obtiennent avec les succès, en combat (rare) ou à la boutique.</small>
      </div></div>`;
}
function summon(n) {
  const cost = n === 10 ? 450 : 50;
  if (S.gems < cost) return;
  S.gems -= cost; S.stats.pulls += n;
  const pool = summonPool(), lvl = Math.max(1, Math.floor(teamMax() * 0.6));
  const res = [];
  for (let i = 0; i < n; i++) {
    const r = pickWeighted(SUMMON_RATES);
    const cands = pool.filter((id) => CH[id].r === r);
    const id = cands[rand(0, cands.length - 1)];
    const shiny = Math.random() < 1 / 100;
    const out = recruit(id, shiny, lvl, 'par invocation');
    res.push({ id, shiny, out });
  }
  openModal(`<h2>Résultats de l'invocation</h2><div class="pulls">${res.map((x, i) => `<div class="pull r-${CH[x.id].r} ${x.shiny ? 'shiny' : ''}" style="animation-delay:${i * 0.08}s">
    ${portrait(x.id)}<b>${CH[x.id].n}</b><small>${x.out === 'new' ? '<span class="new">NOUVEAU</span>' : x.out === 'awaken' ? '🌟 Éveil' : '🧩 Fragments'}</small></div>`).join('')}</div>
    <button class="btn primary" data-act="closeModal">Super !</button>`, 'wide');
  renderTop(); renderSummon(); checkAch();
}

// ---------- Rendu : dojo ----------
const dojoCost = () => Math.floor(500 * Math.pow(2.6, S.dojo.lvl - 1));
function renderDojo() {
  const slots = [];
  for (let i = 0; i < S.dojo.lvl; i++) {
    const id = S.dojo.slots[i];
    slots.push(id ? `<div class="slot filled">${charCard(id, `<div class="bar xp"><i id="dx-${id}"></i></div>`)}<div class="slotbtns"><button data-act="undojo" data-arg="${id}">Sortir</button></div></div>` : `<div class="slot empty">Place libre</div>`);
  }
  $('#page-dojo').innerHTML = `<h1>Dojo <small>Niveau ${S.dojo.lvl}</small></h1>
    <p class="hint">Les personnages hors de l'équipe peuvent s'entraîner ici, même quand tu n'es pas là. Gain actuel : <b>${dojoRate().toFixed(1)} XP/s</b> par élève, jusqu'au niveau <b>${dojoCap()}</b> (le niveau de ton meilleur combattant d'équipe).</p>
    <div class="teamslots">${slots.join('')}</div>
    ${S.dojo.lvl < 6 ? `<button class="btn gold" data-act="dojoUp" ${S.gold < dojoCost() ? 'disabled' : ''}>🏗️ Agrandir le dojo — ${fmt(dojoCost())} 🪙</button>` : '<p>Dojo au niveau maximum !</p>'}
    <h2>Disponibles <small>clique pour envoyer au dojo</small></h2>
    ${filterBar('dojo')}
    <div id="list-dojo"></div>`;
  fillList('dojo');
  updateDojo();
}
function updateDojo() {
  S.dojo.slots.forEach((id) => { const m = S.roster[id]; setBar('dx-' + id, m.lvl >= MAX_LVL ? 100 : (m.xp / xpNeed(m.lvl)) * 100); });
}

// ---------- Rendu : boss (chasses + raids) ----------
let bossU = null;
function sanctCard(id) {
  const c = CH[id], k = SANCT[c.r], have = S.tokens[c.s] || 0, own = S.roster[id];
  return `<div class="sanct r-${c.r}">
    ${portrait(id, 'big' + (own ? '' : ' gray'))}
    <b>${esc(c.n)}</b><div class="badges">${rarBadge(c.r)} ${typeBadge(c.type)}</div>
    <small>Nv ${k.lv} · PV ×${k.hp}${own ? ' · ✔ recruté' : ''}</small>
    <button class="btn ${c.r === 'L' ? 'gold' : 'primary'}" data-act="sanct" data-arg="${id}" ${have < k.cost || (B && B.sanct) || !S.team.length ? 'disabled' : ''}>Défier — ${k.cost} 🎟️</button></div>`;
}
function renderBoss() {
  const a = activeZones();
  const u = bossU || a.hunts[0].u;
  const total = Object.values(S.tokens).reduce((x, y) => x + y, 0);
  $('#page-boss').innerHTML = `<h1>Boss <small>🎟️ ${total} token${total > 1 ? 's' : ''}</small></h1>
    <p class="hint">Les <b>chasses aux boss</b> opposent ton équipe aux personnages rares et épiques d'un univers en rotation. Chaque victoire a 1 chance sur 50 de donner un <b>token</b> de cet univers.<br>
    Les tokens ouvrent les <b>zones de raid</b> : <b>3 tokens</b> pour défier un légendaire, <b>1 token</b> pour un mythique. Chaque paiement donne <b>un seul combat</b> ; en cas de victoire, 20 % de chance de le recruter.</p>
    <h2>Chasses du moment <small>change dans ${rotLeft()}</small></h2>
    <div class="hunts">${a.hunts.map((h) => `<div class="hunt" style="--z1:${h.bg[0]};--z2:${h.bg[1]}">
      <b>${UNIVERSES.find((x) => x.id === h.u).i} ${esc(SERIES[h.u])}</b><small>Nv ${h.lv[0]}–${h.lv[1]} · ${h.pool.length} boss · 🎟️ ${S.tokens[h.u] || 0}</small>
      <button class="btn primary" data-act="goHunt" data-arg="${h.id}">Chasser</button></div>`).join('')}</div>
    <h2>Objets d'évolution <small>tombent en combat dans leur univers</small></h2>
    <div class="evoinv">${UNIVERSES.map((x) => `<span class="${S.evoItems[x.id] ? 'has' : ''}" title="${esc(x.n)}">${EVO_ITEMS[x.id].i} ${esc(EVO_ITEMS[x.id].n)} <b>${S.evoItems[x.id] || 0}</b></span>`).join('')}</div>
    <h2>Raids <small>légendaires puis mythiques</small></h2>
    <div class="uchips">${UNIVERSES.map((x) => `<button class="uchip ${x.id === u ? 'on' : ''} ${S.tokens[x.id] ? 'done' : ''}" data-act="bossU" data-arg="${x.id}" style="--z1:${x.bg[0]};--z2:${x.bg[1]}">${x.i} ${esc(x.n)} <small>🎟️ ${S.tokens[x.id] || 0}</small></button>`).join('')}</div>
    <div class="sancts">${[...UNIV_BOSSES[u].L, ...UNIV_BOSSES[u].M].map(sanctCard).join('')}</div>`;
}

// ---------- Rendu : Tour des Maîtres ----------
function renderEndgame() {
  const open = S.tower >= TOWER.length, inFight = B && B.sanct;
  return `<h2>☠️ Boss de fin de jeu <small>${open ? `${S.endgame}/${ENDGAME.length} vaincus` : '🔒 bats le Sommet du Multivers pour les affronter'}</small></h2>
    <p class="hint">Un seul adversaire niveau 100, mais avec <b>2, 3 ou 4 barres de vie</b> et des stats renforcées. Il s'énerve à chaque barre brisée (+10 % d'attaque). Non recrutables. Les boss déjà vaincus peuvent être réaffrontés (récompense réduite).</p>
    <div class="finals">${ENDGAME.map((b, i) => {
      const done = i < S.endgame, next = open && i === S.endgame, locked = !open || i > S.endgame, k = FINAL_TIERS[b.bars];
      return `<div class="final ${done ? 'done' : next ? 'next' : 'locked'}" style="--z1:${b.bg[0]};--z2:${b.bg[1]}">
        ${portrait(b.id, 'big' + (locked ? ' sil' : ''))}
        <b>${locked ? '???' : esc(b.t)}</b>
        <div class="hpbars static">${'<i class="on"></i>'.repeat(b.bars)}<b>×${b.bars}</b></div>
        <small>${k.n} · Nv ${b.lv} · +${k.gems} 💎${done ? ' · ✅' : ''}</small>
        ${!locked ? `<button class="btn ${next ? 'primary' : ''}" data-act="final" data-arg="${i}" ${inFight || !S.team.length ? 'disabled' : ''}>${done ? 'Réaffronter' : '☠️ Défier'}</button>` : ''}
      </div>`;
    }).join('')}</div>`;
}
function renderTower() {
  const inFight = B && B.sanct;
  $('#page-tower').innerHTML = `<h1>Tour des Maîtres <small>🔒 Niveau max actuel : ${S.levelCap}</small></h1>
    <p class="hint">Tes personnages ne peuvent pas dépasser le <b>niveau ${S.levelCap}</b>. Chaque étage oppose ton équipe à une équipe de boss (non recrutables), à affronter à la suite. Bats un étage pour relever le niveau max de 10. Entre deux adversaires, ton équipe ne récupère que 12 % de ses PV.</p>
    ${renderEndgame()}
    <h2>Étages</h2>
    <div class="floors">${TOWER.map((f, k) => {
      const done = k < S.tower, next = k === S.tower, locked = k > S.tower;
      return `<div class="floor ${done ? 'done' : next ? 'next' : 'locked'}" style="--z1:${f.bg[0]};--z2:${f.bg[1]}">
        <div class="fl-head"><span class="fl-num">${k + 1}</span><div><b>${f.i} ${esc(f.n)}</b>
          <small>Nv ${f.lv} · ${f.ids.length} adversaires · ${f.cap > LEVEL_CAP_START + 10 * k ? `🔓 niveau max → ${f.cap}` : '🏆 sommet'} · +${f.gems} 💎</small></div>
          <span class="fl-state">${done ? '✅ Vaincu' : locked ? '🔒' : ''}</span></div>
        <div class="fl-team">${f.ids.map((id, i) => `<div class="fl-foe ${i === f.ids.length - 1 ? 'leader' : ''}" title="${esc(CH[id].n)}">${portrait(id, locked ? 'small sil' : 'small')}<small>${locked ? '???' : esc(CH[id].n)}</small></div>`).join('')}</div>
        ${next ? `<button class="btn primary" data-act="tower" data-arg="${k}" ${inFight || !S.team.length ? 'disabled' : ''}>🗼 Défier l'étage ${k + 1}</button>` : ''}
      </div>`;
    }).join('')}</div>`;
  const nx = document.querySelector('.floor.next');
  if (nx && !quiet()) nx.scrollIntoView({ block: 'center' });
}

// ---------- Rendu : succès / options ----------
function renderAch() {
  const done = ACHIEVEMENTS.filter((a) => S.ach[a.id]).length;
  $('#page-ach').innerHTML = `<h1>Succès <small>${done}/${ACHIEVEMENTS.length}</small></h1>
    <div class="statsbox"><div>⚔️ <b>${fmt(S.stats.kills)}</b> victoires</div><div>👑 <b>${fmt(S.stats.bosses)}</b> boss de chasse vaincus</div><div>🎟️ <b>${S.stats.tokens}</b> tokens obtenus</div><div>🏯 <b>${S.stats.sanct}</b> raids réussis</div><div>🎴 <b>${S.stats.pulls}</b> invocations</div><div>🪙 <b>${fmt(S.stats.goldEarned)}</b> pièces gagnées</div></div>
    <div class="achs">${ACHIEVEMENTS.map((a) => `<div class="ach ${S.ach[a.id] ? 'done' : ''}"><span>${S.ach[a.id] ? '🏆' : '🔒'}</span><div><b>${a.n}</b><small>${a.d}</small></div><em>+${a.g} 💎</em></div>`).join('')}</div>`;
}
function renderOptions() {
  $('#page-options').innerHTML = `<h1>Options</h1>
    <div class="opts">
      <div class="opt"><b>Sauvegarde</b><small>Le jeu se sauvegarde automatiquement dans ton navigateur toutes les 5 secondes.</small>
        <div class="dbtns"><button class="btn primary" data-act="saveNow">💾 Sauvegarder</button><button class="btn" data-act="export">📤 Exporter</button><button class="btn" data-act="import">📥 Importer</button></div>
        <textarea id="saveText" placeholder="Colle ici une sauvegarde exportée…"></textarea></div>
      <div class="opt danger"><b>Réinitialiser</b><small>Efface toute ta progression. Irréversible !</small>
        <button class="btn bad" data-act="reset">🗑️ Tout effacer</button></div>
      <div class="opt"><b>À propos</b><small>MangaChill — un jeu idle de collection inspiré de PokeChill. ${CHARS.length} personnages issus de ${UNIVERSES.length} univers. Projet de fan non officiel : les personnages et leurs images appartiennent à leurs auteurs respectifs. Données et images : <a href="https://anilist.co" target="_blank" rel="noopener">AniList</a>.</small></div>
    </div>`;
}

// ---------- Démarrage ----------
function starterModal() {
  const starters = STARTERS;
  openModal(`<div class="starter"><h1>Bienvenue dans <span class="logo">MangaChill</span> !</h1>
    <p>Recrute des héros de manga, entraîne-les et deviens le plus fort. Choisis ton premier compagnon :</p>
    <div class="starters">${starters.map((id) => `<div class="st" data-act="pickStarter" data-arg="${id}" style="--t:${TYPES[CH[id].type].c}">
      ${portrait(id, 'huge')}<h2>${CH[id].n}</h2>${typeBadge(CH[id].type)}<small>${SERIES[CH[id].s]}</small></div>`).join('')}</div></div>`, 'locked wide');
}

// ---------- Actions ----------
const ACTIONS = {
  tab: (a) => setTab(a),
  closeModal: () => { if (!$('#modal').classList.contains('locked')) closeModal(); },
  pickStarter: (id) => {
    S.started = true; recruit(id, false, 6);
    $('#modal').className = 'modal';
    S.zone = activeZones().subs[0].id; LOG = []; B = null;
    save(); setTab('explore');
    toast('Astuce : les zones changent toutes les 12 heures. Les chasses aux boss donnent des tokens pour les raids légendaires et mythiques !', 'info');
  },
  zone: (id) => {
    if (S.zone === id) return;
    S.zone = id;
    if (!(B && B.sanct)) { B = null; LOG = []; battleTick(0); }
    renderExplore();
  },
  retreat: () => { if (B && B.sanct) return; S.zone = null; B = null; renderExplore(); },
  goHunt: (id) => { setTab('explore'); ACTIONS.zone(id); },
  bossU: (u) => { bossU = u; renderBoss(); },
  tower: (k) => { startTower(+k); setTab('explore'); },
  final: (i) => { startFinal(+i); setTab('explore'); },
  giveup: () => {
    if (!B || !B.sanct || B.phase !== 'fight') return;
    log('🏳️ Tu abandonnes le combat.', 'lose');
    B = null; if (S.zone) spawn(); else renderArena();
  },
  sanct: (id) => {
    const c = CH[id], k = SANCT[c.r];
    if (!k || (B && B.sanct) || !S.team.length || (S.tokens[c.s] || 0) < k.cost) return;
    S.tokens[c.s] -= k.cost;
    healAll(1); LOG = [];
    makeBattle(id, k.lv, false, 'sanct', 'sanct');
    setTab('explore');
  },
  speed: (s) => { S.speed = +s; renderArena(); },
  ramen: () => {
    if (!S.items.ramen) { toast("Plus de ramen ! Achètes-en à la boutique.", 'bad'); return; }
    S.items.ramen--; healAll(1);
    if (B && B.phase === 'recover') B.timer = 0;
    toast('🍜 Ton équipe reprend des forces !', 'good'); renderArena();
  },
  autoScroll: (_, el) => { S.autoScroll = el.checked; },
  autoGold: (_, el) => { S.autoGold = el.checked; },
  switch: (id) => {
    if (!B || B.phase !== 'fight' || hpOf(S.roster[id]) <= 0 || B.active === id) return;
    B.active = id; B.pcd = {}; B.pg = 0; renderArena();
    log(`🔁 ${CH[id].n} entre en jeu !`);
  },
  detail: (id) => openDetail(id),
  toteam: (id) => {
    if (S.team.length >= TEAM_SIZE || S.team.includes(id)) return;
    S.dojo.slots = S.dojo.slots.filter((x) => x !== id);
    S.team.push(id); closeModal(); refreshView();
  },
  unteam: (id) => { S.team = S.team.filter((x) => x !== id); closeModal(); refreshView(); },
  move: (arg) => {
    const [i, d] = arg.split(':').map(Number), j = i + d;
    if (j < 0 || j >= S.team.length) return;
    [S.team[i], S.team[j]] = [S.team[j], S.team[i]]; renderTeam();
  },
  more: (key) => { FILTERS[key].limit += FILTER_DEFAULTS[key].limit; fillList(key); },
  setU: (u) => { FILTERS.collection.u = u; FILTERS.collection.q = ''; FILTERS.collection.limit = FILTER_DEFAULTS.collection.limit; renderCollection(); },
  todojo: (id) => {
    if (S.dojo.slots.length >= S.dojo.lvl || S.team.includes(id)) return;
    S.dojo.slots.push(id); closeModal(); refreshView();
  },
  undojo: (id) => { S.dojo.slots = S.dojo.slots.filter((x) => x !== id); closeModal(); refreshView(); },
  dojoUp: () => { const c = dojoCost(); if (S.gold < c || S.dojo.lvl >= 6) return; S.gold -= c; S.dojo.lvl++; toast('🥋 Le dojo s\'agrandit !', 'good'); renderTop(); renderDojo(); },
  star: (id) => {
    const m = S.roster[id], c = starCost(m);
    if (m.stars >= 5 || (S.frags[id] || 0) < c) return;
    S.frags[id] -= c; m.stars++; toast(`⭐ ${CH[id].n} passe à ${m.stars} étoile${m.stars > 1 ? 's' : ''} !`, 'catch');
    openDetail(id); checkAch();
  },
  use: (arg) => {
    const [item, id] = arg.split(':'), m = S.roster[id];
    if (!S.items[item] || !m) return;
    if (item === 'orb') { if (m.shiny) return; m.shiny = true; toast(`🌟 ${CH[id].n} s'est éveillé !`, 'catch'); }
    else {
      if (m.lvl >= MAX_LVL) return;
      const n = item === 'book' ? 1 : 5;
      let need = xpNeed(m.lvl) - m.xp;
      for (let i = 1; i < n; i++) need += xpNeed(Math.min(MAX_LVL - 1, m.lvl + i));
      gainXp(m, need);
    }
    S.items[item]--; openDetail(id); refreshView();
  },
  evolve: (id) => {
    const m = S.roster[id], c = CH[id];
    if (!m || !c.evos) return;
    const next = c.evos[m.evo || 0];
    if (!next || (S.evoItems[c.s] || 0) < next.cost || m.lvl < next.lvl) return;
    const before = statsOf(m).hp;
    S.evoItems[c.s] -= next.cost;
    m.evo = (m.evo || 0) + 1;
    m.hp = Math.min(statsOf(m).hp, hpOf(m) + statsOf(m).hp - before);
    openModal(`<div class="evolved">${portrait(id, 'huge' + evoCls(m))}<h1>${esc(c.n)}</h1><h2 class="evoname">✦ ${esc(next.n)} ✦</h2>
      <p>Nouvelle technique : <b>${esc(next.sig)}</b> · +${Math.round(EVO_BONUS * 100)} % de stats</p>
      <button class="btn primary" data-act="detail" data-arg="${id}">Voir la fiche</button></div>`, 'evolving');
    checkAch(); refreshSoft();
  },
  buy: (arg) => { const [id, n] = arg.split(':'); buy(id, +n); },
  exchange: () => { if (S.gold < 1000) return; S.gold -= 1000; S.gems += 10; renderTop(); renderShop(); },
  summon: (n) => summon(+n),
  saveNow: () => { save(); toast('💾 Partie sauvegardée', 'good'); },
  export: () => { save(); $('#saveText').value = btoa(unescape(encodeURIComponent(JSON.stringify(S)))); $('#saveText').select(); toast('Sauvegarde copiée dans le champ ci-dessous.', 'info'); },
  import: () => {
    try {
      const d = JSON.parse(decodeURIComponent(escape(atob($('#saveText').value.trim()))));
      if (!d.roster) throw 0;
      S = Object.assign(newState(), d); B = null; LOG = []; save(); toast('Sauvegarde importée !', 'good'); setTab('explore');
    } catch (e) { toast('Sauvegarde invalide.', 'bad'); }
  },
  reset: () => {
    openModal(`<h2>Tout effacer ?</h2><p>Ta progression sera définitivement perdue.</p><div class="dbtns"><button class="btn bad" data-act="resetConfirm">Oui, tout effacer</button><button class="btn" data-act="closeModal">Annuler</button></div>`);
  },
  resetConfirm: () => { localStorage.removeItem(SAVE_KEY); S = newState(); B = null; LOG = []; closeModal(); setTab('explore'); starterModal(); },
};

const HELP = {
  gold: { t: '🪙 Pièces', get: ['Chaque victoire en combat (plus le niveau de l’adversaire est haut, plus tu gagnes)', 'Chasses aux boss : ×3', 'Raids légendaires / mythiques : ×10', 'Étages de la Tour des Maîtres', 'Progression hors-ligne et en arrière-plan'],
    use: ['Boutique : ramen, parchemins, manuels, grimoires', 'Agrandir le dojo', 'Change : 1 000 pièces = 10 gemmes'] },
  gems: { t: '💎 Gemmes', get: ['Succès (onglet 🏆)', '5 % de chance par victoire d’en trouver 1 à 3', 'Étages de la Tour des Maîtres', 'Boss de fin de jeu (beaucoup !)', 'Boutique : change de pièces'],
    use: ['Invocations (50 💎, ou 450 💎 les 10)', "Orbe d'éveil et coffret de fragments à la boutique"] },
  chars: { t: '🎴 Personnages', get: ['Combats en exploration : chance de recrutement selon la rareté (commun 22 %, rare 12 %, épique 5 %)', 'Parchemins (×2) et parchemins dorés (×5) pour augmenter cette chance', 'Invocations avec les gemmes', 'Légendaires et mythiques : seulement dans les raids (20 %)', 'Clic droit sur une zone pour voir qui s’y trouve'],
    use: ['Équipe de 6 combattants', 'Dojo pour entraîner les autres', 'Les doublons donnent des fragments pour monter les étoiles'] },
  tokens: { t: '🎟️ Tokens de boss', get: ['Chasses aux boss (dans la rotation) : 1 chance sur 50 par victoire', 'Chaque token est lié à l’univers de la chasse'],
    use: ['Raid légendaire : 3 tokens de l’univers', 'Raid mythique : 1 token de l’univers', 'Un paiement = un seul combat'] },
  cap: { t: '🔒 Niveau maximum', get: ['Commence au niveau 20', 'Chaque étage de la Tour des Maîtres vaincu le relève de 10 (jusqu’à 100)'],
    use: ['Aucun personnage ne peut gagner d’XP au-delà', 'Les recrues arrivent au plus à ce niveau'] },
};
function openHelp(k) {
  const h = HELP[k];
  if (!h) return;
  openModal(`<h2>${h.t}</h2><h3>Comment en obtenir</h3><ul class="help">${h.get.map((x) => `<li>${x}</li>`).join('')}</ul>
    <h3>À quoi ça sert</h3><ul class="help">${h.use.map((x) => `<li>${x}</li>`).join('')}</ul>`);
}
let longPress = null, skipClick = false;
document.addEventListener('contextmenu', (ev) => {
  const hl = ev.target.closest('[data-help]');
  if (hl) { ev.preventDefault(); openHelp(hl.dataset.help); return; }
  const z = ev.target.closest('.zone[data-arg]');
  if (!z) return;
  ev.preventDefault();
  openZoneInfo(z.dataset.arg);
});
document.addEventListener('touchstart', (ev) => {
  const hl = ev.target.closest('[data-help]');
  if (hl) { longPress = setTimeout(() => { skipClick = true; openHelp(hl.dataset.help); }, 550); return; }
  const z = ev.target.closest('.zone[data-arg]');
  if (!z) return;
  longPress = setTimeout(() => { skipClick = true; openZoneInfo(z.dataset.arg); }, 550);
}, { passive: true });
['touchend', 'touchmove', 'touchcancel'].forEach((t) => document.addEventListener(t, () => clearTimeout(longPress), { passive: true }));
document.addEventListener('click', (ev) => {
  if (skipClick) { skipClick = false; if (ev.target.closest('.zone, [data-help]')) return; }
  if (ev.target.id === 'modal') { ACTIONS.closeModal(); return; }
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled || el.tagName === 'INPUT') return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) fn(el.dataset.arg, el);
});
function onFilter(ev) {
  const el = ev.target;
  if (!el.dataset || !el.dataset.filter) return false;
  const key = el.closest('[data-fkey]').dataset.fkey;
  FILTERS[key][el.dataset.filter] = el.value;
  FILTERS[key].limit = FILTER_DEFAULTS[key].limit;
  fillList(key);
  return true;
}
document.addEventListener('input', onFilter);
document.addEventListener('change', (ev) => {
  if (onFilter(ev)) return;
  const el = ev.target;
  if (el.tagName === 'INPUT' && el.dataset.act && ACTIONS[el.dataset.act]) ACTIONS[el.dataset.act](el.dataset.arg, el);
});
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') ACTIONS.closeModal(); });
window.addEventListener('beforeunload', save);
let away = null;
const snapshot = () => ({ t: Date.now(), kills: S.stats.kills, caught: S.stats.caught, gold: S.stats.goldEarned, tokens: S.stats.tokens,
  items: Object.values(S.evoItems).reduce((a, b) => a + b, 0), lv: Object.values(S.roster).reduce((a, m) => a + m.lvl, 0) });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { save(); away = snapshot(); return; }
  tick();                          // rattrape immédiatement le temps passé
  renderTab(); renderTop();
  if (!away) return;
  const now = snapshot(), d = (k) => now[k] - away[k];
  if (now.t - away.t > 20000 && d('kills') > 0) {
    const parts = [`⚔️ ${fmt(d('kills'))} victoires`, `🪙 +${fmt(d('gold'))}`];
    if (d('lv') > 0) parts.push(`⬆️ +${d('lv')} niveaux`);
    if (d('caught') > 0) parts.push(`🎉 ${d('caught')} recrue${d('caught') > 1 ? 's' : ''}`);
    if (d('tokens') > 0) parts.push(`🎟️ ${d('tokens')} token${d('tokens') > 1 ? 's' : ''}`);
    if (d('items') > 0) parts.push(`✦ ${d('items')} objet${d('items') > 1 ? 's' : ''} d'évolution`);
    toast(`Pendant que tu étais ailleurs : ${parts.join(' · ')}`, 'good');
  }
  away = null;
});

// ---------- Horloge ----------
// Les minuteurs d'un Web Worker ne sont presque pas ralentis dans un onglet en arrière-plan.
function startClock() {
  try {
    const src = 'setInterval(function () { postMessage(0); }, 100);';
    const worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    worker.onmessage = tick;
  } catch (e) { setInterval(tick, 100); }
  setInterval(tick, 1000);         // filet de sécurité (tick ignore les appels trop rapprochés)
}

// ---------- Lancement ----------
(function init() {
  const away = Date.now() - (S.last || Date.now());
  if (S.zone && !curZone()) S.zone = null;
  setTab('explore');
  if (!S.started) starterModal();
  else if (away > 60000) offline(away, true);
  lastTick = Date.now();
  startClock();
})();
