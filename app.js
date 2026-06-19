const APP_CONFIG = window.MUNDIAL_CONFIG || {};
const ADMIN_PIN = APP_CONFIG.adminPin || "1234";
const STORAGE_KEY = "mundial_pontos_2026_import_id_jogo_v32";
const PENDING_FIREBASE_KEY = `${STORAGE_KEY}_pending_games_v1`;
const PENDING_FULL_SYNC_KEY = `${STORAGE_KEY}_pending_full_sync_v1`;
const PENDING_DELETE_BETS_KEY = `${STORAGE_KEY}_pending_delete_bets_v1`;
const PENDING_BETS_KEY = `${STORAGE_KEY}_pending_bets_v1`;
const PENDING_SETTINGS_KEY = `${STORAGE_KEY}_pending_settings_v1`;
const PORTUGAL_TZ = "Europe/Lisbon";

let db = null;
let firebaseApi = null;
let firebaseAuth = null;
let firebaseAuthApi = null;
let currentUser = null;
let currentProfile = null;
let permissionsCache = [];
let storageMode = "local";
let games = [];
let bets = [];
let appSettings = defaultSettings();
let searchText = "";
let calendarViewMode = "missing";
let selectedEditUser = "";
let isAdmin = localStorage.getItem("mundial_admin_unlocked") === "1";
let pendingExcelImport = null;
let fullSyncTimer = null;

const MATCH_ROWS = [
  ["Grupo A", "México", "África do Sul", "2026-06-11T20:00"],
  ["Grupo A", "Coreia do Sul", "Chéquia", "2026-06-12T03:00"],
  ["Grupo B", "Canadá", "Bósnia", "2026-06-12T20:00"],
  ["Grupo D", "Estados Unidos", "Paraguai", "2026-06-13T02:00"],
  ["Grupo B", "Qatar", "Suíça", "2026-06-13T20:00"],
  ["Grupo C", "Brasil", "Marrocos", "2026-06-13T23:00"],
  ["Grupo C", "Haiti", "Escócia", "2026-06-14T02:00"],
  ["Grupo D", "Austrália", "Turquia", "2026-06-14T05:00"],
  ["Grupo E", "Alemanha", "Curaçao", "2026-06-14T18:00"],
  ["Grupo F", "Países Baixos", "Japão", "2026-06-14T21:00"],
  ["Grupo E", "Costa do Marfim", "Equador", "2026-06-15T00:00"],
  ["Grupo F", "Suécia", "Tunísia", "2026-06-15T03:00"],
  ["Grupo H", "Espanha", "Cabo Verde", "2026-06-15T17:00"],
  ["Grupo G", "Bélgica", "Egito", "2026-06-15T20:00"],
  ["Grupo H", "Arábia Saudita", "Uruguai", "2026-06-15T23:00"],
  ["Grupo G", "Irão", "Nova Zelândia", "2026-06-16T02:00"],
  ["Grupo I", "França", "Senegal", "2026-06-16T20:00"],
  ["Grupo I", "Iraque", "Noruega", "2026-06-16T23:00"],
  ["Grupo J", "Argentina", "Argélia", "2026-06-17T02:00"],
  ["Grupo J", "Áustria", "Jordânia", "2026-06-17T05:00"],
  ["Grupo K", "Portugal", "RD Congo", "2026-06-17T18:00"],
  ["Grupo L", "Inglaterra", "Croácia", "2026-06-17T21:00"],
  ["Grupo L", "Gana", "Panamá", "2026-06-18T00:00"],
  ["Grupo K", "Uzbequistão", "Colômbia", "2026-06-18T03:00"],
  ["Grupo A", "Chéquia", "África do Sul", "2026-06-18T17:00"],
  ["Grupo B", "Suíça", "Bósnia", "2026-06-18T20:00"],
  ["Grupo B", "Canadá", "Qatar", "2026-06-18T23:00"],
  ["Grupo A", "México", "Coreia do Sul", "2026-06-19T02:00"],
  ["Grupo D", "Estados Unidos", "Austrália", "2026-06-19T20:00"],
  ["Grupo C", "Escócia", "Marrocos", "2026-06-19T23:00"],
  ["Grupo C", "Brasil", "Haiti", "2026-06-20T01:30"],
  ["Grupo D", "Turquia", "Paraguai", "2026-06-20T04:00"],
  ["Grupo F", "Países Baixos", "Suécia", "2026-06-20T18:00"],
  ["Grupo E", "Alemanha", "Costa do Marfim", "2026-06-20T21:00"],
  ["Grupo E", "Equador", "Curaçao", "2026-06-21T01:00"],
  ["Grupo F", "Tunísia", "Japão", "2026-06-21T05:00"],
  ["Grupo H", "Espanha", "Arábia Saudita", "2026-06-21T17:00"],
  ["Grupo G", "Bélgica", "Irão", "2026-06-21T20:00"],
  ["Grupo H", "Uruguai", "Cabo Verde", "2026-06-21T23:00"],
  ["Grupo G", "Nova Zelândia", "Egito", "2026-06-22T02:00"],
  ["Grupo J", "Argentina", "Áustria", "2026-06-22T18:00"],
  ["Grupo I", "França", "Iraque", "2026-06-22T22:00"],
  ["Grupo I", "Noruega", "Senegal", "2026-06-23T01:00"],
  ["Grupo J", "Jordânia", "Argélia", "2026-06-23T04:00"],
  ["Grupo K", "Portugal", "Uzbequistão", "2026-06-23T18:00"],
  ["Grupo L", "Inglaterra", "Gana", "2026-06-23T21:00"],
  ["Grupo L", "Panamá", "Croácia", "2026-06-24T00:00"],
  ["Grupo K", "Colômbia", "RD Congo", "2026-06-24T03:00"],
  ["Grupo B", "Suíça", "Canadá", "2026-06-24T20:00"],
  ["Grupo B", "Bósnia", "Qatar", "2026-06-24T20:00"],
  ["Grupo C", "Escócia", "Brasil", "2026-06-24T23:00"],
  ["Grupo C", "Marrocos", "Haiti", "2026-06-24T23:00"],
  ["Grupo A", "África do Sul", "Coreia do Sul", "2026-06-25T02:00"],
  ["Grupo A", "Chéquia", "México", "2026-06-25T02:00"],
  ["Grupo E", "Curaçao", "Costa do Marfim", "2026-06-25T21:00"],
  ["Grupo E", "Equador", "Alemanha", "2026-06-25T21:00"],
  ["Grupo F", "Tunísia", "Países Baixos", "2026-06-26T00:00"],
  ["Grupo F", "Japão", "Suécia", "2026-06-26T00:00"],
  ["Grupo D", "Turquia", "Estados Unidos", "2026-06-26T03:00"],
  ["Grupo D", "Paraguai", "Austrália", "2026-06-26T03:00"],
  ["Grupo I", "Noruega", "França", "2026-06-26T20:00"],
  ["Grupo I", "Senegal", "Iraque", "2026-06-26T20:00"],
  ["Grupo H", "Cabo Verde", "Arábia Saudita", "2026-06-27T01:00"],
  ["Grupo H", "Uruguai", "Espanha", "2026-06-27T01:00"],
  ["Grupo G", "Nova Zelândia", "Bélgica", "2026-06-27T04:00"],
  ["Grupo G", "Egito", "Irão", "2026-06-27T04:00"],
  ["Grupo L", "Panamá", "Inglaterra", "2026-06-27T22:00"],
  ["Grupo L", "Croácia", "Gana", "2026-06-27T22:00"],
  ["Grupo K", "Colômbia", "Portugal", "2026-06-28T00:30"],
  ["Grupo K", "RD Congo", "Uzbequistão", "2026-06-28T00:30"],
  ["Grupo J", "Argélia", "Áustria", "2026-06-28T03:00"],
  ["Grupo J", "Jordânia", "Argentina", "2026-06-28T03:00"]
];

const FLAGS = {
  "Portugal": "🇵🇹",
  "África do Sul": "🇿🇦",
  "México": "🇲🇽",
  "Coreia do Sul": "🇰🇷",
  "Chéquia": "🇨🇿",
  "Canadá": "🇨🇦",
  "Bósnia": "🇧🇦",
  "Estados Unidos": "🇺🇸",
  "Paraguai": "🇵🇾",
  "Qatar": "🇶🇦",
  "Suíça": "🇨🇭",
  "Brasil": "🇧🇷",
  "Marrocos": "🇲🇦",
  "Haiti": "🇭🇹",
  "Escócia": "🏴",
  "Austrália": "🇦🇺",
  "Turquia": "🇹🇷",
  "Alemanha": "🇩🇪",
  "Curaçao": "🇨🇼",
  "Países Baixos": "🇳🇱",
  "Japão": "🇯🇵",
  "Costa do Marfim": "🇨🇮",
  "Equador": "🇪🇨",
  "Suécia": "🇸🇪",
  "Tunísia": "🇹🇳",
  "Espanha": "🇪🇸",
  "Cabo Verde": "🇨🇻",
  "Bélgica": "🇧🇪",
  "Egito": "🇪🇬",
  "Arábia Saudita": "🇸🇦",
  "Uruguai": "🇺🇾",
  "Irão": "🇮🇷",
  "Nova Zelândia": "🇳🇿",
  "França": "🇫🇷",
  "Senegal": "🇸🇳",
  "Iraque": "🇮🇶",
  "Noruega": "🇳🇴",
  "Argentina": "🇦🇷",
  "Argélia": "🇩🇿",
  "Áustria": "🇦🇹",
  "Jordânia": "🇯🇴",
  "RD Congo": "🇨🇩",
  "Inglaterra": "🏴",
  "Croácia": "🇭🇷",
  "Gana": "🇬🇭",
  "Panamá": "🇵🇦",
  "Uzbequistão": "🇺🇿",
  "Colômbia": "🇨🇴"
};

const TEAM_ALIASES = {
  "mexico": "México", "africa do sul": "África do Sul", "áfrica do sul": "África do Sul",
  "coreia do sul": "Coreia do Sul", "republica checa": "Chéquia", "rep checa": "Chéquia", "czechia": "Chéquia", "czech republic": "Chéquia", "república checa": "Chéquia", "chequia": "Chéquia", "chéquia": "Chéquia",
  "canada": "Canadá", "bosnia": "Bósnia", "bosnia e herzegovina": "Bósnia", "bósnia e herzegovina": "Bósnia", "bósnia": "Bósnia", "bosnia-herzegovina": "Bósnia", "bósnia-herzegovina": "Bósnia",
  "qatar": "Qatar", "suica": "Suíça", "suiça": "Suíça", "suíça": "Suíça", "brasil": "Brasil", "marrocos": "Marrocos",
  "haiti": "Haiti", "escocia": "Escócia", "escócia": "Escócia", "australia": "Austrália", "austrália": "Austrália",
  "turquia": "Turquia", "alemanha": "Alemanha", "curacao": "Curaçao", "curaçao": "Curaçao",
  "paises baixos": "Países Baixos", "holanda": "Países Baixos", "netherlands": "Países Baixos", "países baixos": "Países Baixos", "japao": "Japão", "japão": "Japão",
  "costa do marfim": "Costa do Marfim", "equador": "Equador", "suecia": "Suécia", "suécia": "Suécia",
  "tunisia": "Tunísia", "tunísia": "Tunísia", "espanha": "Espanha", "cabo verde": "Cabo Verde",
  "belgica": "Bélgica", "bélgica": "Bélgica", "egito": "Egito", "arabia saudita": "Arábia Saudita", "arábia saudita": "Arábia Saudita",
  "uruguai": "Uruguai", "irao": "Irão", "irão": "Irão", "nova zelandia": "Nova Zelândia", "nova zelândia": "Nova Zelândia",
  "franca": "França", "frança": "França", "senegal": "Senegal", "iraque": "Iraque", "noruega": "Noruega",
  "argentina": "Argentina", "argelia": "Argélia", "argélia": "Argélia", "austria": "Áustria", "áustria": "Áustria",
  "jordania": "Jordânia", "jordânia": "Jordânia", "rd congo": "RD Congo", "r d congo": "RD Congo", "dr congo": "RD Congo", "congo dr": "RD Congo", "r.d. congo": "RD Congo", "r d. congo": "RD Congo", "rd. congo": "RD Congo", "r.d congo": "RD Congo", "rdcongo": "RD Congo", "rdc": "RD Congo", "congo rd": "RD Congo", "d r congo": "RD Congo", "d.r. congo": "RD Congo", "democratic republic of congo": "RD Congo",
  "republica democratica do congo": "RD Congo", "rep democratica do congo": "RD Congo", "república democrática do congo": "RD Congo", "inglaterra": "Inglaterra", "croacia": "Croácia", "croácia": "Croácia",
  "gana": "Gana", "panama": "Panamá", "panamá": "Panamá", "uzbequistao": "Uzbequistão", "uzbequistão": "Uzbequistão", "uzbekistan": "Uzbequistão",
  "colombia": "Colômbia", "colômbia": "Colômbia", "columbia": "Colômbia"
};

const SEED_GAMES = MATCH_ROWS.map(([group, homeTeam, awayTeam, matchDate], index) => ({
  id: `wc2026-group-${String(index + 1).padStart(3, "0")}`,
  group, homeTeam, awayTeam, matchDate,
  phase: "Fase de grupos",
  homeScore: null, awayScore: null
}));

const $ = id => document.getElementById(id);
const clone = value => JSON.parse(JSON.stringify(value));
const hasResult = game => game.homeScore !== null && game.homeScore !== undefined && game.awayScore !== null && game.awayScore !== undefined;
const flag = team => FLAGS[team] || "🏳️";
const outcome = (home, away) => Number(home) > Number(away) ? "home" : Number(home) < Number(away) ? "away" : "draw";
const normalizeKey = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const normalizeComparable = value => normalizeKey(value);
const canonicalTeam = value => TEAM_ALIASES[normalizeKey(value)] || String(value ?? "").trim();
const playerIdFromName = name => `player_${normalizeKey(name).replace(/\s+/g, "_") || "sem_nome"}`;

function defaultSettings() {
  return {
    points: { exact: 3, winner: 1, mvp: 5, topScorer: 5, champion: 10 },
    extraResults: { mvp: "", topScorer: "", champion: "" },
    extraPredictions: {},
    importedPoints: {},
    users: [],
    knockout: { adminUnlocked: false, matches: [] },
    lastImport: null
  };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function parsePortugalDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
}

function dateKey(value) {
  const date = parsePortugalDate(value);
  return new Intl.DateTimeFormat("en-CA", { timeZone: PORTUGAL_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function todayKey() { return dateKey(new Date()); }
function dateHeader(value) {
  const date = parsePortugalDate(value);
  const parts = new Intl.DateTimeFormat("pt-PT", { timeZone: PORTUGAL_TZ, day: "numeric", month: "long", weekday: "long" }).formatToParts(date);
  const day = parts.find(part => part.type === "day")?.value || "";
  const month = parts.find(part => part.type === "month")?.value || "";
  const weekday = parts.find(part => part.type === "weekday")?.value || "";
  return `${day} de ${month} (${weekday})`;
}
function dateTimePortugal(value) {
  const date = parsePortugalDate(value);
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: PORTUGAL_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}
function timePortugal(value) {
  return new Intl.DateTimeFormat("pt-PT", { timeZone: PORTUGAL_TZ, hour: "2-digit", minute: "2-digit" }).format(parsePortugalDate(value));
}
function statusOf(game) {
  if (hasResult(game)) return { text: "Jogado", className: "played" };
  if (parsePortugalDate(game.matchDate).getTime() <= Date.now()) return { text: "Fechado", className: "closed" };
  return { text: "Por jogar", className: "open" };
}
function isLocked(game) { return statusOf(game).className !== "open"; }

function mergeSettings(input = {}) {
  const base = defaultSettings();
  return {
    ...base, ...input,
    points: { ...base.points, ...(input.points || {}) },
    extraResults: { ...base.extraResults, ...(input.extraResults || {}) },
    extraPredictions: { ...(input.extraPredictions || {}) },
    importedPoints: { ...(input.importedPoints || {}) },
    knockout: {
      ...base.knockout,
      ...(input.knockout || {}),
      matches: Array.isArray(input.knockout?.matches) ? input.knockout.matches : []
    },
    users: Array.isArray(input.users) ? input.users : []
  };
}

function getLocalData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const data = { games: clone(SEED_GAMES), bets: [], settings: defaultSettings(), savedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  }
  try {
    const parsed = JSON.parse(raw);
    const parsedSettings = parsed.settings || parsed.appSettings || defaultSettings();
    return {
      games: Array.isArray(parsed.games) && parsed.games.length ? parsed.games : clone(SEED_GAMES),
      bets: Array.isArray(parsed.bets) ? parsed.bets : [],
      settings: mergeSettings(parsedSettings),
      savedAt: parsed.savedAt || ""
    };
  } catch {
    const data = { games: clone(SEED_GAMES), bets: [], settings: defaultSettings(), savedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return data;
  }
}

function saveLocalData(reason = "") {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    games,
    bets,
    settings: appSettings,
    appSettings,
    savedAt: new Date().toISOString(),
    reason
  }));
}



function withTimeout(promise, ms = 12000, label = "operação") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} demorou demasiado tempo`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function firebaseTimestampToMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function gameUpdatedMillis(game) {
  return Math.max(
    firebaseTimestampToMillis(game?.updatedAt),
    firebaseTimestampToMillis(game?.firebaseUpdatedAt)
  );
}

function stampGame(game, reason = "") {
  game.updatedAt = new Date().toISOString();
  game.updatedReason = reason;
  return game;
}

function mergeGamesByNewest(remoteGames = [], localGames = []) {
  const byId = new Map(clone(SEED_GAMES).map(game => [game.id, game]));
  const remoteById = new Map(normalizeGames(remoteGames).map(game => [game.id, game]));
  const localById = new Map(normalizeGames(localGames).map(game => [game.id, game]));

  byId.forEach((seed, id) => {
    const remote = remoteById.get(id);
    const local = localById.get(id);
    if (!remote && !local) return;
    if (!remote) { byId.set(id, { ...seed, ...local }); return; }
    if (!local) { byId.set(id, { ...seed, ...remote }); return; }

    const remoteTime = gameUpdatedMillis(remote);
    const localTime = gameUpdatedMillis(local);
    if (localTime > remoteTime) {
      byId.set(id, { ...seed, ...remote, ...local });
      return;
    }
    if (remoteTime > localTime) {
      byId.set(id, { ...seed, ...local, ...remote });
      return;
    }

    if (hasResult(local) && !hasResult(remote)) byId.set(id, { ...seed, ...remote, ...local });
    else byId.set(id, { ...seed, ...local, ...remote });
  });

  return [...byId.values()].sort((a, b) => String(a.matchDate).localeCompare(String(b.matchDate)));
}

function pendingGameIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(PENDING_FIREBASE_KEY) || "[]");
    return Array.isArray(ids) ? ids.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function setPendingGameIds(ids) {
  localStorage.setItem(PENDING_FIREBASE_KEY, JSON.stringify([...new Set(ids)].filter(Boolean)));
}

function markGamePending(gameId) {
  setPendingGameIds([...pendingGameIds(), gameId]);
}

function clearPendingGame(gameId) {
  setPendingGameIds(pendingGameIds().filter(id => id !== gameId));
}

function pendingBetIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(PENDING_BETS_KEY) || "[]");
    return Array.isArray(ids) ? ids.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function setPendingBetIds(ids) {
  localStorage.setItem(PENDING_BETS_KEY, JSON.stringify([...new Set(ids)].filter(Boolean)));
}

function markBetsPending(ids) {
  if (!ids.length) return;
  setPendingBetIds([...pendingBetIds(), ...ids]);
}

function clearPendingBets(ids) {
  const done = new Set(ids);
  setPendingBetIds(pendingBetIds().filter(id => !done.has(id)));
}

function pendingDeleteBetIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(PENDING_DELETE_BETS_KEY) || "[]");
    return Array.isArray(ids) ? ids.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function setPendingDeleteBetIds(ids) {
  localStorage.setItem(PENDING_DELETE_BETS_KEY, JSON.stringify([...new Set(ids)].filter(Boolean)));
}

function markBetsForDelete(ids) {
  if (!ids.length) return;
  setPendingDeleteBetIds([...pendingDeleteBetIds(), ...ids]);
}

function clearPendingDeleteBets(ids) {
  const done = new Set(ids);
  setPendingDeleteBetIds(pendingDeleteBetIds().filter(id => !done.has(id)));
}

function markSettingsPending() {
  localStorage.setItem(PENDING_SETTINGS_KEY, "1");
}

function hasSettingsPending() {
  return localStorage.getItem(PENDING_SETTINGS_KEY) === "1";
}

function clearSettingsPending() {
  localStorage.removeItem(PENDING_SETTINGS_KEY);
}

function hasFullSyncPending() {
  return localStorage.getItem(PENDING_FULL_SYNC_KEY) === "1";
}

function markFullSyncPending() {
  localStorage.setItem(PENDING_FULL_SYNC_KEY, "1");
}

function clearFullSyncPending() {
  localStorage.removeItem(PENDING_FULL_SYNC_KEY);
}

function scheduleFullSync(reason = "sincronizar dados", delay = 500) {
  markFullSyncPending();
  saveLocalData(`${reason} pendente`);

  if (!db || !firebaseApi || storageMode !== "firebase") {
    setFirebaseStatus("error", "Firebase: dados guardados localmente; sincronizacao pendente");
    return;
  }

  if (fullSyncTimer) clearTimeout(fullSyncTimer);
  fullSyncTimer = setTimeout(() => {
    fullSyncTimer = null;
    retryPendingFullSync(reason).catch(console.warn);
  }, delay);
}

async function retryPendingFullSync(reason = "sincronizar pendentes") {
  if (!hasFullSyncPending()) return;
  if (!db || !firebaseApi || storageMode !== "firebase") return;

  try {
    setFirebaseStatus("loading", "Firebase: a sincronizar dados pendentes...");
    await syncFirebaseFull(reason);
    clearFullSyncPending();
    setFirebaseStatus("success", "Firebase: dados pendentes sincronizados");
  } catch (error) {
    console.warn("Sincronizacao completa ainda pendente:", error);
    markFullSyncPending();
    setFirebaseStatus("error", `Firebase: sincronizacao pendente (${shortFirebaseError(error)})`);
  }
}

async function retryPendingGameSaves(reason = "reenviar pendentes") {
  if (!db || !firebaseApi || storageMode !== "firebase") return;
  const ids = pendingGameIds();
  if (!ids.length) return;

  setFirebaseStatus("loading", `Firebase: a sincronizar ${ids.length} resultado(s) pendente(s)...`);
  for (const gameId of ids) {
    const game = games.find(item => item.id === gameId);
    if (!game) {
      clearPendingGame(gameId);
      continue;
    }
    try {
      await saveGameFastToFirebase(game, { status: false, reason });
      clearPendingGame(gameId);
    } catch (error) {
      console.warn("Resultado pendente ainda nao sincronizou:", gameId, error);
      break;
    }
  }

  const left = pendingGameIds().length;
  if (left) setFirebaseStatus("error", `Firebase: ${left} resultado(s) ainda pendente(s)`);
  else setFirebaseStatus("success", "Firebase: resultados pendentes sincronizados");
}

function setFirebaseStatus(type, message) {
  const box = $("firebaseStatusBox");
  if (!box) return;
  box.className = `firebase-status-box ${type}`;
  box.textContent = message;
}

async function initFirebase() {
  const config = APP_CONFIG.firebase || {};

  if (!config.apiKey || !config.projectId) {
    db = null;
    firebaseApi = null;
    firebaseAuth = null;
    firebaseAuthApi = null;
    storageMode = "local";
    setFirebaseStatus("error", "Firebase: configuração em falta no config.js");
    setLoginStatus("Firebase: configuração em falta no config.js", "error");
    return false;
  }

  try {
    setFirebaseStatus("loading", "Firebase: a ligar...");
    const appModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const authModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js");
    const firestoreModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js");

    const app = appModule.initializeApp(config);
    firebaseAuth = authModule.getAuth(app);
    firebaseAuthApi = authModule;
    db = firestoreModule.getFirestore(app);
    firebaseApi = firestoreModule;
    storageMode = "firebase";

    setFirebaseStatus("success", `Firebase: ligado ao projeto ${config.projectId}`);
    setLoginStatus("Firebase ligado. Faz login.", "success");
    return true;
  } catch (error) {
    console.error("Firebase não ligou:", error);
    db = null;
    firebaseApi = null;
    firebaseAuth = null;
    firebaseAuthApi = null;
    storageMode = "local";
    setFirebaseStatus("error", `Firebase: não ligou — ${error.message || "erro"}`);
    setLoginStatus(`Firebase não ligou — ${error.message || "erro"}`, "error");
    return false;
  }
}


function applyLocalSnapshotIfBetter(context = "") {
  try {
    const local = getLocalData();
    const localBets = normalizeBets(local.bets || []);
    const localGames = normalizeGames(local.games || []);
    const localSettings = mergeSettings(local.settings || local.appSettings || defaultSettings());

    const localHasMoreBets = localBets.length > bets.length;
    const localHasUsersAndRemoteEmpty = (localSettings.users || []).length > (appSettings.users || []).length && bets.length === 0;
    const localHasResults = localGames.some(hasResult) && !games.some(hasResult);

    if (localHasMoreBets || localHasUsersAndRemoteEmpty || localHasResults) {
      games = localGames;
      bets = localBets;
      appSettings = localSettings;
      if (storageMode === "firebase") {
        setTimeout(() => forceSaveAll(`recuperado local ${context}`), 250);
      }
    }
  } catch (error) {
    console.warn("Não foi possível comparar dados locais.", error);
  }
}


async function safeGetCollection(name) {
  if (!db || !firebaseApi) return { docs: [], ok: false, error: "Firebase não iniciado" };

  try {
    const { collection, getDocs } = firebaseApi;
    const snap = await withTimeout(getDocs(collection(db, name)), 12000, `ler ${name}`);
    return { docs: snap.docs, empty: snap.empty, ok: true, error: "" };
  } catch (error) {
    console.error(`Erro ao ler coleção ${name}:`, error);
    return { docs: [], empty: true, ok: false, error: error.message || String(error) };
  }
}

function shortFirebaseError(error) {
  const text = String(error || "");
  if (text.includes("Missing or insufficient permissions")) return "sem permissões nas regras";
  if (text.includes("Failed to fetch")) return "falha de rede/CORS";
  if (text.includes("demorou demasiado")) return "tempo esgotado";
  return text.slice(0, 90) || "erro desconhecido";
}

async function loadData() {
  const local = getLocalData();

  if (!db || !firebaseApi || storageMode !== "firebase") {
    games = normalizeGames(local.games);
    bets = normalizeBets(local.bets);
    appSettings = mergeSettings(local.settings || local.appSettings);
    ensureKnockoutSettings();
    renderAll();
    return;
  }

  try {
    setFirebaseStatus("loading", "Firebase: a carregar dados...");
    const { collection, doc, getDocs, setDoc } = firebaseApi;

    const localGames = normalizeGames(local.games || []);
    const localBets = normalizeBets(local.bets || []);
    const localSettings = mergeSettings(local.settings || local.appSettings || defaultSettings());

    const gamesSnap = await withTimeout(getDocs(collection(db, "games")), 12000, "ler jogos");
    const betsSnap = localBets.length
      ? { docs: [], skipped: true }
      : await withTimeout(getDocs(collection(db, "bets")), 12000, "ler apostas");
    const settingsSnap = await withTimeout(getDocs(collection(db, "settings")), 12000, "ler configurações");

    const remoteGames = gamesSnap.docs.map(item => ({ id: item.id, ...item.data() }));
    const remoteBets = betsSnap.docs.map(item => ({ id: item.id, ...item.data() }));
    const mainSettingsDoc = settingsSnap.docs.find(item => item.id === "main");

    if (remoteGames.length) {
      localGames.forEach(localGame => {
        const remoteGame = remoteGames.find(item => item.id === localGame.id);
        if (hasResult(localGame) && (!remoteGame || !hasResult(remoteGame) || gameUpdatedMillis(localGame) > gameUpdatedMillis(remoteGame))) {
          markGamePending(localGame.id);
        }
      });
      games = mergeGamesByNewest(remoteGames, localGames);
    } else {
      games = localGames.length ? localGames : clone(SEED_GAMES);
      setTimeout(() => {
        Promise.all(games.map(game => setDoc(doc(db, "games", game.id), game, { merge: true })))
          .catch(error => console.warn("Não conseguiu criar jogos no Firebase", error));
      }, 200);
    }

    bets = normalizeBets(remoteBets.length ? remoteBets : localBets);
    appSettings = mergeSettings(mainSettingsDoc ? mainSettingsDoc.data() : localSettings);
    ensureKnockoutSettings();

    saveLocalData("firebase carregado estável");
    setFirebaseStatus("success", `Firebase: ligado · ${bets.length} apostas carregadas`);
    renderAll();

    if (!betsSnap.skipped && !remoteBets.length && localBets.length && pendingBetIds().length) {
      setTimeout(() => saveBetsFastToFirebase("reenviar apostas locais").catch(console.warn), 400);
    }
    setTimeout(() => retryPendingGameSaves("arranque").catch(console.warn), 700);
    setTimeout(() => retryPendingFullSync("arranque").catch(console.warn), 1000);
  } catch (error) {
    console.error("Erro ao carregar Firebase:", error);
    games = normalizeGames(local.games);
    bets = normalizeBets(local.bets);
    appSettings = mergeSettings(local.settings || local.appSettings);
    ensureKnockoutSettings();
    storageMode = "local";
    setFirebaseStatus("error", `Firebase: erro ao carregar — ${error.message || "ver consola"}`);
    renderAll();
  }
}

function normalizeGames(list) {
  const byId = new Map(clone(SEED_GAMES).map(game => [game.id, game]));
  (list || []).forEach(game => { if (game?.id) byId.set(game.id, { ...byId.get(game.id), ...game }); });
  return [...byId.values()].sort((a, b) => String(a.matchDate).localeCompare(String(b.matchDate)));
}
function normalizeBets(list) {
  return (list || [])
    .filter(bet => bet && bet.gameId && (bet.playerName || bet.playerId))
    .map(bet => {
      const playerName = String(bet.playerName || bet.playerId || "Sem nome").trim();
      return { ...bet, playerName, playerId: bet.playerId || playerIdFromName(playerName), homeGuess: Number(bet.homeGuess), awayGuess: Number(bet.awayGuess) };
    });
}

async function persistGame(game) {
  return saveGameFastToFirebase(game);
}

async function persistAllGames() {
  saveLocalData("guardar todos jogos local");

  /*
   * As gravacoes completas ficam em segundo plano para a interface nao bloquear
   * quando o Firestore esta lento, offline ou sem permissoes.
   */
  games.forEach(game => {
    if (hasResult(game) && !game.updatedAt) stampGame(game, "migração resultado existente");
  });
  games.forEach(game => markGamePending(game.id));
  scheduleFullSync("guardar jogos", 300);
}

async function persistBet(bet) {
  bets = bets.filter(item => !(item.gameId === bet.gameId && item.playerId === bet.playerId));
  bets.push(bet);
  markBetsPending([bet.id]);
  saveLocalData("persistBet local-primeiro");
  scheduleFullSync("guardar aposta", 300);
}

async function persistAllBets(importedBets, replaceImported = true) {
  if (replaceImported) {
    const removedIds = bets.filter(bet => bet.source === "Resultados.xlsx").map(bet => bet.id);
    markBetsForDelete(removedIds);
    bets = bets.filter(bet => bet.source !== "Resultados.xlsx");
  }
  const byKey = new Map(bets.map(bet => [`${bet.playerId}_${bet.gameId}`, bet]));
  importedBets.forEach(bet => byKey.set(`${bet.playerId}_${bet.gameId}`, bet));
  bets = [...byKey.values()];
  markBetsPending(importedBets.map(bet => bet.id));
  saveLocalData("importar apostas local");
  scheduleFullSync("importar apostas", 300);
}

async function persistSettings() {
  markSettingsPending();
  saveLocalData("guardar configuracoes local");
  scheduleFullSync("guardar configuracoes", 300);
}

function betsForGame(gameId) { return bets.filter(bet => bet.gameId === gameId); }

function isExactBet(bet, game) {
  if (!bet || !game || !hasResult(game)) return false;
  return Number(bet.homeGuess) === Number(game.homeScore) &&
    Number(bet.awayGuess) === Number(game.awayScore);
}

function isOutcomeBet(bet, game) {
  if (!bet || !game || !hasResult(game)) return false;
  return outcome(bet.homeGuess, bet.awayGuess) === outcome(game.homeScore, game.awayScore);
}

function pointsForBet(bet, game) {
  if (!bet || !game || !hasResult(game)) return 0;

  const exactPoints = Number(appSettings?.points?.exact) || 3;
  const winnerPoints = Number(appSettings?.points?.winner) || 1;

  // Regra 1: resultado exato certo recebe 3 pontos.
  // Regra 2: se acertar o resultado exato, não acumula o ponto do vencedor/empate.
  if (isExactBet(bet, game)) return exactPoints;

  // Regra 3: se não acertou o resultado, mas acertou vencedor/empate, recebe 1 ponto.
  if (isOutcomeBet(bet, game)) return winnerPoints;

  return 0;
}
function extraPointsForPlayer(playerName) {
  const predictions = appSettings.extraPredictions?.[playerName] || {};
  const results = appSettings.extraResults || {};
  const points = appSettings.points || defaultSettings().points;
  const details = { mvp: 0, topScorer: 0, champion: 0, total: 0 };
  if (results.mvp && predictions.mvp && normalizeComparable(results.mvp) === normalizeComparable(predictions.mvp)) details.mvp = Number(points.mvp) || 0;
  if (results.topScorer && predictions.topScorer && normalizeComparable(results.topScorer) === normalizeComparable(predictions.topScorer)) details.topScorer = Number(points.topScorer) || 0;
  if (results.champion && predictions.champion && normalizeComparable(results.champion) === normalizeComparable(predictions.champion)) details.champion = Number(points.champion) || 0;
  details.total = details.mvp + details.topScorer + details.champion;
  return details;
}
function allPlayers() {
  const names = new Set(appSettings.users || []);
  bets.map(bet => bet.playerName).forEach(name => names.add(name));
  Object.keys(appSettings.extraPredictions || {}).forEach(name => names.add(name));
  Object.keys(appSettings.importedPoints || {}).forEach(name => names.add(name));
  return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b));
}
function playerStats(playerName) {
  const playerBets = bets.filter(bet => bet.playerName === playerName);
  const stats = {
    playerName,
    points: 0,
    gamePoints: 0,
    extraPoints: 0,
    importedPoints: appSettings.importedPoints?.[playerName] ?? null,
    totalBets: playerBets.length,
    settled: 0,
    exact: 0,
    winner: 0,
    misses: 0,
    mvp: 0,
    topScorer: 0,
    champion: 0
  };

  playerBets.forEach(bet => {
    const game = games.find(item => item.id === bet.gameId);
    if (!game || !hasResult(game)) return;

    const points = pointsForBet(bet, game);
    stats.gamePoints += points;
    stats.settled += 1;

    if (isExactBet(bet, game)) {
      stats.exact += 1;
    } else if (isOutcomeBet(bet, game)) {
      stats.winner += 1;
    } else {
      stats.misses += 1;
    }
  });

  const extras = extraPointsForPlayer(playerName);
  stats.mvp = extras.mvp;
  stats.topScorer = extras.topScorer;
  stats.champion = extras.champion;
  stats.extraPoints = extras.total;

  // Total mostrado na página Pontuação: sempre calculado pela app.
  // Não usa pontos importados do Excel.
  stats.points = stats.gamePoints + stats.extraPoints;
  stats.calculatedTotal = stats.points;
  stats.accuracy = stats.settled ? Math.round((stats.exact / stats.settled) * 100) : 0;
  stats.diffExcel = stats.importedPoints === null ? null : stats.points - Number(stats.importedPoints);

  return stats;
}
function leaderboard() {
  return allPlayers()
    .map(playerStats)
    .sort((a, b) =>
      b.points - a.points ||
      b.exact - a.exact ||
      b.winner - a.winner ||
      a.playerName.localeCompare(b.playerName, "pt")
    );
}

function filteredGames() {
  let base = games;
  if (calendarViewMode === "missing") {
    base = games.filter(game => !hasResult(game));
  }

  const query = (searchText || "").trim().toLowerCase();
  if (!query) return base;

  return base.filter(game => `${game.group} ${game.homeTeam} ${game.awayTeam}`.toLowerCase().includes(query));
}
function groupByDate(list) {
  return list.reduce((map, game) => {
    const key = dateKey(game.matchDate);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(game);
    return map;
  }, new Map());
}




async function saveGameFastToFirebase(game, options = {}) {
  saveLocalData("saveGameFast local");

  if (!db || !firebaseApi || storageMode !== "firebase") {
    setFirebaseStatus("error", "Firebase: não está ligado — resultado ficou só local");
    throw new Error("Firebase não está ligado");
  }

  const { doc, setDoc, serverTimestamp } = firebaseApi;
  const gameRef = doc(db, "games", game.id);

  const localUpdatedAt = game.updatedAt || new Date().toISOString();
  const payload = {
    ...game,
    homeScore: game.homeScore === "" || game.homeScore === undefined ? null : game.homeScore,
    awayScore: game.awayScore === "" || game.awayScore === undefined ? null : game.awayScore,
    updatedAt: localUpdatedAt
  };
  const firebasePayload = { ...payload, firebaseUpdatedAt: serverTimestamp() };

  if (options.status !== false) {
    setFirebaseStatus("loading", `Firebase: a guardar ${game.homeTeam} - ${game.awayTeam}...`);
  }

  await withTimeout(setDoc(gameRef, firebasePayload, { merge: true }), 20000, options.reason || "guardar resultado no Firebase");
  clearPendingGame(game.id);

  const idx = games.findIndex(item => item.id === game.id);
  if (idx !== -1) games[idx] = { ...games[idx], ...payload, firebaseUpdatedAt: new Date().toISOString(), id: game.id };

  saveLocalData("saveGameFast firebase-ok");
  if (options.status !== false) {
    const savedHome = payload.homeScore === null ? "-" : payload.homeScore;
    const savedAway = payload.awayScore === null ? "-" : payload.awayScore;
    setFirebaseStatus("success", `Firebase: resultado guardado (${savedHome}-${savedAway})`);
  }
  return true;
}

async function saveSettingsFastToFirebase(reason = "settings") {
  saveLocalData(`${reason} local`);

  if (!db || !firebaseApi || storageMode !== "firebase") return false;

  const { doc, setDoc } = firebaseApi;
  await withTimeout(setDoc(doc(db, "settings", "main"), appSettings, { merge: true }), 12000, reason);
  clearSettingsPending();
  saveLocalData(`${reason} firebase-ok`);
  return true;
}

async function saveBetsFastToFirebase(reason = "bets") {
  saveLocalData(`${reason} local`);

  if (!db || !firebaseApi || storageMode !== "firebase") return false;

  const { doc, setDoc, writeBatch } = firebaseApi;
  const ids = pendingBetIds();
  const betsToSave = ids.length ? bets.filter(bet => ids.includes(bet.id)) : bets;

  // Lotes pequenos para não deixar a app presa.
  const chunks = [];
  for (let i = 0; i < betsToSave.length; i += 250) chunks.push(betsToSave.slice(i, i + 250));

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach(bet => batch.set(doc(db, "bets", bet.id), bet, { merge: true }));
    await withTimeout(batch.commit(), 30000, reason);
  }

  clearPendingBets(betsToSave.map(bet => bet.id));
  saveLocalData(`${reason} firebase-ok`);
  return true;
}

async function saveUserBetsFastToFirebase(playerId, previousBetIds, playerBets, reason = "editar apostas utilizador") {
  saveLocalData(`${reason} local`);

  if (!db || !firebaseApi || storageMode !== "firebase") return false;

  const { doc, writeBatch } = firebaseApi;
  const nextBetIds = new Set(playerBets.map(bet => bet.id));
  const batch = writeBatch(db);

  previousBetIds.forEach(id => {
    if (!nextBetIds.has(id)) batch.delete(doc(db, "bets", id));
  });
  playerBets.forEach(bet => {
    batch.set(doc(db, "bets", bet.id), bet, { merge: true });
  });
  batch.set(doc(db, "settings", "main"), appSettings, { merge: true });

  await withTimeout(batch.commit(), 30000, reason);
  clearPendingBets(playerBets.map(bet => bet.id));
  clearPendingDeleteBets(previousBetIds.filter(id => !nextBetIds.has(id)));
  clearSettingsPending();
  saveLocalData(`${reason} firebase-ok`);
  return true;
}

async function commitFirestoreOperations(operations, reason = "sincronizar dados") {
  if (!operations.length) return;
  const { writeBatch } = firebaseApi;
  for (let i = 0; i < operations.length; i += 250) {
    const batch = writeBatch(db);
    operations.slice(i, i + 250).forEach(operation => operation(batch));
    await withTimeout(batch.commit(), 30000, `${reason} (${Math.floor(i / 250) + 1})`);
  }
}

async function syncFirebaseFull(reason = "") {
  if (!db || !firebaseApi || storageMode !== "firebase") {
    saveLocalData(`${reason} local-only`);
    return false;
  }

  const { doc } = firebaseApi;

  const operations = [];
  const syncGameIds = pendingGameIds();
  const syncBetIds = pendingBetIds();

  games.filter(game => syncGameIds.includes(game.id)).forEach(game => {
    operations.push(batch => batch.set(doc(db, "games", game.id), game, { merge: true }));
  });

  bets.filter(bet => syncBetIds.includes(bet.id)).forEach(bet => {
    operations.push(batch => batch.set(doc(db, "bets", bet.id), bet, { merge: true }));
  });

  if (hasSettingsPending()) {
    operations.push(batch => batch.set(doc(db, "settings", "main"), appSettings, { merge: true }));
  }

  const deleteBetIds = pendingDeleteBetIds();
  deleteBetIds.forEach(id => {
    operations.push(batch => batch.delete(doc(db, "bets", id)));
  });

  await commitFirestoreOperations(operations, reason || "sincronizar dados");
  syncGameIds.forEach(clearPendingGame);
  clearPendingBets(syncBetIds);
  clearPendingDeleteBets(deleteBetIds);
  clearSettingsPending();
  saveLocalData(`${reason} firebase-full-ok`);
  setFirebaseStatus("success", "Firebase: dados guardados e sincronizados");
  return true;
}

async function forceSaveAll(reason = "") {
  saveLocalData(reason);

  scheduleFullSync(reason || "guardar dados", 300);
}


function rescueLocalBetsIfNeeded() {
  try {
    const local = getLocalData();
    if (!bets.length && Array.isArray(local.bets) && local.bets.length) {
      bets = normalizeBets(local.bets);
    }
    if (local.settings || local.appSettings) {
      appSettings = mergeSettings(local.settings || local.appSettings);
    }
  } catch (error) {
    console.warn("Não foi possível recuperar apostas locais.", error);
  }
}



const DEFAULT_PERMISSIONS = {
  calendar: true,
  score: true,
  knockout: true,
  admin: false,
  editResults: false,
  importExcel: false,
  editUsers: false,
  editPoints: false,
  editKnockout: false,
  managePermissions: false
};

const ADMIN_PERMISSIONS = {
  calendar: true,
  score: true,
  knockout: true,
  admin: true,
  editResults: true,
  importExcel: true,
  editUsers: true,
  editPoints: true,
  editKnockout: true,
  managePermissions: true
};

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function configAdminEmails() {
  return (APP_CONFIG.adminEmails || []).map(normalizeEmail).filter(Boolean);
}

function isConfiguredAdmin(email) {
  return configAdminEmails().includes(normalizeEmail(email));
}

function defaultProfileForUser(user) {
  const email = normalizeEmail(user?.email);
  const admin = isConfiguredAdmin(email);
  return {
    uid: user?.uid || "",
    email,
    role: admin ? "admin" : "user",
    active: true,
    permissions: admin ? { ...ADMIN_PERMISSIONS } : { ...DEFAULT_PERMISSIONS },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function hasPermission(permission) {
  if (!currentProfile?.active) return false;
  if (currentProfile?.role === "admin") return true;
  return Boolean(currentProfile?.permissions?.[permission]);
}

function isAdminProfile() {
  return hasPermission("admin") || currentProfile?.role === "admin";
}

function setLoginStatus(message, type = "info") {
  const box = $("loginStatusBox");
  if (!box) return;
  box.className = `login-status ${type}`;
  box.textContent = message;
}

function showLoginScreen() {
  $("loginScreen")?.classList.remove("hidden");
  $("appShell")?.classList.add("auth-hidden");
}

function showAppScreen() {
  $("loginScreen")?.classList.add("hidden");
  $("appShell")?.classList.remove("auth-hidden");
}

function updateSessionBox() {
  const box = $("sessionBox");
  const label = $("sessionUserLabel");
  if (!box || !label) return;
  if (!currentUser) {
    box.classList.add("hidden");
    return;
  }
  box.classList.remove("hidden");
  const role = currentProfile?.role === "admin" ? "Admin" : "User";
  label.textContent = `${currentUser.email || "Conta"} · ${role}`;
}

async function readUserProfile(user) {
  if (!db || !firebaseApi || !user) return defaultProfileForUser(user);

  const { doc, getDoc, setDoc } = firebaseApi;
  const ref = doc(db, "users", normalizeEmail(user.email));
  const fallback = defaultProfileForUser(user);

  try {
    const snap = await withTimeout(getDoc(ref), 12000, "ler perfil do utilizador");
    if (!snap.exists()) {
      await withTimeout(setDoc(ref, fallback, { merge: true }), 12000, "criar perfil do utilizador");
      return fallback;
    }

    const data = snap.data() || {};
    const configAdmin = isConfiguredAdmin(user.email);
    const profile = {
      ...fallback,
      ...data,
      uid: user.uid,
      email: normalizeEmail(user.email),
      role: configAdmin ? "admin" : (data.role || "user"),
      active: data.active !== false,
      permissions: {
        ...(data.role === "admin" || configAdmin ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS),
        ...(data.permissions || {})
      }
    };

    if (configAdmin && data.role !== "admin") {
      await setDoc(ref, { role: "admin", active: true, permissions: ADMIN_PERMISSIONS, updatedAt: new Date().toISOString() }, { merge: true });
    }

    return profile;
  } catch (error) {
    console.error("Erro ao ler perfil:", error);
    return fallback;
  }
}

async function loadPermissionsUsers() {
  permissionsCache = [];
  if (!db || !firebaseApi || !hasPermission("managePermissions")) return;

  try {
    const { collection, getDocs } = firebaseApi;
    const snap = await withTimeout(getDocs(collection(db, "users")), 12000, "ler utilizadores");
    permissionsCache = snap.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() || {}) }))
      .sort((a, b) => normalizeEmail(a.email || a.id).localeCompare(normalizeEmail(b.email || b.id)));
  } catch (error) {
    console.error("Erro ao carregar permissões:", error);
  }
}

function renderPermissionCheckbox(email, key, label, checked, disabled = false) {
  return `
    <label class="perm-check">
      <input type="checkbox" data-perm-email="${escapeHtml(email)}" data-perm-key="${escapeHtml(key)}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} />
      ${escapeHtml(label)}
    </label>`;
}

function renderPermissionsUsers() {
  const list = $("permissionsUsersList");
  if (!list) return;

  if (!hasPermission("managePermissions")) {
    list.innerHTML = `<div class="empty small-empty">Não tens permissão para gerir utilizadores.</div>`;
    return;
  }

  if (!permissionsCache.length) {
    list.innerHTML = `<div class="empty small-empty">Ainda não existem utilizadores registados.</div>`;
    return;
  }

  const labels = {
    calendar: "Calendário",
    score: "Pontuação",
    knockout: "Fase Final",
    admin: "Admin",
    editResults: "Editar resultados",
    importExcel: "Importar Excel",
    editUsers: "Users do jogo",
    editPoints: "Sistema pontos",
    editKnockout: "Editar Fase Final",
    managePermissions: "Permissões"
  };

  list.innerHTML = permissionsCache.map(user => {
    const email = normalizeEmail(user.email || user.id);
    const role = user.role === "admin" ? "admin" : "user";
    const isAdminUser = role === "admin";
    const perms = { ...(isAdminUser ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS), ...(user.permissions || {}) };
    const active = user.active !== false;

    return `
      <article class="permission-user-card" data-permission-card="${escapeHtml(email)}">
        <div class="permission-user-head">
          <div>
            <strong>${escapeHtml(email)}</strong>
            <span>${isAdminUser ? "Admin" : "User normal"} · ${active ? "Ativo" : "Bloqueado"}</span>
          </div>
          <div class="permission-user-actions">
            <select data-role-email="${escapeHtml(email)}">
              <option value="user" ${role === "user" ? "selected" : ""}>User normal</option>
              <option value="admin" ${role === "admin" ? "selected" : ""}>Admin</option>
            </select>
            <label class="perm-active">
              <input type="checkbox" data-active-email="${escapeHtml(email)}" ${active ? "checked" : ""} />
              Ativo
            </label>
            <button class="primary small" type="button" data-save-permissions="${escapeHtml(email)}">Guardar</button>
          </div>
        </div>
        <div class="permission-grid">
          ${Object.entries(labels).map(([key, label]) => renderPermissionCheckbox(email, key, label, perms[key], isAdminUser)).join("")}
        </div>
      </article>
    `;
  }).join("");
}

async function savePermissionUser(email) {
  if (!db || !firebaseApi) return toast("Firebase não está ligado.");
  if (!hasPermission("managePermissions")) return toast("Sem permissão para gerir utilizadores.");

  const normalized = normalizeEmail(email);
  if (!normalized) return toast("Email inválido.");

  const card = document.querySelector(`[data-permission-card="${CSS.escape(normalized)}"]`);
  const role = document.querySelector(`[data-role-email="${CSS.escape(normalized)}"]`)?.value || $("permissionRoleInput")?.value || "user";
  const activeInput = document.querySelector(`[data-active-email="${CSS.escape(normalized)}"]`);
  const active = activeInput ? activeInput.checked : true;
  const isAdminUser = role === "admin";

  const permissions = isAdminUser ? { ...ADMIN_PERMISSIONS } : { ...DEFAULT_PERMISSIONS };
  if (card && !isAdminUser) {
    card.querySelectorAll("[data-perm-key]").forEach(input => {
      permissions[input.dataset.permKey] = input.checked;
    });
  }

  const profile = {
    email: normalized,
    role,
    active,
    permissions,
    updatedAt: new Date().toISOString()
  };

  const { doc, setDoc } = firebaseApi;
  await withTimeout(setDoc(doc(db, "users", normalized), profile, { merge: true }), 12000, "guardar permissões");
  toast("Permissões guardadas.");
  await loadPermissionsUsers();
  renderPermissionsUsers();

  if (normalizeEmail(currentUser?.email) === normalized) {
    currentProfile = await readUserProfile(currentUser);
    applyPermissionsToUi();
  }
}

async function addPermissionUser() {
  const email = normalizeEmail($("permissionEmailInput")?.value);
  if (!email) return toast("Escreve o email do utilizador.");
  await savePermissionUser(email);
  if ($("permissionEmailInput")) $("permissionEmailInput").value = "";
}

function permissionTabAllowed(tabId) {
  if (tabId === "calendarTab") return hasPermission("calendar");
  if (tabId === "scoreTab") return hasPermission("score");
  if (tabId === "knockoutTab") return hasPermission("knockout");
  if (tabId === "adminTab") return hasPermission("admin");
  return true;
}

function switchToFirstAllowedTab() {
  const allowed = [...document.querySelectorAll(".tab")].find(button => permissionTabAllowed(button.dataset.tab));
  if (!allowed) return;
  document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));
  allowed.classList.add("active");
  $(allowed.dataset.tab)?.classList.add("active");
}

function applyPermissionsToUi() {
  updateSessionBox();

  document.querySelector('[data-tab="calendarTab"]')?.classList.toggle("hidden", !hasPermission("calendar"));
  document.querySelector('[data-tab="scoreTab"]')?.classList.toggle("hidden", !hasPermission("score"));
  document.querySelector('[data-tab="knockoutTab"]')?.classList.toggle("hidden", !hasPermission("knockout"));
  document.querySelector('[data-tab="adminTab"]')?.classList.toggle("hidden", !hasPermission("admin"));

  $("adminTab")?.classList.toggle("no-access", !hasPermission("admin"));

  // Ações admin
  document.querySelectorAll("[data-result-game]").forEach(btn => {
    const inAdmin = btn.closest("#adminTab");
    if (inAdmin && !canEditResults()) btn.classList.add("hidden");
  });

  $("openExcelModalBtn")?.classList.toggle("hidden", !hasPermission("importExcel"));
  $("exportResultadosBtn")?.classList.toggle("hidden", !hasPermission("importExcel"));
  $("addUserBtn")?.classList.toggle("hidden", !hasPermission("editUsers"));
  $("savePointsSettingsBtn")?.classList.toggle("hidden", !hasPermission("editPoints"));
  $("saveExtraResultsBtn")?.classList.toggle("hidden", !hasPermission("editPoints"));
  $("saveKnockoutUnlockBtn")?.classList.toggle("hidden", !hasPermission("editKnockout"));

  document.querySelectorAll("[data-ko-save], [data-ko-edit]").forEach(btn => {
    btn.classList.toggle("hidden", !hasPermission("editKnockout"));
  });

  const permissionsCard = $("permissionsUsersList")?.closest(".admin-card");
  permissionsCard?.classList.toggle("hidden", !hasPermission("managePermissions"));

  const activePanel = document.querySelector(".tab-panel.active");
  if (activePanel && !permissionTabAllowed(activePanel.id)) {
    switchToFirstAllowedTab();
  }

  renderPermissionsUsers();
}


const REMEMBER_EMAIL_KEY = "mundial_pontos_2026_remember_email_v56";

function setupRememberedAccount() {
  const emailInput = $("loginEmailInput");
  const rememberInput = $("rememberEmailInput");
  if (!emailInput) return;

  try {
    const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY) || "";
    if (savedEmail && !emailInput.value) {
      emailInput.value = savedEmail;
    }
    if (rememberInput) {
      rememberInput.checked = true;
    }
  } catch (error) {
    console.warn("Não foi possível ler email memorizado:", error);
  }
}

function saveRememberedAccount(email) {
  const rememberInput = $("rememberEmailInput");
  const shouldRemember = rememberInput ? rememberInput.checked : true;
  const normalized = normalizeEmail(email);

  try {
    if (shouldRemember && normalized) {
      localStorage.setItem(REMEMBER_EMAIL_KEY, normalized);
    } else {
      localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }
  } catch (error) {
    console.warn("Não foi possível guardar email memorizado:", error);
  }
}

async function handleLogin() {
  if (!firebaseAuthApi || !firebaseAuth) {
    setLoginStatus("Firebase/Auth não está pronto.", "error");
    return;
  }

  const email = $("loginEmailInput")?.value.trim();
  const password = $("loginPasswordInput")?.value || "";
  if (!email || !password) {
    setLoginStatus("Preenche email e password.", "error");
    return;
  }

  try {
    setLoginStatus("A entrar...", "loading");
    saveRememberedAccount(email);
    await firebaseAuthApi.signInWithEmailAndPassword(firebaseAuth, email, password);
  } catch (error) {
    console.error(error);
    setLoginStatus(authFriendlyError(error), "error");
  }
}

async function handleCreateAccount() {
  if (!firebaseAuthApi || !firebaseAuth) {
    setLoginStatus("Firebase/Auth não está pronto.", "error");
    return;
  }

  const email = $("loginEmailInput")?.value.trim();
  const password = $("loginPasswordInput")?.value || "";
  if (!email || !password) {
    setLoginStatus("Preenche email e password para criar conta.", "error");
    return;
  }

  try {
    setLoginStatus("A criar conta...", "loading");
    saveRememberedAccount(email);
    await firebaseAuthApi.createUserWithEmailAndPassword(firebaseAuth, email, password);
  } catch (error) {
    console.error(error);
    setLoginStatus(authFriendlyError(error), "error");
  }
}

function authFriendlyError(error) {
  const code = String(error?.code || error?.message || "");
  if (code.includes("auth/invalid-credential") || code.includes("auth/wrong-password")) return "Email ou password incorretos.";
  if (code.includes("auth/user-not-found")) return "Conta não encontrada.";
  if (code.includes("auth/email-already-in-use")) return "Este email já tem conta. Usa Entrar.";
  if (code.includes("auth/weak-password")) return "A password tem de ter pelo menos 6 caracteres.";
  if (code.includes("auth/operation-not-allowed")) return "Ativa Email/Password no Firebase Authentication.";
  return "Erro no login. Verifica o Firebase e tenta novamente.";
}

function setupAuthGate() {
  if (!firebaseAuthApi || !firebaseAuth) {
    showLoginScreen();
    setLoginStatus("Firebase Auth não está configurado.", "error");
    return;
  }

  firebaseAuthApi.onAuthStateChanged(firebaseAuth, async user => {
    currentUser = user || null;

    if (user?.email) saveRememberedAccount(user.email);

    if (!user) {
      currentProfile = null;
      showLoginScreen();
      updateSessionBox();
      return;
    }

    try {
      setLoginStatus("A carregar permissões...", "loading");
      currentProfile = await readUserProfile(user);

      if (!currentProfile.active) {
        await firebaseAuthApi.signOut(firebaseAuth);
        setLoginStatus("Conta bloqueada pelo Admin.", "error");
        return;
      }

      showAppScreen();
      updateSessionBox();
      await loadPermissionsUsers();
      await loadData();
      applyPermissionsToUi();
      setLoginStatus("Login efetuado.", "success");
    } catch (error) {
      console.error("Erro no arranque com login:", error);
      setLoginStatus("Erro ao carregar permissões.", "error");
      showLoginScreen();
    }
  });
}

async function logout() {
  if (!firebaseAuthApi || !firebaseAuth) return;
  await firebaseAuthApi.signOut(firebaseAuth);
  toast("Sessão terminada.");
}

const KNOCKOUT_ROUNDS = [
  { key: "r32", label: "16 avos", count: 16, next: "r16" },
  { key: "r16", label: "Oitavos", count: 8, next: "qf" },
  { key: "qf", label: "Quartos", count: 4, next: "sf" },
  { key: "sf", label: "Meias-finais", count: 2, next: "final" },
  { key: "final", label: "Final", count: 1, next: "" }
];


function isManualKnockoutRound(match) {
  return match?.round === KNOCKOUT_ROUNDS[0].key;
}

function knockoutTeamOptions() {
  return [...new Set(MATCH_ROWS.flatMap(row => [row[1], row[2]]))].sort((a, b) => a.localeCompare(b, "pt"));
}

function defaultKnockoutMatches() {
  const matches = [];
  KNOCKOUT_ROUNDS.forEach(round => {
    for (let index = 1; index <= round.count; index += 1) {
      const nextIndex = round.next ? Math.ceil(index / 2) : null;
      matches.push({
        id: `ko_${round.key}_${String(index).padStart(2, "0")}`,
        round: round.key,
        roundLabel: round.label,
        index,
        homeTeam: "",
        awayTeam: "",
        homeScore: null,
        awayScore: null,
        homePenalties: null,
        awayPenalties: null,
        nextMatchId: round.next ? `ko_${round.next}_${String(nextIndex).padStart(2, "0")}` : "",
        nextSlot: round.next ? (index % 2 === 1 ? "homeTeam" : "awayTeam") : "",
        updatedAt: ""
      });
    }
  });
  return matches;
}

function ensureKnockoutSettings() {
  const current = appSettings.knockout || {};
  const defaults = defaultKnockoutMatches();
  const existingMatches = Array.isArray(current.matches) ? current.matches : [];
  const existing = new Map(existingMatches.map(match => [match.id, match]));

  appSettings.knockout = {
    adminUnlocked: Boolean(current.adminUnlocked),
    matches: defaults.map(match => {
      const saved = existing.get(match.id) || {};
      return {
        ...match,
        ...saved,
        homePenalties: saved.homePenalties ?? null,
        awayPenalties: saved.awayPenalties ?? null
      };
    })
  };

  propagateKnockoutWinners(false);
}

function knockoutMatches() {
  if (!appSettings.knockout || !Array.isArray(appSettings.knockout.matches) || !appSettings.knockout.matches.length) {
    appSettings.knockout = {
      adminUnlocked: Boolean(appSettings.knockout?.adminUnlocked),
      matches: defaultKnockoutMatches()
    };
  }
  return appSettings.knockout.matches;
}

function knockoutMatchById(id) {
  return (appSettings.knockout?.matches || []).find(match => match.id === id);
}

function groupStageFinished() {
  return games.length > 0 && games.every(hasResult);
}

function knockoutAvailable() {
  return groupStageFinished() || Boolean(appSettings.knockout?.adminUnlocked);
}

function knockoutWinner(match) {
  if (!match || !match.homeTeam || !match.awayTeam) return "";
  if (match.homeScore === null || match.homeScore === undefined || match.homeScore === "" || match.awayScore === null || match.awayScore === undefined || match.awayScore === "") return "";

  const home = Number(match.homeScore);
  const away = Number(match.awayScore);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return "";

  if (home > away) return match.homeTeam;
  if (away > home) return match.awayTeam;

  const homePen = match.homePenalties;
  const awayPen = match.awayPenalties;
  if (homePen === null || homePen === undefined || homePen === "" || awayPen === null || awayPen === undefined || awayPen === "") return "";

  const hp = Number(homePen);
  const ap = Number(awayPen);
  if (!Number.isFinite(hp) || !Number.isFinite(ap) || hp === ap) return "";

  return hp > ap ? match.homeTeam : match.awayTeam;
}

function clearAutoKnockoutSlots() {
  const matches = appSettings.knockout?.matches || [];
  matches.forEach(match => {
    if (!isManualKnockoutRound(match)) {
      match.homeTeam = "";
      match.awayTeam = "";
    }
  });
}

function propagateKnockoutWinners(shouldSave = true) {
  if (!appSettings.knockout || !Array.isArray(appSettings.knockout.matches)) return;

  const matches = appSettings.knockout.matches;
  const previousTeams = new Map(matches.map(match => [match.id, `${match.homeTeam || ""}|${match.awayTeam || ""}`]));

  clearAutoKnockoutSlots();

  KNOCKOUT_ROUNDS.forEach(round => {
    matches
      .filter(match => match.round === round.key)
      .forEach(match => {
        const winner = knockoutWinner(match);
        if (!winner || !match.nextMatchId || !match.nextSlot) return;
        const next = matches.find(item => item.id === match.nextMatchId);
        if (next) next[match.nextSlot] = winner;
      });
  });

  matches.forEach(match => {
    if (isManualKnockoutRound(match)) return;
    const oldTeams = previousTeams.get(match.id) || "|";
    const newTeams = `${match.homeTeam || ""}|${match.awayTeam || ""}`;
    if (oldTeams !== newTeams) {
      match.homeScore = null;
      match.awayScore = null;
      match.homePenalties = null;
      match.awayPenalties = null;
    }
  });

  if (shouldSave) {
    saveLocalData("fase final propagada");
    persistSettings();
  }
}

function knockoutEntryButtonHtml() {
  const available = knockoutAvailable();
  const missing = games.filter(game => !hasResult(game)).length;
  const text = available ? "Abrir Fase Final" : `Fase Final bloqueada · faltam ${missing} resultado(s)`;
  return `
    <div class="knockout-entry-card ${available ? "available" : "locked"}">
      <div>
        <strong>Fase Final</strong>
        <span>${available ? "Eliminatórias disponíveis." : "Só abre quando todos os jogos dos grupos tiverem resultado. O Admin pode ativar para trabalhar."}</span>
      </div>
      <button id="openKnockoutFromCalendarBtn" class="${available ? "primary" : "secondary"}" type="button" ${available ? "" : "disabled"}>${escapeHtml(text)}</button>
    </div>`;
}

function openKnockoutPage() {
  if (!knockoutAvailable()) {
    toast("Fase Final bloqueada. O Admin pode ativar no painel Admin.");
    return;
  }

  document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));
  document.querySelector('[data-tab="knockoutTab"]')?.classList.add("active");
  $("knockoutTab")?.classList.add("active");
  renderKnockout();
}

function renderKnockout() {
  ensureKnockoutSettings();
  const notice = $("knockoutLockNotice");
  const container = $("knockoutBracket");
  if (!container) return;

  if (!knockoutAvailable()) {
    const missing = games.filter(game => !hasResult(game)).length;
    if (notice) notice.innerHTML = `<strong>Fase Final bloqueada</strong><span>Faltam ${missing} resultado(s) da fase de grupos. O Admin pode ativar esta página para trabalhar.</span>`;
    container.innerHTML = "";
    return;
  }

  const finalMatch = knockoutMatches().find(match => match.round === "final");
  const champion = knockoutWinner(finalMatch);

  if (notice) {
    notice.innerHTML = appSettings.knockout?.adminUnlocked && !groupStageFinished()
      ? `<strong>Modo Admin ativo</strong><span>A Fase Final está desbloqueada para preparação, mesmo antes de todos os grupos acabarem.</span>`
      : `<strong>Fase Final ativa</strong><span>Tu defines a primeira ronda; depois os vencedores passam automaticamente até à final.</span>`;
  }

  container.innerHTML = `
    <div class="bracket-photo-shell">
      <div class="bracket-title-row">
        <span>Esquerda</span>
        <strong>Fase Final Mundial 2026</strong>
        <span>Direita</span>
      </div>

      <div class="bracket-photo-grid">
        ${KNOCKOUT_ROUNDS.map((round, roundIndex) => {
          const matches = knockoutMatches().filter(match => match.round === round.key);
          return `
            <section class="bracket-photo-round round-${round.key}" style="--round-index:${roundIndex}">
              <h3>${escapeHtml(round.label)}</h3>
              <div class="bracket-photo-matches">
                ${matches.map(match => renderKnockoutMatch(match)).join("")}
              </div>
            </section>`;
        }).join("")}

        <section class="bracket-champion-card ${champion ? "has-champion" : ""}">
          <span>Campeão</span>
          <strong>${escapeHtml(champion || "Por decidir")}</strong>
        </section>
      </div>
    </div>`;
}

function renderKnockoutMatch(match) {
  const winner = knockoutWinner(match);
  const editable = isAdmin && knockoutAvailable();
  const waiting = !match.homeTeam || !match.awayTeam;
  const hasScore = match.homeScore !== null && match.homeScore !== undefined && match.homeScore !== "" && match.awayScore !== null && match.awayScore !== undefined && match.awayScore !== "";
  const isDraw = hasScore && Number(match.homeScore) === Number(match.awayScore);
  const hasPens = match.homePenalties !== null && match.homePenalties !== undefined && match.homePenalties !== "" && match.awayPenalties !== null && match.awayPenalties !== undefined && match.awayPenalties !== "";
  const lockedText = waiting ? "À espera" : winner ? "Vencedor" : isDraw ? "Faltam penáltis" : "Por decidir";

  return `
    <article class="knockout-match ${winner ? "has-winner" : ""} ${waiting ? "waiting" : ""}">
      <div class="knockout-match-title">${escapeHtml(match.roundLabel)} ${match.index}</div>

      <div class="ko-team ${winner === match.homeTeam ? "winner" : ""}">
        <span>${escapeHtml(match.homeTeam || "A definir")}</span>
        <b>${match.homeScore ?? ""}</b>
      </div>

      <div class="ko-team ${winner === match.awayTeam ? "winner" : ""}">
        <span>${escapeHtml(match.awayTeam || "A definir")}</span>
        <b>${match.awayScore ?? ""}</b>
      </div>

      ${(isDraw || hasPens) ? `
        <div class="ko-penalties-line">
          <span>Penáltis</span>
          <strong>${hasPens ? `${match.homePenalties}-${match.awayPenalties}` : "por preencher"}</strong>
        </div>
      ` : ""}

      <div class="ko-status-line">
        <small>${escapeHtml(lockedText)}</small>
        ${editable ? `<button class="secondary small" type="button" data-ko-edit="${escapeHtml(match.id)}">Editar</button>` : ""}
      </div>
    </article>`;
}

function renderKnockoutAdmin() {
  ensureKnockoutSettings();

  const toggle = $("adminKnockoutUnlockedInput");
  if (toggle) toggle.checked = Boolean(appSettings.knockout?.adminUnlocked);

  const panel = $("knockoutAdminPanel");
  if (!panel) return;

  const teams = knockoutTeamOptions();
  const teamOptions = team => `<option value="">A definir</option>${teams.map(item => `<option value="${escapeHtml(item)}" ${item === team ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}`;

  panel.innerHTML = `
    <div class="ko-admin-note">
      <strong>Regra da Fase Final:</strong> só defines manualmente os jogos dos <strong>16 avos</strong>.
      As rondas seguintes são automáticas. Se o jogo acabar empatado, preenche os <strong>penáltis</strong> para definir quem passa.
    </div>
    <div class="ko-admin-list">
      ${knockoutMatches().map(match => {
        const manualRound = isManualKnockoutRound(match);
        const homeControl = manualRound
          ? `<select class="ko-home-team">${teamOptions(match.homeTeam)}</select>`
          : `<input class="ko-readonly-team" type="text" value="${escapeHtml(match.homeTeam || "A definir automaticamente")}" disabled />`;
        const awayControl = manualRound
          ? `<select class="ko-away-team">${teamOptions(match.awayTeam)}</select>`
          : `<input class="ko-readonly-team" type="text" value="${escapeHtml(match.awayTeam || "A definir automaticamente")}" disabled />`;

        const canScore = Boolean(match.homeTeam && match.awayTeam);
        return `
          <div class="ko-admin-row ko-admin-row-penalties ${manualRound ? "manual-round" : "auto-round"}" data-ko-admin="${escapeHtml(match.id)}">
            <strong>${escapeHtml(match.roundLabel)} ${match.index}</strong>
            ${homeControl}
            <span>vs</span>
            ${awayControl}

            <label class="ko-score-label">Resultado
              <span class="ko-score-pair">
                <input class="ko-home-score" type="number" min="0" inputmode="numeric" value="${match.homeScore ?? ""}" placeholder="0" ${canScore ? "" : "disabled"} />
                <em>-</em>
                <input class="ko-away-score" type="number" min="0" inputmode="numeric" value="${match.awayScore ?? ""}" placeholder="0" ${canScore ? "" : "disabled"} />
              </span>
            </label>

            <label class="ko-score-label ko-penalty-label">Penáltis
              <span class="ko-score-pair">
                <input class="ko-home-penalties" type="number" min="0" inputmode="numeric" value="${match.homePenalties ?? ""}" placeholder="0" ${canScore ? "" : "disabled"} />
                <em>-</em>
                <input class="ko-away-penalties" type="number" min="0" inputmode="numeric" value="${match.awayPenalties ?? ""}" placeholder="0" ${canScore ? "" : "disabled"} />
              </span>
            </label>

            <button class="primary small" type="button" data-ko-save="${escapeHtml(match.id)}">${manualRound ? "Guardar" : "Guardar resultado"}</button>
          </div>
        `;
      }).join("")}
    </div>`;
}

async function saveKnockoutUnlock() {
  if (!hasPermission("editKnockout")) { toast("Sem permissão."); return; }

  ensureKnockoutSettings();
  appSettings.knockout.adminUnlocked = Boolean($("adminKnockoutUnlockedInput")?.checked);
  await persistSettings();
  renderAll();
  toast(appSettings.knockout.adminUnlocked ? "Fase Final desbloqueada para Admin." : "Fase Final volta a bloquear até acabarem os grupos.");
}

async function saveKnockoutMatchFromAdmin(matchId) {
  if (!hasPermission("editKnockout")) { toast("Sem permissão."); return; }

  ensureKnockoutSettings();
  const row = document.querySelector(`[data-ko-admin="${CSS.escape(matchId)}"]`);
  const match = knockoutMatchById(matchId);
  if (!row || !match) return;

  const manualRound = isManualKnockoutRound(match);

  if (manualRound) {
    match.homeTeam = row.querySelector(".ko-home-team")?.value || "";
    match.awayTeam = row.querySelector(".ko-away-team")?.value || "";
  }

  if (!match.homeTeam || !match.awayTeam) {
    match.homeScore = null;
    match.awayScore = null;
    match.homePenalties = null;
    match.awayPenalties = null;
    saveLocalData("fase final equipas incompletas");
    await persistSettings();
    renderAll();
    toast("Define as duas equipas deste jogo.");
    return;
  }

  const homeScore = row.querySelector(".ko-home-score")?.value ?? "";
  const awayScore = row.querySelector(".ko-away-score")?.value ?? "";
  const homePenalties = row.querySelector(".ko-home-penalties")?.value ?? "";
  const awayPenalties = row.querySelector(".ko-away-penalties")?.value ?? "";

  match.homeScore = homeScore === "" ? null : Number(homeScore);
  match.awayScore = awayScore === "" ? null : Number(awayScore);

  const hasFullScore = match.homeScore !== null && match.awayScore !== null;
  const isDraw = hasFullScore && Number(match.homeScore) === Number(match.awayScore);

  if (isDraw) {
    if (homePenalties === "" || awayPenalties === "") {
      toast("Jogo empatado. Preenche o resultado dos penáltis.");
      return;
    }

    match.homePenalties = Number(homePenalties);
    match.awayPenalties = Number(awayPenalties);

    if (Number(match.homePenalties) === Number(match.awayPenalties)) {
      toast("Os penáltis não podem ficar empatados.");
      return;
    }
  } else {
    match.homePenalties = homePenalties === "" ? null : Number(homePenalties);
    match.awayPenalties = awayPenalties === "" ? null : Number(awayPenalties);

    if ((homePenalties === "") !== (awayPenalties === "")) {
      toast("Preenche os dois campos dos penáltis ou deixa os dois vazios.");
      return;
    }

    if (homePenalties !== "" && Number(match.homePenalties) === Number(match.awayPenalties)) {
      toast("Se preencheres penáltis, eles não podem ficar empatados.");
      return;
    }
  }

  match.updatedAt = new Date().toISOString();

  propagateKnockoutWinners(false);
  saveLocalData("fase final jogo guardado com penaltis");
  await persistSettings();
  renderAll();

  if (manualRound) {
    toast("Jogo da primeira ronda guardado. Vencedor avança automaticamente.");
  } else {
    toast("Resultado guardado. Vencedor avançou automaticamente.");
  }
}

function openKnockoutEditInAdmin(matchId) {
  if (!hasPermission("editKnockout")) { toast("Sem permissão para editar a Fase Final."); return; }

  if (!isAdmin) {
    toast("Entra no Admin para editar a Fase Final.");
    return;
  }
  document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));
  document.querySelector('[data-tab="adminTab"]')?.classList.add("active");
  $("adminTab")?.classList.add("active");
  renderKnockoutAdmin();
  setTimeout(() => {
    const row = document.querySelector(`[data-ko-admin="${CSS.escape(matchId)}"]`);
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
    row?.classList.add("pulse-row");
    setTimeout(() => row?.classList.remove("pulse-row"), 1500);
  }, 80);
}

function renderAll() { renderAdminState(); renderCalendar(); renderScore(); renderKnockout(); renderAdmin(); renderSettingsForm(); renderUsers(); renderUserBetsEditor(); renderKnockoutAdmin(); renderCalendarFilterState(); applyPermissionsToUi(); }

function renderCalendarFilterState() {
  $("calendarMissingResultsBtn")?.classList.toggle("active-filter", calendarViewMode === "missing");
  $("calendarAllGamesBtn")?.classList.toggle("active-filter", calendarViewMode === "all");
}

function renderCalendar() {
  const container = $("gamesList");
  const groups = groupByDate(filteredGames());
  const days = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (!days.length) { container.innerHTML = `<div class="empty">Não há jogos para mostrar neste filtro.</div>${knockoutEntryButtonHtml()}`; return; }
  container.innerHTML = days.map(([, dayGames]) => `
    <section class="day-block"><h3>${escapeHtml(dateHeader(dayGames[0].matchDate))}</h3><div class="match-list">${dayGames.map(renderMatchRow).join("")}</div></section>
  `).join("") + knockoutEntryButtonHtml();
}
function renderMatchRow(game) {
  const status = statusOf(game);
  const scoreText = hasResult(game) ? `${game.homeScore}-${game.awayScore}` : "VS";
  const gameBets = betsForGame(game.id);
  const settledText = hasResult(game) ? `${gameBets.length} apostas · pontos atribuídos` : `${gameBets.length} apostas importadas`;
  const resultButtonText = hasResult(game) ? "Editar resultado" : "Adicionar resultado";

  return `
    <article class="match-row ${status.className}">
      <div class="group-pill">${escapeHtml(game.group)}</div>
      <div class="team home"><strong>${escapeHtml(game.homeTeam)}</strong></div>
      <div class="score-vs">${escapeHtml(scoreText)}</div>
      <div class="team away"><strong>${escapeHtml(game.awayTeam)}</strong></div>
      <div class="time">${timePortugal(game.matchDate)}</div>
      <div class="state ${status.className}">${status.text}</div>
      <div class="bet-note">${escapeHtml(settledText)}</div>
      <div class="calendar-actions">
        <button class="primary small" type="button" data-result-game="${escapeHtml(game.id)}">${resultButtonText}</button>
        <button class="secondary small" type="button" data-bets-game="${escapeHtml(game.id)}">Ver apostas</button>
      </div>
    </article>`;
}

function betResultLabel(bet, game) {
  if (!game || !hasResult(game)) return "Por jogar";
  if (!bet) return "Sem aposta";
  if (isExactBet(bet, game)) return "Resultado exato";
  if (isOutcomeBet(bet, game)) {
    return outcome(game.homeScore, game.awayScore) === "draw" ? "Empate certo" : "Vencedor certo";
  }
  return "Falhou";
}

function betResultClass(bet, game) {
  if (!game || !hasResult(game)) return "pending";
  if (!bet) return "missing";
  if (isExactBet(bet, game)) return "exact";
  if (isOutcomeBet(bet, game)) return "winner";
  return "miss";
}

function playerGameRows(playerName) {
  const playerId = playerIdFromName(playerName);
  return games.map(game => {
    const bet = bets.find(item => item.playerId === playerId && item.gameId === game.id) || null;
    return {
      game,
      bet,
      points: bet ? pointsForBet(bet, game) : 0,
      label: betResultLabel(bet, game),
      className: betResultClass(bet, game)
    };
  });
}

function renderScore() {
  const rows = leaderboard();
  const target = $("scoreSummary");
  if (!target) return;

  if (!rows.length) {
    target.innerHTML = `<div class="empty">Importa o Excel de Resultados para criar a classificação.</div>`;
    return;
  }

  target.innerHTML = `
    <div class="score-detail-list">
      ${rows.map((row, index) => {
        const gameRows = playerGameRows(row.playerName);
        const settled = gameRows.filter(item => hasResult(item.game)).length;
        const withBets = gameRows.filter(item => item.bet).length;

        return `
          <details class="player-score-card">
            <summary>
              <div class="player-rank">${index + 1}</div>
              <div class="player-score-main">
                <strong>${escapeHtml(row.playerName)}</strong>
                <span>${row.exact} exatos · ${row.winner} vencedor/empate · ${settled} jogos com resultado · ${withBets} apostas</span>
              </div>
              <div class="player-total">${row.points} pts</div>
              <div class="player-arrow">⌄</div>
            </summary>

            <div class="player-games-table">
              <div class="player-game-row head">
                <span>Jogo</span>
                <span>Aposta</span>
                <span>Resultado</span>
                <span>Tipo</span>
                <span>Pontos</span>
              </div>
              ${gameRows.map(({ game, bet, points, label, className }) => `
                <div class="player-game-row ${className}">
                  <span>
                    <b>${escapeHtml(game.homeTeam)} - ${escapeHtml(game.awayTeam)}</b>
                    <small>${escapeHtml(game.group)} · ${dateHeader(game.matchDate)} · ${timePortugal(game.matchDate)}</small>
                  </span>
                  <span>${bet ? `${bet.homeGuess}-${bet.awayGuess}` : "-"}</span>
                  <span>${hasResult(game) ? `${game.homeScore}-${game.awayScore}` : "-"}</span>
                  <span><em>${escapeHtml(label)}</em></span>
                  <strong>${points}</strong>
                </div>
              `).join("")}
            </div>
          </details>
        `;
      }).join("")}
    </div>`;
}

function blankTeam(team) { return { team, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, gd: 0, points: 0 }; }
function groupSortName(group) { return String(group).match(/Grupo ([A-Z])/i)?.[1] || "Z"; }
function buildStandings() {
  const tables = new Map();
  games.forEach(game => {
    if (!tables.has(game.group)) tables.set(game.group, new Map());
    const table = tables.get(game.group);
    [game.homeTeam, game.awayTeam].forEach(team => { if (!table.has(team)) table.set(team, blankTeam(team)); });
    if (!hasResult(game)) return;
    const home = table.get(game.homeTeam), away = table.get(game.awayTeam);
    const hs = Number(game.homeScore), as = Number(game.awayScore);
    home.played += 1; away.played += 1;
    home.gf += hs; home.ga += as; away.gf += as; away.ga += hs;
    home.gd = home.gf - home.ga; away.gd = away.gf - away.ga;
    if (hs > as) { home.wins += 1; away.losses += 1; home.points += 3; }
    else if (hs < as) { away.wins += 1; home.losses += 1; away.points += 3; }
    else { home.draws += 1; away.draws += 1; home.points += 1; away.points += 1; }
  });
  return [...tables.entries()].sort((a, b) => groupSortName(a[0]).localeCompare(groupSortName(b[0]))).map(([group, table]) => ({ group, rows: [...table.values()].sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team)) }));
}
function renderGroups() {
  $("groupsTables").innerHTML = buildStandings().map(({ group, rows }) => `
    <section class="group-table"><h3>${escapeHtml(group)}</h3><div class="table">
      <div class="table-row head"><span>#</span><span>Seleção</span><span>J</span><span>DG</span><span>Pts</span></div>
      ${rows.map((row, index) => `<div class="table-row"><span>${index + 1}</span><strong>${escapeHtml(row.team)}</strong><span>${row.played}</span><span>${row.gd}</span><b>${row.points}</b></div>`).join("")}
    </div></section>`).join("");
}

function renderAdminState() {
  $("adminLocked").classList.toggle("hidden", isAdmin || isAdminProfile());
  $("adminUnlocked").classList.toggle("hidden", !(isAdmin || isAdminProfile()));
  const status = storageMode === "firebase" ? "Firebase online" : "Modo local";
  $("storageStatus").textContent = `${status}. Importa as apostas do Excel Resultados e mete os resultados reais manualmente.`;
}
function renderSettingsForm() {
  if (!$("pointsExactInput")) return;
  $("pointsExactInput").value = appSettings.points.exact;
  if ($("pointsWinnerInput")) $("pointsWinnerInput").value = appSettings.points.winner ?? 1;
  $("pointsMvpInput").value = appSettings.points.mvp;
  $("pointsTopScorerInput").value = appSettings.points.topScorer;
  $("pointsChampionInput").value = appSettings.points.champion;
  $("finalMvpInput").value = appSettings.extraResults.mvp || "";
  $("finalTopScorerInput").value = appSettings.extraResults.topScorer || "";
  $("finalChampionInput").value = appSettings.extraResults.champion || "";
  if (appSettings.lastImport) {
    $("importSummary").innerHTML = `<strong>Última importação:</strong> ${escapeHtml(new Date(appSettings.lastImport.at).toLocaleString("pt-PT"))} · ${appSettings.lastImport.bets || 0} apostas · ${appSettings.lastImport.players || 0} users · ${appSettings.lastImport.results || 0} resultados.`;
  }
}

function renderApiSettings() {
  if (!$("apiKeyInput")) return;
  const api = appSettings.api || defaultSettings().api;
  $("apiKeyInput").value = api.apiKey || "";
  $("apiLeagueInput").value = api.league || "1";
  $("apiSeasonInput").value = api.season || "2026";
  const summary = $("apiSyncSummary");
  if (summary) {
    summary.innerHTML = api.lastSync
      ? `<strong>Última sincronização:</strong> ${escapeHtml(new Date(api.lastSync.at).toLocaleString("pt-PT"))} · ${api.lastSync.updated || 0} resultados atualizados · ${api.lastSync.matched || 0} jogos encontrados na app.`
      : "Ainda não foi feita sincronização automática.";
  }
}


function betForPlayerGame(playerName, gameId) {
  const playerId = playerIdFromName(playerName);
  return bets.find(item => item.playerId === playerId && item.gameId === gameId) || null;
}

function renderUserBetsSelector() {
  const select = $("editUserSelect");
  if (!select) return;

  const players = allPlayers();
  if (!selectedEditUser || !players.includes(selectedEditUser)) {
    selectedEditUser = players[0] || "";
  }

  select.innerHTML = players.length
    ? players.map(name => `<option value="${escapeHtml(name)}" ${name === selectedEditUser ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")
    : `<option value="">Sem users importados</option>`;
}

function renderUserBetsEditor() {
  const container = $("userBetsEditor");
  if (!container) return;

  const players = allPlayers();
  if (!players.length) {
    container.innerHTML = `<div class="empty">Ainda não existem users. Importa o Excel ou adiciona users no Admin.</div>`;
    renderUserBetsSelector();
    return;
  }

  if (!selectedEditUser || !players.includes(selectedEditUser)) {
    selectedEditUser = players[0];
  }

  renderUserBetsSelector();

  const extra = appSettings.extraPredictions?.[selectedEditUser] || {};

  container.innerHTML = `
    <div class="user-final-editor">
      <h3>Resultados finais de ${escapeHtml(selectedEditUser)}</h3>
      <div class="final-fields-grid">
        <label>MVP
          <input id="editExtraMvpInput" type="text" value="${escapeHtml(extra.mvp || "")}" placeholder="Nome do MVP" />
        </label>
        <label>Melhor Marcador
          <input id="editExtraTopScorerInput" type="text" value="${escapeHtml(extra.topScorer || "")}" placeholder="Nome do melhor marcador" />
        </label>
        <label>Equipa Vencedora
          <input id="editExtraChampionInput" type="text" value="${escapeHtml(extra.champion || "")}" placeholder="Seleção vencedora" />
        </label>
      </div>
    </div>

    <div class="user-games-editor">
      ${games.map(game => {
        const bet = betForPlayerGame(selectedEditUser, game.id);
        return `
          <div class="user-game-edit-row" data-edit-game="${escapeHtml(game.id)}">
            <div class="user-game-meta">
              <span>${escapeHtml(game.group)}</span>
              <strong>${escapeHtml(game.homeTeam)} - ${escapeHtml(game.awayTeam)}</strong>
              <small>${dateHeader(game.matchDate)} · ${timePortugal(game.matchDate)}</small>
            </div>
            <div class="user-game-score">
              <input class="edit-home-score" type="number" min="0" inputmode="numeric" value="${bet ? bet.homeGuess : ""}" aria-label="Aposta ${escapeHtml(game.homeTeam)}" />
              <span>-</span>
              <input class="edit-away-score" type="number" min="0" inputmode="numeric" value="${bet ? bet.awayGuess : ""}" aria-label="Aposta ${escapeHtml(game.awayTeam)}" />
            </div>
            <button class="secondary small clear-user-game-btn" type="button">Limpar</button>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

async function saveEditedUserBets() {
  if (!hasPermission("editUsers")) { toast("Sem permissão."); return; }

  const playerName = selectedEditUser;
  if (!playerName) {
    toast("Escolhe um utilizador.");
    return;
  }

  const playerId = playerIdFromName(playerName);
  const now = new Date().toISOString();
  const previousPlayerBetIds = bets.filter(item => item.playerId === playerId).map(item => item.id);
  const otherBets = bets.filter(item => item.playerId !== playerId);
  const newPlayerBets = [];

  document.querySelectorAll("[data-edit-game]").forEach(row => {
    const gameId = row.dataset.editGame;
    const homeValue = row.querySelector(".edit-home-score")?.value ?? "";
    const awayValue = row.querySelector(".edit-away-score")?.value ?? "";

    if (homeValue === "" && awayValue === "") return;

    if (homeValue === "" || awayValue === "") {
      return;
    }

    newPlayerBets.push({
      id: `${playerId}_${gameId}`,
      playerId,
      playerName,
      gameId,
      homeGuess: Number(homeValue),
      awayGuess: Number(awayValue),
      source: "Editado na app",
      updatedAt: now
    });
  });

  bets = [...otherBets, ...newPlayerBets];

  appSettings.extraPredictions = appSettings.extraPredictions || {};
  appSettings.extraPredictions[playerName] = {
    mvp: $("editExtraMvpInput")?.value?.trim() || "",
    topScorer: $("editExtraTopScorerInput")?.value?.trim() || "",
    champion: $("editExtraChampionInput")?.value?.trim() || ""
  };

  if (!appSettings.users.includes(playerName)) {
    appSettings.users.push(playerName);
  }

  const nextPlayerBetIds = new Set(newPlayerBets.map(bet => bet.id));
  const removedPlayerBetIds = previousPlayerBetIds.filter(id => !nextPlayerBetIds.has(id));
  markBetsPending(newPlayerBets.map(bet => bet.id));
  markBetsForDelete(removedPlayerBetIds);
  markSettingsPending();

  saveLocalData("editar apostas utilizador local");
  renderAll();
  toast(`Apostas de ${playerName} guardadas.`);

  saveUserBetsFastToFirebase(playerId, previousPlayerBetIds, newPlayerBets)
    .then(saved => {
      if (saved) {
        setFirebaseStatus("success", `Firebase: apostas de ${playerName} guardadas`);
        return;
      }
      scheduleFullSync("editar apostas utilizador", 800);
      setFirebaseStatus("error", "Firebase: nao ligado - apostas guardadas localmente");
    })
    .catch(error => {
      console.error("Falhou guardar apostas do utilizador no Firebase:", error);
      scheduleFullSync("editar apostas utilizador", 1200);
      setFirebaseStatus("error", `Firebase: erro ao guardar apostas (${shortFirebaseError(error)})`);
    });
}

function clearUserGameRow(button) {
  const row = button.closest("[data-edit-game]");
  if (!row) return;
  row.querySelector(".edit-home-score").value = "";
  row.querySelector(".edit-away-score").value = "";
}

function renderAdmin() {
  const container = $("adminGamesList");
  if (!isAdmin) { container.innerHTML = ""; return; }
  container.innerHTML = games.map(game => `
    <article class="admin-row"><div class="admin-match"><span class="group-pill">${escapeHtml(game.group)}</span><strong>${escapeHtml(game.homeTeam)} vs ${escapeHtml(game.awayTeam)}</strong><small>${timePortugal(game.matchDate)} · ${escapeHtml(dateHeader(game.matchDate))} · ${betsForGame(game.id).length} apostas</small></div>
      <div class="result-inputs modal-result-actions">
        <span class="admin-result-chip">${hasResult(game) ? `Resultado: ${game.homeScore}-${game.awayScore}` : "Sem resultado"}</span>
        <button class="primary" type="button" data-result-game="${escapeHtml(game.id)}">${hasResult(game) ? "Editar resultado" : "Adicionar resultado"}</button>
      </div>
    </article>`).join("");
}

async function saveBet(gameId, homeGuess, awayGuess, playerName = "Manual") {
  const game = games.find(item => item.id === gameId);
  if (!game) return;
  if (isLocked(game)) return toast("Apostas fechadas para este jogo.");
  if (homeGuess === "" || awayGuess === "") return toast("Preenche os dois campos da aposta.");
  const playerId = playerIdFromName(playerName);
  const bet = { id: `${playerId}_${gameId}`, playerId, playerName, gameId, homeGuess: Number(homeGuess), awayGuess: Number(awayGuess), source: "manual", updatedAt: new Date().toISOString() };
  await persistBet(bet);
  renderAll();
  toast("Aposta guardada.");
}
async function setResult(gameId, homeScore, awayScore) {
  if (!canEditResults()) { toast("Sem permissão para editar resultados."); return false; }

  if (homeScore === "" || awayScore === "") {
    toast("Preenche o resultado completo.");
    return false;
  }

  const game = games.find(item => item.id === gameId);
  if (!game) {
    toast("Jogo não encontrado.");
    return false;
  }

  game.homeScore = Number(homeScore);
  game.awayScore = Number(awayScore);
  stampGame(game, "resultado guardado");
  markGamePending(game.id);

  saveLocalData("resultado editado local antes firebase");
  renderAll();
  toast("Resultado guardado. A sincronizar Firebase...");

  persistGame(game).then(() => {
    renderAll();
    toast("Resultado guardado no Firebase.");
  }).catch(error => {
    console.error("Falhou guardar resultado no Firebase:", error);
    markGamePending(game.id);
    saveLocalData("resultado pendente firebase");
    setFirebaseStatus("error", `Firebase: resultado pendente (${shortFirebaseError(error)})`);
    toast("Resultado ficou guardado localmente e será reenviado.");
  });

  return true;
}
async function clearResult(gameId) {
  if (!canEditResults()) { toast("Sem permissão para editar resultados."); return false; }

  const game = games.find(item => item.id === gameId);
  if (!game) return false;

  game.homeScore = null;
  game.awayScore = null;
  stampGame(game, "resultado limpo");
  markGamePending(game.id);

  saveLocalData("resultado limpo local antes firebase");
  renderAll();
  toast("Resultado limpo. A sincronizar Firebase...");

  persistGame(game).then(() => {
    renderAll();
    toast("Resultado limpo no Firebase.");
  }).catch(error => {
    console.error("Falhou limpar resultado no Firebase:", error);
    markGamePending(game.id);
    saveLocalData("limpar resultado pendente firebase");
    setFirebaseStatus("error", `Firebase: limpeza pendente (${shortFirebaseError(error)})`);
    toast("Alteração ficou guardada localmente e será reenviada.");
  });

  return true;
}

function todayGames() { const key = todayKey(); return games.filter(game => dateKey(game.matchDate) === key); }
function scoreText() {
  const rows = leaderboard();
  if (!rows.length) return "⭐ Classificação Mundial 2026\n\nAinda não há apostas importadas.";
  return "⭐ Classificação Mundial 2026\n\n" + rows.map((row, index) => `${index + 1}. ${row.playerName} - ${row.points} pts`).join("\n");
}
function todayText() {
  const list = todayGames();
  if (!list.length) return "⭐ Jogos de Hoje\n\nHoje não há jogos registados.";
  const grouped = [...groupByGroup(list).entries()];
  return "⭐ Jogos de Hoje\n\n" + grouped.map(([group, rows]) => {
    const lines = rows.map(game => `${game.homeTeam} vs ${game.awayTeam} - ${timePortugal(game.matchDate)}`);
    return `${group}\n${lines.join("\n")}`;
  }).join("\n\n");
}
function groupsText() {
  return "⭐ Classificação dos Grupos\n\n" + buildStandings().map(({ group, rows }) => {
    const lines = rows.map((row, index) => `${index + 1}. ${row.team} - ${row.points} pts`);
    return `${group}\n${lines.join("\n")}`;
  }).join("\n\n");
}
function groupByGroup(list) {
  return list.reduce((map, game) => { if (!map.has(game.group)) map.set(game.group, []); map.get(game.group).push(game); return map; }, new Map());
}
async function copyText(text, message) {
  try { await navigator.clipboard.writeText(text); toast(message); }
  catch { window.prompt("Copia o texto:", text); }
}
function toast(message) {
  const element = $("toast");
  element.textContent = message;
  element.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.add("hidden"), 2600);
}

function parseScore(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // formatos aceites: 2-1, 2 - 1, 2:1, 2/1, 2 x 1
  const normal = raw.replace(/[–—]/g, "-").replace(/\s+/g, " ");
  const match = normal.match(/(^|\D)(\d{1,2})\s*(?:-|:|\/|x)\s*(\d{1,2})(\D|$)/i);
  if (!match) return null;

  return [Number(match[2]), Number(match[3])];
}
function splitMatchLabel(label) {
  const raw = String(label || "").trim();
  if (!raw) return null;

  const scoreMatch = raw.match(/\s+(\d+\s*[-–:\/x]\s*\d+)\s*$/i);
  const score = scoreMatch ? parseScore(scoreMatch[1]) : null;
  const cleanLabel = scoreMatch ? raw.slice(0, scoreMatch.index).trim() : raw;

  const directParts = cleanLabel.split(/\s+(?:-|–|—|vs|v\.?|x)\s+/i);
  if (directParts.length >= 2) {
    return { home: canonicalTeam(directParts[0]), away: canonicalTeam(directParts.slice(1).join(" - ")), score };
  }

  // Caso venha sem espaços: "Colômbia-RD Congo"
  const looseParts = cleanLabel.split(/\s*(?:-|–|—)\s*/).filter(Boolean);
  if (looseParts.length >= 2) {
    return { home: canonicalTeam(looseParts[0]), away: canonicalTeam(looseParts.slice(1).join(" - ")), score };
  }

  return null;
}
function findGameMatch(home, away, group = "") {
  const h = normalizeComparable(canonicalTeam(home));
  const a = normalizeComparable(canonicalTeam(away));
  const g = normalizeComparable(group);

  const directWithGroup = games.find(game =>
    normalizeComparable(game.homeTeam) === h &&
    normalizeComparable(game.awayTeam) === a &&
    (!g || normalizeComparable(game.group) === g)
  );
  if (directWithGroup) return { game: directWithGroup, reversed: false };

  const reverseWithGroup = games.find(game =>
    normalizeComparable(game.homeTeam) === a &&
    normalizeComparable(game.awayTeam) === h &&
    (!g || normalizeComparable(game.group) === g)
  );
  if (reverseWithGroup) return { game: reverseWithGroup, reversed: true };

  const directAnyGroup = games.find(game =>
    normalizeComparable(game.homeTeam) === h &&
    normalizeComparable(game.awayTeam) === a
  );
  if (directAnyGroup) return { game: directAnyGroup, reversed: false };

  const reverseAnyGroup = games.find(game =>
    normalizeComparable(game.homeTeam) === a &&
    normalizeComparable(game.awayTeam) === h
  );
  if (reverseAnyGroup) return { game: reverseAnyGroup, reversed: true };

  return null;
}

function findGameByTeams(home, away, group = "") {
  return findGameMatch(home, away, group)?.game || null;
}
async function readWorkbookFile(file) {
  if (!window.XLSX) throw new Error("Biblioteca Excel ainda não carregou. Verifica ligação à internet.");
  const buffer = await file.arrayBuffer();
  if (file.name.toLowerCase().endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(buffer);
    return XLSX.read(text, { type: "string" });
  }
  return XLSX.read(buffer, { type: "array" });
}
function firstSheetRows(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, blankrows: false });
}
function cellText(value) { return String(value ?? "").trim(); }
function findPlayersRow(rows) {
  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r] || [];
    const idx = row.findIndex(cell => normalizeKey(cell) === "jogadores");
    if (idx !== -1) {
      let gameIdCol = -1;
      const players = [];
      for (let c = idx + 1; c < row.length; c += 1) {
        const name = cellText(row[c]);
        const key = normalizeKey(name);
        if (!name) continue;
        if (["id jogo", "id do jogo", "game id", "gameid", "id"].includes(key)) {
          gameIdCol = c;
          continue;
        }
        players.push({ name, col: c });
      }
      return { rowIndex: r, labelCol: idx, gameIdCol, players };
    }
  }
  return null;
}

function setImportStatus(type, title, details = "") {
  const box = $("importStatusBox");
  if (!box) return;

  box.className = `import-status-box ${type}`;
  box.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    ${details ? `<span>${escapeHtml(details)}</span>` : ""}
  `;
}

function importStatusFromResult(result) {
  const betsCount = result?.bets?.length ?? result?.importedBets?.length ?? 0;
  const resultsCount = result?.results?.length ?? 0;
  const usersCount = result?.users?.length ?? result?.players?.length ?? 0;
  const errorsCount = result?.errors?.length ?? 0;

  if (errorsCount > 0 && betsCount === 0 && resultsCount === 0) {
    setImportStatus("error", "Erro ao importar Excel", `${errorsCount} avisos/erros encontrados. Vê os detalhes abaixo.`);
    return;
  }

  if (errorsCount > 0) {
    setImportStatus("warning", "Excel importado com avisos", `${betsCount} apostas · ${usersCount} users · ${errorsCount} avisos.`);
    return;
  }

  setImportStatus("success", "Excel importado com sucesso", `${betsCount} apostas importadas · ${usersCount} users.`);
}

function parseResultadosWorkbookRows(rows) {
  const info = findPlayersRow(rows);
  if (!info) return { bets: [], extras: {}, errors: ["Não encontrei a linha Jogadores no ficheiro Resultados."] };
  const importedBets = [];
  const extras = {};
  const errors = [];
  let currentGroup = "";
  for (let r = info.rowIndex + 1; r < rows.length; r += 1) {
    const row = rows[r] || [];
    const label = cellText(row[info.labelCol]);
    if (!label) continue;
    if (/^grupo\s+/i.test(label)) { currentGroup = label; continue; }
    const labelKey = normalizeKey(label);
    if (labelKey.includes("mvp") || labelKey.includes("melhor marcador") || labelKey.includes("equipa vencedora") || labelKey.includes("campeao") || labelKey.includes("campea")) {
      const field = labelKey.includes("mvp") ? "mvp" : labelKey.includes("melhor marcador") ? "topScorer" : "champion";
      info.players.forEach(player => {
        const value = cellText(row[player.col]);
        if (!value) return;
        if (!extras[player.name]) extras[player.name] = {};
        extras[player.name][field] = value;
      });
      continue;
    }
    const excelGameId = info.gameIdCol >= 0 ? cellText(row[info.gameIdCol]) : "";
    let matchInfo = null;

    if (excelGameId) {
      const gameById = games.find(item => item.id === excelGameId);
      if (gameById) matchInfo = { game: gameById, reversed: false };
    }

    const parsedMatch = splitMatchLabel(label);
    if (!matchInfo && parsedMatch) {
      matchInfo = findGameMatch(parsedMatch.home, parsedMatch.away, currentGroup);
    }

    if (!matchInfo) { errors.push(`Jogo não encontrado: ${currentGroup} · ${label}${excelGameId ? ` · ID: ${excelGameId}` : ""}`); continue; }
    const game = matchInfo.game;
    info.players.forEach(player => {
      const score = parseScore(row[player.col]);
      if (!score) return;
      const finalScore = matchInfo.reversed ? [score[1], score[0]] : score;
      const playerId = playerIdFromName(player.name);
      importedBets.push({ id: `${playerId}_${game.id}`, playerId, playerName: player.name, gameId: game.id, homeGuess: finalScore[0], awayGuess: finalScore[1], source: "Resultados.xlsx", updatedAt: new Date().toISOString() });
    });
  }
  return { bets: importedBets, extras, errors };
}
function parsePontosWorkbookRows(rows) {
  const info = findPlayersRow(rows);
  if (!info) return { results: [], importedPoints: {}, errors: ["Não encontrei a linha Jogadores no ficheiro Pontos."] };
  const results = [];
  const importedPoints = {};
  const errors = [];
  let currentGroup = "";
  info.players.forEach(player => importedPoints[player.name] = 0);
  for (let r = info.rowIndex + 1; r < rows.length; r += 1) {
    const row = rows[r] || [];
    const label = cellText(row[info.labelCol]);
    if (!label) continue;
    if (/^grupo\s+/i.test(label)) { currentGroup = label; continue; }
    const parsedMatch = splitMatchLabel(label);
    if (parsedMatch?.score) {
      const matchInfo = findGameMatch(parsedMatch.home, parsedMatch.away, currentGroup);
      if (matchInfo) {
        const finalScore = matchInfo.reversed ? [parsedMatch.score[1], parsedMatch.score[0]] : parsedMatch.score;
        results.push({ gameId: matchInfo.game.id, homeScore: finalScore[0], awayScore: finalScore[1] });
      }
      else errors.push(`Resultado sem jogo encontrado: ${currentGroup} · ${label}`);
    }
    info.players.forEach(player => {
      const value = Number(String(row[player.col] ?? "").replace(",", "."));
      if (Number.isFinite(value)) importedPoints[player.name] += value;
    });
  }
  return { results, importedPoints, errors };
}
async function previewExcelImport() {
  if (!hasPermission("importExcel")) { toast("Sem permissão."); return; }

  const resultadosFile = $("resultadosExcelInput").files?.[0];
  const pontosFile = $("pontosExcelInput").files?.[0];
  if (!resultadosFile && !pontosFile) { setImportStatus("error", "Nenhum ficheiro selecionado", "Seleciona o Excel Resultados corrigido para importar.");
    toast("Seleciona o Excel Resultados corrigido para importar."); return; }
  const preview = $("excelPreview");
  preview.innerHTML = "A ler ficheiros...";
  const combined = { bets: [], extras: {}, results: [], importedPoints: {}, errors: [] };
  try {
    if (resultadosFile) {
      const workbook = await readWorkbookFile(resultadosFile);
      const parsed = parseResultadosWorkbookRows(firstSheetRows(workbook));
      combined.bets.push(...parsed.bets);
      combined.extras = { ...combined.extras, ...parsed.extras };
      combined.errors.push(...parsed.errors);
    }
    if (pontosFile) {
      const workbook = await readWorkbookFile(pontosFile);
      const parsed = parsePontosWorkbookRows(firstSheetRows(workbook));
      combined.results.push(...parsed.results);
      combined.importedPoints = parsed.importedPoints;
      combined.errors.push(...parsed.errors);
    }
    const players = new Set(combined.bets.map(bet => bet.playerName));
    Object.keys(combined.extras).forEach(name => players.add(name));
    Object.keys(combined.importedPoints).forEach(name => players.add(name));
    pendingExcelImport = combined;
    
  importStatusFromResult(combined);
preview.innerHTML = `
      <div class="preview-grid"><div><strong>${combined.bets.length}</strong><span>apostas lidas</span></div><div><strong>${players.size}</strong><span>users</span></div><div><strong>${combined.results.length}</strong><span>resultados de jogos</span></div><div><strong>${Object.keys(combined.extras).length}</strong><span>extras</span></div></div>
      ${combined.errors.length ? `<details open><summary>${combined.errors.length} avisos — estas linhas não foram importadas</summary><ul>${combined.errors.slice(0, 80).map(err => `<li>${escapeHtml(err)}</li>`).join("")}</ul></details>` : `<p class="ok-line">Sem erros críticos encontrados.</p>`}
    `;
    $("confirmExcelImportBtn").disabled = false;
  } catch (error) {
    console.error(error);
    preview.innerHTML = `<p class="error-line">Erro a ler Excel: ${escapeHtml(error.message || error)}</p>`;
    $("confirmExcelImportBtn").disabled = true;
  }
}
async function confirmExcelImport() {
  if (!hasPermission("importExcel")) { toast("Sem permissão."); return; }

  if (!pendingExcelImport) return toast("Faz primeiro a pré-visualização.");
  const replace = $("replaceExcelBetsInput").checked;
  pendingExcelImport.results.forEach(result => {
    const game = games.find(item => item.id === result.gameId);
    if (!game) return;
    game.homeScore = result.homeScore;
    game.awayScore = result.awayScore;
  });
  appSettings.extraPredictions = { ...(appSettings.extraPredictions || {}), ...(pendingExcelImport.extras || {}) };
  appSettings.importedPoints = pendingExcelImport.importedPoints || appSettings.importedPoints || {};
  const importedUsers = new Set(appSettings.users || []);
  pendingExcelImport.bets.forEach(bet => importedUsers.add(bet.playerName));
  Object.keys(pendingExcelImport.extras || {}).forEach(name => importedUsers.add(name));
  Object.keys(pendingExcelImport.importedPoints || {}).forEach(name => importedUsers.add(name));
  appSettings.users = [...importedUsers].filter(Boolean).sort((a, b) => a.localeCompare(b));
  appSettings.lastImport = { at: new Date().toISOString(), bets: pendingExcelImport.bets.length, players: new Set(pendingExcelImport.bets.map(bet => bet.playerName)).size, results: pendingExcelImport.results.length };
  const importResult = pendingExcelImport;
  await persistAllBets(importResult.bets, replace);
  await persistAllGames();
  await persistSettings();
  importStatusFromResult(importResult);
  pendingExcelImport = null;
  $("excelModal").classList.add("hidden");
  $("confirmExcelImportBtn").disabled = true;
  renderAll();
  setImportStatus("success", "Excel importado e guardado", "As apostas foram gravadas. Podes atualizar a página sem perder os dados.");
  toast("Excel importado. Classificação recalculada.");
}
async function savePointsSettings() {
  if (!hasPermission("editPoints")) { toast("Sem permissão."); return; }

  appSettings.points = {
    exact: Number($("pointsExactInput").value) || 0,
    winner: Number($("pointsWinnerInput")?.value ?? appSettings.points.winner ?? 1) || 0,
    mvp: Number($("pointsMvpInput").value) || 0,
    topScorer: Number($("pointsTopScorerInput").value) || 0,
    champion: Number($("pointsChampionInput").value) || 0
  };
  await persistSettings(); renderAll(); toast("Sistema de pontos atualizado.");
}
async function saveExtraResults() {
  if (!hasPermission("editPoints")) { toast("Sem permissão."); return; }

  appSettings.extraResults = { mvp: $("finalMvpInput").value.trim(), topScorer: $("finalTopScorerInput").value.trim(), champion: $("finalChampionInput").value.trim() };
  await persistSettings(); renderAll(); toast("Resultados especiais guardados.");
}

async function addUser() {
  if (!hasPermission("editUsers")) { toast("Sem permissão."); return; }

  const input = $("newUserNameInput");
  const name = input?.value.trim();
  if (!name) return toast("Escreve o nome do user.");
  const users = new Set(appSettings.users || []);
  users.add(name);
  appSettings.users = [...users].filter(Boolean).sort((a, b) => a.localeCompare(b));
  input.value = "";
  await persistSettings();
  renderAll();
  toast("User adicionado.");
}

async function removeUser(name) {
  if (!hasPermission("editUsers")) { toast("Sem permissão."); return; }

  if (!confirm(`Remover ${name} da lista de users? As apostas importadas não são apagadas.`)) return;
  appSettings.users = (appSettings.users || []).filter(user => user !== name);
  await persistSettings();
  renderAll();
  toast("User removido da lista.");
}

function renderUsers() {
  const el = $("usersList");
  if (!el) return;
  const users = allPlayers();
  if (!users.length) {
    el.innerHTML = `<div class="empty small-empty">Ainda não existem users. Adiciona manualmente ou importa o Excel.</div>`;
    return;
  }
  el.innerHTML = users.map(name => {
    const stats = playerStats(name);
    const isManual = (appSettings.users || []).includes(name);
    return `<div class="user-pill-row">
      <div>
        <strong>${escapeHtml(name)}</strong>
        <small>${stats.points} pts · ${stats.totalBets} apostas${isManual ? " · user manual" : " · via Excel"}</small>
      </div>
      <button class="secondary small" type="button" onclick="window.removeUserFromUI('${escapeHtml(name).replace(/'/g, "\\'")}')">Remover</button>
    </div>`;
  }).join("");
}



function scoreForExport(game, playerName) {
  const playerId = playerIdFromName(playerName);
  const bet = bets.find(item => item.gameId === game.id && item.playerId === playerId);
  if (!bet) return "";
  return `${bet.homeGuess}-${bet.awayGuess}`;
}

function resultLabelForExport(game) {
  const base = `${game.homeTeam} - ${game.awayTeam}`;
  return hasResult(game) ? `${base} ${game.homeScore}-${game.awayScore}` : base;
}

function exportResultadosExcel() {
  if (!window.XLSX) {
    toast("Biblioteca Excel ainda não carregou.");
    return;
  }

  const players = allPlayers();
  const rows = [];

  rows.push(["Mundial 2026 - Resultados / Apostas"]);
  rows.push(["Preenche as apostas no formato 2-1. Não alteres a coluna ID Jogo, ela serve para a app importar sem falhas."]);
  rows.push([]);
  rows.push(["Jogadores", "ID Jogo", ...players]);

  let currentGroup = "";
  games.forEach(game => {
    if (game.group !== currentGroup) {
      currentGroup = game.group;
      rows.push([currentGroup]);
    }

    rows.push([
      resultLabelForExport(game),
      game.id,
      ...players.map(playerName => scoreForExport(game, playerName))
    ]);
  });

  rows.push([]);
  rows.push(["MVP", "", ...players.map(playerName => appSettings.extraPredictions?.[playerName]?.mvp || "")]);
  rows.push(["Melhor Marcador", "", ...players.map(playerName => appSettings.extraPredictions?.[playerName]?.topScorer || "")]);
  rows.push(["Equipa Vencedora", "", ...players.map(playerName => appSettings.extraPredictions?.[playerName]?.champion || "")]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws["!cols"] = [
    { wch: 34 },
    { wch: 18 },
    ...players.map(() => ({ wch: 16 }))
  ];

  // Congelar a linha dos jogadores e a primeira coluna em programas compatíveis.
  ws["!freeze"] = { xSplit: 2, ySplit: 4 };

  XLSX.utils.book_append_sheet(wb, ws, "Resultados");

  const resumo = [
    ["Resumo"],
    ["Users", players.length],
    ["Jogos", games.length],
    ["Apostas importadas", bets.length],
    ["Última exportação", new Date().toLocaleString("pt-PT")]
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
  wsResumo["!cols"] = [{ wch: 22 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  XLSX.writeFile(wb, "Resultados_Mundial_2026.xlsx");
  toast("Excel Resultados exportado.");
}

function exportPontosExcel() {
  if (!window.XLSX) {
    toast("Biblioteca Excel ainda não carregou.");
    return;
  }

  const rows = [
    ["Jogador", "Jogos com resultado", "Resultados exatos", "Pontos jogos", "MVP", "Melhor Marcador", "Equipa Vencedora", "Pontos extras", "Total"]
  ];

  leaderboard().forEach(row => {
    rows.push([
      row.playerName,
      row.settled,
      row.exact,
      row.gamePoints,
      row.mvp,
      row.topScorer,
      row.champion,
      row.extraPoints,
      row.points
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 14 },
    { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 10 }
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Pontos");

  const detailRows = [["Grupo", "Jogo", "Resultado real", "Hora Portugal", "User", "Aposta", "Pontos"]];
  games.forEach(game => {
    betsForGame(game.id).forEach(bet => {
      detailRows.push([
        game.group,
        `${game.homeTeam} - ${game.awayTeam}`,
        hasResult(game) ? `${game.homeScore}-${game.awayScore}` : "",
        timePortugal(game.matchDate),
        bet.playerName,
        `${bet.homeGuess}-${bet.awayGuess}`,
        pointsForBet(bet, game)
      ]);
    });
  });
  const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
  XLSX.utils.book_append_sheet(wb, wsDetail, "Detalhe");

  XLSX.writeFile(wb, "Pontos_Mundial_2026.xlsx");
  toast("Excel Pontos exportado.");
}


function gameBetTypeLabel(bet, game) {
  if (!game || !hasResult(game)) return "Por jogar";
  if (!bet) return "Sem aposta";
  if (typeof isExactBet === "function" && isExactBet(bet, game)) return "Resultado exato";
  if (typeof isOutcomeBet === "function" && isOutcomeBet(bet, game)) {
    return outcome(game.homeScore, game.awayScore) === "draw" ? "Empate certo" : "Vencedor certo";
  }
  return "Falhou";
}

function gameBetTypeClass(bet, game) {
  if (!game || !hasResult(game)) return "pending";
  if (!bet) return "missing";
  if (typeof isExactBet === "function" && isExactBet(bet, game)) return "exact";
  if (typeof isOutcomeBet === "function" && isOutcomeBet(bet, game)) return "winner";
  return "miss";
}

function closeBetsModal() {
  $("betsModal")?.classList.add("hidden");
}


function canEditResults() {
  if (typeof hasPermission === "function") return canEditResults();
  return Boolean(typeof isAdmin !== "undefined" && isAdmin);
}

function resultButtonHtml(game) {
  if (!game || !canEditResults()) return "";
  const label = hasResult(game) ? "Editar resultado" : "Adicionar resultado";
  return `<button class="primary small result-admin-only" type="button" data-result-game="${escapeHtml(game.id)}">${escapeHtml(label)}</button>`;
}

function showGameBets(gameId) {
  const game = games.find(item => item.id === gameId);
  if (!game) return;

  const modal = $("betsModal");
  const title = $("betsModalTitle");
  const subtitle = $("betsModalSubtitle");
  const summary = $("betsGameSummary");
  const body = $("betsModalBody");

  if (!modal || !title || !summary || !body) {
    const rows = betsForGame(gameId).sort((a, b) => a.playerName.localeCompare(b.playerName)).map(bet => `${bet.playerName}: ${bet.homeGuess}-${bet.awayGuess}${hasResult(game) ? ` · ${pointsForBet(bet, game)} pts` : ""}`);
    alert(`${game.homeTeam} vs ${game.awayTeam}\n\n${rows.length ? rows.join("\n") : "Sem apostas para este jogo."}`);
    return;
  }

  const rows = betsForGame(gameId).sort((a, b) =>
    pointsForBet(b, game) - pointsForBet(a, game) ||
    a.playerName.localeCompare(b.playerName, "pt")
  );

  const exactCount = rows.filter(bet => typeof isExactBet === "function" && isExactBet(bet, game)).length;
  const winnerCount = rows.filter(bet => !(typeof isExactBet === "function" && isExactBet(bet, game)) && typeof isOutcomeBet === "function" && isOutcomeBet(bet, game)).length;
  const totalPoints = rows.reduce((sum, bet) => sum + pointsForBet(bet, game), 0);

  title.textContent = `${game.homeTeam} - ${game.awayTeam}`;
  subtitle.textContent = `${game.group} · ${dateHeader(game.matchDate)} · ${timePortugal(game.matchDate)}`;

  summary.innerHTML = `
    <div class="bets-summary-card main">
      <span>Resultado</span>
      <strong>${hasResult(game) ? `${game.homeScore}-${game.awayScore}` : "Por colocar"}</strong>
    </div>
    <div class="bets-summary-card">
      <span>Apostas</span>
      <strong>${rows.length}</strong>
    </div>
    <div class="bets-summary-card">
      <span>Exatos</span>
      <strong>${hasResult(game) ? exactCount : "-"}</strong>
    </div>
    <div class="bets-summary-card">
      <span>Vencedor/empate</span>
      <strong>${hasResult(game) ? winnerCount : "-"}</strong>
    </div>
    <div class="bets-summary-card">
      <span>Pontos</span>
      <strong>${hasResult(game) ? totalPoints : "-"}</strong>
    </div>
  `;

  if (!rows.length) {
    body.innerHTML = `<div class="empty">Ainda não existem apostas importadas para este jogo.</div>`;
  } else {
    body.innerHTML = `
      <div class="bets-list-head">
        <span>Jogador</span>
        <span>Aposta</span>
        <span>Tipo</span>
        <span>Pontos</span>
      </div>
      <div class="bets-list">
        ${rows.map((bet, index) => {
          const points = pointsForBet(bet, game);
          const typeLabel = gameBetTypeLabel(bet, game);
          const typeClass = gameBetTypeClass(bet, game);
          return `
            <article class="bet-user-row ${typeClass}">
              <div class="bet-user-main" data-label="Jogador">
                <span class="bet-position">${index + 1}</span>
                <strong title="${escapeHtml(bet.playerName)}">${escapeHtml(bet.playerName)}</strong>
              </div>
              <div class="bet-score-pill" data-label="Aposta">${bet.homeGuess}-${bet.awayGuess}</div>
              <div class="bet-type-pill" data-label="Tipo">${escapeHtml(typeLabel)}</div>
              <b data-label="Pontos">${hasResult(game) ? points : "-"}</b>
            </article>
          `;
        }).join("")}
      </div>`;
  }

  modal.classList.remove("hidden");
}


function resultImpactPreview(game, homeScore, awayScore) {
  const gameBets = betsForGame(game.id);
  if (homeScore === "" || awayScore === "") {
    return `${gameBets.length} apostas importadas. Mete o resultado para calcular pontos.`;
  }

  const tempGame = { ...game, homeScore: Number(homeScore), awayScore: Number(awayScore) };
  const exact = gameBets.filter(bet => isExactBet(bet, tempGame)).length;
  const winner = gameBets.filter(bet => !isExactBet(bet, tempGame) && isOutcomeBet(bet, tempGame)).length;
  const totalPoints = gameBets.reduce((sum, bet) => sum + pointsForBet(bet, tempGame), 0);

  return `${gameBets.length} apostas · ${exact} resultados exatos · ${winner} vencedor/empate · ${totalPoints} pontos atribuídos`;
}

function updateResultPreview() {
  const gameId = $("resultGameIdInput")?.value;
  const game = games.find(item => item.id === gameId);
  if (!game || !$("resultPointsPreview")) return;

  $("resultPointsPreview").textContent = resultImpactPreview(
    game,
    $("modalHomeScoreInput").value,
    $("modalAwayScoreInput").value
  );
}

function openResultModal(gameId) {
  if (!canEditResults()) { toast("Sem permissão para editar resultados."); return; }

  const game = games.find(item => item.id === gameId);
  if (!game) return;

  $("resultGameIdInput").value = game.id;
  $("resultModalTitle").textContent = hasResult(game) ? "Editar resultado" : "Adicionar resultado";
  $("resultModalSubtitle").textContent = "Ao guardar, a app compara as apostas dos users e recalcula a classificação.";
  $("resultHomeFlag").textContent = "";
  $("resultAwayFlag").textContent = "";
  $("resultHomeTeam").textContent = game.homeTeam;
  $("resultAwayTeam").textContent = game.awayTeam;
  $("resultGroupInput").value = game.group;
  $("resultDateInput").value = `${dateHeader(game.matchDate)} · ${timePortugal(game.matchDate)}`;
  $("modalHomeScoreInput").value = game.homeScore ?? "";
  $("modalAwayScoreInput").value = game.awayScore ?? "";

  updateResultPreview();
  $("resultModal").classList.remove("hidden");
  setTimeout(() => $("modalHomeScoreInput")?.focus(), 80);
}

function closeResultModal() {
  $("resultModal")?.classList.add("hidden");
}

async function saveResultFromModal() {
  if (!canEditResults()) { toast("Sem permissão para editar resultados."); return false; }

  const gameId = $("resultGameIdInput").value;
  const homeScore = $("modalHomeScoreInput").value;
  const awayScore = $("modalAwayScoreInput").value;

  if (homeScore === "" || awayScore === "") {
    toast("Preenche os dois campos do resultado.");
    return;
  }

  const btn = $("saveModalResultBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "A guardar...";
  }

  try {
    const ok = await setResult(gameId, homeScore, awayScore);
    if (ok) closeResultModal();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Guardar resultado";
    }
  }
}

async function clearResultFromModal() {
  if (!canEditResults()) { toast("Sem permissão para editar resultados."); return false; }

  const gameId = $("resultGameIdInput").value;
  if (!gameId) return;

  const btn = $("clearModalResultBtn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "A limpar...";
  }

  try {
    const ok = await clearResult(gameId);
    if (ok) closeResultModal();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Limpar resultado";
    }
  }
}

window.showGameBets = showGameBets;
window.openResultModal = openResultModal;
window.syncFirebaseFull = syncFirebaseFull;
window.saveBetFromUI = id => saveBet(id, $("home_" + id)?.value ?? "", $("away_" + id)?.value ?? "");
window.setResultFromUI = id => setResult(id, $("res_home_" + id).value, $("res_away_" + id).value);
window.clearResultFromUI = id => clearResult(id);


document.addEventListener("click", event => {
  const knockoutOpenButton = event.target.closest("#openKnockoutFromCalendarBtn");
  if (knockoutOpenButton) {
    openKnockoutPage();
    return;
  }

  const koEditButton = event.target.closest("[data-ko-edit]");
  if (koEditButton) {
    openKnockoutEditInAdmin(koEditButton.dataset.koEdit);
    return;
  }

  const koSaveButton = event.target.closest("[data-ko-save]");
  if (koSaveButton) {
    saveKnockoutMatchFromAdmin(koSaveButton.dataset.koSave);
    return;
  }

  const resultButton = event.target.closest("[data-result-game]");
  if (resultButton) {
    if (!canEditResults()) { toast("Sem permissão para adicionar/editar resultados."); return; }
    openResultModal(resultButton.dataset.resultGame);
    return;
  }

  const betsButton = event.target.closest("[data-bets-game]");
  if (betsButton) {
    showGameBets(betsButton.dataset.betsGame);
  }
});

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    if (!permissionTabAllowed(button.dataset.tab)) {
      toast("Sem permissão para abrir esta página.");
      return;
    }
    if (button.dataset.tab === "knockoutTab" && !knockoutAvailable()) {
      toast("Fase Final bloqueada. O Admin pode ativar no painel Admin.");
      return;
    }
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.remove("active"));
    button.classList.add("active");
    $(button.dataset.tab).classList.add("active");
    if (button.dataset.tab === "knockoutTab") renderKnockout();
  });
});
$("unlockAdminBtn").addEventListener("click", () => {
  if ($("adminPinInput").value !== ADMIN_PIN) return toast("PIN errado.");
  isAdmin = true; localStorage.setItem("mundial_admin_unlocked", "1"); renderAll();
});

$("calendarMissingResultsBtn")?.addEventListener("click", () => {
  calendarViewMode = "missing";
  renderCalendar();
  renderCalendarFilterState();
});

$("calendarAllGamesBtn")?.addEventListener("click", () => {
  calendarViewMode = "all";
  renderCalendar();
  renderCalendarFilterState();
});

$("copyScoreBtn").addEventListener("click", () => copyText(scoreText(), "Classificação copiada."));
$("addUserBtn")?.addEventListener("click", addUser);
$("newUserNameInput")?.addEventListener("keydown", event => { if (event.key === "Enter") addUser(); });
$("exportResultadosBtn")?.addEventListener("click", exportResultadosExcel);
$("openExcelModalBtn")?.addEventListener("click", () => { setImportStatus("idle", "Aguardando ficheiro Excel", "Escolhe o Excel Resultados para importar."); $("excelModal").classList.remove("hidden"); });
$("closeExcelModalBtn")?.addEventListener("click", () => $("excelModal").classList.add("hidden"));
$("excelModal")?.addEventListener("click", event => { if (event.target.id === "excelModal") $("excelModal").classList.add("hidden"); });
$("previewExcelBtn")?.addEventListener("click", previewExcelImport);
$("confirmExcelImportBtn")?.addEventListener("click", confirmExcelImport);
$("savePointsSettingsBtn")?.addEventListener("click", savePointsSettings);
$("saveExtraResultsBtn")?.addEventListener("click", saveExtraResults);
$("exportPontosBtn")?.addEventListener("click", exportPontosExcel);
$("saveKnockoutUnlockBtn")?.addEventListener("click", saveKnockoutUnlock);



$("closeBetsModalBtn")?.addEventListener("click", closeBetsModal);
$("betsModal")?.addEventListener("click", event => { if (event.target.id === "betsModal") closeBetsModal(); });
document.addEventListener("keydown", event => { if (event.key === "Escape" && !$("betsModal")?.classList.contains("hidden")) closeBetsModal(); });

$("closeResultModalBtn")?.addEventListener("click", closeResultModal);
$("saveModalResultBtn")?.addEventListener("click", saveResultFromModal);
$("clearModalResultBtn")?.addEventListener("click", clearResultFromModal);
$("modalHomeScoreInput")?.addEventListener("input", updateResultPreview);
$("modalAwayScoreInput")?.addEventListener("input", updateResultPreview);
$("resultModal")?.addEventListener("click", event => { if (event.target.id === "resultModal") closeResultModal(); });
document.addEventListener("keydown", event => { if (event.key === "Escape" && !$("resultModal")?.classList.contains("hidden")) closeResultModal(); });


$("editUserSelect")?.addEventListener("change", event => {
  selectedEditUser = event.target.value;
  renderUserBetsEditor();
});

$("saveUserBetsBtn")?.addEventListener("click", saveEditedUserBets);

document.addEventListener("click", event => {
  const clearBtn = event.target.closest(".clear-user-game-btn");
  if (clearBtn) clearUserGameRow(clearBtn);
});


let deferredInstallPrompt = null;


function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function setupIosAppMode() {
  const hint = $("iosInstallHint");
  if (hint && isIosDevice() && !isStandaloneMode()) {
    hint.classList.remove("hidden");
  }

  // Evita zoom por duplo toque no iPhone.
  let lastTouchEnd = 0;
  document.addEventListener("touchend", event => {
    const now = Date.now();
    if (now - lastTouchEnd <= 320) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });

  // Evita gestos de zoom em iOS quando suportado.
  ["gesturestart", "gesturechange", "gestureend"].forEach(name => {
    document.addEventListener(name, event => event.preventDefault(), { passive: false });
  });

  document.documentElement.classList.toggle("standalone-mode", isStandaloneMode());
  document.documentElement.classList.toggle("ios-device", isIosDevice());
}

function setupPwaInstall() {
  const installBtn = $("installAppBtn");
  if (!installBtn) return;

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installBtn.classList.remove("hidden");
  });

  installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      toast("No Edge: menu ⋯ > Apps > Instalar este site como aplicação.");
      return;
    }

    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installBtn.classList.add("hidden");
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installBtn.classList.add("hidden");
    toast("App instalada.");
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .catch(error => console.warn("Service worker não registado:", error));
  });
}


$("loginBtn")?.addEventListener("click", handleLogin);
$("createAccountBtn")?.addEventListener("click", handleCreateAccount);
$("logoutBtn")?.addEventListener("click", logout);
$("loginPasswordInput")?.addEventListener("keydown", event => { if (event.key === "Enter") handleLogin(); });
$("loginEmailInput")?.addEventListener("keydown", event => { if (event.key === "Enter") handleLogin(); });
$("addPermissionUserBtn")?.addEventListener("click", addPermissionUser);
document.addEventListener("click", event => {
  const saveBtn = event.target.closest("[data-save-permissions]");
  if (saveBtn) savePermissionUser(saveBtn.dataset.savePermissions);
});
document.addEventListener("change", event => {
  const roleSelect = event.target.closest("[data-role-email]");
  if (roleSelect) {
    const email = roleSelect.dataset.roleEmail;
    const card = document.querySelector(`[data-permission-card="${CSS.escape(email)}"]`);
    const isAdminRole = roleSelect.value === "admin";
    card?.querySelectorAll("[data-perm-key]").forEach(input => {
      input.disabled = isAdminRole;
      if (isAdminRole) input.checked = true;
    });
  }
});

window.addEventListener("beforeunload", () => {
  try { saveLocalData("beforeunload"); } catch {}
});

setupRememberedAccount();
setupIosAppMode();
setupPwaInstall();
registerServiceWorker();
await initFirebase();
setupAuthGate();
