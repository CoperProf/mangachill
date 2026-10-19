// ====== Données du jeu : types, raretés, personnages, zones ======
// Les personnages viennent de js/chars.js (généré depuis AniList par tools/fetch-chars.mjs),
// leur classement par force de js/tiers.js.

const TYPES = {
  Feu:     { c: '#ff5a36', i: '🔥' },
  Eau:     { c: '#2f8fff', i: '💧' },
  Vent:    { c: '#3fd6a0', i: '🌪️' },
  Foudre:  { c: '#ffd23f', i: '⚡' },
  Terre:   { c: '#c08a4f', i: '🪨' },
  Glace:   { c: '#8fe6ff', i: '❄️' },
  Combat:  { c: '#ff4d8b', i: '👊' },
  Ombre:   { c: '#9b6bff', i: '🌑' },
  Lumière: { c: '#fff09a', i: '✨' },
};
const TYPE_LIST = Object.keys(TYPES);

// attaquant -> types sur lesquels il est super efficace (x1.5)
const STRONG = {
  Feu: ['Vent', 'Glace'],
  Eau: ['Feu', 'Terre'],
  Terre: ['Foudre', 'Feu'],
  Foudre: ['Eau', 'Glace'],
  Vent: ['Terre', 'Combat'],
  Glace: ['Vent', 'Terre'],
  Combat: ['Glace', 'Ombre'],
  Ombre: ['Lumière'],
  Lumière: ['Ombre'],
};

function typeMult(atk, def) {
  if (STRONG[atk].includes(def)) return 1.5;
  if (STRONG[def].includes(atk)) return 0.67;
  return 1;
}

const RARITY = {
  C: { n: 'Commun',     c: '#a7b0bf', catch: 0.22, xp: 40,  frag: 10, budget: 270, w: 1 },
  R: { n: 'Rare',       c: '#3fa9ff', catch: 0.12, xp: 60,  frag: 15, budget: 305, w: 0.7 },
  E: { n: 'Épique',     c: '#b875ff', catch: 0.05, xp: 90,  frag: 25, budget: 340, w: 0.4 },
  M: { n: 'Mythique',   c: '#ff3b7a', catch: 0.20, xp: 160, frag: 50, budget: 385, w: 0 },
  L: { n: 'Légendaire', c: '#ffb020', catch: 0.20, xp: 220, frag: 80, budget: 425, w: 0 },
};
const RAR_ORDER = { L: 0, M: 1, E: 2, R: 3, C: 4 };

const TYPE_MOVES = {
  Feu:     ['Braise', 'Boule de Feu Suprême'],
  Eau:     ["Jet d'Eau", 'Dragon Aqueux'],
  Vent:    ['Lame de Vent', 'Grand Typhon'],
  Foudre:  ['Étincelle', 'Éclair Pourfendeur'],
  Terre:   ['Jet de Pierre', 'Mur Sismique'],
  Glace:   ['Éclat de Givre', 'Prison de Glace'],
  Combat:  ['Coup de Poing', 'Rafale de Coups'],
  Ombre:   ["Griffe d'Ombre", 'Voile des Ténèbres'],
  Lumière: ['Rayon de Ki', 'Éclat Sacré'],
};
// techniques signatures génériques (pour les personnages sans technique connue)
const SIG_POOL = {
  Feu:     ['Brasier Infernal', 'Phénix Écarlate', 'Flamme Divine', 'Météore Incandescent', 'Explosion Solaire', 'Lotus de Feu'],
  Eau:     ['Raz-de-Marée', 'Lame Aqueuse', 'Prison Océane', 'Dragon des Abysses', 'Pluie Tranchante', 'Torrent Céleste'],
  Vent:    ['Lame du Zéphyr', 'Cyclone Fulgurant', 'Danse des Rafales', 'Tempête Silencieuse', 'Coupe-Vent Ultime', 'Œil du Cyclone'],
  Foudre:  ['Tonnerre Divin', 'Éclair Noir', 'Lance de Foudre', 'Orage Écarlate', 'Frappe Électrique', 'Mille Oiseaux'],
  Terre:   ['Séisme Titanesque', 'Poing de Roc', 'Avalanche', 'Faille Tectonique', 'Golem de Pierre', 'Marteau Tellurique'],
  Glace:   ['Cercueil de Glace', 'Zéro Absolu', 'Lance de Givre', 'Blizzard Éternel', 'Rose de Glace', 'Miroir Gelé'],
  Combat:  ['Poing Ultime', 'Coup de Grâce', 'Rafale Mille Poings', 'Frappe Fatale', 'Coup du Dragon', 'Uppercut Divin'],
  Ombre:   ['Néant Éternel', 'Lame Maudite', 'Abîme Sans Fin', 'Ombre Dévorante', 'Malédiction Suprême', 'Éclipse'],
  Lumière: ['Rayon Sacré', 'Jugement Céleste', 'Aura Divine', 'Lumière Absolue', 'Canon Spirituel', 'Aube Éternelle'],
};

// Personnages emblématiques : nom AniList -> [type, technique signature, nom affiché]
const OVR = {
  // Naruto
  'Itachi Uchiha': ['Ombre', 'Tsukuyomi'], 'Kakashi Hatake': ['Foudre', 'Raikiri'], 'Naruto Uzumaki': ['Vent', 'Rasengan'],
  'Sasuke Uchiha': ['Foudre', 'Chidori'], 'Shikamaru Nara': ['Ombre', 'Manipulation des Ombres'], 'Gaara': ['Terre', 'Cercueil de Sable'],
  'Jiraiya': ['Feu', 'Rasengan Géant'], 'Minato Namikaze': ['Foudre', 'Hiraishin'],
  // One Piece
  'Luffy Monkey': ['Combat', 'Gomu Gomu no Gatling', 'Monkey D. Luffy'], 'Zoro Roronoa': ['Vent', 'Santoryu : Oni Giri', 'Roronoa Zoro'],
  'Sanji': ['Feu', 'Diable Jambe'], 'Robin Nico': ['Ombre', 'Mil Fleurs', 'Nico Robin'], 'Law Trafalgar': ['Ombre', 'Room : Shambles', 'Trafalgar Law'],
  'Nami': ['Foudre', 'Thunder Lance Tempo'], 'Ace Portgas': ['Feu', 'Poing Ardent', 'Portgas D. Ace'], 'Chopper Tony Tony': ['Glace', 'Kokutei Roseo', 'Tony Tony Chopper'],
  // Demon Slayer
  'Tanjirou Kamado': ['Eau', 'Danse du Dieu du Feu', 'Tanjiro Kamado'], 'Nezuko Kamado': ['Feu', 'Sang Explosif'], 'Inosuke Hashibira': ['Vent', 'Souffle de la Bête'],
  'Zenitsu Agatsuma': ['Foudre', 'Premier Mouvement : Éclair'], 'Giyuu Tomioka': ['Eau', 'Onzième Forme : Calme Plat'],
  'Kyoujurou Rengoku': ['Feu', 'Neuvième Forme : Rengoku'], 'Shinobu Kochou': ['Vent', 'Danse du Papillon'], 'Tengen Uzui': ['Combat', 'Partition Explosive'],
  // My Hero Academia
  'Shouto Todoroki': ['Glace', 'Glacier Flamboyant'], 'Katsuki Bakugou': ['Feu', 'Howitzer Impact'], 'Izuku Midoriya': ['Combat', 'Detroit Smash'],
  'Shouta Aizawa': ['Ombre', 'Effacement'], 'Toshinori Yagi': ['Lumière', 'United States of Smash', 'All Might'], 'Eijirou Kirishima': ['Terre', 'Red Riot Unbreakable'],
  'Himiko Toga': ['Ombre', 'Transformation'], 'Dabi': ['Feu', 'Flammes Bleues'],
  // Haikyu
  'Shouyou Hinata': ['Vent', 'Attaque Rapide Éclair'], 'Tobio Kageyama': ['Lumière', 'Passe du Roi'], 'Yuu Nishinoya': ['Terre', 'Rolling Thunder'],
  'Kenma Kozume': ['Ombre', 'Cerveau du Réseau'], 'Tooru Oikawa': ['Foudre', 'Service Smash'], 'Kei Tsukishima': ['Glace', 'Contre Glacial'], 'Koutarou Bokuto': ['Combat', 'Smash Ultime'],
  // Black Clover
  'Yami Sukehiro': ['Ombre', 'Coupe-Dimension'], 'Asta': ['Combat', 'Épée Anti-Magie'], 'Noelle Silva': ['Eau', 'Valkyrie Aquatique'], 'Yuno': ['Vent', 'Esprit de Zéphyr'],
  'Mereoleona Vermillion': ['Feu', 'Calidos Brachium'], 'Julius Novachrono': ['Lumière', 'Magie du Temps'], 'Luck Voltia': ['Foudre', 'Lances de Foudre'],
  // Fairy Tail
  'Erza Scarlet': ['Combat', 'Armure du Purgatoire'], 'Natsu Dragneel': ['Feu', 'Hurlement du Dragon de Feu'], 'Lucy Heartfilia': ['Lumière', 'Urano Metria'],
  'Gray Fullbuster': ['Glace', 'Ice Make : Lance'], 'Juvia Lockser': ['Eau', 'Water Lock'], 'Gajeel Redfox': ['Terre', "Épée du Dragon d'Acier"], 'Mirajane Strauss': ['Ombre', 'Satan Soul'],
  // Soul Eater
  'Death the Kid': ['Ombre', 'Death Cannon'], 'Maka Albarn': ['Lumière', 'Chasseur de Sorcière'], 'Soul Eater Evans': ['Ombre', 'Résonance des Âmes'], 'Black☆Star': ['Combat', 'Big Wave'],
  // Jujutsu Kaisen
  'Satoru Gojou': ['Lumière', 'Violet Imaginaire', 'Satoru Gojo'], 'Yuuji Itadori': ['Combat', 'Black Flash', 'Yuji Itadori'], 'Megumi Fushiguro': ['Ombre', 'Chiens Divins'],
  'Kento Nanami': ['Combat', 'Ratio 7:3'], 'Nobara Kugisaki': ['Terre', 'Résonance'], 'Maki Zenin': ['Combat', 'Lame Maudite'], 'Sukuna': ['Feu', 'Fuga'], 'Yuuta Okkotsu': ['Ombre', 'Rika'],
  // Blue Lock
  'Meguru Bachira': ['Vent', 'Dribble du Monstre'], 'Seishirou Nagi': ['Glace', 'Contrôle Parfait'], 'Yoichi Isagi': ['Lumière', 'Métavision'],
  'Hyouma Chigiri': ['Vent', 'Sprint Fulgurant'], 'Rin Itoshi': ['Ombre', 'Tir Destructeur'],
  // L'Attaque des Titans
  'Levi': ['Vent', 'Rotation Mortelle', 'Livaï'], 'Eren Yeager': ['Terre', 'Titan Assaillant'], 'Mikasa Ackerman': ['Vent', 'Lames Tournoyantes'],
  'Armin Arlert': ['Feu', 'Explosion Colossale'], 'Hange Zoe': ['Feu', 'Lance Foudroyante'], 'Erwin Smith': ['Lumière', 'Charge Finale'],
  // Seven Deadly Sins
  'Ban': ['Ombre', 'Snatch'], 'Meliodas': ['Ombre', 'Full Counter'], 'Escanor': ['Lumière', 'Cruel Sun'], 'King': ['Vent', 'Chastiefol'], 'Diane': ['Terre', 'Heavy Metal'], 'Merlin': ['Lumière', 'Infinity'],
  // Reborn
  'Tsunayoshi Sawada': ['Feu', 'X-Burner'], 'Kyouya Hibari': ['Combat', 'Tonfa du Nuage'], 'Hayato Gokudera': ['Feu', 'Bombes de Tempête'],
  'Reborn': ['Lumière', 'Balle de Dernière Volonté'], 'Takeshi Yamamoto': ['Eau', 'Shigure Soen Ryu'], 'Mukuro Rokudo': ['Ombre', 'Six Voies'],
  // Fire Force
  'Shinra Kusakabe': ['Feu', 'Pied du Diable'], 'Benimaru Shinmon': ['Feu', 'Lune Rouge'], 'Arthur Boyle': ['Lumière', 'Excalibur Plasma'], 'Maki Oze': ['Feu', 'Chevalier Flamme'],
  // Hunter x Hunter
  'Killua Zoldyck': ['Foudre', 'Godspeed'], 'Kurapika': ['Ombre', 'Chaîne du Jugement'], 'Gon Freecss': ['Combat', 'Jajanken'], 'Hisoka Morow': ['Ombre', 'Bungee Gum'],
  'Chrollo Lucilfer': ['Ombre', 'Livre du Voleur'], 'Meruem': ['Ombre', 'Roi des Chimères'], 'Leorio Paradinight': ['Combat', 'Poing Distant'],
  // Inuyasha
  'Inuyasha': ['Combat', 'Kaze no Kizu'], 'Sesshoumaru': ['Lumière', 'Bakusaiga'], 'Kagome Higurashi': ['Lumière', 'Flèche Sacrée'],
  'Sango': ['Terre', 'Hiraikotsu'], 'Kikyou': ['Lumière', 'Flèche Purificatrice'], 'Miroku': ['Vent', 'Kazaana'],
  // Yu Yu Hakusho
  'Yuusuke Urameshi': ['Lumière', 'Rei Gun'], 'Hiei': ['Feu', 'Flamme du Dragon Noir'], 'Kurama': ['Terre', 'Fouet de Roses'], 'Kazuma Kuwabara': ['Lumière', 'Épée Spirituelle'],
  // Sailor Moon
  'Usagi Tsukino': ['Lumière', 'Moon Healing Escalation'], 'Rei Hino': ['Feu', 'Mars Flame Sniper'], 'Makoto Kino': ['Foudre', 'Jupiter Thunder'],
  'Minako Aino': ['Lumière', 'Venus Love-Me Chain'], 'Ami Mizuno': ['Glace', 'Mercury Aqua Rhapsody'], 'Hotaru Tomoe': ['Ombre', 'Silence Glaive Surprise'], 'Haruka Tenou': ['Terre', 'World Shaking'],
  // Détective Conan
  'Conan Edogawa': ['Lumière', 'Ballon Turbo'], 'Kaito Kuroba': ['Vent', 'Illusion du Kid'], 'Ai Haibara': ['Glace', 'APTX 4869'],
  'Heiji Hattori': ['Combat', "Kendo d'Osaka"], 'Shuuichi Akai': ['Ombre', "Balle d'Argent"], 'Ran Mouri': ['Combat', 'Karaté Fulgurant'],
  // Tokyo Ghoul
  'Ken Kaneki': ['Ombre', 'Kagune Centipède'], 'Touka Kirishima': ['Vent', 'Ukaku Tempête'], 'Juuzou Suzuya': ['Combat', 'Jason 13'], 'Kishou Arima': ['Foudre', 'IXA'],
  // Chainsaw Man
  'Makima': ['Ombre', 'Contrôle Absolu'], 'Denji': ['Combat', 'Tronçonneuse Hurlante'], 'Power': ['Ombre', 'Marteau de Sang'],
  'Aki Hayakawa': ['Glace', 'Diable du Futur'], 'Reze': ['Feu', 'Diable Bombe'], 'Pochita': ['Feu', 'Rugissement de Pochita'],
  // Dr. Stone
  'Senkuu Ishigami': ['Foudre', 'Dix Milliards Pour Cent', 'Senku Ishigami'], 'Gen Asagiri': ['Ombre', 'Mentalisme'], 'Kohaku': ['Vent', 'Lame Lionne'], 'Tsukasa Shishiou': ['Combat', 'Poing du Primate Suprême'],
  // One Punch Man
  'Saitama': ['Combat', 'Coup de Poing Sérieux'], 'Tatsumaki': ['Ombre', 'Tornade Psychique'], 'Genos': ['Feu', 'Canon Incinérateur'],
  'Garou': ['Combat', 'Poing Cosmique'], 'Fubuki': ['Vent', 'Blizzard Psychique'], 'Onsoku no Sonic': ['Vent', 'Ninjutsu Ultrarapide', "Speed-o'-Sound Sonic"],
  // Sword Art Online
  'Asuna Yuuki': ['Lumière', 'Flash Pénétrant'], 'Kazuto Kirigaya': ['Ombre', 'Starburst Stream', 'Kirito'], 'Shino Asada': ['Glace', "Tir de l'Hécate", 'Sinon'],
  'Alice Zuberg': ['Lumière', 'Floraison Dorée'], 'Eugeo': ['Glace', 'Rose Bleue'], 'Yuuki Konno': ['Ombre', "Mother's Rosario"],
  // Gintama
  'Gintoki Sakata': ['Combat', 'Sabre de Bois Shiroyasha'], 'Kagura': ['Combat', 'Coup du Yato'], 'Kotarou Katsura': ['Feu', 'Bombe Joui'],
  'Toushirou Hijikata': ['Ombre', 'Mayonnaise Démoniaque'], 'Sougo Okita': ['Feu', 'Bazooka Sadique'], 'Shinsuke Takasugi': ['Ombre', 'Lame du Kiheitai'],
  // Fullmetal Alchemist
  'Edward Elric': ['Terre', 'Transmutation Éclair'], 'Roy Mustang': ['Feu', 'Alchimie de Flamme'], 'Alphonse Elric': ['Terre', 'Armure Vivante'],
  'Riza Hawkeye': ['Feu', 'Tir de Précision'], 'Ling Yao': ['Ombre', 'Sabre de Xing'], 'Greed': ['Terre', 'Bouclier Ultime'],
  // JoJo
  'Joseph Joestar': ['Lumière', 'Hamon Overdrive'], 'Joutarou Kuujou': ['Combat', 'Star Platinum : ORA ORA', 'Jotaro Kujo'], 'Gyro Zeppeli': ['Vent', "Rotation d'Acier"],
  'Dio Brando': ['Ombre', 'The World : MUDA MUDA'], 'Jousuke Higashikata': ['Combat', 'Crazy Diamond : DORA', 'Josuke Higashikata'], 'Yoshikage Kira': ['Feu', 'Killer Queen'],
  'Jolyne Kuujou': ['Combat', 'Stone Free', 'Jolyne Kujo'], 'Johnny Joestar': ['Vent', 'Tusk Act 4'],
  // Mob Psycho 100
  'Arataka Reigen': ['Lumière', 'Salt Splash'], 'Shigeo Kageyama': ['Ombre', '???% Explosion Psychique', 'Mob'], 'Ekubo': ['Ombre', 'Possession'], 'Teruki Hanazawa': ['Feu', 'Épée Psychique'],
  // Bleach
  'Ichigo Kurosaki': ['Ombre', 'Getsuga Tensho'], 'Kisuke Urahara': ['Ombre', 'Benihime'], 'Rukia Kuchiki': ['Glace', 'Sode no Shirayuki'],
  'Yoruichi Shihouin': ['Foudre', 'Shunko'], 'Sousuke Aizen': ['Ombre', 'Kurohitsugi'], 'Kenpachi Zaraki': ['Combat', 'Nozarashi'],
  'Ulquiorra Cifer': ['Ombre', 'Lanza del Relámpago'], 'Grimmjow Jaegerjaquez': ['Vent', 'Desgarrón'],
  // Dragon Ball
  'Gokuu Son': ['Lumière', 'Kamehameha', 'Son Goku'], 'Vegeta': ['Feu', 'Final Flash'], 'Trunks': ['Lumière', 'Burning Attack'],
  'Gohan Son': ['Lumière', 'Masenko', 'Son Gohan'], 'Piccolo': ['Vent', 'Makankosappo'], 'Bulma': ['Foudre', 'Invention Capsule'],
  'Freeza': ['Ombre', 'Death Ball', 'Freezer'], 'Broly': ['Lumière', 'Gigantic Meteor'],
};
// entrées parasites à ignorer
const EXCLUDE = new Set(['Narrator', 'Lum']);

// ---------- Construction des personnages ----------
function hash(n) {
  let h = 2166136261;
  const s = String(n);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) { // petit générateur pseudo-aléatoire déterministe
  let x = seed || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}
// découpe une liste en n morceaux de tailles équilibrées
function chunks(arr, n) {
  const out = [];
  for (let k = 0; k < n; k++) out.push(arr.slice(Math.round((k * arr.length) / n), Math.round(((k + 1) * arr.length) / n)));
  return out;
}

// paliers de difficulté des sous-univers (index = position dans l'univers)
const TIERS = [
  { n: 'Débutant',      lv: [1, 10] },
  { n: 'Intermédiaire', lv: [10, 25] },
  { n: 'Confirmé',      lv: [25, 45] },
  { n: 'Expert',        lv: [45, 70] },
  { n: 'Maître',        lv: [70, 95] },
];
const XP_MARGIN = 10;              // on ne gagne plus d'XP au-delà de (niveau max de la zone + 10)
const ROTATION_MS = 12 * 3600 * 1000;
const ROTATION_SIZE = 5;
const TOKEN_DROP = 1 / 50;
const SANCT = {                    // zones de raid légendaires / mythiques (1 combat par paiement)
  L: { cost: 3, lv: 90, hp: 3.5, atk: 1.2 },
  M: { cost: 1, lv: 70, hp: 3, atk: 1.15 },
};

const CHARS = [];
const CH = {};
const SERIES = {};
const SUBZONES = {};               // id -> sous-univers
const UNIV_SUBS = {};              // univers -> [ids des sous-univers]
const UNIV_BOSSES = {};            // univers -> { RE: [...], L: [...], M: [...] }

UNIVERSES.forEach((u) => {
  SERIES[u.id] = u.n;
  const [nLeg, order, subNames] = STRENGTH[u.id];
  const list = u.chars.filter((c) => !EXCLUDE.has(c[1])).map(([aid, name, img, fav]) => ({ aid, name, img, fav }));
  // classement par force : la liste complète de tiers.js, puis les éventuels oubliés (les plus faibles)
  const key = (t) => t.replace(/\s+/g, ' ').trim().toLowerCase();
  const strong = [];
  for (const nm of order.split('|')) {
    const c = list.find((x) => key(x.name) === key(nm) && !x.ranked);
    if (c) { c.ranked = true; strong.push(c); }
  }
  const ranked = strong.concat(list.filter((c) => !c.ranked));  // du plus fort au plus faible
  const L = ranked.slice(0, nLeg), M = ranked.slice(nLeg, nLeg + 3);
  const others = ranked.slice(nLeg + 3);
  const nE = Math.round(others.length * 0.1), nR = Math.round(others.length * 0.2);
  const groups = { M, L, E: others.slice(0, nE), R: others.slice(nE, nE + nR), C: others.slice(nE + nR) };

  // 2 à 5 sous-univers selon le nombre de personnages (~19 par sous-univers), répartis sur les paliers
  const nSubs = Math.max(2, Math.min(5, Math.round(others.length / 19)));
  const tiersOf = Array.from({ length: nSubs }, (_, i) => Math.round((i * (TIERS.length - 1)) / (nSubs - 1)));
  const subIds = tiersOf.map((t) => `${u.id}-${t}`);
  UNIV_SUBS[u.id] = subIds;
  const subPools = subIds.map(() => []);

  for (const r of ['L', 'M', 'E', 'R', 'C']) {
    const g = groups[r];
    g.forEach((x, i) => {
      const rnd = rng(hash(x.aid));
      const o = OVR[x.name];
      const type = o ? o[0] : TYPE_LIST[Math.floor(rnd() * TYPE_LIST.length)];
      let t2 = TYPE_LIST[Math.floor(rnd() * TYPE_LIST.length)];
      if (t2 === type) t2 = TYPE_LIST[(TYPE_LIST.indexOf(type) + 3) % TYPE_LIST.length];
      const w = [0, 0, 0, 0].map(() => 0.7 + rnd() * 0.6);
      const ws = w.reduce((a, b) => a + b, 0);
      // les plus forts d'une même rareté ont un peu plus de stats
      const power = g.length > 1 ? 1 - i / (g.length - 1) : 1;
      const budget = RARITY[r].budget * (1 + 0.08 * power);
      const b = w.map((v) => Math.round((v / ws) * budget));
      const sig = o ? o[1] : SIG_POOL[type][Math.floor(rnd() * SIG_POOL[type].length)];
      const c = { id: 'a' + x.aid, aid: x.aid, raw: x.name, n: (o && o[2]) || x.name, s: u.id, type, t2, r, b, sig, img: x.img, fav: x.fav, power: ranked.indexOf(x) };
      CHARS.push(c); CH[c.id] = c;
    });
    // répartition dans les sous-univers : les plus faibles dans les premiers
    if (r === 'E' || r === 'R' || r === 'C') {
      chunks([...g].reverse(), subIds.length).forEach((part, k) => part.forEach((x) => { subPools[k].push('a' + x.aid); CH['a' + x.aid].sub = subIds[k]; }));
    }
  }
  subIds.forEach((id, i) => {
    const k = tiersOf[i];
    const pool = subPools[i].filter((cid) => 'CRE'.includes(CH[cid].r)).map((cid) => [cid, RARITY[CH[cid].r].w]);
    SUBZONES[id] = { id, kind: 'sub', u: u.id, k, n: subNames[k], i: u.i, bg: u.bg, lv: TIERS[k].lv, pool };
  });
  UNIV_BOSSES[u.id] = {
    RE: [...groups.E, ...groups.R].map((x) => 'a' + x.aid),     // chasses aux boss
    L: groups.L.map((x) => 'a' + x.aid),                        // raids légendaires (3 tokens)
    M: groups.M.map((x) => 'a' + x.aid),                        // raids mythiques (1 token)
  };
});

// ---------- Rotation : 5 sous-univers de 5 univers différents, un par palier, toutes les 12 h ----------
function rotationSlot(t = Date.now()) { return Math.floor(t / ROTATION_MS); }
function rotation(slot = rotationSlot()) {
  const r = rng(hash('rotation-' + slot));
  const ids = UNIVERSES.map((u) => u.id);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  // un sous-univers par palier, chacun d'un univers différent
  const used = new Set(), out = [];
  for (let k = 0; k < ROTATION_SIZE; k++) {
    const uid = ids.find((x) => !used.has(x) && SUBZONES[`${x}-${k}`]);
    used.add(uid); out.push(SUBZONES[`${uid}-${k}`]);
  }
  return out;
}
// chasses aux boss : un par univers de la rotation, au même palier que son sous-univers
function huntsOf(rot) {
  return rot.map((z) => {
    const u = UNIVERSES.find((x) => x.id === z.u);
    return { id: z.u + '-hunt', kind: 'hunt', u: z.u, k: z.k, n: 'Chasse : ' + u.n, i: '👑', bg: u.bg, lv: z.lv, pool: UNIV_BOSSES[z.u].RE.map((id) => [id, 1]) };
  });
}

// premiers compagnons : des héros principaux de rang épique (jamais légendaires ni mythiques)
const STARTERS = ['Luffy Monkey', 'Tanjirou Kamado', 'Yuuji Itadori']
  .map((n) => CHARS.find((c) => c.n === ((OVR[n] && OVR[n][2]) || n)))
  .filter((c) => c && 'CRE'.includes(c.r)).map((c) => c.id);

const SHOP = [
  { id: 'ramen',   n: 'Bol de Ramen',             i: '🍜', d: "Soigne entièrement toute l'équipe.",                   p: 40 },
  { id: 'scroll',  n: 'Parchemin de recrutement', i: '📜', d: 'Double la chance de recruter lors du prochain combat.', p: 80 },
  { id: 'gscroll', n: 'Parchemin doré',           i: '🏮', d: 'Chance de recrutement ×5 pour le prochain combat.',    p: 400 },
  { id: 'book',    n: "Manuel d'entraînement",    i: '📘', d: "Fait gagner 1 niveau à un personnage.",               p: 200, scale: true },
  { id: 'sbook',   n: 'Grimoire secret',          i: '📕', d: 'Fait gagner 5 niveaux à un personnage.',               p: 900, scale: true },
  { id: 'orb',     n: "Orbe d'éveil",             i: '🔮', d: 'Éveille un personnage : aura dorée et +15% de stats.', p: 300, gems: true },
  { id: 'fragbox', n: 'Coffret de fragments',     i: '🧩', d: "Donne 30 fragments d'un personnage possédé au hasard.", p: 60, gems: true },
];

const ACHIEVEMENTS = [
  { id: 'c10',   n: 'Recruteur',          d: 'Posséder 10 personnages',              g: 20,  t: () => ownedCount() >= 10 },
  { id: 'c50',   n: 'Chef de clan',       d: 'Posséder 50 personnages',              g: 60,  t: () => ownedCount() >= 50 },
  { id: 'c200',  n: 'Collectionneur',     d: 'Posséder 200 personnages',             g: 150, t: () => ownedCount() >= 200 },
  { id: 'c500',  n: 'Archiviste',         d: 'Posséder 500 personnages',             g: 300, t: () => ownedCount() >= 500 },
  { id: 'c1000', n: 'Bibliothèque vivante', d: 'Posséder 1 000 personnages',         g: 600, t: () => ownedCount() >= 1000 },
  { id: 'call',  n: 'Encyclopédie complète', d: 'Posséder tous les personnages',     g: 3000, t: () => ownedCount() >= CHARS.length },
  { id: 'u1',    n: 'Fan absolu',         d: 'Compléter un univers entier',          g: 200, t: () => Object.keys(SERIES).some((s) => CHARS.every((c) => c.s !== s || S.roster[c.id])) },
  { id: 'k100',  n: 'Échauffement',       d: 'Vaincre 100 adversaires',              g: 20,  t: (s) => s.stats.kills >= 100 },
  { id: 'k1000', n: 'Vétéran',            d: 'Vaincre 1 000 adversaires',            g: 80,  t: (s) => s.stats.kills >= 1000 },
  { id: 'k10k',  n: 'Légende des arènes', d: 'Vaincre 10 000 adversaires',           g: 250, t: (s) => s.stats.kills >= 10000 },
  { id: 'l25',   n: 'Genin',              d: 'Un personnage niveau 25',              g: 20,  t: () => maxLevel() >= 25 },
  { id: 'l50',   n: 'Chûnin',             d: 'Un personnage niveau 50',              g: 60,  t: () => maxLevel() >= 50 },
  { id: 'l100',  n: 'Hokage',             d: 'Un personnage niveau 100',             g: 200, t: () => maxLevel() >= 100 },
  { id: 'h10',   n: 'Chasseur de boss',   d: 'Vaincre 10 boss en chasse',            g: 30,  t: (s) => s.stats.bosses >= 10 },
  { id: 'h500',  n: 'Traqueur légendaire', d: 'Vaincre 500 boss en chasse',          g: 200, t: (s) => s.stats.bosses >= 500 },
  { id: 'tok1',  n: 'Premier token',      d: 'Obtenir un token de boss',             g: 30,  t: (s) => s.stats.tokens >= 1 },
  { id: 'leg1',  n: 'Légende vivante',    d: 'Recruter un personnage légendaire',    g: 300, t: () => CHARS.some((c) => c.r === 'L' && S.roster[c.id]) },
  { id: 'myth1', n: 'Mythe',              d: 'Recruter un personnage mythique',      g: 150, t: () => CHARS.some((c) => c.r === 'M' && S.roster[c.id]) },
  { id: 'sh1',   n: 'Éveil',              d: 'Posséder un personnage éveillé',       g: 50,  t: (s) => Object.values(s.roster).some((m) => m.shiny) },
  { id: 'st5',   n: 'Cinq étoiles',       d: 'Monter un personnage à 5 étoiles',     g: 100, t: (s) => Object.values(s.roster).some((m) => m.stars >= 5) },
  { id: 'p10',   n: 'Invocateur',         d: 'Faire 10 invocations',                 g: 30,  t: (s) => s.stats.pulls >= 10 },
  { id: 'p100',  n: 'Grand invocateur',   d: 'Faire 100 invocations',                g: 120, t: (s) => s.stats.pulls >= 100 },
  { id: 'gold',  n: 'Trésor de Roger',    d: 'Gagner 100 000 pièces au total',       g: 100, t: (s) => s.stats.goldEarned >= 100000 },
];
