// app.js — Cartas del Mundo
// Funciones principales del juego + fixes de compatibilidad vitrina de logros

/* ========= Utilidades ========= */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
let gameRng = Math.random;
const randomInt = n => Math.floor(gameRng() * n);
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=randomInt(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function leagueRandom(seed){
  let state = seed >>> 0;
  return () => { state = (Math.imul(state,1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
const todayStr = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
};

function isoWeekStringLocal(d=new Date()){
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNum = (date.getDay() || 7);
  date.setDate(date.getDate() + 4 - dayNum);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getFullYear()}-W${String(weekNo).padStart(2,'0')}`;
}

function flagUrl(code){ return `https://flagcdn.com/w320/${code}.png`; }
function regionBadge(r){ return r || 'Other'; }
function escapeCardText(value){ return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }

/* ========= Config ========= */
const LEVELS = {
  kids:   { label: 'Niños',   time: 15, wrongPenalty: 0 },
  adult:  { label: 'Adultos', time: 12, wrongPenalty: 0 },
  master: { label: 'Máster',  time:  8, wrongPenalty: -5 },
};
const MAX_Q = 10;

// Supervivencia: el reloj depende de la dificultad elegida.
const SURVIVAL_LEVELS = {
  kids:   { start: 25 },
  adult:  { start: 20 },
  master: { start: 15 }
};
function survivalRules(){ return SURVIVAL_LEVELS[currentLevel] || SURVIVAL_LEVELS.adult; }

/* ========= Capitales ES (map) ========= */
const CAPITAL_ES = {
  "Amsterdam":"Ámsterdam","Athens":"Atenas","Berlin":"Berlín","Berne":"Berna","Bern":"Berna","Brussels":"Bruselas","Bucharest":"Bucarest","Budapest":"Budapest","Chisinau":"Chisináu","Copenhagen":"Copenhague","Dublin":"Dublín","Helsinki":"Helsinki","Kyiv":"Kiev","Kiev":"Kiev","Lisbon":"Lisboa","Ljubljana":"Liubliana","London":"Londres","Luxembourg":"Luxemburgo","Madrid":"Madrid","Minsk":"Minsk","Monaco":"Mónaco","Moscow":"Moscú","Nicosia":"Nicosia","Oslo":"Oslo","Paris":"París","Podgorica":"Podgorica","Prague":"Praga","Reykjavik":"Reikiavik","Riga":"Riga","Rome":"Roma","San Marino":"San Marino","Sarajevo":"Sarajevo","Skopje":"Skopie","Sofia":"Sofía","Stockholm":"Estocolmo","Tallinn":"Tallin","Tirana":"Tirana","Vaduz":"Vaduz","Valletta":"La Valeta","Vatican City":"Ciudad del Vaticano","Vienna":"Viena","Vilnius":"Vilna","Warsaw":"Varsovia","Zagreb":"Zagreb",
  "Abu Dhabi":"Abu Dabi","Amman":"Amán","Ankara":"Ankara","Astana":"Astaná","Baghdad":"Bagdad","Baku":"Bakú","Beijing":"Pekín","Peking":"Pekín","Beirut":"Beirut","Damascus":"Damasco","Dhaka":"Daca","Doha":"Doha","Hanoi":"Hanói","Islamabad":"Islamabad","Jakarta":"Yakarta","Jerusalem":"Jerusalén","Kabul":"Kabul","Kathmandu":"Katmandú","Kuala Lumpur":"Kuala Lumpur","Manila":"Manila","Muscat":"Mascate","New Delhi":"Nueva Delhi","Nur-Sultan":"Astaná","Phnom Penh":"Nom Pen","Riyadh":"Riad","Seoul":"Seúl","Singapore":"Singapur","Sri Jayawardenepura Kotte":"Sri Jayawardenapura Kotte","Taipei":"Taipéi","Tashkent":"Taskent","Tehran":"Teherán","Thimphu":"Timbu","Tokyo":"Tokio","Ulaanbaatar":"Ulán Bator","Vientiane":"Vientián","Sanaa":"Saná",
  "Canberra":"Canberra","Suva":"Suva","Wellington":"Wellington","Port Moresby":"Port Moresby","Apia":"Apia","Nukuʻalofa":"Nukualofa","Nuku'alofa":"Nukualofa","Honiara":"Honiara","Funafuti":"Funafuti",
  "Buenos Aires":"Buenos Aires","Asunción":"Asunción","Asuncion":"Asunción","Bogotá":"Bogotá","Brasília":"Brasilia","Brasilia":"Brasilia","Caracas":"Caracas","Georgetown":"Georgetown","Lima":"Lima","La Paz":"La Paz","Sucre":"Sucre","Montevideo":"Montevideo","Paramaribo":"Paramaribo","Quito":"Quito","Santiago":"Santiago",
  "Belmopan":"Belmopán","Guatemala City":"Ciudad de Guatemala","Havana":"La Habana","Kingston":"Kingston","Managua":"Managua","Mexico City":"Ciudad de México","Panama City":"Ciudad de Panamá","Port-au-Prince":"Puerto Príncipe","Port of Spain":"Puerto España","San Jose":"San José","San José":"San José","Santo Domingo":"Santo Domingo",
  "Ottawa":"Ottawa","Washington, D.C.":"Washington D. C.","Saint John's":"Saint John’s","St. John's":"Saint John’s",
  "Kuwait City":"Kuwait","Manama":"Manama","Majuro":"Majuro","Melekeok":"Melekeok","Ngerulmud":"Ngerulmud","Palikir":"Palikir","Tarawa":"Tarawa"
};
const toSpanishCapital = cap => cap ? (CAPITAL_ES[cap] || cap) : "";

/* ========= Estado ========= */
let ALL = []; // {code, nameES, capitalES, region, population}
let catalogScope = 'unavailable'; // world | europe | unavailable

let playerName = "";
let currentMode  = null;     // flags | capitals | mixed | survival | study | daily
let survivalKind = null;     // flags | capitals | mixed, solo en Supervivencia
let currentLevel = 'adult';
let currentTheme = 'all';    // all | Europe | Africa | Asia | Americas | Oceania

let optionsPool = [];
let order = [];
let idx = 0;
let roundLength = MAX_Q;

let score = 0, hits = 0, misses = 0;
let locked = false;
let paused = false;

let timeLeft = 0, timeInterval = null, nextTimer = null;
let qActiveStartMs = 0, qAccumulatedMs = 0;
let timesMs = [];
let missMap = {};
let streak = 0;
let runStreak = 0, bestRunStreak = 0;

let muteFx = false;
let studyQueue = [];
let unlockedThisRun = new Set();
let albumUnlockedThisRun = new Set();
let leagueRun = null;
let leagueStudyFirstHits = 0;

/* ========= LocalStorage ========= */
const LS = {
  name:'pro_player_name',
  scores:'pro_scores',
  stats:'pro_stats',
  challenge:'pro_challenges',
  dailyProgress:'pro_daily_progress_v1',
  last:'pro_last_sel',
  mute:'pro_mute',
  achievements:'pro_achievements',
  albums:'pro_albums_v2',
  visited:'pro_visited_regions_v1',
  streak:'pro_streak_v1',
  dailyQuestion:'pro_daily_question_v1'
};

/* ========= Audio ========= */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioCtx();
function playTone(f=440,d=0.12,type='sine',vol=0.2){
  if (muteFx) return;
  const o=audioCtx.createOscillator(); const g=audioCtx.createGain();
  o.type=type; o.frequency.value=f; g.gain.value=vol;
  o.connect(g).connect(audioCtx.destination); o.start();
  setTimeout(()=>{ g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime+0.05); o.stop(audioCtx.currentTime+0.06); }, d*1000);
}
function fxCorrect(){ let t=0; [{f:523,d:0.07},{f:659,d:0.07},{f:784,d:0.09}].forEach(n=>{ setTimeout(()=>playTone(n.f,n.d,'square',0.12), t); t+=n.d*1000*0.9; }); }
function fxWrong(){ const s=260,e=140,steps=6,ms=50; for(let i=0;i<steps;i++){ const f=s+(e-s)*(i/(steps-1)); setTimeout(()=>playTone(f, ms/1000,'sawtooth',0.12), i*ms); } }
function fxStreak(){ let t=0; [660,880,990,1180].forEach((f)=>{ setTimeout(()=>playTone(f,0.06,'triangle',0.13), t); t+=60; }); }

/* ========= Helpers Storage ========= */
function lsGet(k, def){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):def; }catch{ return def; } }
function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} }

/* ========= Carga de datos ========= */
const WORLD_DATA_URL = 'https://cdn.jsdelivr.net/gh/mledoze/countries@master/countries.json';
const WORLD_CACHE_KEY = 'pro_world_catalog_v1';
function validCatalog(items){
  return Array.isArray(items) && items.length >= 180 &&
    items.filter(c => c.region === 'Europe').length >= 35 &&
    items.every(c => /^[a-z]{2}$/.test(c.code) && c.nameES && c.region);
}
function normalizeWorldData(raw){
  if (!Array.isArray(raw)) return [];
  const borderNames = Object.fromEntries(raw.map(c=>[c.cca3,c.translations?.spa?.common || c.name?.common]).filter(([code,name])=>code && name));
  const languageNames = new Intl.DisplayNames(['es'],{type:'language'});
  const seen = new Set();
  return raw.map(c => ({
    code: String(c.cca2 || '').toLowerCase(),
    nameES: c.translations?.spa?.common || c.name?.common || '',
    capitalES: toSpanishCapital(Array.isArray(c.capital) ? c.capital[0] : c.capital),
    region: ['Europe','Asia','Africa','Americas','Oceania'].includes(c.region) ? c.region : 'Other',
    independent: c.independent,
    subregion: c.subregion || '',
    languages: Object.entries(c.languages || {}).map(([code,name])=>{
      try {const translated=languageNames.of(code); return translated===code ? name : translated}
      catch {return name}
    }),
    borders: Array.isArray(c.borders) ? c.borders.map(code=>borderNames[code]).filter(Boolean) : [],
    landlocked: !!c.landlocked,
    area: Number(c.area) || 0,
    population: Number(c.population) || 0,
    currencies: Object.entries(c.currencies || {}).map(([code, details]) => [code, details?.symbol || ''])
  })).filter(c => {
    if (!/^[a-z]{2}$/.test(c.code) || !c.nameES || seen.has(c.code)) return false;
    seen.add(c.code);
    return true;
  });
}
async function getJson(url, timeoutMs){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    return await response.json();
  } finally { clearTimeout(timer); }
}
async function loadData(){
  let local = [];
  try {
    const data = await getJson('./countries-local.json', 3000);
    local = data.countries.map(([code, nameES, capitalES]) =>
      ({ code, nameES, capitalES, region:'Europe', population:0 }));
  } catch(e) { console.warn('No se pudo cargar el catálogo local', e); }

  let world = [];
  try {
    world = normalizeWorldData(await getJson(WORLD_DATA_URL, 6500));
    if (!validCatalog(world)) throw new Error('Catálogo mundial incompleto');
    lsSet(WORLD_CACHE_KEY, world);
  } catch(e) {
    console.warn('No se pudo actualizar el catálogo mundial', e);
    const cached = lsGet(WORLD_CACHE_KEY, []);
    if (validCatalog(cached)) world = cached;
  }
  if (validCatalog(world)) {
    ALL = world;
    catalogScope = 'world';
  } else {
    ALL = local;
    catalogScope = local.length >= 10 ? 'europe' : 'unavailable';
  }
  updateCatalogStatus();
}
function updateCatalogStatus(){
  const status = $('#catalogStatus');
  if (catalogScope === 'world') {
    status.textContent = `Catálogo mundial cargado: ${ALL.length} países y territorios.`;
  } else if (catalogScope === 'europe') {
    status.textContent = `Sin conexión al catálogo mundial. Puedes jugar Europa con ${ALL.length} países; el resto estará disponible cuando vuelva la conexión.`;
    currentTheme = 'Europe';
    ui.selTheme.textContent = 'Europa';
    $$('.theme-btn').forEach(btn => { btn.disabled = btn.dataset.theme !== 'Europe'; });
  } else {
    status.textContent = 'No se pudieron cargar los países. Recarga la página para intentarlo de nuevo.';
  }
  ui.startGame.disabled = catalogScope === 'unavailable';
  $('#tile-daily').disabled = catalogScope === 'unavailable';
}

/* ========= UI refs ========= */
const ui = {
  playerInput: $('#playerName'),
  goToMode: $('#goToMode'),
  backToPlayer: $('#backToPlayer'),
  startGame: $('#startGame'),

  selMode: $('#selMode'),
  selTheme: $('#selTheme'),
  selLevel: $('#selLevel'),

  hudPlayer: $('#hudPlayer'),
  hudMode: $('#hudMode'),
  hudTheme: $('#hudTheme'),

  qNumber: $('#qNumber'),
  qTotal: $('#qTotal'),
  points: $('#points'),
  hits: $('#hits'),
  misses: $('#misses'),
  progressBar: $('#progressBar'),
  timeLeft: $('#timeLeft'),
  timeBar: $('#timeBar'),

  flagImg: $('#flagImg'),
  capitalName: $('#capitalName'),
  flagImgReveal: $('#flagImgReveal'),
  countryReveal: $('#countryReveal'),

  whyFlag: $('#whyBoxFlag'),
  whyCap: $('#whyBoxCap'),

  finalPoints: $('#finalPoints'),
  finalHits: $('#finalHits'),
  finalMisses: $('#finalMisses'),
  finalQuestions: $('#finalQuestions'),
  finalBestStreak: $('#finalBestStreak'),
  finalTitle: $('#final-title'),
  finalMeta: $('#finalMeta'),
  finalReason: $('#finalReason'),
  achievementsList: $('#achievementsList'),
  achievementsEmpty: $('#achievementsEmpty'),

  // Álbum
  albumModal: $('#albumModal'),
  btnAlbum: $('#btnAlbum'),
  closeAlbum: $('#closeAlbum'),
  albumGrid: $('#albumGrid'),
  albumEmpty: $('#albumEmpty'),
  albumSearch: $('#albumSearch'),
  albumProgress: $('#albumProgress'),
  albumTrophies: $('#albumTrophies'),
  albumRegionChips: $('#albumRegionChips'),
  openAlbumFromFinal: $('#openAlbumFromFinal'),

  // Logros (modal antiguo — puede no existir) + vitrina nueva
  btnAchievements: $('#btnAchievements'),
  achModal: $('#achModal'),
  achGrid: $('#achGrid'),
  achEmpty: $('#achEmpty'),

  // Liga
  leagueModal: $('#leagueModal'),
  leagueWeek: $('#leagueWeek'),
  leagueTable: $('#leagueTable'),
  leagueName: $('#leagueName'),
};

/* ========= Pantallas ========= */
const screens = {
  player: $('#screen-player'),
  mode:   $('#screen-mode'),
  game:   $('#screen-game'),
  final:  $('#finalCard')
};

function showScreen(name){
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  document.body.classList.toggle('home-active', name === 'player' || name === 'mode');
  document.body.classList.toggle('play-active', name === 'game' || name === 'final');
  if (name === 'player') $('#screen-player [data-home-open="btnMute"]').textContent = $('#btnMute').textContent;
  if (name === 'mode') $('#modePlayerName').textContent = playerName || 'Jugador';
  window.scrollTo({top:0,behavior:'smooth'});
  if (name==='mode') updateDailyTile();
}

/* ========= Mute persistente ========= */
(function initMute(){
  muteFx = lsGet(LS.mute, false);
  const btn = $('#btnMute');
  if (btn){
    btn.setAttribute('aria-pressed', String(muteFx));
    btn.textContent = muteFx ? '🔇' : '🔊';
    btn.addEventListener('click', ()=>{
      muteFx = !muteFx;
      lsSet(LS.mute, muteFx);
      btn.setAttribute('aria-pressed', String(muteFx));
      btn.textContent = muteFx ? '🔇' : '🔊';
    });
  }
})();

/* ========= Liga / Stats helpers ========= */
function recordGameToLeague({name, score, mode, level, theme, durationMs}){
  const arr = lsGet(LS.scores, []);
  arr.unshift({name, score, mode, level, theme, dateISO:new Date().toISOString(), week: isoWeekStringLocal(), durationMs});
  while(arr.length>300) arr.pop();
  lsSet(LS.scores, arr);
}

function updateGlobalStatsFromRun(){
  const st = lsGet(LS.stats, { times:{count:0,sumMs:0,maxMs:0,minMs:0}, countries:{} });
  for(const ms of timesMs){
    st.times.count += 1;
    st.times.sumMs += ms;
    st.times.maxMs = Math.max(st.times.maxMs||0, ms);
    st.times.minMs = st.times.minMs? Math.min(st.times.minMs, ms) : ms;
  }
  for(const code in missMap){
    const m = missMap[code];
    if(!st.countries[code]) st.countries[code] = {name:m.name, attempts:0, wrong:0};
    st.countries[code].attempts += m.attempts;
    st.countries[code].wrong += m.wrong;
  }
  lsSet(LS.stats, st);
}

/* ========= Logros (datos base) ========= */
function getAchievements(){ return lsGet(LS.achievements, {}); }
function unlockAchievement(key){
  const all = getAchievements();
  if (all[key]) return false;
  all[key] = { date: new Date().toISOString() };
  lsSet(LS.achievements, all);
  unlockedThisRun.add(key);
  return true;
}
function listAchievements(){ return Object.keys(getAchievements()); }
const SURVIVAL_REGIONS = {
  all:'mundo', Europe:'europa', Asia:'asia', Americas:'america', Africa:'africa', Oceania:'oceania'
};
function survivalAchievementId(percent){
  return `supervivencia_${survivalKind}_${SURVIVAL_REGIONS[currentTheme]}_${percent}`;
}
function unlockSurvivalMilestones(){
  if (!roundLength) return;
  for (const percent of [25, 50, 75]) {
    if (hits * 100 >= roundLength * percent) unlockAchievement(survivalAchievementId(percent));
  }
}
function survivalVictoryTitle(){
  const region = currentTheme === 'all' ? 'del mundo' :
    `de ${REGION_LABELS[currentTheme] || currentTheme}`;
  if (currentTheme === 'all') {
    return {flags:'Soberano de las banderas del mundo', capitals:'Sabio de todas las capitales',
      mixed:'Leyenda del planeta'}[survivalKind];
  }
  return {flags:`Rey ${region}`, capitals:`Maestro ${region}`, mixed:`Leyenda ${region}`}[survivalKind];
}
function unlockSurvivalVictory(){
  if (hits === roundLength && misses === 0 && roundLength > 0) {
    unlockAchievement(survivalAchievementId(100));
  }
}
function reconcileAchievements(){
  const scores = lsGet(LS.scores, []);
  if (scores.length) unlockAchievement('progreso_primer_paso');
  if (scores.length >= 50) unlockAchievement('progreso_veterano_50');
  if (Object.keys(lsGet(LS.challenge, {})).length) unlockAchievement('reto_primero');
  const visited = lsGet(LS.visited, {});
  scores.forEach(game => { if (game.theme && game.theme !== 'all') visited[game.theme] = true; });
  lsSet(LS.visited, visited);
  if (['Europe','Asia','Africa','Americas','Oceania'].every(region => visited[region])) {
    unlockAchievement('exploracion_continentes');
  }
  const regionId = {Europe:'europa',Asia:'asia',Africa:'africa',Americas:'america',Oceania:'oceania'};
  Object.values(lsGet(LS.albums, {})).forEach(entry => {
    const suffix = regionId[entry.region];
    if (entry.flag?.unlocked) {
      unlockAchievement('primer_bandera_mundo');
      if (suffix) unlockAchievement(`primer_bandera_${suffix}`);
    }
    if (entry.capital?.unlocked) {
      unlockAchievement('primer_capital_mundo');
      if (suffix) unlockAchievement(`primer_capital_${suffix}`);
    }
  });
}

/* ========= Reto del día ========= */
function hashSeed(value){
  let h = 2166136261;
  for (const char of value) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}
function seededShuffle(items, seed){
  const result = [...items];
  let state = seed;
  for (let i=result.length-1; i>0; i--){
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i+1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function mysteryCandidates(country, day){
  const clues=COUNTRY_MYSTERY_CLUES[country.code]?.clues || [];
  const hard=seededShuffle(clues.filter(x=>x.level===1),hashSeed(`${day}:${country.code}:difícil`));
  const medium=seededShuffle(clues.filter(x=>x.level===2),hashSeed(`${day}:${country.code}:intermedia`));
  const second=medium[0];
  const third=medium.find(x=>x!==second && x.type!==second.type) || medium[1];
  return [hard[0],second,third].map((clue,i)=>({...clue,level:i+1}));
}
function mysteryEligible(country){
  const territories=new Set('aw ai ax as aq tf bl sh bm bq bv cc cw cx ky eh fk fo gg gi gp gl gf gu hk hm im io je mo mf mp ms mq yt nc nf pn pr pf re gs sj pm sx tc tk um vg vi wf'.split(' '));
  const clues=COUNTRY_MYSTERY_CLUES[country.code]?.clues || [];
  return !!(country.code && !territories.has(country.code) && COUNTRY_SHAPES[country.code] &&
    clues.some(x=>x.level===1) && clues.filter(x=>x.level===2).length>=2);
}
function mysteryCatalog(){
  return COUNTRY_DIRECTORY.map(entry=>({...ALL.find(item=>item.code===entry.code),...entry}))
    .filter(mysteryEligible).sort((a,b)=>a.code.localeCompare(b.code));
}
function mysteryOptions(country,day,pool){
  const center=COUNTRY_MYSTERY_CLUES[country.code];
  const location=(a,b)=>{
    if(a?.latlng?.length!==2 || b?.latlng?.length!==2)return 0;
    const longitude=Math.abs(a.latlng[1]-b.latlng[1]);
    return Math.hypot(a.latlng[0]-b.latlng[0],Math.min(longitude,360-longitude)*.6)*.07;
  };
  const rank=candidate=>{
    const other=COUNTRY_MYSTERY_CLUES[candidate.code];
    return (other.subregion===center.subregion?0:10)
      + Math.abs(Math.log2((other.area+1)/(center.area+1)))*1.6
      + location(center,other)
      + (other.landlocked!==center.landlocked?2:0)
      + (other.hasLandBorders!==center.hasLandBorders?1.5:0);
  };
  const closest=seededShuffle(pool.filter(x=>x.code!==country.code && x.region===country.region),
    hashSeed(`${day}:${country.code}:parecidos`)).sort((a,b)=>rank(a)-rank(b));
  const paired={cd:'cg',cg:'cd',kr:'kp',kp:'kr'}[country.code];
  const fixed=paired ? closest.find(x=>x.code===paired) : null;
  const neighbors=[...(fixed?[fixed]:[]),...closest.filter(x=>x!==fixed)].slice(0,3);
  return seededShuffle([country,...neighbors],hashSeed(`${day}:${country.code}:opciones`)).map(x=>x.code);
}
function makeDailyQuestion(day=todayStr()){
  const saved = lsGet(LS.dailyQuestion, null);
  if(saved?.day===day && saved.question?.kind==='mystery' && saved.question?.schema===3 && mysteryCatalog().some(x=>x.code===saved.question.code))
    return saved.question;
  const pool = mysteryCatalog();
  if(!pool.length) return null;
  // Rotación sin repetición dentro de un ciclo de catálogo completo.
  const epoch = Math.floor(new Date(`${day}T12:00:00`).getTime()/86400000);
  const country = seededShuffle(pool,hashSeed('misterio-paises-v1'))[epoch % pool.length];
  const question = {kind:'mystery',schema:3,code:country.code,
    clues:mysteryCandidates(country,day),options:mysteryOptions(country,day,pool)};
  lsSet(LS.dailyQuestion,{day,question});
  return question;
}
function updateDailyTile(){
  const done = lsGet(LS.challenge,{})[todayStr()];
  const tile = $('#tile-daily');
  if(tile) tile.dataset.desc = done ? 'Ver el misterio de hoy' : 'Un país oculto cada día';
}
const MYSTERY_DISPLAY_NAMES={bw:'Botsuana',dj:'Yibuti',gd:'Granada',sl:'Sierra Leona',
  sz:'Esuatini',pw:'Palaos'};
function mysteryCountryName(country){return MYSTERY_DISPLAY_NAMES[country.code]||country.nameES}
const COUNTRY_PIN_MOTIFS = {
  es:'<circle cx="75" cy="26" r="12" fill="#f4b14c"/><path d="M10 85 Q50 56 90 82 V100 H10Z" fill="#dca365"/><path d="M40 82 V40 H62 V82Z" fill="#fff2dc" stroke="#755648" stroke-width="3"/><path d="M39 41 L51 29 L63 41Z" fill="#9b5d50"/><path d="M51 41 V7 M51 41 L83 28 M51 41 L19 27 M51 41 L36 75" stroke="#694b47" stroke-width="6" stroke-linecap="round"/>',
  jp:'<circle cx="72" cy="28" r="16" fill="#ee6970"/><path d="M6 85 L44 28 L54 43 L66 24 L96 85Z" fill="#4980a0"/><path d="M44 28 L54 43 L66 24 L78 44 L64 38 L53 54 L43 43 L34 48Z" fill="#fff"/><path d="M15 41 Q32 43 44 57" fill="none" stroke="#74536e" stroke-width="4"/><circle cx="21" cy="41" r="5" fill="#f2a6bb"/><circle cx="36" cy="49" r="5" fill="#f2a6bb"/>',
  is:'<path d="M10 36 Q34 12 54 30 T92 26" fill="none" stroke="#60d4b3" stroke-width="9" stroke-linecap="round"/><path d="M5 81 L33 57 L48 73 L66 45 L88 77 L98 68 V98 H5Z" fill="#3f6176"/><path d="M55 62 L66 45 L76 61 L66 54Z" fill="#fff"/><path d="M33 78 Q22 62 32 42 M46 78 Q53 62 45 48 M58 78 Q68 62 60 51" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>'
};
function countryPin(code,label,large=false){
  const shape=COUNTRY_SHAPES[code];
  const box=COUNTRY_SHAPE_VIEWBOX[code];
  const hue=hashSeed(code+'pin')%160+155;
  const name=escapeCardText(label||'País');
  if(!shape||!box) return `<span class="mystery-pin ${large?'is-large':''}" role="img" aria-label="Pin de ${name}">✦</span>`;
  const motif=COUNTRY_PIN_MOTIFS[code];
  return `<span class="mystery-pin ${large?'is-large':''}" role="img" aria-label="Pin de ${name}" style="--pin-hue:${hue}">
    <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="49" fill="#e2ae4c"/><circle cx="50" cy="50" r="44" fill="hsl(${hue} 54% 35%)"/>
    ${motif ? `<svg x="13" y="13" width="74" height="74" viewBox="0 0 100 100">${motif}</svg>` : `<svg x="19" y="19" width="62" height="62" viewBox="${box.join(' ')}" preserveAspectRatio="xMidYMid meet"><path d="${shape}" fill="#fff5d9"/></svg>`}</svg></span>`;
}
function mysterySilhouette(code){
  const shape=COUNTRY_SHAPES[code];
  const box=COUNTRY_SHAPE_VIEWBOX[code];
  if(!shape||!box) return '<span>Silueta no disponible</span>';
  return `<svg class="mystery-silhouette" viewBox="${box.join(' ')}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Silueta del país oculto"><path d="${shape}"/></svg>`;
}
function renderDailyModal(){
  const day=todayStr();
  const done=lsGet(LS.challenge,{})[day];
  const q=makeDailyQuestion(day);
  const container=$('#dailyQuestion');
  if(!q){container.textContent='No hay datos suficientes para el misterio de hoy.';return}
  const catalog=mysteryCatalog();
  const country=catalog.find(x=>x.code===(done?.countryCode || q.code)) ||
    COUNTRY_DIRECTORY.find(x=>x.code===done?.countryCode);
  if(!country){container.textContent='No se ha podido cargar el país de hoy.';return}
  if(done){
    const pin=done.correct ? countryPin(country.code,mysteryCountryName(country),true) : '';
    const selected=catalog.find(x=>x.code===done.selectedCode);
    container.innerHTML=`<div class="mystery-result ${done.correct?'is-won':''}">${pin}<h4>${done.correct?'¡Misterio resuelto!':'Misterio terminado'}</h4>${selected&&!done.correct?`<p>Elegiste ${escapeCardText(mysteryCountryName(selected))}.</p>`:''}<p>El país era <strong>${escapeCardText(mysteryCountryName(country))}</strong>.</p>${done.correct?'<p>Pin conseguido · Vuelve mañana para otro país.</p>':'<p>Vuelve mañana para intentarlo con otro país.</p>'}</div>`;
    return;
  }
  const prior=lsGet(LS.dailyProgress,null);
  const draft=prior?.day===day && prior?.code===country.code && prior?.schema===3 ? prior : {day,code:country.code,schema:3,revealed:0};
  let revealed=0,answered=false;
  const region=escapeCardText(REGION_LABELS[country.region]||'Mundo');
  const options=q.options.map(code=>catalog.find(x=>x.code===code)).filter(Boolean);
  container.innerHTML=`<div class="mystery-game"><p class="mystery-overline">País oculto · ${region}</p>
    <h4>¿Qué país es?</h4><p class="mystery-subtitle">Observa la silueta. Puedes abrir pistas antes de jugártela.</p>
    <div class="mystery-stage"><div class="mystery-shape">${mysterySilhouette(country.code)}</div>
    <div class="mystery-play"><div class="mystery-clues" aria-live="polite"></div>
    <button type="button" class="mystery-reveal">Abrir pista 1 de 3</button>
    <p class="mystery-one-shot">Elige un país · Solo tienes una respuesta</p>
    <div class="mystery-options" role="group" aria-label="Elige un país">${options.map(option=>`<button type="button" class="mystery-option" data-country-code="${option.code}">${escapeCardText(mysteryCountryName(option))}</button>`).join('')}</div></div></div></div>`;
  const clueList=container.querySelector('.mystery-clues');
  const reveal=container.querySelector('.mystery-reveal');
  reveal.addEventListener('click',()=>{
    if(revealed>=3)return;
    const clue=q.clues[revealed];
    const item=document.createElement('div');item.className='mystery-clue';
    item.innerHTML=`<span>Pista ${revealed+1}</span><p>${escapeCardText(clue.text)}</p>`;
    clueList.appendChild(item);
    revealed++;
    lsSet(LS.dailyProgress,{day,code:country.code,schema:3,revealed});
    if(revealed===3)reveal.classList.add('hidden');
    else reveal.textContent=`Abrir pista ${revealed+1} de 3`;
  });
  for(let i=0;i<Math.min(3,draft.revealed);i++) reveal.click();
  container.querySelectorAll('.mystery-option').forEach(button=>button.addEventListener('click',()=>{
    if(answered)return;
    answered=true;
    const selectedCode=button.dataset.countryCode;
    const correct=selectedCode===country.code;
    const challenges=lsGet(LS.challenge,{});
    challenges[day]={name:playerName||'Anónimo',correct,score:correct?10:0,
      countryCode:country.code,selectedCode,cluesUsed:revealed,attempts:1};
    lsSet(LS.challenge,challenges);
    window.CloudLeagues?.submitDaily(day,challenges[day]);
    if(correct)ensureAlbumEntry(country);
    unlockAchievement('reto_primero');
    correct?fxCorrect():fxWrong();
    updateDailyTile();
    renderDailyModal();
  }));
}
/* ========= Tiempo y pausa ========= */
function startTimer(tRemain){
  clearInterval(timeInterval);
  const total = (typeof tRemain === 'number') ? tRemain : LEVELS[currentLevel].time;
  timeLeft = total;
  ui.timeLeft.textContent = Math.ceil(timeLeft);
  ui.timeBar.style.width = "100%";
  qActiveStartMs = Date.now();
  paused = false;

  timeInterval = setInterval(()=>{
    const elapsed = (Date.now()-qActiveStartMs)/1000;
    const remain = Math.max(0, total - elapsed);
    timeLeft = remain;
    ui.timeLeft.textContent = Math.ceil(remain);
    ui.timeBar.style.width = Math.max(0,(remain/LEVELS[currentLevel].time)*100) + "%";
    if (remain <= 0){
      clearInterval(timeInterval);
      handleTimeout();
    }
  }, 100);
}
function stopTimer(){ clearInterval(timeInterval); }
function updatePauseButtons(){
  $$('#pauseBtn, #pauseBtn2').forEach(btn => {
    btn.textContent = paused ? '▶ Reanudar' : '⏸ Pausa';
  });
}
function pauseGame(){
  if (paused || locked) return;
  paused = true;
  if (currentMode !== 'study') qAccumulatedMs += (Date.now() - qActiveStartMs);
  if (currentMode === 'survival') stopSurvivalTimer();
  else stopTimer();
  disableAnswers(true);
  updatePauseButtons();
}
function resumeGame(){
  if (!paused) return;
  paused = false;
  qActiveStartMs = Date.now();
  if (currentMode === 'survival') startSurvivalTimer(false);
  else if (currentMode !== 'study') startTimer(timeLeft);
  disableAnswers(false);
  updatePauseButtons();
}
function togglePause(){
  if (leagueRun){ alert('El reloj no se puede pausar en un reto de liga.'); return; }
  if (paused) resumeGame(); else pauseGame();
}
function disableAnswers(disabled){
  $$("#card-flag .answer-btn").forEach(b=> b.disabled = disabled);
  $$("#card-capital .answer-btn.cap").forEach(b=> b.disabled = disabled);
}

/* ========= Juego ========= */
function applyThemePool(){
  // FIX: tema "Mundo" devuelve todo el pool
  return currentTheme === 'all' ? [...ALL] : ALL.filter(x => x.region === currentTheme);
}
function pickOptions(correct, pool, n=4){
  const others = pool.filter(x=>x.code!==correct.code);
  shuffle(others);
  const fill = others.slice(0, Math.max(0, n-1));
  while (fill.length < n-1 && ALL.length){
    const cand = ALL[randomInt(ALL.length)];
    if (cand && cand.code!==correct.code && !fill.some(o=>o.code===cand.code)) fill.push(cand);
  }
  // FIX spread correcto
  return shuffle([correct, ...fill]);
}
function modeLabel(m){
  return m==='flags'?'Banderas':m==='capitals'?'Capitales':m==='mixed'?'Mixto':m==='survival'?'Supervivencia':m==='study'?'Estudio':m;
}
function gameModeLabel(){
  return currentMode === 'survival' ? `Supervivencia · ${modeLabel(survivalKind)}` : modeLabel(currentMode);
}
function makeQuestion(item){
  const kind = currentMode === 'flags' ? 'flag' : currentMode === 'capitals' ? 'capital' :
    (item.capitalES && gameRng() < 0.5 ? 'capital' : 'flag');
  return {kind, item};
}
function makeSurvivalOrder(countries, kind){
  const withCapital = countries.filter(x => x.capitalES && x.capitalES.trim().length);
  const flags = countries.map(item => ({kind:'flag', item}));
  const capitals = withCapital.map(item => ({kind:'capital', item}));
  return shuffle(kind === 'flags' ? flags : kind === 'capitals' ? capitals : [...flags, ...capitals]);
}

function newGame(){
  if (leagueRun && catalogScope !== 'world') {
    alert('Los retos de liga necesitan el catálogo mundial. Inténtalo cuando esté disponible.');
    leagueRun = null;
    return false;
  }
  gameRng = leagueRun ? leagueRandom(hashSeed(`liga-v1:${leagueRun.week}:${leagueRun.category}`)) : Math.random;
  const base = leagueRun ? applyThemePool().filter(x => COUNTRY_MYSTERY_CLUES[x.code]).sort((a,b)=>a.code.localeCompare(b.code)) : applyThemePool();
  if (base.length < 4) { alert('No hay suficientes países para este tema. Recarga la página.'); return; }
  optionsPool = [...base];

  order = [];
  const eligible = currentMode === 'capitals' ?
    optionsPool.filter(x=>x.capitalES && x.capitalES.trim().length) : optionsPool;
  if ((currentMode === 'capitals' || currentMode === 'survival' && survivalKind === 'capitals') &&
      optionsPool.filter(x=>x.capitalES && x.capitalES.trim().length).length < 4){
    alert('No hay suficientes capitales para este tema.'); return;
  }
  order = currentMode === 'survival' ? makeSurvivalOrder(optionsPool, survivalKind) :
    shuffle([...eligible]).slice(0,Math.min(MAX_Q, eligible.length)).map(makeQuestion);
  roundLength = order.length;

  if (currentMode==='study'){ ui.qTotal.textContent = '/∞'; }
  else { ui.qTotal.textContent = '/'+roundLength; }

  idx = 0; score = 0; hits = 0; misses = 0; locked = false; leagueStudyFirstHits = 0;
  timesMs = []; missMap = {}; streak = lsGet(LS.streak, 0); studyQueue = [];
  runStreak = 0; bestRunStreak = 0;
  qAccumulatedMs = 0; paused = false;
  updatePauseButtons();
  unlockedThisRun = new Set();
  albumUnlockedThisRun = new Set();

  ui.points.textContent = score; ui.hits.textContent = hits; ui.misses.textContent = misses;
  ui.qNumber.textContent = 1; ui.progressBar.style.width = "0%";
  ui.progressBar.parentElement?.classList.toggle('hidden', currentMode==='study');
  ui.hudPlayer.textContent = playerName || 'Anónimo';
  ui.hudMode.textContent = gameModeLabel();
  ui.hudTheme.textContent = (currentTheme==='all'?'Mundo':currentTheme);

  lsSet(LS.last, { mode: currentMode, level: currentLevel, theme: currentTheme, survivalKind });

  showScreen('game');
  renderQuestion();
  return true;
}

window.CartasGame = {
  startLeagueRun({leagueId,attemptId,week,category,theme}){
    if (!['flags','capitals','mixed','study','survival_flags','survival_capitals','survival_mixed'].includes(category)) return false;
    if (catalogScope !== 'world') return false;
    leagueRun = {leagueId,attemptId,week,category};
    currentMode = category.startsWith('survival_') ? 'survival' : category;
    survivalKind = currentMode === 'survival' ? category.slice(9) : null;
    currentLevel = 'adult';
    currentTheme = theme;
    playerName = ui.playerInput.value.trim() || playerName || 'Jugador';
    return newGame();
  },
  catalogReady(){return catalogScope === 'world';},
  dailyResult(){return lsGet(LS.challenge,{})[todayStr()] || null;}
};


/* ========= Logros Excel: helpers ========= */
function hasAchievement(id){ const a=getAchievements(); return !!a[id]; }
function unlockIfPresent(id){ unlockAchievement(id); }
function tryUnlockFirstTheme(theme){
  let __achCatalogCache = null;
async function loadAchCatalog(){
  if (__achCatalogCache) return __achCatalogCache;
  try{
    const res = await fetch('./achievements.json', { cache:'no-store' });
    const data = await res.json();
    const map = {};
    (data.achievements||[]).forEach(a=>{ map[a.id]=a; });
    __achCatalogCache = map;
    return map;
  }catch(e){ return {}; }
}

async function renderFinalAchievementChips(listEl, idsOpt){
  try{
    const ids = idsOpt || [];
    if (!ids.length){ listEl.innerHTML=''; return; }
    const cat = await loadAchCatalog();
    listEl.innerHTML = ids.map(id=>{
      const a = cat[id];
      const name = a?.name || id;
      return `<span class="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">🏅 ${name}</span>`;
    }).join(' ');
  }catch(e){ /* nada */ }
}


  const map = { 
    'all':'logro_primer_mundo',
    'Europe':'logro_primer_europa',
    'Asia':'logro_primer_asia',
    'Americas':'logro_primer_america',
    'Africa':'logro_primer_africa',
    'Oceania':'logro_primer_oceania'
  };
  const id = map[theme];
  if (id && !hasAchievement(id)) unlockIfPresent(id);
}

// Carga catálogo para nombrar chips en la pantalla final
let __achCatalogCache = null;
async function loadAchCatalog(){
  if (__achCatalogCache) return __achCatalogCache;
  try{
    const res = await fetch('./achievements.json', { cache:'no-store' });
    const data = await res.json();
    const map = {};
    (data.achievements||[]).forEach(a=>{ map[a.id]=a; });
    __achCatalogCache = map;
    return map;
  }catch(e){ return {}; }
}
async function renderFinalAchievementChips(listEl, idsOpt){
  try{
    const keys = idsOpt || [];
    listEl.replaceChildren();
    if (!keys.length) return;
    const cat = await loadAchCatalog();
    const fragment = document.createDocumentFragment();
    keys.forEach(id=>{
      const a = cat[id];
      const name = a?.name || id;
      const card = document.createElement('div');
      card.className = 'flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-2';
      if (a?.art){
        const img = document.createElement('img');
        img.src = a.art;
        img.alt = '';
        img.className = 'w-12 h-12 sm:w-14 sm:h-14 object-contain shrink-0';
        card.appendChild(img);
      }
      const label = document.createElement('span');
      label.className = 'font-semibold text-emerald-900';
      label.textContent = name;
      card.appendChild(label);
      fragment.appendChild(card);
    });
    listEl.replaceChildren(fragment);
  }catch(e){ /* noop */ }
}
function renderQuestion(){
  const q = order[idx];
  // FIX: guard seguro (no usar q antes de definir y comprobar .item)
  if (!q || !q.item) {
    console.warn('No hay pregunta válida para la combinación actual:', q);
    const why = document.getElementById('whyBoxFlag') || document.getElementById('whyBoxCap');
    if (why) why.textContent = 'No hay preguntas disponibles para esta combinación. Prueba otro tema o recarga.';
    return;
  }
  ui.whyFlag.textContent = ''; ui.whyCap.textContent = '';
  qAccumulatedMs = 0;

  if (q.kind === 'flag'){
    $("#card-flag").classList.remove('hidden');
    $("#card-capital").classList.add('hidden');
    ui.flagImg.src = flagUrl(q.item.code);
    ui.flagImg.alt = `Bandera de ${q.item.nameES}`;

    const opts = pickOptions(q.item, optionsPool, 4);
    $$("#card-flag .answer-btn").forEach((btn,i)=>{
      btn.querySelector('.answer-label').textContent = opts[i].nameES;
      btn.querySelector('.answer-result').textContent = '';
      btn.dataset.correct = (opts[i].code===q.item.code) ? '1' : '0';
      btn.dataset.code = opts[i].code;
      delete btn.dataset.feedback;
      btn.setAttribute('aria-label', `Opción ${'ABCD'[i]}: ${opts[i].nameES}`);
      btn.disabled = false;
      btn.className = "answer-btn px-3 py-3 rounded-xl bg-white hover:bg-slate-50 border text-left font-semibold";
    });
  } else {
    $("#card-flag").classList.add('hidden');
    $("#card-capital").classList.remove('hidden');
    ui.capitalName.textContent = q.item.capitalES || "—";
    ui.flagImgReveal.src = flagUrl(q.item.code);
    ui.countryReveal.textContent = `Es ${q.item.nameES}`;
    const base = optionsPool.filter(x=>x.capitalES && x.capitalES.trim().length);
    const opts = pickOptions(q.item, base.length?base:optionsPool, 4);
    $$("#card-capital .answer-btn.cap").forEach((btn,i)=>{
      btn.querySelector('.answer-label').textContent = opts[i].nameES;
      btn.querySelector('.answer-result').textContent = '';
      btn.dataset.correct = (opts[i].code===q.item.code) ? '1' : '0';
      btn.dataset.code = opts[i].code;
      delete btn.dataset.feedback;
      btn.setAttribute('aria-label', `Opción ${'ABCD'[i]}: ${opts[i].nameES}`);
      btn.disabled = false;
      btn.className = "answer-btn cap px-3 py-3 rounded-xl bg-white hover:bg-slate-50 border text-left font-semibold";
    });
    ui.flagImgReveal.classList.add('hidden');
    ui.countryReveal.classList.add('hidden');
  }

  locked = false;
  ui.qNumber.textContent = (currentMode==='study' ? (idx+1+studyQueue.length) : (idx+1));
  if (currentMode==='study'){ $('#timeBar').style.width = '0%'; ui.timeLeft.textContent = '∞'; }
  else if (currentMode==='survival'){
    timeLeft = survivalRules().start;
    startSurvivalTimer();
  }
  else { startTimer(); }
}

function markButtons(buttons, targetBtn){
  buttons.forEach(btn=>{
    const isCorrect = btn.dataset.correct === "1";
    const selectedWrong = btn === targetBtn && !isCorrect;
    btn.dataset.feedback = isCorrect ? 'correct' : selectedWrong ? 'wrong' : 'muted';
    btn.querySelector('.answer-result').textContent = isCorrect ? '✓' : selectedWrong ? '✕' : '';
    const answer = btn.querySelector('.answer-label').textContent;
    const status = isCorrect ? ', correcta' : selectedWrong ? ', incorrecta' : '';
    btn.setAttribute('aria-label', `Opción ${'ABCD'[Number(btn.dataset.index)]}: ${answer}${status}`);
    btn.disabled = true;
  });
}
function whyText(country){
  const pop = country.population ? ` · Población aprox.: ${(country.population/1e6).toFixed(1)}M` : '';
  return `${country.nameES} — Región: ${regionBadge(country.region)}${pop}`;
}

/* ========= Álbum (estructura v2 por tipo) ========= */
function getAlbum(){ return lsGet(LS.albums, {}); }
function saveAlbum(obj){ lsSet(LS.albums, obj); }
function ensureAlbumEntry(country){
  const album = getAlbum();
  if(!album[country.code]){
    album[country.code] = {
      code: country.code,
      nameES: country.nameES,
      region: country.region || "Other",
      flag: { unlocked:false, hits:0 },
      capital: { unlocked:false, value: country.capitalES || "", hits:0 }
    };
    saveAlbum(album);
  }
  return album;
}
function markFlagLearned(country){
  const album = ensureAlbumEntry(country);
  const entry = album[country.code];
  if (!entry.flag.unlocked) { entry.flag.unlocked = true; entry.flag.unlockedAtISO = new Date().toISOString(); albumUnlockedThisRun.add(country.code); }
  entry.flag.hits = (entry.flag.hits||0) + 1;
  saveAlbum(album);
}
function markCapitalLearned(country){
  const album = ensureAlbumEntry(country);
  const entry = album[country.code];
  if (!entry.capital.unlocked) { entry.capital.unlocked = true; entry.capital.unlockedAtISO = new Date().toISOString(); albumUnlockedThisRun.add(country.code); }
  entry.capital.value = country.capitalES || entry.capital.value || "";
  entry.capital.hits = (entry.capital.hits||0) + 1;
  saveAlbum(album);
}

/* ========= Progreso por región ========= */
const REGION_KEYS = ["all","Europe","Asia","Americas","Oceania","Africa","Other"];
const REGION_LABELS = { all:"Mundo", Europe:"Europa", Asia:"Asia", Americas:"América", Oceania:"Oceanía", Africa:"África", Other:"Otras" };
const REGION_ICONS  = { all:"🌍",   Europe:"🧭",   Asia:"🏮",  Americas:"🗽",   Oceania:"🐚",    Africa:"🏜️",   Other:"🌋" };

function countTotalsByRegion(){
  const map = {};
  for(const key of REGION_KEYS){ map[key] = { total:0, flag:0, capital:0, both:0 }; }
  for(const c of ALL){
    const key = (c.region && REGION_KEYS.includes(c.region)) ? c.region : "Other";
    map[key].total += 1;
    map.all.total += 1;
  }
  const album = getAlbum();
  for(const code in album){
    const e = album[code];
    const k = (e.region && REGION_KEYS.includes(e.region)) ? e.region : "Other";
    const f = !!(e.flag && e.flag.unlocked);
    const cap = !!(e.capital && e.capital.unlocked);
    if (f){ map[k].flag+=1; map.all.flag+=1; }
    if (cap){ map[k].capital+=1; map.all.capital+=1; }
    if (f && cap){ map[k].both+=1; map.all.both+=1; }
  }
  return map;
}
function pct(part,total){ return total? Math.round((part/total)*100) : 0; }
function barHtml(label, val, total){
  const p = pct(val,total);
  return `
    <div class="flex items-center gap-2">
      <span class="text-[11px] w-16 text-slate-500">${label}</span>
      <div class="bar w-full"><span style="width:${p}%"></span></div>
      <span class="text-[11px] w-10 text-right font-semibold">${p}%</span>
    </div>`;
}

/* ========= Controles de región (chips) ========= */
function renderAlbumRegionChips(active='all'){
  const wrap = ui.albumRegionChips;
  const html = REGION_KEYS.map(k => `
    <button data-region="${k}" class="px-3 py-2 rounded-xl border bg-white hover:bg-slate-50 text-sm flex items-center gap-2 ${k===active?'ring-2 ring-emerald-400':''}">
      <span class="text-lg">${REGION_ICONS[k]}</span>
      <span class="font-semibold">${REGION_LABELS[k]}</span>
    </button>`).join('');
  wrap.innerHTML = html;
  $$("#albumRegionChips button").forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const r = btn.dataset.region;
      renderAlbum(r);
      $$("#albumRegionChips button").forEach(x=>x.classList.remove('ring-2','ring-emerald-400'));
      btn.classList.add('ring-2','ring-emerald-400');
    });
  });
}

/* ========= Estantería de insignias por región ========= */
function trophiesFromProgress(mp){
  const out = [];
  for (const k of ["Europe","Asia","Americas","Oceania","Africa","Other"]){
    const row = mp[k]; if(!row || !row.total) continue;
    const pAll = Math.round(((row.flag+row.capital)/Math.max(1,row.total*2))*100);
    let icon = "⬜", color = "bg-slate-100 text-slate-600", pulse=false, label = `${REGION_LABELS[k]} ${pAll}%`;
    if (pAll>=100){ icon="🥇"; color="bg-amber-100 text-amber-700"; pulse=true; }
    else if (pAll>=50){ icon="🥈"; color="bg-sky-100 text-sky-700"; }
    else if (pAll>=25){ icon="🎯"; color="bg-emerald-100 text-emerald-700"; }
    else if (pAll>=10){ icon="🧭"; color="bg-indigo-100 text-indigo-700"; }
    else if (pAll>0){ icon="🔥"; color="bg-rose-100 text-rose-700"; }
    out.push({ label, icon, color, pulse });
  }
  return out;
}
function renderAlbumTrophies(mp){
  const tro = trophiesFromProgress(mp);
  ui.albumTrophies.innerHTML = tro.map(t=>`
    <div class="rounded-2xl border p-3 text-center ${t.color} ${t.pulse?'badge-pulse':''}">
      <div class="text-2xl mb-1">${t.icon}</div>
      <div class="text-xs font-semibold">${t.label}</div>
    </div>`).join('');
}

/* ========= Progreso por región (módulo) ========= */
function renderAlbumProgress(){
  const mp = countTotalsByRegion();
  let html = `
    <div class="mb-2 text-sm font-semibold text-slate-700">Progreso por región</div>
    <div class="grid md:grid-cols-2 gap-3">`;
  for (const key of ["Europe","Asia","Americas","Oceania","Africa","Other"]){
    const row = mp[key];
    if (!row || row.total===0) continue;
    html += `
      <div class="rounded-2xl border bg-white p-3">
        <div class="flex items-center justify-between mb-2">
          <div class="font-bold flex items-center gap-2"><span class="text-xl">${REGION_ICONS[key]}</span>${REGION_LABELS[key]}</div>
          <div class="text-[11px] text-slate-500">Total: ${row.total}</div>
        </div>
        ${barHtml("Banderas", row.flag, row.total)}
        <div class="h-2"></div>
        ${barHtml("Capitales", row.capital, row.total)}
      </div>`;
  }
  html += `</div>
  <div class="mt-3 p-3 rounded-2xl bg-slate-50 border text-sm flex items-center gap-3">
    <span class="text-2xl">🏆</span>
    <div class="flex-1">
      <div class="font-semibold">Mundo</div>
      ${barHtml("Banderas", mp.all.flag, mp.all.total)}
      <div class="h-2"></div>
      ${barHtml("Capitales", mp.all.capital, mp.all.total)}
    </div>
    <span class="inline-flex items-center gap-1 text-amber-600 font-bold text-sm badge-pulse">★ Insignia global</span>
  </div>`;
  ui.albumProgress.innerHTML = html;
  renderAlbumTrophies(mp);
  return mp;
}

/* ========= Cartas coleccionables ========= */
let albumActiveRegion = 'all';
const ALBUM_PREFIX = {Europe:'EU',Asia:'AS',Africa:'AF',Americas:'AM',Oceania:'OC',Other:'OT'};
const albumCollator = new Intl.Collator('es', {sensitivity:'base'});
const albumRegion = region => ALBUM_PREFIX[region] ? region : 'Other';
function albumNumbers(){
  const byRegion = {};
  ALL.forEach(c => { (byRegion[albumRegion(c.region)] ||= []).push(c); });
  // Si solo ha cargado Europa, las cartas mundiales ya ganadas conservan su numeración.
  const activeRegions = new Set(Object.keys(byRegion));
  for (const c of COUNTRY_DIRECTORY){
    const region = albumRegion(c.region);
    if (!activeRegions.has(region)) (byRegion[region] ||= []).push(c);
  }
  const numbers = {};
  Object.entries(byRegion).forEach(([region, items])=>{
    items.sort((a,b)=>albumCollator.compare(a.nameES,b.nameES) || a.code.localeCompare(b.code));
    items.forEach((c,i)=>{ numbers[c.code] = `${ALBUM_PREFIX[region] || 'OT'}${String(i+1).padStart(3,'0')}/${String(items.length).padStart(3,'0')}`; });
  });
  const backup = {};
  COUNTRY_DIRECTORY.forEach(c=>{ (backup[albumRegion(c.region)] ||= []).push(c); });
  Object.entries(backup).forEach(([region, items])=>{
    items.sort((a,b)=>albumCollator.compare(a.nameES,b.nameES) || a.code.localeCompare(b.code));
    items.forEach((c,i)=>{ numbers[c.code] ||= `${ALBUM_PREFIX[region]}${String(i+1).padStart(3,'0')}/${String(items.length).padStart(3,'0')}`; });
  });
  return numbers;
}
function albumCurrency(country, code){
  const values = country?.currencies?.length ? country.currencies : (COUNTRY_CURRENCIES[code] || []);
  let names;
  try { names = new Intl.DisplayNames(['es'], {type:'currency'}); } catch { names = null; }
  if (!values.length) return 'Sin moneda oficial';
  return values.map(([iso,symbol])=>{
    const value = names?.of(iso) || iso;
    return `${value.charAt(0).toLocaleUpperCase('es')}${value.slice(1)} · ${iso}${symbol ? ` (${symbol})` : ''}`;
  }).join(' / ');
}
function albumDailyPins(){
  const solved = new Set();
  const challenges = lsGet(LS.challenge, {});
  Object.entries(challenges).forEach(([day, result])=>{
    if (result?.correct && result.countryCode) solved.add(result.countryCode);
    else if (result?.correct && day === todayStr()){
      const saved = lsGet(LS.dailyQuestion, null);
      if (saved?.day === day && saved.question?.correct?.code) solved.add(saved.question.correct.code);
    }
  });
  return solved;
}
function albumShape(code, label){
  const shape = COUNTRY_SHAPES[code];
  if (!shape) return '<span class="album-shape-unavailable">Silueta no disponible</span>';
  const box = COUNTRY_SHAPE_VIEWBOX[code] || [0,0,1010,666];
  const stroke = Math.max(box[2],box[3]) * .008;
  return `<svg class="album-shape" viewBox="${box.join(' ')}" role="img" aria-label="Silueta de ${escapeCardText(label)}"><path d="${shape}" stroke-width="${stroke}"></path></svg>`;
}
function albumWikipedia(name){
  // El enlace lleva al artículo si el título existe y muestra resultados si tiene otro nombre.
  return `https://es.wikipedia.org/w/index.php?search=${encodeURIComponent(name)}&amp;title=Especial%3ABuscar&amp;go=Ir`;
}
function renderAlbum(region=albumActiveRegion){
  albumActiveRegion = region;
  const album = getAlbum();
  const dailyPins = albumDailyPins();
  const values = Object.values(album);
  for(const code of dailyPins){
    if(album[code]) continue;
    const country=COUNTRY_DIRECTORY.find(item=>item.code===code);
    if(country) values.push({...country,flag:{unlocked:false},capital:{unlocked:false,value:''}});
  }
  const q = (ui.albumSearch.value||"").toLowerCase().trim();
  const worldIndex = {}; for(const c of ALL){ worldIndex[c.code]=c; }
  const numbers = albumNumbers();

  const filtered = values
    .filter(x => region==='all' ? true : (albumRegion(x.region)===region))
    .filter(x => !q ? true : (
      (x.nameES||"").toLowerCase().includes(q) ||
      (x.capital?.value||"").toLowerCase().includes(q)
    ))
    .filter(x => (x.flag?.unlocked || x.capital?.unlocked || dailyPins.has(x.code)))
    .sort((a,b)=> (a.nameES||"").localeCompare(b.nameES||"","es"));

  ui.albumGrid.innerHTML = filtered.map(it=>{
    const showFlag = !!it.flag?.unlocked;
    const showCap = !!(it.capital?.unlocked && (it.capital?.value || '').trim());
    const pin = dailyPins.has(it.code);
    const favorite = !!it.favorite;
    const regionKey = albumRegion(it.region);
    const regionName = REGION_LABELS[regionKey];
    const name = escapeCardText(it.nameES || worldIndex[it.code]?.nameES || 'País');
    const code = /^[a-z]{2}$/.test(it.code) ? it.code : '';
    const number = numbers[code] || '—';
    const capital = showCap ? escapeCardText(it.capital.value) : 'Por descubrir';
    const currency = escapeCardText(albumCurrency(worldIndex[code], code));
    const wikipedia = albumWikipedia(it.nameES || worldIndex[code]?.nameES || 'País');
    return `
    <article class="album-card ${showFlag && showCap && pin ? 'is-gold' : ''}" data-region="${regionKey}" data-code="${code}" aria-label="Carta de ${name}">
      <div class="album-inner">
        <section class="album-face album-front" aria-hidden="false">
          <div class="album-head"><h4>${name}</h4><button type="button" class="album-favorite" data-album-favorite="${code}" aria-label="${favorite ? 'Quitar' : 'Añadir'} ${name} ${favorite ? 'de' : 'a'} favoritos" aria-pressed="${favorite}">${favorite?'★':'☆'}</button></div>
          <div class="album-badges">${pin ? countryPin(code,it.nameES) : ''}</div>
          <div class="album-scene ${showFlag ? '' : 'is-locked'}">${albumShape(code,it.nameES)}${showFlag ? `<div class="album-flag"><img src="${flagUrl(code)}" alt="Bandera de ${name}" loading="lazy"></div>` : ''}</div>
          <div class="album-capital ${showCap ? '' : 'is-missing'}"><span>Capital</span><strong>${capital}</strong></div>
          <div class="album-foot"><span class="album-number" aria-label="${number}, ${escapeCardText(regionName)}">${number}</span><button type="button" class="album-flip" data-album-flip="back" aria-label="Ver reverso de ${name}"><span class="album-flip-label">Ver reverso </span>↗</button></div>
        </section>
        <section class="album-face album-back" aria-hidden="true" inert>
          <h4>${name}</h4><p>Colección ${escapeCardText(regionName)}</p>
          <div class="album-back-map">${albumShape(code,it.nameES)}</div>
          <div class="album-detail"><span>Moneda</span><strong>${currency}</strong></div>
          <a class="album-wikipedia" href="${wikipedia}" target="_blank" rel="noopener noreferrer" aria-label="Conocer ${name} en Wikipedia">Wikipedia ↗</a>
          <div class="album-foot"><button type="button" class="album-flip" data-album-flip="front" aria-label="Ver anverso de ${name}"><span class="album-flip-label">Ver anverso </span>↶</button></div>
        </section>
      </div>
    </article>`;
  }).join('');
  ui.albumEmpty.classList.toggle('hidden', filtered.length>0);

  // Progreso + trofeos
  renderAlbumProgress();
}

/* ========= Selección / respuesta ========= */
function onSelect(e){
  if (locked || paused) return;
  locked = true;
  if (currentMode!=='study') {
    qAccumulatedMs += (Date.now() - qActiveStartMs);
    if (currentMode==='survival') stopSurvivalTimer();
    else stopTimer();
  }

  const btn = e.currentTarget;
  const correct = btn.dataset.correct === "1";
  const q = order[idx];

  if(!missMap[q.item.code]) missMap[q.item.code] = {name: q.item.nameES, attempts:0, wrong:0};
  missMap[q.item.code].attempts += 1;

  if (q.kind === 'flag'){
    if (correct){
      score += 10; hits += 1; streak += 1; fxCorrect();
      ui.whyFlag.textContent = whyText(q.item);
      markFlagLearned(q.item);
    } else {
      misses += 1; streak = 0; missMap[q.item.code].wrong += 1;
      if (currentMode!=='study' && LEVELS[currentLevel].wrongPenalty<0) score = Math.max(0, score + LEVELS[currentLevel].wrongPenalty);
      fxWrong();
      if(currentMode==='study'){ studyQueue.push({ ...q }); }
    }
    ui.points.textContent = score; ui.hits.textContent = hits; ui.misses.textContent = misses;
    markButtons($$("#card-flag .answer-btn"), btn);
  } else {
    if (correct){
      score += 10; hits += 1; streak += 1; fxCorrect();
      ui.flagImgReveal.classList.remove('hidden'); ui.countryReveal.classList.remove('hidden');
      ui.whyCap.textContent = whyText(q.item);
      markCapitalLearned(q.item);
    } else {
      misses += 1; streak = 0; missMap[q.item.code].wrong += 1;
      if (currentMode!=='study' && LEVELS[currentLevel].wrongPenalty<0) score = Math.max(0, score + LEVELS[currentLevel].wrongPenalty);
      fxWrong();
      ui.flagImgReveal.classList.remove('hidden'); ui.countryReveal.classList.remove('hidden');
      if(currentMode==='study'){ studyQueue.push({ ...q }); }
    }
    ui.points.textContent = score; ui.hits.textContent = hits; ui.misses.textContent = misses;
    markButtons($$("#card-capital .answer-btn.cap"), btn);
  }

  if (correct){
    runStreak += 1;
    bestRunStreak = Math.max(bestRunStreak, runStreak);
    if (leagueRun && currentMode === 'study' && idx < MAX_Q) leagueStudyFirstHits++;
  } else { runStreak = 0; }

// Desbloqueos por región y tipo, solo tras acertar.
if (correct) {
  const regionKey = (q.item?.region || 'all');
  if (q.kind === 'flag') {
    unlockAchievement('primer_bandera_mundo');
    const map = {
      Europe:'primer_bandera_europa',
      Asia:'primer_bandera_asia',
      Africa:'primer_bandera_africa',
      Americas:'primer_bandera_america',
      Oceania:'primer_bandera_oceania'
    };
    if (map[regionKey]) unlockAchievement(map[regionKey]);
  } else if (q.kind === 'capital') {
    unlockAchievement('primer_capital_mundo');
    const map = {
      Europe:'primer_capital_europa',
      Asia:'primer_capital_asia',
      Africa:'primer_capital_africa',
      Americas:'primer_capital_america',
      Oceania:'primer_capital_oceania'
    };
    if (map[regionKey]) unlockAchievement(map[regionKey]);
  }
  for (const target of [3, 10, 25]) {
    if (streak >= target) unlockAchievement(`rachas_${target}`);
  }
}
lsSet(LS.streak, streak);

  

  if (currentMode!=='study') timesMs.push(qAccumulatedMs);
  if (currentMode==='survival'){
    if (!correct){ endGame('wrong'); return; }
    unlockSurvivalMilestones();
  }

  advanceProgress();
  scheduleNext();
}

function handleTimeout(){
  if (locked) return;
  locked = true;
  qAccumulatedMs += (Date.now() - qActiveStartMs);
  timesMs.push(qAccumulatedMs);
  if (currentMode==='survival'){
    streak = 0; runStreak = 0; lsSet(LS.streak, 0);
    fxWrong(); endGame('timeout'); return;
  }
  const q = order[idx];

  if(!missMap[q.item.code]) missMap[q.item.code] = {name: q.item.nameES, attempts:0, wrong:0};
  missMap[q.item.code].attempts += 1;
  missMap[q.item.code].wrong += 1;

  const { wrongPenalty } = LEVELS[currentLevel];
  if (wrongPenalty < 0) score = Math.max(0, score + wrongPenalty);
  misses += 1; streak = 0; runStreak = 0;
  lsSet(LS.streak, 0);
  ui.points.textContent = score; ui.misses.textContent = misses;

  if (q.kind === 'flag'){
    markButtons($$("#card-flag .answer-btn"), null);
    ui.whyFlag.textContent = whyText(q.item);
  } else {
    ui.flagImgReveal.classList.remove('hidden'); ui.countryReveal.classList.remove('hidden');
    markButtons($$("#card-capital .answer-btn.cap"), null);
    ui.whyCap.textContent = whyText(q.item);
  }
  fxWrong();
  advanceProgress();
  scheduleNext();
}

function advanceProgress(){
  if (currentMode==='survival') {
    ui.progressBar.style.width = (hits / roundLength * 100) + '%';
  } else if (currentMode==='study'){
    ui.progressBar.style.width = '0%';
  } else {
    ui.progressBar.style.width = (((idx + 1) / roundLength) * 100) + "%";
  }
}
function scheduleNext(){ if(nextTimer){ clearTimeout(nextTimer); } nextTimer = setTimeout(nextQuestion, 700); }
function nextQuestion(){
  if (currentMode==='study'){
    if (idx < order.length - 1){ idx++; }
    else if (studyQueue.length){ order.push(studyQueue.shift()); idx++; }
    else { endGame(false); return; }
    renderQuestion(); return;
  }
  if (currentMode==='survival'){
    if (idx === roundLength - 1){ endGame('victory'); return; }
    idx++;
    renderQuestion(); return;
  }
  if (idx < roundLength - 1){ idx++; renderQuestion(); } else { endGame(false); }
}

/* ========= Supervivencia ========= */
let survivalInterval = null;
function startSurvivalTimer(){
  stopSurvivalTimer();
  ui.timeLeft.textContent = Math.ceil(timeLeft);
  ui.timeBar.style.width = Math.min(100,(timeLeft / survivalRules().start) * 100) + "%";
  qActiveStartMs = Date.now();
  survivalInterval = setInterval(()=>{
    timeLeft = Math.max(0, timeLeft - 0.1);
    ui.timeLeft.textContent = Math.ceil(timeLeft);
    ui.timeBar.style.width = Math.max(0, Math.min(100, (timeLeft / survivalRules().start) * 100)) + "%";
    if (timeLeft<=0){
      locked = true;
      qAccumulatedMs += (Date.now() - qActiveStartMs);
      timesMs.push(qAccumulatedMs);
      streak = 0; runStreak = 0; lsSet(LS.streak, 0);
      fxWrong(); endGame('timeout');
    }
  }, 100);
}
function stopSurvivalTimer(){ if (survivalInterval) { clearInterval(survivalInterval); survivalInterval=null; } }

function endGame(reason){
  stopTimer(); stopSurvivalTimer(); if(nextTimer){ clearTimeout(nextTimer); nextTimer=null; }
  if (currentMode==='survival' && reason==='victory') unlockSurvivalVictory();
  const perfect = roundLength > 0 && hits === roundLength && misses === 0;
  ui.finalTitle.closest?.('#finalCard')?.classList.toggle('survival-victory', currentMode==='survival' && reason==='victory');
  screens.final.classList.toggle('perfect-run', perfect);
  screens.final.classList.toggle('survival-ended', currentMode==='survival' && reason!=='victory');
  ui.finalTitle.textContent = currentMode==='survival' && reason==='victory' ? `🏆 ${survivalVictoryTitle()}` :
    perfect ? '¡Partida perfecta!' : currentMode==='survival' ? 'Fin de Supervivencia' : '¡Buen viaje!';
  ui.finalMeta.textContent = [gameModeLabel(), REGION_LABELS[currentTheme] || currentTheme,
    LEVELS[currentLevel]?.label || ''].filter(Boolean).join(' · ');
  ui.finalReason.textContent = `${hits}/${roundLength} aciertos`;
  $('#finalContext').textContent = reason==='timeout' ? 'Se agotó el tiempo.' :
    reason==='wrong' ? 'Una respuesta incorrecta terminó Supervivencia.' : '';
  $('#finalContext').classList.toggle('hidden', reason!=='timeout' && reason!=='wrong');

  unlockAchievement('progreso_primer_paso');
  if (lsGet(LS.scores, []).length + 1 >= 50) unlockAchievement('progreso_veterano_50');
  if (currentTheme !== 'all') {
    const visited = lsGet(LS.visited, {});
    visited[currentTheme] = true;
    lsSet(LS.visited, visited);
    if (['Europe','Asia','Africa','Americas','Oceania'].every(region => visited[region])) {
      unlockAchievement('exploracion_continentes');
    }
  }
  
  
  const newAchievements = Array.from(unlockedThisRun);
  $('#finalAchievementPanel').classList.toggle('hidden', newAchievements.length === 0);
  renderFinalAchievementChips(ui.achievementsList, newAchievements);

  $('#finalAlbumCount').textContent = albumUnlockedThisRun.size;
  $('#finalAlbumPanel').classList.toggle('hidden', albumUnlockedThisRun.size === 0);
  $('#finalRewards').classList.toggle('hidden', albumUnlockedThisRun.size === 0 && newAchievements.length === 0);

  showScreen('final');

  const durationMs = timesMs.reduce((a,b)=>a+b,0);
  recordGameToLeague({name: playerName||'Anónimo', score, mode: gameModeLabel(), level: currentLevel, theme: currentTheme, durationMs});
  updateGlobalStatsFromRun();
  if (leagueRun){
    window.CloudLeagues?.submitRun({attemptId:leagueRun.attemptId,category:leagueRun.category,
      hits,misses,total:roundLength,studyFirstHits:leagueStudyFirstHits,durationMs});
    leagueRun = null;
    gameRng = Math.random;
  }
}
/* ========= Liga ========= */
function renderLeague(){
  const scores = lsGet(LS.scores, []);
  const week = isoWeekStringLocal();
  ui.leagueWeek.textContent = week;

  const byPlayer = {};
  scores.filter(s => s.week===week).forEach(s=>{
    if(!byPlayer[s.name] || s.score > byPlayer[s.name].score){ byPlayer[s.name] = s; }
  });
  const rows = Object.values(byPlayer).sort((a,b)=> b.score - a.score).slice(0,50);

  if (!rows.length){
    ui.leagueTable.innerHTML = `<div class="p-4 rounded-xl border bg-slate-50 text-sm text-slate-600">Aún no hay partidas registradas esta semana.</div>`;
    return;
  }

  const html = `
    <table class="w-full text-sm">
      <thead><tr class="text-left text-slate-500">
        <th class="py-2 pr-2">#</th><th class="py-2 pr-2">Jugador</th><th class="py-2 pr-2">Puntos</th>
        <th class="py-2 pr-2">Modo</th><th class="py-2 pr-2">Nivel</th><th class="py-2 pr-2">Tema</th><th class="py-2 pr-2">Duración</th>
      </tr></thead>
      <tbody>
        ${rows.map((r,i)=>`
          <tr class="border-t">
            <td class="py-2 pr-2 font-semibold">${i+1}</td>
            <td class="py-2 pr-2">${r.name}</td>
            <td class="py-2 pr-2 font-bold">${r.score}</td>
            <td class="py-2 pr-2">${r.mode}</td>
            <td class="py-2 pr-2">${r.level}</td>
            <td class="py-2 pr-2">${r.theme==='all'?'Mundo':r.theme}</td>
            <td class="py-2 pr-2">${Math.round((r.durationMs||0)/1000)}s</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
  ui.leagueTable.innerHTML = html;

  ui.leagueName.value = playerName || '';
}

/* ========= Estadísticas ========= */
function msToStr(ms){ const s=Math.round(ms/1000); return s+'s'; }
function renderStats(tab='overview'){
  const st = lsGet(LS.stats, { times:{count:0,sumMs:0,maxMs:0,minMs:0}, countries:{} });
  const ach = listAchievements();

  if (tab==='overview'){
    const avg = st.times.count ? (st.times.sumMs/st.times.count) : 0;
    $('#statsContent').innerHTML = `
      <div class="grid sm:grid-cols-3 gap-3">
        <div class="rounded-xl border p-3 bg-slate-50/50"><div class="text-xs text-slate-500">Respuestas registradas</div><div class="text-2xl font-extrabold">${st.times.count}</div></div>
        <div class="rounded-xl border p-3 bg-slate-50/50"><div class="text-xs text-slate-500">Tiempo medio</div><div class="text-2xl font-extrabold">${msToStr(avg)}</div></div>
        <div class="rounded-xl border p-3 bg-slate-50/50"><div class="text-xs text-slate-500">Logros</div><div class="text-2xl font-extrabold">${ach.length}</div></div>
      </div>`;
    return;
  }

  if (tab==='mistakes'){
    // FIX: spread ...v correcto
    const arr = Object.entries(st.countries||{}).map(([code, v]) => ({ code, ...v, rate: (v.wrong||0)/Math.max(1,(v.attempts||0)) }))
      .filter(x=>x.attempts>2).sort((a,b)=> b.rate - a.rate).slice(0,15);
    $('#statsContent').innerHTML = arr.length ? `
      <table class="w-full text-sm">
        <thead><tr class="text-left text-slate-500"><th class="py-2 pr-2">País</th><th class="py-2 pr-2">Intentos</th><th class="py-2 pr-2">Fallos</th><th class="py-2 pr-2">% fallo</th></tr></thead>
        <tbody>${arr.map(r=>`<tr class="border-t"><td class="py-2 pr-2">${r.name}</td><td class="py-2 pr-2">${r.attempts}</td><td class="py-2 pr-2">${r.wrong}</td><td class="py-2 pr-2">${(r.rate*100).toFixed(0)}%</td></tr>`).join('')}</tbody>
      </table>` : `<div class="p-4 rounded-xl border bg-slate-50 text-sm text-slate-600">Aún no hay datos suficientes.</div>`;
    return;
  }

  if (tab==='times'){
    const c = st.times;
    $('#statsContent').innerHTML = `
      <div class="grid sm:grid-cols-3 gap-3">
        <div class="rounded-xl border p-3 bg-slate-50/50"><div class="text-xs text-slate-500">Respuestas</div><div class="text-2xl font-extrabold">${c.count||0}</div></div>
        <div class="rounded-xl border p-3 bg-slate-50/50"><div class="text-xs text-slate-500">Total</div><div class="text-2xl font-extrabold">${msToStr(c.sumMs||0)}</div></div>
        <div class="rounded-xl border p-3 bg-slate-50/50"><div class="text-xs text-slate-500">Máx / Mín</div><div class="text-2xl font-extrabold">${msToStr(c.maxMs||0)} / ${msToStr(c.minMs||0)}</div></div>
      </div>`;
    return;
  }
if (tab === 'achievements') {
  const ids = listAchievements();
  if (!ids.length){
    $('#statsContent').innerHTML = `<div class="p-4 rounded-xl border bg-slate-50 text-sm text-slate-600">Aún no has desbloqueado logros.</div>`;
    return;
  }
  const achMap = getAchievements();
  loadAchCatalog().then(cat=>{
    $('#statsContent').innerHTML = ids.map(id=>{
      const meta = cat[id];
      const name = meta?.name ?? id;
      const desc = meta?.desc ?? '';
      const dt = achMap[id]?.date ? new Date(achMap[id].date).toLocaleString('es-ES') : '';
      return `<div class="rounded-xl border p-3 bg-emerald-50/50 mb-2">
        <div class="font-bold">🏅 ${name}</div>
        <div class="text-xs text-slate-600">${desc}</div>
        <div class="text-[11px] text-slate-500 mt-1">${dt}</div>
      </div>`;
    }).join('');
  });
  return;
}
}

/* ========= Logros (modal viejo → vitrina nueva) ========= */
function renderAchievementsModal(){
  const modal = document.getElementById('achModal');
  const grid  = document.getElementById('achGrid');
  const empty = document.getElementById('achEmpty');

  // Si ya no existe el modal viejo, redirigimos a la vitrina nueva
  if (!modal || !grid) {
    const section = document.getElementById('achievementsSection');
    if (section) {
      section.classList.remove('hidden');
      if (typeof renderAchievements === 'function') renderAchievements();
    }
    return;
  }

  const ach = listAchievements();
  if (!ach.length){
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  const palette = { bronce:'bg-amber-100 text-amber-800', plata:'bg-slate-100 text-slate-700', oro:'bg-yellow-100 text-yellow-800' };
  grid.innerHTML = ach.map(a=>`
    <div class="rounded-2xl border p-4 ${palette[a.tier]||'bg-slate-100 text-slate-700'} shadow-sm">
      <div class="flex items-start gap-3">
        <div class="text-3xl">${a.icon || '🏅'}</div>
        <div>
          <div class="font-bold">${a.name}</div>
          <div class="text-sm opacity-80">${a.desc||''}</div>
          <div class="text-[11px] opacity-60 mt-1">${new Date(a.date).toLocaleString('es-ES')}</div>
        </div>
      </div>
    </div>`).join('');
}

/* ========= Eventos UI ========= */
// Inicio
function saveHomePlayer(){
  playerName = ui.playerInput.value.trim() || 'Anónimo';
  lsSet(LS.name, playerName);
}
ui.goToMode.addEventListener('click', ()=>{
  saveHomePlayer();
  showScreen('mode');
});
$$('[data-go-player]').forEach(button=>button.addEventListener('click', ()=>showScreen('player')));
$$('[data-home-open]').forEach(button=>button.addEventListener('click', ()=>{
  const target = document.getElementById(button.dataset.homeOpen);
  target?.click();
  if (button.dataset.homeOpen === 'btnMute') {
    button.textContent = target.textContent;
  }
}));
ui.playerInput.addEventListener('keydown', e=>{
  if (e.key === 'Enter') ui.goToMode.click();
});
ui.backToPlayer.addEventListener('click', ()=> showScreen('player'));
$('#exitTopBtn').addEventListener('click', ()=> $('#card-flag').classList.contains('hidden') ? $('#exitBtn2').click() : $('#exitBtn').click());

// Selecciones
$$('.mode-btn').forEach(b=>{
  b.addEventListener('click', ()=>{
    const m = b.dataset.mode;
    if (m==='daily'){ renderDailyModal(); $("#dailyModal").showModal(); return; }
    currentMode = m;
    $$('.mode-btn').forEach(x=>x.classList.remove('ring-2','ring-sky-400'));
    b.classList.add('ring-2','ring-sky-400');
    updateSurvivalSelection();
  });
});
function updateSurvivalSelection(){
  const active = currentMode === 'survival';
  $('#survivalChoices').classList.toggle('hidden', !active);
  ui.selMode.textContent = active && survivalKind ? gameModeLabel() : modeLabel(currentMode);
  $('#levelKids').textContent = active ? '🙂 Niños (25 s)' : '🙂 Niños (15 s)';
  $('#levelAdult').textContent = active ? '⚡ Adultos (20 s)' : '⚡ Adultos (12 s)';
  $('#levelMaster').textContent = active ? '👑 Máster (15 s)' : '👑 Máster (8 s, −5)';
}
$$('.survival-kind-btn').forEach(b=>{
  b.addEventListener('click', ()=>{
    survivalKind = b.dataset.survivalKind;
    $$('.survival-kind-btn').forEach(x=>x.classList.remove('ring-2','ring-rose-400'));
    b.classList.add('ring-2','ring-rose-400');
    updateSurvivalSelection();
  });
});
$$('.theme-btn').forEach(b=>{
  b.addEventListener('click', ()=>{
    currentTheme = b.dataset.theme;
    $$('.theme-btn').forEach(x=>x.classList.remove('ring-2','ring-emerald-400'));
    b.classList.add('ring-2','ring-emerald-400');
    ui.selTheme.textContent = REGION_LABELS[currentTheme] || currentTheme;
  });
});
$$('.level-btn').forEach(b=>{
  b.addEventListener('click', ()=>{
    currentLevel = b.dataset.level;
    $$('.level-btn').forEach(x=>x.classList.remove('ring-2','ring-amber-400'));
    b.classList.add('ring-2','ring-amber-400');
    ui.selLevel.textContent = LEVELS[currentLevel]?.label || '—';
  });
});

// Jugar
ui.startGame.addEventListener('click', ()=>{
  if (!currentMode || currentMode==='daily'){ alert('Elige un modo (excepto Reto del día)'); return; }
  if (currentMode==='survival' && !['flags','capitals','mixed'].includes(survivalKind)){
    alert('Elige Banderas, Capitales o Mixto para Supervivencia.'); return;
  }
  if (!currentTheme){ alert('Elige un tema'); return; }
  if (!currentLevel && currentMode!=='survival' && currentMode!=='study'){ alert('Elige dificultad'); return; }
  try{ audioCtx.resume(); }catch{}
  newGame();
});

// Juego controls
function restartCurrentRun(){
  if (leagueRun){ alert('Este intento de liga ya ha comenzado y no se puede reiniciar.'); return; }
  stopTimer(); stopSurvivalTimer(); if(nextTimer){ clearTimeout(nextTimer); nextTimer=null; } newGame();
}
function exitCurrentRun(){
  if (leagueRun && !confirm('¿Salir del reto? Este intento se perderá.')) return;
  leagueRun = null; gameRng = Math.random;
  stopTimer(); stopSurvivalTimer(); if(nextTimer){ clearTimeout(nextTimer); nextTimer=null; } showScreen('mode');
}
$('#restartBtn').addEventListener('click', restartCurrentRun);
$('#restartBtn2').addEventListener('click', restartCurrentRun);
$('#exitBtn').addEventListener('click', exitCurrentRun);
$('#exitBtn2').addEventListener('click', exitCurrentRun);

// Atajos y pausa
$('#pauseBtn').addEventListener('click', togglePause);
$('#pauseBtn2').addEventListener('click', togglePause);
document.addEventListener('keydown', (e)=>{
  if(screens.game.classList.contains('active')){
    const pick = ['1','2','3','4'].includes(e.key) ? Number(e.key)-1 : ['a','b','c','d'].indexOf(e.key.toLowerCase());
    if(pick >= 0){
      const pool = $("#card-flag").classList.contains('hidden') ? $$("#card-capital .answer-btn.cap") : $$("#card-flag .answer-btn");
      if(pool[pick] && !pool[pick].disabled) pool[pick].click();
    }
    if(e.key.toLowerCase()==='p') togglePause();
  }
});

// Final
$('#playAgainBtn').addEventListener('click', ()=> newGame());
$('#changeModeBtn').addEventListener('click', ()=> showScreen('mode'));
$('#goHomeBtn').addEventListener('click', ()=>{ stopTimer(); stopSurvivalTimer(); showScreen('player'); });
$('#shareResult').addEventListener('click', ()=>{
  const text = `🏆 ${playerName} · ${gameModeLabel()} (${LEVELS[currentLevel]?.label||'—'} · ${currentTheme==='all'?'Mundo':currentTheme}) · ${score} puntos · ${isoWeekStringLocal()}`;
  if(navigator.share) navigator.share({text}).catch(()=>{ navigator.clipboard.writeText(text); alert("Copiado"); });
  else { navigator.clipboard.writeText(text); alert("Copiado"); }
});
ui.openAlbumFromFinal?.addEventListener('click', ()=>{
  $('#albumModal').showModal();
  renderAlbumRegionChips('all');
  renderAlbum('all');
});

/* ========= Modales & tabs ========= */
$('#helpBtn').addEventListener('click', ()=> $("#helpModal").showModal());
$('#closeHelp').addEventListener('click', ()=> $("#helpModal").close());

// Liga
$('#btnLeague').addEventListener('click', ()=>{ renderLeague(); $("#leagueModal").showModal(); });
$('#closeLeague').addEventListener('click', ()=> $("#leagueModal").close());
$('#saveLeagueName').addEventListener('click', ()=>{ const n=$('#leagueName').value.trim(); if(n){ playerName=n; lsSet(LS.name, playerName); $('#hudPlayer').textContent=playerName; } });
$('#resetLeague').addEventListener('click', ()=>{ if(confirm('¿Borrar ranking y estadísticas locales?')){ localStorage.removeItem(LS.scores); localStorage.removeItem(LS.stats); renderLeague(); } });

// Stats
$('#btnStats').addEventListener('click', ()=>{ renderStats('overview'); $("#statsModal").showModal(); setActiveTab('overview'); });
$('#closeStats').addEventListener('click', ()=> $("#statsModal").close());
$$("#statsModal .tab-btn").forEach(btn=> btn.addEventListener('click', ()=>{ setActiveTab(btn.dataset.tab); renderStats(btn.dataset.tab); }));
function setActiveTab(tab){ $$("#statsModal .tab-btn").forEach(b=> b.classList.remove('active')); $(`#statsModal .tab-btn[data-tab="${tab}"]`).classList.add('active'); }

// Reto del día
$('#closeDaily').addEventListener('click', ()=> $("#dailyModal").close());

// Álbum
ui.btnAlbum?.addEventListener('click', ()=>{
  ui.albumSearch.value = '';
  renderAlbumRegionChips('all');
  renderAlbum('all');
  ui.albumModal.showModal();
});
ui.closeAlbum?.addEventListener('click', ()=> ui.albumModal.close());
ui.albumSearch?.addEventListener('input', ()=> renderAlbum(albumActiveRegion));
ui.albumGrid?.addEventListener('click', event=>{
  const favorite = event.target.closest('[data-album-favorite]');
  if (favorite){
    const album = getAlbum();
    const entry = album[favorite.dataset.albumFavorite];
    if (!entry) return;
    entry.favorite = !entry.favorite;
    saveAlbum(album);
    favorite.setAttribute('aria-pressed', String(entry.favorite));
    favorite.setAttribute('aria-label', `${entry.favorite ? 'Quitar' : 'Añadir'} ${entry.nameES} ${entry.favorite ? 'de' : 'a'} favoritos`);
    favorite.textContent = entry.favorite ? '★' : '☆';
    return;
  }
  const flip = event.target.closest('[data-album-flip]');
  if (!flip) return;
  const card = flip.closest('.album-card');
  const back = flip.dataset.albumFlip === 'back';
  card.classList.toggle('is-flipped', back);
  const frontFace = card.querySelector('.album-front');
  const backFace = card.querySelector('.album-back');
  frontFace.inert = back;
  backFace.inert = !back;
  frontFace.setAttribute('aria-hidden', String(back));
  backFace.setAttribute('aria-hidden', String(!back));
});

// Logros (botón header) — compat vitrina nueva / modal antiguo
ui.btnAchievements?.addEventListener('click', ()=>{
  if (typeof window.renderAchievements === 'function') {
    window.renderAchievements(); // la vitrina crea/abre su overlay
  } else {
    // Fallback: muestra la sección inline si existiera
    const s = document.getElementById('achievementsSection');
    if (s) s.classList.remove('hidden');
  }
});
$('#closeAch')?.addEventListener('click', ()=> ui.achModal?.close?.());

// Respuestas
$$("#card-flag .answer-btn").forEach(b=> b.addEventListener('click', onSelect));
$$("#card-capital .answer-btn.cap").forEach(b=> b.addEventListener('click', onSelect));

/* ========= Carga inicial ========= */
async function ensureDataLoaded(){ if(!ALL.length) await loadData(); }

window.addEventListener('DOMContentLoaded', async ()=>{
  ui.startGame.disabled = true;
  $('#tile-daily').disabled = true;
  playerName = lsGet(LS.name, "") || "";
  if(playerName) $("#playerName").value = playerName;
  $('#screen-player [data-home-open="btnMute"]').textContent = $('#btnMute').textContent;
  try{ await ensureDataLoaded(); }catch(e){ console.warn('Error al cargar países', e); updateCatalogStatus(); }
  const last = lsGet(LS.last, null);
  if(last){
    currentMode = last.mode || null;
    survivalKind = ['flags','capitals','mixed'].includes(last.survivalKind) ? last.survivalKind : null;
    currentLevel = last.level || 'adult';
    currentTheme = last.theme || 'all';
    if(currentMode){
      $$('.mode-btn').find(b=>b.dataset.mode===currentMode)?.classList.add('ring-2','ring-sky-400');
      $$('.survival-kind-btn').find(b=>b.dataset.survivalKind===survivalKind)?.classList.add('ring-2','ring-rose-400');
    }
  }
  if (catalogScope === 'europe' && currentTheme !== 'Europe') {
    currentTheme = 'Europe';
  }
  ui.selLevel.textContent = LEVELS[currentLevel]?.label || '—';
  ui.selTheme.textContent = REGION_LABELS[currentTheme] || currentTheme;
  $$('.theme-btn').find(b=>b.dataset.theme===currentTheme)?.classList.add('ring-2','ring-emerald-400');
  $$('.level-btn').find(b=>b.dataset.level===currentLevel)?.classList.add('ring-2','ring-amber-400');
  updateSurvivalSelection();
  reconcileAchievements();
  updateDailyTile();
});

/* ========= Panel dev (opcional, tolerante) ========= */
(function initDevPanel(){
  function setup(){
    const devPanel = document.getElementById('devControl');
    const btnDevToggle = document.getElementById('btnDevToggle');
    const btnCloseControl = document.getElementById('btnCloseControl');
    if (!devPanel || !btnDevToggle) return;

    const checkboxes = devPanel.querySelectorAll('input[type="checkbox"]');
    const savedProgress = JSON.parse(localStorage.getItem('devProgress') || '{}');

    checkboxes.forEach(chk => { chk.checked = !!savedProgress[chk.id]; });
    btnDevToggle.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      devPanel.classList.toggle('hidden');
    });
    btnCloseControl?.addEventListener('click', (e) => { e.preventDefault(); devPanel.classList.add('hidden'); });
    checkboxes.forEach(chk => {
      chk.addEventListener('change', () => {
        savedProgress[chk.id] = chk.checked;
        localStorage.setItem('devProgress', JSON.stringify(savedProgress));
      });
    });
    document.addEventListener('click', (ev) => {
      if (!devPanel.classList.contains('hidden')) {
        const inside = devPanel.contains(ev.target) || btnDevToggle.contains(ev.target);
        if (!inside) devPanel.classList.add('hidden');
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once:true });
  else setup();
})();
