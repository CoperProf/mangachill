// ====== Tour des Maîtres ======
// Une série de combats contre des équipes de boss (non recrutables), comme les arènes de PokeChill.
// Le niveau maximum de tes personnages est bloqué : chaque étage vaincu le relève de 10 niveaux.

const LEVEL_CAP_START = 20;
const TOWER_HP = 1.4, TOWER_ATK = 1.05, TOWER_LEADER_HP = 1.9;   // le dernier de l'équipe est le chef

// noms AniList, du premier adversaire au chef
const TOWER = [
  { n: 'Les Sannin Légendaires',      i: '🐸', bg: ['#1f6b3a', '#d0a24a'], lv: 20,  team: ['Orochimaru', 'Tsunade Senju', 'Jiraiya'] },
  { n: 'Les Lunes Démoniaques',       i: '🌙', bg: ['#2a1438', '#c02a4a'], lv: 30,  team: ['Rui', 'Enmu', 'Gyokko', 'Hantengu'] },
  { n: 'Les Espada',                  i: '💀', bg: ['#1a1a1a', '#e0e0e0'], lv: 40,  team: ['Nnoitra Gilga', 'Grimmjow Jaegerjaquez', 'Tier Harribel', 'Baraggan Louisenbairn', 'Ulquiorra Cifer'] },
  { n: 'La Brigade Fantôme',          i: '🕷️', bg: ['#2a1a3a', '#8a5cf6'], lv: 50,  team: ['Nobunaga Hazama', 'Phinks Magcub', 'Feitan Portor', 'Uvogin', 'Chrollo Lucilfer'] },
  { n: "L'Akatsuki",                  i: '☁️', bg: ['#1b1b2e', '#c8202a'], lv: 60,  team: ['Deidara', 'Sasori', 'Kakuzu', 'Kisame Hoshigaki', 'Pain', 'Itachi Uchiha'] },
  { n: 'Les Fléaux de Shibuya',       i: '👹', bg: ['#1b2440', '#7a1a2a'], lv: 70,  team: ['Dagon', 'Hanami', 'Jougo', 'Mahito', 'Kenjaku', 'Sukuna'] },
  { n: 'Les Rois des Mers',           i: '🏴‍☠️', bg: ['#0f2a4a', '#d0a020'], lv: 80,  team: ['Teach Marshall', 'Linlin Charlotte', 'Kaidou', 'Shanks', 'Newgate Edward', 'Roger Gold'] },
  { n: 'Les Dieux de la Destruction', i: '🪐', bg: ['#2a0a4a', '#6ad0ff'], lv: 90,  team: ['Toppo', 'Jiren', 'Champa', 'Beerus', 'Whis', 'Daishinkan'] },
  { n: 'Le Sommet du Multivers',      i: '🌌', bg: ['#140a2e', '#ff3b7a'], lv: 100, team: ['Lucifero', 'Acnologia', 'Yhwach', 'Kaguya Ootsutsuki', 'Meruem', 'Saitama'] },
];
// niveau max atteint après avoir vaincu l'étage k (le dernier étage ne relève plus le plafond)
TOWER.forEach((f, k) => {
  f.cap = Math.min(100, LEVEL_CAP_START + 10 * (k + 1));
  f.gems = 30 * (k + 1);
  f.ids = f.team.map((raw) => CHARS.find((c) => c.raw === raw)).filter(Boolean).map((c) => c.id);
});

ACHIEVEMENTS.push(
  { id: 'tw1', n: 'Premier étage', d: 'Vaincre le premier étage de la Tour', g: 30,  t: (s) => s.tower >= 1 },
  { id: 'tw5', n: 'Grimpeur',      d: 'Vaincre 5 étages de la Tour',        g: 100, t: (s) => s.tower >= 5 },
  { id: 'tw9', n: 'Maître de la Tour', d: 'Vaincre le Sommet du Multivers', g: 500, t: (s) => s.tower >= TOWER.length },
);

// ====== Boss de fin de jeu ======
// Débloqués après le Sommet. Combats en solo contre un boss à plusieurs barres de vie (2, 3 ou 4 selon la
// difficulté), aux stats renforcées, qui devient plus agressif à chaque barre brisée. Non recrutables.
const FINAL_TIERS = {
  2: { n: 'Redoutable',  hp: 2.2, atk: 1.35, def: 1.3,  spd: 1.15, gems: 300 },
  3: { n: 'Cauchemar',   hp: 2.6, atk: 1.55, def: 1.45, spd: 1.25, gems: 500 },
  4: { n: 'Apocalypse',  hp: 3.0, atk: 1.8,  def: 1.6,  spd: 1.35, gems: 800 },
};
const FINAL_RAGE = 1.1;            // +10 % d'attaque à chaque barre brisée
const ENDGAME = [
  { raw: 'Madara Uchiha',   t: 'Madara Rikudô',             bars: 2, bg: ['#2a0a0a', '#c8202a'] },
  { raw: 'Sousuke Aizen',   t: 'Aizen fusionné au Hōgyoku', bars: 2, bg: ['#1a1a2a', '#8a5cf6'] },
  { raw: 'Muzan Kibutsuji', t: 'Muzan, Roi des Démons',     bars: 2, bg: ['#2a0a1a', '#ff3b5c'] },
  { raw: 'All For One',     t: 'All For One',               bars: 2, bg: ['#0a0a0a', '#6a6a8a'] },
  { raw: 'Zeref',           t: 'Zeref, le Mage Noir',       bars: 3, bg: ['#0a0a1a', '#3a3aff'] },
  { raw: 'Dio Brando',      t: 'DIO, The World',            bars: 3, bg: ['#2a2a0a', '#ffd23f'] },
  { raw: 'Void',            t: 'Void, la Main de Dieu',     bars: 3, bg: ['#1a0a0a', '#8a1a1a'] },
  { raw: 'Ashborn',         t: 'Ashborn, Monarque des Ombres', bars: 3, bg: ['#0a0a2a', '#4a6aff'] },
  { raw: 'Sukuna',          t: 'Sukuna, Forme Heian',       bars: 4, bg: ['#2a0a0a', '#ff6a2a'] },
  { raw: 'Hades',           t: 'Hadès, Empereur des Enfers', bars: 4, bg: ['#0a0a1a', '#9b6bff'] },
  { raw: 'Daishinkan',      t: 'Le Grand Prêtre',           bars: 4, bg: ['#0a1a2a', '#6ad0ff'] },
  { raw: 'Saitama',         t: 'Saitama, Mode Sérieux',     bars: 4, bg: ['#2a2a0a', '#ffe06a'] },
];
ENDGAME.forEach((b) => { const c = CHARS.find((x) => x.raw === b.raw); b.id = c && c.id; b.lv = 100; });
ACHIEVEMENTS.push(
  { id: 'fb1',  n: 'Tueur de légendes', d: 'Vaincre un boss de fin de jeu',       g: 100,  t: (s) => s.endgame >= 1 },
  { id: 'fb8',  n: 'Fléau des fléaux',  d: 'Vaincre 8 boss de fin de jeu',        g: 300,  t: (s) => s.endgame >= 8 },
  { id: 'fbAll', n: 'Au-delà du sommet', d: 'Vaincre tous les boss de fin de jeu', g: 1000, t: (s) => s.endgame >= ENDGAME.length },
);
