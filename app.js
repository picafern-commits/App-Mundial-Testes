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
let realtimeUnsubscribers = [];
let realtimeRenderTimer = null;
let onlineUsersCache = [];
let chatMessagesCache = [];
let chatPinnedMessage = null;
let chatPinnedUnsubscribe = null;
let chatLongPressTimer = null;
let chatActionMessageId = null;
let chatCurrentRoom = localStorage.getItem('mundial_chat_room') || 'general';
let chatReplyTo = null;
let chatTypingUnsubscribe = null;
let chatTypingTimer = null;
let chatSearchTerm = '';
let chatLastNotifiedId = localStorage.getItem('mundial_chat_last_notified_id') || '';
let chatUnsubscribe = null;
let chatOpenedOnce = false;
let chatLastSeenAt = Number(localStorage.getItem('mundial_chat_last_seen_at') || '0');
let presenceIntervalId = null;
let onlineUsersIntervalId = null;

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
const flag = team => FLAGS[team] || "🏳ï¸";
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
  if (parsePortugalDate(game.matchDate).getTime() <= Date.now()) return { text: "A Decorrer", className: "live" };
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



// v114 — Modo económico Firebase oficial.
// Reduz listeners de snapshot trocando onSnapshot permanentes por leitura inicial + polling lento.
const FIRESTORE_ECONOMY_V114 = {
  installed: false,
  pollers: new Set(),
  normalPollMs: 150000,
  chatPollMs: 120000,
  settingsPollMs: 180000
};

function economySnapshotDelayV114(target) {
  try {
    const path = String(
      target?.path ||
      target?._query?.path?.canonicalString?.() ||
      target?._query?.path?.segments?.join?.("/") ||
      target?._path?.canonicalString?.() ||
      ""
    ).toLowerCase();

    if (path.includes("chat")) return FIRESTORE_ECONOMY_V114.chatPollMs;
    if (path.includes("settings") || path.includes("appsettings")) return FIRESTORE_ECONOMY_V114.settingsPollMs;
    if (path.includes("presence")) return 180000;
  } catch {}
  return FIRESTORE_ECONOMY_V114.normalPollMs;
}

function isDocRefV114(target) {
  try {
    if (target?.type === "document") return true;
    if (target?.path && !target?._query) return true;
    const segments = target?._key?.path?.segments || target?._path?.segments || [];
    return Array.isArray(segments) && segments.length > 0 && segments.length % 2 === 0;
  } catch {
    return false;
  }
}

function installFirestoreEconomyModeV114() {
  if (FIRESTORE_ECONOMY_V114.installed) return;
  if (!firebaseApi || typeof firebaseApi.onSnapshot !== "function") return;
  if (typeof firebaseApi.getDoc !== "function" || typeof firebaseApi.getDocs !== "function") return;

  const originalOnSnapshot = firebaseApi.onSnapshot;
  firebaseApi.__originalOnSnapshotV114 = firebaseApi.__originalOnSnapshotV114 || originalOnSnapshot;

  firebaseApi.onSnapshot = function economyOnSnapshotV114(target, ...args) {
    let next = null;
    let errorCb = null;

    for (const arg of args) {
      if (typeof arg === "function" && !next) next = arg;
      else if (typeof arg === "function" && !errorCb) errorCb = arg;
      else if (arg && typeof arg.next === "function") {
        next = arg.next.bind(arg);
        if (typeof arg.error === "function") errorCb = arg.error.bind(arg);
      }
    }

    if (!next) return firebaseApi.__originalOnSnapshotV114.call(this, target, ...args);

    let stopped = false;
    let running = false;
    let timer = null;
    const delay = economySnapshotDelayV114(target);

    const run = async () => {
      if (stopped || running) return;
      running = true;

      try {
        const isDoc = isDocRefV114(target);
        const snap = isDoc ? await firebaseApi.getDoc(target) : await firebaseApi.getDocs(target);
        if (!stopped) next(snap);
      } catch (error) {
        if (typeof errorCb === "function") errorCb(error);
        else console.warn("Firestore económico v114:", error);
      } finally {
        running = false;
        if (!stopped) timer = setTimeout(run, delay);
      }
    };

    timer = setTimeout(run, 300);

    const unsubscribe = () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      FIRESTORE_ECONOMY_V114.pollers.delete(unsubscribe);
    };

    FIRESTORE_ECONOMY_V114.pollers.add(unsubscribe);
    return unsubscribe;
  };

  FIRESTORE_ECONOMY_V114.installed = true;
  console.info("Firestore modo económico v114 ativo.");
}

function stopFirestoreEconomyPollersV114() {
  FIRESTORE_ECONOMY_V114.pollers.forEach(unsub => {
    try { unsub(); } catch {}
  });
  FIRESTORE_ECONOMY_V114.pollers.clear();
}

window.firestoreEconomyInfoV114 = function firestoreEconomyInfoV114() {
  return {
    installed: FIRESTORE_ECONOMY_V114.installed,
    activePollers: FIRESTORE_ECONOMY_V114.pollers.size,
    normalPollMs: FIRESTORE_ECONOMY_V114.normalPollMs,
    chatPollMs: FIRESTORE_ECONOMY_V114.chatPollMs,
    settingsPollMs: FIRESTORE_ECONOMY_V114.settingsPollMs
  };
};

async function initFirebase() {
  setTimeout(installFirestoreEconomyModeV114, 0);
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
    setupRealtimeSync();
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

function cleanupRealtimeSync() {
  realtimeUnsubscribers.forEach(unsubscribe => {
    try { unsubscribe(); } catch {}
  });
  realtimeUnsubscribers = [];
}

function queueRealtimeRender(reason = "firebase realtime") {
  if (realtimeRenderTimer) clearTimeout(realtimeRenderTimer);
  realtimeRenderTimer = setTimeout(() => {
    realtimeRenderTimer = null;
    ensureKnockoutSettings();
    saveLocalData(reason);
    renderAll();
  }, 1200);
}

function setupRealtimeSync() {
  cleanupRealtimeSync();
  if (!db || !firebaseApi || storageMode !== "firebase" || !currentUser) return;

  const { collection, doc, onSnapshot } = firebaseApi;
  if (typeof onSnapshot !== "function") return;

  const keepPendingGameIds = () => new Set(pendingGameIds());
  const keepPendingBetIds = () => new Set(pendingBetIds());
  const keepDeleteBetIds = () => new Set(pendingDeleteBetIds());

  realtimeUnsubscribers.push(onSnapshot(collection(db, "games"), snap => {
    const pending = keepPendingGameIds();
    const localPending = new Map(games.filter(game => pending.has(game.id)).map(game => [game.id, game]));
    const remoteGames = snap.docs.map(item => ({ id: item.id, ...item.data() }));

    games = mergeGamesByNewest(remoteGames, games).map(game =>
      localPending.has(game.id) ? { ...game, ...localPending.get(game.id) } : game
    );
    queueRealtimeRender("firebase realtime jogos");
  }, error => console.warn("Realtime jogos falhou:", error)));

  realtimeUnsubscribers.push(onSnapshot(collection(db, "bets"), snap => {
    const pending = keepPendingBetIds();
    const deleted = keepDeleteBetIds();
    const localPending = new Map(bets.filter(bet => pending.has(bet.id)).map(bet => [bet.id, bet]));
    const remoteBets = normalizeBets(snap.docs.map(item => ({ id: item.id, ...item.data() })));
    const byId = new Map(remoteBets.map(bet => [bet.id, bet]));

    localPending.forEach((bet, id) => byId.set(id, bet));
    deleted.forEach(id => byId.delete(id));
    bets = normalizeBets([...byId.values()]);
    queueRealtimeRender("firebase realtime apostas");
  }, error => console.warn("Realtime apostas falhou:", error)));

  realtimeUnsubscribers.push(onSnapshot(doc(db, "settings", "main"), snap => {
    if (!snap.exists() || hasSettingsPending()) return;
    appSettings = mergeSettings(snap.data() || {});
    queueRealtimeRender("firebase realtime configurações");
  }, error => console.warn("Realtime configurações falhou:", error)));

  realtimeUnsubscribers.push(onSnapshot(doc(db, "users", normalizeEmail(currentUser.email)), async snap => {
    if (!snap.exists()) return;
    const wasPermissionsManager = hasPermission("managePermissions");
    const data = snap.data() || {};
    const configAdmin = isConfiguredAdmin(currentUser.email);
    currentProfile = {
      ...defaultProfileForUser(currentUser),
      ...data,
      uid: currentUser.uid,
      email: normalizeEmail(currentUser.email),
      role: configAdmin ? "admin" : (data.role || "user"),
      active: data.active !== false,
      permissions: {
        ...(data.role === "admin" || configAdmin ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS),
        ...(data.permissions || {})
      }
    };

    if (!currentProfile.active) {
      await updateMyPresence(true);
  await firebaseAuthApi.signOut(firebaseAuth);
      return;
    }

    applyPermissionsToUi();
    if (wasPermissionsManager !== hasPermission("managePermissions")) setupRealtimeSync();
  }, error => console.warn("Realtime perfil falhou:", error)));

  if (hasPermission("managePermissions")) {
    realtimeUnsubscribers.push(onSnapshot(collection(db, "users"), snap => {
      permissionsCache = snap.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() || {}) }))
        .sort((a, b) => normalizeEmail(a.email || a.id).localeCompare(normalizeEmail(b.email || b.id)));
      renderPermissionsUsers();
    }, error => console.warn("Realtime permissoes falhou:", error)));
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
  saveLocalData("guardar configurações local");
  scheduleFullSync("guardar configurações", 300);
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
  let base = [...games];

  if (calendarViewMode === "missing") {
    base = base.filter(game => !hasResult(game));
  }

  if (calendarViewMode === "played") {
    base = base.filter(game => hasResult(game));
  }

  const query = (searchText || "").trim().toLowerCase();
  if (query) {
    base = base.filter(game => `${game.group} ${game.homeTeam} ${game.awayTeam}`.toLowerCase().includes(query));
  }

  const timeValue = game => {
    const value = new Date(game.matchDate || game.date || game.data || game.startTime || "").getTime();
    return Number.isFinite(value) ? value : 0;
  };

  return base.sort((a, b) => {
    const diff = timeValue(a) - timeValue(b);

    // Já jogaram: mais recente para o mais antigo.
    if (calendarViewMode === "played") return -diff;

    // Faltam resultados e Todos os jogos: ordem natural do calendário.
    return diff;
  });
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
  const now = new Date().toISOString();

  return {
    uid: user?.uid || "",
    email,
    name: displayNameFromEmail(email),
    role: admin ? "admin" : "user",
    active: true,
    permissions: admin ? { ...ADMIN_PERMISSIONS } : { ...DEFAULT_PERMISSIONS },
    createdAt: now,
    updatedAt: now
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
  cleanupRealtimeSync();
  $("loginScreen")?.classList.remove("hidden");
  $("appShell")?.classList.add("auth-hidden");
  document.body.classList.remove("knockout-layout-active");
  $("appShell")?.classList.remove("knockout-screen-active");
}

function showAppScreen() {
  $("loginScreen")?.classList.add("hidden");
  $("appShell")?.classList.remove("auth-hidden");
  updateActiveAppSection();
}

function updateActiveAppSection() {
  const activeTabId = document.querySelector(".tab-panel.active")?.id || "calendarTab";
  const isKnockout = activeTabId === "knockoutTab";
  document.body.classList.toggle("knockout-layout-active", isKnockout);
  $("appShell")?.classList.toggle("knockout-screen-active", isKnockout);
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
  const visibleName = String(currentProfile?.name || "").trim() || displayNameFromEmail(currentUser.email) || currentUser.email || "Conta";

  label.textContent = `${visibleName} · ${role}`;
  label.title = currentUser.email || visibleName;
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
      name: String(data.name || fallback.name || "").trim(),
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
    const visibleName = String(user.name || "").trim() || displayNameFromEmail(email);
    const role = user.role === "admin" ? "admin" : "user";
    const isAdminUser = role === "admin";
    const perms = { ...(isAdminUser ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS), ...(user.permissions || {}) };
    const active = user.active !== false;

    return `
      <article class="permission-user-card" data-permission-card="${escapeHtml(email)}">
        <div class="permission-user-head">
          <div>
            <strong>${escapeHtml(visibleName)}</strong>
            <span>${escapeHtml(email)} · ${isAdminUser ? "Admin" : "User normal"} · ${active ? "Ativo" : "Bloqueado"}</span>
          </div>
          <div class="permission-user-actions">
            <label class="permission-name-label">
              Nome visível
              <input class="permission-name-input" type="text" data-name-email="${escapeHtml(email)}" value="${escapeHtml(visibleName)}" placeholder="Nome visível" />
            </label>
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
  const existingProfile = permissionsCache.find(user => normalizeEmail(user.email || user.id) === normalized) || {};

  const role = document.querySelector(`[data-role-email="${CSS.escape(normalized)}"]`)?.value || $("permissionRoleInput")?.value || "user";
  const activeInput = document.querySelector(`[data-active-email="${CSS.escape(normalized)}"]`);
  const active = activeInput ? activeInput.checked : true;
  const isAdminUser = role === "admin";

  const nameInput = document.querySelector(`[data-name-email="${CSS.escape(normalized)}"]`) || $("permissionNameInput");
  const visibleName = String(nameInput?.value || existingProfile.name || displayNameFromEmail(normalized)).trim() || displayNameFromEmail(normalized);

  const permissions = isAdminUser ? { ...ADMIN_PERMISSIONS } : { ...DEFAULT_PERMISSIONS };
  if (card && !isAdminUser) {
    card.querySelectorAll("[data-perm-key]").forEach(input => {
      permissions[input.dataset.permKey] = input.checked;
    });
  }

  const profile = {
    ...existingProfile,
    uid: existingProfile.uid || "",
    email: normalized,
    name: visibleName,
    role,
    active,
    permissions,
    updatedAt: new Date().toISOString()
  };

  if (!profile.createdAt) profile.createdAt = new Date().toISOString();

  const { doc, setDoc } = firebaseApi;
  await withTimeout(setDoc(doc(db, "users", normalized), profile, { merge: true }), 12000, "guardar utilizador");

  if (profile.uid) {
    try {
      await setDoc(doc(db, PRESENCE_COLLECTION, profile.uid), {
        uid: profile.uid,
        email: normalized,
        name: visibleName,
        role,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (presenceError) {
      console.warn("Nome guardado no user, mas não atualizado na presença:", presenceError);
    }
  }

  toast("Utilizador guardado.");
  await loadPermissionsUsers();
  renderPermissionsUsers();

  if (normalizeEmail(currentUser?.email) === normalized) {
    currentProfile = await readUserProfile(currentUser);
    updateSessionBox();
    applyPermissionsToUi();
    updateMyPresence(false).catch(error => console.warn("Atualizar presença após nome falhou:", error));
  }

  loadOnlineUsers().catch(error => console.warn("Atualizar lista online após nome falhou:", error));
}

async function addPermissionUser() {
  const email = normalizeEmail($("permissionEmailInput")?.value);
  if (!email) return toast("Escreve o email do utilizador.");

  await savePermissionUser(email);

  if ($("permissionEmailInput")) $("permissionEmailInput").value = "";
  if ($("permissionNameInput")) $("permissionNameInput").value = "";
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
    if (inAdmin && !hasPermission("editResults")) btn.classList.add("hidden");
  });

  $("openExcelModalBtn")?.classList.toggle("hidden", !hasPermission("importExcel"));
  $("exportResultadosBtn")?.classList.toggle("hidden", !hasPermission("importExcel"));
  $("addUserBtn")?.classList.toggle("hidden", !hasPermission("editUsers"));
  $("savePointsSettingsBtn")?.classList.toggle("hidden", !hasPermission("editPoints"));
  $("saveExtraResultsBtn")?.classList.toggle("hidden", !hasPermission("editPoints"));
  $("saveKnockoutUnlockBtn")?.classList.toggle("hidden", !hasPermission("editKnockout"));
    $("searchAllResultsBtn")?.classList.toggle("hidden", !hasPermission("editResults"));
    document.querySelectorAll(".search-game-result-btn").forEach(btn => btn.classList.toggle("hidden", !hasPermission("editResults")));

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


const PRESENCE_COLLECTION = "presence";
const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const PRESENCE_UPDATE_MS = 180 * 1000;
const ONLINE_USERS_REFRESH_MS = 180 * 1000;

function displayNameFromEmail(email) {
  const value = String(email || "").trim();
  if (!value) return "User";
  const local = value.split("@")[0] || value;
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function deviceLabel() {
  const ua = navigator.userAgent || "";
  if (/iphone|ipad|ipod/i.test(ua)) return "iPhone";
  if (/android/i.test(ua)) return "Android";
  if (/windows/i.test(ua)) return "PC";
  if (/macintosh|mac os/i.test(ua)) return "Mac";
  return "Web";
}

function presenceUserId() {
  return currentUser?.uid || "";
}

function presenceTimestampMs(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") return new Date(value).getTime();
  return 0;
}

function timeAgoLabel(timestamp) {
  const time = presenceTimestampMs(timestamp);
  if (!Number.isFinite(time) || !time) return "sem registo";

  const diff = Math.max(0, Date.now() - time);
  if (diff < 15000) return "agora";
  if (diff < 60000) return `há ${Math.floor(diff / 1000)}s`;
  if (diff < 3600000) return `há ${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `há ${Math.floor(diff / 3600000)} h`;
  return `há ${Math.floor(diff / 86400000)} d`;
}

function isOnlinePresence(user) {
  const time = presenceTimestampMs(user?.lastActiveAt);
  return Number.isFinite(time) && time > 0 && Date.now() - time <= ONLINE_WINDOW_MS;
}

async function updateMyPresence(forceOffline = false) {
  if (!db || !firebaseApi || storageMode !== "firebase" || !currentUser?.email || !presenceUserId()) return false;

  try {
    const { doc, setDoc } = firebaseApi;
    const nowIso = new Date().toISOString();

    await setDoc(doc(db, PRESENCE_COLLECTION, presenceUserId()), {
      uid: presenceUserId(),
      email: normalizeEmail(currentUser.email),
      name: currentProfile?.name || displayNameFromEmail(currentUser.email),
      role: currentProfile?.role || "user",
      online: !forceOffline,
      device: deviceLabel(),
      lastActiveAt: nowIso,
      updatedAt: nowIso
    }, { merge: true });

    return true;
  } catch (error) {
    console.warn("Presença online não atualizada:", error);
    return false;
  }
}

function stopPresenceTracking() {
  if (presenceIntervalId) {
    clearInterval(presenceIntervalId);
    presenceIntervalId = null;
  }
}

function startPresenceTracking() {
  stopPresenceTracking();

  updateMyPresence(false).catch(error => console.warn("Presença inicial falhou:", error));

  presenceIntervalId = setInterval(() => {
    updateMyPresence(false).catch(error => console.warn("Presença periódica falhou:", error));
  }, PRESENCE_UPDATE_MS);
}

function stopOnlineUsersRefresh() {
  if (onlineUsersIntervalId) {
    clearInterval(onlineUsersIntervalId);
    onlineUsersIntervalId = null;
  }
}

function startOnlineUsersRefresh() {
  stopOnlineUsersRefresh();

  loadOnlineUsers().catch(error => console.warn("Users online inicial falhou:", error));

  onlineUsersIntervalId = setInterval(() => {
    loadOnlineUsers().catch(error => console.warn("Users online periódico falhou:", error));
  }, ONLINE_USERS_REFRESH_MS);
}

async function loadOnlineUsers() {
  const list = $("onlineUsersList");
  const badge = $("onlineUsersBadge");

  if (!db || !firebaseApi || storageMode !== "firebase" || !currentUser) {
    if (badge) badge.textContent = "offline";
    if (list) list.innerHTML = `${onlineUsersPopupHeader()}<div class="empty small-empty">Firebase ainda não está ligado.</div>`;
    return;
  }

  try {
    const { collection, getDocs } = firebaseApi;
    const snap = await withTimeout(getDocs(collection(db, PRESENCE_COLLECTION)), 10000, "ler utilizadores online");

    onlineUsersCache = snap.docs
      .map(docSnap => {
        const data = { id: docSnap.id, ...(docSnap.data() || {}) };
        const email = normalizeEmail(data.email || data.id);
        return {
          ...data,
          email,
          name: data.name || displayNameFromEmail(email)
        };
      })
      .sort((a, b) => {
        const ao = isOnlinePresence(a) ? 0 : 1;
        const bo = isOnlinePresence(b) ? 0 : 1;
        if (ao !== bo) return ao - bo;

        const at = presenceTimestampMs(a.lastActiveAt);
        const bt = presenceTimestampMs(b.lastActiveAt);
        if (bt !== at) return bt - at;

        return String(a.email || "").localeCompare(String(b.email || ""), "pt");
      });

    renderOnlineUsers();
  } catch (error) {
    console.warn("Erro ao carregar utilizadores online:", error);
    if (badge) badge.textContent = "sem acesso";
    if (list) {
      list.innerHTML = `${onlineUsersPopupHeader()}
        <div class="empty small-empty">
          Não foi possível carregar os utilizadores online. Confirma as regras da coleção presence no Firebase.
        </div>`;
    }
  }
}


function onlineUsersPopupHeader() {
  return `
    <div class="online-users-popup-head">
      <strong>Utilizadores online</strong>
      <button id="closeOnlineUsersBtn" class="online-users-close" type="button" aria-label="Fechar utilizadores online" onclick="return window.closeOnlineUsersPanelNow(event)">×</button>
    </div>`;
}

function renderOnlineUsers() {
  const list = $("onlineUsersList");
  const badge = $("onlineUsersBadge");
  if (!list) return;

  const onlineCount = onlineUsersCache.filter(isOnlinePresence).length;
  if (badge) badge.textContent = `${onlineCount} online`;

  if (!onlineUsersCache.length) {
    list.innerHTML = `${onlineUsersPopupHeader()}<div class="empty small-empty">Ainda não existem utilizadores com presença registada.</div>`;
    return;
  }

  list.innerHTML = `${onlineUsersPopupHeader()}
    <div class="online-users-table">
      <div class="online-users-row online-users-head">
        <span>User</span>
        <span>Estado</span>
        <span>Última atividade</span>
      </div>
      ${onlineUsersCache.map(user => {
        const online = isOnlinePresence(user);
        const email = normalizeEmail(user.email || user.id);
        const name = user.name || displayNameFromEmail(email);
        return `
          <div class="online-users-row ${online ? "is-online" : "is-offline"}">
            <span class="online-user-name">
              <strong>${escapeHtml(name)}</strong>
              <small>${escapeHtml(user.device || "")}</small>
            </span>
            <span class="online-state">${online ? "Online 🟢" : "Offline ⚪"}</span>
            <span class="online-last">${escapeHtml(timeAgoLabel(user.lastActiveAt))}</span>
          </div>
        `;
      }).join("")}
    </div>`;
}

function startOnlineFeaturesSafe() {
  try {
    startPresenceTracking();
    startOnlineUsersRefresh();
  } catch (error) {
    console.warn("Funcionalidade users online não iniciou:", error);
  }
}

function stopOnlineFeaturesSafe() {
  try {
    updateMyPresence(true).catch(error => console.warn("Marcar offline falhou:", error));
    stopPresenceTracking();
    stopOnlineUsersRefresh();
  } catch (error) {
    console.warn("Funcionalidade users online não parou:", error);
  }
}


const CHAT_COLLECTION = "chatMessages";
const CHAT_LIMIT = 35;

function chatUserName() {
  return String(currentProfile?.name || "").trim() || displayNameFromEmail(currentUser?.email || "") || currentUser?.email || "User";
}

function chatTimestampMs(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") return new Date(value).getTime();
  return 0;
}

function chatTimeLabel(value) {
  const time = chatTimestampMs(value);
  if (!Number.isFinite(time) || !time) return "";
  return new Date(time).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

function chatDateKey(value) {
  const time = chatTimestampMs(value);
  if (!Number.isFinite(time) || !time) return "";
  const date = new Date(time);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function chatDateLabel(value) {
  const time = chatTimestampMs(value);
  if (!Number.isFinite(time) || !time) return "";
  const messageDate = new Date(time);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (chatDateKey(messageDate) === chatDateKey(today)) return "Hoje";
  if (chatDateKey(messageDate) === chatDateKey(yesterday)) return "Ontem";
  return messageDate.toLocaleDateString("pt-PT", { day: "2-digit", month: "short", year: "numeric" });
}

function chatMessageDateValue(message) {
  return message?.createdAt || message?.createdAtLocal || message?.createdAtMillis || 0;
}

function chatParticipantsCount() {
  const names = new Set();
  (appSettings.users || []).forEach(name => {
    const clean = String(name || "").trim();
    if (clean) names.add(clean.toLowerCase());
  });
  (permissionsCache || []).forEach(profile => {
    if (profile?.active === false) return;
    const clean = String(profile?.name || profile?.email || profile?.id || "").trim();
    if (clean) names.add(clean.toLowerCase());
  });
  if (currentProfile?.active !== false) {
    const clean = String(currentProfile?.name || currentProfile?.email || currentUser?.email || "").trim();
    if (clean) names.add(clean.toLowerCase());
  }
  return names.size || 18;
}


function isMobileChatPageMode() {
  return window.matchMedia?.("(max-width: 760px)")?.matches || window.innerWidth <= 760;
}

function setChatMobilePageState(open) {
  document.body.classList.toggle("chat-mobile-page-open", Boolean(open && isMobileChatPageMode()));
  document.body.classList.toggle("chat-window-open", Boolean(open && !isMobileChatPageMode()));
}

function pushChatMobileHistory() {
  if (!isMobileChatPageMode()) return;
  if (window.location.hash === "#chat") return;

  try {
    history.pushState({ chatOpen: true }, "", "#chat");
  } catch {}
}

function closeChatFromHistorySafe() {
  const panel = $("chatPanel");
  if (!panel || panel.classList.contains("hidden")) return;
  window.closeChatPanelNow();
}

if (!window.__chatMobilePagePopBound) {
  window.__chatMobilePagePopBound = true;
  window.addEventListener("popstate", () => {
    if (window.location.hash !== "#chat") closeChatFromHistorySafe();
  });
}

function openChatPanel() {
  const panel = $("chatPanel");
  const input = $("chatInput");
  if (!panel) { document.body.classList.remove("chat-fullscreen-open");
    setChatMobilePageState(false);
    setChatMobilePageState(false); return; }
  panel.classList.remove("hidden");
  setChatMobilePageState(true);
  pushChatMobileHistory();
  document.body.classList.add("chat-fullscreen-open");
  renderChatTabs();
  chatOpenedOnce = true;
  chatLastSeenAt = Date.now();
  localStorage.setItem("mundial_chat_last_seen_at", String(chatLastSeenAt));
  updateChatUnreadBadge();
  chatNotifyNewMessages();
  renderChatPinnedMessage();
  setTimeout(() => { scrollChatToBottom(); input?.focus(); }, 50);
}


window.closeChatPanelNow = function closeChatPanelNow(event) {
  try {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const panel = document.getElementById("chatPanel");
    if (panel) panel.classList.add("hidden");

    document.body.classList.remove("chat-fullscreen-open");

    if (typeof closeChatActionMenu === "function") closeChatActionMenu();
    if (typeof clearChatReply === "function") clearChatReply();
    if (typeof updateChatTyping === "function") updateChatTyping(false);

    const input = document.getElementById("chatInput");
    if (input) input.blur();

    if (window.location.hash === "#chat") {
      try {
        history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch {}
    }
  } catch (error) {
    console.warn("Falhou fechar chat:", error);
    document.body.classList.remove("chat-fullscreen-open");
  }

  return false;
};

function closeChatPanel() {
  window.closeChatPanelNow();
  chatLastSeenAt = Date.now();
  localStorage.setItem("mundial_chat_last_seen_at", String(chatLastSeenAt));
  updateChatUnreadBadge();
}

function scrollChatToBottom() {
  const box = $("chatMessages");
  if (box) box.scrollTop = box.scrollHeight;
}

function updateChatUnreadBadge() {
  const badge = $("chatUnreadBadge");
  if (!badge) return;
  const panelOpen = !$("chatPanel")?.classList.contains("hidden");
  const unread = chatMessagesCache.filter(message => {
    if (message.uid === currentUser?.uid) return false;
    return chatTimestampMs(message.createdAt || message.createdAtLocal) > chatLastSeenAt;
  }).length;
  if (panelOpen || unread <= 0) {
    badge.classList.add("hidden");
    badge.textContent = "0";
  } else {
    badge.classList.remove("hidden");
    badge.textContent = String(Math.min(99, unread));
  }
  chatNotifyNewMessages();
}


const CHAT_SETTINGS_COLLECTION = "chatSettings";

function isChatAdmin() {
  return hasPermission("editResults") || currentProfile?.role === "admin";
}

function canDeleteChatMessage(message) {
  return Boolean(currentUser && (message?.uid === currentUser.uid || isChatAdmin()));
}

function chatNotifyNewMessages() {
  const panelOpen = !$("chatPanel")?.classList.contains("hidden");
  const unread = chatMessagesCache.filter(message => {
    if (message.uid === currentUser?.uid) return false;
    return chatTimestampMs(message.createdAt || message.createdAtLocal) > chatLastSeenAt;
  }).length;

  const button = $("chatOpenBtn");
  if (!button) return;

  button.classList.toggle("has-chat-unread", !panelOpen && unread > 0);
  button.title = unread > 0 ? `${unread} mensagem(ns) nova(s)` : "Chat";
}

function renderChatPinnedMessage() {
  const box = $("chatPinnedBox");
  if (!box) return;

  if (!chatPinnedMessage?.text) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }

  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="chat-pinned-content">
      <div>
        <span>📌 Mensagem fixada</span>
        <strong>${escapeHtml(chatPinnedMessage.name || "Admin")}</strong>
        <p>${escapeHtml(chatPinnedMessage.text || "")}</p>
      </div>
      ${isChatAdmin() ? `<button id="chatUnpinBtn" class="chat-pin-action" type="button">Remover</button>` : ""}
    </div>
  `;

  const unpin = $("chatUnpinBtn");
  if (unpin && unpin.dataset.bound !== "1") {
    unpin.dataset.bound = "1";
    unpin.addEventListener("click", () => unpinChatMessage());
  }
}

async function pinChatMessage(messageId) {
  if (!isChatAdmin()) return toast("Só o Admin pode fixar mensagens.");
  const message = chatMessagesCache.find(item => item.id === messageId);
  if (!message) return toast("Mensagem não encontrada.");
  if (!db || !firebaseApi || storageMode !== "firebase") return toast("Firebase não está ligado.");

  try {
    const { doc, setDoc, serverTimestamp } = firebaseApi;
    await setDoc(doc(db, CHAT_SETTINGS_COLLECTION, `pinned_${chatCurrentRoom}`), {
      messageId,
      text: String(message.text || ""),
      uid: message.uid || "",
      email: message.email || "",
      name: message.name || displayNameFromEmail(message.email || ""),
      pinnedBy: currentUser?.uid || "",
      pinnedByEmail: normalizeEmail(currentUser?.email),
      pinnedAt: typeof serverTimestamp === "function" ? serverTimestamp() : new Date().toISOString(),
      pinnedAtLocal: new Date().toISOString()
    }, { merge: true });
    toast("Mensagem fixada.");
  } catch (error) {
    console.error("Falhou fixar mensagem:", error);
    toast("Não consegui fixar a mensagem.");
  }
}

async function unpinChatMessage() {
  if (!isChatAdmin()) return toast("Só o Admin pode remover a mensagem fixada.");
  if (!db || !firebaseApi || storageMode !== "firebase") return toast("Firebase não está ligado.");

  try {
    const { doc, deleteDoc, setDoc } = firebaseApi;
    if (typeof deleteDoc === "function") {
      await deleteDoc(doc(db, CHAT_SETTINGS_COLLECTION, `pinned_${chatCurrentRoom}`));
    } else {
      await setDoc(doc(db, CHAT_SETTINGS_COLLECTION, `pinned_${chatCurrentRoom}`), { text: "", removedAt: new Date().toISOString() }, { merge: true });
    }
    chatPinnedMessage = null;
    renderChatPinnedMessage();
    toast("Mensagem fixada removida.");
  } catch (error) {
    console.error("Falhou remover fixada:", error);
    toast("Não consegui remover a mensagem fixada.");
  }
}

async function deleteChatMessage(messageId) {
  const message = chatMessagesCache.find(item => item.id === messageId);
  if (!message) return toast("Mensagem nao encontrada.");
  if (!canDeleteChatMessage(message)) return toast("So podes apagar as tuas mensagens.");
  if (!db || !firebaseApi || storageMode !== "firebase") return toast("Firebase nao esta ligado.");

  const beforeDelete = [...chatMessagesCache];
  const collectionName = chatCollectionRef(message.room || chatCurrentRoom);
  chatMessagesCache = chatMessagesCache.filter(item => item.id !== messageId);
  renderChatMessages();
  toast("Mensagem apagada.");

  try {
    const { doc, deleteDoc, updateDoc, serverTimestamp } = firebaseApi;
    const ref = doc(db, collectionName, messageId);

    if (typeof deleteDoc === "function") {
      try {
        await withTimeout(deleteDoc(ref), 4500, "apagar mensagem");
        return;
      } catch (deleteError) {
        console.warn("Delete fisico do chat falhou, vou marcar como apagada:", deleteError);
      }
    }

    if (typeof updateDoc === "function") {
      await withTimeout(updateDoc(ref, {
        deleted: true,
        deletedAt: typeof serverTimestamp === "function" ? serverTimestamp() : new Date().toISOString(),
        deletedAtLocal: new Date().toISOString(),
        deletedBy: currentUser?.uid || "",
        text: "",
        imageData: "",
        replyTo: "",
        replyName: "",
        replyText: "",
        reactions: {}
      }), 4500, "marcar mensagem apagada");
      return;
    }

    throw new Error("Firebase sem deleteDoc/updateDoc");
  } catch (error) {
    console.error("Falhou apagar mensagem:", error);
    chatMessagesCache = beforeDelete;
    renderChatMessages();
    toast("Nao consegui apagar a mensagem. Confirma as regras Firebase.");
  }
}

function closeChatActionMenu() {
  const menu = $("chatActionMenu");
  if (!menu) return;
  menu.classList.add("hidden");
  chatActionMessageId = null;
  document.querySelectorAll(".chat-message-row.is-selected").forEach(row => row.classList.remove("is-selected"));
}

function openChatActionMenu(messageId, anchorEvent) {
  const menu = $("chatActionMenu");
  const pinBtn = $("chatActionPinBtn");
  const deleteBtn = $("chatActionDeleteBtn");
  const replyBtn = $("chatActionReplyBtn");
  const reactionBar = $("chatReactionBar");
  const message = chatMessagesCache.find(item => item.id === messageId);

  if (!menu || !message) return;

  const system = isSystemChatMessage(message);
  const canPin = isChatAdmin() && !system;
  const canDelete = canDeleteChatMessage(message);
  const canReply = !system;
  const canReact = !system;

  if (!canPin && !canDelete && !canReply && !canReact) return;

  chatActionMessageId = messageId;

  document.querySelectorAll(".chat-message-row.is-selected").forEach(row => row.classList.remove("is-selected"));
  document.querySelector(`[data-chat-message="${CSS.escape(messageId)}"]`)?.closest(".chat-message-row")?.classList.add("is-selected");

  if (pinBtn) pinBtn.classList.toggle("hidden", !canPin);
  if (deleteBtn) deleteBtn.classList.toggle("hidden", !canDelete);
  if (replyBtn) replyBtn.classList.toggle("hidden", !canReply);
  if (reactionBar) reactionBar.classList.toggle("hidden", !canReact);

  const panel = $("chatPanel");
  const panelRect = panel?.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  let x = anchorEvent?.clientX || 0;
  let y = anchorEvent?.clientY || 0;

  if ((!x || !y) && anchorEvent?.target) {
    const rect = anchorEvent.target.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top + rect.height / 2;
  }

  menu.classList.remove("hidden");
  const menuRect = menu.getBoundingClientRect();
  const width = menuRect.width || 260;
  const height = menuRect.height || 90;

  let left = Math.min(Math.max(10, x - width / 2), viewportWidth - width - 10);
  let top = Math.min(Math.max(10, y - height - 12), viewportHeight - height - 10);

  if (panelRect) {
    left = Math.min(Math.max(panelRect.left + 10, left), panelRect.right - width - 10);
    top = Math.min(Math.max(panelRect.top + 10, top), panelRect.bottom - height - 10);
  }

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function fireChatLongPress(messageId, event) {
  if (!messageId) return;
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  if (navigator.vibrate) {
    try { navigator.vibrate(15); } catch {}
  }
  openChatActionMenu(messageId, event);
}

function setupChatMessageActions() {
  const box = $("chatMessages");
  const pinBtn = $("chatActionPinBtn");
  const deleteBtn = $("chatActionDeleteBtn");
  const replyBtn = $("chatActionReplyBtn");
  const reactionBar = $("chatReactionBar");

  if (!box || box.dataset.actionsBound === "1") return;

  box.dataset.actionsBound = "1";

  const clearTimer = () => {
    if (chatLongPressTimer) {
      clearTimeout(chatLongPressTimer);
      chatLongPressTimer = null;
    }
  };

  const messageIdFromEvent = event => event.target.closest?.("[data-chat-message]")?.dataset.chatMessage || "";

  box.addEventListener("pointerdown", event => {
    if (event.pointerType && event.pointerType !== "touch" && event.pointerType !== "pen") return;
    if (event.target.closest?.(".chat-image-button,[data-chat-image-src]")) return;
    const messageId = messageIdFromEvent(event);
    if (!messageId) return;
    clearTimer();
    chatLongPressTimer = setTimeout(() => fireChatLongPress(messageId, event), 520);
  });

  box.addEventListener("pointerup", clearTimer);
  box.addEventListener("pointerleave", clearTimer);
  box.addEventListener("pointercancel", clearTimer);
  box.addEventListener("scroll", clearTimer, { passive: true });

  box.addEventListener("contextmenu", event => {
    const messageId = messageIdFromEvent(event);
    if (!messageId) return;
    event.preventDefault();
    openChatActionMenu(messageId, event);
  });

  replyBtn?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    const id = chatActionMessageId;
    closeChatActionMenu();
    if (id) setChatReply(id);
  });

  pinBtn?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    const id = chatActionMessageId;
    closeChatActionMenu();
    if (id) pinChatMessage(id);
  });

  deleteBtn?.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    const id = chatActionMessageId;
    closeChatActionMenu();
    if (id) deleteChatMessage(id);
  });

  reactionBar?.addEventListener("click", event => {
    const btn = event.target.closest?.("[data-chat-reaction]");
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    const id = chatActionMessageId;
    const emoji = btn.dataset.chatReaction;
    closeChatActionMenu();
    if (id && emoji) reactToChatMessage(id, emoji);
  });

  document.addEventListener("click", event => {
    const activeMenu = $("chatActionMenu");
    if (!activeMenu || activeMenu.classList.contains("hidden")) return;
    if (activeMenu.contains(event.target)) return;
    if (event.target.closest?.("[data-chat-message]")) return;
    closeChatActionMenu();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeChatActionMenu();
  });
}

async function loadPinnedChatOnce() {
  if (!db || !firebaseApi || storageMode !== "firebase" || !currentUser) return;

  try {
    const { doc, getDoc } = firebaseApi;
    const snap = await withTimeout(getDoc(doc(db, CHAT_SETTINGS_COLLECTION, `pinned_${chatCurrentRoom}`)), 10000, "ler mensagem fixada");
    chatPinnedMessage = snap.exists() ? (snap.data() || null) : null;
    renderChatPinnedMessage();
  } catch (error) {
    console.warn("Mensagem fixada não carregou:", error);
  }
}

function startPinnedChatListenerSafe() {
  if (!db || !firebaseApi || storageMode !== "firebase" || !currentUser) return;
  if (chatPinnedUnsubscribe) return;

  try {
    const { doc, onSnapshot } = firebaseApi;
    if (typeof onSnapshot !== "function") {
      loadPinnedChatOnce();
      return;
    }

    chatPinnedUnsubscribe = onSnapshot(doc(db, CHAT_SETTINGS_COLLECTION, `pinned_${chatCurrentRoom}`), snap => {
      chatPinnedMessage = snap.exists() ? (snap.data() || null) : null;
      renderChatPinnedMessage();
    }, error => {
      console.warn("Listener da mensagem fixada falhou:", error);
      chatPinnedUnsubscribe = null;
      loadPinnedChatOnce();
    });
  } catch (error) {
    console.warn("Listener da mensagem fixada não iniciou:", error);
    loadPinnedChatOnce();
  }
}

function stopPinnedChatListenerSafe() {
  try {
    if (typeof chatPinnedUnsubscribe === "function") chatPinnedUnsubscribe();
  } catch (error) {
    console.warn("Erro a parar mensagem fixada:", error);
  }
  chatPinnedUnsubscribe = null;
}


function chatRoomLabel(room = chatCurrentRoom) {
  return room === "admin" ? "Chat Admin" : "Chat Geral";
}

function canUseChatRoom(room = chatCurrentRoom) {
  return room !== "admin" || isChatAdmin();
}

function chatCollectionRef(room = chatCurrentRoom) {
  return room === "admin" ? "chatAdminMessages" : CHAT_COLLECTION;
}

function chatTypingDocId(room = chatCurrentRoom) {
  return `${room}_${currentUser?.uid || "anon"}`;
}

function chatSystemName() {
  return "Sistema Mundial";
}

function isSystemChatMessage(message) {
  return message?.type === "system";
}

function chatMessageMatchesSearch(message) {
  if (message?.deleted || message?.deletedAt) return false;
  const term = chatSearchTerm.trim().toLowerCase();
  if (!term) return true;
  return [
    message.text,
    message.name,
    message.email,
    message.replyName,
    message.replyText
  ].some(value => String(value || "").toLowerCase().includes(term));
}

function chatImageMarkup(message) {
  if (!message.imageData) return "";
  const src = escapeHtml(message.imageData);
  return `
    <button type="button" class="chat-image-button" data-chat-image-src="${src}" aria-label="Abrir imagem do chat">
      <img class="chat-image" src="${src}" alt="Imagem enviada no chat" loading="lazy" />
    </button>`;
}

function chatReactionsMarkup(message) {
  const reactions = message.reactions || {};
  const groups = {};
  Object.values(reactions).forEach(emoji => {
    if (!emoji) return;
    groups[emoji] = (groups[emoji] || 0) + 1;
  });
  const entries = Object.entries(groups);
  if (!entries.length) return "";
  return `<div class="chat-reactions">${entries.map(([emoji, count]) => `<span>${escapeHtml(emoji)}${count > 1 ? ` ${count}` : ""}</span>`).join("")}</div>`;
}

function chatReplyMarkup(message) {
  if (!message.replyTo && !message.replyText) return "";
  return `
    <div class="chat-reply-card">
      <strong>${escapeHtml(message.replyName || "Mensagem")}</strong>
      <p>${escapeHtml(message.replyText || "")}</p>
    </div>`;
}

function chatMessageMetaMarkup(message, mine) {
  const time = chatTimeLabel(chatMessageDateValue(message));
  const status = message.failed ? "erro" : (message.pending ? "a enviar" : (mine ? "✓✓" : ""));
  const statusClass = message.failed ? " failed" : (message.pending ? " pending" : "");
  return `
    <span class="chat-message-meta${statusClass}">
      <span>${escapeHtml(time)}</span>
      ${status ? `<span class="chat-message-status">${escapeHtml(status)}</span>` : ""}
    </span>`;
}

function setChatReply(messageId) {
  const message = chatMessagesCache.find(item => item.id === messageId);
  if (!message) return;
  chatReplyTo = {
    id: message.id,
    name: message.name || displayNameFromEmail(message.email || "") || chatSystemName(),
    text: String(message.text || (message.imageData ? "Imagem" : "")).slice(0, 120)
  };
  renderChatReplyPreview();
  $("chatInput")?.focus();
}

function clearChatReply() {
  chatReplyTo = null;
  renderChatReplyPreview();
}

function renderChatReplyPreview() {
  const box = $("chatReplyPreview");
  if (!box) return;
  if (!chatReplyTo) {
    box.classList.add("hidden");
    $("chatReplyName") && ($("chatReplyName").textContent = "");
    $("chatReplyText") && ($("chatReplyText").textContent = "");
    return;
  }
  box.classList.remove("hidden");
  $("chatReplyName") && ($("chatReplyName").textContent = chatReplyTo.name || "");
  $("chatReplyText") && ($("chatReplyText").textContent = chatReplyTo.text || "");
}

async function reactToChatMessage(messageId, emoji) {
  const message = chatMessagesCache.find(item => item.id === messageId);
  if (!message || !currentUser) return;
  if (!db || !firebaseApi || storageMode !== "firebase") return toast("Firebase não está ligado.");

  try {
    const { doc, updateDoc } = firebaseApi;
    if (typeof updateDoc !== "function") return toast("Esta versão do Firebase não permite reações.");
    const next = { ...(message.reactions || {}) };
    if (next[currentUser.uid] === emoji) delete next[currentUser.uid];
    else next[currentUser.uid] = emoji;
    await updateDoc(doc(db, chatCollectionRef(message.room || chatCurrentRoom), messageId), { reactions: next });
  } catch (error) {
    console.error("Falhou reação:", error);
    toast("Não consegui guardar a reação.");
  }
}

function setChatRoom(room) {
  if (room === "admin" && !isChatAdmin()) {
    toast("Só Admin pode usar o chat Admin.");
    room = "general";
  }
  if (chatCurrentRoom === room) return;
  chatCurrentRoom = room;
  localStorage.setItem("mundial_chat_room", chatCurrentRoom);
  chatMessagesCache = [];
  clearChatReply();
  closeChatActionMenu();
  stopChatListenerSafe();
  startChatListenerSafe();
  stopPinnedChatListenerSafe();
  startPinnedChatListenerSafe();
  stopChatTypingListenerSafe();
  startChatTypingListenerSafe();
  renderChatTabs();
  renderChatMessages();
}

function renderChatTabs() {
  $("chatGeneralTab")?.classList.toggle("active", chatCurrentRoom === "general");
  $("chatAdminTab")?.classList.toggle("active", chatCurrentRoom === "admin");
  $("chatAdminTab")?.classList.toggle("hidden", !isChatAdmin());
  const subtitle = $("chatSubtitle");
  if (subtitle) {
    subtitle.textContent = chatCurrentRoom === "admin"
      ? "Conversa privada dos admins"
      : `Grupo geral - ${chatParticipantsCount()} participantes`;
  }
}

async function sendSystemChatMessage(text, room = "general") {
  if (!db || !firebaseApi || storageMode !== "firebase") return;
  if (room === "admin" && !isChatAdmin()) return;
  try {
    const { collection, addDoc, serverTimestamp } = firebaseApi;
    await addDoc(collection(db, chatCollectionRef(room)), {
      uid: "system",
      email: "",
      name: chatSystemName(),
      text: String(text || "").slice(0, 500),
      type: "system",
      room,
      createdAt: typeof serverTimestamp === "function" ? serverTimestamp() : new Date().toISOString(),
      createdAtLocal: new Date().toISOString()
    });
  } catch (error) {
    console.warn("Mensagem automática não enviada:", error);
  }
}

function playChatNotification(message) {
  if (!message || message.uid === currentUser?.uid || isSystemChatMessage(message)) return;
  if (message.id === chatLastNotifiedId) return;
  chatLastNotifiedId = message.id;
  localStorage.setItem("mundial_chat_last_notified_id", message.id || "");

  if (navigator.vibrate) {
    try { navigator.vibrate(25); } catch {}
  }

  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = 660;
    gain.gain.value = 0.035;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      audioCtx.close?.();
    }, 90);
  } catch {}
}

function renderTypingBox(names = []) {
  const box = $("chatTypingBox");
  if (!box) return;
  const clean = names.filter(Boolean).slice(0, 3);
  if (!clean.length) {
    box.classList.add("hidden");
    box.textContent = "";
    return;
  }
  box.classList.remove("hidden");
  box.textContent = clean.length === 1 ? `${clean[0]} está a escrever...` : `${clean.join(", ")} estão a escrever...`;
}

async function updateChatTyping(isTyping) {
  if (!db || !firebaseApi || storageMode !== "firebase" || !currentUser) return;
  try {
    const { doc, setDoc } = firebaseApi;
    await setDoc(doc(db, "chatTyping", chatTypingDocId()), {
      uid: currentUser.uid,
      email: normalizeEmail(currentUser.email),
      name: chatUserName(),
      room: chatCurrentRoom,
      typing: Boolean(isTyping),
      updatedAt: Date.now()
    }, { merge: true });
  } catch (error) {
    console.warn("Typing não atualizado:", error);
  }
}

function startChatTypingListenerSafe() {
  if (!db || !firebaseApi || storageMode !== "firebase" || !currentUser) return;
  if (chatTypingUnsubscribe) return;
  try {
    const { collection, query, onSnapshot } = firebaseApi;
    if (typeof onSnapshot !== "function") return;
    const q = query(collection(db, "chatTyping"));
    chatTypingUnsubscribe = onSnapshot(q, snap => {
      const now = Date.now();
      const names = snap.docs
        .map(docSnap => docSnap.data() || {})
        .filter(item => item.room === chatCurrentRoom && item.typing && item.uid !== currentUser.uid && now - Number(item.updatedAt || 0) < 5000)
        .map(item => item.name || displayNameFromEmail(item.email || ""));
      renderTypingBox(names);
    }, error => {
      console.warn("Typing listener falhou:", error);
      chatTypingUnsubscribe = null;
    });
  } catch (error) {
    console.warn("Typing listener não iniciou:", error);
  }
}

function stopChatTypingListenerSafe() {
  try {
    if (typeof chatTypingUnsubscribe === "function") chatTypingUnsubscribe();
  } catch {}
  chatTypingUnsubscribe = null;
  renderTypingBox([]);
}


function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Falha a ler imagem"));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha a carregar imagem"));
    img.src = src;
  });
}

async function compressChatImage(file) {
  const originalDataUrl = await readFileAsDataURL(file);
  const img = await loadImageElement(originalDataUrl);

  let width = img.naturalWidth || img.width || 0;
  let height = img.naturalHeight || img.height || 0;

  if (!width || !height) return originalDataUrl;

  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return originalDataUrl;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const maxLength = 650000; // margem segura para Firestore
  let quality = 0.88;
  let result = canvas.toDataURL("image/jpeg", quality);

  while (result.length > maxLength && quality > 0.45) {
    quality -= 0.08;
    result = canvas.toDataURL("image/jpeg", quality);
  }

  while (result.length > maxLength && width > 700 && height > 700) {
    width = Math.round(width * 0.85);
    height = Math.round(height * 0.85);
    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    quality = Math.max(0.62, quality);
    result = canvas.toDataURL("image/jpeg", quality);
  }

  if (result.length > maxLength) {
    throw new Error("Imagem demasiado grande para o chat");
  }

  return result;
}

async function sendChatImage(file) {
  if (!file) return;
  if (!file.type?.startsWith("image/")) return toast("Escolhe uma imagem.");
  if (file.size > 8 * 1024 * 1024) return toast("Imagem demasiado grande. Usa uma imagem até 8 MB.");

  try {
    toast("A preparar imagem...");
    const data = await compressChatImage(file);
    await sendChatMessage("", data);
  } catch (error) {
    console.error("Falhou enviar imagem do chat:", error);
    toast("Não consegui enviar a imagem.");
  }
}

function renderChatMessages() {
  const box = $("chatMessages");
  if (!box) return;
  renderChatTabs();

  if (!currentUser) {
    box.innerHTML = `<div class="empty small-empty">Faz login para usar o chat.</div>`;
    return;
  }

  const visibleMessages = chatMessagesCache.filter(chatMessageMatchesSearch);

  if (!visibleMessages.length) {
    box.innerHTML = `<div class="empty small-empty">${chatSearchTerm ? "Nenhuma mensagem encontrada." : "Ainda não há mensagens. Escreve a primeira 🙂"}</div>`;
    updateChatUnreadBadge();
    chatNotifyNewMessages();
    renderChatPinnedMessage();
    return;
  }

  const stick = box.scrollHeight - box.scrollTop - box.clientHeight < 90;

  let lastDateKey = "";

  box.innerHTML = visibleMessages.map(message => {
    const mine = message.uid === currentUser?.uid;
    const system = isSystemChatMessage(message);
    const name = message.name || displayNameFromEmail(message.email || "");
    const dateValue = chatMessageDateValue(message);
    const currentDateKey = chatDateKey(dateValue);
    const dateSeparator = currentDateKey && currentDateKey !== lastDateKey
      ? `<div class="chat-date-separator"><span>${escapeHtml(chatDateLabel(dateValue))}</span></div>`
      : "";
    if (currentDateKey) lastDateKey = currentDateKey;

    if (system) {
      return `${dateSeparator}
        <div class="chat-message-row system" data-chat-message="${escapeHtml(message.id)}">
          <div class="chat-bubble system-bubble" data-chat-message="${escapeHtml(message.id)}">
            <p>${escapeHtml(String(message.text || ""))}</p>
            ${chatMessageMetaMarkup(message, false)}
          </div>
        </div>`;
    }

    return `${dateSeparator}
      <div class="chat-message-row ${mine ? "mine" : "theirs"} ${message.pending ? "is-pending" : ""} ${message.failed ? "is-failed" : ""}" data-chat-message="${escapeHtml(message.id)}">
        <div class="chat-bubble" data-chat-message="${escapeHtml(message.id)}">
          ${mine ? "" : `<strong>${escapeHtml(name)}</strong>`}
          ${chatReplyMarkup(message)}
          ${message.text ? `<p>${escapeHtml(String(message.text || ""))}</p>` : ""}
          ${chatImageMarkup(message)}
          ${chatMessageMetaMarkup(message, mine)}
          ${chatReactionsMarkup(message)}
        </div>
      </div>`;
  }).join("");

  setupChatMessageActions();
  setupChatCloseButtonSafe();

  if (stick || !chatOpenedOnce) scrollChatToBottom();
  updateChatUnreadBadge();
  chatNotifyNewMessages();
  renderChatPinnedMessage();
}

async function loadChatMessagesOnce() {
  if (!db || !firebaseApi || storageMode !== "firebase" || !currentUser) return;
  if (!canUseChatRoom()) return;

  try {
    const { collection, getDocs, query, orderBy, limit, limitToLast } = firebaseApi;
    const limiter = typeof limitToLast === "function" ? limitToLast : limit;
    const q = query(collection(db, chatCollectionRef()), orderBy("createdAt", "asc"), limiter(CHAT_LIMIT));
    const snap = await withTimeout(getDocs(q), 10000, "ler chat");
    chatMessagesCache = snap.docs.map(docSnap => ({ id: docSnap.id, room: chatCurrentRoom, ...(docSnap.data() || {}) }));
    renderChatMessages();
  } catch (error) {
    console.warn("Chat não carregou:", error);
    const box = $("chatMessages");
    if (box) box.innerHTML = `<div class="empty small-empty">Não foi possível carregar o chat. Confirma as regras Firebase.</div>`;
  }
}

function startChatListenerSafe() {
  const chatBtn = $("chatOpenBtn");
  const chatPanel = $("chatPanel");
  const chatVisible = chatBtn && !chatBtn.classList.contains("hidden") && chatBtn.style.display !== "none";
  const chatOpen = chatPanel && !chatPanel.classList.contains("hidden");

  if (!chatVisible && !chatOpen) {
    stopChatListenerSafe();
    return;
  }

  if (!db || !firebaseApi || storageMode !== "firebase" || !currentUser) return;
  if (!canUseChatRoom()) return;
  if (chatUnsubscribe) return;

  try {
    const { collection, query, orderBy, limit, limitToLast, onSnapshot } = firebaseApi;
    if (typeof onSnapshot !== "function") {
      loadChatMessagesOnce();
      return;
    }

    const limiter = typeof limitToLast === "function" ? limitToLast : limit;
    const q = query(collection(db, chatCollectionRef()), orderBy("createdAt", "asc"), limiter(CHAT_LIMIT));
    chatUnsubscribe = onSnapshot(q, snap => {
      const previousLast = chatMessagesCache.at?.(-1)?.id || "";
      chatMessagesCache = snap.docs.map(docSnap => ({ id: docSnap.id, room: chatCurrentRoom, ...(docSnap.data() || {}) }));
      renderChatMessages();
      const latest = chatMessagesCache.at?.(-1);
      const panelOpen = !$("chatPanel")?.classList.contains("hidden");
      if (latest && latest.id !== previousLast && !panelOpen) playChatNotification(latest);
    }, error => {
      console.warn("Chat em tempo real falhou:", error);
      chatUnsubscribe = null;
      loadChatMessagesOnce();
    });
  } catch (error) {
    console.warn("Listener do chat não iniciou:", error);
    loadChatMessagesOnce();
  }
}

function stopChatListenerSafe() {
  try { if (typeof chatUnsubscribe === "function") chatUnsubscribe(); } catch (error) { console.warn("Erro a parar chat:", error); }
  chatUnsubscribe = null;
}

async function sendChatMessage(text, imageData = "") {
  const clean = String(text || "").trim();
  const image = String(imageData || "");
  if (!clean && !image) return;
  if (!currentUser) return toast("Faz login para escrever no chat.");
  if (!canUseChatRoom()) return toast("Nao tens acesso a este chat.");
  if (!db || !firebaseApi || storageMode !== "firebase") return toast("Firebase nao esta ligado.");

  const now = Date.now();
  const optimisticId = `local_${now}_${Math.random().toString(36).slice(2)}`;
  const baseMessage = {
    uid: currentUser.uid,
    email: normalizeEmail(currentUser.email),
    name: chatUserName(),
    text: clean.slice(0, 500),
    imageData: image,
    replyTo: chatReplyTo?.id || "",
    replyName: chatReplyTo?.name || "",
    replyText: chatReplyTo?.text || "",
    reactions: {},
    room: chatCurrentRoom,
    createdAtLocal: new Date(now).toISOString(),
    createdAtMillis: now
  };

  chatMessagesCache = [...chatMessagesCache, { id: optimisticId, pending: true, ...baseMessage }].slice(-CHAT_LIMIT);
  clearChatReply();
  renderChatMessages();
  setTimeout(scrollChatToBottom, 20);

  try {
    const { collection, addDoc, serverTimestamp } = firebaseApi;
    await addDoc(collection(db, chatCollectionRef()), {
      ...baseMessage,
      createdAt: typeof serverTimestamp === "function" ? serverTimestamp() : new Date().toISOString()
    });
    chatMessagesCache = chatMessagesCache.filter(message => message.id !== optimisticId);
    renderChatMessages();
    updateChatTyping(false);
  } catch (error) {
    console.error("Falhou enviar mensagem:", error);
    chatMessagesCache = chatMessagesCache.map(message => (
      message.id === optimisticId ? { ...message, pending: false, failed: true } : message
    ));
    renderChatMessages();
    toast("Nao consegui enviar a mensagem.");
  }
}

function setupChatCloseButtonSafe() {
  const closeBtn = $("chatCloseBtn");
  if (!closeBtn || closeBtn.dataset.closeFixBound === "1") return;

  closeBtn.dataset.closeFixBound = "1";
  closeBtn.addEventListener("click", event => window.closeChatPanelNow(event));
  closeBtn.addEventListener("pointerup", event => window.closeChatPanelNow(event));
  closeBtn.addEventListener("touchend", event => window.closeChatPanelNow(event), { passive: false });
}

function setupChatUi() {
  const openBtn = $("chatOpenBtn");
  const closeBtn = $("chatCloseBtn");
  const form = $("chatForm");
  const input = $("chatInput");
  const imageBtn = $("chatImageBtn");
  const imageInput = $("chatImageInput");
  const replyCancel = $("chatReplyCancelBtn");
  const searchInput = $("chatSearchInput");
  const generalTab = $("chatGeneralTab");
  const adminTab = $("chatAdminTab");

  setupChatMessageActions();
  renderChatTabs();

  if (openBtn && openBtn.dataset.bound !== "1") {
    openBtn.dataset.bound = "1";
    openBtn.addEventListener("click", () => openChatPanel());
  }

  if (closeBtn && closeBtn.dataset.bound !== "1") {
    closeBtn.dataset.bound = "1";
    closeBtn.addEventListener("click", () => closeChatPanel());
  }

  if (generalTab && generalTab.dataset.bound !== "1") {
    generalTab.dataset.bound = "1";
    generalTab.addEventListener("click", () => setChatRoom("general"));
  }

  if (adminTab && adminTab.dataset.bound !== "1") {
    adminTab.dataset.bound = "1";
    adminTab.addEventListener("click", () => setChatRoom("admin"));
  }

  if (replyCancel && replyCancel.dataset.bound !== "1") {
    replyCancel.dataset.bound = "1";
    replyCancel.addEventListener("click", clearChatReply);
  }

  if (searchInput && searchInput.dataset.bound !== "1") {
    searchInput.dataset.bound = "1";
    searchInput.addEventListener("input", () => {
      chatSearchTerm = searchInput.value || "";
      renderChatMessages();
    });
  }

  if (imageBtn && imageBtn.dataset.bound !== "1") {
    imageBtn.dataset.bound = "1";
    imageBtn.addEventListener("click", () => imageInput?.click());
  }

  if (imageInput && imageInput.dataset.bound !== "1") {
    imageInput.dataset.bound = "1";
    imageInput.addEventListener("change", async () => {
      const file = imageInput.files?.[0];
      imageInput.value = "";
      await sendChatImage(file);
    });
  }

  if (input && input.dataset.typingBound !== "1") {
    input.dataset.typingBound = "1";
    input.addEventListener("input", () => {
      updateChatTyping(true);
      if (chatTypingTimer) clearTimeout(chatTypingTimer);
      chatTypingTimer = setTimeout(() => updateChatTyping(false), 2500);
    });
  }

  if (form && form.dataset.bound !== "1") {
    form.dataset.bound = "1";
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const text = input?.value || "";
      if (input) input.value = "";
      await sendChatMessage(text);
      setTimeout(scrollChatToBottom, 80);
    });
  }
}

function startChatSafe() {
  try {
    setupChatUi();

    const chatBtn = $("chatOpenBtn");
    const chatPanel = $("chatPanel");
    const chatVisible = chatBtn && !chatBtn.classList.contains("hidden") && chatBtn.style.display !== "none";
    const chatOpen = chatPanel && !chatPanel.classList.contains("hidden");

    if (!chatVisible && !chatOpen) {
      stopChatSafe();
      return;
    }

    startChatListenerSafe();
    startPinnedChatListenerSafe();
    startChatTypingListenerSafe();
  } catch (error) {
    console.warn("Chat não iniciou:", error);
  }
}

function stopChatSafe() {
  closeChatPanel();
  stopChatListenerSafe();
  stopPinnedChatListenerSafe();
  stopChatTypingListenerSafe();
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
      stopOnlineFeaturesSafe();
      stopChatSafe();
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
      startChatSafe();
      startOnlineFeaturesSafe();
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

const KNOCKOUT_LAYOUT_KEYS = [
  ["r32_left", "Segunda fase esquerda"],
  ["r16_left", "Oitavos esquerda"],
  ["r16_left_pair_1", "Oitavos esquerda 1-2"],
  ["r16_left_pair_2", "Oitavos esquerda 3-4"],
  ["qf_left", "Quartos esquerda"],
  ["sf_left", "Meia-final esquerda"],
  ["center", "Final"],
  ["sf_right", "Meia-final direita"],
  ["qf_right", "Quartos direita"],
  ["r16_right", "Oitavos direita"],
  ["r16_right_pair_1", "Oitavos direita 5-6"],
  ["r16_right_pair_2", "Oitavos direita 7-8"],
  ["r32_right", "Segunda fase direita"]
];


function isManualKnockoutRound(match) {
  return match?.round === KNOCKOUT_ROUNDS[0].key;
}

function defaultKnockoutLayout() {
  return Object.fromEntries(KNOCKOUT_LAYOUT_KEYS.map(([key]) => [key, 0]));
}

function knockoutLayoutValue(key) {
  const value = Number(appSettings.knockout?.layout?.[key] ?? 0);
  return Number.isFinite(value) ? Math.max(-180, Math.min(180, value)) : 0;
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
    layout: { ...defaultKnockoutLayout(), ...(current.layout || {}) },
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
      layout: { ...defaultKnockoutLayout(), ...(appSettings.knockout?.layout || {}) },
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


function isFirstKnockoutRound(match) {
  return match?.round === "r32";
}

function resetAutoKnockoutTeams() {
  if (!appSettings.knockout || !Array.isArray(appSettings.knockout.matches)) return;

  appSettings.knockout.matches.forEach(match => {
    if (!isFirstKnockoutRound(match)) {
      match.homeTeam = "";
      match.awayTeam = "";
    }
  });
}

function clearInvalidAutoKnockoutScores(previousTeams) {
  if (!appSettings.knockout || !Array.isArray(appSettings.knockout.matches)) return;

  appSettings.knockout.matches.forEach(match => {
    if (isFirstKnockoutRound(match)) return;

    const oldTeams = previousTeams.get(match.id) || "|";
    const newTeams = `${match.homeTeam || ""}|${match.awayTeam || ""}`;

    if (oldTeams !== newTeams) {
      match.homeScore = null;
      match.awayScore = null;
      match.homePenalties = null;
      match.awayPenalties = null;
    }
  });
}

function knockoutWinner(match) {
  if (!match || !match.homeTeam || !match.awayTeam) return "";
  if (match.homeScore === null || match.homeScore === undefined || match.homeScore === "" || match.awayScore === null || match.awayScore === undefined || match.awayScore === "") return "";

  const home = Number(match.homeScore);
  const away = Number(match.awayScore);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return "";

  if (home > away) return match.homeTeam;
  if (away > home) return match.awayTeam;

  const hp = match.homePenalties;
  const ap = match.awayPenalties;

  if (hp === null || hp === undefined || hp === "" || ap === null || ap === undefined || ap === "") return "";

  const homePens = Number(hp);
  const awayPens = Number(ap);

  if (!Number.isFinite(homePens) || !Number.isFinite(awayPens) || homePens === awayPens) return "";

  return homePens > awayPens ? match.homeTeam : match.awayTeam;
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

  resetAutoKnockoutTeams();

  matches.forEach(match => {
    const winner = knockoutWinner(match);
    if (!winner || !match.nextMatchId || !match.nextSlot) return;

    const next = matches.find(item => item.id === match.nextMatchId);
    if (!next) return;

    next[match.nextSlot] = winner;
  });

  clearInvalidAutoKnockoutScores(previousTeams);

  if (shouldSave) {
    markSettingsPending();
    saveLocalData("fase final propagada automaticamente");
    scheduleFullSync("fase final propagada", 300);
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
  updateActiveAppSection();
  renderKnockout();
}


function toggleKnockoutLayoutControlsFromTop() {
  const candidates = [
    $("knockoutLayoutPanel"),
    $("knockoutLayoutControls"),
    $("knockoutAdjustPanel"),
    document.querySelector(".knockout-layout-panel"),
    document.querySelector(".ko-layout-panel"),
    document.querySelector(".knockout-adjust-panel"),
    document.querySelector("[data-knockout-layout-panel]")
  ].filter(Boolean);

  if (!candidates.length) {
    const adminTabButton = document.querySelector('[data-tab="adminTab"]');
    if (adminTabButton) {
      toast("Os ajustes dos cards estão no Admin.");
      adminTabButton.click();
      setTimeout(() => {
        document.querySelector("#knockoutAdminPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    } else {
      toast("Painel de ajustes não encontrado.");
    }
    return;
  }

  candidates.forEach(panel => {
    panel.classList.toggle("hidden");
    panel.classList.toggle("force-open");
    if (!panel.classList.contains("hidden")) {
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}



window.closeOnlineUsersPanelNow = function closeOnlineUsersPanelNow(event) {
  try {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const panel = document.getElementById("onlineUsersPanel");
    if (panel) {
      panel.open = false;
      panel.removeAttribute("open");
    }
  } catch (error) {
    console.warn("Falhou fechar Users Online:", error);
  }

  return false;
};

function closeOnlineUsersPanel() {
  window.closeOnlineUsersPanelNow();
}

function setupOnlineUsersCloseControls() {
  if (!window.__onlineUsersOutsideCloseBound) {
    window.__onlineUsersOutsideCloseBound = true;

    document.addEventListener("click", event => {
      const closeButton = event.target.closest?.("#closeOnlineUsersBtn, .online-users-close");
      if (closeButton) {
        event.preventDefault();
        event.stopPropagation();
        closeOnlineUsersPanel();
        return;
      }

      const activePanel = $("onlineUsersPanel");
      if (!activePanel || !activePanel.open) return;
      if (activePanel.contains(event.target)) return;
      activePanel.open = false;
    }, false);

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") closeOnlineUsersPanel();
    });
  }
}

function setupKnockoutAdjustTopButton() {
  const button = $("openKnockoutLayoutBtn");
  if (!button || button.dataset.bound === "1") return;

  button.dataset.bound = "1";
  button.addEventListener("click", () => {
    toggleKnockoutLayoutControlsFromTop();
  });
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
  const semiMatches = knockoutMatches().filter(match => match.round === "sf");
  const thirdPlaceTeams = semiMatches.map(knockoutLoser).filter(Boolean);

  if (notice) notice.innerHTML = "";
  if (false && notice) {
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

  container.innerHTML = renderKnockoutPhotoLayout(finalMatch, champion, thirdPlaceTeams);
  applyKnockoutLayoutFromSettings();
  requestAnimationFrame(applyKnockoutLayoutFromSettings);

  setTimeout(renderKnockoutMobileV121, 0);
}

// v121 — Fase Final mobile por rondas. PC mantém layout original.
let knockoutMobileSelectedRoundV121 = localStorage.getItem("mundial_ko_mobile_round_v121") || "";

function knockoutRoundsForMobileV121() {
  const matches = Array.isArray(appSettings?.knockout?.matches) ? appSettings.knockout.matches : [];
  const fallbackNames = ["16 avos", "Oitavos", "Quartos", "Meias", "Final"];
  const roundMap = new Map();

  matches.forEach((match, index) => {
    const rawRound = String(match.round || match.stage || match.phase || match.ronda || "").trim();
    const round = rawRound || fallbackNames[Math.min(Math.floor(index / 16), fallbackNames.length - 1)] || "Fase Final";
    if (!roundMap.has(round)) roundMap.set(round, []);
    roundMap.get(round).push({ ...match, __index: index });
  });

  if (!roundMap.size) fallbackNames.forEach(name => roundMap.set(name, []));

  return [...roundMap.entries()].map(([name, games]) => ({ name, games }));
}

function knockoutTeamNameV121(match, side) {
  const keys = side === "home"
    ? ["homeTeam", "home", "teamA", "team1", "leftTeam", "nameA", "aTeam", "participantA", "homeSeed", "seedA", "fromA", "placeholderA"]
    : ["awayTeam", "away", "teamB", "team2", "rightTeam", "nameB", "bTeam", "participantB", "awaySeed", "seedB", "fromB", "placeholderB"];

  for (const key of keys) {
    const value = match?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value && typeof value === "object") {
      if (typeof value.name === "string" && value.name.trim()) return value.name.trim();
      if (typeof value.team === "string" && value.team.trim()) return value.team.trim();
    }
  }

  return "Equipa por definir";
}

function knockoutScoreV121(match, side) {
  const keys = side === "home"
    ? ["homeScore", "scoreA", "teamAScore", "scoreHome", "goalsHome", "homeGoals"]
    : ["awayScore", "scoreB", "teamBScore", "scoreAway", "goalsAway", "awayGoals"];

  for (const key of keys) {
    const value = match?.[key];
    if (value === "" || value === null || value === undefined) continue;
    if (Number.isFinite(Number(value))) return Number(value);
  }

  return null;
}

function knockoutPenaltiesV121(match) {
  const homeKeys = ["homePenalties", "penaltiesHome", "penA", "homePens", "pensHome"];
  const awayKeys = ["awayPenalties", "penaltiesAway", "penB", "awayPens", "pensAway"];

  let home = null;
  let away = null;

  for (const key of homeKeys) {
    if (match?.[key] !== "" && match?.[key] !== null && match?.[key] !== undefined && Number.isFinite(Number(match[key]))) {
      home = Number(match[key]);
      break;
    }
  }

  for (const key of awayKeys) {
    if (match?.[key] !== "" && match?.[key] !== null && match?.[key] !== undefined && Number.isFinite(Number(match[key]))) {
      away = Number(match[key]);
      break;
    }
  }

  return home !== null && away !== null ? { home, away } : null;
}

function knockoutWinnerV121(match) {
  const explicit = match?.winner || match?.winnerTeam || match?.qualified || match?.winnerName;
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();

  const home = knockoutScoreV121(match, "home");
  const away = knockoutScoreV121(match, "away");
  const homeName = knockoutTeamNameV121(match, "home");
  const awayName = knockoutTeamNameV121(match, "away");

  if (home !== null && away !== null && home !== away) return home > away ? homeName : awayName;

  const pens = knockoutPenaltiesV121(match);
  if (pens && pens.home !== pens.away) return pens.home > pens.away ? homeName : awayName;

  return "";
}

function knockoutMatchIdV121(match) {
  return match?.id || match?.matchId || match?.gameId || match?.key || `ko-${match?.__index ?? Math.random().toString(36).slice(2)}`;
}

function renderKnockoutMobileV121() {
  const tab = document.getElementById("knockoutTab");
  if (!tab) return;

  let host = document.getElementById("knockoutMobileV121");
  if (!host) {
    host = document.createElement("section");
    host.id = "knockoutMobileV121";
    host.className = "knockout-mobile-v121";
    tab.prepend(host);
  }

  const rounds = knockoutRoundsForMobileV121();
  if (!knockoutMobileSelectedRoundV121 || !rounds.some(round => round.name === knockoutMobileSelectedRoundV121)) {
    knockoutMobileSelectedRoundV121 = rounds[0]?.name || "Fase Final";
  }

  const selected = rounds.find(round => round.name === knockoutMobileSelectedRoundV121) || rounds[0] || { name: "Fase Final", games: [] };
  const selectedIndex = Math.max(0, rounds.findIndex(round => round.name === selected.name));

  const roundTabs = rounds.map(round => `
    <button type="button" class="ko-mobile-chip ${round.name === selected.name ? "active" : ""}" data-ko-mobile-round="${escapeHtml(round.name)}">
      ${escapeHtml(round.name)}
      <span>${round.games.length}</span>
    </button>
  `).join("");

  const cards = selected.games.length
    ? selected.games.map((match, index) => {
        const home = knockoutTeamNameV121(match, "home");
        const away = knockoutTeamNameV121(match, "away");
        const homeScore = knockoutScoreV121(match, "home");
        const awayScore = knockoutScoreV121(match, "away");
        const pens = knockoutPenaltiesV121(match);
        const winner = knockoutWinnerV121(match);
        const matchId = knockoutMatchIdV121(match);

        return `
          <article class="ko-mobile-card" data-ko-mobile-match="${escapeHtml(String(matchId))}">
            <div class="ko-mobile-card-head">
              <span>${escapeHtml(selected.name)}</span>
              <strong>Jogo ${index + 1}</strong>
            </div>

            <div class="ko-mobile-team ${winner && winner === home ? "winner" : ""}">
              <span>${escapeHtml(home)}</span>
              <b>${homeScore === null ? "—" : homeScore}</b>
            </div>

            <div class="ko-mobile-versus">vs</div>

            <div class="ko-mobile-team ${winner && winner === away ? "winner" : ""}">
              <span>${escapeHtml(away)}</span>
              <b>${awayScore === null ? "—" : awayScore}</b>
            </div>

            ${pens ? `<div class="ko-mobile-pens">Penáltis: <strong>${pens.home} - ${pens.away}</strong></div>` : ""}

            <div class="ko-mobile-status ${winner ? "done" : "waiting"}">
              ${winner ? `✅ Vencedor: <strong>${escapeHtml(winner)}</strong>` : "⏳ A aguardar resultado/equipas"}
            </div>

            ${isAdmin ? `<button type="button" class="secondary small ko-mobile-edit" data-ko-mobile-edit="${escapeHtml(String(matchId))}">Editar</button>` : ""}
          </article>`;
      }).join("")
    : `<div class="ko-mobile-empty">Ainda não há jogos nesta ronda.</div>`;

  const nextRound = rounds[selectedIndex + 1];
  const prevRound = rounds[selectedIndex - 1];

  host.innerHTML = `
    <div class="ko-mobile-header">
      <div>
        <span>Fase Final</span>
        <strong>${escapeHtml(selected.name)}</strong>
      </div>
      <small>${selected.games.length} jogo(s)</small>
    </div>

    <div class="ko-mobile-tabs">${roundTabs}</div>

    <div class="ko-mobile-list">${cards}</div>

    <div class="ko-mobile-nav">
      ${prevRound ? `<button type="button" class="secondary" data-ko-mobile-round="${escapeHtml(prevRound.name)}">← ${escapeHtml(prevRound.name)}</button>` : ""}
      ${nextRound ? `<button type="button" class="primary" data-ko-mobile-round="${escapeHtml(nextRound.name)}">${escapeHtml(nextRound.name)} →</button>` : ""}
    </div>
  `;

  host.querySelectorAll("[data-ko-mobile-round]").forEach(btn => {
    btn.addEventListener("click", () => {
      knockoutMobileSelectedRoundV121 = btn.dataset.koMobileRound || selected.name;
      localStorage.setItem("mundial_ko_mobile_round_v121", knockoutMobileSelectedRoundV121);
      renderKnockoutMobileV121();
    });
  });

  host.querySelectorAll("[data-ko-mobile-edit]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.koMobileEdit;
      const originalButton = document.querySelector(`[data-ko-admin="${CSS.escape(id)}"] button, [data-ko-edit="${CSS.escape(id)}"], [data-match-id="${CSS.escape(id)}"] button`);
      if (originalButton) originalButton.click();
      else toast("Edição mobile visual nesta fase. Usa a edição normal se necessário.");
    });
  });
}

function setupKnockoutMobileV121() {
  renderKnockoutMobileV121();
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(setupKnockoutMobileV121, 500);
  setTimeout(setupKnockoutMobileV121, 1500);
});

document.addEventListener("click", () => {
  setTimeout(() => {
    if (document.getElementById("knockoutTab")?.classList.contains("active")) renderKnockoutMobileV121();
  }, 150);
});



function renderKnockoutPhotoLayout(finalMatch, champion, thirdPlaceTeams) {
  const roundColumns = buildKnockoutPhotoColumns();
  const canEditLayout = isAdminProfile() && hasPermission("editKnockout");
  return `
    <div class="bracket-photo-shell">
      <div class="bracket-title-row">
        <span>Copa do Mundo FIFA 2026</span>
        <strong>Fases finais</strong>
        <span>Mundial Pontos 2026</span>
      </div>

      ${canEditLayout ? `
        <details class="ko-page-layout-panel">
          <summary>Ajustar cards</summary>
          ${renderKnockoutLayoutControls("page")}
        </details>
      ` : ""}

      <div class="bracket-photo-grid bracket-photo-grid-split">
        ${roundColumns.left.map(renderKnockoutPhotoColumn).join("")}
        ${renderKnockoutCenter(finalMatch, champion, thirdPlaceTeams)}
        ${roundColumns.right.map(renderKnockoutPhotoColumn).join("")}
      </div>
    </div>`;
}

function knockoutLoser(match) {
  const winner = knockoutWinner(match);
  if (!winner || !match?.homeTeam || !match?.awayTeam) return "";
  return winner === match.homeTeam ? match.awayTeam : match.homeTeam;
}

function buildKnockoutPhotoColumns() {
  const byRound = key => knockoutMatches().filter(match => match.round === key);
  const labels = {
    r32: "Segunda fase",
    r16: "Oitavos de final",
    qf: "Quartos de final",
    sf: "Meia-final"
  };
  const split = key => {
    const list = byRound(key);
    const half = Math.ceil(list.length / 2);
    return [list.slice(0, half), list.slice(half)];
  };
  const [r32Left, r32Right] = split("r32");
  const [r16Left, r16Right] = split("r16");
  const [qfLeft, qfRight] = split("qf");
  const [sfLeft, sfRight] = split("sf");

  return {
    left: [
      { key: "r32", side: "left", label: labels.r32, matches: r32Left },
      { key: "r16", side: "left", label: labels.r16, matches: r16Left },
      { key: "qf", side: "left", label: labels.qf, matches: qfLeft },
      { key: "sf", side: "left", label: labels.sf, matches: sfLeft }
    ],
    right: [
      { key: "sf", side: "right", label: labels.sf, matches: sfRight },
      { key: "qf", side: "right", label: labels.qf, matches: qfRight },
      { key: "r16", side: "right", label: labels.r16, matches: r16Right },
      { key: "r32", side: "right", label: labels.r32, matches: r32Right }
    ]
  };
}

function renderKnockoutPhotoColumn(column) {
  const layoutKey = `${column.key}_${column.side}`;
  return `
    <section class="bracket-photo-round round-${column.key} bracket-side-${column.side}" data-ko-layout="${escapeHtml(layoutKey)}" style="--ko-column-offset:${knockoutLayoutValue(layoutKey)}px">
      <h3>${escapeHtml(column.label)}</h3>
      <div class="bracket-photo-matches">
        ${column.matches.map((match, index) => renderKnockoutMatch(match, knockoutMatchLayoutKey(column, index))).join("")}
      </div>
    </section>`;
}

function knockoutMatchLayoutKey(column, index) {
  if (column.key !== "r16") return "";
  return `r16_${column.side}_pair_${Math.floor(index / 2) + 1}`;
}

function renderKnockoutCenter(finalMatch, champion, thirdPlaceTeams) {
  return `
    <section class="bracket-center-column" data-ko-layout="center" style="--ko-column-offset:${knockoutLayoutValue("center")}px">
      <div class="bracket-final-badge ${champion ? "has-champion" : ""}">
        <span>FINAL</span>
        <strong>${escapeHtml(champion || "Campeão")}</strong>
      </div>
      <div class="bracket-center-final">
        ${finalMatch ? renderKnockoutMatch(finalMatch) : ""}
      </div>
    </section>`;
}

function renderKnockoutMatch(match, layoutKey = "") {
  const winner = knockoutWinner(match);
  const editable = isAdmin && knockoutAvailable();
  const waiting = !match.homeTeam || !match.awayTeam;
  const hasScore = match.homeScore !== null && match.homeScore !== undefined && match.homeScore !== "" && match.awayScore !== null && match.awayScore !== undefined && match.awayScore !== "";
  const isDraw = hasScore && Number(match.homeScore) === Number(match.awayScore);
  const hasPens = match.homePenalties !== null && match.homePenalties !== undefined && match.homePenalties !== "" && match.awayPenalties !== null && match.awayPenalties !== undefined && match.awayPenalties !== "";
  const lockedText = waiting ? "" : winner ? "Vencedor" : isDraw ? "Faltam penáltis" : "Por decidir";

  return `
    <article class="knockout-match ${winner ? "has-winner" : ""} ${waiting ? "waiting" : ""}" ${layoutKey ? `data-ko-layout="${escapeHtml(layoutKey)}" style="--ko-match-offset:${knockoutLayoutValue(layoutKey)}px"` : ""}>
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

function renderKnockoutLayoutControls() {
  return `
    <div class="ko-layout-editor">
      <div class="ko-layout-head">
        <div>
          <strong>Posição dos cards</strong>
          <span>Ajusta para cima/baixo cada coluna da Fase Final.</span>
        </div>
        <div class="ko-layout-actions">
          <button class="secondary small" type="button" data-ko-layout-reset>Repor</button>
          <button class="primary small" type="button" data-ko-layout-save>Guardar posições</button>
        </div>
      </div>
      <div class="ko-layout-grid">
        ${KNOCKOUT_LAYOUT_KEYS.map(([key, label]) => {
          const value = knockoutLayoutValue(key);
          return `
            <label class="ko-layout-control">
              <span>${escapeHtml(label)}</span>
              <input class="ko-layout-range" type="range" min="-180" max="180" step="2" value="${value}" data-ko-layout-input="${escapeHtml(key)}" />
              <input class="ko-layout-number" type="number" min="-180" max="180" step="2" value="${value}" data-ko-layout-number="${escapeHtml(key)}" />
            </label>
          `;
        }).join("")}
      </div>
    </div>`;
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
      <strong>Regra da Fase Final:</strong> define manualmente as equipas dos <strong>16 avos</strong>.
      Depois, os vencedores passam automaticamente para os oitavos, quartos, meias, final e campeão.
    </div>
    <div class="ko-admin-list">
      ${knockoutMatches().map(match => {
        const firstRound = isFirstKnockoutRound(match);
        const canScore = Boolean(match.homeTeam && match.awayTeam);

        const homeControl = firstRound
          ? `<select class="ko-home-team">${teamOptions(match.homeTeam)}</select>`
          : `<input class="ko-readonly-team" type="text" value="${escapeHtml(match.homeTeam || "A definir automaticamente")}" disabled />`;

        const awayControl = firstRound
          ? `<select class="ko-away-team">${teamOptions(match.awayTeam)}</select>`
          : `<input class="ko-readonly-team" type="text" value="${escapeHtml(match.awayTeam || "A definir automaticamente")}" disabled />`;

        return `
          <div class="ko-admin-row ko-admin-row-penalties ${firstRound ? "manual-round" : "auto-round"}" data-ko-admin="${escapeHtml(match.id)}">
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

            <button class="primary small" type="button" data-ko-save="${escapeHtml(match.id)}">${firstRound ? "Guardar 16 avos" : "Guardar resultado"}</button>
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

function applyKnockoutLayoutFromSettings() {
  if (!appSettings.knockout) return;
  const layout = { ...defaultKnockoutLayout(), ...(appSettings.knockout.layout || {}) };

  Object.entries(layout).forEach(([key, rawValue]) => {
    const value = Number(rawValue);
    const safeValue = Number.isFinite(value) ? Math.max(-180, Math.min(180, value)) : 0;

    document.querySelectorAll(`[data-ko-layout="${CSS.escape(key)}"]`).forEach(element => {
      element.style.setProperty("--ko-column-offset", `${safeValue}px`);
      element.style.setProperty("--ko-match-offset", `${safeValue}px`);
    });

    syncKnockoutLayoutInputs(key, safeValue);
  });
}

function syncKnockoutLayoutInputs(key, value) {
  document.querySelectorAll(`[data-ko-layout-input="${CSS.escape(key)}"], [data-ko-layout-number="${CSS.escape(key)}"]`).forEach(input => {
    input.value = value;
  });
}

function previewKnockoutLayoutPosition(key, value) {
  const safeValue = Number.isFinite(Number(value)) ? Math.max(-180, Math.min(180, Number(value))) : 0;

  document.querySelectorAll(`[data-ko-layout="${CSS.escape(key)}"]`).forEach(element => {
    element.style.setProperty("--ko-column-offset", `${safeValue}px`);
    element.style.setProperty("--ko-match-offset", `${safeValue}px`);
  });

  syncKnockoutLayoutInputs(key, safeValue);
}

async function saveKnockoutLayoutFromAdmin(reset = false) {
  if (!hasPermission("editKnockout")) { toast("Sem permissão."); return; }

  ensureKnockoutSettings();

  const nextLayout = { ...defaultKnockoutLayout(), ...(appSettings.knockout.layout || {}) };

  if (reset) {
    Object.keys(nextLayout).forEach(key => { nextLayout[key] = 0; });
  } else {
    KNOCKOUT_LAYOUT_KEYS.forEach(([key]) => {
      const input = document.querySelector(`[data-ko-layout-number="${CSS.escape(key)}"]`) ||
        document.querySelector(`[data-ko-layout-input="${CSS.escape(key)}"]`);
      const value = Number(input?.value ?? nextLayout[key] ?? 0);
      nextLayout[key] = Number.isFinite(value) ? Math.max(-180, Math.min(180, value)) : 0;
    });
  }

  appSettings.knockout.layout = nextLayout;
  markSettingsPending();
  saveLocalData(reset ? "posições fase final repostas" : "posições fase final guardadas");

  renderKnockout();
  renderKnockoutAdmin();
  applyKnockoutLayoutFromSettings();
  requestAnimationFrame(applyKnockoutLayoutFromSettings);

  try {
    const saved = await saveSettingsFastToFirebase(reset ? "repor posições fase final" : "guardar posições fase final");
    if (saved) {
      setFirebaseStatus("success", "Firebase: posições da Fase Final guardadas");
      applyKnockoutLayoutFromSettings();
      requestAnimationFrame(applyKnockoutLayoutFromSettings);
    } else {
      scheduleFullSync("guardar posições fase final", 300);
    }
  } catch (error) {
    console.error("Falhou guardar posições da Fase Final:", error);
    scheduleFullSync("guardar posições fase final", 600);
    setFirebaseStatus("error", `Firebase: posições pendentes (${shortFirebaseError(error)})`);
  }

  toast(reset ? "Posições repostas." : "Posições da Fase Final guardadas.");
}
async function saveKnockoutMatchFromAdmin(matchId) {
  if (!hasPermission("editKnockout")) { toast("Sem permissão."); return; }

  ensureKnockoutSettings();

  const row = document.querySelector(`[data-ko-admin="${CSS.escape(matchId)}"]`);
  const match = knockoutMatchById(matchId);
  if (!row || !match) return;

  const firstRound = isFirstKnockoutRound(match);

  if (firstRound) {
    match.homeTeam = row.querySelector(".ko-home-team")?.value || "";
    match.awayTeam = row.querySelector(".ko-away-team")?.value || "";
  }

  if (!match.homeTeam || !match.awayTeam) {
    match.homeScore = null;
    match.awayScore = null;
    match.homePenalties = null;
    match.awayPenalties = null;
    markSettingsPending();
    saveLocalData("fase final equipas incompletas");
    await saveSettingsFastToFirebase("fase final equipas incompletas");
    renderKnockout();
    renderKnockoutAdmin();
    toast(firstRound ? "Define as duas equipas deste jogo." : "Este jogo ainda está à espera dos vencedores anteriores.");
    return;
  }

  const homeScoreValue = row.querySelector(".ko-home-score")?.value ?? "";
  const awayScoreValue = row.querySelector(".ko-away-score")?.value ?? "";
  const homePenaltiesValue = row.querySelector(".ko-home-penalties")?.value ?? "";
  const awayPenaltiesValue = row.querySelector(".ko-away-penalties")?.value ?? "";

  match.homeScore = homeScoreValue === "" ? null : Number(homeScoreValue);
  match.awayScore = awayScoreValue === "" ? null : Number(awayScoreValue);

  const hasFullScore = match.homeScore !== null && match.awayScore !== null;
  const isDraw = hasFullScore && Number(match.homeScore) === Number(match.awayScore);

  if (isDraw) {
    if (homePenaltiesValue === "" || awayPenaltiesValue === "") {
      toast("Jogo empatado. Preenche o resultado dos penáltis.");
      return;
    }

    match.homePenalties = Number(homePenaltiesValue);
    match.awayPenalties = Number(awayPenaltiesValue);

    if (Number(match.homePenalties) === Number(match.awayPenalties)) {
      toast("Os penáltis não podem ficar empatados.");
      return;
    }
  } else {
    match.homePenalties = homePenaltiesValue === "" ? null : Number(homePenaltiesValue);
    match.awayPenalties = awayPenaltiesValue === "" ? null : Number(awayPenaltiesValue);

    if ((homePenaltiesValue === "") !== (awayPenaltiesValue === "")) {
      toast("Preenche os dois campos dos penáltis ou deixa os dois vazios.");
      return;
    }

    if (homePenaltiesValue !== "" && Number(match.homePenalties) === Number(match.awayPenalties)) {
      toast("Se preencheres penáltis, eles não podem ficar empatados.");
      return;
    }
  }

  match.updatedAt = new Date().toISOString();

  propagateKnockoutWinners(false);
  markSettingsPending();
  saveLocalData("fase final jogo guardado");

  renderKnockout();
  renderKnockoutAdmin();

  try {
    await saveSettingsFastToFirebase("fase final jogo guardado");
    setFirebaseStatus("success", "Firebase: Fase Final guardada");
  } catch (error) {
    console.error("Falhou guardar Fase Final:", error);
    scheduleFullSync("fase final jogo guardado", 600);
    setFirebaseStatus("error", `Firebase: Fase Final pendente (${shortFirebaseError(error)})`);
  }

  toast("Resultado guardado. Vencedor avançou automaticamente.");
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
  updateActiveAppSection();
  renderKnockoutAdmin();
  setTimeout(() => {
    const row = document.querySelector(`[data-ko-admin="${CSS.escape(matchId)}"]`);
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
    row?.classList.add("pulse-row");
    setTimeout(() => row?.classList.remove("pulse-row"), 1500);
  }, 80);
}

function renderAll() {
  setupSearchResultsAdminButton();
  setTimeout(addSearchButtonsToResultCards, 0);
  setupOnlineUsersCloseControls();
  setupKnockoutAdjustTopButton(); renderAdminState(); renderCalendar(); renderScore(); renderKnockout(); renderAdmin(); renderSettingsForm(); renderUsers(); renderUserBetsEditor(); renderKnockoutAdmin(); renderCalendarFilterState(); applyPermissionsToUi(); updateActiveAppSection(); 
  setTimeout(addSearchButtonsToResultCards, 250);
}

function renderCalendarFilterState() {
  const missingBtn = $("calendarMissingResultsBtn");
  const playedBtn = $("calendarPlayedGamesBtn");
  const allBtn = $("calendarAllGamesBtn");

  const missingCount = games.filter(game => !hasResult(game)).length;
  const playedCount = games.filter(game => hasResult(game)).length;
  const totalCount = games.length;

  if (missingBtn) {
    missingBtn.classList.toggle("active-filter", calendarViewMode === "missing");
    missingBtn.innerHTML = `Faltam resultados <span class="filter-count">${missingCount}</span>`;
    missingBtn.title = "Mostra apenas jogos que ainda não têm resultado colocado.";
    missingBtn.setAttribute("aria-label", `Faltam resultados: ${missingCount} jogos`);
  }

  if (playedBtn) {
    playedBtn.classList.toggle("active-filter", calendarViewMode === "played");
    playedBtn.innerHTML = `Já jogaram <span class="filter-count">${playedCount}</span>`;
    playedBtn.title = "Mostra apenas jogos que já têm resultado, do mais recente para o mais antigo.";
    playedBtn.setAttribute("aria-label", `Já jogaram: ${playedCount} jogos, do mais recente para o mais antigo`);
  }

  if (allBtn) {
    allBtn.classList.toggle("active-filter", calendarViewMode === "all");
    allBtn.innerHTML = `Todos os jogos <span class="filter-count">${totalCount}</span>`;
    allBtn.title = "Mostra todos os jogos por data/calendário.";
    allBtn.setAttribute("aria-label", `Todos os jogos: ${totalCount} jogos por data`);
  }
}

function renderCalendar() {
  const container = $("gamesList");
  const groups = groupByDate(filteredGames());
  const days = [...groups.entries()].sort((a, b) => {
    // Já jogaram: dias mais recentes primeiro.
    if (calendarViewMode === "played") return b[0].localeCompare(a[0]);

    // Todos os jogos e Faltam resultados: por data/calendário.
    return a[0].localeCompare(b[0]);
  });

  if (!days.length) {
    container.innerHTML = `<div class="empty">Não há jogos para mostrar neste filtro.</div>${knockoutEntryButtonHtml()}`;
    renderCalendarFilterState();
    return;
  }

  container.innerHTML = days.map(([, dayGames]) => `
    <section class="day-block"><h3>${escapeHtml(dateHeader(dayGames[0].matchDate))}</h3><div class="match-list">${dayGames.map(renderMatchRow).join("")}</div></section>
  `).join("") + knockoutEntryButtonHtml();

  renderCalendarFilterState();
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




function playedGamesNewestFirstV118() {
  return games
    .filter(game => hasResult(game))
    .slice()
    .sort((a, b) => parsePortugalDate(b.matchDate).getTime() - parsePortugalDate(a.matchDate).getTime());
}


function polishScorePlayedGamesOnlyV118() {
  // v119: a filtragem correta já é feita em playerGameRows.
}




function gameHasRealResultV119(game) {
  if (!game) return false;

  const candidates = [
    [game.homeScore, game.awayScore],
    [game.scoreHome, game.scoreAway],
    [game.homeGoals, game.awayGoals],
    [game.resultHome, game.resultAway],
    [game.goalsHome, game.goalsAway]
  ];

  return candidates.some(([home, away]) => {
    if (home === "" || home === null || home === undefined) return false;
    if (away === "" || away === null || away === undefined) return false;
    return Number.isFinite(Number(home)) && Number.isFinite(Number(away));
  });
}

function gameScorePairV119(game) {
  const candidates = [
    [game.homeScore, game.awayScore],
    [game.scoreHome, game.scoreAway],
    [game.homeGoals, game.awayGoals],
    [game.resultHome, game.resultAway],
    [game.goalsHome, game.goalsAway]
  ];

  for (const [home, away] of candidates) {
    if (home === "" || home === null || home === undefined) continue;
    if (away === "" || away === null || away === undefined) continue;
    if (Number.isFinite(Number(home)) && Number.isFinite(Number(away))) {
      return [Number(home), Number(away)];
    }
  }

  return [null, null];
}

function playedGamesNewestFirstV119() {
  return games
    .filter(game => gameHasRealResultV119(game))
    .slice()
    .sort((a, b) => parsePortugalDate(b.matchDate).getTime() - parsePortugalDate(a.matchDate).getTime());
}




function betForPlayerGameV120(playerName, gameId) {
  const normalizedName = String(playerName || "").trim();
  const normalizedId = playerIdFromName(normalizedName);

  return bets.find(item => {
    if (!item || item.gameId !== gameId) return false;

    const itemName = String(item.playerName || "").trim();
    const itemId = String(item.playerId || "").trim();

    return (
      itemId === normalizedId ||
      playerIdFromName(itemName) === normalizedId ||
      itemName.toLowerCase() === normalizedName.toLowerCase()
    );
  }) || null;
}


function playerGameRows(playerName) {
  return playedGamesNewestFirstV119().map(game => {
    const bet = betForPlayerGameV120(playerName, game.id);
    const points = bet ? pointsForBet(bet, game) : 0;

    return {
      game,
      bet,
      points,
      label: bet ? betResultLabel(bet, game) : "Sem aposta",
      className: bet ? betResultClass(bet, game) : "miss"
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
        const settled = gameRows.length;
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
                  <span>${(() => { const [h,a] = gameScorePairV119(game); return h === null ? "-" : `${h}-${a}`; })()}</span>
                  <span><em>${escapeHtml(label)}</em></span>
                  <strong>${points}</strong>
                </div>
              `).join("")}
            </div>
          </details>
        `;
      }).join("")}
    </div>`;

  setTimeout(polishScorePlayedGamesOnlyV118, 0);
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




function openResultSearchForGame(gameOrId) {
  const game = typeof gameOrId === "string"
    ? games.find(item => item.id === gameOrId)
    : gameOrId;

  if (!game) return toast("Jogo não encontrado.");

  const home = String(game.homeTeam || game.home || game.teamA || "").trim();
  const away = String(game.awayTeam || game.away || game.teamB || "").trim();

  if (!home || !away) return toast("Este jogo ainda não tem as duas equipas definidas.");

  const query = `${home} vs ${away}`;
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}



function openResultsSearchDashboard() {
  if (!hasPermission("editResults")) {
    toast("Só o Admin pode pesquisar resultados.");
    return;
  }

  const dueGames = (games || [])
    .filter(game => !hasResult(game))
    .filter(game => parsePortugalDate(game.matchDate).getTime() <= Date.now())
    .sort((a, b) => parsePortugalDate(a.matchDate) - parsePortugalDate(b.matchDate));

  if (dueGames.length) {
    openResultSearchForGame(dueGames[0]);
    if (dueGames.length > 1) toast(`Abri a pesquisa do primeiro jogo. Existem ${dueGames.length} jogos sem resultado.`);
    return;
  }

  const nextGame = (games || [])
    .filter(game => !hasResult(game))
    .sort((a, b) => parsePortugalDate(a.matchDate) - parsePortugalDate(b.matchDate))[0];

  if (nextGame) {
    openResultSearchForGame(nextGame);
    return;
  }

  toast("Não existem jogos pendentes para pesquisar.");
}



function setupSearchResultsAdminButton() {
  // v117: o botão Pesquisar por jogo é público.
  addSearchButtonsToResultCards();

  const button = $("searchAllResultsBtn");
  if (!button || button.dataset.bound === "1") return;

  button.dataset.bound = "1";
  button.addEventListener("click", () => openResultsSearchDashboard());
}





function addSearchButtonsToResultCards() {
  const resultButtons = document.querySelectorAll("[data-result-game]");

  resultButtons.forEach(resultButton => {
    const gameId = resultButton.dataset.resultGame;
    if (!gameId) return;

    const parent = resultButton.parentElement;
    if (!parent) return;

    if (parent.querySelector(`[data-search-result-game="${CSS.escape(gameId)}"]`)) return;

    const game = games.find(item => item.id === gameId);
    if (!game) return;

    const searchButton = document.createElement("button");
    searchButton.type = "button";
    searchButton.className = "secondary small search-game-result-btn search-result-btn-v117";
    searchButton.dataset.searchResultGame = gameId;
    searchButton.textContent = "Pesquisar";
    searchButton.title = `${game.homeTeam || game.home || game.teamA || ""} vs ${game.awayTeam || game.away || game.teamB || ""}`.trim();

    searchButton.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      openResultSearchForGame(game);
    });

    parent.insertBefore(searchButton, resultButton);
  });

  document.querySelectorAll("[data-game-id]").forEach(card => {
    const gameId = card.getAttribute("data-game-id");
    if (!gameId || card.querySelector(`[data-search-result-game="${CSS.escape(gameId)}"]`)) return;

    const game = games.find(item => item.id === gameId);
    if (!game) return;

    const actions = card.querySelector(".match-actions,.match-card-actions,.actions,.card-actions") || card;
    const searchButton = document.createElement("button");
    searchButton.type = "button";
    searchButton.className = "secondary small search-game-result-btn search-result-btn-v117";
    searchButton.dataset.searchResultGame = gameId;
    searchButton.textContent = "Pesquisar";
    searchButton.title = `${game.homeTeam || game.home || game.teamA || ""} vs ${game.awayTeam || game.away || game.teamB || ""}`.trim();

    searchButton.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      openResultSearchForGame(game);
    });

    actions.appendChild(searchButton);
  });
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
  if (!hasPermission("editResults")) { toast("Sem permissão para editar resultados."); return false; }

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
  if (!hasPermission("editResults")) { toast("Sem permissão para editar resultados."); return false; }

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
  if (!hasPermission("editResults")) { toast("Sem permissão para editar resultados."); return; }

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
  if (!hasPermission("editResults")) { toast("Sem permissão para editar resultados."); return false; }

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
  if (!hasPermission("editResults")) { toast("Sem permissão para editar resultados."); return false; }

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

  const koLayoutSaveButton = event.target.closest("[data-ko-layout-save]");
  if (koLayoutSaveButton) {
    saveKnockoutLayoutFromAdmin(false);
    return;
  }

  const koLayoutResetButton = event.target.closest("[data-ko-layout-reset]");
  if (koLayoutResetButton) {
    saveKnockoutLayoutFromAdmin(true);
    return;
  }

  const resultButton = event.target.closest("[data-result-game]");
  if (resultButton) {
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
    updateActiveAppSection();
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

$("calendarPlayedGamesBtn")?.addEventListener("click", () => {
  calendarViewMode = "played";
  renderCalendar();
  renderCalendarFilterState();
});

$("calendarAllGamesBtn")?.addEventListener("click", () => {
  calendarViewMode = "all";
  renderCalendar();
  renderCalendarFilterState();
});

$("copyScoreBtn")?.addEventListener("click", () => copyText(scoreText(), "Classificação copiada."));
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
      .then(registration => {
        setupAppUpdateRefresh(registration);
      })
      .catch(error => console.warn("Service worker nao registado:", error));
  });
}

async function clearAppCaches() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
  } catch (error) {
    console.warn("Nao consegui limpar a cache da app:", error);
  }
}

function showRefreshAppButton(message = "Nova versao disponivel.") {
  const button = $("refreshAppBtn");
  if (!button) return;
  button.classList.remove("hidden");
  button.classList.add("has-update");
  button.title = message;
}

async function refreshAppNow() {
  const button = $("refreshAppBtn");
  if (button) {
    button.disabled = true;
    button.textContent = "A atualizar...";
  }

  toast("A atualizar app...");

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(async registration => {
        try { registration.waiting?.postMessage({ type: "SKIP_WAITING" }); } catch {}
        try { await registration.update(); } catch {}
      }));
    }

    await clearAppCaches();
  } catch (error) {
    console.warn("Atualizacao da app falhou, vou recarregar na mesma:", error);
  }

  const url = new URL(window.location.href);
  url.searchParams.set("v", Date.now().toString());
  window.location.replace(url.toString());
}

function setupAppUpdateRefresh(registration) {
  const button = $("refreshAppBtn");
  if (button && button.dataset.bound !== "1") {
    button.dataset.bound = "1";
    button.addEventListener("click", refreshAppNow);
  }

  if (!registration) return;

  registration.addEventListener("updatefound", () => {
    const worker = registration.installing;
    if (!worker) return;

    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        showRefreshAppButton("Nova versao pronta para instalar.");
        toast("Nova versao pronta. Toca em Atualizar app.");
      }
    });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (window.__appRefreshControllerChanged) return;
    window.__appRefreshControllerChanged = true;
    window.location.reload();
  });

  navigator.serviceWorker.addEventListener("message", event => {
    if (event.data?.type === "APP_VERSION_READY") {
      showRefreshAppButton("Nova versao pronta para instalar.");
    }
  });

  setTimeout(() => {
    registration.update().catch(() => {});
  }, 1200);
}

function setupPageWheelScroll() {
  document.addEventListener("wheel", event => {
    if (document.body.classList.contains("knockout-layout-active")) return;
    if (event.defaultPrevented || !event.deltaY) return;
    if (event.target.closest("#chatPanel, #chatActionMenu, #chatImageViewer, .chat-panel, .chat-messages, .chat-action-menu, .chat-image-viewer, .modal, .modal-card, .ko-admin-list")) return;

    const before = window.scrollY;
    window.scrollBy({ top: event.deltaY, left: 0, behavior: "auto" });
    if (window.scrollY !== before) event.preventDefault();
  }, { passive: false });
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

document.addEventListener("input", event => {
  const layoutRange = event.target.closest("[data-ko-layout-input]");
  const layoutNumber = event.target.closest("[data-ko-layout-number]");
  const layoutInput = layoutRange || layoutNumber;
  if (!layoutInput) return;

  const key = layoutInput.dataset.koLayoutInput || layoutInput.dataset.koLayoutNumber;
  const value = Math.max(-180, Math.min(180, Number(layoutInput.value) || 0));
  syncKnockoutLayoutInputs(key, value);
  previewKnockoutLayoutPosition(key, value);
});

window.addEventListener("beforeunload", () => {
  try { saveLocalData("beforeunload"); } catch {}
});

setupRememberedAccount();
setupIosAppMode();
setupPwaInstall();
setupPageWheelScroll();
registerServiceWorker();
await initFirebase();
setupAuthGate();


// beforeunload_presence_v63
window.addEventListener("beforeunload", () => {
  try {
    updateMyPresence(true);
  } catch (error) {
    console.warn("Não foi possível marcar offline ao sair:", error);
  }
});

setupKnockoutAdjustTopButton();

setupOnlineUsersCloseControls();



setupSearchResultsAdminButton();




// v89 — Chat mobile limpo: sem capturas globais agressivas.
(function setupChatMobileCleanV89(){
  if (window.__chatMobileCleanV89) return;
  window.__chatMobileCleanV89 = true;

  function isMobileChat() {
    return window.matchMedia?.("(max-width: 760px)")?.matches || window.innerWidth <= 760;
  }

  function clearChatState() {
    document.body.classList.remove("chat-fullscreen-open", "chat-mobile-page-open", "chat-window-open");
    document.documentElement.classList.remove("chat-mobile-page-open");
    document.body.style.overflow = "";
    document.body.style.position = "";
    document.body.style.width = "";
    document.body.style.height = "";
  }

  function applyChatOpenState() {
    const mobile = isMobileChat();
    document.body.classList.toggle("chat-mobile-page-open", mobile);
    document.body.classList.toggle("chat-fullscreen-open", mobile);
    document.body.classList.toggle("chat-window-open", !mobile);
    document.documentElement.classList.toggle("chat-mobile-page-open", mobile);
  }

  window.closeChatMobileClean = function closeChatMobileClean(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const panel = document.getElementById("chatPanel");
    if (panel) panel.classList.add("hidden");

    clearChatState();

    try { if (typeof closeChatActionMenu === "function") closeChatActionMenu(); } catch {}
    try { if (typeof clearChatReply === "function") clearChatReply(); } catch {}
    try { if (typeof updateChatTyping === "function") updateChatTyping(false); } catch {}
    try { document.getElementById("chatInput")?.blur(); } catch {}

    if (window.location.hash === "#chat") {
      try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch {}
    }

    try {
      chatLastSeenAt = Date.now();
      localStorage.setItem("mundial_chat_last_seen_at", String(chatLastSeenAt));
      updateChatUnreadBadge();
    } catch {}

    return false;
  };

  window.closeChatPanelNow = window.closeChatMobileClean;
  window.closeChatPanel = function closeChatPanelClean() {
    return window.closeChatMobileClean();
  };

  window.openChatPanel = function openChatPanelClean() {
    const panel = document.getElementById("chatPanel");
    if (!panel) {
      clearChatState();
      return;
    }

    panel.classList.remove("hidden");
    applyChatOpenState();

    if (isMobileChat() && window.location.hash !== "#chat") {
      try { history.pushState({ chatOpen: true }, "", "#chat"); } catch {}
    }

    try { chatOpenedOnce = true; } catch {}
    try {
      chatLastSeenAt = Date.now();
      localStorage.setItem("mundial_chat_last_seen_at", String(chatLastSeenAt));
    } catch {}
    try { updateChatUnreadBadge(); } catch {}
    try { if (typeof chatNotifyNewMessages === "function") chatNotifyNewMessages(); } catch {}
    try { if (typeof renderChatPinnedMessage === "function") renderChatPinnedMessage(); } catch {}

    setTimeout(() => {
      try { scrollChatToBottom(); } catch {}
    }, 50);
  };

  window.openChatImageClean = function openChatImageClean(src, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const viewer = document.getElementById("chatImageViewer");
    const img = document.getElementById("chatImageViewerImg");
    if (!viewer || !img || !src) return false;

    img.src = src;
    viewer.classList.remove("hidden");
    document.body.classList.add("chat-image-viewer-open");
    return false;
  };

  window.closeChatImageClean = function closeChatImageClean(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const viewer = document.getElementById("chatImageViewer");
    const img = document.getElementById("chatImageViewerImg");
    if (viewer) viewer.classList.add("hidden");
    if (img) img.removeAttribute("src");
    document.body.classList.remove("chat-image-viewer-open");
    return false;
  };

  function bindCleanChat() {
    const openBtn = document.getElementById("chatOpenBtn");
    const closeBtn = document.getElementById("chatCloseBtn");
    const messages = document.getElementById("chatMessages");
    const imageClose = document.getElementById("chatImageViewerClose");
    const imageViewer = document.getElementById("chatImageViewer");

    if (openBtn && openBtn.dataset.v89Open !== "1") {
      openBtn.dataset.v89Open = "1";
      openBtn.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        window.openChatPanel();
      });
    }

    if (closeBtn && closeBtn.dataset.v89Close !== "1") {
      closeBtn.dataset.v89Close = "1";
      closeBtn.setAttribute("onclick", "return window.closeChatMobileClean(event)");
      ["click", "touchend"].forEach(name => {
        closeBtn.addEventListener(name, event => window.closeChatMobileClean(event), { passive: false });
      });
    }

    if (messages && messages.dataset.v89Messages !== "1") {
      messages.dataset.v89Messages = "1";

      // Tocar na imagem: abre imagem. Não interfere com texto.
      messages.addEventListener("click", event => {
        const imageButton = event.target.closest?.(".chat-image-button,[data-chat-image-src]");
        if (imageButton) {
          const src = imageButton.dataset.chatImageSrc || imageButton.querySelector?.("img")?.src || "";
          window.openChatImageClean(src, event);
          return;
        }

        // No mobile, tocar na mensagem abre ações, para não depender de long press do Safari.
      });

      // Long press continua disponível, mas sem capturar imagens.
      let pressTimer = null;
      messages.addEventListener("touchstart", event => {
        if (event.target.closest?.(".chat-image-button,[data-chat-image-src]")) return;
        const row = event.target.closest?.(".chat-message-row[data-chat-message]");
        if (!row) return;
        pressTimer = setTimeout(() => {
          if (typeof openChatActionMenu === "function") openChatActionMenu(row.dataset.chatMessage, event);
        }, 520);
      }, { passive: true });

      ["touchend", "touchmove", "touchcancel"].forEach(name => {
        messages.addEventListener(name, () => {
          if (pressTimer) clearTimeout(pressTimer);
          pressTimer = null;
        }, { passive: true });
      });
    }

    if (imageClose && imageClose.dataset.v89Close !== "1") {
      imageClose.dataset.v89Close = "1";
      imageClose.addEventListener("click", event => window.closeChatImageClean(event));
      imageClose.addEventListener("touchend", event => window.closeChatImageClean(event), { passive: false });
    }

    if (imageViewer && imageViewer.dataset.v89Viewer !== "1") {
      imageViewer.dataset.v89Viewer = "1";
      imageViewer.addEventListener("click", event => {
        if (event.target === imageViewer) window.closeChatImageClean(event);
      });
    }
  }

  bindCleanChat();
  document.addEventListener("DOMContentLoaded", () => {
    bindCleanChat();

    const panel = document.getElementById("chatPanel");
    if (panel) panel.classList.add("hidden");
    clearChatState();

    if (window.location.hash === "#chat") {
      try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch {}
    }
  });
  setTimeout(bindCleanChat, 400);

  window.addEventListener("popstate", () => {
    const panel = document.getElementById("chatPanel");
    if (panel && !panel.classList.contains("hidden") && window.location.hash !== "#chat") {
      window.closeChatMobileClean();
    }
  });
})();


// v91 — fixes sobre base v89: menu por toque e imagem acima do chat.
(function setupChatMenuImageV91(){
  if (window.__chatMenuImageV91) return;
  window.__chatMenuImageV91 = true;

  function isMobileV91() {
    return window.matchMedia?.("(max-width: 760px)")?.matches || window.innerWidth <= 760;
  }

  function getMessageIdFromTarget(target) {
    return target?.closest?.(".chat-message-row[data-chat-message], .chat-bubble[data-chat-message]")?.dataset?.chatMessage || "";
  }

  window.openChatImageAboveV91 = function openChatImageAboveV91(src, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const viewer = document.getElementById("chatImageViewer");
    const img = document.getElementById("chatImageViewerImg");
    if (!viewer || !img || !src) return false;

    img.src = src;
    viewer.classList.remove("hidden");
    viewer.style.zIndex = "2147483600";
    document.body.classList.add("chat-image-viewer-open");
    return false;
  };

  window.closeChatImageAboveV91 = function closeChatImageAboveV91(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const viewer = document.getElementById("chatImageViewer");
    const img = document.getElementById("chatImageViewerImg");
    if (viewer) viewer.classList.add("hidden");
    if (img) img.removeAttribute("src");
    document.body.classList.remove("chat-image-viewer-open");
    return false;
  };

  function openMessageMenuV91(id, event) {
    if (!id || typeof openChatActionMenu !== "function") return false;

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    openChatActionMenu(id, event || { clientX: window.innerWidth / 2, clientY: window.innerHeight / 2, target: document.body });
    return false;
  }

  function bindV91() {
    const messages = document.getElementById("chatMessages");
    const viewer = document.getElementById("chatImageViewer");
    const viewerClose = document.getElementById("chatImageViewerClose");

    if (messages && messages.dataset.v91Bound !== "1") {
      messages.dataset.v91Bound = "1";

      // Click normal: imagem abre; mensagem abre menu no mobile.
      messages.addEventListener("click", event => {
        const imageButton = event.target.closest?.(".chat-image-button,[data-chat-image-src]");
        if (imageButton) {
          const src = imageButton.dataset.chatImageSrc || imageButton.querySelector?.("img")?.src || "";
          return window.openChatImageAboveV91(src, event);
        }

      });

      // iPhone/Safari às vezes falha click em elementos dentro de scroll: usar touchend só no container.
      messages.addEventListener("touchend", event => {
        const imageButton = event.target.closest?.(".chat-image-button,[data-chat-image-src]");
        if (imageButton) {
          const src = imageButton.dataset.chatImageSrc || imageButton.querySelector?.("img")?.src || "";
          return window.openChatImageAboveV91(src, event);
        }

      }, { passive: false });

      // PC continua com botão direito.
      messages.addEventListener("contextmenu", event => {
        const id = getMessageIdFromTarget(event.target);
        if (id) return openMessageMenuV91(id, event);
      });
    }

    if (viewerClose && viewerClose.dataset.v91Bound !== "1") {
      viewerClose.dataset.v91Bound = "1";
      viewerClose.addEventListener("click", event => window.closeChatImageAboveV91(event));
      viewerClose.addEventListener("touchend", event => window.closeChatImageAboveV91(event), { passive: false });
    }

    if (viewer && viewer.dataset.v91Bound !== "1") {
      viewer.dataset.v91Bound = "1";
      viewer.addEventListener("click", event => {
        if (event.target === viewer) window.closeChatImageAboveV91(event);
      });
    }
  }

  bindV91();
  document.addEventListener("DOMContentLoaded", bindV91);
  setTimeout(bindV91, 350);
})();


// v92 — Força visualizador de imagem por cima do chat mobile.
(function setupImageAboveChatV92(){
  if (window.__imageAboveChatV92) return;
  window.__imageAboveChatV92 = true;

  const previousOpen = window.openChatImageAboveV91 || window.openChatImageClean || window.openChatImageViewerV90 || window.openChatImageViewer;

  window.openChatImageAboveChatV92 = function openChatImageAboveChatV92(src, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const viewer = document.getElementById("chatImageViewer");
    const img = document.getElementById("chatImageViewerImg");
    if (!viewer || !img || !src) return false;

    img.src = src;
    viewer.classList.remove("hidden");
    viewer.style.visibility = "visible";
    viewer.style.pointerEvents = "auto";
    viewer.style.zIndex = "2147483646";
    document.body.classList.add("chat-image-viewer-open");
    document.documentElement.classList.add("chat-image-viewer-open");

    return false;
  };

  window.closeChatImageAboveChatV92 = function closeChatImageAboveChatV92(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const viewer = document.getElementById("chatImageViewer");
    const img = document.getElementById("chatImageViewerImg");
    if (viewer) viewer.classList.add("hidden");
    if (img) img.removeAttribute("src");

    document.body.classList.remove("chat-image-viewer-open");
    document.documentElement.classList.remove("chat-image-viewer-open");

    return false;
  };

  // Substitui os nomes usados pelas versões anteriores.
  window.openChatImageAboveV91 = window.openChatImageAboveChatV92;
  window.openChatImageClean = window.openChatImageAboveChatV92;
  window.openChatImageViewerV90 = window.openChatImageAboveChatV92;
  window.closeChatImageAboveV91 = window.closeChatImageAboveChatV92;
  window.closeChatImageClean = window.closeChatImageAboveChatV92;
  window.closeChatImageViewerV90 = window.closeChatImageAboveChatV92;

  function bindV92() {
    const viewer = document.getElementById("chatImageViewer");
    const closeBtn = document.getElementById("chatImageViewerClose");
    const messages = document.getElementById("chatMessages");

    if (closeBtn && closeBtn.dataset.v92Bound !== "1") {
      closeBtn.dataset.v92Bound = "1";
      closeBtn.addEventListener("click", event => window.closeChatImageAboveChatV92(event));
      closeBtn.addEventListener("touchend", event => window.closeChatImageAboveChatV92(event), { passive: false });
    }

    if (viewer && viewer.dataset.v92Bound !== "1") {
      viewer.dataset.v92Bound = "1";
      viewer.addEventListener("click", event => {
        if (event.target === viewer) window.closeChatImageAboveChatV92(event);
      });
      viewer.addEventListener("touchend", event => {
        if (event.target === viewer) window.closeChatImageAboveChatV92(event);
      }, { passive: false });
    }

    if (messages && messages.dataset.v92ImageBound !== "1") {
      messages.dataset.v92ImageBound = "1";
      messages.addEventListener("click", event => {
        const imageButton = event.target.closest?.(".chat-image-button,[data-chat-image-src]");
        if (!imageButton) return;
        const src = imageButton.dataset.chatImageSrc || imageButton.querySelector?.("img")?.src || "";
        if (src) return window.openChatImageAboveChatV92(src, event);
      });
      messages.addEventListener("touchend", event => {
        const imageButton = event.target.closest?.(".chat-image-button,[data-chat-image-src]");
        if (!imageButton) return;
        const src = imageButton.dataset.chatImageSrc || imageButton.querySelector?.("img")?.src || "";
        if (src) return window.openChatImageAboveChatV92(src, event);
      }, { passive: false });
    }
  }

  bindV92();
  document.addEventListener("DOMContentLoaded", bindV92);
  setTimeout(bindV92, 350);
})();


// v93 — visualizador usa SEMPRE o src real do <img>, seguro no iPhone/Safari.
(function setupChatImageSrcRealV93(){
  if (window.__chatImageSrcRealV93) return;
  window.__chatImageSrcRealV93 = true;

  function getRealImageSrcFromButton(button) {
    const img = button?.querySelector?.("img.chat-image, img");
    return img?.currentSrc || img?.src || img?.getAttribute?.("src") || "";
  }

  window.openChatImageSrcRealV93 = function openChatImageSrcRealV93(src, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    }

    const viewer = document.getElementById("chatImageViewer");
    const img = document.getElementById("chatImageViewerImg");
    if (!viewer || !img || !src) return false;

    viewer.classList.remove("hidden");
    viewer.style.display = "flex";
    viewer.style.visibility = "visible";
    viewer.style.opacity = "1";
    viewer.style.pointerEvents = "auto";
    viewer.style.zIndex = "2147483646";

    img.style.display = "block";
    img.style.visibility = "visible";
    img.style.opacity = "1";
    img.style.maxWidth = "96vw";
    img.style.maxHeight = "86dvh";
    img.style.objectFit = "contain";
    img.style.zIndex = "2147483646";

    img.onload = () => {
      img.style.display = "block";
      img.style.visibility = "visible";
      img.style.opacity = "1";
    };

    img.onerror = () => {
      console.warn("Imagem do chat não carregou no viewer.");
    };

    img.src = src;

    document.body.classList.add("chat-image-viewer-open");
    document.documentElement.classList.add("chat-image-viewer-open");

    return false;
  };

  window.closeChatImageSrcRealV93 = function closeChatImageSrcRealV93(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    }

    const viewer = document.getElementById("chatImageViewer");
    const img = document.getElementById("chatImageViewerImg");

    if (viewer) {
      viewer.classList.add("hidden");
      viewer.style.display = "";
      viewer.style.visibility = "";
      viewer.style.opacity = "";
      viewer.style.pointerEvents = "";
    }

    if (img) {
      img.removeAttribute("src");
      img.onload = null;
      img.onerror = null;
    }

    document.body.classList.remove("chat-image-viewer-open");
    document.documentElement.classList.remove("chat-image-viewer-open");

    return false;
  };

  window.openChatImageAboveChatV92 = window.openChatImageSrcRealV93;
  window.openChatImageAboveV91 = window.openChatImageSrcRealV93;
  window.openChatImageClean = window.openChatImageSrcRealV93;
  window.openChatImageViewerV90 = window.openChatImageSrcRealV93;

  window.closeChatImageAboveChatV92 = window.closeChatImageSrcRealV93;
  window.closeChatImageAboveV91 = window.closeChatImageSrcRealV93;
  window.closeChatImageClean = window.closeChatImageSrcRealV93;
  window.closeChatImageViewerV90 = window.closeChatImageSrcRealV93;

  function bindV93() {
    const messages = document.getElementById("chatMessages");
    const viewer = document.getElementById("chatImageViewer");
    const closeBtn = document.getElementById("chatImageViewerClose");

    if (messages && messages.dataset.v93ImageBound !== "1") {
      messages.dataset.v93ImageBound = "1";

      const openFromEvent = event => {
        const button = event.target.closest?.(".chat-image-button");
        if (!button) return;

        const src = getRealImageSrcFromButton(button);
        if (!src) return;

        return window.openChatImageSrcRealV93(src, event);
      };

      messages.addEventListener("click", openFromEvent, { capture: true });
      messages.addEventListener("touchend", openFromEvent, { capture: true, passive: false });
    }

    if (closeBtn && closeBtn.dataset.v93Bound !== "1") {
      closeBtn.dataset.v93Bound = "1";
      closeBtn.addEventListener("click", event => window.closeChatImageSrcRealV93(event));
      closeBtn.addEventListener("touchend", event => window.closeChatImageSrcRealV93(event), { passive: false });
    }

    if (viewer && viewer.dataset.v93Bound !== "1") {
      viewer.dataset.v93Bound = "1";
      viewer.addEventListener("click", event => {
        if (event.target === viewer) window.closeChatImageSrcRealV93(event);
      });
      viewer.addEventListener("touchend", event => {
        if (event.target === viewer) window.closeChatImageSrcRealV93(event);
      }, { passive: false });
    }
  }

  bindV93();
  document.addEventListener("DOMContentLoaded", bindV93);
  setTimeout(bindV93, 350);
})();


// v96 - interacao do menu: long press correto no mobile e clique direito no PC.
(function setupChatInteractionV96(){
  if (window.__chatInteractionV96) return;
  window.__chatInteractionV96 = true;

  let pressTimer = null;
  let pressStart = null;
  let pressOpened = false;
  let suppressNextClickUntil = 0;

  function isTouchLike(event) {
    return event?.pointerType === "touch" || event?.pointerType === "pen" || event?.type?.startsWith("touch");
  }

  function pointFromEvent(event) {
    const touch = event?.changedTouches?.[0] || event?.touches?.[0];
    return {
      x: Number(touch?.clientX ?? event?.clientX ?? 0),
      y: Number(touch?.clientY ?? event?.clientY ?? 0)
    };
  }

  function rowFromEvent(event) {
    return event?.target?.closest?.(".chat-message-row[data-chat-message]") || null;
  }

  function clearPress() {
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
    pressStart = null;
    pressOpened = false;
  }

  function openMenuForRow(row, point) {
    const id = row?.dataset?.chatMessage || "";
    if (!id || typeof openChatActionMenu !== "function") return;
    if (pressTimer) clearTimeout(pressTimer);
    pressTimer = null;
    pressOpened = true;
    suppressNextClickUntil = Date.now() + 1500;
    openChatActionMenu(id, {
      clientX: point.x,
      clientY: point.y,
      target: row,
      preventDefault() {},
      stopPropagation() {}
    });
  }

  function bindV96() {
    const messages = document.getElementById("chatMessages");
    if (!messages || messages.dataset.v96Bound === "1") return;
    messages.dataset.v96Bound = "1";

    messages.addEventListener("pointerdown", event => {
      if (!isTouchLike(event)) return;
      if (event.target.closest?.(".chat-image-button,[data-chat-image-src]")) return;

      const row = rowFromEvent(event);
      if (!row) {
        if (typeof closeChatActionMenu === "function") closeChatActionMenu();
        return;
      }

      event.stopImmediatePropagation();
      clearPress();

      const point = pointFromEvent(event);
      pressStart = { ...point, row };
      pressTimer = setTimeout(() => {
        if (!pressStart || pressStart.row !== row) return;
        if (navigator.vibrate) {
          try { navigator.vibrate(15); } catch {}
        }
        openMenuForRow(row, point);
      }, 620);
    }, { capture: true, passive: false });

    messages.addEventListener("touchstart", event => {
      if (event.target.closest?.(".chat-image-button,[data-chat-image-src]")) return;
      if (!rowFromEvent(event)) return;
      event.stopImmediatePropagation();
    }, { capture: true, passive: true });

    const cancelIfMoved = event => {
      if (!pressStart) return;
      const point = pointFromEvent(event);
      if (Math.abs(point.x - pressStart.x) > 10 || Math.abs(point.y - pressStart.y) > 10) {
        clearPress();
      }
    };

    messages.addEventListener("pointermove", cancelIfMoved, { capture: true, passive: true });
    messages.addEventListener("touchmove", cancelIfMoved, { capture: true, passive: true });
    messages.addEventListener("scroll", clearPress, { passive: true });

    const finishTouch = event => {
      if (event.target.closest?.(".chat-image-button,[data-chat-image-src]")) return;
      if (Date.now() < suppressNextClickUntil) {
        event.preventDefault();
        event.stopImmediatePropagation();
        clearPress();
        return;
      }
      const hadPress = Boolean(pressTimer || pressStart || pressOpened);
      const opened = pressOpened;
      clearPress();
      if (hadPress) event.stopImmediatePropagation();
      if (!opened && typeof closeChatActionMenu === "function") closeChatActionMenu();
    };

    messages.addEventListener("pointerup", finishTouch, { capture: true, passive: false });
    messages.addEventListener("pointercancel", finishTouch, { capture: true, passive: false });
    messages.addEventListener("touchend", finishTouch, { capture: true, passive: false });
    messages.addEventListener("touchcancel", finishTouch, { capture: true, passive: false });

    messages.addEventListener("click", event => {
      if (event.target.closest?.(".chat-image-button,[data-chat-image-src]")) return;
      if (Date.now() < suppressNextClickUntil) {
        event.stopImmediatePropagation();
        return;
      }
      if (rowFromEvent(event)) {
        event.stopImmediatePropagation();
        if (typeof closeChatActionMenu === "function") closeChatActionMenu();
      }
    }, { capture: true });

    messages.addEventListener("contextmenu", event => {
      const row = rowFromEvent(event);
      if (!row || event.target.closest?.(".chat-image-button,[data-chat-image-src]")) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openMenuForRow(row, pointFromEvent(event));
    }, { capture: true });
  }

  function closeMenuOnOutsidePress(event) {
    const menu = document.getElementById("chatActionMenu");
    if (!menu || menu.classList.contains("hidden")) return;
    if (menu.contains(event.target)) return;
    if (event.type === "click" && Date.now() < suppressNextClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (typeof closeChatActionMenu === "function") closeChatActionMenu();
    if (event.target.closest?.("#chatPanel, #chatMessages, .chat-message-row")) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  document.addEventListener("pointerdown", closeMenuOnOutsidePress, { capture: true });
  document.addEventListener("touchstart", closeMenuOnOutsidePress, { capture: true, passive: false });

  bindV96();
  document.addEventListener("DOMContentLoaded", bindV96);
  setTimeout(bindV96, 350);
})();


// v99 - abertura do chat mais rapida e sem bloquear no primeiro toque.
(function setupChatOpenFastV99(){
  if (window.__chatOpenFastV99) return;
  window.__chatOpenFastV99 = true;

  function isMobileV99() {
    return window.matchMedia?.("(max-width: 760px)")?.matches || window.innerWidth <= 760;
  }

  function applyOpenClasses(open) {
    const mobile = isMobileV99();
    document.body.classList.toggle("chat-mobile-page-open", Boolean(open && mobile));
    document.body.classList.toggle("chat-fullscreen-open", Boolean(open && mobile));
    document.body.classList.toggle("chat-window-open", Boolean(open && !mobile));
    document.documentElement.classList.toggle("chat-mobile-page-open", Boolean(open && mobile));
  }

  window.openChatPanel = function openChatPanelFastV99(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    }

    const panel = document.getElementById("chatPanel");
    const messages = document.getElementById("chatMessages");
    if (!panel) return false;

    panel.classList.remove("hidden");
    panel.style.pointerEvents = "auto";
    applyOpenClasses(true);

    if (isMobileV99() && window.location.hash !== "#chat") {
      try { history.pushState({ chatOpen: true }, "", "#chat"); } catch {}
    }

    try { if (typeof setupChatUi === "function") setupChatUi(); } catch {}
    try { if (typeof renderChatTabs === "function") renderChatTabs(); } catch {}
    try { if (typeof closeChatActionMenu === "function") closeChatActionMenu(); } catch {}

    try {
      chatOpenedOnce = true;
      chatLastSeenAt = Date.now();
      localStorage.setItem("mundial_chat_last_seen_at", String(chatLastSeenAt));
    } catch {}

    if (!currentUser) {
      try { if (typeof renderChatMessages === "function") renderChatMessages(); } catch {}
    } else if (messages && (!Array.isArray(chatMessagesCache) || !chatMessagesCache.length)) {
      messages.innerHTML = `<div class="empty small-empty">A carregar chat...</div>`;
    }

    try { if (typeof startChatListenerSafe === "function") startChatListenerSafe(); } catch {}
    try { if (typeof startPinnedChatListenerSafe === "function") startPinnedChatListenerSafe(); } catch {}
    try { if (typeof startChatTypingListenerSafe === "function") startChatTypingListenerSafe(); } catch {}
    try { if (typeof updateChatUnreadBadge === "function") updateChatUnreadBadge(); } catch {}
    try { if (typeof chatNotifyNewMessages === "function") chatNotifyNewMessages(); } catch {}
    try { if (typeof renderChatPinnedMessage === "function") renderChatPinnedMessage(); } catch {}

    setTimeout(() => {
      try { if (typeof scrollChatToBottom === "function") scrollChatToBottom(); } catch {}
      if (!isMobileV99()) {
        try { document.getElementById("chatInput")?.focus(); } catch {}
      }
    }, 40);

    setTimeout(() => {
      try {
        if ((!Array.isArray(chatMessagesCache) || !chatMessagesCache.length) && typeof loadChatMessagesOnce === "function") {
          loadChatMessagesOnce();
        }
      } catch {}
    }, 450);

    return false;
  };

  function bindV99() {
    const openBtn = document.getElementById("chatOpenBtn");
    if (!openBtn || openBtn.dataset.v99Open === "1") return;
    openBtn.dataset.v99Open = "1";
    openBtn.addEventListener("click", event => window.openChatPanel(event), { capture: true });
    openBtn.addEventListener("touchend", event => window.openChatPanel(event), { capture: true, passive: false });
  }

  bindV99();
  document.addEventListener("DOMContentLoaded", bindV99);
  setTimeout(bindV99, 350);
})();


// v100 - botoes do menu de chat respondem no mobile sem bloquear.
(function setupChatActionButtonsV100(){
  if (window.__chatActionButtonsV100) return;
  window.__chatActionButtonsV100 = true;

  function handleAction(event, action) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    }

    const id = chatActionMessageId;
    closeChatActionMenu();
    if (!id) return false;

    if (action === "reply") setChatReply(id);
    if (action === "pin") pinChatMessage(id);
    if (action === "delete") deleteChatMessage(id);
    return false;
  }

  function bindButton(button, action) {
    if (!button || button.dataset.v100Bound === "1") return;
    button.dataset.v100Bound = "1";
    ["click", "pointerup", "touchend"].forEach(name => {
      button.addEventListener(name, event => handleAction(event, action), { capture: true, passive: false });
    });
  }

  function bindV100() {
    bindButton(document.getElementById("chatActionReplyBtn"), "reply");
    bindButton(document.getElementById("chatActionPinBtn"), "pin");
    bindButton(document.getElementById("chatActionDeleteBtn"), "delete");
  }

  bindV100();
  document.addEventListener("DOMContentLoaded", bindV100);
  setTimeout(bindV100, 350);
})();


// v103 - recupera o chat quando algum estado antigo deixa o painel sem toque.
(function setupChatTouchRecoveryV103(){
  if (window.__chatTouchRecoveryV103) return;
  window.__chatTouchRecoveryV103 = true;

  let recoveryTimer = null;

  function isMobileV103() {
    return window.matchMedia?.("(max-width: 760px)")?.matches || window.innerWidth <= 760;
  }

  function chatIsOpen() {
    const panel = document.getElementById("chatPanel");
    return Boolean(panel && !panel.classList.contains("hidden"));
  }

  function closeImageViewerIfHiddenOrIdle() {
    const viewer = document.getElementById("chatImageViewer");
    const img = document.getElementById("chatImageViewerImg");
    if (!viewer) return;
    if (viewer.classList.contains("hidden")) {
      viewer.style.pointerEvents = "none";
      viewer.style.visibility = "";
      viewer.style.opacity = "";
      viewer.style.display = "";
      document.body.classList.remove("chat-image-viewer-open");
      document.documentElement.classList.remove("chat-image-viewer-open");
      if (img && !viewer.classList.contains("hidden")) img.removeAttribute("src");
    }
  }

  function forceChatInteractive() {
    const panel = document.getElementById("chatPanel");
    if (!panel || panel.classList.contains("hidden")) return;

    const mobile = isMobileV103();
    document.body.classList.toggle("chat-mobile-page-open", mobile);
    document.body.classList.toggle("chat-fullscreen-open", mobile);
    document.body.classList.toggle("chat-window-open", !mobile);
    document.documentElement.classList.toggle("chat-mobile-page-open", mobile);

    panel.style.pointerEvents = "auto";
    panel.style.visibility = "visible";
    panel.style.opacity = "1";

    panel.querySelectorAll("button,input,textarea,select,.chat-messages,.chat-form,.chat-room-switch").forEach(el => {
      el.style.pointerEvents = "auto";
    });

    closeImageViewerIfHiddenOrIdle();

    if (typeof setupChatUi === "function") {
      try { setupChatUi(); } catch {}
    }
    if (typeof setupChatCloseButtonSafe === "function") {
      try { setupChatCloseButtonSafe(); } catch {}
    }
  }

  function scheduleRecovery() {
    if (recoveryTimer) clearTimeout(recoveryTimer);
    forceChatInteractive();
    recoveryTimer = setTimeout(forceChatInteractive, 80);
  }

  const previousOpen = window.openChatPanel;
  window.openChatPanel = function openChatPanelRecoveredV103(event) {
    const result = typeof previousOpen === "function" ? previousOpen(event) : false;
    scheduleRecovery();
    setTimeout(scheduleRecovery, 350);
    return result;
  };

  document.addEventListener("pointerdown", event => {
    if (!chatIsOpen()) return;
    if (event.target.closest?.("#chatPanel, #chatActionMenu, #chatImageViewer")) scheduleRecovery();
  }, { capture: true, passive: true });

  document.addEventListener("touchstart", event => {
    if (!chatIsOpen()) return;
    if (event.target.closest?.("#chatPanel, #chatActionMenu, #chatImageViewer")) scheduleRecovery();
  }, { capture: true, passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && chatIsOpen()) scheduleRecovery();
  });

  window.addEventListener("resize", () => {
    if (chatIsOpen()) scheduleRecovery();
  });

  setInterval(() => {
    if (chatIsOpen()) forceChatInteractive();
  }, 2500);
})();


// v98 — Sistema de chat ativado/desativado por admin.
let chatSystemEnabled = false;
let chatSettingsUnsubscribeV98 = null;
let chatSettingsLoadedV98 = false;

function chatSettingsDocRefV98() {
  if (!db || !firebaseApi) return null;
  const { doc } = firebaseApi;
  if (typeof doc !== "function") return null;
  return doc(db, "appSettings", "chatSystem");
}

function isCurrentUserAdminV98() {
  try {
    if (typeof isCurrentUserAdmin === "function") return Boolean(isCurrentUserAdmin());
  } catch {}

  try {
    if (typeof isAdmin === "function") return Boolean(isAdmin());
  } catch {}

  try {
    if (typeof currentUserIsAdmin !== "undefined") return Boolean(currentUserIsAdmin);
  } catch {}

  try {
    const email = String(currentUser?.email || "").toLowerCase().trim();
    const cfg = window.APP_CONFIG || window.appConfig || {};
    const admins = cfg.adminEmails || cfg.admins || [];
    if (Array.isArray(admins) && admins.map(x => String(x).toLowerCase().trim()).includes(email)) return true;
  } catch {}

  try {
    const email = String(currentUser?.email || "").toLowerCase().trim();
    if (Array.isArray(window.adminEmails) && window.adminEmails.map(x => String(x).toLowerCase().trim()).includes(email)) return true;
  } catch {}

  try {
    const email = String(currentUser?.email || "").toLowerCase().trim();
    if (Array.isArray(APP_CONFIG?.adminEmails) && APP_CONFIG.adminEmails.map(x => String(x).toLowerCase().trim()).includes(email)) return true;
  } catch {}

  return false;
}

function setChatVisibleV98(enabled) {
  chatSystemEnabled = Boolean(enabled);

  const chatBtn = document.getElementById("chatOpenBtn");
  const chatPanel = document.getElementById("chatPanel");
  const adminToggle = document.getElementById("chatAdminToggleBtn");
  const adminLabel = document.getElementById("chatAdminToggleLabel");
  const isAdmin = isCurrentUserAdminV98();

  if (chatBtn) {
    chatBtn.classList.toggle("hidden", !chatSystemEnabled);
    chatBtn.style.display = chatSystemEnabled ? "" : "none";
  }

  if (!chatSystemEnabled) { try { stopChatSafe(); } catch {} }

  if (!chatSystemEnabled && chatPanel) {
    chatPanel.classList.add("hidden");
    try { document.body.classList.remove("chat-fullscreen-open", "chat-mobile-page-open", "chat-window-open"); } catch {}
    try { document.documentElement.classList.remove("chat-mobile-page-open"); } catch {}
  }

  if (adminToggle) {
    adminToggle.classList.toggle("hidden", !isAdmin);
    adminToggle.style.display = isAdmin ? "" : "none";
    adminToggle.classList.toggle("is-on", chatSystemEnabled);
    adminToggle.classList.toggle("is-off", !chatSystemEnabled);
  }

  if (adminLabel) adminLabel.textContent = chatSystemEnabled ? "Ativo" : "Desativo";
}

async function saveChatSystemEnabledV98(enabled) {
  if (!isCurrentUserAdminV98()) {
    try { toast("Só o admin pode alterar o chat."); } catch {}
    return;
  }

  if (!db || !firebaseApi || storageMode !== "firebase") {
    try { toast("Firebase não está ligado."); } catch {}
    return;
  }

  try {
    const ref = chatSettingsDocRefV98();
    if (!ref) throw new Error("Sem referência Firebase");

    const { setDoc, serverTimestamp } = firebaseApi;
    await setDoc(ref, {
      enabled: Boolean(enabled),
      updatedAt: typeof serverTimestamp === "function" ? serverTimestamp() : new Date().toISOString(),
      updatedBy: currentUser?.uid || "",
      updatedByEmail: String(currentUser?.email || "").toLowerCase()
    }, { merge: true });

    setChatVisibleV98(Boolean(enabled));
    try { toast(Boolean(enabled) ? "Chat ativado." : "Chat desativado."); } catch {}
  } catch (error) {
    console.error("Falhou guardar estado do chat:", error);
    try { toast("Não consegui guardar o estado do chat."); } catch {}
  }
}

async function loadChatSystemEnabledV98() {
  setChatVisibleV98(false);

  if (!db || !firebaseApi || storageMode !== "firebase" || !currentUser) {
    chatSettingsLoadedV98 = false;
    setChatVisibleV98(false);
    return;
  }

  try {
    if (typeof chatSettingsUnsubscribeV98 === "function") {
      try { chatSettingsUnsubscribeV98(); } catch {}
      chatSettingsUnsubscribeV98 = null;
    }

    const ref = chatSettingsDocRefV98();
    if (!ref) throw new Error("Sem referência Firebase");

    const { onSnapshot } = firebaseApi;

    if (typeof onSnapshot === "function") {
      chatSettingsUnsubscribeV98 = onSnapshot(ref, snap => {
        chatSettingsLoadedV98 = true;
        const data = snap.exists?.() ? (snap.data?.() || {}) : {};
        setChatVisibleV98(Boolean(data.enabled));
      }, error => {
        console.warn("Estado do chat não carregou:", error);
        setChatVisibleV98(false);
      });
    }
  } catch (error) {
    console.warn("Erro ao carregar estado do chat:", error);
    setChatVisibleV98(false);
  }
}

function setupChatAdminToggleV98() {
  const btn = document.getElementById("chatAdminToggleBtn");
  if (btn && btn.dataset.v98Bound !== "1") {
    btn.dataset.v98Bound = "1";
    btn.addEventListener("click", async event => {
      event.preventDefault();
      event.stopPropagation();
      await saveChatSystemEnabledV98(!chatSystemEnabled);
    });
  }

  setChatVisibleV98(chatSystemEnabled);
}

// Bloqueia abertura se estiver desativado.
(function wrapChatOpenWithToggleV98(){
  if (window.__chatOpenToggleWrappedV98) return;
  window.__chatOpenToggleWrappedV98 = true;

  const originalWindowOpen = typeof window.openChatPanel === "function" ? window.openChatPanel : null;

  window.openChatPanel = function openChatPanelToggleV98(...args) {
    if (!chatSystemEnabled) {
      try { toast("Chat desativado pelo admin."); } catch {}
      return;
    }

    if (typeof originalWindowOpen === "function") return originalWindowOpen.apply(this, args);
    try {
      const panel = document.getElementById("chatPanel");
      if (panel) panel.classList.remove("hidden");
    } catch {}
  };
})();

document.addEventListener("click", event => {
  const chatBtn = event.target.closest?.("#chatOpenBtn");
  if (!chatBtn) return;

  if (!chatSystemEnabled) {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
    try { toast("Chat desativado pelo admin."); } catch {}
    return false;
  }
}, { capture: true });

document.addEventListener("DOMContentLoaded", () => {
  setupChatAdminToggleV98();
  setChatVisibleV98(false);
  setTimeout(setupChatAdminToggleV98, 300);
});

(function startChatSettingsWatcherV98(){
  if (window.__chatSettingsWatcherV98) return;
  window.__chatSettingsWatcherV98 = true;

  const tick = () => {
    setupChatAdminToggleV98();

    if (currentUser && db && firebaseApi && storageMode === "firebase") {
      if (!chatSettingsLoadedV98) loadChatSystemEnabledV98();
    } else {
      chatSettingsLoadedV98 = false;
      setChatVisibleV98(false);
    }
  };

  setInterval(tick, 60000);
  setTimeout(tick, 800);
  setTimeout(tick, 3000);
})();


// v107 — diagnóstico rápido no console.
window.firestoreReadsOptimizerInfo = function firestoreReadsOptimizerInfo() {
  return {
    realtimeListeners: Array.isArray(realtimeUnsubscribers) ? realtimeUnsubscribers.length : null,
    chatListener: Boolean(chatUnsubscribe),
    pinnedChatListener: Boolean(chatPinnedUnsubscribe),
    typingChatListener: Boolean(chatTypingUnsubscribe),
    presenceEveryMs: typeof PRESENCE_UPDATE_MS !== "undefined" ? PRESENCE_UPDATE_MS : null,
    onlineUsersEveryMs: typeof ONLINE_USERS_REFRESH_MS !== "undefined" ? ONLINE_USERS_REFRESH_MS : null,
    chatLimit: typeof CHAT_LIMIT !== "undefined" ? CHAT_LIMIT : null
  };
};

setTimeout(installFirestoreEconomyModeV114, 800);
setTimeout(installFirestoreEconomyModeV114, 1800);
setTimeout(installFirestoreEconomyModeV114, 3500);

let v115PesquisarTodosInterval = null;
document.addEventListener("DOMContentLoaded", () => {
  if (!v115PesquisarTodosInterval && typeof addSearchButtonsToResultCards === "function") {
    v115PesquisarTodosInterval = setInterval(addSearchButtonsToResultCards, 5000);
  }
});


// v116 — barra de pesquisa funcional sem guardar texto.
function setupSearchBarNoPersistV116() {
  const candidates = [
    "searchInput",
    "searchBox",
    "globalSearchInput",
    "calendarSearchInput",
    "gameSearchInput",
    "gamesSearchInput",
    "topSearchInput"
  ];

  let input = null;
  for (const id of candidates) {
    const el = document.getElementById(id);
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
      input = el;
      break;
    }
  }

  if (!input) {
    input = Array.from(document.querySelectorAll('input[type="search"], input[placeholder*="Pesquisar" i], input[placeholder*="Procurar" i], input[aria-label*="Pesquisar" i]'))[0] || null;
  }

  if (!input || input.dataset.noPersistV116 === "1") return;

  input.dataset.noPersistV116 = "1";
  input.autocomplete = "off";
  input.setAttribute("data-lpignore", "true");

  // Não recuperar texto antigo.
  input.value = "";
  searchText = "";

  const applySearch = () => {
    searchText = String(input.value || "").trim();
    try { renderCalendar(); } catch {}
    try { renderCalendarFilterState(); } catch {}
  };

  input.addEventListener("input", applySearch);
  input.addEventListener("search", applySearch);
  input.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      input.value = "";
      searchText = "";
      applySearch();
      input.blur();
    }
  });

  // Ao fechar/atualizar, não deixa o texto ficar guardado no input pelo browser.
  window.addEventListener("beforeunload", () => {
    try { input.value = ""; searchText = ""; } catch {}
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupSearchBarNoPersistV116();
  setTimeout(setupSearchBarNoPersistV116, 500);
  setTimeout(setupSearchBarNoPersistV116, 1500);
});
document.addEventListener("click", () => setTimeout(setupSearchBarNoPersistV116, 120));


let v117PesquisarReapply = null;
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(addSearchButtonsToResultCards, 400);
  setTimeout(addSearchButtonsToResultCards, 1200);
  if (!v117PesquisarReapply) {
    v117PesquisarReapply = setInterval(addSearchButtonsToResultCards, 4000);
  }
});
document.addEventListener("click", () => setTimeout(addSearchButtonsToResultCards, 150));


// v122 — Ajuda scroll da Fase Final mobile.
function fixKnockoutMobileScrollV122() {
  try {
    const tab = document.getElementById("knockoutTab");
    const host = document.getElementById("knockoutMobileV121");
    const list = document.querySelector("#knockoutMobileV121 .ko-mobile-list");

    if (tab) tab.classList.add("ko-mobile-scroll-page-v122");
    if (host) host.classList.add("ko-mobile-scroll-host-v122");
    if (list) list.classList.add("ko-mobile-scroll-list-v122");
  } catch (error) {
    console.warn("Fase final mobile scroll v122 falhou:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(fixKnockoutMobileScrollV122, 400);
  setTimeout(fixKnockoutMobileScrollV122, 1200);
});

document.addEventListener("click", () => setTimeout(fixKnockoutMobileScrollV122, 120));
