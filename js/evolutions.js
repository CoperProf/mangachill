// ====== Évolutions ======
// Chaque univers a un objet rare qui tombe en combat dans ses zones (sous-univers, chasses, raids).
// Certains personnages emblématiques peuvent évoluer avec ces objets : chaque forme augmente les stats
// et remplace la technique signature.

const EVO_ITEMS = {
  naruto:    { n: 'Chakra de Bijû',            i: '🦊' },
  op:        { n: 'Essence de Haki',           i: '🌀' },
  ds:        { n: 'Marque du Pourfendeur',     i: '🔥' },
  mha:       { n: "Fragment d'Alter",          i: '💥' },
  haikyuu:   { n: 'Ballon de Match',           i: '🏐' },
  bc:        { n: 'Page de Grimoire',          i: '📖' },
  ft:        { n: 'Lacrima de Dragon',         i: '🐲' },
  soul:      { n: 'Âme de Kishin',             i: '👁️' },
  jjk:       { n: 'Doigt de Sukuna',           i: '☝️' },
  bluelock:  { n: "Étincelle d'Ego",           i: '⚡' },
  aot:       { n: 'Sérum de Titan',            i: '💉' },
  sds:       { n: 'Commandement',              i: '⚜️' },
  reborn:    { n: 'Anneau Vongola',            i: '💍' },
  fireforce: { n: 'Flamme Adolla',             i: '🕯️' },
  hxh:       { n: 'Carte de Greed Island',     i: '🃏' },
  inuyasha:  { n: 'Éclat du Shikon',           i: '🔮' },
  yyh:       { n: 'Énergie Spirituelle',       i: '👻' },
  sailor:    { n: "Cristal d'Argent",          i: '💎' },
  conan:     { n: 'Antidote APTX',             i: '💊' },
  tg:        { n: 'Cellules RC',               i: '🩸' },
  csm:       { n: 'Cœur de Démon',             i: '🫀' },
  drstone:   { n: 'Liquide de Résurrection',   i: '🧪' },
  opm:       { n: 'Limiteur Brisé',            i: '⛓️' },
  sao:       { n: 'Item de Rang S',            i: '🗡️' },
  gintama:   { n: 'Sabre de Bois du Lac Tôya', i: '🪵' },
  fma:       { n: 'Pierre Philosophale',       i: '🔴' },
  jojo:      { n: 'Flèche de Stand',           i: '🏹' },
  mob:       { n: 'Jauge Émotionnelle',        i: '💯' },
  bleach:    { n: 'Fragment de Hōgyoku',       i: '💠' },
  db:        { n: 'Dragon Ball',               i: '🐉' },
  spy:          { n: 'Dossier Top Secret',        i: '🗂️' },
  tr:           { n: 'Uniforme du Toman',         i: '🧥' },
  knb:          { n: 'Zone',                      i: '🏀' },
  rezero:       { n: "Facteur de Sorcière",       i: '🖤' },
  shaman:       { n: 'Esprit Gardien',            i: '👻' },
  vinland:      { n: 'Dague de Thors',            i: '🗡️' },
  berserk:      { n: 'Béhélit',                   i: '🥚' },
  fate:         { n: 'Sceau de Commandement',     i: '🔺' },
  geass:        { n: 'Contrat de Geass',          i: '👁️' },
  deathnote:    { n: 'Page du Death Note',        i: '📓' },
  yugioh:       { n: 'Objet du Millénaire',       i: '🔺' },
  seiya:        { n: 'Sang de Divinité',          i: '🩸' },
  hokuto:       { n: 'Secret du Hokuto',          i: '✴️' },
  dandadan:     { n: 'Testicule Doré',            i: '🟡' },
  kaiju:        { n: 'Noyau de Kaiju',            i: '🦖' },
  frieren:      { n: 'Grimoire Ancien',           i: '📘' },
  sololeveling: { n: "Cristal d'Ombre",           i: '🔷' },
  jigokuraku:   { n: 'Tan du Hōrai',              i: '🌺' },
  neverland:    { n: 'Stylo de William Minerva',  i: '🖊️' },
  magi:         { n: 'Récipient Métallique',      i: '🪔' },
};

// chances de trouver l'objet de l'univers après une victoire
const EVO_DROP = { sub: 0.012, hunt: 0.04, sanct: 1 };
// coût de chaque forme : objets nécessaires et niveau minimum
const EVO_STEPS = [{ cost: 3, lvl: 30 }, { cost: 6, lvl: 55 }, { cost: 10, lvl: 80 }];
const EVO_BONUS = 0.18;            // +18 % de stats par forme

// nom AniList -> [[forme, technique], ...]
const EVOLUTIONS = {
  // Naruto
  'Naruto Uzumaki': [['Mode Ermite', 'Rasen Shuriken'], ['Mode Kurama', 'Bijû Dama'], ['Mode Baryon', 'Rasengan Baryon']],
  'Sasuke Uchiha': [['Mangekyô Sharingan', 'Susanô'], ['Rinnegan', "Flèche d'Indra"]],
  'Kakashi Hatake': [['Mangekyô Sharingan', 'Kamui'], ['Susanô Parfait', 'Kamui Raikiri']],
  'Guy Might': [['Huitième Porte', 'Paon du Soir'], ['Porte de la Mort', 'Éléphant de Nuit']],
  'Madara Uchiha': [['Edo Tensei', 'Météore Tengai'], ['Rikudô', 'Limbo']],
  'Itachi Uchiha': [['Susanô', 'Lame de Totsuka']],
  'Boruto Uzumaki': [['Jôgan', 'Rasengan Invisible'], ['Karma', 'Rasengan Karma']],
  // One Piece
  'Luffy Monkey': [['Gear 2', 'Jet Pistol'], ['Gear 4', 'Kong Gun'], ['Gear 5', 'Bajrang Gun']],
  'Zoro Roronoa': [['Asura', 'Ashura Ichibugin'], ['Roi des Enfers', 'Shi Shishi Sonson']],
  'Sanji': [['Raid Suit', 'Diable Jambe Ultime'], ['Ifrit Jambe', 'Ifrit Jambe']],
  'Usopp': [['Roi des Snipers', 'Étoile Fourmilière']],
  'Law Trafalgar': [['Éveil', 'K-Room : Shambles']],
  'Kid Eustass': [['Éveil', 'Damned Punk']],
  // Demon Slayer
  'Tanjirou Kamado': [['Marque du Pourfendeur', 'Hinokami Kagura'], ['Monde Transparent', 'Treizième Forme']],
  'Zenitsu Agatsuma': [['Mode Sommeil', 'Six Éclairs'], ['Dieu du Tonnerre', 'Honoikazuchi no Kami']],
  'Inosuke Hashibira': [['Marque', 'Croc Lacérant']],
  'Nezuko Kamado': [['Forme Démoniaque', 'Sang Explosif Ultime'], ['Résistance au Soleil', 'Flamme Solaire']],
  'Giyuu Tomioka': [['Marque', 'Calme Plat Absolu']],
  // My Hero Academia
  'Izuku Midoriya': [['Full Cowl 20 %', 'St. Louis Smash'], ['One For All 45 %', 'Delaware Detroit Smash'], ['One For All 100 %', 'United States of Smash']],
  'Katsuki Bakugou': [['Cluster', 'Howitzer Impact Ultime']],
  'Shouto Todoroki': [['Phosphore', 'Flashfreeze Heatwave']],
  'Toshinori Yagi': [['Prime', 'Texas Smash']],
  // Haikyu
  'Shouyou Hinata': [['Ninja Shouyou', 'Attaque Synchronisée']],
  'Tobio Kageyama': [['Roi du Terrain', 'Passe Parfaite']],
  // Black Clover
  'Asta': [['Forme Démon Noir', 'Black Divider'], ['Union Démoniaque', 'Black Meteorite']],
  'Yuno': [['Esprit Étoilé', 'Étoile du Zéphyr'], ['Mode Spade', 'Mana Zone : Spirit Stars']],
  'Noelle Silva': [['Valkyrie', 'Lance Valkyrie']],
  // Fairy Tail
  'Natsu Dragneel': [['Dragon Force', 'Lotus Explosif'], ['END', 'Flamme Démoniaque']],
  'Gray Fullbuster': [['Ice Devil Slayer', 'Zettai Ryôiki']],
  'Erza Scarlet': [['Armure Nakagami', 'Nakagami Starlight']],
  'Lucy Heartfilia': [['Star Dress', 'Urano Metria Ultime']],
  'Laxus Dreyar': [['Dragon Force', 'Hurlement du Dragon de Foudre']],
  // Soul Eater
  'Maka Albarn': [['Chasseur de Kishin', 'Kishin Hunter']],
  'Death the Kid': [['Lignes de Sanzu complètes', 'Death Cannon Ultime']],
  // Jujutsu Kaisen
  'Yuuji Itadori': [['Black Flash Maîtrisé', 'Black Flash Enchaîné'], ['Extension du Territoire', 'Démantèlement']],
  'Megumi Fushiguro': [['Chimère des Ombres', 'Jardin des Ombres']],
  'Satoru Gojou': [['Six Yeux', 'Rouge Inversé'], ['Extension du Territoire', 'Vide Infini']],
  'Yuuta Okkotsu': [['Rika Libérée', 'Amour Véritable']],
  'Sukuna': [['Forme Heian', 'Fuga Ultime']],
  // Blue Lock
  'Yoichi Isagi': [['Métavision Absolue', 'Tir Direct']],
  'Rin Itoshi': [['Flow Destructeur', 'Tir Fantôme']],
  // L'Attaque des Titans
  'Eren Yeager': [['Titan Assaillant', 'Frappe Durcie'], ['Titan Originel', 'Grand Terrassement']],
  'Armin Arlert': [['Titan Colossal', 'Explosion Colossale Ultime']],
  // Seven Deadly Sins
  'Meliodas': [['Mode Assault', 'Full Counter Ultime'], ['Roi Démon', 'Lame de l’Enfer']],
  'Escanor': [['The One', 'Cruel Sun Ultime']],
  'Ban': [['Purgatoire', 'Physical Hunt']],
  'King': [['Roi des Fées', 'Chastiefol Ultime']],
  // Reborn
  'Tsunayoshi Sawada': [['Hyper Dying Will', 'X-Burner Air'], ['Vongola Gear X', 'XX-Burner']],
  // Fire Force
  'Shinra Kusakabe': [['Adolla Link', 'Rapid Fire'], ['Shinra Banshô', 'Création du Monde']],
  'Arthur Boyle': [['Roi Chevalier', 'Excalibur Plasma Ultime']],
  // Hunter x Hunter
  'Gon Freecss': [['Gon Adulte', 'Jajanken Ultime']],
  'Killua Zoldyck': [['Godspeed', 'Whirlwind']],
  'Kurapika': [['Emperor Time', 'Chaîne du Jugement Ultime']],
  // Inuyasha
  'Inuyasha': [['Tessaiga Rouge', 'Bakuryûha'], ['Yôkai Pur', 'Meidô Zangetsuha']],
  'Sesshoumaru': [['Bakusaiga', 'Bakusaiga Ultime']],
  // Yu Yu Hakusho
  'Yuusuke Urameshi': [['Mazoku', 'Rei Gun Démoniaque']],
  'Kazuma Kuwabara': [['Épée Dimensionnelle', 'Lame Jigen']],
  'Hiei': [['Dragon Noir Maîtrisé', 'Jaô Ensatsu Kokuryûha']],
  // Sailor Moon
  'Usagi Tsukino': [['Super Sailor Moon', 'Rainbow Moon Heartache'], ['Eternal Sailor Moon', 'Silver Moon Crystal Power Kiss']],
  // Détective Conan
  'Conan Edogawa': [['Shinichi Kudo', 'Déduction Absolue']],
  // Tokyo Ghoul
  'Ken Kaneki': [['Kaneki Blanc', 'Kagune Centipède Ultime'], ['Roi Borgne', 'Dragon']],
  'Touka Kirishima': [['Ukaku Éveillé', 'Tempête de Plumes']],
  // Chainsaw Man
  'Denji': [['Chainsaw Man', 'Tronçonneuse Hurlante Ultime'], ['Véritable Chainsaw Man', "Rugissement de l'Enfer"]],
  'Power': [['Démon du Sang', 'Marteau de Sang Ultime']],
  // Dr. Stone
  'Senkuu Ishigami': [['Royaume de la Science', 'Fusée Scientifique']],
  // One Punch Man
  'Saitama': [['Mode Sérieux', 'Série Sérieuse : Poing Sérieux']],
  'Garou': [['Monstre Cosmique', 'Poing de Peur Cosmique']],
  'Genos': [['Arsenal Ultime', 'Canon Incinérateur Ultime']],
  // Sword Art Online
  'Kazuto Kirigaya': [['Double Lame', 'Starburst Stream'], ['Superviseur Système', 'Release Recollection']],
  'Asuna Yuuki': [['Stacia', 'Flash Pénétrant Ultime']],
  // Gintama
  'Gintoki Sakata': [['Shiroyasha', 'Sabre du Démon Blanc']],
  // Fullmetal Alchemist
  'Edward Elric': [['Alchimie sans Cercle', 'Transmutation Totale']],
  'Roy Mustang': [['Flamme Ultime', 'Brasier de Mustang']],
  // JoJo
  'Joutarou Kuujou': [['Star Platinum : The World', 'ORA ORA Temporel']],
  'Giorno Giovanna': [['Gold Experience Requiem', 'Retour au Néant']],
  'Johnny Joestar': [['Tusk Act 4', 'Rotation Infinie']],
  // Mob Psycho 100
  'Shigeo Kageyama': [['Mob 100 %', 'Explosion Psychique'], ['???%', 'Explosion ???%']],
  // Bleach
  'Ichigo Kurosaki': [['Bankai', 'Getsuga Tenshô Noir'], ['Hollow', 'Gran Rey Cero'], ['Mugetsu', 'Mugetsu']],
  'Rukia Kuchiki': [['Bankai', 'Hakka no Togame']],
  'Renji Abarai': [['Bankai', 'Sôô Zabimaru']],
  'Byakuya Kuchiki': [['Bankai', 'Senkei Senbonzakura']],
  'Toushirou Hitsugaya': [['Bankai Adulte', 'Hyôten Hyakkasô']],
  'Sousuke Aizen': [['Fusion avec le Hôgyoku', 'Kurohitsugi Complet']],
  // Dragon Ball
  'Gokuu Son': [['Super Saiyan', 'Kamehameha Super Saiyan'], ['Super Saiyan Blue', 'Kamehameha Blue'], ['Ultra Instinct', 'Kamehameha Ultra Instinct']],
  'Vegeta': [['Super Saiyan', 'Big Bang Attack'], ['Super Saiyan Blue', 'Final Flash Blue'], ['Ultra Ego', 'Hakai']],
  'Gohan Son': [['Super Saiyan 2', 'Kamehameha Père-Fils'], ['Gohan Beast', 'Makankosappo Beast']],
  'Trunks': [['Super Saiyan', 'Burning Attack Ultime']],
  'Freeza': [['Golden Freezer', 'Golden Death Ball'], ['Black Freezer', 'Death Saucer Noire']],
  'Piccolo': [['Piccolo Orange', 'Makankosappo Géant']],
  'Broly': [['Super Saiyan Légendaire', 'Gigantic Roar']],
  // univers ajoutés
  'Yor Forger': [['Thorn Princess', 'Rose Épineuse']],
  'Loid Forger': [['Agent Twilight', 'Opération Strix']],
  'Manjirou Sano': [['Invincible Mikey', 'Coup de Pied Fatal'], ['Impulsion Noire', 'Pulsion des Ténèbres']],
  'Ken Ryuuguji': [['Draken du Toman', 'Poing du Dragon']],
  'Takemichi Hanagaki': [['Leader du Toman', 'Volonté Indomptable']],
  'Taiga Kagami': [['Zone', 'Meteor Jam']],
  'Tetsuya Kuroko': [['Phantom Shot', 'Vanishing Drive']],
  'Seijuurou Akashi': [['Emperor Eye', 'Zone Parfaite']],
  'Subaru Natsuki': [['Autorité de la Paresse', 'Main Invisible'], ['Retour par la Mort', 'Cor Leonis']],
  'Emilia': [['Demi-Elfe Libérée', 'Prison de Glace Éternelle']],
  'Yoh Asakura': [['Over Soul', 'Lame Céleste'], ['Esprit de la Terre', 'Lame du Grand Esprit']],
  'Ren Tao': [['Over Soul Bason', 'Guandao Doré']],
  'Hao Asakura': [['Esprit du Feu', 'Brasier Spirituel'], ['Roi des Shamans', 'Grand Esprit']],
  'Thorfinn Karlsefni': [['Vrai Guerrier', 'Sans Ennemis']],
  'Guts': [['Armure du Berserker', 'Furie du Berserker'], ['Bête des Ténèbres', 'Lame Tranche-Dragon']],
  'Griffith': [['Femto', 'Éclipse']],
  'Shirou Emiya': [['Unlimited Blade Works', 'Unlimited Blade Works']],
  'Artoria Pendragon': [['Excalibur Libérée', 'Excalibur']],
  'Lelouch Lamperouge': [['Zero', 'Geass Absolu'], ['Empereur Démon', 'Requiem Zero']],
  'Suzaku Kururugi': [['Knight of Zero', 'Lancelot Albion']],
  'Light Yagami': [['Kira', 'Plan Parfait'], ['Dieu du Nouveau Monde', 'Jugement Divin']],
  'Yami Yuugi': [['Pharaon Atem', 'Chevalier Noir Suprême']],
  'Seto Kaiba': [["Dragon Blanc aux Yeux Bleus Ultime", 'Burst Stream Ultime']],
  'Seiya': [['Armure d’Or du Sagittaire', 'Météores de Pégase'], ['Armure Divine', 'Comète de Pégase']],
  'Ikki': [['Armure Divine', 'Ailes du Phénix']],
  'Kenshirou': [['Musō Tensei', 'Hokuto Ujō Mōshō Ken']],
  'Raoh': [['Roi du Poing', 'Tenshō Hyakuretsu Ken']],
  'Ken Takakura': [['Forme Turbo', 'Course Turbo']],
  'Momo Ayase': [['Pouvoirs Psychiques Éveillés', 'Main Spirituelle']],
  'Kafka Hibino': [['Kaiju n°8', 'Poing de Kaiju'], ['Kaiju n°8 Complet', 'Frappe Destructrice']],
  'Frieren': [['Grande Mage', 'Zoltraak Ultime']],
  'Fern': [['Mage de Première Classe', 'Zoltraak Rapide']],
  'Jin-U Seong': [['Nécromancien', 'Lève-toi'], ['Monarque des Ombres', 'Domaine du Monarque']],
  'Gabimaru': [['Gabimaru le Vide', 'Ninpō : Kagaribi'], ['Tao Maîtrisé', 'Flamme du Tao']],
  'Emma': [['Promesse Éternelle', 'Évasion Parfaite']],
  'Aladdin': [['Magi Éveillé', 'Lumière de Salomon']],
  'Alibaba Saluja': [['Équipement Djinn', 'Amon Sayf'], ['Équipement Complet', 'Flamme d’Amon']],
  'Sinbad': [['Équipement Djinn', 'Baararaq Saiqa'], ['Huit Djinns', 'Volonté de Salomon']],
};

// relie chaque évolution à son personnage
for (const [raw, forms] of Object.entries(EVOLUTIONS)) {
  const c = CHARS.find((x) => x.raw === raw);
  if (c) c.evos = forms.map(([n, sig], i) => ({ n, sig, ...EVO_STEPS[i] }));
}
ACHIEVEMENTS.push(
  { id: 'evo1', n: 'Transformation', d: 'Faire évoluer un personnage', g: 50, t: (s) => Object.values(s.roster).some((m) => m.evo > 0) },
  { id: 'evoMax', n: 'Forme ultime', d: 'Amener un personnage à sa forme finale', g: 150, t: (s) => Object.values(s.roster).some((m) => m.evo > 0 && CH[m.id].evos && m.evo >= CH[m.id].evos.length) },
);
