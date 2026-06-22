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

  if (typeof setActiveAppSectionV125 === "function") {
    setActiveAppSectionV125(getActiveAppSectionV125());
    cleanupKnockoutMobileOutsidePageV125();
  }
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
  if (typeof setActiveAppSectionV125 === "function") setActiveAppSectionV125("knockoutTab");
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



// v125 — Rastreador simples da página ativa.
let activeAppSectionV125 = "";

function setActiveAppSectionV125(sectionId) {
  activeAppSectionV125 = sectionId || "";
  document.body.dataset.activeSectionV125 = activeAppSectionV125;

  if (activeAppSectionV125 !== "knockoutTab") {
    document.getElementById("knockoutMobileV121")?.remove();
  }
}

function getActiveAppSectionV125() {
  const activeByClass = document.querySelector(".app-section.active, .tab-panel.active, .page.active, section.active");
  if (activeByClass?.id) return activeByClass.id;

  const visibleCandidates = ["dashboardTab","calendarTab","scoreTab","betsTab","knockoutTab","adminTab","settingsTab","usersTab"];
  for (const id of visibleCandidates) {
    const el = document.getElementById(id);
    if (!el) continue;
    const style = getComputedStyle(el);
    if (style.display !== "none" && style.visibility !== "hidden" && el.offsetHeight > 0) return id;
  }

  return activeAppSectionV125 || "";
}

function canRenderKnockoutMobileV125() {
  const tab = document.getElementById("knockoutTab");
  if (!tab) return false;
  const active = getActiveAppSectionV125();
  return active === "knockoutTab" || tab.classList.contains("active");
}

function cleanupKnockoutMobileOutsidePageV125() {
  if (!canRenderKnockoutMobileV125()) {
    document.getElementById("knockoutMobileV121")?.remove();
  }
}

document.addEventListener("click", event => {
  const target = event.target.closest("[data-section], [data-tab], [data-page], [data-target], [href^='#']");
  if (!target) {
    setTimeout(cleanupKnockoutMobileOutsidePageV125, 80);
    return;
  }

  const value =
    target.dataset.section ||
    target.dataset.tab ||
    target.dataset.page ||
    target.dataset.target ||
    (target.getAttribute("href") || "").replace("#", "");

  const map = {
    dashboard: "dashboardTab",
    calendar: "calendarTab",
    jogos: "calendarTab",
    score: "scoreTab",
    pontuacao: "scoreTab",
    bets: "betsTab",
    apostas: "betsTab",
    knockout: "knockoutTab",
    fasefinal: "knockoutTab",
    final: "knockoutTab",
    admin: "adminTab",
    settings: "settingsTab"
  };

  const clean = String(value || "").replace("#", "").replace(".", "").trim();
  setActiveAppSectionV125(map[clean] || clean);
  setTimeout(cleanupKnockoutMobileOutsidePageV125, 120);
});

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    setActiveAppSectionV125(getActiveAppSectionV125());
    cleanupKnockoutMobileOutsidePageV125();
  }, 300);
});

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

  const koTabForGuardV127 = document.getElementById("knockoutTab");
  const activePanelForGuardV127 = document.querySelector(".app-section.active, .tab-panel.active, .page.active, section.active");
  if (activePanelForGuardV127 && activePanelForGuardV127.id && activePanelForGuardV127.id !== "knockoutTab") {
    document.getElementById("knockoutMobileV121")?.remove();
    return;
  }
  if (!koTabForGuardV127) return;


  if (typeof canRenderKnockoutMobileV125 === "function" && !canRenderKnockoutMobileV125()) {
    document.getElementById("knockoutMobileV121")?.remove();
    return;
  }


  const tab = document.getElementById("knockoutTab");
  if (!tab) return;

  const isVisible = tab.classList.contains("active") || tab.offsetParent !== null || getComputedStyle(tab).display !== "none";
  const adminTab = document.getElementById("adminTab");
  const adminVisible = adminTab && (adminTab.classList.contains("active") || adminTab.offsetParent !== null) && getComputedStyle(adminTab).display !== "none";
  if (adminVisible && !tab.classList.contains("active")) {
    document.getElementById("knockoutMobileV121")?.remove();
    return;
  }

let host = document.getElementById("knockoutMobileV121");
  if (host && host.parentElement !== tab) host.remove();
  host = document.getElementById("knockoutMobileV121");
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



// v127 — limpeza segura: Fase Final mobile só dentro da página Fase Final.
function cleanupKnockoutMobileOutsidePageV127() {
  try {
    const koTab = document.getElementById("knockoutTab");
    const mobile = document.getElementById("knockoutMobileV121");
    if (!mobile) return;

    if (!koTab || mobile.parentElement !== koTab) {
      mobile.remove();
      return;
    }

    const activePanel = document.querySelector(".app-section.active, .tab-panel.active, .page.active, section.active");
    if (activePanel && activePanel.id && activePanel.id !== "knockoutTab") {
      mobile.remove();
      return;
    }

    if (koTab.classList && !koTab.classList.contains("active")) {
      const style = getComputedStyle(koTab);
      if (style.display === "none" || style.visibility === "hidden") mobile.remove();
    }
  } catch (error) {
    console.warn("cleanup KO mobile v127 falhou:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(cleanupKnockoutMobileOutsidePageV127, 300);
  setTimeout(cleanupKnockoutMobileOutsidePageV127, 1200);
});
document.addEventListener("click", () => setTimeout(cleanupKnockoutMobileOutsidePageV127, 120));
