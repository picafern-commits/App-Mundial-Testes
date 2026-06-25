// v139 football-data resultados automaticos via Firebase Function
const APP_CONFIG = window.MUNDIAL_CONFIG || {};
const ADMIN_PIN = APP_CONFIG.adminPin || "1234";
const STORAGE_KEY = "mundial_pontos_2026_import_id_jogo_v32";
const PENDING_FIREBASE_KEY = `${STORAGE_KEY}_pending_games_v1`;
const PENDING_FULL_SYNC_KEY = `${STORAGE_KEY}_pending_full_sync_v1`;
const PENDING_DELETE_BETS_KEY = `${STORAGE_KEY}_pending_delete_bets_v1`;
const PENDING_BETS_KEY = `${STORAGE_KEY}_pending_bets_v1`;
const PENDING_SETTINGS_KEY = `${STORAGE_KEY}_pending_settings_v1`;
const PORTUGAL_TZ = "Europe/Lisbon";
const MAX_SYSTEM_LOGS = 200;
const LOGS_PIN = "25959";
const APP_VERSION_LABEL = "v252";
const NOTIFICATIONS_READ_KEY_V164 = `${STORAGE_KEY}_notifications_read_v164`;
const PUSH_DEVICE_KEY_V165 = `${STORAGE_KEY}_push_device_id_v165`;
const PUSH_OPT_IN_DISMISSED_KEY_V182 = `${STORAGE_KEY}_push_opt_in_dismissed_v182`;

let db = null;
let firebaseApi = null;
let firebaseAuth = null;
let firebaseAuthApi = null;
let firebaseMessaging = null;
let firebaseMessagingApi = null;
let firebaseAppInstance = null;
let lastFirebaseInitError = "";
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
let firebaseReconnectTimer = null;
let firebaseLoadInFlight = null;
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
let logsUnlocked = sessionStorage.getItem("mundial_logs_unlocked_v146") === "1";
let onlineUsersIntervalId = null;
let pushStatsCacheV187 = { loadedAt: 0, tokens: [], tests: [], loading: false };
let firebaseReadyPromise = null;
let authGateStarted = false;

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
  "Portugal": "",
  "África do Sul": "",
  "México": "",
  "Coreia do Sul": "",
  "Chéquia": "",
  "Canadá": "",
  "Bósnia": "",
  "Estados Unidos": "",
  "Paraguai": "",
  "Qatar": "",
  "Suíça": "",
  "Brasil": "",
  "Marrocos": "",
  "Haiti": "",
  "Escócia": "",
  "Austrália": "",
  "Turquia": "",
  "Alemanha": "",
  "Curaçao": "",
  "Países Baixos": "",
  "Japão": "",
  "Costa do Marfim": "",
  "Equador": "",
  "Suécia": "",
  "Tunísia": "",
  "Espanha": "",
  "Cabo Verde": "",
  "Bélgica": "",
  "Egito": "",
  "Arábia Saudita": "",
  "Uruguai": "",
  "Irão": "",
  "Nova Zelândia": "",
  "França": "",
  "Senegal": "",
  "Iraque": "",
  "Noruega": "",
  "Argentina": "",
  "Argélia": "",
  "Áustria": "",
  "Jordânia": "",
  "RD Congo": "",
  "Inglaterra": "",
  "Croácia": "",
  "Gana": "",
  "Panamá": "",
  "Uzbequistão": "",
  "Colômbia": ""
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
const flag = team => FLAGS[team] || "ï¸";
const outcome = (home, away) => Number(home) > Number(away) ? "home" : Number(home) < Number(away) ? "away" : "draw";
const normalizeKey = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const normalizeComparable = value => normalizeKey(value);
const canonicalTeam = value => TEAM_ALIASES[normalizeKey(value)] || String(value ?? "").trim();
const playerIdFromName = name => `player_${normalizeKey(name).replace(/\s+/g, "_") || "sem_nome"}`;

function defaultPointSettings() {
  return { exact: 3, winner: 1, mvp: 5, topScorer: 5, champion: 10 };
}

function defaultKnockoutPointSettings() {
  return { ...defaultPointSettings(), penalties: 2 };
}

function defaultSettings() {
  return {
    points: defaultPointSettings(),
    knockoutPoints: defaultKnockoutPointSettings(),
    extraResults: { mvp: "", topScorer: "", champion: "" },
    extraPredictions: {},
    importedPoints: {},
    users: [],
    knockout: { adminUnlocked: false, matches: [] },
    logs: [],
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
  if (game?.manualStatus === "SUSPENDED" || game?.manualSuspended === true) {
    return { text: "Suspenso", className: "suspended" };
  }

  const apiStatus = String(game?.footballDataStatus || game?.statusApi || "").toUpperCase();
  const hasApiStatus = Boolean(apiStatus);

  if (["IN_PLAY", "PAUSED", "LIVE", "1H", "2H", "HT", "ET", "PEN_LIVE"].includes(apiStatus)) {
    return { text: "A Decorrer", className: "live" };
  }

  if (["SUSPENDED"].includes(apiStatus)) return { text: "Suspenso", className: "suspended" };
  if (["POSTPONED", "CANCELLED"].includes(apiStatus)) return { text: "Adiado", className: "locked" };
  if (["FINISHED", "AWARDED"].includes(apiStatus)) return { text: "Jogado", className: "played" };

  if (!hasApiStatus && hasResult(game)) return { text: "Jogado", className: "played" };

  // v191 sobre v190: hora passada não significa "A Decorrer".
  // Sem status live/API e sem resultado final, fica pendente para o Admin.
  return { text: "Falta resultado", className: "open" };
}
function isLocked(game) { return statusOf(game).className !== "open"; }

function isSuspendedGame(game) {
  const apiStatus = String(game?.footballDataStatus || game?.statusApi || "").toUpperCase();
  return game?.manualStatus === "SUSPENDED" ||
    game?.manualSuspended === true ||
    apiStatus === "SUSPENDED";
}

function hasFinalResult(game) {
  return hasResult(game) && !isSuspendedGame(game);
}

function needsFinalResult(game) {
  return isSuspendedGame(game) || !hasFinalResult(game);
}

function mergeSettings(input = {}) {
  const base = defaultSettings();
  return {
    ...base, ...input,
    points: { ...base.points, ...(input.points || {}) },
    knockoutPoints: { ...base.knockoutPoints, ...(input.knockoutPoints || {}) },
    extraResults: { ...base.extraResults, ...(input.extraResults || {}) },
    extraPredictions: { ...(input.extraPredictions || {}) },
    importedPoints: { ...(input.importedPoints || {}) },
    logs: Array.isArray(input.logs) ? input.logs.slice(-MAX_SYSTEM_LOGS) : [],
    knockout: {
      ...base.knockout,
      ...(input.knockout || {}),
      matches: Array.isArray(input.knockout?.matches) ? input.knockout.matches : []
    },
    users: Array.isArray(input.users) ? input.users : []
  };
}

function logActor() {
  const email = normalizeEmail(currentUser?.email || currentProfile?.email || "");
  const name = String(currentProfile?.name || "").trim() || displayNameFromEmail(email) || email || "Sistema";
  return { name, email };
}

function addSystemLog(action, detail = "", meta = {}, options = {}) {
  if (!appSettings) appSettings = defaultSettings();
  const actor = logActor();
  const entry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    action: String(action || "Ação").trim(),
    detail: String(detail || "").trim(),
    actorName: actor.name,
    actorEmail: actor.email,
    meta: meta && typeof meta === "object" ? meta : {}
  };

  appSettings.logs = [entry, ...(appSettings.logs || [])].slice(0, MAX_SYSTEM_LOGS);
  markSettingsPending();
  saveLocalData(`log ${entry.action}`);

  if (options.sync) scheduleFullSync(`log ${entry.action}`, 500);
  setTimeout(renderSystemLogs, 0);
  return entry;
}

function systemLogs() {
  return Array.isArray(appSettings?.logs) ? appSettings.logs : [];
}

function mergeSystemLogs(localLogs = [], remoteLogs = []) {
  const byId = new Map();
  [...remoteLogs, ...localLogs].forEach(log => {
    if (!log) return;
    const id = log.id || `${log.at || ""}_${log.action || ""}_${log.detail || ""}`;
    byId.set(id, { ...log, id });
  });
  return [...byId.values()]
    .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
    .slice(0, MAX_SYSTEM_LOGS);
}

function formatLogTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function isLogsUnlocked() {
  return logsUnlocked || sessionStorage.getItem("mundial_logs_unlocked_v146") === "1";
}

function setLogsUnlocked(value) {
  logsUnlocked = Boolean(value);
  if (logsUnlocked) sessionStorage.setItem("mundial_logs_unlocked_v146", "1");
  else sessionStorage.removeItem("mundial_logs_unlocked_v146");
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

function applyLocalDataFast(reason = "cache local") {
  const local = getLocalData();
  games = normalizeGames(local.games);
  bets = normalizeBets(local.bets);
  appSettings = mergeSettings(local.settings || local.appSettings);
  ensureKnockoutSettings();
  renderAll();
  setFirebaseStatus(navigator.onLine ? "loading" : "error", navigator.onLine ? `Firebase: a ligar... dados locais já visíveis` : "Offline: a mostrar dados guardados neste dispositivo");
}

function scheduleFirebaseReconnect(reason = "reconectar Firebase", delay = 3500) {
  if (firebaseReconnectTimer) clearTimeout(firebaseReconnectTimer);
  if (!navigator.onLine) {
    setFirebaseStatus("error", "Firebase: offline; vou tentar quando houver internet");
    return;
  }
  firebaseReconnectTimer = setTimeout(() => {
    firebaseReconnectTimer = null;
    if (!currentUser || !db || !firebaseApi) return;
    loadData({ background: true, reason }).catch(error => console.warn("Retry Firebase falhou:", error));
  }, delay);
}



// v114  Modo económico Firebase oficial.
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
  // v191 sobre v190: desativado.
  // firebaseApi é um ES module namespace object e não pode ser alterado.
  // A tentativa anterior rebentava o arranque:
  // Cannot assign to property '__originalOnSnapshotV114' of [object Module]
  return;
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

async function showForegroundPushNotificationV183(payload = {}) {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (!("serviceWorker" in navigator)) return;
    const title = payload?.notification?.title || payload?.data?.title || "Mundial Pontos 2026";
    const body = payload?.notification?.body || payload?.data?.body || "";
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      tag: payload?.data?.tag || payload?.messageId || `mundial-foreground-${Date.now()}`,
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      data: {
        url: payload?.data?.url || "./index.html?open=notifications",
        type: payload?.data?.type || "foreground"
      }
    });
  } catch (error) {
    console.warn("Nao consegui mostrar notificacao foreground:", error);
  }
}
async function importFirebaseModuleV189(file) {
  return import(`https://www.gstatic.com/firebasejs/10.12.5/firebase-${file}.js`);
}

async function initFirebase() {
  setTimeout(installFirestoreEconomyModeV114, 0);
  const config = APP_CONFIG.firebase || {};
  lastFirebaseInitError = "";

  if (!config.apiKey || !config.projectId) {
    db = null;
    firebaseApi = null;
    firebaseAuth = null;
    firebaseAuthApi = null;
    firebaseAppInstance = null;
    storageMode = "local";
    lastFirebaseInitError = "config.js sem apiKey/projectId";
    setFirebaseStatus("error", "Firebase: configuração em falta no config.js");
    setLoginStatus("Firebase: configuração em falta no config.js", "error");
    return false;
  }

  try {
    setFirebaseStatus("loading", "Firebase: a ligar Auth...");
    setLoginStatus("A ligar ao Firebase Auth...", "loading");

    const [appModule, authModule] = await Promise.all([
      importFirebaseModuleV189("app"),
      importFirebaseModuleV189("auth")
    ]);

    firebaseAppInstance = appModule.getApps?.().length ? appModule.getApp() : appModule.initializeApp(config);
    firebaseAuth = authModule.getAuth(firebaseAppInstance);
    firebaseAuthApi = authModule;
    setLoginStatus("Firebase Auth ligado. Faz login.", "success");
  } catch (error) {
    console.error("Firebase Auth não ligou:", error);
    db = null;
    firebaseApi = null;
    firebaseAuth = null;
    firebaseAuthApi = null;
    firebaseAppInstance = null;
    storageMode = "local";
    lastFirebaseInitError = error?.message || String(error || "erro");
    setFirebaseStatus("error", `Firebase Auth: não ligou (${lastFirebaseInitError})`);
    setLoginStatus(`Firebase Auth não ligou: ${lastFirebaseInitError}`, "error");
    return false;
  }

  try {
    const firestoreModule = await importFirebaseModuleV189("firestore");
    db = firestoreModule.getFirestore(firebaseAppInstance);
    firebaseApi = firestoreModule;
    storageMode = "firebase";
    installFirestoreEconomyModeV114();
    try {
      await firestoreModule.enableIndexedDbPersistence?.(db);
    } catch (persistenceError) {
      console.warn("Cache persistente Firestore indisponível:", persistenceError?.code || persistenceError?.message || persistenceError);
    }
    setFirebaseStatus("success", `Firebase: ligado ao projeto ${config.projectId}`);
  } catch (firestoreError) {
    console.error("Firestore não ligou:", firestoreError);
    db = null;
    firebaseApi = null;
    storageMode = "local";
    lastFirebaseInitError = firestoreError?.message || String(firestoreError || "erro");
    setFirebaseStatus("error", `Firebase Auth ligado; Firestore indisponível (${lastFirebaseInitError})`);
  }

  try {
    const messagingModule = await importFirebaseModuleV189("messaging");
    const supported = await messagingModule.isSupported().catch(() => false);
    if (supported) {
      firebaseMessaging = messagingModule.getMessaging(firebaseAppInstance);
      firebaseMessagingApi = messagingModule;
      messagingModule.onMessage(firebaseMessaging, payload => {
        const title = payload?.notification?.title || payload?.data?.title || "Notificação Mundial";
        const body = payload?.notification?.body || payload?.data?.body || "";
        showForegroundPushNotificationV183(payload);
        toast(body ? `${title}: ${body}` : title);
        renderNotificationsCenterV164();
      });
    }
  } catch (messagingError) {
    console.warn("Firebase Messaging indisponível:", messagingError);
    firebaseMessaging = null;
    firebaseMessagingApi = null;
  }

  return true;
}
async function ensureFirebaseAuthReadyV188() {
  if (firebaseAuthApi && firebaseAuth) return true;

  setLoginStatus("A ligar ao Firebase...", "loading");
  if (!firebaseReadyPromise) {
    firebaseReadyPromise = initFirebase();
  }

  const ok = await firebaseReadyPromise.catch(error => {
    console.error("Firebase readiness falhou:", error);
    return false;
  });

  if (!ok || !firebaseAuthApi || !firebaseAuth) {
    firebaseReadyPromise = null;
    const detail = lastFirebaseInitError ? ` (${lastFirebaseInitError})` : "";
    setLoginStatus(`Firebase/Auth ainda não está pronto${detail}. Verifica a internet e tenta novamente.`, "error");
    return false;
  }

  setupAuthGate();
  return true;
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

async function loadData(options = {}) {
  if (firebaseLoadInFlight && !options.force) return firebaseLoadInFlight;

  const run = (async () => {
    const local = getLocalData();
    const localGames = normalizeGames(local.games || []);
    const localBets = normalizeBets(local.bets || []);
    const localSettings = mergeSettings(local.settings || local.appSettings || defaultSettings());

    if (!options.background) {
      games = localGames.length ? localGames : clone(SEED_GAMES);
      bets = localBets;
      appSettings = localSettings;
      ensureKnockoutSettings();
      renderAll();
    }

    if (!db || !firebaseApi || storageMode !== "firebase") {
      setFirebaseStatus("error", "Firebase: indisponível; a usar dados locais");
      return;
    }

    try {
      setFirebaseStatus("loading", options.background ? "Firebase: a atualizar em segundo plano..." : "Firebase: a carregar dados...");
      const { collection, doc, getDocs, setDoc } = firebaseApi;

      const gamesPromise = withTimeout(getDocs(collection(db, "games")), 9000, "ler jogos");
      const settingsPromise = withTimeout(getDocs(collection(db, "settings")), 9000, "ler configurações");
      const betsPromise = localBets.length
        ? Promise.resolve({ docs: [], skipped: true })
        : withTimeout(getDocs(collection(db, "bets")), 9000, "ler apostas");

      const [gamesSnap, betsSnap, settingsSnap] = await Promise.all([gamesPromise, betsPromise, settingsPromise]);

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

      storageMode = "firebase";
      saveLocalData("firebase carregado rápido");
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
      games = localGames.length ? localGames : games;
      bets = localBets.length ? localBets : bets;
      appSettings = localSettings || appSettings;
      ensureKnockoutSettings();
      setFirebaseStatus("error", `Firebase: ligação instável (${shortFirebaseError(error)}). A usar cache e vou tentar novamente.`);
      renderAll();
      scheduleFirebaseReconnect(options.reason || "loadData erro", 4500);
    }
  })();

  firebaseLoadInFlight = run.finally(() => { firebaseLoadInFlight = null; });
  return firebaseLoadInFlight;
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
    if (!snap.exists()) return;
    const remoteSettings = snap.data() || {};
    if (hasSettingsPending()) {
      appSettings.logs = mergeSystemLogs(appSettings.logs || [], remoteSettings.logs || []);
      renderSystemLogs();
      return;
    }
    appSettings = mergeSettings(remoteSettings);
    queueRealtimeRender("firebase realtime configurações");
  }, error => console.warn("Realtime configurações falhou:", error)));

  realtimeUnsubscribers.push(onSnapshot(doc(db, "users", normalizeEmail(currentUser.email)), async snap => {
    if (!snap.exists()) return;
    const wasPermissionsManager = hasPermission("managePermissions");
    const data = snap.data() || {};
    const configAdmin = isConfiguredAdmin(currentUser.email);
    const storedRole = normalizeRole(data.role || (configAdmin ? "admin" : "user"));
    const effectiveRole = configAdmin && storedRole !== "owner" ? "admin" : storedRole;
    currentProfile = {
      ...defaultProfileForUser(currentUser),
      ...data,
      uid: currentUser.uid,
      email: normalizeEmail(currentUser.email),
      role: effectiveRole,
      active: data.active !== false,
      permissions: {
        ...permissionsForRole(effectiveRole),
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
  if (!bet || !game || !hasFinalResult(game)) return false;
  return Number(bet.homeGuess) === Number(game.homeScore) &&
    Number(bet.awayGuess) === Number(game.awayScore);
}

function isOutcomeBet(bet, game) {
  if (!bet || !game || !hasFinalResult(game)) return false;
  return outcome(bet.homeGuess, bet.awayGuess) === outcome(game.homeScore, game.awayScore);
}

function pointsForBet(bet, game) {
  if (!bet || !game || !hasFinalResult(game)) return 0;

  const exactPoints = Number(appSettings?.points?.exact) || 3;
  const winnerPoints = Number(appSettings?.points?.winner) || 1;

  // Regra 1: resultado exato certo recebe 3 pontos.
  // Regra 2: se acertar o resultado exato, não acumula o ponto do vencedor/empate.
  if (isExactBet(bet, game)) return exactPoints;

  // Regra 3: se não acertou o resultado, mas acertou vencedor/empate, recebe 1 ponto.
  if (isOutcomeBet(bet, game)) return winnerPoints;

  return 0;
}

function knockoutMatchHasResult(match) {
  return Boolean(match?.homeTeam && match?.awayTeam) &&
    match.homeScore !== null && match.homeScore !== undefined && match.homeScore !== "" &&
    match.awayScore !== null && match.awayScore !== undefined && match.awayScore !== "";
}

function firstNumberFromKeys(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value === "" || value === null || value === undefined) continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function knockoutBetPenaltyPair(bet) {
  const home = firstNumberFromKeys(bet, ["homePenalties", "homePenaltyGuess", "penaltiesHome", "penaltyHome", "homePens", "pensHome", "penHomeGuess", "penA"]);
  const away = firstNumberFromKeys(bet, ["awayPenalties", "awayPenaltyGuess", "penaltiesAway", "penaltyAway", "awayPens", "pensAway", "penAwayGuess", "penB"]);
  return home === null || away === null ? null : { home, away };
}

function knockoutBetScorePair(bet) {
  const home = firstNumberFromKeys(bet, ["homeGuess", "homeScore", "scoreHome", "teamAScore", "scoreA"]);
  const away = firstNumberFromKeys(bet, ["awayGuess", "awayScore", "scoreAway", "teamBScore", "scoreB"]);
  return home === null || away === null ? null : { home, away };
}

function isExactKnockoutBet(bet, match) {
  if (!bet || !knockoutMatchHasResult(match)) return false;
  const score = knockoutBetScorePair(bet);
  return Boolean(score) && score.home === Number(match.homeScore) && score.away === Number(match.awayScore);
}

function isExactKnockoutPenaltyBet(bet, match) {
  if (!bet || !knockoutMatchHasResult(match)) return false;
  const actual = knockoutPenaltiesV121(match);
  const predicted = knockoutBetPenaltyPair(bet);
  return Boolean(actual && predicted) && predicted.home === actual.home && predicted.away === actual.away;
}

function knockoutBetWinnerName(bet, match) {
  if (!bet || !match?.homeTeam || !match?.awayTeam) return "";

  const directWinner = bet.winner || bet.winnerTeam || bet.predictedWinner || bet.teamWinner || bet.champion;
  if (directWinner) return canonicalTeam(directWinner);

  const score = knockoutBetScorePair(bet);
  if (!score) return "";

  if (score.home > score.away) return match.homeTeam;
  if (score.away > score.home) return match.awayTeam;

  const pens = knockoutBetPenaltyPair(bet);
  if (!pens || pens.home === pens.away) return "";
  return pens.home > pens.away ? match.homeTeam : match.awayTeam;
}

function isWinnerKnockoutBet(bet, match) {
  const actualWinner = knockoutWinner(match);
  const predictedWinner = knockoutBetWinnerName(bet, match);
  return Boolean(actualWinner && predictedWinner && normalizeComparable(actualWinner) === normalizeComparable(predictedWinner));
}

function pointsForKnockoutBet(bet, match) {
  if (!bet || !knockoutMatchHasResult(match)) return 0;

  const points = { ...defaultKnockoutPointSettings(), ...(appSettings?.knockoutPoints || {}) };
  let total = 0;

  if (isExactKnockoutBet(bet, match)) total += Number(points.exact) || 0;
  else if (isWinnerKnockoutBet(bet, match)) total += Number(points.winner) || 0;

  if (isExactKnockoutPenaltyBet(bet, match)) total += Number(points.penalties) || 0;

  return total;
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
    knockoutPoints: 0,
    extraPoints: 0,
    importedPoints: appSettings.importedPoints?.[playerName] ?? null,
    totalBets: playerBets.length,
    settled: 0,
    exact: 0,
    winner: 0,
    penalties: 0,
    misses: 0,
    mvp: 0,
    topScorer: 0,
    champion: 0
  };

  playerBets.forEach(bet => {
    const game = games.find(item => item.id === bet.gameId);
    if (!game) {
      const knockoutMatch = knockoutMatchById(bet.gameId);
      if (!knockoutMatch || !knockoutMatchHasResult(knockoutMatch)) return;

      const points = pointsForKnockoutBet(bet, knockoutMatch);
      stats.gamePoints += points;
      stats.knockoutPoints += points;
      stats.settled += 1;

      if (isExactKnockoutBet(bet, knockoutMatch)) stats.exact += 1;
      else if (isWinnerKnockoutBet(bet, knockoutMatch)) stats.winner += 1;
      else stats.misses += 1;

      if (isExactKnockoutPenaltyBet(bet, knockoutMatch)) stats.penalties += 1;
      return;
    }

    if (!hasFinalResult(game)) return;

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
    base = base.filter(needsFinalResult);
  }

  if (calendarViewMode === "played") {
    base = base.filter(hasFinalResult);
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
    setFirebaseStatus("error", "Firebase: não está ligado  resultado ficou só local");
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
  notifications: false,
  logs: false,
  settings: false,
  adminTab: false,
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
  notifications: true,
  logs: true,
  settings: true,
  adminTab: true,
  admin: true,
  editResults: true,
  importExcel: true,
  editUsers: true,
  editPoints: true,
  editKnockout: true,
  managePermissions: true
};

const OWNER_PERMISSIONS = {
  ...ADMIN_PERMISSIONS
};

function normalizeRole(role) {
  const value = String(role || "user").toLowerCase().trim();
  if (value === "owner" || value === "dono") return "owner";
  if (value === "admin") return "admin";
  return "user";
}

function permissionsForRole(role) {
  const normalized = normalizeRole(role);
  if (normalized === "owner") return { ...OWNER_PERMISSIONS };
  if (normalized === "admin") return { ...ADMIN_PERMISSIONS };
  return { ...DEFAULT_PERMISSIONS };
}

function roleLabel(role) {
  const normalized = normalizeRole(role);
  if (normalized === "owner") return "Dono";
  if (normalized === "admin") return "Admin";
  return "User";
}

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
  if (normalizeRole(currentProfile?.role) === "owner") return true;
  return Boolean(currentProfile?.permissions?.[permission]);
}

function isAdminProfile() {
  return hasPermission("admin") || normalizeRole(currentProfile?.role) === "owner";
}

function setLoginStatus(message, type = "info") {
  const box = $("loginStatusBox");
  if (!box) return;
  box.className = `login-status ${type}`;
  box.textContent = message;
}

function showLoginScreen() {
  try { cleanupRealtimeSync(); } catch (error) { console.warn("cleanupRealtimeSync falhou:", error); }

  const login = $("loginScreen");
  const shell = $("appShell");

  login?.classList.remove("hidden");
  if (login) login.style.display = "";

  shell?.classList.add("auth-hidden");
  if (shell) shell.style.display = "";

  document.body.classList.remove("knockout-layout-active", "app-authenticated-v213", "app-authenticated-v212");
  shell?.classList.remove("knockout-screen-active");
}

function showAppScreen() {
  const login = $("loginScreen");
  const shell = $("appShell");

  login?.classList.add("hidden");
  if (login) login.style.display = "none";

  shell?.classList.remove("auth-hidden");
  if (shell) shell.style.display = "";

  document.body.classList.add("app-authenticated-v213");
  updateActiveAppSection();
}

function updateActiveAppSection() {
  normalizeActiveTabStateV217();
  const activeTabId = document.querySelector(".tab-panel.active")?.id || "calendarTab";
  const isKnockout = activeTabId === "knockoutTab";
  const mobileKnockout = isKnockout && window.matchMedia("(max-width: 760px)").matches;
  document.body.classList.toggle("knockout-layout-active", isKnockout && !mobileKnockout);
  $("appShell")?.classList.toggle("knockout-screen-active", isKnockout && !mobileKnockout);
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

  const role = roleLabel(currentProfile?.role);
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
    const storedRole = normalizeRole(data.role || (configAdmin ? "admin" : "user"));
    const effectiveRole = configAdmin && storedRole !== "owner" ? "admin" : storedRole;
    const profile = {
      ...fallback,
      ...data,
      uid: user.uid,
      email: normalizeEmail(user.email),
      name: String(data.name || fallback.name || "").trim(),
      role: effectiveRole,
      active: data.active !== false,
      permissions: {
        ...permissionsForRole(effectiveRole),
        ...(data.permissions || {})
      }
    };

    if (configAdmin && normalizeRole(data.role) === "user") {
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
    console.warn("Permissões em segundo plano falharam:", error);
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
    calendar: "Ver Calendário",
    score: "Ver Pontuação",
    knockout: "Ver Fase Final",
    notifications: "Ver Notificações",
    logs: "Ver Logs",
    settings: "Ver Configurações",
    adminTab: "Ver Admin",
    admin: "Poder Admin",
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
    const role = normalizeRole(user.role);
    const isOwnerUser = role === "owner";
    const perms = { ...permissionsForRole(role), ...(user.permissions || {}) };
    const active = user.active !== false;

    return `
      <article class="permission-user-card" data-permission-card="${escapeHtml(email)}">
        <div class="permission-user-head">
          <div>
            <strong>${escapeHtml(visibleName)}</strong>
            <span>${escapeHtml(email)} · ${roleLabel(role)} · ${active ? "Ativo" : "Bloqueado"}</span>
          </div>
          <div class="permission-user-actions">
            <label class="permission-name-label">
              Nome visível
              <input class="permission-name-input" type="text" data-name-email="${escapeHtml(email)}" value="${escapeHtml(visibleName)}" placeholder="Nome visível" />
            </label>
            <select data-role-email="${escapeHtml(email)}">
              <option value="user" ${role === "user" ? "selected" : ""}>User normal</option>
              <option value="admin" ${role === "admin" ? "selected" : ""}>Admin</option>
              <option value="owner" ${role === "owner" ? "selected" : ""}>Dono</option>
            </select>
            <label class="perm-active">
              <input type="checkbox" data-active-email="${escapeHtml(email)}" ${active ? "checked" : ""} />
              Ativo
            </label>
            <button class="primary small" type="button" data-save-permissions="${escapeHtml(email)}">Guardar</button>
          </div>
        </div>
        <div class="permission-grid">
          ${Object.entries(labels).map(([key, label]) => renderPermissionCheckbox(email, key, label, perms[key], isOwnerUser)).join("")}
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

  const role = normalizeRole(document.querySelector(`[data-role-email="${CSS.escape(normalized)}"]`)?.value || $("permissionRoleInput")?.value || "user");
  const activeInput = document.querySelector(`[data-active-email="${CSS.escape(normalized)}"]`);
  const active = activeInput ? activeInput.checked : true;
  const isOwnerUser = role === "owner";

  const nameInput = document.querySelector(`[data-name-email="${CSS.escape(normalized)}"]`) || $("permissionNameInput");
  const visibleName = String(nameInput?.value || existingProfile.name || displayNameFromEmail(normalized)).trim() || displayNameFromEmail(normalized);

  const permissions = permissionsForRole(role);
  if (card && !isOwnerUser) {
    card.querySelectorAll("[data-perm-key]").forEach(input => {
      permissions[input.dataset.permKey] = input.checked;
    });
  }

  const auditBefore = {
    name: existingProfile.name || "",
    role: normalizeRole(existingProfile.role || "user"),
    active: existingProfile.active !== false,
    permissions: existingProfile.permissions || {}
  };
  const auditAfter = { name: visibleName, role, active, permissions };

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

  addSystemLog("Utilizador guardado", `${visibleName} (${normalized}) ficou como ${roleLabel(role)}${active ? "" : " bloqueado"}.`, { email: normalized, before: auditBefore, after: auditAfter }, { sync: true });
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
  if (tabId === "notificationsTab") return hasPermission("notifications");
  if (tabId === "adminTab") return hasPermission("adminTab");
  if (tabId === "logsTab") return hasPermission("logs");
  if (tabId === "settingsTab") return hasPermission("settings");
  return true;
}

function switchToFirstAllowedTab() {
  const allowed = [...document.querySelectorAll(".tab")].find(button => permissionTabAllowed(button.dataset.tab));
  if (!allowed) return;
  setActiveTabStateV217(allowed.dataset.tab);
}

function applyPermissionsToUi() {
  updateSessionBox();

  document.querySelector('[data-tab="calendarTab"]')?.classList.toggle("hidden", !hasPermission("calendar"));
  document.querySelector('[data-tab="scoreTab"]')?.classList.toggle("hidden", !hasPermission("score"));
  document.querySelector('[data-tab="knockoutTab"]')?.classList.toggle("hidden", !hasPermission("knockout"));
  document.querySelector('[data-tab="notificationsTab"]')?.classList.toggle("hidden", !hasPermission("notifications"));
  document.querySelector('[data-tab="logsTab"]')?.classList.toggle("hidden", !hasPermission("logs"));
  document.querySelector('[data-tab="adminTab"]')?.classList.toggle("hidden", !hasPermission("adminTab"));
  document.querySelector('[data-tab="settingsTab"]')?.classList.toggle("hidden", !hasPermission("settings"));

  const activeTab = document.querySelector(".tab.active");
  if (activeTab && !permissionTabAllowed(activeTab.dataset.tab)) switchToFirstAllowedTab();

  $("adminTab")?.classList.toggle("no-access", !hasPermission("admin"));

  // Ações admin
  document.querySelectorAll("[data-result-game]").forEach(btn => {
    const inAdmin = btn.closest("#adminTab");
    if (inAdmin && !hasPermission("editResults")) btn.classList.add("hidden");
  });

  $("openExcelModalBtn")?.classList.toggle("hidden", !hasPermission("importExcel"));
  $("exportResultadosBtn")?.classList.toggle("hidden", !hasPermission("importExcel"));
  $("syncFootballDataBtn")?.classList.toggle("hidden", !hasPermission("editResults"));
  $("addUserBtn")?.classList.toggle("hidden", !hasPermission("editUsers"));
  $("savePointsSettingsBtn")?.classList.toggle("hidden", !hasPermission("editPoints"));
  $("saveExtraResultsBtn")?.classList.toggle("hidden", !hasPermission("editPoints"));
  $("saveKnockoutUnlockBtn")?.classList.toggle("hidden", !hasPermission("editKnockout"));
    $("searchAllResultsBtn")?.classList.toggle("hidden", !hasPermission("editResults"));
    document.querySelectorAll(".search-game-result-btn").forEach(btn => btn.classList.toggle("hidden", !hasPermission("editResults")));

  document.querySelectorAll("[data-ko-save], [data-ko-edit], [data-ko-record]").forEach(btn => {
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
    if (!await ensureFirebaseAuthReadyV188()) return;
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
    if (!await ensureFirebaseAuthReadyV188()) return;
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
      <button id="closeOnlineUsersBtn" class="online-users-close" type="button" aria-label="Fechar utilizadores online" onclick="return window.closeOnlineUsersPanelNow(event)"></button>
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
        <span>ltima atividade</span>
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
            <span class="online-state">${online ? "Online " : "Offline "}</span>
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
  return hasPermission("editResults") || hasPermission("admin");
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
        <span> Mensagem fixada</span>
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
  safeVibrateV192(15);
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
  const status = message.failed ? "erro" : (message.pending ? "a enviar" : (mine ? "" : ""));
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

  safeVibrateV192(25);

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
    box.innerHTML = `<div class="empty small-empty">${chatSearchTerm ? "Nenhuma mensagem encontrada." : "Ainda não há mensagens. Escreve a primeira "}</div>`;
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
  if (authGateStarted) return;
  if (!firebaseAuthApi || !firebaseAuth) {
    showLoginScreen();
    setLoginStatus("Firebase Auth não está configurado.", "error");
    return;
  }

  authGateStarted = true;
  firebaseAuthApi.onAuthStateChanged(firebaseAuth, async user => {
    currentUser = user || null;

    if (!user) {
      currentProfile = null;
      try { stopOnlineFeaturesSafe(); } catch (error) { console.warn("Online users não parou:", error); }
      try { stopChatSafe(); } catch (error) { console.warn("Chat não parou:", error); }
      showLoginScreen();
      try { updateSessionBox(); } catch {}
      try { renderPushOptInPromptV182(); } catch {}
      setLoginStatus("Usa o teu email e password para entrar.", "info");
      return;
    }

    if (user.email) saveRememberedAccount(user.email);
    setLoginStatus("A carregar perfil...", "loading");

    try {
      currentProfile = await readUserProfile(user);
    } catch (profileError) {
      console.warn("Perfil/permissões falharam; a usar perfil local:", profileError);
      currentProfile = defaultProfileForUser(user);
    }

    if (!currentProfile) currentProfile = defaultProfileForUser(user);

    if (isConfiguredAdmin(user.email) && normalizeRole(currentProfile.role) !== "owner") {
      currentProfile = {
        ...currentProfile,
        role: "admin",
        active: currentProfile.active !== false,
        permissions: { ...ADMIN_PERMISSIONS, ...(currentProfile.permissions || {}) }
      };
    }

    if (currentProfile.active === false) {
      try { await firebaseAuthApi.signOut(firebaseAuth); } catch (signOutError) { console.warn("Sign out após conta bloqueada falhou:", signOutError); }
      setLoginStatus("Conta bloqueada pelo Admin.", "error");
      showLoginScreen();
      return;
    }

    try { showAppScreen(); } catch (screenError) { console.warn("showAppScreen falhou; a forçar ecrã da app:", screenError); }
    try { forceShowAppAfterLoginV213(); } catch (forceError) { console.warn("Forçar ecrã da app falhou:", forceError); }
    try { updateSessionBox(); } catch (error) { console.warn("updateSessionBox falhou:", error); }

    loadPermissionsUsers()
      .then(() => { try { renderPermissionsUsers(); } catch (error) { console.warn("renderPermissionsUsers falhou:", error); } })
      .catch(error => console.warn("Permissões em segundo plano falharam:", error));

    try {
      await loadData();
    } catch (loadError) {
      console.warn("Dados Firebase falharam no login; a abrir com cache local:", loadError);
      try { applyLocalDataFast("fallback login v213"); } catch (localError) { console.warn("Fallback local no login falhou:", localError); }
    }

    try { applyPermissionsToUi(); } catch (error) { console.warn("applyPermissionsToUi falhou sem derrubar login:", error); }
    try { renderAll(); } catch (error) { console.warn("renderAll pós-login falhou sem derrubar login:", error); }
    try { forceShowAppAfterLoginV213(); } catch {}

    setLoginStatus("Login efetuado.", "success");

    try { startChatSafe(); } catch (error) { console.warn("Chat não iniciou:", error); }
    try { startOnlineFeaturesSafe(); } catch (error) { console.warn("Online users não iniciou:", error); }

    setTimeout(() => {
      try { setupPushForCurrentUserV182(); } catch (error) { console.warn("Push pós-login falhou:", error); }
    }, 900);

    try {
      addSystemLog("Sessão iniciada", `${currentProfile.name || currentUser.email} entrou na app.`, { email: currentUser.email }, { sync: true });
    } catch (logError) {
      console.warn("Log de sessão falhou sem bloquear login:", logError);
    }
  });
}

async function logout() {
  if (!firebaseAuthApi || !firebaseAuth) return;
  addSystemLog("Sessão terminada", `${currentProfile?.name || currentUser?.email || "User"} saiu da app.`, { email: currentUser?.email || "" }, { sync: true });
  await firebaseAuthApi.signOut(firebaseAuth);
  toast("Sessão terminada.");
}

const KNOCKOUT_ROUNDS = [
  { key: "r32", label: "16 avos de final", count: 16, next: "r16" },
  { key: "r16", label: "Oitavos de final", count: 8, next: "qf" },
  { key: "qf", label: "Quartos de final", count: 4, next: "sf" },
  { key: "sf", label: "Meias-finais", count: 2, next: "final" },
  { key: "final", label: "Final", count: 1, next: "" }
];

const KNOCKOUT_ROUND_LABELS = Object.fromEntries(KNOCKOUT_ROUNDS.map(round => [round.key, round.label]));

function knockoutRoundLabel(round) {
  const key = String(round || "").trim().toLowerCase();
  return KNOCKOUT_ROUND_LABELS[key] || String(round || "Fase Final").trim() || "Fase Final";
}

const KNOCKOUT_LAYOUT_KEYS = [
  ["r32_left", "16 avos esquerda"],
  ["r16_left", "Oitavos de final esquerda"],
  ["r16_left_pair_1", "Oitavos esquerda 1-2"],
  ["r16_left_pair_2", "Oitavos esquerda 3-4"],
  ["qf_left", "Quartos de final esquerda"],
  ["sf_left", "Meia-final esquerda"],
  ["center", "Final"],
  ["sf_right", "Meia-final direita"],
  ["qf_right", "Quartos de final direita"],
  ["r16_right", "Oitavos de final direita"],
  ["r16_right_pair_1", "Oitavos direita 5-6"],
  ["r16_right_pair_2", "Oitavos direita 7-8"],
  ["r32_right", "16 avos direita"]
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
        matchDate: "",
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
        awayPenalties: saved.awayPenalties ?? null,
        matchDate: saved.matchDate || saved.date || saved.kickoff || saved.startAt || saved.time || ""
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
  return games.length > 0 && games.every(hasFinalResult);
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
  const missing = games.filter(needsFinalResult).length;
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

  setActiveTabStateV217("knockoutTab");
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
    const missing = games.filter(needsFinalResult).length;
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

}

// v121  Fase Final mobile por rondas. PC mantém layout original.
let knockoutMobileSelectedRoundV121 = localStorage.getItem("mundial_ko_mobile_round_v121") || "";

function knockoutRoundsForMobileV121() {
  const matches = Array.isArray(appSettings?.knockout?.matches) ? appSettings.knockout.matches : [];
  const fallbackNames = ["16 avos de final", "Oitavos de final", "Quartos de final", "Meias-finais", "Final"];
  const roundMap = new Map();

  matches.forEach((match, index) => {
    const rawRound = String(match.round || match.stage || match.phase || match.ronda || "").trim();
    const round = knockoutRoundLabel(rawRound || fallbackNames[Math.min(Math.floor(index / 16), fallbackNames.length - 1)] || "Fase Final");
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

function knockoutTeamOptionsHtml(selectedTeam = "") {
  const teams = knockoutTeamOptions();
  return `<option value="">A definir</option>${teams.map(team => `<option value="${escapeHtml(team)}" ${team === selectedTeam ? "selected" : ""}>${escapeHtml(team)}</option>`).join("")}`;
}

function canEditKnockoutInline() {
  return (isAdmin || isAdminProfile()) && hasPermission("editKnockout");
}

function renderKnockoutInlineEditor(match, mode = "desktop") {
  if (!canEditKnockoutInline()) return "";
  const hasResult = knockoutMatchHasResult(match);
  const label = hasResult ? "Editar resultado" : "Adicionar resultado";
  return `
    <span class="ko-card-click-hint ${mode === "mobile" ? "mobile" : "desktop"}">Tocar para editar</span>
    <button class="secondary small ko-record-open-btn-v244 ${mode === "mobile" ? "mobile" : "desktop"}" type="button" data-ko-record="${escapeHtml(match.id)}">${label}</button>
  `;
}

function renderKnockoutRecordForm(match) {
  const firstRound = isFirstKnockoutRound(match);
  const teamsReady = Boolean(match.homeTeam && match.awayTeam);
  const canScore = firstRound || teamsReady;

  const homeControl = firstRound
    ? `<select class="ko-home-team" aria-label="Equipa da casa">${knockoutTeamOptionsHtml(match.homeTeam)}</select>`
    : `<input class="ko-readonly-team" type="text" value="${escapeHtml(match.homeTeam || "A definir automaticamente")}" disabled aria-label="Equipa da casa" />`;

  const awayControl = firstRound
    ? `<select class="ko-away-team" aria-label="Equipa visitante">${knockoutTeamOptionsHtml(match.awayTeam)}</select>`
    : `<input class="ko-readonly-team" type="text" value="${escapeHtml(match.awayTeam || "A definir automaticamente")}" disabled aria-label="Equipa visitante" />`;

  return `
    <div class="ko-card-editor modal" data-ko-admin="${escapeHtml(match.id)}">
      <div class="ko-card-editor-teams">
        ${homeControl}
        ${awayControl}
      </div>
      <label class="ko-match-date-label-v243">Data/hora do jogo
        <input class="ko-match-date-v243" type="datetime-local" value="${escapeHtml(knockoutMatchDateInputValueV243(match))}" />
      </label>
      <div class="ko-card-editor-scores">
        <label>Resultado
          <span class="ko-score-pair">
            <input class="ko-home-score" type="number" min="0" inputmode="numeric" value="${match.homeScore ?? ""}" placeholder="0" ${canScore ? "" : "disabled"} />
            <em>-</em>
            <input class="ko-away-score" type="number" min="0" inputmode="numeric" value="${match.awayScore ?? ""}" placeholder="0" ${canScore ? "" : "disabled"} />
          </span>
        </label>
        <label>Penáltis
          <span class="ko-score-pair">
            <input class="ko-home-penalties" type="number" min="0" inputmode="numeric" value="${match.homePenalties ?? ""}" placeholder="0" ${canScore ? "" : "disabled"} />
            <em>-</em>
            <input class="ko-away-penalties" type="number" min="0" inputmode="numeric" value="${match.awayPenalties ?? ""}" placeholder="0" ${canScore ? "" : "disabled"} />
          </span>
        </label>
      </div>
      <button class="primary small ko-card-save" type="button" data-ko-save="${escapeHtml(match.id)}">${firstRound ? "Guardar equipas/resultado" : "Guardar resultado"}</button>
    </div>
  `;
}

function closeKnockoutRecordModal() {
  document.getElementById("knockoutRecordModal")?.remove();
  document.body.classList.remove("ko-record-modal-open");
  document.removeEventListener("keydown", handleKnockoutRecordModalKeydown);
}

function handleKnockoutRecordModalKeydown(event) {
  if (event.key === "Escape") closeKnockoutRecordModal();
}

function openKnockoutRecordModal(matchId) {
  if (!canEditKnockoutInline()) {
    toast("Sem permissão para editar a Fase Final.");
    return;
  }

  ensureKnockoutSettings();
  const match = knockoutMatchById(matchId);
  if (!match) {
    toast("Jogo não encontrado.");
    return;
  }

  closeKnockoutRecordModal();
  const modal = document.createElement("div");
  modal.id = "knockoutRecordModal";
  modal.className = "modal knockout-record-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Editar jogo da Fase Final");
  modal.innerHTML = `
    <div class="modal-card knockout-record-card">
      <div class="modal-head">
        <div>
          <strong>Editar jogo</strong>
          <span>${escapeHtml(knockoutRoundLabel(match.round))} · Jogo ${escapeHtml(match.index)}</span>
        </div>
        <button class="secondary small" type="button" data-ko-record-close>Fechar</button>
      </div>
      ${renderKnockoutRecordForm(match)}
    </div>
  `;
  modal.addEventListener("click", event => {
    if (event.target === modal || event.target.closest("[data-ko-record-close]")) {
      event.preventDefault();
      closeKnockoutRecordModal();
    }
  });
  document.body.classList.add("ko-record-modal-open");
  document.body.appendChild(modal);
  document.addEventListener("keydown", handleKnockoutRecordModalKeydown);
  modal.querySelector("select, input")?.focus();
}


function renderKnockoutMobileV121() {
  const activePanelV128 = document.querySelector(".tab-panel.active");
  const tab = document.getElementById("knockoutTab");
  if (!tab || activePanelV128?.id !== "knockoutTab") {
    document.getElementById("knockoutMobileV121")?.remove();
    return;
  }

  let host = document.getElementById("knockoutMobileV121");
  if (host && host.parentElement !== tab) host.remove();
  host = document.getElementById("knockoutMobileV121");
  if (!host) {
    host = document.createElement("section");
    host.id = "knockoutMobileV121";
    host.className = "knockout-mobile-v121 knockout-mobile-clean-v137";
    tab.prepend(host);
  }

  const rounds = knockoutRoundsForMobileV121();
  if (!knockoutMobileSelectedRoundV121 || !rounds.some(round => round.name === knockoutMobileSelectedRoundV121)) {
    knockoutMobileSelectedRoundV121 = rounds[0]?.name || "Fase Final";
  }

  const selected = rounds.find(round => round.name === knockoutMobileSelectedRoundV121) || rounds[0] || { name: "Fase Final", games: [] };
  const prevRound = null;
  const nextRound = null;

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
          <article class="ko-mobile-card ko-mobile-card-premium-v130 ${winner ? "is-done-v130" : "is-waiting-v130"} ${canEditKnockoutInline() ? "ko-match-clickable" : ""}" data-ko-mobile-match="${escapeHtml(String(matchId))}" data-ko-admin="${escapeHtml(String(matchId))}" ${canEditKnockoutInline() ? `role="button" tabindex="0" aria-label="Editar ${escapeHtml(selected.name)} jogo ${index + 1}"` : ""}>
            <div class="ko-mobile-card-head">
              <span>${escapeHtml(selected.name)}</span>
              <strong>Jogo ${index + 1}</strong>
            </div>

            <div class="ko-mobile-team ${winner && winner === home ? "winner" : ""}">
              <span>${escapeHtml(home)}</span>
              <b>${homeScore === null ? "" : homeScore}</b>
            </div>

            <div class="ko-mobile-versus">vs</div>

            <div class="ko-mobile-team ${winner && winner === away ? "winner" : ""}">
              <span>${escapeHtml(away)}</span>
              <b>${awayScore === null ? "" : awayScore}</b>
            </div>

            ${pens ? `<div class="ko-mobile-pens">Penáltis: <strong>${pens.home} - ${pens.away}</strong></div>` : ""}

            <div class="ko-mobile-status ${winner ? "done" : "waiting"}">
              ${winner ? ` Vencedor: <strong>${escapeHtml(winner)}</strong>` : "⏳ A aguardar resultado/equipas"}
            </div>

            ${renderKnockoutInlineEditor(match, "mobile")}
          </article>`;
      }).join("")
    : `<div class="ko-mobile-empty">Ainda não há jogos nesta ronda.</div>`;

  host.innerHTML = `
    <div class="ko-mobile-header ko-mobile-header-v137">
      <div>
        <span>Fase Final</span>
        <strong>${escapeHtml(selected.name)}</strong>
      </div>
      <small>${selected.games.length} jogo(s)</small>
    </div>

    <div class="ko-mobile-tabs">${roundTabs}</div>

    <div class="ko-mobile-list ko-mobile-list-page-v137">${cards}</div>

    <div class="ko-mobile-nav ko-mobile-round-nav-v137">
      ${prevRound ? `<button type="button" class="secondary" data-ko-mobile-round="${escapeHtml(prevRound.name)}"> ${escapeHtml(prevRound.name)}</button>` : ""}
      ${nextRound ? `<button type="button" class="primary" data-ko-mobile-round="${escapeHtml(nextRound.name)}">${escapeHtml(nextRound.name)} </button>` : ""}
    </div>
  `;

  host.querySelectorAll("[data-ko-mobile-round]").forEach(btn => {
    btn.addEventListener("click", () => {
      knockoutMobileSelectedRoundV121 = btn.dataset.koMobileRound || selected.name;
      localStorage.setItem("mundial_ko_mobile_round_v121", knockoutMobileSelectedRoundV121);
      window.scrollTo({ top: 0, behavior: "smooth" });
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
    r32: "16 avos de final",
    r16: "Oitavos de final",
    qf: "Quartos de final",
    sf: "Meias-finais"
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
  const editable = canEditKnockoutInline();
  const waiting = !match.homeTeam || !match.awayTeam;
  const hasScore = match.homeScore !== null && match.homeScore !== undefined && match.homeScore !== "" && match.awayScore !== null && match.awayScore !== undefined && match.awayScore !== "";
  const isDraw = hasScore && Number(match.homeScore) === Number(match.awayScore);
  const hasPens = match.homePenalties !== null && match.homePenalties !== undefined && match.homePenalties !== "" && match.awayPenalties !== null && match.awayPenalties !== undefined && match.awayPenalties !== "";
  const lockedText = waiting ? "" : winner ? "Vencedor" : isDraw ? "Faltam penáltis" : "Por decidir";

  const editableAttrs = editable ? ` role="button" tabindex="0" aria-label="Editar ${escapeHtml(match.roundLabel)} ${escapeHtml(match.index)}"` : "";

  return `
    <article class="knockout-match ${winner ? "has-winner" : ""} ${waiting ? "waiting" : ""} ${editable ? "ko-match-clickable" : ""}" data-ko-admin="${escapeHtml(match.id)}"${editableAttrs} ${layoutKey ? `data-ko-layout="${escapeHtml(layoutKey)}" style="--ko-match-offset:${knockoutLayoutValue(layoutKey)}px"` : ""}>
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

      ${match.matchDate ? `<div class="ko-match-date-line-v243">${escapeHtml(dateTimePortugal(match.matchDate))}</div>` : ""}

      <div class="ko-status-line">
        <small>${escapeHtml(lockedText)}</small>
      </div>
      ${renderKnockoutInlineEditor(match, "desktop")}
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
  if (toggle) {
    toggle.checked = Boolean(appSettings.knockout?.adminUnlocked);
    updateKnockoutUnlockControlV230(toggle.checked);
  }

  const panel = $("knockoutAdminPanel");
  if (!panel) return;

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
          ? `<select class="ko-home-team">${knockoutTeamOptionsHtml(match.homeTeam)}</select>`
          : `<input class="ko-readonly-team" type="text" value="${escapeHtml(match.homeTeam || "A definir automaticamente")}" disabled />`;

        const awayControl = firstRound
          ? `<select class="ko-away-team">${knockoutTeamOptionsHtml(match.awayTeam)}</select>`
          : `<input class="ko-readonly-team" type="text" value="${escapeHtml(match.awayTeam || "A definir automaticamente")}" disabled />`;

        return `
          <div class="ko-admin-row ko-admin-row-penalties ${firstRound ? "manual-round" : "auto-round"}" data-ko-admin="${escapeHtml(match.id)}">
            <strong>${escapeHtml(match.roundLabel)} ${match.index}</strong>
            ${homeControl}
            <span>vs</span>
            ${awayControl}

            <label class="ko-score-label ko-match-date-label-v243">Data/hora
              <input class="ko-match-date-v243" type="datetime-local" value="${escapeHtml(knockoutMatchDateInputValueV243(match))}" />
            </label>

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
            <button class="secondary small ko-record-open-btn-v244" type="button" data-ko-record="${escapeHtml(match.id)}">${knockoutMatchHasResult(match) ? "Editar em modal" : "Adicionar em modal"}</button>
          </div>
        `;
      }).join("")}
    </div>`;
}

function updateKnockoutUnlockControlV230(unlocked = Boolean($("adminKnockoutUnlockedInput")?.checked)) {
  const label = $("adminKnockoutUnlockedStateV230");
  const button = $("saveKnockoutUnlockBtn");
  const card = $("adminKnockoutUnlockedInput")?.closest(".knockout-unlock-toggle-v230");

  card?.classList.toggle("is-unlocked-v230", Boolean(unlocked));
  if (label) {
    label.textContent = unlocked
      ? "Ativa no Calendario antes do fim dos grupos"
      : "Bloqueada ate acabarem os grupos";
  }
  if (button) button.textContent = unlocked ? "Guardar ativada" : "Guardar bloqueada";
}

function toggleKnockoutUnlockControlV231(event) {
  const card = event.target.closest?.(".knockout-unlock-toggle-v230");
  if (!card) return false;

  const input = $("adminKnockoutUnlockedInput");
  if (!input || input.disabled) return false;

  event.preventDefault();
  event.stopPropagation();
  input.checked = !input.checked;
  updateKnockoutUnlockControlV230(input.checked);
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

async function saveKnockoutUnlock() {
  if (!hasPermission("editKnockout")) { toast("Sem permissão."); return; }

  ensureKnockoutSettings();
  appSettings.knockout.adminUnlocked = Boolean($("adminKnockoutUnlockedInput")?.checked);
  addSystemLog("Bloqueio Fase Final", appSettings.knockout.adminUnlocked ? "Fase Final desbloqueada pelo Admin." : "Fase Final voltou a ficar bloqueada até acabarem os grupos.", { unlocked: appSettings.knockout.adminUnlocked });
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
  addSystemLog(reset ? "Layout Fase Final reposto" : "Layout Fase Final guardado", reset ? "As posições dos cards foram repostas." : "As posições dos cards foram atualizadas.", { layout: nextLayout });
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
async function saveKnockoutMatchFromAdmin(matchId, sourceElement = null) {
  if (!hasPermission("editKnockout")) { toast("Sem permissão."); return; }

  ensureKnockoutSettings();

  const sourceModal = sourceElement?.closest("#knockoutRecordModal");
  const row = sourceElement?.closest(`[data-ko-admin="${CSS.escape(matchId)}"]`) ||
    document.querySelector(`[data-ko-admin="${CSS.escape(matchId)}"]`);
  const match = knockoutMatchById(matchId);
  if (!row || !match) return;

  const firstRound = isFirstKnockoutRound(match);
  const beforeMatch = {
    homeTeam: match.homeTeam || "",
    awayTeam: match.awayTeam || "",
    homeScore: match.homeScore ?? null,
    awayScore: match.awayScore ?? null,
    homePenalties: match.homePenalties ?? null,
    awayPenalties: match.awayPenalties ?? null,
    matchDate: match.matchDate || ""
  };

  if (firstRound) {
    match.homeTeam = row.querySelector(".ko-home-team")?.value || "";
    match.awayTeam = row.querySelector(".ko-away-team")?.value || "";
  }

  match.matchDate = normalizeKnockoutMatchDateV243(row.querySelector(".ko-match-date-v243")?.value || match.matchDate || "");
  match.date = match.matchDate;

  if (match.homeTeam && match.awayTeam && !match.matchDate) {
    toast("Define a data/hora deste jogo para abrir as apostas.");
    return;
  }

  if (!match.homeTeam || !match.awayTeam) {
    match.homeScore = null;
    match.awayScore = null;
    match.homePenalties = null;
    match.awayPenalties = null;
    match.winner = "";
    match.winnerTeam = "";
    match.qualified = "";
    markSettingsPending();
    saveLocalData("fase final equipas incompletas");
    await saveSettingsFastToFirebase("fase final equipas incompletas");
    renderKnockout();
    renderKnockoutAdmin();
    if (document.querySelector(".tab-panel.active")?.id === "knockoutTab") {
      renderKnockoutMobileV121();
      applyKnockoutLayoutFromSettings();
    }
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

  const qualifiedValue = row.querySelector(".ko-qualified-team-v247")?.value || "";
  if (qualifiedValue) {
    const normalizedQualified = normalizeComparable(qualifiedValue);
    const homeQualified = normalizedQualified === normalizeComparable(match.homeTeam);
    const awayQualified = normalizedQualified === normalizeComparable(match.awayTeam);
    if (!homeQualified && !awayQualified) {
      toast("Escolhe uma das duas equipas como qualificada.");
      return;
    }

    if (hasFullScore && !isDraw && ((Number(match.homeScore) > Number(match.awayScore) && !homeQualified) || (Number(match.awayScore) > Number(match.homeScore) && !awayQualified))) {
      toast("A equipa qualificada nao bate certo com o resultado.");
      return;
    }

    if (isDraw && match.homePenalties !== null && match.awayPenalties !== null && ((Number(match.homePenalties) > Number(match.awayPenalties) && !homeQualified) || (Number(match.awayPenalties) > Number(match.homePenalties) && !awayQualified))) {
      toast("A equipa qualificada nao bate certo com os penaltis.");
      return;
    }

    match.winner = qualifiedValue;
    match.winnerTeam = qualifiedValue;
    match.qualified = qualifiedValue;
  } else if (!hasFullScore) {
    match.winner = "";
    match.winnerTeam = "";
    match.qualified = "";
  }

  match.updatedAt = new Date().toISOString();

  propagateKnockoutWinners(false);
  addSystemLog("Jogo Fase Final guardado", `${match.roundLabel} ${match.index}: ${match.homeTeam} ${match.homeScore}-${match.awayScore} ${match.awayTeam}${match.homePenalties !== null && match.awayPenalties !== null ? ` · pen. ${match.homePenalties}-${match.awayPenalties}` : ""}`, {
    matchId: match.id,
    round: match.round,
    index: match.index,
    before: beforeMatch,
    after: {
      homeTeam: match.homeTeam || "",
      awayTeam: match.awayTeam || "",
      homeScore: match.homeScore ?? null,
      awayScore: match.awayScore ?? null,
      homePenalties: match.homePenalties ?? null,
      awayPenalties: match.awayPenalties ?? null,
      matchDate: match.matchDate || ""
    }
  }, { sync: true });
  markSettingsPending();
  saveLocalData("fase final jogo guardado");

  renderKnockout();
  renderKnockoutAdmin();
  if (document.querySelector(".tab-panel.active")?.id === "knockoutTab") {
    renderKnockoutMobileV121();
    applyKnockoutLayoutFromSettings();
  }
  if (sourceModal) closeKnockoutRecordModal();

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
  setActiveTabStateV217("adminTab");
  updateActiveAppSection();
  renderKnockoutAdmin();
  setTimeout(() => {
    const row = document.querySelector(`[data-ko-admin="${CSS.escape(matchId)}"]`);
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
    row?.classList.add("pulse-row");
    setTimeout(() => row?.classList.remove("pulse-row"), 1500);
  }, 80);
}

function activeTabIdV187() {
  return document.querySelector(".tab-panel.active")?.id || "calendarTab";
}

function ensureAdminSectionTabsV187() {
  let tabs = $("adminSectionTabsV187");
  const sections = [
    ["all", "Tudo"],
    ["users", "Users"],
    ["results", "Resultados"],
    ["points", "Pontos"],
    ["knockout", "Fase Final"],
    ["system", "Sistema"]
  ];
  if (!tabs) {
    tabs = document.createElement("div");
    tabs.id = "adminSectionTabsV187";
    tabs.className = "admin-section-tabs-v187";
  }
  if (!tabs.querySelector("[data-admin-section-v187]")) {
    tabs.innerHTML = sections.map(([key, label]) => `<button type="button" data-admin-section-v187="${key}">${label}</button>`).join("");
  }
  const overview = $("adminOverviewV162");
  if (!tabs.parentNode && overview?.parentNode) overview.parentNode.insertBefore(tabs, overview.nextSibling);
  return tabs;
}

function adminSectionForCardV187(card) {
  const text = (card?.textContent || "").toLowerCase();
  if (text.includes("permiss") || text.includes("utilizador") || text.includes("users do jogo")) return "users";
  if (text.includes("fase final") || text.includes("bracket")) return "knockout";
  if (text.includes("pontos") || text.includes("mvp") || text.includes("marcador") || text.includes("campe")) return "points";
  if (text.includes("resultado") || text.includes("excel") || text.includes("importar")) return "results";
  return "system";
}

function renderAdminSectionsV187() {
  const tabs = ensureAdminSectionTabsV187();
  if (!tabs) return;
  const active = localStorage.getItem(`${STORAGE_KEY}_admin_section_v187`) || "all";
  tabs.querySelectorAll("[data-admin-section-v187]").forEach(button => {
    button.classList.toggle("active", button.dataset.adminSectionV187 === active);
  });
  document.querySelectorAll("#adminUnlocked > .admin-card").forEach(card => {
    const section = adminSectionForCardV187(card);
    card.dataset.adminSectionV187 = section;
    card.classList.toggle("admin-section-hidden-v187", active !== "all" && section !== active);
  });
}

function renderActivePageV187(tabId = activeTabIdV187()) {
  if (tabId === "calendarTab") {
    renderCalendar();
    renderCalendarFilterState();
    return;
  }
  if (tabId === "scoreTab") {
    renderScore();
    return;
  }
  if (tabId === "knockoutTab") {
    renderKnockout();
    return;
  }
  if (tabId === "notificationsTab") {
    renderPushNotificationsPanelV165();
    renderPushHistoryPanelV187();
    renderNotificationsCenterV164();
    return;
  }
  if (tabId === "logsTab") {
    renderSystemLogs();
    return;
  }
  if (tabId === "adminTab") {
    renderAdmin();
    renderSettingsForm();
    renderUsers();
    renderUserBetsEditor();
    renderKnockoutAdmin();
    renderAdminOverviewV162();
    renderAdminSectionsV187();
    return;
  }
  if (tabId === "settingsTab") {
    renderAppSettingsPanelV162();
    renderInstallGuideV164();
  }
}

function renderAll() {
  setupSearchResultsAdminButton();
  setTimeout(addSearchButtonsToResultCards, 0);
  setupOnlineUsersCloseControls();
  setupKnockoutAdjustTopButton();
  renderAdminState();
  renderCalendarFilterState();
  renderActivePageV187();
  applyPermissionsToUi();
  updateActiveAppSection();
  setTimeout(addSearchButtonsToResultCards, 250);
}

function renderCalendarFilterState() {
  const missingBtn = $("calendarMissingResultsBtn");
  const playedBtn = $("calendarPlayedGamesBtn");
  const allBtn = $("calendarAllGamesBtn");

  const missingCount = games.filter(needsFinalResult).length;
  const playedCount = games.filter(hasFinalResult).length;
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
  const finalResult = hasFinalResult(game);
  const suspended = isSuspendedGame(game);
  const scoreText = finalResult ? `${game.homeScore}-${game.awayScore}` : (suspended ? "Suspenso" : "VS");
  const gameBets = betsForGame(game.id);
  const settledText = finalResult ? `${gameBets.length} apostas · pontos atribuídos` : `${gameBets.length} apostas importadas`;
  const resultButtonText = finalResult ? "Editar resultado" : "Adicionar resultado";

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
  if (isSuspendedGame(game)) return false;

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
  const groupRows = playedGamesNewestFirstV119().map(game => {
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

  const playerId = playerIdFromName(playerName);
  const knockoutRows = (appSettings.knockout?.matches || [])
    .filter(knockoutMatchHasResult)
    .map(match => {
      const bet = bets.find(item => item.gameId === match.id && (
        item.playerId === playerId ||
        playerIdFromName(item.playerName || "") === playerId ||
        String(item.playerName || "").trim().toLowerCase() === String(playerName || "").trim().toLowerCase()
      ));
      const points = bet ? pointsForKnockoutBet(bet, match) : 0;
      return {
        game: { ...match, phase: "Fase Final" },
        bet,
        points,
        label: bet ? knockoutBetResultLabel(bet, match) : "Sem aposta",
        className: bet ? knockoutBetResultClass(bet, match) : "miss",
        knockout: true
      };
    });

  return [...groupRows, ...knockoutRows];
}

function knockoutBetResultLabel(bet, match) {
  const labels = [];
  if (isExactKnockoutBet(bet, match)) labels.push("Resultado exato");
  else if (isWinnerKnockoutBet(bet, match)) labels.push("Vencedor");
  if (isExactKnockoutPenaltyBet(bet, match)) labels.push("Penáltis");
  return labels.length ? labels.join(" + ") : "Falhou";
}

function knockoutBetResultClass(bet, match) {
  if (isExactKnockoutBet(bet, match)) return "exact";
  if (isWinnerKnockoutBet(bet, match) || isExactKnockoutPenaltyBet(bet, match)) return "winner";
  return "miss";
}

function knockoutBetDisplay(bet) {
  if (!bet) return "-";
  const score = knockoutBetScorePair(bet);
  const pens = knockoutBetPenaltyPair(bet);
  const base = score ? `${score.home}-${score.away}` : "-";
  const withPens = pens ? `${base} pen. ${pens.home}-${pens.away}` : base;
  const qualified = bet.qualifiedTeam || bet.winner || "";
  return qualified ? `${withPens} · qual. ${qualified}` : withPens;
}

function scoreRowMeta(game, knockout = false) {
  if (knockout) return `${escapeHtml(game.roundLabel || knockoutRoundLabel(game.round))} · Jogo ${escapeHtml(game.index)}`;
  return `${escapeHtml(game.group)} · ${dateHeader(game.matchDate)} · ${timePortugal(game.matchDate)}`;
}

function scoreRowResult(game, knockout = false) {
  if (!knockout) {
    const [h, a] = gameScorePairV119(game);
    return h === null ? "-" : `${h}-${a}`;
  }

  const base = knockoutMatchHasResult(game) ? `${game.homeScore}-${game.awayScore}` : "-";
  const pens = knockoutPenaltiesV121(game);
  return pens ? `${base} pen. ${pens.home}-${pens.away}` : base;
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
                <span>${row.exact} exatos · ${row.winner} vencedor · ${row.penalties || 0} penáltis · ${settled} jogos com resultado · ${withBets} apostas</span>
              </div>
              <div class="player-total">${row.points} pts</div>
              <div class="player-arrow"></div>
            </summary>

            <div class="player-games-table">
              <div class="player-game-row head">
                <span>Jogo</span>
                <span>Aposta</span>
                <span>Resultado</span>
                <span>Tipo</span>
                <span>Pontos</span>
              </div>
              ${gameRows.map(({ game, bet, points, label, className, knockout }) => `
                <div class="player-game-row ${className}">
                  <span>
                    <b>${escapeHtml(game.homeTeam)} - ${escapeHtml(game.awayTeam)}</b>
                    <small>${scoreRowMeta(game, knockout)}</small>
                  </span>
                  <span>${knockout ? knockoutBetDisplay(bet) : (bet ? `${bet.homeGuess}-${bet.awayGuess}` : "-")}</span>
                  <span>${scoreRowResult(game, knockout)}</span>
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
    if (!hasFinalResult(game)) return;
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
    .filter(needsFinalResult)
    .filter(game => parsePortugalDate(game.matchDate).getTime() <= Date.now())
    .sort((a, b) => parsePortugalDate(a.matchDate) - parsePortugalDate(b.matchDate));

  if (dueGames.length) {
    openResultSearchForGame(dueGames[0]);
    if (dueGames.length > 1) toast(`Abri a pesquisa do primeiro jogo. Existem ${dueGames.length} jogos sem resultado.`);
    return;
  }

  const nextGame = (games || [])
    .filter(needsFinalResult)
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
  const canUseAdminPanel = isAdminProfile() || (isAdmin && hasPermission("admin"));
  $("adminLocked").classList.toggle("hidden", canUseAdminPanel);
  $("adminUnlocked").classList.toggle("hidden", !canUseAdminPanel);
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
  const knockoutPoints = { ...defaultKnockoutPointSettings(), ...(appSettings.knockoutPoints || {}) };
  if ($("knockoutPointsExactInput")) $("knockoutPointsExactInput").value = knockoutPoints.exact;
  if ($("knockoutPointsWinnerInput")) $("knockoutPointsWinnerInput").value = knockoutPoints.winner;
  if ($("knockoutPointsPenaltiesInput")) $("knockoutPointsPenaltiesInput").value = knockoutPoints.penalties;
  if ($("knockoutPointsMvpInput")) $("knockoutPointsMvpInput").value = knockoutPoints.mvp;
  if ($("knockoutPointsTopScorerInput")) $("knockoutPointsTopScorerInput").value = knockoutPoints.topScorer;
  if ($("knockoutPointsChampionInput")) $("knockoutPointsChampionInput").value = knockoutPoints.champion;
  $("finalMvpInput").value = appSettings.extraResults.mvp || "";
  $("finalTopScorerInput").value = appSettings.extraResults.topScorer || "";
  $("finalChampionInput").value = appSettings.extraResults.champion || "";
  if (appSettings.lastImport) {
    $("importSummary").innerHTML = `<strong>ltima importação:</strong> ${escapeHtml(new Date(appSettings.lastImport.at).toLocaleString("pt-PT"))} · ${appSettings.lastImport.bets || 0} apostas · ${appSettings.lastImport.players || 0} users · ${appSettings.lastImport.results || 0} resultados.`;
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
      ? `<strong>ltima sincronização:</strong> ${escapeHtml(new Date(api.lastSync.at).toLocaleString("pt-PT"))} · ${api.lastSync.updated || 0} resultados atualizados · ${api.lastSync.matched || 0} jogos encontrados na app.`
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
  addSystemLog("Apostas do utilizador editadas", `Apostas de ${playerName} atualizadas no Admin.`, { playerName, bets: newPlayerBets.length, removed: removedPlayerBetIds.length });

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
        <span class="admin-result-chip">${hasFinalResult(game) ? `Resultado: ${game.homeScore}-${game.awayScore}` : (isSuspendedGame(game) ? "Suspenso" : "Sem resultado")}</span>
        <button class="primary" type="button" data-result-game="${escapeHtml(game.id)}">${hasFinalResult(game) ? "Editar resultado" : "Adicionar resultado"}</button>
      </div>
    </article>`).join("");
}

function logCategoryV162(log) {
  const text = `${log?.action || ""} ${log?.detail || ""}`.toLowerCase();
  if (/erro|falh|error|pin errado/.test(text)) return "errors";
  if (/firebase|sync|sincron|cache|offline|online/.test(text)) return "sync";
  if (/fase final|knockout|pen[aá]lt|ronda|bracket/.test(text)) return "knockout";
  if (/resultado|jogo|suspens|suspenso|apostas?/.test(text)) return "results";
  if (/utilizador|user|users|permiss|conta|perfil/.test(text)) return "users";
  if (/admin|pontos|excel|import|export/.test(text)) return "admin";
  return "admin";
}

function logCategoryLabelV162(category) {
  return ({
    results: "Resultados",
    knockout: "Fase Final",
    users: "Utilizadores",
    sync: "Firebase / Sync",
    admin: "Admin",
    errors: "Erros"
  })[category] || "Admin";
}

function filteredSystemLogsV162() {
  const type = $("logsTypeFilter")?.value || "all";
  const search = String($("logsSearchInput")?.value || "").trim().toLowerCase();

  return systemLogs().filter(log => {
    const category = logCategoryV162(log);
    if (type !== "all" && category !== type) return false;
    if (!search) return true;
    const haystack = [
      log?.action,
      log?.detail,
      log?.actorName,
      log?.actorEmail,
      JSON.stringify(log?.meta || {})
    ].join(" ").toLowerCase();
    return haystack.includes(search);
  });
}

function renderLogsSummaryV162(logs, total) {
  const summary = $("logsSummaryV162");
  if (!summary) return;
  const active = $("logsTypeFilter")?.value || "all";
  const counts = logs.reduce((acc, log) => {
    const category = logCategoryV162(log);
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});

  summary.innerHTML = `
    <span>${logs.length} de ${total} logs</span>
    ${["results", "knockout", "users", "sync", "admin", "errors"].map(category => `
      <button type="button" class="log-chip-v162 ${active === category ? "active" : ""}" data-log-filter="${category}">
        ${escapeHtml(logCategoryLabelV162(category))} <b>${counts[category] || 0}</b>
      </button>
    `).join("")}
  `;
}

function renderAdminOverviewV162() {
  const container = $("adminOverviewV162");
  if (!container) return;

  const totalGames = games.length;
  const missing = games.filter(needsFinalResult).length;
  const played = games.filter(hasFinalResult).length;
  const suspended = games.filter(isSuspendedGame).length;
  const usersCount = allPlayers().length;
  const koCount = appSettings?.knockout?.matches?.length || 0;

  container.innerHTML = `
    <article>
      <span>Resultados</span>
      <strong>${played}/${totalGames}</strong>
      <p>${missing} jogos por fechar</p>
    </article>
    <article>
      <span>Suspensos</span>
      <strong>${suspended}</strong>
      <p>Continuam em falta até terem resultado final</p>
    </article>
    <article>
      <span>Users</span>
      <strong>${usersCount}</strong>
      <p>Participantes com apostas ou registo manual</p>
    </article>
    <article>
      <span>Fase Final</span>
      <strong>${koCount}</strong>
      <p>Jogos preparados no bracket</p>
    </article>
  `;
}

function pendingFirebaseSummaryV187() {
  return {
    jogos: pendingGameIds().length,
    apostas: pendingBetIds().length,
    apagarApostas: pendingDeleteBetIds().length,
    syncTotal: hasFullSyncPending() ? 1 : 0,
    definicoes: hasSettingsPending() ? 1 : 0
  };
}

function pendingFirebaseTotalV187() {
  const pending = pendingFirebaseSummaryV187();
  return Object.values(pending).reduce((sum, value) => sum + Number(value || 0), 0);
}

function ensureFirebaseHealthPanelV187() {
  let panel = $("firebaseHealthPanelV187");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "firebaseHealthPanelV187";
    panel.className = "firebase-health-v187";
  }
  const target = typeof settingsSectionContentV213 === "function" ? settingsSectionContentV213("system") : $("settingsTab");
  if (target && panel.parentElement !== target) target.appendChild(panel);
  return panel;
}

function ensurePushHistoryPanelV187() {
  let panel = $("pushHistoryPanelV187");
  if (panel) return panel;
  panel = document.createElement("div");
  panel.id = "pushHistoryPanelV187";
  panel.className = "push-history-v187";
  const pushPanel = $("pushNotificationsPanelV165");
  if (pushPanel?.parentNode) pushPanel.parentNode.insertBefore(panel, pushPanel.nextSibling);
  return panel;
}

function shortDateTimeV187(value) {
  const raw = value?.toDate ? value.toDate() : value;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
}

async function loadPushStatsV187(force = false) {
  if (!db || !firebaseApi?.collection || !firebaseApi?.getDocs) return pushStatsCacheV187;
  const fresh = Date.now() - (pushStatsCacheV187.loadedAt || 0) < 30000;
  if (!force && fresh) return pushStatsCacheV187;
  if (pushStatsCacheV187.loading) return pushStatsCacheV187;

  pushStatsCacheV187.loading = true;
  try {
    const { collection, getDocs } = firebaseApi;
    const [tokensSnap, testsSnap] = await Promise.all([
      withTimeout(getDocs(collection(db, "notificationTokens")), 8000, "ler tokens push"),
      withTimeout(getDocs(collection(db, "notificationTests")), 8000, "ler testes push")
    ]);

    const tokens = [];
    tokensSnap.forEach(docSnap => tokens.push({ id: docSnap.id, ...(docSnap.data() || {}) }));
    const tests = [];
    testsSnap.forEach(docSnap => tests.push({ id: docSnap.id, ...(docSnap.data() || {}) }));
    tests.sort((a, b) => new Date(b.createdAt || b.at || 0).getTime() - new Date(a.createdAt || a.at || 0).getTime());
    pushStatsCacheV187 = { loadedAt: Date.now(), tokens, tests: tests.slice(0, 20), loading: false };
  } catch (error) {
    console.warn("Não foi possível carregar estatísticas push:", error);
    pushStatsCacheV187 = { ...pushStatsCacheV187, loadedAt: Date.now(), loading: false, error: shortFirebaseError(error) };
  }
  return pushStatsCacheV187;
}

function renderFirebaseHealthPanelV187() {
  const panel = ensureFirebaseHealthPanelV187();
  if (!panel) return;

  const status = $("firebaseStatusBox")?.textContent || (storageMode === "firebase" ? "Firebase ligado" : "Modo local");
  const pending = pendingFirebaseSummaryV187();
  const pendingTotal = pendingFirebaseTotalV187();
  const saved = localStorage.getItem(STORAGE_KEY);
  let localSaved = "";
  try { localSaved = shortDateTimeV187(JSON.parse(saved || "{}")?.savedAt); } catch {}
  const economy = typeof window.firestoreEconomyStatusV114 === "function" ? window.firestoreEconomyStatusV114() : null;
  const enabledTokens = pushStatsCacheV187.tokens.filter(token => token.enabled !== false).length;
  const platforms = pushStatsCacheV187.tokens.reduce((acc, token) => {
    const key = token.platform || "web";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const lastTest = pushStatsCacheV187.tests[0];

  panel.innerHTML = `
    <div class="firebase-health-head-v187">
      <div>
        <span>Saúde da app</span>
        <strong>Firebase e push</strong>
      </div>
      <button id="refreshHealthV187" class="secondary" type="button">Atualizar</button>
    </div>
    <div class="health-grid-v187">
      <article class="${storageMode === "firebase" ? "ok" : "warn"}">
        <span>Ligacao</span>
        <strong>${escapeHtml(navigator.onLine ? "Online" : "Offline")}</strong>
        <p>${escapeHtml(status)}</p>
      </article>
      <article class="${pendingTotal ? "warn" : "ok"}">
        <span>Pendentes</span>
        <strong>${pendingTotal}</strong>
        <p>${pending.jogos} jogos, ${pending.apostas} apostas, ${pending.definicoes} configs</p>
      </article>
      <article>
        <span>Cache local</span>
        <strong>${localSaved ? "Ativa" : "Sem data"}</strong>
        <p>${escapeHtml(localSaved || "Ainda sem data guardada")}</p>
      </article>
      <article>
        <span>Tempo real</span>
        <strong>${realtimeUnsubscribers.length || 0}</strong>
        <p>${economy ? `${economy.pollers || 0} atualizadores em fundo` : "Listeners prontos quando Firebase liga"}</p>
      </article>
      <article class="${enabledTokens ? "ok" : "warn"}">
        <span>Push ativos</span>
        <strong>${enabledTokens}</strong>
        <p>${escapeHtml(Object.entries(platforms).map(([key, value]) => `${key}: ${value}`).join(" · ") || "Sem tokens lidos")}</p>
      </article>
      <article>
        <span>Último teste</span>
        <strong>${escapeHtml(lastTest?.type || lastTest?.testType || "-")}</strong>
        <p>${escapeHtml(lastTest ? `${lastTest.sent || 0} enviados · ${shortDateTimeV187(lastTest.createdAt || lastTest.at)}` : "Sem testes recentes")}</p>
      </article>
    </div>
  `;

  $("refreshHealthV187")?.addEventListener("click", async () => {
    await loadPushStatsV187(true);
    renderFirebaseHealthPanelV187();
    renderPushHistoryPanelV187();
  });

  if (!pushStatsCacheV187.loadedAt && !pushStatsCacheV187.loading && db) {
    loadPushStatsV187().then(() => {
      renderFirebaseHealthPanelV187();
      renderPushHistoryPanelV187();
    });
  }
}

function renderPushHistoryPanelV187() {
  const panel = ensurePushHistoryPanelV187();
  if (!panel) return;

  if (!hasPermission("admin")) {
    panel.innerHTML = "";
    return;
  }

  const rows = pushStatsCacheV187.tests.slice(0, 8).map(test => `
    <article class="push-history-row-v187">
      <div>
        <strong>${escapeHtml(test.title || test.type || test.testType || "Teste push")}</strong>
        <p>${escapeHtml(test.body || test.game || "Sem detalhe")}</p>
      </div>
      <span>${escapeHtml(`${test.sent || 0} enviados`)}</span>
      <small>${escapeHtml(shortDateTimeV187(test.createdAt || test.at))}</small>
    </article>
  `).join("");

  panel.innerHTML = `
    <div class="push-history-head-v187">
      <div>
        <span>Histórico push</span>
        <strong>Testes e envios recentes</strong>
      </div>
      <button id="refreshPushHistoryV187" class="secondary" type="button">Atualizar</button>
    </div>
    <div class="push-history-list-v187">${rows || "<p>Sem testes push recentes.</p>"}</div>
  `;

  $("refreshPushHistoryV187")?.addEventListener("click", async () => {
    await loadPushStatsV187(true);
    renderPushHistoryPanelV187();
    renderFirebaseHealthPanelV187();
  });

  if (!pushStatsCacheV187.loadedAt && !pushStatsCacheV187.loading && db) {
    loadPushStatsV187().then(renderPushHistoryPanelV187);
  }
}

function renderAppSettingsPanelV162() {
  const version = $("appVersionLabelV162");
  if (!version) return;

  version.textContent = APP_VERSION_LABEL;
  const standalone = isStandaloneMode();
  const ios = isIosDevice();
  const online = navigator.onLine;

  if ($("pwaInstallStateV162")) $("pwaInstallStateV162").textContent = standalone ? "Instalada" : "Pronta para instalar";
  if ($("pwaStandaloneStateV162")) {
    $("pwaStandaloneStateV162").textContent = standalone
      ? "A app está a correr em modo instalado."
      : ios
        ? "No iPhone, instala pelo Safari em Partilhar > Adicionar ao Ecrã Principal."
        : "Usa o botão instalar quando o navegador disponibilizar a instalação.";
  }
  if ($("pwaUpdateStateV162")) $("pwaUpdateStateV162").textContent = $("refreshAppBtn")?.classList.contains("has-update") ? "Nova versão pronta para aplicar." : "Versão atual carregada.";
  if ($("storageModeLabelV162")) $("storageModeLabelV162").textContent = storageMode === "firebase" ? "Firebase online" : "Modo local";
  if ($("settingsSyncLabelV162")) $("settingsSyncLabelV162").textContent = online ? "Dispositivo online. A app sincroniza quando o Firebase estiver disponível." : "Dispositivo offline. As alterações ficam guardadas localmente.";
}

function unlockLogsTab() {
  const input = $("logsPinInput");
  const pin = String(input?.value || "").trim();

  if (pin !== LOGS_PIN) {
    toast("PIN dos logs errado.");
    input?.focus();
    return;
  }

  if (input) input.value = "";
  setLogsUnlocked(true);
  addSystemLog("Aba logs aberta", "Os logs foram desbloqueados com PIN.", {}, { sync: true });
  renderSystemLogs();
  toast("Logs desbloqueados.");
}

function lockLogsTab() {
  setLogsUnlocked(false);
  renderSystemLogs();
  toast("Logs bloqueados.");
}

async function clearSystemLogs() {
  if (!isLogsUnlocked()) { toast("Desbloqueia os logs com PIN."); return; }
  if (!hasPermission("admin")) { toast("Sem permissão."); return; }
  if (!confirm("Limpar todos os logs do sistema?")) return;

  appSettings.logs = [];
  addSystemLog("Logs limpos", "O histórico de logs foi limpo pelo Admin.");
  await persistSettings();
  renderSystemLogs();
  toast("Logs limpos.");
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

  const beforeResult = {
    homeScore: game.homeScore ?? null,
    awayScore: game.awayScore ?? null
  };
  game.homeScore = Number(homeScore);
  game.awayScore = Number(awayScore);
  const afterResult = {
    homeScore: game.homeScore,
    awayScore: game.awayScore
  };
  stampGame(game, "resultado guardado");
  markGamePending(game.id);
  addSystemLog("Resultado guardado", `${game.homeTeam} ${game.homeScore}-${game.awayScore} ${game.awayTeam}`, { gameId: game.id, group: game.group, before: beforeResult, after: afterResult }, { sync: true });

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

  const beforeResult = {
    homeScore: game.homeScore ?? null,
    awayScore: game.awayScore ?? null
  };
  game.homeScore = null;
  game.awayScore = null;
  stampGame(game, "resultado limpo");
  markGamePending(game.id);
  addSystemLog("Resultado limpo", `${game.homeTeam} vs ${game.awayTeam}`, { gameId: game.id, group: game.group, before: beforeResult, after: { homeScore: null, awayScore: null } }, { sync: true });

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
  const normal = raw.replace(/[]/g, "-").replace(/\s+/g, " ");
  const match = normal.match(/(^|\D)(\d{1,2})\s*(?:-|:|\/|x)\s*(\d{1,2})(\D|$)/i);
  if (!match) return null;

  return [Number(match[2]), Number(match[3])];
}
function splitMatchLabel(label) {
  const raw = String(label || "").trim();
  if (!raw) return null;

  const scoreMatch = raw.match(/\s+(\d+\s*[-:\/x]\s*\d+)\s*$/i);
  const score = scoreMatch ? parseScore(scoreMatch[1]) : null;
  const cleanLabel = scoreMatch ? raw.slice(0, scoreMatch.index).trim() : raw;

  const directParts = cleanLabel.split(/\s+(?:-|||vs|v\.?|x)\s+/i);
  if (directParts.length >= 2) {
    return { home: canonicalTeam(directParts[0]), away: canonicalTeam(directParts.slice(1).join(" - ")), score };
  }

  // Caso venha sem espaços: "Colômbia-RD Congo"
  const looseParts = cleanLabel.split(/\s*(?:-||)\s*/).filter(Boolean);
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
      ${combined.errors.length ? `<details open><summary>${combined.errors.length} avisos  estas linhas não foram importadas</summary><ul>${combined.errors.slice(0, 80).map(err => `<li>${escapeHtml(err)}</li>`).join("")}</ul></details>` : `<p class="ok-line">Sem erros críticos encontrados.</p>`}
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
  addSystemLog("Excel importado", `${importResult.bets.length} apostas, ${new Set(importResult.bets.map(bet => bet.playerName)).size} users e ${importResult.results.length} resultados importados.`, { bets: importResult.bets.length, players: new Set(importResult.bets.map(bet => bet.playerName)).size, results: importResult.results.length, replace });
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
  appSettings.knockoutPoints = {
    exact: Number($("knockoutPointsExactInput")?.value ?? appSettings.knockoutPoints?.exact ?? 3) || 0,
    winner: Number($("knockoutPointsWinnerInput")?.value ?? appSettings.knockoutPoints?.winner ?? 1) || 0,
    penalties: Number($("knockoutPointsPenaltiesInput")?.value ?? appSettings.knockoutPoints?.penalties ?? 2) || 0,
    mvp: Number($("knockoutPointsMvpInput")?.value ?? appSettings.knockoutPoints?.mvp ?? 5) || 0,
    topScorer: Number($("knockoutPointsTopScorerInput")?.value ?? appSettings.knockoutPoints?.topScorer ?? 5) || 0,
    champion: Number($("knockoutPointsChampionInput")?.value ?? appSettings.knockoutPoints?.champion ?? 10) || 0
  };
  addSystemLog("Sistema de pontos atualizado", "Os pontos da fase de grupos e da Fase Final foram atualizados.", { points: appSettings.points, knockoutPoints: appSettings.knockoutPoints });
  await persistSettings(); renderAll(); toast("Sistema de pontos atualizado.");
}
async function saveExtraResults() {
  if (!hasPermission("editPoints")) { toast("Sem permissão."); return; }

  appSettings.extraResults = { mvp: $("finalMvpInput").value.trim(), topScorer: $("finalTopScorerInput").value.trim(), champion: $("finalChampionInput").value.trim() };
  addSystemLog("Resultados especiais guardados", `MVP: ${appSettings.extraResults.mvp || "-"} · Marcador: ${appSettings.extraResults.topScorer || "-"} · Campeão: ${appSettings.extraResults.champion || "-"}`, appSettings.extraResults);
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
  addSystemLog("User adicionado", `${name} foi adicionado aos users do jogo.`, { name });
  await persistSettings();
  renderAll();
  toast("User adicionado.");
}

async function removeUser(name) {
  if (!hasPermission("editUsers")) { toast("Sem permissão."); return; }

  if (!confirm(`Remover ${name} da lista de users? As apostas importadas não são apagadas.`)) return;
  appSettings.users = (appSettings.users || []).filter(user => user !== name);
  addSystemLog("User removido", `${name} foi removido da lista de users.`, { name });
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
    ["ltima exportação", new Date().toLocaleString("pt-PT")]
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
    const card = koEditButton.closest("#knockoutTab [data-ko-admin]");
    if (card) {
      card.classList.toggle("editing");
      card.querySelector(".ko-card-editor select, .ko-card-editor input")?.focus();
    } else {
      openKnockoutEditInAdmin(koEditButton.dataset.koEdit);
    }
    return;
  }

  const koRecordButton = event.target.closest("[data-ko-record]");
  if (koRecordButton) {
    openKnockoutRecordModal(koRecordButton.dataset.koRecord);
    return;
  }

  const koClickableCard = event.target.closest("#knockoutTab .ko-match-clickable[data-ko-admin], #knockoutMobileV121 .ko-match-clickable[data-ko-admin]");
  if (koClickableCard && !event.target.closest("button, a, input, select, textarea, label, summary")) {
    openKnockoutRecordModal(koClickableCard.dataset.koAdmin);
    return;
  }

  if (event.target.closest("[data-ko-record-close]") || event.target.id === "knockoutRecordModal") {
    closeKnockoutRecordModal();
    return;
  }

  const koSaveButton = event.target.closest("[data-ko-save]");
  if (koSaveButton) {
    saveKnockoutMatchFromAdmin(koSaveButton.dataset.koSave, koSaveButton);
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

document.addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") return;

  const koClickableCard = event.target.closest?.("#knockoutTab .ko-match-clickable[data-ko-admin], #knockoutMobileV121 .ko-match-clickable[data-ko-admin]");
  if (!koClickableCard) return;

  event.preventDefault();
  openKnockoutRecordModal(koClickableCard.dataset.koAdmin);
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
    setActiveTabStateV217(button.dataset.tab);
    updateActiveAppSection();
    renderActivePageV187(button.dataset.tab);
  });
});
$("unlockAdminBtn").addEventListener("click", () => {
  if (!hasPermission("admin")) return toast("Sem permissão Admin.");
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
$("syncFootballDataBtn")?.addEventListener("click", syncFootballDataResultsV139);
$("openExcelModalBtn")?.addEventListener("click", () => { setImportStatus("idle", "Aguardando ficheiro Excel", "Escolhe o Excel Resultados para importar."); $("excelModal").classList.remove("hidden"); });
$("closeExcelModalBtn")?.addEventListener("click", () => $("excelModal").classList.add("hidden"));
$("excelModal")?.addEventListener("click", event => { if (event.target.id === "excelModal") $("excelModal").classList.add("hidden"); });
$("previewExcelBtn")?.addEventListener("click", previewExcelImport);
$("confirmExcelImportBtn")?.addEventListener("click", confirmExcelImport);
$("savePointsSettingsBtn")?.addEventListener("click", savePointsSettings);
$("saveExtraResultsBtn")?.addEventListener("click", saveExtraResults);
$("exportPontosBtn")?.addEventListener("click", exportPontosExcel);
$("exportLogsBtn")?.addEventListener("click", exportSystemLogsCsv);
$("clearLogsBtn")?.addEventListener("click", clearSystemLogs);
$("unlockLogsBtn")?.addEventListener("click", unlockLogsTab);
$("lockLogsBtn")?.addEventListener("click", lockLogsTab);
$("logsPinInput")?.addEventListener("keydown", event => { if (event.key === "Enter") unlockLogsTab(); });
$("adminKnockoutUnlockedInput")?.addEventListener("change", event => updateKnockoutUnlockControlV230(event.target.checked));
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
      toast("No Edge: menu  > Apps > Instalar este site como aplicação.");
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
  renderNotificationsCenterV164();
  renderAppSettingsPanelV162();
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
    const role = normalizeRole(roleSelect.value);
    const isOwnerRole = role === "owner";
    const defaults = permissionsForRole(role);
    card?.querySelectorAll("[data-perm-key]").forEach(input => {
      input.disabled = isOwnerRole;
      input.checked = Boolean(defaults[input.dataset.permKey]);
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
firebaseReadyPromise = initFirebase();
await firebaseReadyPromise;
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




// v89  Chat mobile limpo: sem capturas globais agressivas.
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


// v91  fixes sobre base v89: menu por toque e imagem acima do chat.
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


// v92  Força visualizador de imagem por cima do chat mobile.
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


// v93  visualizador usa SEMPRE o src real do <img>, seguro no iPhone/Safari.
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
        safeVibrateV192(15);
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


// v98  Sistema de chat ativado/desativado por admin.
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


// v107  diagnóstico rápido no console.
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


// v116  barra de pesquisa funcional sem guardar texto.
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


// v137  Fase Final mobile limpa: lista completa da ronda e scroll normal do documento.
function cleanupKnockoutMobileLegacyClassesV137() {
  const legacyClasses = [
    "ko-mobile-scroll-page-v122",
    "ko-mobile-scroll-host-v122",
    "ko-mobile-scroll-list-v122",
    "knockout-scroll-active-v129",
    "ko-mobile-v131-active",
    "ko-mobile-v131-host",
    "ko-mobile-v131-list",
    "ko-round-page-scroll-v134",
    "ko-mobile-list-page-v135",
    "ko-true-scroll-v136"
  ];

  [
    document.documentElement,
    document.body,
    document.getElementById("knockoutTab"),
    document.getElementById("knockoutMobileV121"),
    document.querySelector("#knockoutMobileV121 .ko-mobile-list")
  ].filter(Boolean).forEach(element => {
    legacyClasses.forEach(className => element.classList.remove(className));
    ["height", "maxHeight", "overflow", "overflowY", "position"].forEach(prop => {
      element.style[prop] = "";
    });
  });
}

function syncKnockoutMobilePageV137() {
  updateActiveAppSection();
  const activePanel = document.querySelector(".tab-panel.active");
  const isKnockout = activePanel?.id === "knockoutTab";

  document.body.classList.toggle("knockout-mobile-page-v137", isKnockout);
  document.documentElement.classList.toggle("knockout-mobile-page-v137", isKnockout);

  if (!isKnockout) {
    document.getElementById("knockoutMobileV121")?.remove();
    cleanupKnockoutMobileLegacyClassesV137();
    return;
  }

  cleanupKnockoutMobileLegacyClassesV137();
  renderKnockoutMobileV121();
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(syncKnockoutMobilePageV137, 300);
  setTimeout(syncKnockoutMobilePageV137, 1000);
});

document.addEventListener("click", event => {
  const tabButton = event.target.closest("[data-tab]");
  const roundButton = event.target.closest("[data-ko-mobile-round]");
  if (tabButton || roundButton) {
    setTimeout(syncKnockoutMobilePageV137, 120);
    return;
  }

  setTimeout(() => {
    if (document.querySelector(".tab-panel.active")?.id !== "knockoutTab") {
      syncKnockoutMobilePageV137();
    }
  }, 120);
});

window.addEventListener("resize", () => setTimeout(syncKnockoutMobilePageV137, 120));
window.addEventListener("orientationchange", () => setTimeout(syncKnockoutMobilePageV137, 260));


// v139  resultados automáticos via football-data.org + Firebase Function.
function footballDataFunctionUrlV139() {
  const projectId = APP_CONFIG?.firebase?.projectId || "";
  return projectId ? `https://europe-west1-${projectId}.cloudfunctions.net/syncFootballDataWorldCup` : "";
}

function mergeFootballDataGameUpdatesV139(updatedGames = []) {
  if (!Array.isArray(updatedGames) || !updatedGames.length) return 0;

  let changed = 0;
  updatedGames.forEach(update => {
    const game = games.find(item => item.id === update.id);
    if (!game) return;

    const home = update.homeScore === "" || update.homeScore === undefined ? null : update.homeScore;
    const away = update.awayScore === "" || update.awayScore === undefined ? null : update.awayScore;

    if (String(game.homeScore ?? "") !== String(home ?? "") || String(game.awayScore ?? "") !== String(away ?? "")) {
      changed += 1;
    }

    Object.assign(game, {
      footballDataId: update.footballDataId || game.footballDataId || "",
      footballDataStatus: update.footballDataStatus || update.status || game.footballDataStatus || "",
      footballDataStage: update.footballDataStage || update.stage || game.footballDataStage || "",
      footballDataLocked: update.footballDataLocked === undefined ? game.footballDataLocked : update.footballDataLocked,
      footballDataUtcDate: update.footballDataUtcDate || game.footballDataUtcDate || "",
      liveHomeScore: update.liveHomeScore ?? game.liveHomeScore ?? null,
      liveAwayScore: update.liveAwayScore ?? game.liveAwayScore ?? null,
      homeScore: home,
      awayScore: away,
      updatedAt: update.updatedAt || new Date().toISOString()
    });

    if (typeof clearPendingGame === "function") clearPendingGame(game.id);
  });

  return changed;
}

function mergeFootballDataKnockoutV139(knockoutMatches = []) {
  if (!Array.isArray(knockoutMatches) || !knockoutMatches.length) return 0;
  if (!appSettings.knockout) appSettings.knockout = {};

  const current = Array.isArray(appSettings.knockout.matches) ? appSettings.knockout.matches : [];
  const byId = new Map(current.map(match => [match.id, match]));
  let changed = 0;

  knockoutMatches.forEach(update => {
    if (!update?.id) return;
    const existing = byId.get(update.id);
    if (!existing) return;

    const before = JSON.stringify({
      homeScore: existing.homeScore ?? null,
      awayScore: existing.awayScore ?? null,
      homePenalties: existing.homePenalties ?? null,
      awayPenalties: existing.awayPenalties ?? null
    });

    Object.assign(existing, {
      footballDataId: update.footballDataId || existing.footballDataId || "",
      footballDataStatus: update.footballDataStatus || update.status || existing.footballDataStatus || "",
      footballDataStage: update.footballDataStage || update.stage || existing.footballDataStage || "",
      footballDataLocked: update.footballDataLocked === undefined ? existing.footballDataLocked : update.footballDataLocked,
      footballDataUtcDate: update.footballDataUtcDate || existing.footballDataUtcDate || "",
      liveHomeScore: update.liveHomeScore ?? existing.liveHomeScore ?? null,
      liveAwayScore: update.liveAwayScore ?? existing.liveAwayScore ?? null,
      homeScore: update.homeScore ?? existing.homeScore ?? null,
      awayScore: update.awayScore ?? existing.awayScore ?? null,
      homePenalties: update.homePenalties ?? existing.homePenalties ?? null,
      awayPenalties: update.awayPenalties ?? existing.awayPenalties ?? null,
      updatedAt: update.updatedAt || new Date().toISOString()
    });

    const after = JSON.stringify({
      homeScore: existing.homeScore ?? null,
      awayScore: existing.awayScore ?? null,
      homePenalties: existing.homePenalties ?? null,
      awayPenalties: existing.awayPenalties ?? null
    });

    if (before !== after) changed += 1;
  });

  try {
    if (changed && typeof propagateKnockoutWinners === "function") propagateKnockoutWinners(false);
  } catch (error) {
    console.warn("Não consegui propagar vencedores depois do football-data.", error);
  }

  return changed;
}

async function syncFootballDataResultsV139() {
  if (!hasPermission("editResults")) {
    toast("Sem permissão para atualizar resultados.");
    return;
  }

  if (!currentUser || !firebaseAuth) {
    toast("Tens de estar com login feito para atualizar resultados.");
    return;
  }

  const url = footballDataFunctionUrlV139();
  if (!url) {
    toast("Projeto Firebase em falta no config.js.");
    return;
  }

  const btn = $("syncFootballDataBtn");
  const oldText = btn?.textContent || "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = "A atualizar...";
  }

  try {
    setFirebaseStatus("loading", "Football-data: a procurar resultados...");
    const token = await currentUser.getIdToken(true);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        competition: "WC",
        season: "2026"
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    const changedGames = mergeFootballDataGameUpdatesV139([...(data.matchedGamesStatus || []), ...(data.updatedGames || [])]);
    const changedKo = mergeFootballDataKnockoutV139(data.updatedKnockoutMatches || []);

    saveLocalData("football-data resultados atualizados");
    if (typeof renderAll === "function") renderAll();

    const total = Number(data.updatedGames?.length || 0) + Number(data.updatedKnockoutMatches?.length || 0);
    const changed = changedGames + changedKo;
    const msg = total
      ? `Football-data: ${total} resultado(s) encontrado(s), ${changed} alterado(s).`
      : "Football-data: nenhum resultado novo encontrado.";

    setFirebaseStatus("success", msg);
    toast(msg);
  } catch (error) {
    console.error("Football-data falhou:", error);
    setFirebaseStatus("error", `Football-data: ${error.message || "erro"}`);
    toast(`Football-data falhou: ${error.message || "erro"}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText || "Atualizar resultados automáticos";
    }
  }
}

function setupFootballDataButtonV139() {
  const btn = $("syncFootballDataBtn");
  if (!btn || btn.dataset.footballDataReady === "1") return;
  btn.dataset.footballDataReady = "1";
  btn.addEventListener("click", syncFootballDataResultsV139);
}
document.addEventListener("DOMContentLoaded", () => setTimeout(setupFootballDataButtonV139, 300));
document.addEventListener("click", () => setTimeout(setupFootballDataButtonV139, 100));


// v142  garante botão Football-data no Admin, sem depender do HTML original.
function canUseFootballDataSyncV142() {
  try {
    if (typeof hasPermission === "function" && hasPermission("editResults")) return true;
    if (typeof isAdmin !== "undefined" && isAdmin) return true;
    if (typeof currentUser !== "undefined" && currentUser?.email) {
      const email = String(currentUser.email || "").toLowerCase();
      if (email === "pica.fern@gmail.com") return true;
    }
  } catch {}
  return false;
}

function findAdminContainerV142() {
  const candidates = [
    "#adminTab",
    "#adminPanel",
    "[data-tab-panel='admin']",
    "[data-page='admin']",
    ".admin-panel",
    ".admin-section",
    "#settingsTab",
    "#configTab"
  ];

  for (const selector of candidates) {
    const el = document.querySelector(selector);
    if (el) return el;
  }

  const active = document.querySelector(".tab-panel.active");
  if (active && /admin|config|settings|defini/i.test(active.id + " " + active.textContent)) return active;

  return document.querySelector("main") || document.body;
}

function ensureFootballDataButtonV142() {
  try {
    if (document.querySelector(".tab-panel.active")?.id !== "settingsTab") return;
    if (typeof ensureFootballDataSettingsBoxV213 === "function") ensureFootballDataSettingsBoxV213();
  } catch (error) {
    console.warn("Botão football-data settings falhou:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(ensureFootballDataButtonV142, 300);
  setTimeout(ensureFootballDataButtonV142, 1000);
  setTimeout(ensureFootballDataButtonV142, 2000);
});
document.addEventListener("click", () => {
  setTimeout(ensureFootballDataButtonV142, 120);
  setTimeout(ensureFootballDataButtonV142, 500);
});


// v143  botão fixo no topo do Admin, independente do layout interno.
function isAdminPageActiveV143() {
  try {
    const adminTabActive = document.querySelector('.tab.active[data-tab="admin"], .nav-btn.active[data-tab="admin"], button.active[data-tab="admin"]');
    if (adminTabActive) return true;

    const activePanel = document.querySelector(".tab-panel.active, .page.active, section.active");
    const text = ((activePanel?.id || "") + " " + (activePanel?.textContent || "")).toLowerCase();
    if (text.includes("permissões de utilizadores") || text.includes("permissoes de utilizadores")) return true;
    if (text.includes("importar excel resultados") && text.includes("sistema de pontos")) return true;

    return false;
  } catch {
    return false;
  }
}

function findAdminRootV143() {
  const byContent = Array.from(document.querySelectorAll("section, main, div"))
    .filter(el => {
      const text = (el.textContent || "").toLowerCase();
      return text.includes("permissões de utilizadores") || text.includes("permissoes de utilizadores");
    })
    .sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);

  return byContent[0] || document.querySelector(".tab-panel.active") || document.querySelector("main") || document.body;
}

function ensureFootballDataAdminFixedButtonV143() {
  try {
    if (document.querySelector(".tab-panel.active")?.id !== "settingsTab") return;
    if (typeof ensureFootballDataSettingsBoxV213 === "function") ensureFootballDataSettingsBoxV213();
  } catch (error) {
    console.warn("Botão football-data settings fixo falhou:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(ensureFootballDataAdminFixedButtonV143, 250);
  setTimeout(ensureFootballDataAdminFixedButtonV143, 900);
  setTimeout(ensureFootballDataAdminFixedButtonV143, 1800);
  setInterval(ensureFootballDataAdminFixedButtonV143, 2500);
});
document.addEventListener("click", () => {
  setTimeout(ensureFootballDataAdminFixedButtonV143, 100);
  setTimeout(ensureFootballDataAdminFixedButtonV143, 450);
});


// v144  força layout desktop a ocupar a largura toda.
function enablePcFullWidthV144() {
  try {
    const isDesktop = window.matchMedia("(min-width: 900px)").matches;
    document.body.classList.toggle("pc-full-width-v144", isDesktop);
    document.documentElement.classList.toggle("pc-full-width-v144", isDesktop);
  } catch {}
}
window.addEventListener("resize", enablePcFullWidthV144);
document.addEventListener("DOMContentLoaded", () => {
  enablePcFullWidthV144();
  setTimeout(enablePcFullWidthV144, 400);
  setTimeout(enablePcFullWidthV144, 1200);
});


// v147  força ecrã todo no PC/GitHub Pages, mesmo com wrappers antigos.
function forceDesktopFullscreenV147() {
  try {
    const desktop = window.innerWidth >= 900;
    document.documentElement.classList.toggle("desktop-fullscreen-v147", desktop);
    document.body.classList.toggle("desktop-fullscreen-v147", desktop);

    if (!desktop) return;

    const selectors = [
      "body", "#app", ".app", ".app-shell", ".shell", ".page-shell", ".container",
      ".main-container", "main", ".main", ".content", ".app-content",
      ".tab-content", ".tab-panel.active", ".panel", ".card"
    ];

    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        el.style.maxWidth = "none";
        el.style.width = "100%";
        el.style.boxSizing = "border-box";
      });
    });
  } catch (error) {
    console.warn("fullscreen v147 falhou:", error);
  }
}
window.addEventListener("resize", forceDesktopFullscreenV147);
document.addEventListener("DOMContentLoaded", () => {
  forceDesktopFullscreenV147();
  setTimeout(forceDesktopFullscreenV147, 300);
  setTimeout(forceDesktopFullscreenV147, 1200);
});
document.addEventListener("click", () => setTimeout(forceDesktopFullscreenV147, 120));


// v149  football-data free: automático clean, sem funcionalidades premium.
const FOOTBALL_FREE_AUTO_V149 = {
  minMinutesBetweenAutoSync: 45,
  storageKey: "mundial_football_free_last_auto_v149"
};

function footballFreeCanAutoSyncV149() {
  try {
    if (!currentUser || !firebaseAuth) return false;
    const allowed =
      (typeof hasPermission === "function" && hasPermission("editResults")) ||
      (typeof isAdmin !== "undefined" && isAdmin) ||
      String(currentUser?.email || "").toLowerCase() === "pica.fern@gmail.com";
    if (!allowed) return false;

    const last = Number(localStorage.getItem(FOOTBALL_FREE_AUTO_V149.storageKey) || "0");
    const elapsed = Date.now() - last;
    return elapsed > FOOTBALL_FREE_AUTO_V149.minMinutesBetweenAutoSync * 60 * 1000;
  } catch {
    return false;
  }
}

function footballFreeFormatDateV149(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("pt-PT", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
}

function renderFootballFreeStatusV149(data = null) {
  try {
    let box = document.getElementById("footballFreeStatusBoxV149");
    const target =
      (typeof settingsSectionContentV213 === "function" ? settingsSectionContentV213("system") : null) ||
      document.getElementById("settingsTab") ||
      document.querySelector("main") ||
      document.body;

    if (!box) {
      box = document.createElement("div");
      box.id = "footballFreeStatusBoxV149";
      box.className = "football-free-status-box-v149";
    }
    if (box.parentElement !== target) target.appendChild(box);

    const last = data?.lastSyncIso || localStorage.getItem("mundial_football_free_last_sync_iso_v149") || "";
    const upcoming = Array.isArray(data?.upcoming) ? data.upcoming.slice(0, 4) : [];
    const locked = Array.isArray(data?.liveOrLocked) ? data.liveOrLocked.length : 0;

    box.innerHTML = `
      <div class="football-free-status-head-v149">
        <strong>Football-data Free</strong>
        <span>${last ? `ltima sync: ${footballFreeFormatDateV149(last)}` : "Pronto para sincronizar"}</span>
      </div>
      <div class="football-free-status-grid-v149">
        <div><b>${Number(data?.updatedGames?.length || 0) + Number(data?.updatedKnockoutMatches?.length || 0)}</b><span>resultados encontrados</span></div>
        <div><b>${Number(data?.finished || 0)}</b><span>jogos terminados</span></div>
        <div><b>${locked}</b><span>a decorrer/bloqueados</span></div>
      </div>
      ${upcoming.length ? `
        <div class="football-free-upcoming-v149">
          <small>Próximos jogos pela API</small>
          ${upcoming.map(match => `
            <p><span>${footballFreeFormatDateV149(match.utcDate)}</span><strong>${escapeHtml(match.homeTeam || "")} vs ${escapeHtml(match.awayTeam || "")}</strong></p>
          `).join("")}
        </div>
      ` : ""}
    `;

    box.hidden = false;
    box.style.display = "";
  } catch (error) {
    console.warn("renderFootballFreeStatusV149 falhou:", error);
  }
}

async function syncFootballDataResultsFreeV149(mode = "manual") {
  if (!hasPermission("editResults")) {
    toast("Sem permissão para atualizar resultados.");
    return;
  }

  if (!currentUser || !firebaseAuth) {
    toast("Tens de estar com login feito para atualizar resultados.");
    return;
  }

  const url = footballDataFunctionUrlV139();
  if (!url) {
    toast("Projeto Firebase em falta no config.js.");
    return;
  }

  const btn = $("syncFootballDataBtn");
  const oldText = btn?.textContent || "";
  if (btn) {
    btn.disabled = true;
    btn.textContent = mode === "auto" ? "Sync automática..." : "A atualizar...";
  }

  try {
    setFirebaseStatus("loading", mode === "auto" ? "Football-data: sync automática..." : "Football-data: a procurar resultados...");
    const token = await currentUser.getIdToken(true);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        competition: "WC",
        season: "2026",
        mode,
        daysBefore: 1,
        daysAfter: 7
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    const changedGames = mergeFootballDataGameUpdatesV139([...(data.matchedGamesStatus || []), ...(data.updatedGames || [])]);
    const changedKo = mergeFootballDataKnockoutV139(data.updatedKnockoutMatches || []);

    localStorage.setItem("mundial_football_free_last_sync_iso_v149", data.lastSyncIso || new Date().toISOString());
    if (mode === "auto") localStorage.setItem(FOOTBALL_FREE_AUTO_V149.storageKey, String(Date.now()));

    saveLocalData("football-data free sync");
    if (typeof renderAll === "function") renderAll();

    renderFootballFreeStatusV149(data);

    const total = Number(data.updatedGames?.length || 0) + Number(data.updatedKnockoutMatches?.length || 0);
    const changed = changedGames + changedKo;
    const msg = total
      ? `Football-data Free: ${total} resultado(s), ${changed} alterado(s).`
      : "Football-data Free: nenhum resultado novo encontrado.";

    setFirebaseStatus("success", msg);
    if (mode !== "auto") toast(msg);
  } catch (error) {
    console.error("Football-data Free falhou:", error);
    setFirebaseStatus("error", `Football-data: ${error.message || "erro"}`);
    if (mode !== "auto") toast(`Football-data: ${error.message || "erro"}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText || "Atualizar resultados automáticos";
    }
  }
}

function setupFootballFreeAutoV149() {
  try {
    const btn = $("syncFootballDataBtn");
    if (btn && btn.dataset.footballFreeV149 !== "1") {
      btn.dataset.footballFreeV149 = "1";
      btn.textContent = "Sincronizar Football-data Free";
      btn.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        syncFootballDataResultsFreeV149("manual");
      }, true);
    }

    renderFootballFreeStatusV149();

    if (footballFreeCanAutoSyncV149()) {
      localStorage.setItem(FOOTBALL_FREE_AUTO_V149.storageKey, String(Date.now()));
      syncFootballDataResultsFreeV149("auto");
    }
  } catch (error) {
    console.warn("setupFootballFreeAutoV149 falhou:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(setupFootballFreeAutoV149, 800);
  setTimeout(setupFootballFreeAutoV149, 2200);
});
document.addEventListener("click", () => setTimeout(setupFootballFreeAutoV149, 180));


// v150  desbloqueia e fecha modais/abas presas na Fase Final mobile.
function closeStuckFinalPhaseModalV150(reason = "") {
  try {
    const selectors = [
      ".modal.show",
      ".modal.open",
      ".modal.active",
      ".dialog.show",
      ".dialog.open",
      ".dialog.active",
      ".popup.show",
      ".popup.open",
      ".popup.active",
      ".drawer.show",
      ".drawer.open",
      ".drawer.active",
      ".sheet.show",
      ".sheet.open",
      ".sheet.active",
      ".bottom-sheet.show",
      ".bottom-sheet.open",
      ".bottom-sheet.active",
      ".overlay.show",
      ".overlay.open",
      ".overlay.active",
      ".modal-backdrop",
      ".backdrop",
      ".drawer-backdrop"
    ];

    document.querySelectorAll(selectors.join(",")).forEach(el => {
      const text = (el.textContent || "").toLowerCase();
      const idClass = `${el.id || ""} ${el.className || ""}`.toLowerCase();
      const looksRelated =
        idClass.includes("knockout") ||
        idClass.includes("final") ||
        idClass.includes("match") ||
        idClass.includes("resultado") ||
        idClass.includes("registo") ||
        text.includes("adicionar registo") ||
        text.includes("guardar") ||
        text.includes("resultado") ||
        text.includes("fase final");

      if (!looksRelated && !el.className?.toString?.().toLowerCase?.().includes("backdrop")) return;

      el.classList.remove("show", "open", "active", "visible", "is-open", "is-active");
      el.setAttribute("aria-hidden", "true");
      el.hidden = true;
      el.style.display = "none";
      el.style.pointerEvents = "none";
    });

    document.body.classList.remove("modal-open", "drawer-open", "sheet-open", "overflow-hidden", "no-scroll", "lock-scroll");
    document.documentElement.classList.remove("modal-open", "drawer-open", "sheet-open", "overflow-hidden", "no-scroll", "lock-scroll");
    document.body.style.overflow = "";
    document.body.style.pointerEvents = "";
    document.documentElement.style.overflow = "";

    const koTab = document.getElementById("knockoutTab");
    const koMobile = document.getElementById("knockoutMobileV121");
    if (koTab) {
      koTab.style.pointerEvents = "";
      koTab.style.overflow = "";
    }
    if (koMobile) {
      koMobile.style.pointerEvents = "";
      koMobile.style.overflow = "";
    }

    if (typeof renderKnockoutMobileV121 === "function") {
      setTimeout(() => {
        try {
          const activePanel = document.querySelector(".tab-panel.active");
          if (activePanel?.id === "knockoutTab") renderKnockoutMobileV121();
        } catch {}
      }, 120);
    }

    console.info("Modal Fase Final mobile fechado/desbloqueado v150", reason);
  } catch (error) {
    console.warn("closeStuckFinalPhaseModalV150 falhou:", error);
  }
}

function installFinalPhaseModalCloseFixV150() {
  try {
    if (document.body.dataset.finalPhaseModalFixV150 === "1") return;
    document.body.dataset.finalPhaseModalFixV150 = "1";

    document.addEventListener("click", event => {
      const target = event.target;
      const closeBtn = target.closest?.(
        "[data-close], [data-dismiss], .modal-close, .close-modal, .close, .btn-close, .sheet-close, .drawer-close, .popup-close, .toast-close, .x-close"
      );

      if (closeBtn) {
        setTimeout(() => closeStuckFinalPhaseModalV150("close button"), 40);
        setTimeout(() => closeStuckFinalPhaseModalV150("close button delayed"), 250);
        return;
      }

      const addOrSave = target.closest?.("button, .button, [role='button']");
      const label = (addOrSave?.textContent || "").toLowerCase().trim();
      if (
        label.includes("adicionar registo") ||
        label.includes("guardar") ||
        label.includes("adicionar") ||
        label.includes("confirmar")
      ) {
        const inKnockout = !!target.closest?.("#knockoutTab, #knockoutMobileV121, .knockout-mobile-v121");
        if (inKnockout || document.querySelector(".tab-panel.active")?.id === "knockoutTab") {
          setTimeout(() => closeStuckFinalPhaseModalV150("after add/save"), 450);
          setTimeout(() => closeStuckFinalPhaseModalV150("after add/save delayed"), 1200);
        }
      }

      const backdrop = target.closest?.(".modal-backdrop, .backdrop, .drawer-backdrop, .overlay");
      if (backdrop && target === backdrop) {
        setTimeout(() => closeStuckFinalPhaseModalV150("backdrop"), 30);
      }
    }, true);

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeStuckFinalPhaseModalV150("escape");
      }
    });

    document.addEventListener("touchend", event => {
      const target = event.target;
      const closeBtn = target.closest?.(
        "[data-close], [data-dismiss], .modal-close, .close-modal, .close, .btn-close, .sheet-close, .drawer-close, .popup-close, .x-close"
      );
      if (closeBtn) {
        setTimeout(() => closeStuckFinalPhaseModalV150("touch close"), 50);
      }
    }, { passive: true });
  } catch (error) {
    console.warn("installFinalPhaseModalCloseFixV150 falhou:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(installFinalPhaseModalCloseFixV150, 250);
  setTimeout(installFinalPhaseModalCloseFixV150, 1000);
});
document.addEventListener("click", () => setTimeout(installFinalPhaseModalCloseFixV150, 80));


// v151  aviso visual discreto da sync 24/7.
function updateFootball247LabelV151() {
  try {
    const box = document.getElementById("footballFreeStatusBoxV149");
    if (!box || box.querySelector(".football-247-badge-v151")) return;
    const badge = document.createElement("div");
    badge.className = "football-247-badge-v151";
    badge.textContent = "Sync 24/7 ativa · minuto a minuto";
    box.appendChild(badge);
  } catch {}
}
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(updateFootball247LabelV151, 1200);
  setTimeout(updateFootball247LabelV151, 2600);
});
document.addEventListener("click", () => setTimeout(updateFootball247LabelV151, 220));


// v156  indicador em tempo real da sync 24/7 via Firestore.
let footballRealtimeSyncUnsubV156 = null;
let footballRealtimeSyncLastDataV156 = null;
let footballRealtimeSyncTimerV156 = null;

function footballRealtimeSyncFormatV156(value) {
  if (!value) return "";
  let date = null;

  try {
    if (value?.toDate) date = value.toDate();
    else if (typeof value === "string") date = new Date(value);
    else if (value instanceof Date) date = value;
  } catch {}

  if (!date || Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function footballRealtimeSyncAgeV156(value) {
  let date = null;
  try {
    if (value?.toDate) date = value.toDate();
    else if (typeof value === "string") date = new Date(value);
    else if (value instanceof Date) date = value;
  } catch {}

  if (!date || Number.isNaN(date.getTime())) return { text: "sem dados", state: "unknown" };

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 75) return { text: `há ${seconds}s`, state: "online" };
  const minutes = Math.floor(seconds / 60);
  if (minutes < 5) return { text: `há ${minutes}min`, state: "warning" };
  return { text: `há ${minutes}min`, state: "error" };
}

function footballRealtimeSyncEnsureBoxV156() {
  let box = document.getElementById("footballRealtimeSyncBoxV156");
  if (box) return box;

  box = document.createElement("section");
  box.id = "footballRealtimeSyncBoxV156";
  box.className = "football-realtime-sync-box-v156";
  box.innerHTML = `
    <div class="football-realtime-sync-top-v156">
      <div>
        <strong>Sync API em tempo real</strong>
        <span id="footballRealtimeSyncSubV156">A ligar ao Firestore...</span>
      </div>
      <div class="football-realtime-sync-pill-v156 unknown" id="footballRealtimeSyncPillV156">
        <i></i><span>A verificar</span>
      </div>
    </div>
    <div class="football-realtime-sync-grid-v156">
      <div><b id="footballRealtimeSyncLastV156"></b><span>ltima sync</span></div>
      <div><b id="footballRealtimeSyncMatchesV156"></b><span>Jogos API</span></div>
      <div><b id="footballRealtimeSyncFinishedV156"></b><span>Terminados</span></div>
      <div><b id="footballRealtimeSyncUpdatedV156"></b><span>Atualizados</span></div>
    </div>
  `;

  const target =
    document.querySelector("#dashboardTab") ||
    document.querySelector(".tab-panel.active") ||
    document.querySelector("main") ||
    document.querySelector(".app-content") ||
    document.body;

  const afterHeader =
    target.querySelector?.(".page-title, .section-title, h1, h2") ||
    target.firstElementChild;

  if (afterHeader?.insertAdjacentElement) afterHeader.insertAdjacentElement("afterend", box);
  else target.prepend(box);

  return box;
}

function footballRealtimeSyncRenderV156(data = null) {
  try {
    footballRealtimeSyncLastDataV156 = data || footballRealtimeSyncLastDataV156 || {};
    const current = footballRealtimeSyncLastDataV156 || {};
    const box = footballRealtimeSyncEnsureBoxV156();

    const lastValue = current.lastSyncIso || current.lastSyncAt || "";
    const age = footballRealtimeSyncAgeV156(lastValue);

    const pill = document.getElementById("footballRealtimeSyncPillV156");
    const sub = document.getElementById("footballRealtimeSyncSubV156");
    const last = document.getElementById("footballRealtimeSyncLastV156");
    const matches = document.getElementById("footballRealtimeSyncMatchesV156");
    const finished = document.getElementById("footballRealtimeSyncFinishedV156");
    const updated = document.getElementById("footballRealtimeSyncUpdatedV156");

    if (pill) {
      pill.className = `football-realtime-sync-pill-v156 ${age.state}`;
      const label =
        age.state === "online" ? "Online" :
        age.state === "warning" ? "Atrasada" :
        age.state === "error" ? "Sem sync recente" :
        "Sem dados";
      pill.querySelector("span").textContent = label;
    }

    if (sub) {
      const mode = current.mode || "24/7 minuto a minuto";
      const by = current.lastSyncBy ? ` · ${current.lastSyncBy}` : "";
      sub.textContent = `${mode} · ${age.text}${by}`;
    }

    if (last) last.textContent = footballRealtimeSyncFormatV156(lastValue);
    if (matches) matches.textContent = current.apiMatches ?? "0";
    if (finished) finished.textContent = current.finished ?? "0";

    const totalUpdated =
      Number(current.updatedGames || 0) +
      Number(current.updatedKnockoutMatches || 0) +
      Number(current.matchedGamesStatus || 0);

    if (updated) updated.textContent = String(totalUpdated);

    if (box) box.dataset.state = age.state;
  } catch (error) {
    console.warn("footballRealtimeSyncRenderV156 falhou:", error);
  }
}

function footballRealtimeSyncStartV156() {
  try {
    footballRealtimeSyncEnsureBoxV156();
    footballRealtimeSyncRenderV156();

    if (!window.db && typeof db === "undefined") {
      setTimeout(footballRealtimeSyncStartV156, 800);
      return;
    }

    const firestoreDb = typeof db !== "undefined" ? db : window.db;
    if (!firestoreDb?.collection) {
      setTimeout(footballRealtimeSyncStartV156, 800);
      return;
    }

    if (footballRealtimeSyncUnsubV156) return;

    footballRealtimeSyncUnsubV156 = firestoreDb
      .collection("settings")
      .doc("footballData")
      .onSnapshot(snapshot => {
        const data = snapshot.exists ? (snapshot.data() || {}) : {};
        footballRealtimeSyncRenderV156(data);
      }, error => {
        console.warn("Sync tempo real indisponível:", error);
        const box = footballRealtimeSyncEnsureBoxV156();
        const pill = document.getElementById("footballRealtimeSyncPillV156");
        const sub = document.getElementById("footballRealtimeSyncSubV156");
        if (pill) {
          pill.className = "football-realtime-sync-pill-v156 error";
          pill.querySelector("span").textContent = "Erro";
        }
        if (sub) sub.textContent = "Não foi possível ler settings/footballData";
        if (box) box.dataset.state = "error";
      });

    if (!footballRealtimeSyncTimerV156) {
      footballRealtimeSyncTimerV156 = setInterval(() => {
        footballRealtimeSyncRenderV156();
      }, 10000);
    }
  } catch (error) {
    console.warn("footballRealtimeSyncStartV156 falhou:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(footballRealtimeSyncStartV156, 500);
  setTimeout(footballRealtimeSyncStartV156, 1800);
  setTimeout(footballRealtimeSyncStartV156, 3500);
});
document.addEventListener("click", () => setTimeout(footballRealtimeSyncStartV156, 180));


// v157  transforma a zona Football-data em modo automático/clean.
function setupAutomaticSyncVisualV157() {
  try {
    const activePanel = document.querySelector(".tab-panel.active") || document.querySelector("main") || document.body;

    // Esconde a caixa antiga do botão manual para não parecer que é preciso carregar.
    const oldManualBox = document.getElementById("footballDataAdminFixedBoxV143");
    if (oldManualBox) {
      oldManualBox.classList.add("football-manual-hidden-v157");
      oldManualBox.setAttribute("aria-hidden", "true");
    }

    // Esconde também o bloco antigo da v149 quando estiver duplicado.
    const oldFreeBox = document.getElementById("footballFreeStatusBoxV149");
    if (oldFreeBox) {
      oldFreeBox.classList.add("football-free-legacy-hidden-v157");
      oldFreeBox.setAttribute("aria-hidden", "true");
    }

    // Garante a caixa nova em tempo real.
    if (typeof footballRealtimeSyncEnsureBoxV156 === "function") {
      const box = footballRealtimeSyncEnsureBoxV156();
      box.classList.add("football-automatic-main-v157");

      // Move para o topo do Admin se estivermos no Admin.
      const adminPanel =
        document.getElementById("adminTab") ||
        document.querySelector('[data-tab="admin"].active') ||
        activePanel;

      const target =
        adminPanel?.querySelector?.(".admin-section, .admin-card, .panel, .card") ||
        adminPanel;

      if (target && box.parentElement !== target.parentElement) {
        const firstGood =
          target.querySelector?.(".football-realtime-sync-box-v156") ||
          target.firstElementChild;
        if (firstGood?.insertAdjacentElement) firstGood.insertAdjacentElement("beforebegin", box);
        else target.prepend(box);
      }

      const title = box.querySelector(".football-realtime-sync-top-v156 strong");
      if (title) title.textContent = "Sync automática 24/7";

      const gridLabels = box.querySelectorAll(".football-realtime-sync-grid-v156 span");
      if (gridLabels?.length >= 4) {
        gridLabels[0].textContent = "ltima execução";
        gridLabels[1].textContent = "Jogos lidos";
        gridLabels[2].textContent = "Terminados";
        gridLabels[3].textContent = "Alterações";
      }
    }

    // Fallback manual discreto, só para emergência.
    let fallback = document.getElementById("footballManualFallbackV157");
    if (!fallback) {
      fallback = document.createElement("details");
      fallback.id = "footballManualFallbackV157";
      fallback.className = "football-manual-fallback-v157";
      fallback.innerHTML = `
        <summary>Opções avançadas</summary>
        <button type="button" id="footballManualForceBtnV157">Forçar sync agora</button>
        <small>A sync normal corre automaticamente no servidor minuto a minuto.</small>
      `;

      const box = document.getElementById("footballRealtimeSyncBoxV156");
      if (box?.insertAdjacentElement) box.insertAdjacentElement("afterend", fallback);
      else activePanel.appendChild(fallback);

      const btn = fallback.querySelector("#footballManualForceBtnV157");
      btn?.addEventListener("click", event => {
        event.preventDefault();
        if (typeof syncFootballDataResultsFreeV149 === "function") {
          syncFootballDataResultsFreeV149("manual");
        } else if (typeof syncFootballDataResultsV139 === "function") {
          syncFootballDataResultsV139();
        } else {
          toast?.("Sync manual não disponível nesta versão.");
        }
      });
    }
  } catch (error) {
    console.warn("setupAutomaticSyncVisualV157 falhou:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(setupAutomaticSyncVisualV157, 500);
  setTimeout(setupAutomaticSyncVisualV157, 1600);
  setTimeout(setupAutomaticSyncVisualV157, 3200);
});
document.addEventListener("click", () => setTimeout(setupAutomaticSyncVisualV157, 160));


// v158  marcador parcial separado do resultado final.
function getDisplayScoreV158(game) {
  const apiStatus = String(game?.footballDataStatus || "").toUpperCase();
  if (["IN_PLAY", "PAUSED", "LIVE"].includes(apiStatus)) {
    if (game.liveHomeScore !== null && game.liveHomeScore !== undefined && game.liveAwayScore !== null && game.liveAwayScore !== undefined) {
      return `${game.liveHomeScore} - ${game.liveAwayScore}`;
    }
  }
  if (hasResult(game)) return `${game.homeScore} - ${game.awayScore}`;
  return "";
}


// v159  Admin: marcar/remover jogo suspenso manualmente.
function getAllEditableGamesV159() {
  try {
    const list = [];
    if (Array.isArray(games)) {
      games.forEach(game => {
        if (!game) return;
        list.push({
          type: "group",
          id: String(game.id || game.gameId || ""),
          label: `${game.matchDate || ""} · ${game.homeTeam || ""} vs ${game.awayTeam || ""}`,
          game
        });
      });
    }

    const koMatches = appSettings?.knockout?.matches || [];

    if (Array.isArray(koMatches)) {
      koMatches.forEach(game => {
        if (!game) return;
        list.push({
          type: "knockout",
          id: String(game.id || game.gameId || ""),
          label: `${game.round || "Fase final"} · ${game.homeTeam || ""} vs ${game.awayTeam || ""}`,
          game
        });
      });
    }

    return list.filter(item => item.id);
  } catch (error) {
    console.warn("getAllEditableGamesV159 falhou:", error);
    return [];
  }
}

function renderSuspendedGameAdminV159() {
  try {
    const isSettingsPanel = document.querySelector(".tab-panel.active")?.id === "settingsTab";
    if (!isSettingsPanel) return;

    const target =
      (typeof settingsSectionContentV213 === "function" ? settingsSectionContentV213("system") : null) ||
      document.getElementById("settingsTab") ||
      document.querySelector("main") ||
      document.body;

    let box = document.getElementById("suspendedGameAdminBoxV159");
    if (!box) {
      box = document.createElement("section");
      box.id = "suspendedGameAdminBoxV159";
      box.className = "suspended-game-admin-box-v159";
      box.innerHTML = `
        <div class="suspended-game-admin-head-v159">
          <div>
            <strong>Jogo suspenso</strong>
            <span>Marca um jogo como suspenso sem o fechar como jogado.</span>
          </div>
        </div>
        <div class="suspended-game-admin-row-v159">
          <select id="suspendedGameSelectV159"></select>
          <button type="button" id="markSuspendedBtnV159">Marcar suspenso</button>
          <button type="button" id="clearSuspendedBtnV159">Remover suspensão</button>
        </div>
        <p class="suspended-game-admin-note-v159">O jogo fica em Faltam Resultados, mostra Suspenso e só passa para Jogado quando houver resultado final.</p>
      `;

      box.querySelector("#markSuspendedBtnV159")?.addEventListener("click", () => setSuspendedGameV159(true));
      box.querySelector("#clearSuspendedBtnV159")?.addEventListener("click", () => setSuspendedGameV159(false));
    }

    if (box.parentElement !== target) target.appendChild(box);

    const select = document.getElementById("suspendedGameSelectV159");
    if (!select) return;

    const current = select.value;
    const allGames = getAllEditableGamesV159();

    select.innerHTML = allGames.map(item => {
      const st = statusOf(item.game);
      const suspended = item.game?.manualStatus === "SUSPENDED" || item.game?.manualSuspended === true || item.game?.footballDataStatus === "SUSPENDED";
      const suffix = suspended ? " · SUSPENSO" : st?.text ? ` · ${st.text}` : "";
      return `<option value="${escapeHtml(`${item.type}::${item.id}`)}">${escapeHtml(item.label + suffix)}</option>`;
    }).join("");

    if (current && [...select.options].some(opt => opt.value === current)) select.value = current;
  } catch (error) {
    console.warn("renderSuspendedGameAdminV159 falhou:", error);
  }
}

async function setSuspendedGameV159(isSuspended) {
  try {
    if (typeof hasPermission === "function" && !hasPermission("editResults")) {
      toast("Sem permissão para alterar jogos.");
      return;
    }

    const select = document.getElementById("suspendedGameSelectV159");
    const value = select?.value || "";
    const [type, id] = value.split("::");
    if (!type || !id) {
      toast("Escolhe um jogo primeiro.");
      return;
    }

    const item = getAllEditableGamesV159().find(entry => entry.type === type && entry.id === id);
    if (!item) {
      toast("Jogo não encontrado.");
      return;
    }

    const payload = isSuspended ? {
      manualStatus: "SUSPENDED",
      manualSuspended: true,
      footballDataStatus: "SUSPENDED",
      footballDataLocked: true,
      suspendedAt: new Date().toISOString(),
      suspendedBy: currentUser?.email || "admin"
    } : {
      manualStatus: "",
      manualSuspended: false,
      footballDataStatus: "",
      footballDataLocked: false,
      suspendedAt: "",
      suspendedBy: "",
      updatedAt: new Date().toISOString()
    };

    Object.assign(item.game, payload);

    if (type === "group") {
      markGamePending(item.game.id);
      saveLocalData(isSuspended ? "jogo marcado suspenso" : "suspensão removida");
      saveGameFastToFirebase(item.game, { reason: isSuspended ? "jogo marcado suspenso" : "suspensão removida" })
        .catch(error => {
          console.warn("Suspenso guardado localmente; Firebase pendente:", error);
          markGamePending(item.game.id);
          scheduleFullSync("reenviar jogo suspenso", 800);
        });
    } else {
      markSettingsPending();
      saveLocalData("jogo suspenso fase final");
      scheduleFullSync("jogo suspenso fase final", 500);
    }

    if (typeof saveLocalData === "function") saveLocalData("jogo suspenso");
    if (typeof renderAll === "function") renderAll();
    renderSuspendedGameAdminV159();
    toast(isSuspended ? "Jogo marcado como suspenso." : "Suspensão removida.");
  } catch (error) {
    console.error("setSuspendedGameV159 falhou:", error);
    toast(`Erro ao alterar suspensão: ${error.message || "erro"}`);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(renderSuspendedGameAdminV159, 700);
  setTimeout(renderSuspendedGameAdminV159, 1800);
  setTimeout(renderSuspendedGameAdminV159, 3500);
});
document.addEventListener("click", () => setTimeout(renderSuspendedGameAdminV159, 180));

// v162 - camada limpa para Admin, Logs, Configurações e PWA.
function renderSystemLogs() {
  const container = $("systemLogsList");
  const lockedPanel = $("logsLockedPanel");
  const unlockedPanel = $("logsUnlockedPanel");
  const summary = $("logsSummaryV162");
  const unlocked = isLogsUnlocked();

  lockedPanel?.classList.toggle("hidden", unlocked);
  unlockedPanel?.classList.toggle("hidden", !unlocked);

  if (!container || !unlocked) {
    if (container) container.innerHTML = "";
    if (summary) summary.innerHTML = "";
    return;
  }

  const allLogs = systemLogs();
  const logs = filteredSystemLogsV162();
  renderLogsSummaryV162(logs, allLogs.length);

  if (!logs.length) {
    container.innerHTML = `<div class="empty small-empty">Não há logs para este filtro.</div>`;
    return;
  }

  container.innerHTML = logs.slice(0, MAX_SYSTEM_LOGS).map(log => {
    const category = logCategoryV162(log);
    return `
      <article class="system-log-row ${escapeHtml(category)}">
        <div class="system-log-main">
          <span>${escapeHtml(formatLogTime(log.at))}</span>
          <strong>${escapeHtml(log.action || "Ação")}</strong>
          <p>${escapeHtml(log.detail || "")}</p>
        </div>
        <div class="system-log-actor">
          <em>${escapeHtml(logCategoryLabelV162(category))}</em>
          <strong>${escapeHtml(log.actorName || "Sistema")}</strong>
          <span>${escapeHtml(log.actorEmail || "")}</span>
        </div>
      </article>
    `;
  }).join("");
}

function exportSystemLogsCsv() {
  if (!isLogsUnlocked()) return toast("Desbloqueia os logs com PIN.");
  const logs = filteredSystemLogsV162();
  if (!logs.length) return toast("Não há logs para exportar neste filtro.");

  const rows = [
    ["Data", "Tipo", "Ação", "Detalhe", "Utilizador", "Email", "Dados"],
    ...logs.map(log => [
      formatLogTime(log.at),
      logCategoryLabelV162(logCategoryV162(log)),
      log.action || "",
      log.detail || "",
      log.actorName || "",
      log.actorEmail || "",
      JSON.stringify(log.meta || {})
    ])
  ];

  const csv = rows.map(row => row.map(csvEscape).join(";")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `logs-mundial-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast("Logs exportados.");
}

function openTabV162(tabId) {
  const button = document.querySelector(`.tab[data-tab="${CSS.escape(tabId)}"]`);
  if (!button || !permissionTabAllowed(tabId)) return false;
  button.click();
  return true;
}

async function clearAppCachesV162() {
  await clearAppCaches();
  renderAppSettingsPanelV162();
  toast("Cache limpa. Se necessário, atualiza a app.");
}

function setupModalStateV162() {
  const hasOpenModal = [...document.querySelectorAll(".modal")].some(modal => !modal.classList.contains("hidden"));
  document.body.classList.toggle("modal-open-v162", hasOpenModal);
}

function closeTopModalV162() {
  const modals = [...document.querySelectorAll(".modal")].filter(modal => !modal.classList.contains("hidden"));
  const modal = modals.at(-1);
  if (!modal) return false;

  if (modal.id === "resultModal") closeResultModal();
  else if (modal.id === "betsModal") closeBetsModal();
  else if (modal.id === "excelModal") modal.classList.add("hidden");
  else if (modal.id === "knockoutRecordModal") modal.remove();
  else modal.classList.add("hidden");

  setupModalStateV162();
  return true;
}

function notificationReadAtV164() {
  return Number(localStorage.getItem(NOTIFICATIONS_READ_KEY_V164) || "0") || 0;
}

function notificationTypeLabelV164(type) {
  return ({
    result: "Resultado",
    knockout: "Fase Final",
    sync: "Sincronização",
    install: "Instalação",
    suspended: "Suspenso",
    admin: "Admin",
    warning: "Aviso"
  })[type] || "Notificação";
}

function notificationFromLogV164(log) {
  const category = logCategoryV162(log);
  const type = category === "results" ? "result" :
    category === "knockout" ? "knockout" :
    category === "sync" ? "sync" :
    category === "errors" ? "warning" :
    "admin";

  return {
    id: `log:${log.id || log.at || log.action}`,
    type,
    at: log.at || new Date().toISOString(),
    title: log.action || "Ação registada",
    detail: log.detail || "A app registou uma alteração.",
    actor: log.actorName || "Sistema"
  };
}

function buildNotificationsV164() {
  const notes = [];
  const missing = games.filter(needsFinalResult).length;
  const suspended = games.filter(isSuspendedGame);

  if (!isStandaloneMode()) {
    notes.push({
      id: "install:pwa",
      type: "install",
      at: "2000-01-01T00:00:00.000Z",
      title: "Instala a app neste dispositivo",
      detail: isIosDevice()
        ? "No iPhone, usa Safari > Partilhar > Adicionar ao Ecrã Principal."
        : "No Android ou PC, usa o botão Instalar app quando o navegador o mostrar.",
      actor: "PWA"
    });
  }

  if ($("refreshAppBtn")?.classList.contains("has-update")) {
    notes.push({
      id: "app:update-ready",
      type: "sync",
      at: new Date().toISOString(),
      title: "Nova versão disponível",
      detail: "Toca em Atualizar app para aplicar a versão mais recente.",
      actor: "Sistema"
    });
  }

  if (!navigator.onLine) {
    notes.push({
      id: "device:offline",
      type: "warning",
      at: new Date().toISOString(),
      title: "Dispositivo offline",
      detail: "As alterações ficam guardadas localmente até a ligação voltar.",
      actor: "Sistema"
    });
  }

  if (suspended.length) {
    const latest = suspended.map(game => game.suspendedAt || game.updatedAt || game.matchDate).filter(Boolean).sort().at(-1);
    notes.push({
      id: "games:suspended",
      type: "suspended",
      at: latest || new Date().toISOString(),
      title: `${suspended.length} jogo${suspended.length === 1 ? "" : "s"} suspenso${suspended.length === 1 ? "" : "s"}`,
      detail: "Continuam em Faltam resultados até serem fechados com resultado final.",
      actor: "Admin"
    });
  }

  if (missing) {
    notes.push({
      id: "games:missing-results",
      type: "result",
      at: "2000-01-01T00:00:00.000Z",
      title: `${missing} jogo${missing === 1 ? "" : "s"} sem resultado final`,
      detail: "Usa o filtro Faltam resultados para fechar os jogos pendentes.",
      actor: "Calendário"
    });
  }

  if (hasPermission("admin")) {
    systemLogs().slice(0, 18).forEach(log => notes.push(notificationFromLogV164(log)));
  }

  return notes
    .filter(note => note.title)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function renderNotificationsCenterV164() {
  const list = $("notificationsListV164");
  const summary = $("notificationsSummaryV164");
  const badge = $("notificationsBadgeV164");
  renderPushNotificationsPanelV165();
  if (!list || !summary) {
    if (badge) badge.classList.add("hidden");
    return;
  }

  const notes = buildNotificationsV164();
  const readAt = notificationReadAtV164();
  const unread = notes.filter(note => new Date(note.at).getTime() > readAt).length;
  const important = notes.filter(note => ["warning", "suspended", "sync"].includes(note.type)).length;

  if (badge) {
    badge.textContent = String(unread);
    badge.classList.toggle("hidden", unread <= 0);
  }

  summary.innerHTML = `
    <article><span>Por ver</span><strong>${unread}</strong><p>Notificações desde a última leitura</p></article>
    <article><span>Total</span><strong>${notes.length}</strong><p>Alertas recentes e estado da app</p></article>
    <article><span>Importantes</span><strong>${important}</strong><p>Offline, suspensos ou atualização</p></article>
  `;

  if (!notes.length) {
    list.innerHTML = `<div class="empty small-empty">Ainda não há notificações.</div>`;
    return;
  }

  list.innerHTML = notes.map(note => {
    const isUnread = new Date(note.at).getTime() > readAt;
    return `
      <article class="notification-row-v164 ${escapeHtml(note.type)} ${isUnread ? "unread" : ""}">
        <div>
          <span>${escapeHtml(notificationTypeLabelV164(note.type))} · ${escapeHtml(formatLogTime(note.at))}</span>
          <strong>${escapeHtml(note.title)}</strong>
          <p>${escapeHtml(note.detail || "")}</p>
        </div>
        <small>${escapeHtml(note.actor || "Sistema")}</small>
      </article>
    `;
  }).join("");
}

function markNotificationsReadV164() {
  localStorage.setItem(NOTIFICATIONS_READ_KEY_V164, String(Date.now()));
  renderNotificationsCenterV164();
  toast("Notificações marcadas como vistas.");
}

function renderInstallGuideV164() {
  const container = $("installGuideV164");
  if (!container) return;

  const standalone = isStandaloneMode();
  const installText = standalone ? "Instalada" : "Por instalar";
  const swText = "serviceWorker" in navigator ? "Service Worker disponível" : "Service Worker indisponível";
  const connectionText = navigator.onLine ? "Online" : "Offline";

  container.innerHTML = `
    <div class="install-guide-head-v164">
      <div>
        <h3>Guia de instalação</h3>
        <p>Instalação em iPhone, Android e PC.</p>
      </div>
      <button type="button" class="primary" data-install-now-v164>Instalar agora</button>
    </div>
    <div class="install-status-v164">
      <span>${escapeHtml(installText)}</span>
      <span>${escapeHtml(swText)}</span>
      <span>${escapeHtml(connectionText)}</span>
    </div>
    <div class="install-steps-v164">
      <article>
        <strong>iPhone</strong>
        <p>Abre no Safari, toca em Partilhar e escolhe Adicionar ao Ecrã Principal.</p>
      </article>
      <article>
        <strong>Android</strong>
        <p>Abre no Chrome, toca no menu e escolhe Instalar app ou Adicionar ao ecrã principal.</p>
      </article>
      <article>
        <strong>PC</strong>
        <p>No Edge ou Chrome, usa o ícone de instalação na barra de endereço ou o menu Apps.</p>
      </article>
    </div>
  `;
}

function pushVapidStorageKeyV181() {
  return `${STORAGE_KEY}_push_vapid_key_clean_v181`;
}

function pushPreferencesStorageKeyV181() {
  return `${STORAGE_KEY}_push_preferences_clean_v181`;
}

function pushLastTokenStorageKeyV181() {
  return `${STORAGE_KEY}_push_last_token_clean_v181`;
}

function pushDeviceIdV181() {
  const key = `${STORAGE_KEY}_push_device_id_clean_v181`;
  let id = localStorage.getItem(key);
  if (!id) {
    id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function pushVapidKeyV181() {
  return String(
    localStorage.getItem(pushVapidStorageKeyV181()) ||
    window.MUNDIAL_CONFIG?.messaging?.vapidKey ||
    APP_CONFIG?.messaging?.vapidKey ||
    ""
  ).trim();
}

function pushFunctionsBaseV181() {
  const projectId = APP_CONFIG?.firebase?.projectId || window.MUNDIAL_CONFIG?.firebase?.projectId || "app-mundial2026";
  return `https://us-central1-${projectId}.cloudfunctions.net`;
}

async function callPushFunctionV181(functionName, payload = {}) {
  const user = firebaseAuth?.currentUser || currentUser;
  let idToken = "";
  try { idToken = user?.getIdToken ? await user.getIdToken() : ""; } catch {}

  const response = await fetch(`${pushFunctionsBaseV181()}/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {})
    },
    body: JSON.stringify({
      ...payload,
      uid: user?.uid || currentUser?.uid || "",
      email: normalizeEmail(user?.email || currentUser?.email || ""),
      appVersion: APP_CONFIG?.appVersion || APP_VERSION_LABEL,
      deviceId: pushDeviceIdV181(),
      userAgent: navigator.userAgent
    })
  });

  let data = {};
  try { data = await response.json(); } catch {}
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `${functionName} respondeu ${response.status}`);
  }
  return data;
}

function defaultPushPreferencesV181() {
  return {
    gameStart: true,
    goals: true,
    gameEnd: true,
    results: true,
    knockout: true,
    chatGeneral: false,
    chatAdmin: true,
    mentions: true,
    quietHours: { enabled: true, startHour: 23, endHour: 9, timezone: "Europe/Lisbon" }
  };
}

function savedPushPreferencesV181() {
  try {
    return { ...defaultPushPreferencesV181(), ...(JSON.parse(localStorage.getItem(pushPreferencesStorageKeyV181()) || "{}") || {}) };
  } catch {
    return defaultPushPreferencesV181();
  }
}

function currentPushPreferencesV181() {
  const saved = savedPushPreferencesV181();
  return {
    gameStart: $("pushGameStartInputV181")?.checked ?? saved.gameStart,
    goals: $("pushGoalsInputV181")?.checked ?? saved.goals,
    gameEnd: $("pushGameEndInputV181")?.checked ?? saved.gameEnd,
    results: $("pushResultsInputV200")?.checked ?? saved.results,
    knockout: $("pushKnockoutInputV200")?.checked ?? saved.knockout,
    chatGeneral: $("pushChatGeneralInputV200")?.checked ?? saved.chatGeneral,
    chatAdmin: $("pushChatAdminInputV200")?.checked ?? saved.chatAdmin,
    mentions: $("pushMentionsInputV200")?.checked ?? saved.mentions,
    quietHours: {
      enabled: $("pushQuietHoursInputV181")?.checked ?? saved.quietHours?.enabled ?? true,
      startHour: 23,
      endHour: 9,
      timezone: "Europe/Lisbon"
    }
  };
}

function savePushPreferencesLocalV181(preferences = currentPushPreferencesV181()) {
  localStorage.setItem(pushPreferencesStorageKeyV181(), JSON.stringify(preferences));
  return preferences;
}

function pushSupportV181() {
  const permission = typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  const vapidKey = pushVapidKeyV181();
  const ios = isIosDevice();
  const standalone = isStandaloneMode();
  return {
    supported: Boolean(firebaseMessaging && firebaseMessagingApi && "serviceWorker" in navigator && typeof Notification !== "undefined"),
    permission,
    vapidKey,
    hasVapid: Boolean(vapidKey),
    ios,
    standalone,
    needsIosInstall: ios && !standalone,
    sw: "serviceWorker" in navigator
  };
}

function pushDiagnosticV181() {
  const support = pushSupportV181();
  return [
    `Permissão: ${support.permission}`,
    `Firebase Messaging: ${firebaseMessaging && firebaseMessagingApi ? "OK" : "não ligado"}`,
    `Service Worker: ${support.sw ? "OK" : "não suportado"}`,
    `VAPID: ${support.hasVapid ? "configurada" : "default Firebase"}`,
    support.needsIosInstall ? "iPhone: instalar no Ecrã Principal" : ""
  ].filter(Boolean).join(" · ");
}

async function savePushPreferencesV181() {
  const preferences = savePushPreferencesLocalV181();
  try {
    await callPushFunctionV181("savePushPreferences", { preferences });
    toast("Preferências push guardadas.");
  } catch (error) {
    console.warn("Preferências push guardadas só localmente:", error);
    toast("Preferências guardadas neste dispositivo.");
  }
}

async function enablePushNotificationsV181(options = {}) {
  const silent = options?.silent === true;
  try {
    if (!currentUser && !firebaseAuth?.currentUser) {
      if (!silent) toast("Faz login antes de ativar push.");
      return false;
    }

    const support = pushSupportV181();
    if (!support.supported) {
      if (!silent) toast("Este navegador ainda não suporta push nesta app.");
      return false;
    }
    if (support.needsIosInstall) {
      if (!silent) toast("No iPhone, instala primeiro a app no Ecrã Principal.");
      return false;
    }
    let permission = support.permission;
    if (permission !== "granted") {
      if (silent) return false;
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      renderPushNotificationsPanelV165();
      renderPushOptInPromptV182();
      if (!silent) toast("Permissão de notificações não autorizada.");
      return false;
    }

    const registration = await navigator.serviceWorker.ready;
    const token = await firebaseMessagingApi.getToken(firebaseMessaging, {
      ...(support.vapidKey ? { vapidKey: support.vapidKey } : {}),
      serviceWorkerRegistration: registration
    });

    if (!token) {
      if (!silent) toast("Não foi possível criar token push.");
      return false;
    }

    const preferences = savePushPreferencesLocalV181();
    await callPushFunctionV181("registerPushToken", {
      token,
      preferences,
      platform: support.ios ? "ios" : /android/i.test(navigator.userAgent) ? "android" : "web"
    });

    localStorage.setItem(pushLastTokenStorageKeyV181(), token);
    localStorage.removeItem(PUSH_OPT_IN_DISMISSED_KEY_V182);
    if (!silent) toast("Notificações push ativas neste dispositivo.");
    loadPushStatsV187(true).then(renderFirebaseHealthPanelV187);
    renderPushNotificationsPanelV165();
    renderPushOptInPromptV182();
    return true;
  } catch (error) {
    console.error("enablePushNotificationsV181 falhou:", error);
    const msg = String(error?.message || error || "erro");
    if (!silent) {
      if (msg.includes("invalid-vapid-key")) return toast("VAPID key inválida. Confirma a chave no Firebase.");
      toast(`Não consegui ativar push: ${msg.slice(0, 140)}`);
    }
    return false;
  }
}

function currentPushTestPayloadV184() {
  const type = $("pushTestTypeInputV184")?.value || "custom";
  const team = String($("pushTestTeamInputV184")?.value || "Portugal").trim();
  const game = String($("pushTestGameInputV184")?.value || "Portugal vs Uzbequistão").trim();
  const custom = String($("pushTestMessageInputV184")?.value || "").trim();
  const defaults = {
    gameStart: { title: "Jogo começou", body: `${game} já começou.` },
    goals: { title: `Golo ${team}`, body: `Golo de ${team} no jogo ${game}.` },
    gameEnd: { title: "Jogo acabou", body: `${game} terminou.` },
    results: { title: "Resultado novo guardado", body: `${game}: resultado atualizado.` },
    knockout: { title: "Fase final atualizada", body: "A fase final do Mundial Pontos 2026 foi alterada." },
    chatGeneral: { title: "Nova mensagem no chat geral", body: "Mensagem de teste no chat geral." },
    chatAdmin: { title: "Nova mensagem no chat admin", body: "Mensagem de teste no chat admin." },
    mentions: { title: `${team} mencionou-te`, body: "Teste de menção no chat." },
    custom: { title: "Teste push Mundial", body: custom || "As notificações push estão a funcionar." }
  };
  const selected = defaults[type] || defaults.custom;
  return {
    testType: type,
    team,
    game,
    title: selected.title,
    body: custom || selected.body,
    ignoreQuietHours: true
  };
}

async function sendTestPushV181() {
  try {
    if (!hasPermission("admin")) return toast("Só o Admin pode testar push.");
    const payload = currentPushTestPayloadV184();
    const data = await callPushFunctionV181("requestPushTest", { ...payload, allDevices: true, preferences: currentPushPreferencesV181() });
    loadPushStatsV187(true).then(() => {
      renderPushHistoryPanelV187();
      renderFirebaseHealthPanelV187();
    });
    toast(`Teste ${payload.title} pedido para ${data.sent || 0} dispositivo(s).`);
  } catch (error) {
    console.error("sendTestPushV181 falhou:", error);
    toast(`Não consegui pedir teste push: ${String(error?.message || error || "erro").slice(0, 140)}`);
  }
}

function ensurePushOptInPromptElementV182() {
  let prompt = $("pushOptInPromptV182");
  if (prompt) return prompt;
  prompt = document.createElement("div");
  prompt.id = "pushOptInPromptV182";
  prompt.className = "push-optin-v182 hidden";
  const main = document.querySelector("#appShell main");
  if (main?.parentNode) main.parentNode.insertBefore(prompt, main);
  else $("appShell")?.appendChild(prompt);
  return prompt;
}

function shouldShowPushOptInV182() {
  if (!currentUser && !firebaseAuth?.currentUser) return false;
  if (localStorage.getItem(PUSH_OPT_IN_DISMISSED_KEY_V182) === "1") return false;
  if (localStorage.getItem(pushLastTokenStorageKeyV181())) return false;
  const support = pushSupportV181();
  if (!support.supported || support.needsIosInstall) return false;
  return support.permission !== "denied";
}

function renderPushOptInPromptV182() {
  const prompt = ensurePushOptInPromptElementV182();
  if (!prompt) return;
  if (!shouldShowPushOptInV182()) {
    prompt.classList.add("hidden");
    prompt.innerHTML = "";
    return;
  }

  const support = pushSupportV181();
  const title = support.permission === "granted" ? "Concluir notificações neste dispositivo" : "Ativar notificações neste dispositivo";
  const detail = support.permission === "granted"
    ? "A permissão já está dada. Falta só registar este dispositivo para receber alertas."
    : "Recebe alertas de jogo começou, jogo acabou e golo da equipa mesmo com a app fechada.";

  prompt.classList.remove("hidden");
  prompt.innerHTML = `
    <div>
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>
    <div class="push-optin-actions-v182">
      <button id="pushOptInEnableBtnV182" class="primary" type="button">Ativar notificações</button>
      <button id="pushOptInLaterBtnV182" class="secondary" type="button">Depois</button>
    </div>
  `;

  $("pushOptInEnableBtnV182")?.addEventListener("click", () => enablePushNotificationsV181());
  $("pushOptInLaterBtnV182")?.addEventListener("click", () => {
    localStorage.setItem(PUSH_OPT_IN_DISMISSED_KEY_V182, "1");
    renderPushOptInPromptV182();
  });
}

async function setupPushForCurrentUserV182() {
  if (!currentUser && !firebaseAuth?.currentUser) {
    renderPushOptInPromptV182();
    return;
  }
  const support = pushSupportV181();
  const hasToken = Boolean(localStorage.getItem(pushLastTokenStorageKeyV181()));
  if (support.supported && support.permission === "granted" && !hasToken && !support.needsIosInstall) {
    await enablePushNotificationsV181({ silent: true });
  }
  renderPushOptInPromptV182();
  renderPushNotificationsPanelV165();
}

function renderPushNotificationsPanelV165() {
  const panel = $("pushNotificationsPanelV165");
  if (!panel) return;
  if (!hasPermission("admin")) {
    panel.innerHTML = "";
    return;
  }

  const support = pushSupportV181();
  const preferences = savedPushPreferencesV181();
  const hasToken = Boolean(localStorage.getItem(pushLastTokenStorageKeyV181()));
  const permissionText = support.permission === "granted" ? "Permitidas" : support.permission === "denied" ? "Bloqueadas" : support.permission === "unsupported" ? "Não suportadas" : "Por ativar";
  const deviceText = support.ios ? (support.standalone ? "iPhone PWA instalada" : "iPhone: instalar no Ecra Principal") : /android/i.test(navigator.userAgent) ? "Android" : "PC / Browser";
  const vapidText = support.hasVapid ? "VAPID configurada" : "VAPID default Firebase";

  panel.innerHTML = `
    <div class="push-panel-head-v165">
      <div>
        <strong>Push Android / iPhone</strong>
        <span>Preferências, ativação e teste.</span>
        <small>Silêncio por defeito: 23h-09h.</small>
      </div>
      <div class="push-panel-actions-v165">
        <button id="enablePushBtnV165" class="primary" type="button">Ativar neste dispositivo</button>
        <button id="testPushBtnV165" class="secondary" type="button">Enviar teste dos campos</button>
      </div>
    </div>
    <div class="push-status-v165">
      <span>${escapeHtml(permissionText)}</span>
      <span>${escapeHtml(deviceText)}</span>
      <span>${escapeHtml(vapidText)}</span>
      <span>${hasToken ? "Token guardado" : "Token por ativar"}</span>
    </div>
    <div class="push-options-v165 push-options-v200">
      <div class="push-options-title-v200">
        <strong>Notificações</strong>
        <span>Escolhe os alertas deste dispositivo.</span>
      </div>
      <label><input id="pushGameStartInputV181" type="checkbox" ${preferences.gameStart ? "checked" : ""} /> Jogo começou</label>
      <label><input id="pushGoalsInputV181" type="checkbox" ${preferences.goals ? "checked" : ""} /> Golos / alteração no marcador</label>
      <label><input id="pushGameEndInputV181" type="checkbox" ${preferences.gameEnd ? "checked" : ""} /> Jogo acabou</label>
      <label><input id="pushResultsInputV200" type="checkbox" ${preferences.results ? "checked" : ""} /> Resultado guardado manualmente</label>
      <label><input id="pushKnockoutInputV200" type="checkbox" ${preferences.knockout ? "checked" : ""} /> Fase Final atualizada</label>
      <label><input id="pushChatGeneralInputV200" type="checkbox" ${preferences.chatGeneral ? "checked" : ""} /> Chat geral</label>
      <label><input id="pushChatAdminInputV200" type="checkbox" ${preferences.chatAdmin ? "checked" : ""} /> Chat admin</label>
      <label><input id="pushMentionsInputV200" type="checkbox" ${preferences.mentions !== false ? "checked" : ""} /> Menções no chat</label>
      <label><input id="pushQuietHoursInputV181" type="checkbox" ${preferences.quietHours?.enabled !== false ? "checked" : ""} /> Silenciar 23h-09h</label>
      <button id="savePushPrefsBtnV181" class="secondary" type="button">Guardar preferências</button>
    </div>
    <div class="push-test-fields-v184">
      <label>Tipo
        <select id="pushTestTypeInputV184">
          <option value="gameStart">Jogo começou</option>
          <option value="goals">Golo / marcador</option>
          <option value="gameEnd">Jogo acabou</option>
          <option value="results">Resultado manual</option>
          <option value="knockout">Fase Final</option>
          <option value="chatGeneral">Chat geral</option>
          <option value="chatAdmin">Chat admin</option>
          <option value="mentions">Menção no chat</option>
          <option value="custom">Mensagem livre</option>
        </select>
      </label>
      <label>Equipa
        <input id="pushTestTeamInputV184" type="text" value="Portugal" />
      </label>
      <label>Jogo
        <input id="pushTestGameInputV184" type="text" value="Portugal vs Uzbequistão" />
      </label>
      <label>Mensagem opcional
        <input id="pushTestMessageInputV184" type="text" placeholder="Vazio usa texto automatico" />
      </label>
    </div>
    <p class="push-note-v165">Estado: ${escapeHtml(pushDiagnosticV181())}</p>
  `;

  $("savePushPrefsBtnV181")?.addEventListener("click", savePushPreferencesV181);
  $("enablePushBtnV165")?.addEventListener("click", () => enablePushNotificationsV181());
  $("testPushBtnV165")?.addEventListener("click", sendTestPushV181);
}

function setupV162Controls() {
  if (window.__mundialV162ControlsBound) return;
  window.__mundialV162ControlsBound = true;

  $("logsTypeFilter")?.addEventListener("change", renderSystemLogs);
  $("logsSearchInput")?.addEventListener("input", renderSystemLogs);

  const oldExportBtn = $("exportLogsBtn");
  if (oldExportBtn) {
    const exportBtn = oldExportBtn.cloneNode(true);
    oldExportBtn.replaceWith(exportBtn);
    exportBtn.addEventListener("click", exportSystemLogsCsv);
  }

  document.addEventListener("click", event => {
    if (event.target.closest("[data-install-now-v164]")) {
      $("installAppBtn")?.click() || toast("Usa o menu do navegador para instalar a app neste dispositivo.");
      return;
    }

    const chip = event.target.closest("[data-log-filter]");
    if (chip) {
      const select = $("logsTypeFilter");
      if (select) select.value = chip.dataset.logFilter || "all";
      renderSystemLogs();
      return;
    }

    const adminSection = event.target.closest("[data-admin-section-v187]");
    if (adminSection) {
      localStorage.setItem(`${STORAGE_KEY}_admin_section_v187`, adminSection.dataset.adminSectionV187 || "all");
      renderAdminSectionsV187();
      return;
    }

    const modal = event.target.closest(".modal");
    if (modal && event.target === modal) {
      closeTopModalV162();
      return;
    }

    if (event.target.closest("[data-modal-close], .modal-close, .close-modal")) {
      closeTopModalV162();
    }
  }, true);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && closeTopModalV162()) event.preventDefault();
  }, true);

  $("forceUpdateAppBtnV162")?.addEventListener("click", refreshAppNow);
  $("clearCacheBtnV162")?.addEventListener("click", clearAppCachesV162);
  $("installAppFromSettingsBtnV162")?.addEventListener("click", () => $("installAppBtn")?.click());
  $("openLogsFromSettingsBtnV162")?.addEventListener("click", () => openTabV162("logsTab"));
  $("markNotificationsReadBtnV164")?.addEventListener("click", markNotificationsReadV164);
  $("openNotificationSettingsBtnV164")?.addEventListener("click", () => {
    if (hasPermission("settings")) openTabV162("settingsTab");
    else $("installAppBtn")?.click() || toast("No iPhone usa Safari > Partilhar > Adicionar ao Ecrã Principal.");
  });
  $("openAdminFromSettingsBtnV162")?.addEventListener("click", () => openTabV162("adminTab") || toast("Sem permissão para abrir Admin."));

  window.addEventListener("online", () => {
    setFirebaseStatus("loading", "Firebase: internet voltou, a reconectar...");
    scheduleFirebaseReconnect("online", 500);
    renderAppSettingsPanelV162();
    renderNotificationsCenterV164();
  });
  window.addEventListener("offline", () => {
    setFirebaseStatus("error", "Firebase: offline; alterações ficam guardadas localmente");
    renderAppSettingsPanelV162();
    renderNotificationsCenterV164();
  });
  setInterval(setupModalStateV162, 600);
}

document.addEventListener("DOMContentLoaded", () => {
  setupV162Controls();
  renderNotificationsCenterV164();
  setupPushForCurrentUserV182();
  renderAdminOverviewV162();
  renderFirebaseHealthPanelV187();
  renderPushHistoryPanelV187();
  renderAdminSectionsV187();
  renderAppSettingsPanelV162();
  renderInstallGuideV164();
});


// v190 - Corrige Users offline prematuro e limpa Admin por secções.
async function ensureFirebaseOnlineForPresenceV190() {
  try {
    if (db && firebaseApi && storageMode === "firebase" && (currentUser || firebaseAuth?.currentUser)) {
      if (!currentUser && firebaseAuth?.currentUser) currentUser = firebaseAuth.currentUser;
      return true;
    }

    if (typeof ensureFirebaseAuthReadyV188 === "function") {
      await ensureFirebaseAuthReadyV188().catch(error => {
        console.warn("ensureFirebaseAuthReadyV188 falhou no presence:", error);
        return false;
      });
    } else if (!firebaseReadyPromise && typeof initFirebase === "function") {
      firebaseReadyPromise = initFirebase();
      await firebaseReadyPromise.catch(error => {
        console.warn("initFirebase falhou no presence:", error);
        return false;
      });
    }

    if (!currentUser && firebaseAuth?.currentUser) currentUser = firebaseAuth.currentUser;

    return !!(db && firebaseApi && storageMode === "firebase" && (currentUser || firebaseAuth?.currentUser));
  } catch (error) {
    console.warn("ensureFirebaseOnlineForPresenceV190 falhou:", error);
    return false;
  }
}

async function loadOnlineUsersV190() {
  const list = $("onlineUsersList");
  const badge = $("onlineUsersBadge");

  const ready = await ensureFirebaseOnlineForPresenceV190();

  if (!ready) {
    if (badge) badge.textContent = "a ligar";
    if (list) {
      const detail = lastFirebaseInitError ? `<br><small>${escapeHtml(lastFirebaseInitError)}</small>` : "";
      list.innerHTML = `${onlineUsersPopupHeader()}<div class="empty small-empty">A ligar ao Firebase...${detail}</div>`;
    }

    setTimeout(() => {
      if (typeof loadOnlineUsers === "function") {
        loadOnlineUsers().catch(error => console.warn("Retry users online v190 falhou:", error));
      }
    }, 1400);

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
    console.warn("Erro ao carregar utilizadores online v190:", error);
    if (badge) badge.textContent = "sem acesso";
    if (list) {
      const message = shortFirebaseError ? shortFirebaseError(error?.message || error) : (error?.message || "erro");
      list.innerHTML = `${onlineUsersPopupHeader()}
        <div class="empty small-empty">
          Não foi possível carregar utilizadores online: ${escapeHtml(message)}.
        </div>`;
    }
  }
}

loadOnlineUsers = loadOnlineUsersV190;

function ensureAdminSectionTabsV190() {
  let tabs = $("adminSectionTabsV187");
  const sections = [
    ["users", "Users"],
    ["results", "Resultados"],
    ["points", "Pontos"],
    ["knockout", "Fase Final"],
    ["system", "Sistema"]
  ];

  if (!tabs) {
    tabs = document.createElement("div");
    tabs.id = "adminSectionTabsV187";
    tabs.className = "admin-section-tabs-v187";
  }

  tabs.innerHTML = sections.map(([key, label]) => `<button type="button" data-admin-section-v187="${key}">${label}</button>`).join("");

  const overview = $("adminOverviewV162");
  if (!tabs.parentNode && overview?.parentNode) overview.parentNode.insertBefore(tabs, overview.nextSibling);

  return tabs;
}

function renderAdminSectionsV190() {
  const tabs = ensureAdminSectionTabsV190();
  if (!tabs) return;

  let active = localStorage.getItem(`${STORAGE_KEY}_admin_section_v187`) || "users";
  if (active === "all") active = "users";

  tabs.querySelectorAll("[data-admin-section-v187]").forEach(button => {
    button.classList.toggle("active", button.dataset.adminSectionV187 === active);
  });

  document.querySelectorAll("#adminUnlocked > .admin-card").forEach(card => {
    const section = adminSectionForCardV187(card);
    card.dataset.adminSectionV187 = section;
    const isActive = section === active;
    card.classList.toggle("admin-section-hidden-v187", !isActive);
    card.hidden = !isActive;

    if (isActive && card.tagName?.toLowerCase() === "details") {
      card.open = true;
    }
  });
}

renderAdminSectionsV187 = renderAdminSectionsV190;
ensureAdminSectionTabsV187 = ensureAdminSectionTabsV190;

document.addEventListener("click", event => {
  const btn = event.target.closest?.("[data-admin-section-v187]");
  if (!btn) return;
  event.preventDefault();
  const section = btn.dataset.adminSectionV187 || "users";
  localStorage.setItem(`${STORAGE_KEY}_admin_section_v187`, section);
  renderAdminSectionsV190();
}, true);

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    loadOnlineUsers().catch(error => console.warn("Users online v190 inicial falhou:", error));
    renderAdminSectionsV190();
  }, 1200);
});


// v192 - vibração segura: evita erro de "user hasn't tapped".
function safeVibrateV192(pattern) {
  try {
    if (!navigator?.vibrate) return false;
    if (!document.hasFocus?.()) return false;
    return navigator.vibrate(pattern);
  } catch (error) {
    return false;
  }
}

// v192 - permissões: torna checkboxes clicáveis e marca o card como alterado.
function markPermissionCardDirtyV192(input) {
  try {
    const card = input?.closest?.("[data-permission-card]");
    if (!card) return;
    card.classList.add("permissions-dirty-v192");
    const save = card.querySelector("[data-save-permissions]");
    if (save) {
      save.classList.add("needs-save-v192");
      save.textContent = "Guardar alterações";
    }
  } catch {}
}

document.addEventListener("click", event => {
  const permLabel = event.target.closest?.(".perm-check");
  if (permLabel && !event.target.matches("input")) {
    const input = permLabel.querySelector('input[type="checkbox"][data-perm-key]');
    if (input && !input.disabled) {
      input.checked = !input.checked;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      event.preventDefault();
      event.stopPropagation();
    }
  }
}, true);

document.addEventListener("change", event => {
  const input = event.target.closest?.('[data-perm-key], [data-active-email]');
  if (!input) return;
  markPermissionCardDirtyV192(input);
}, true);

document.addEventListener("click", event => {
  const saveBtn = event.target.closest?.("[data-save-permissions]");
  if (!saveBtn) return;
  event.preventDefault();
  event.stopPropagation();
  savePermissionUser(saveBtn.dataset.savePermissions);
}, true);

// v192 - reforça visual do filtro ativo.
function applyCalendarFilterHighlightV192() {
  try {
    const map = {
      missing: $("calendarMissingResultsBtn"),
      played: $("calendarPlayedGamesBtn"),
      all: $("calendarAllGamesBtn")
    };
    Object.entries(map).forEach(([key, btn]) => {
      if (!btn) return;
      const active = calendarViewMode === key;
      btn.classList.toggle("active-filter", active);
      btn.classList.toggle("calendar-filter-active-v192", active);
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
  } catch {}
}

const renderCalendarFilterStateOriginalV192 = typeof renderCalendarFilterState === "function" ? renderCalendarFilterState : null;
if (renderCalendarFilterStateOriginalV192) {
  renderCalendarFilterState = function renderCalendarFilterStateV192() {
    renderCalendarFilterStateOriginalV192();
    applyCalendarFilterHighlightV192();
  };
}

document.addEventListener("click", event => {
  if (event.target.closest?.("#calendarMissingResultsBtn,#calendarPlayedGamesBtn,#calendarAllGamesBtn")) {
    setTimeout(applyCalendarFilterHighlightV192, 30);
    setTimeout(applyCalendarFilterHighlightV192, 180);
  }
}, true);


// v201 - painel Admin: estado claro da sync inteligente football-data.org.
function footballSmartSyncFormatAgeV201(value) {
  if (!value) return "nunca";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "há menos de 1 min";
  if (diff < 3_600_000) return `há ${Math.round(diff / 60_000)} min`;
  return date.toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
}

function footballSmartSyncEnsureDetailsV201(box) {
  let details = document.getElementById("footballSmartSyncDetailsV201");
  if (details) return details;
  details = document.createElement("div");
  details.id = "footballSmartSyncDetailsV201";
  details.className = "football-smart-sync-details-v201";
  box.appendChild(details);
  return details;
}

const footballRealtimeSyncRenderOriginalV201 = typeof footballRealtimeSyncRenderV156 === "function" ? footballRealtimeSyncRenderV156 : null;
footballRealtimeSyncRenderV156 = function footballRealtimeSyncRenderV201(data = null) {
  if (footballRealtimeSyncRenderOriginalV201) footballRealtimeSyncRenderOriginalV201(data);

  try {
    footballRealtimeSyncLastDataV156 = data || footballRealtimeSyncLastDataV156 || {};
    const current = footballRealtimeSyncLastDataV156 || {};
    const box = footballRealtimeSyncEnsureBoxV156();
    const pill = document.getElementById("footballRealtimeSyncPillV156");
    const sub = document.getElementById("footballRealtimeSyncSubV156");
    const details = footballSmartSyncEnsureDetailsV201(box);

    const status = String(current.status || current.state || "waiting").toLowerCase();
    const statusLabel =
      status === "active" ? "Ativa" :
      status === "error" ? "Erro" :
      "Em espera";

    if (pill) {
      pill.className = `football-realtime-sync-pill-v156 ${status === "active" ? "online" : status === "error" ? "error" : "warning"}`;
      const span = pill.querySelector("span");
      if (span) span.textContent = statusLabel;
    }

    const nextLabel = current.nextSyncGame?.label || current.nextSyncGame || "-";
    const nextAt = current.nextSyncStartsAt ? new Date(current.nextSyncStartsAt).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" }) : "-";
    const activeCount = Array.isArray(current.activeSyncGames) ? current.activeSyncGames.length : Number(current.activeSyncGamesCount || 0);
    const lastCheck = current.lastCheckIso || current.lastCheckAt || current.lastSyncIso || "";
    const lastReal = current.lastRealSyncIso || current.lastRealSyncAt || "";
    const reason = current.lastError || current.lastActiveReason || current.lastSkippedReason || "sem dados";
    const provider = current.provider || "football-data";

    if (sub) {
      sub.textContent = `API: ${provider} · ${statusLabel}`;
    }

    details.innerHTML = `
      <div><span>Próximo jogo</span><strong>${escapeHtml(String(nextLabel))}</strong></div>
      <div><span>Início</span><strong>${escapeHtml(String(nextAt))}</strong></div>
      <div><span>Ativos</span><strong>${escapeHtml(String(activeCount))}</strong></div>
      <div><span>Verificação</span><strong>${escapeHtml(footballSmartSyncFormatAgeV201(lastCheck))}</strong></div>
      <div><span>Sync real</span><strong>${escapeHtml(footballSmartSyncFormatAgeV201(lastReal))}</strong></div>
      <div><span>Motivo</span><strong>${escapeHtml(String(reason))}</strong></div>
    `;

    const title = box.querySelector(".football-realtime-sync-top-v156 strong");
    if (title) title.textContent = "API football-data.org";

    box.dataset.smartStateV201 = status;
  } catch (error) {
    console.warn("footballRealtimeSyncRenderV201 falhou:", error);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => footballRealtimeSyncRenderV156(), 900);
});


// v213 - limpeza final: login robusto, Configuracoes organizadas e blocos tecnicos no sitio certo.
const ADMIN_SECTION_CHOICES_V213 = [
  ["users", "Users", "Contas e acessos"],
  ["results", "Resultados", "Jogos e Excel"],
  ["points", "Pontos", "Regras de pontos"],
  ["knockout", "Fase Final", "Jogos a eliminar"],
  ["system", "Sistema", "Fica nas Configurações"]
];

const PAGE_LOCATION_CHOICES_V213 = [
  ["calendar", "Calendário", "calendarTab"],
  ["score", "Pontuação", "scoreTab"],
  ["knockout", "Fase Final", "knockoutTab"],
  ["notifications", "Notificações", "notificationsTab"],
  ["logs", "Logs", "logsTab"],
  ["adminTab", "Admin", "adminTab"],
  ["settings", "Configurações", "settingsTab"]
];

const SETTINGS_SECTIONS_V213 = [
  ["organization", "Organização", "Escolhe páginas e secções visíveis."],
  ["system", "Sistema, Firebase e API", "Estado Firebase, API e push."],
  ["install", "Instalação / PWA", "Versão, cache e instalação."],
  ["preferences", "Preferências", "Preferências da app."],
  ["admin", "Ferramentas Admin", "Ferramentas de gestão."],
  ["other", "Outros", "Outras opções."]
];

const TECHNICAL_BLOCK_IDS_V213 = [
  "footballRealtimeSyncBoxV156",
  "footballManualFallbackV157",
  "footballFreeStatusBoxV149",
  "footballDataAdminFixedBoxV143",
  "suspendedGameAdminBoxV159",
  "firebaseHealthPanelV187",
  "pushHealthPanelV187",
  "notificationsHealthPanelV187",
  "footballDataSettingsBoxV213"
];

function setActiveTabStateV217(tabId) {
  const targetId = tabId && $(tabId) ? tabId : "calendarTab";
  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.tab === targetId);
  });
  document.querySelectorAll(".tab-panel").forEach(panel => {
    panel.classList.toggle("active", panel.id === targetId);
  });
  return targetId;
}

function normalizeActiveTabStateV217() {
  const activeButton = document.querySelector(".tab.active[data-tab]");
  const activePanel = document.querySelector(".tab-panel.active");
  let targetId = activeButton?.dataset.tab || activePanel?.id || "calendarTab";

  if (!$(targetId) || !permissionTabAllowed(targetId)) {
    const allowed = [...document.querySelectorAll(".tab")].find(button => permissionTabAllowed(button.dataset.tab) && !button.classList.contains("hidden") && !button.classList.contains("user-hidden-v202"));
    targetId = allowed?.dataset.tab || "calendarTab";
  }

  return setActiveTabStateV217(targetId);
}

function forceShowAppAfterLoginV213() {
  const shell = $("appShell");
  const login = $("loginScreen");
  login?.classList.add("hidden");
  if (login) login.style.display = "none";
  shell?.classList.remove("auth-hidden");
  if (shell) shell.style.display = "";
  document.body.classList.add("app-authenticated-v213");
}

function adminLayoutSettingsKeyV213() {
  return `${STORAGE_KEY}_admin_layout_settings_v202`;
}

function defaultAdminLayoutSettingsV213() {
  return {
    adminSections: { users: "admin", results: "admin", points: "admin", knockout: "admin", system: "settings" },
    pages: { calendar: true, score: true, knockout: true, notifications: true, logs: true, adminTab: true, settings: true }
  };
}

function savedAdminLayoutSettingsV213() {
  try {
    const raw = JSON.parse(localStorage.getItem(adminLayoutSettingsKeyV213()) || "{}") || {};
    const base = defaultAdminLayoutSettingsV213();
    return {
      adminSections: { ...base.adminSections, ...(raw.adminSections || {}), system: "settings" },
      pages: { ...base.pages, ...(raw.pages || {}) }
    };
  } catch {
    return defaultAdminLayoutSettingsV213();
  }
}

function saveAdminLayoutSettingsV213(settings) {
  const base = defaultAdminLayoutSettingsV213();
  const clean = {
    adminSections: { ...base.adminSections, ...(settings?.adminSections || {}), system: "settings" },
    pages: { ...base.pages, ...(settings?.pages || {}) }
  };
  localStorage.setItem(adminLayoutSettingsKeyV213(), JSON.stringify(clean));
}

function settingsSectionContentV213(key) {
  ensureSettingsSectionsV213();
  return document.querySelector(`#settingsSectionV213_${CSS.escape(key)} .settings-section-content-v213`);
}

function ensureSettingsSectionsV213() {
  const settingsTab = $("settingsTab");
  if (!settingsTab) return null;

  let accordion = $("settingsAccordionV213");
  if (!accordion) {
    accordion = document.createElement("div");
    accordion.id = "settingsAccordionV213";
    accordion.className = "settings-accordion-v213";

    SETTINGS_SECTIONS_V213.forEach(([key, title, desc], index) => {
      const details = document.createElement("details");
      details.id = `settingsSectionV213_${key}`;
      details.className = "settings-section-v213";
      details.dataset.settingsSectionV213 = key;
      const touched = localStorage.getItem(`${STORAGE_KEY}_settings_section_touched_v213_${key}`) === "1";
      const savedOpen = localStorage.getItem(`${STORAGE_KEY}_settings_section_open_v213_${key}`) === "1";
      details.open = touched ? savedOpen : index === 0;
      details.innerHTML = `
        <summary><span>${escapeHtml(title)}</span><small>${escapeHtml(desc)}</small></summary>
        <div class="settings-section-content-v213"></div>
      `;
      details.addEventListener("toggle", () => {
        localStorage.setItem(`${STORAGE_KEY}_settings_section_touched_v213_${key}`, "1");
        localStorage.setItem(`${STORAGE_KEY}_settings_section_open_v213_${key}`, details.open ? "1" : "0");
      });
      accordion.appendChild(details);
    });
  }

  const header = settingsTab.querySelector(":scope > .section-head");
  if (!accordion.parentElement) {
    if (header?.nextSibling) settingsTab.insertBefore(accordion, header.nextSibling);
    else settingsTab.appendChild(accordion);
  }

  [...settingsTab.children].forEach(child => {
    if (child === header || child === accordion || child.id === "settingsQuickTabsV213") return;
    if (child.closest?.("#settingsAccordionV213")) return;
    const section = settingsSectionForElementV213(child);
    const content = document.querySelector(`#settingsSectionV213_${CSS.escape(section)} .settings-section-content-v213`);
    if (content) content.appendChild(child);
  });

  renderOrganizationPanelV213();
  ensureFootballDataSettingsBoxV213();
  moveTechnicalBlocksToSettingsV213();
  updateSettingsSectionCountsV213();
  return accordion;
}

function settingsSectionForElementV213(el) {
  const id = String(el?.id || "").toLowerCase();
  const text = String(el?.textContent || "").toLowerCase();
  if (id.includes("organization") || id.includes("adminlayout") || text.includes("organização da app")) return "organization";
  if (id.includes("football") || id.includes("firebase") || id.includes("health") || id.includes("suspended") || text.includes("football-data") || text.includes("sync inteligente") || text.includes("firebase e push") || text.includes("saúde da app") || text.includes("jogo suspenso")) return "system";
  if (id.includes("install") || id.includes("settings-grid") || text.includes("instalação") || text.includes("pwa") || text.includes("versão") || text.includes("cache")) return "install";
  if (text.includes("prefer") || text.includes("tema")) return "preferences";
  if (text.includes("admin") || text.includes("logs")) return "admin";
  return "other";
}

function updateSettingsSectionCountsV213() {
  SETTINGS_SECTIONS_V213.forEach(([key]) => {
    const details = $(`settingsSectionV213_${key}`);
    if (!details) return;
    const count = details.querySelectorAll(":scope > .settings-section-content-v213 > *").length;
    details.dataset.count = String(count);
  });
}

function renderOrganizationPanelV213() {
  const content = document.querySelector("#settingsSectionV213_organization .settings-section-content-v213") || $("settingsTab");
  if (!content) return;

  const organizationBoxes = Array.from(document.querySelectorAll("#settingsOrganizationSingleV213"));
  let box = organizationBoxes.find(el => el.parentElement === content) || organizationBoxes[0] || null;
  organizationBoxes.forEach(el => {
    if (el !== box) el.remove();
  });

  if (!box) {
    box = document.createElement("section");
    box.id = "settingsOrganizationSingleV213";
  }
  box.className = "settings-organization-single-v213";

  const settings = savedAdminLayoutSettingsV213();
  const adminCount = ADMIN_SECTION_CHOICES_V213.filter(([key]) => key !== "system" && settings.adminSections?.[key] === "admin").length;
  const settingsCount = ADMIN_SECTION_CHOICES_V213.filter(([key]) => (settings.adminSections?.[key] || (key === "system" ? "settings" : "admin")) === "settings").length;
  const hiddenCount = ADMIN_SECTION_CHOICES_V213.filter(([key]) => settings.adminSections?.[key] === "hidden").length;
  const visiblePagesCount = PAGE_LOCATION_CHOICES_V213.filter(([key]) => settings.pages?.[key] !== false).length;

  const sectionRows = ADMIN_SECTION_CHOICES_V213.map(([key, label, desc]) => {
    const value = settings.adminSections?.[key] || (key === "system" ? "settings" : "admin");
    const locked = key === "system";
    const control = locked
      ? `<span class="settings-org-fixed-v215">Fixo em Config.</span>`
      : `<select data-admin-section-location-v213="${escapeHtml(key)}">
          <option value="admin" ${value === "admin" ? "selected" : ""}>Mostrar no Admin</option>
          <option value="settings" ${value === "settings" ? "selected" : ""}>Mostrar em Configurações</option>
          <option value="hidden" ${value === "hidden" ? "selected" : ""}>Não mostrar</option>
        </select>`;
    return `
      <label class="settings-org-row-v213 settings-org-row-v214">
        <span><b>${escapeHtml(label)}</b><small>${escapeHtml(desc || "")}</small></span>
        ${control}
      </label>`;
  }).join("");

  const pageRows = PAGE_LOCATION_CHOICES_V213.map(([key, label]) => `
    <label class="settings-org-page-v213 settings-org-page-v214">
      <input type="checkbox" data-page-visible-v213="${escapeHtml(key)}" ${settings.pages?.[key] !== false ? "checked" : ""} />
      <span>${escapeHtml(label)}</span>
    </label>`).join("");

  box.innerHTML = `
    <div class="settings-org-head-v213">
      <div>
        <strong>Organização da app</strong>
        <span>Escolhe o que fica visível.</span>
      </div>
      <button type="button" class="secondary small" data-admin-layout-reset-v213>Repor</button>
    </div>
    <div class="settings-org-summary-v214">
      <span><b>${adminCount}</b> no Admin</span>
      <span><b>${settingsCount}</b> em Configurações</span>
      <span><b>${hiddenCount}</b> escondidas</span>
      <span><b>${visiblePagesCount}</b> páginas visíveis</span>
    </div>
    <div class="settings-org-grid-v213 settings-org-grid-v214">
      <div>
        <h4>Secções</h4>
        <div class="settings-org-table-v214">${sectionRows}</div>
      </div>
      <div>
        <h4>Menu</h4>
        <div class="settings-org-pages-v213 settings-org-pages-v214">${pageRows}</div>
      </div>
    </div>
  `;

  if (box.parentElement !== content) content.prepend(box);
}

function adminCardsV214() {
  const cards = Array.from(document.querySelectorAll("#adminUnlocked > .admin-card, #settingsAdminMovedCardsV214 > .admin-card, #adminHiddenCardsV214 > .admin-card"));
  cards.forEach((card, index) => {
    if (!card.dataset.adminManagedV214) {
      card.dataset.adminManagedV214 = "1";
      card.dataset.adminOrderV214 = String(index);
    }
  });
  return cards.sort((a, b) => Number(a.dataset.adminOrderV214 || 0) - Number(b.dataset.adminOrderV214 || 0));
}

function adminCardHostsV214() {
  const adminUnlocked = $("adminUnlocked");
  let settingsHost = $("settingsAdminMovedCardsV214");
  const settingsContent = document.querySelector("#settingsSectionV213_admin .settings-section-content-v213") || $("settingsTab");
  if (!settingsHost && settingsContent) {
    settingsHost = document.createElement("div");
    settingsHost.id = "settingsAdminMovedCardsV214";
    settingsHost.className = "settings-admin-moved-cards-v214";
    settingsContent.appendChild(settingsHost);
  }

  let hiddenHost = $("adminHiddenCardsV214");
  if (!hiddenHost) {
    hiddenHost = document.createElement("div");
    hiddenHost.id = "adminHiddenCardsV214";
    hiddenHost.hidden = true;
    hiddenHost.style.display = "none";
    (adminUnlocked || document.body).appendChild(hiddenHost);
  }

  return { adminUnlocked, settingsHost, hiddenHost };
}

function routeAdminCardsV214(settings = savedAdminLayoutSettingsV213()) {
  const { adminUnlocked, settingsHost, hiddenHost } = adminCardHostsV214();
  const availableAdminSections = new Set();
  const cards = adminCardsV214();

  cards.forEach(card => {
    const section = adminSectionForCardV187(card);
    const location = section === "system" ? "settings" : (settings.adminSections?.[section] || "admin");
    card.dataset.adminSectionV187 = section;
    card.classList.remove("admin-section-hidden-v187", "admin-section-force-hidden-v202");
    card.hidden = false;
    card.style.display = "";

    if (location === "settings" && settingsHost) {
      settingsHost.appendChild(card);
      if (card.tagName?.toLowerCase() === "details") card.open = false;
      return;
    }

    if (location === "hidden" && hiddenHost) {
      hiddenHost.appendChild(card);
      card.hidden = true;
      card.style.display = "none";
      return;
    }

    if (adminUnlocked) {
      adminUnlocked.appendChild(card);
      availableAdminSections.add(section);
    }
  });

  return availableAdminSections;
}

function ensureFootballDataSettingsBoxV213() {
  const content = document.querySelector("#settingsSectionV213_system .settings-section-content-v213") || $("settingsTab");
  if (!content) return null;
  let box = $("footballDataSettingsBoxV213");
  if (!box) {
    box = document.createElement("section");
    box.id = "footballDataSettingsBoxV213";
    box.className = "configs-technical-card-v213";
    box.innerHTML = `
      <div>
        <strong>API football-data.org</strong>
        <span>Resultados e live score.</span>
      </div>
      <div class="settings-actions-v162" id="footballDataSettingsActionsV213"></div>
    `;
  }
  if (box.parentElement !== content) content.appendChild(box);

  const actions = $("footballDataSettingsActionsV213");
  let btn = $("syncFootballDataBtn");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "syncFootballDataBtn";
    btn.className = "primary";
    btn.type = "button";
    btn.textContent = "Atualizar resultados automáticos";
    btn.addEventListener("click", () => syncFootballDataResultsV139?.());
  }
  if (actions && btn.parentElement !== actions) actions.appendChild(btn);
  btn.classList.remove("hidden");
  btn.hidden = false;
  btn.style.display = "";
  btn.disabled = !hasPermission("editResults");
  return box;
}

function moveTechnicalBlocksToSettingsV213() {
  const content = document.querySelector("#settingsSectionV213_system .settings-section-content-v213") || $("settingsTab");
  if (!content) return;
  TECHNICAL_BLOCK_IDS_V213.forEach(id => {
    const el = $(id);
    if (!el || el.id === "footballDataSettingsBoxV213") return;
    el.classList.remove("hidden", "admin-section-hidden-v187", "admin-section-force-hidden-v202", "force-hide-technical-v209", "force-hide-technical-v210", "force-not-in-admin-v206");
    el.style.display = "";
    if (el.parentElement !== content) content.appendChild(el);
  });
}

function cleanupAdminTechnicalBlocksV213() {
  ensureFootballDataSettingsBoxV213();
  document.querySelectorAll("#adminTab #settingsOrganizationSingleV213").forEach(el => el.remove());
  TECHNICAL_BLOCK_IDS_V213.forEach(id => {
    const el = document.querySelector(`#adminTab #${CSS.escape(id)}, #loginScreen #${CSS.escape(id)}`);
    if (el) moveTechnicalBlocksToSettingsV213();
  });
}

function applyAdminLayoutSettingsV213() {
  const settings = savedAdminLayoutSettingsV213();
  PAGE_LOCATION_CHOICES_V213.forEach(([key, , tabId]) => {
    const tab = document.querySelector(`[data-tab="${CSS.escape(tabId)}"]`);
    if (tab) tab.classList.toggle("user-hidden-v202", settings.pages?.[key] === false);
  });

  const availableAdminSections = routeAdminCardsV214(settings);
  const available = [...availableAdminSections];
  let active = localStorage.getItem(`${STORAGE_KEY}_admin_section_v187`) || available[0] || "";
  if (!availableAdminSections.has(active)) {
    active = available[0] || "";
    if (active) localStorage.setItem(`${STORAGE_KEY}_admin_section_v187`, active);
  }

  document.querySelectorAll("#adminSectionTabsV187 [data-admin-section-v187]").forEach(button => {
    const section = button.dataset.adminSectionV187;
    const visible = availableAdminSections.has(section);
    button.classList.toggle("hidden", !visible);
    button.hidden = !visible;
    button.classList.toggle("active", section === active);
  });

  document.querySelectorAll("#adminUnlocked > .admin-card").forEach(card => {
    const section = card.dataset.adminSectionV187 || adminSectionForCardV187(card);
    const hide = !active || section !== active;
    card.classList.toggle("admin-section-hidden-v187", hide);
    card.hidden = hide;
    if (!hide && card.tagName?.toLowerCase() === "details") card.open = true;
  });

  const hasAdminContent = availableAdminSections.size > 0;
  ["firebaseStatusBox", "adminOverviewV162", "adminSectionTabsV187"].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.hidden = !hasAdminContent;
    el.style.display = hasAdminContent ? "" : "none";
  });

  const activeTab = document.querySelector(".tab.active");
  if (activeTab?.classList.contains("user-hidden-v202")) switchToFirstAllowedTab();

  cleanupAdminTechnicalBlocksV213();
}

function applySettingsLayoutV213() {
  try {
    ensureSettingsSectionsV213();
    renderOrganizationPanelV213();
    routeAdminCardsV214();
    ensureFootballDataSettingsBoxV213();
    moveTechnicalBlocksToSettingsV213();
    updateSettingsSectionCountsV213();
  } catch (error) {
    console.warn("applySettingsLayoutV213 falhou:", error);
  }
}

const originalFootballRealtimeSyncEnsureBoxV213 = typeof footballRealtimeSyncEnsureBoxV156 === "function" ? footballRealtimeSyncEnsureBoxV156 : null;
if (originalFootballRealtimeSyncEnsureBoxV213) {
  footballRealtimeSyncEnsureBoxV156 = function footballRealtimeSyncEnsureBoxSettingsV213() {
    const content = document.querySelector("#settingsSectionV213_system .settings-section-content-v213") || $("settingsTab");
    let box = $("footballRealtimeSyncBoxV156");
    if (!box) {
      box = document.createElement("section");
      box.id = "footballRealtimeSyncBoxV156";
      box.className = "football-realtime-sync-box-v156";
      box.innerHTML = `
        <div class="football-realtime-sync-top-v156">
          <div><strong>Sync API em tempo real</strong><span id="footballRealtimeSyncSubV156">A ligar ao Firestore...</span></div>
          <div class="football-realtime-sync-pill-v156 unknown" id="footballRealtimeSyncPillV156"><i></i><span>A verificar</span></div>
        </div>
        <div class="football-realtime-sync-grid-v156">
          <div><b id="footballRealtimeSyncLastV156"></b><span>Última sync</span></div>
          <div><b id="footballRealtimeSyncMatchesV156"></b><span>Jogos API</span></div>
          <div><b id="footballRealtimeSyncFinishedV156"></b><span>Terminados</span></div>
          <div><b id="footballRealtimeSyncUpdatedV156"></b><span>Atualizados</span></div>
        </div>`;
    }
    if (content && box.parentElement !== content) content.appendChild(box);
    return box;
  };
}

if (typeof ensureFootballDataButtonV142 === "function") {
  ensureFootballDataButtonV142 = function ensureFootballDataButtonSettingsV213() {
    if (document.querySelector(".tab-panel.active")?.id === "settingsTab") ensureFootballDataSettingsBoxV213();
  };
}

if (typeof ensureFootballDataAdminFixedButtonV143 === "function") {
  ensureFootballDataAdminFixedButtonV143 = function ensureFootballDataAdminFixedButtonSettingsV213() {
    if (document.querySelector(".tab-panel.active")?.id === "settingsTab") ensureFootballDataSettingsBoxV213();
  };
}

const renderAppSettingsPanelOriginalV213 = typeof renderAppSettingsPanelV162 === "function" ? renderAppSettingsPanelV162 : null;
if (renderAppSettingsPanelOriginalV213) {
  renderAppSettingsPanelV162 = function renderAppSettingsPanelV213() {
    renderAppSettingsPanelOriginalV213();
    applySettingsLayoutV213();
    try { renderFirebaseHealthPanelV187(); } catch (error) { console.warn("renderFirebaseHealthPanelV187 falhou:", error); }
    try { footballRealtimeSyncRenderV156?.(); } catch (error) { console.warn("footballRealtimeSyncRenderV156 falhou:", error); }
    try { renderFootballFreeStatusV149?.(); } catch (error) { console.warn("renderFootballFreeStatusV149 falhou:", error); }
    applySettingsLayoutV213();
  };
}

const renderAdminSectionsOriginalV213 = typeof renderAdminSectionsV187 === "function" ? renderAdminSectionsV187 : null;
if (renderAdminSectionsOriginalV213) {
  renderAdminSectionsV187 = function renderAdminSectionsV213() {
    renderAdminSectionsOriginalV213();
    applyAdminLayoutSettingsV213();
  };
}

const renderActivePageOriginalV213 = typeof renderActivePageV187 === "function" ? renderActivePageV187 : null;
if (renderActivePageOriginalV213) {
  renderActivePageV187 = function renderActivePageCleanV213(tabId = activeTabIdV187()) {
    renderActivePageOriginalV213(tabId);
    if (tabId === "settingsTab") applySettingsLayoutV213();
    if (tabId === "adminTab") applyAdminLayoutSettingsV213();
  };
}

const applyPermissionsToUiOriginalV213 = typeof applyPermissionsToUi === "function" ? applyPermissionsToUi : null;
if (applyPermissionsToUiOriginalV213) {
  applyPermissionsToUi = function applyPermissionsToUiCleanV213() {
    applyPermissionsToUiOriginalV213();
    applyAdminLayoutSettingsV213();
    const activeTab = document.querySelector(".tab.active");
    if (activeTab?.classList.contains("user-hidden-v202")) switchToFirstAllowedTab();
  };
}

document.addEventListener("change", event => {
  const sectionSelect = event.target.closest?.("[data-admin-section-location-v213]");
  const pageCheckbox = event.target.closest?.("[data-page-visible-v213]");
  if (!sectionSelect && !pageCheckbox) return;
  const settings = savedAdminLayoutSettingsV213();
  if (sectionSelect) {
    const sectionKey = sectionSelect.getAttribute("data-admin-section-location-v213");
    if (sectionKey) settings.adminSections[sectionKey] = sectionSelect.value;
  }
  if (pageCheckbox) {
    const pageKey = pageCheckbox.getAttribute("data-page-visible-v213");
    if (pageKey) settings.pages[pageKey] = pageCheckbox.checked;
  }
  saveAdminLayoutSettingsV213(settings);
  applyAdminLayoutSettingsV213();
  applySettingsLayoutV213();
  setTimeout(renderOrganizationPanelV213, 0);
  toast("Organização guardada neste dispositivo.");
}, true);

document.addEventListener("click", event => {
  if (event.target.closest?.("[data-admin-layout-reset-v213]")) {
    event.preventDefault();
    localStorage.removeItem(adminLayoutSettingsKeyV213());
    renderOrganizationPanelV213();
    applyAdminLayoutSettingsV213();
    toast("Organização reposta.");
    return;
  }
  if (event.target.closest?.("[data-tab='settingsTab']")) setTimeout(applySettingsLayoutV213, 80);
  if (event.target.closest?.("[data-tab='adminTab'],[data-admin-section-v187]")) setTimeout(applyAdminLayoutSettingsV213, 80);
}, true);

document.addEventListener("change", event => {
  const input = event.target.closest?.("#pushNotificationsPanelV165 input[type='checkbox']");
  if (!input) return;
  try { savePushPreferencesLocalV181(); } catch (error) { console.warn("Guardar preferências push local falhou:", error); }
  const btn = $("savePushPrefsBtnV181");
  if (btn) btn.textContent = "Guardar preferências";
}, true);

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => { if ($("settingsTab")?.classList.contains("active")) applySettingsLayoutV213(); }, 400);
  setTimeout(() => { if ($("adminTab")?.classList.contains("active")) applyAdminLayoutSettingsV213(); }, 700);
});


// v214 — Users popup sempre à frente, fora do stacking da topbar/tabs.
function positionOnlineUsersPopupV214() {
  const panel = $("onlineUsersPanel");
  const list = $("onlineUsersList");
  const trigger = panel?.querySelector("summary");
  if (!panel || !list || !trigger || !panel.open) return;

  const rect = trigger.getBoundingClientRect();
  const margin = 12;
  const viewportW = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;

  const desiredWidth = Math.min(520, Math.max(320, viewportW - margin * 2));
  const left = Math.max(margin, Math.min(rect.right - desiredWidth, viewportW - desiredWidth - margin));
  const top = Math.max(margin, Math.min(rect.bottom + 8, viewportH - 120));

  list.style.position = "fixed";
  list.style.left = `${Math.round(left)}px`;
  list.style.right = "auto";
  list.style.top = `${Math.round(top)}px`;
  list.style.width = `${Math.round(desiredWidth)}px`;
  list.style.maxWidth = `calc(100vw - ${margin * 2}px)`;
  list.style.maxHeight = `${Math.max(220, Math.round(viewportH - top - margin))}px`;
  list.style.zIndex = "2147483000";
  list.style.transform = "none";
  list.style.pointerEvents = "auto";

  panel.classList.add("online-users-floating-v214");
  document.body.classList.add("online-users-open-v214");
}

function closeOnlineUsersPanelV214(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const panel = $("onlineUsersPanel");
  if (panel) panel.open = false;
  document.body.classList.remove("online-users-open-v214");
  return false;
}

window.closeOnlineUsersPanelNow = closeOnlineUsersPanelV214;

function bindOnlineUsersPopupV214() {
  const panel = $("onlineUsersPanel");
  if (!panel || panel.dataset.usersPopupV214 === "1") return;
  panel.dataset.usersPopupV214 = "1";

  panel.addEventListener("toggle", () => {
    if (panel.open) {
      positionOnlineUsersPopupV214();
      setTimeout(positionOnlineUsersPopupV214, 50);
      setTimeout(positionOnlineUsersPopupV214, 250);
    } else {
      document.body.classList.remove("online-users-open-v214");
      const list = $("onlineUsersList");
      if (list) {
        list.style.left = "";
        list.style.top = "";
        list.style.width = "";
        list.style.maxHeight = "";
        list.style.transform = "";
      }
    }
  });

  document.addEventListener("click", event => {
    const opened = panel.open;
    if (!opened) return;
    if (event.target.closest?.("#onlineUsersPanel")) return;
    panel.open = false;
    document.body.classList.remove("online-users-open-v214");
  }, true);

  window.addEventListener("resize", positionOnlineUsersPopupV214, { passive: true });
  window.addEventListener("scroll", positionOnlineUsersPopupV214, { passive: true });
}

document.addEventListener("DOMContentLoaded", () => {
  bindOnlineUsersPopupV214();
  setTimeout(bindOnlineUsersPopupV214, 800);
  setTimeout(positionOnlineUsersPopupV214, 900);
});

const renderOnlineUsersOriginalV214 = typeof renderOnlineUsers === "function" ? renderOnlineUsers : null;
if (renderOnlineUsersOriginalV214 && !window.__renderOnlineUsersV214) {
  window.__renderOnlineUsersV214 = true;
  renderOnlineUsers = function renderOnlineUsersV214() {
    renderOnlineUsersOriginalV214();
    bindOnlineUsersPopupV214();
    setTimeout(positionOnlineUsersPopupV214, 0);
    setTimeout(positionOnlineUsersPopupV214, 120);
  };
}


// v220 — Users popup em portal real no body.
// Corrige de vez o problema de ficar por baixo de tabs/topbar/sticky bars.
let onlineUsersOriginalParentV220 = null;
let onlineUsersOriginalNextSiblingV220 = null;

function onlineUsersPanelV220() {
  return $("onlineUsersPanel");
}

function onlineUsersListV220() {
  return $("onlineUsersList");
}

function onlineUsersTriggerV220() {
  return onlineUsersPanelV220()?.querySelector("summary");
}

function moveOnlineUsersListToBodyV220() {
  const list = onlineUsersListV220();
  if (!list) return;

  if (!onlineUsersOriginalParentV220) {
    onlineUsersOriginalParentV220 = list.parentElement;
    onlineUsersOriginalNextSiblingV220 = list.nextSibling;
  }

  if (list.parentElement !== document.body) {
    document.body.appendChild(list);
  }

  list.classList.add("online-users-portal-v220");
  document.body.classList.add("online-users-open-v220");
}

function restoreOnlineUsersListV220() {
  const list = onlineUsersListV220();
  if (!list) return;

  list.classList.remove("online-users-portal-v220");
  list.style.left = "";
  list.style.top = "";
  list.style.width = "";
  list.style.maxHeight = "";
  list.style.transform = "";

  if (onlineUsersOriginalParentV220 && list.parentElement !== onlineUsersOriginalParentV220) {
    if (onlineUsersOriginalNextSiblingV220 && onlineUsersOriginalNextSiblingV220.parentElement === onlineUsersOriginalParentV220) {
      onlineUsersOriginalParentV220.insertBefore(list, onlineUsersOriginalNextSiblingV220);
    } else {
      onlineUsersOriginalParentV220.appendChild(list);
    }
  }

  document.body.classList.remove("online-users-open-v220");
}

function positionOnlineUsersPopupV220() {
  const panel = onlineUsersPanelV220();
  const list = onlineUsersListV220();
  const trigger = onlineUsersTriggerV220();
  if (!panel || !list || !trigger || !panel.open) return;

  moveOnlineUsersListToBodyV220();

  const rect = trigger.getBoundingClientRect();
  const margin = 12;
  const viewportW = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;

  const width = Math.min(520, Math.max(340, viewportW - margin * 2));
  const left = Math.max(margin, Math.min(rect.right - width, viewportW - width - margin));
  const top = Math.max(margin, Math.min(rect.bottom + 10, viewportH - 160));
  const maxHeight = Math.max(240, viewportH - top - margin);

  list.style.position = "fixed";
  list.style.left = `${Math.round(left)}px`;
  list.style.top = `${Math.round(top)}px`;
  list.style.width = `${Math.round(width)}px`;
  list.style.maxHeight = `${Math.round(maxHeight)}px`;
  list.style.transform = "none";
  list.style.zIndex = "2147483600";
  list.style.pointerEvents = "auto";
}

function closeOnlineUsersPanelV220(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const panel = onlineUsersPanelV220();
  if (panel) panel.open = false;
  restoreOnlineUsersListV220();
  return false;
}

window.closeOnlineUsersPanelNow = closeOnlineUsersPanelV220;

function bindOnlineUsersPortalV220() {
  const panel = onlineUsersPanelV220();
  if (!panel || panel.dataset.usersPortalV220 === "1") return;

  panel.dataset.usersPortalV220 = "1";

  panel.addEventListener("toggle", () => {
    if (panel.open) {
      positionOnlineUsersPopupV220();
      setTimeout(positionOnlineUsersPopupV220, 40);
      setTimeout(positionOnlineUsersPopupV220, 180);
    } else {
      restoreOnlineUsersListV220();
    }
  });

  document.addEventListener("click", event => {
    const p = onlineUsersPanelV220();
    const list = onlineUsersListV220();
    if (!p?.open) return;

    if (event.target.closest?.("#onlineUsersPanel")) return;
    if (event.target.closest?.("#onlineUsersList")) return;

    p.open = false;
    restoreOnlineUsersListV220();
  }, true);

  window.addEventListener("resize", positionOnlineUsersPopupV220, { passive: true });
  window.addEventListener("scroll", positionOnlineUsersPopupV220, { passive: true });
}

document.addEventListener("DOMContentLoaded", () => {
  bindOnlineUsersPortalV220();
  setTimeout(bindOnlineUsersPortalV220, 700);
  setTimeout(positionOnlineUsersPopupV220, 900);
});

const renderOnlineUsersOriginalV220 = typeof renderOnlineUsers === "function" ? renderOnlineUsers : null;
if (renderOnlineUsersOriginalV220 && !window.__renderOnlineUsersV220) {
  window.__renderOnlineUsersV220 = true;
  renderOnlineUsers = function renderOnlineUsersV220() {
    renderOnlineUsersOriginalV220();
    bindOnlineUsersPortalV220();

    const panel = onlineUsersPanelV220();
    if (panel?.open) {
      moveOnlineUsersListToBodyV220();
      setTimeout(positionOnlineUsersPopupV220, 0);
      setTimeout(positionOnlineUsersPopupV220, 120);
    }
  };
}


// v221 — cor ativa dos botões de filtro do calendário.
function calendarFilterModeV221() {
  return String(calendarViewMode || "missing").trim().toLowerCase();
}

function updateCalendarFilterButtonsV221() {
  const mode = calendarFilterModeV221();

  const map = [
    ["calendarMissingResultsBtn", "missing"],
    ["calendarPlayedGamesBtn", "played"],
    ["calendarAllGamesBtn", "all"]
  ];

  map.forEach(([id, value]) => {
    const btn = $(id);
    if (!btn) return;

    const active = mode === value;
    btn.classList.toggle("calendar-filter-active-v221", active);
    btn.classList.toggle("calendar-filter-inactive-v221", !active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");

    if (id === "calendarMissingResultsBtn") btn.dataset.filterKindV221 = "missing";
    if (id === "calendarPlayedGamesBtn") btn.dataset.filterKindV221 = "played";
    if (id === "calendarAllGamesBtn") btn.dataset.filterKindV221 = "all";
  });
}

document.addEventListener("click", event => {
  if (
    event.target.closest?.("#calendarMissingResultsBtn") ||
    event.target.closest?.("#calendarPlayedGamesBtn") ||
    event.target.closest?.("#calendarAllGamesBtn")
  ) {
    setTimeout(updateCalendarFilterButtonsV221, 0);
    setTimeout(updateCalendarFilterButtonsV221, 120);
  }
}, true);

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(updateCalendarFilterButtonsV221, 300);
  setTimeout(updateCalendarFilterButtonsV221, 1200);
});

const renderCalendarOriginalV221 = typeof renderCalendar === "function" ? renderCalendar : null;
if (renderCalendarOriginalV221 && !window.__renderCalendarButtonsV221) {
  window.__renderCalendarButtonsV221 = true;
  renderCalendar = function renderCalendarV221() {
    const result = renderCalendarOriginalV221.apply(this, arguments);
    setTimeout(updateCalendarFilterButtonsV221, 0);
    return result;
  };
}

const renderAllOriginalV221 = typeof renderAll === "function" ? renderAll : null;
if (renderAllOriginalV221 && !window.__renderAllButtonsV221) {
  window.__renderAllButtonsV221 = true;
  renderAll = function renderAllV221() {
    const result = renderAllOriginalV221.apply(this, arguments);
    setTimeout(updateCalendarFilterButtonsV221, 0);
    return result;
  };
}


// v228 - Admin e Configuracoes com colapsaveis unicos e estaveis.
const COLLAPSE_STATE_KEY_V228 = `${STORAGE_KEY}_collapse_state_v228`;
const COLLAPSE_TOUCHED_KEY_V228 = `${STORAGE_KEY}_collapse_touched_v228`;

function noopCollapseLegacyV228() {}

try {
  if (typeof applyAdminCollapseV222 === "function") applyAdminCollapseV222 = noopCollapseLegacyV228;
  if (typeof closeAllAdminCollapseV222 === "function") closeAllAdminCollapseV222 = noopCollapseLegacyV228;
  if (typeof prepareSettingsCollapseV223 === "function") prepareSettingsCollapseV223 = noopCollapseLegacyV228;
  if (typeof closeAllSettingsCollapseV223 === "function") closeAllSettingsCollapseV223 = noopCollapseLegacyV228;
  if (typeof removeFakeAdminCollapseSectionsV224 === "function") removeFakeAdminCollapseSectionsV224 = noopCollapseLegacyV228;
  if (typeof removeFakeSettingsCollapseSectionsV225 === "function") removeFakeSettingsCollapseSectionsV225 = noopCollapseLegacyV228;
  if (typeof applyFirstTabsOpenV226 === "function") applyFirstTabsOpenV226 = noopCollapseLegacyV228;
  if (typeof openFirstDetailsV226 === "function") openFirstDetailsV226 = noopCollapseLegacyV228;
  if (typeof visibleUsefulDetailsV226 === "function") visibleUsefulDetailsV226 = () => [];
  if (typeof settingsUserToggleV227 !== "undefined") settingsUserToggleV227 = null;
} catch (error) {
  console.warn("Neutralizar colapsaveis antigos falhou:", error);
}

function collapseStateV228(scope) {
  try {
    const all = JSON.parse(localStorage.getItem(COLLAPSE_STATE_KEY_V228) || "{}") || {};
    return all[scope] && typeof all[scope] === "object" ? all[scope] : {};
  } catch {
    return {};
  }
}

function collapseTouchedV228(scope) {
  try {
    const all = JSON.parse(localStorage.getItem(COLLAPSE_TOUCHED_KEY_V228) || "{}") || {};
    return all[scope] === true;
  } catch {
    return false;
  }
}

function saveCollapseStateV228(scope, key, open) {
  try {
    const all = JSON.parse(localStorage.getItem(COLLAPSE_STATE_KEY_V228) || "{}") || {};
    all[scope] = { ...(all[scope] || {}), [key]: Boolean(open) };
    localStorage.setItem(COLLAPSE_STATE_KEY_V228, JSON.stringify(all));

    const touched = JSON.parse(localStorage.getItem(COLLAPSE_TOUCHED_KEY_V228) || "{}") || {};
    touched[scope] = true;
    localStorage.setItem(COLLAPSE_TOUCHED_KEY_V228, JSON.stringify(touched));
  } catch (error) {
    console.warn("Guardar estado dos colapsaveis falhou:", error);
  }
}

function usefulElementV228(el) {
  if (!el || el.hidden) return false;
  if (el.id === "adminHiddenCardsV214" || el.id === "settingsAdminMovedCardsV214") return false;
  if (el.classList?.contains("hidden") || el.classList?.contains("user-hidden-v202")) return false;
  if (el.classList?.contains("admin-section-tabs-v187")) return false;
  const text = String(el.textContent || "").replace(/\s+/g, " ").trim();
  if (text.length > 6) return true;
  return Boolean(el.querySelector?.("button,input,select,textarea,table,img,canvas,svg,[id]"));
}

function usefulChildrenV228(container) {
  return [...(container?.children || [])].filter(usefulElementV228);
}

function unwrapDetailsV228(details, contentSelector) {
  const parent = details?.parentElement;
  const content = details?.querySelector?.(contentSelector);
  if (!parent || !content) {
    details?.remove?.();
    return;
  }
  [...content.children].forEach(child => parent.insertBefore(child, details));
  details.remove();
}

function unwrapLegacyCollapseV228(root) {
  if (!root) return;
  root.querySelectorAll("details.admin-collapse-section-v222").forEach(details => unwrapDetailsV228(details, ":scope > .admin-collapse-content-v222"));
  root.querySelectorAll("details.admin-card-collapse-v222").forEach(details => unwrapDetailsV228(details, ":scope > .admin-card-collapse-content-v222"));
  root.querySelectorAll("details.settings-collapse-section-v223").forEach(details => unwrapDetailsV228(details, ":scope > .settings-collapse-content-v223"));
  root.querySelectorAll("#adminCollapseShellV222,#settingsCollapseShellV223").forEach(shell => {
    [...shell.children].forEach(child => shell.parentElement?.insertBefore(child, shell));
    shell.remove();
  });
  document.body.classList.remove("settings-collapsed-v223");
}

function unwrapCleanSectionsV228(root, selector) {
  if (!root) return;
  root.querySelectorAll(selector).forEach(section => {
    const content = section.querySelector(":scope > .clean-collapse-content-v228");
    if (content) [...content.children].forEach(child => section.parentElement?.insertBefore(child, section));
    section.remove();
  });
}

function makeCleanSectionV228({ scope, key, title, description = "", items = [], index = 0 }) {
  const details = document.createElement("details");
  details.className = `${scope}-clean-section-v228 clean-collapse-section-v228`;
  details.dataset.cleanCollapseScopeV228 = scope;
  details.dataset.cleanCollapseKeyV228 = key;

  const state = collapseStateV228(scope);
  const touched = collapseTouchedV228(scope);
  details.open = touched ? state[key] === true : index === 0;

  const summary = document.createElement("summary");
  summary.innerHTML = `<span>${escapeHtml(title)}</span>${description ? `<small>${escapeHtml(description)}</small>` : ""}`;

  const content = document.createElement("div");
  content.className = "clean-collapse-content-v228";
  items.forEach(item => content.appendChild(item));

  details.appendChild(summary);
  details.appendChild(content);
  details.addEventListener("toggle", () => saveCollapseStateV228(scope, key, details.open));
  return details;
}

function adminSectionForCardV228(card) {
  const title = String(card?.querySelector?.(":scope > summary h2, h2, h3, strong")?.textContent || "").toLowerCase();
  const text = String(card?.textContent || "").toLowerCase();
  if (title.includes("permiss") || title.includes("users do jogo") || text.includes("guardar utilizador") || text.includes("adicionar user")) return "users";
  if (title.includes("fase final") || text.includes("knockout")) return "knockout";
  if (title.includes("pontos") || title.includes("exportar pontos") || title.includes("resultados especiais") || text.includes("guardar pontos")) return "points";
  if (title.includes("resultado") || title.includes("excel") || text.includes("importar excel") || text.includes("adminGamesList")) return "results";
  return "system";
}

function organizeAdminPageV228() {
  const adminTab = $("adminTab");
  const adminUnlocked = $("adminUnlocked");
  if (!adminTab || !adminUnlocked) return;

  unwrapLegacyCollapseV228(adminTab);
  unwrapCleanSectionsV228(adminUnlocked, ":scope > .admin-clean-section-v228");

  const settings = savedAdminLayoutSettingsV213();
  const availableSections = typeof routeAdminCardsV214 === "function" ? routeAdminCardsV214(settings) : new Set();
  cleanupAdminTechnicalBlocksV213?.();

  const tabs = $("adminSectionTabsV187");
  if (tabs) {
    tabs.hidden = true;
    tabs.style.display = "none";
  }

  const summaryItems = [$("firebaseStatusBox"), $("adminOverviewV162")].filter(el => el && adminUnlocked.contains(el));
  summaryItems.forEach(el => {
    el.hidden = false;
    el.style.display = "";
  });

  const buckets = {
    summary: summaryItems,
    users: [],
    results: [],
    points: [],
    knockout: [],
    system: []
  };

  [...adminUnlocked.children].forEach(child => {
    if (!child.classList?.contains("admin-card")) return;
    if (child.hidden || child.style.display === "none") return;
    const key = adminSectionForCardV228(child);
    if (!buckets[key]) buckets.system.push(child);
    else buckets[key].push(child);
  });

  const sectionDefs = [
    ["summary", "Resumo", "Estado geral da app"],
    ["users", "Users", "Contas, cargos e participantes"],
    ["results", "Resultados", "Jogos, Excel e resultados"],
    ["points", "Pontos", "Regras e extras"],
    ["knockout", "Fase Final", "Jogos a eliminar"],
    ["system", "Sistema", "Apenas se houver conteudo"],
  ];

  const sections = sectionDefs
    .map(([key, title, description]) => ({ key, title, description, items: buckets[key].filter(usefulElementV228) }))
    .filter(section => section.items.length > 0);

  sections.forEach((section, index) => {
    const details = makeCleanSectionV228({ scope: "admin", key: section.key, title: section.title, description: section.description, items: section.items, index });
    adminUnlocked.appendChild(details);
  });

  adminUnlocked.querySelectorAll(".admin-collapse-section-v222,.admin-card-collapse-v222").forEach(el => el.remove());
}

function organizeSettingsPageV228() {
  const settingsTab = $("settingsTab");
  if (!settingsTab) return;

  unwrapLegacyCollapseV228(settingsTab);
  if (typeof ensureSettingsSectionsV213 === "function") ensureSettingsSectionsV213();
  if (typeof renderOrganizationPanelV213 === "function") renderOrganizationPanelV213();
  if (typeof ensureFootballDataSettingsBoxV213 === "function") ensureFootballDataSettingsBoxV213();
  if (typeof moveTechnicalBlocksToSettingsV213 === "function") moveTechnicalBlocksToSettingsV213();

  const accordion = $("settingsAccordionV213");
  if (!accordion) return;

  const wantedOrder = ["organization", "system", "install", "preferences", "admin", "other"];
  wantedOrder.forEach(key => {
    const section = $(`settingsSectionV213_${key}`);
    if (section && section.parentElement === accordion) accordion.appendChild(section);
  });

  const usefulSections = [];
  accordion.querySelectorAll(":scope > details.settings-section-v213").forEach(details => {
    const key = details.dataset.settingsSectionV213 || details.id.replace("settingsSectionV213_", "");
    const content = details.querySelector(":scope > .settings-section-content-v213");
    const useful = usefulChildrenV228(content).length > 0;
    const knownOptional = ["preferences", "admin", "other"].includes(key);

    if (!useful || (knownOptional && !useful)) {
      details.hidden = true;
      details.style.display = "none";
      return;
    }

    details.hidden = false;
    details.style.display = "";
    usefulSections.push(details);
  });

  const state = collapseStateV228("settings");
  const touched = collapseTouchedV228("settings");
  usefulSections.forEach((details, index) => {
    const key = details.dataset.settingsSectionV213 || details.id || `settings_${index}`;
    details.open = touched ? state[key] === true : index === 0;
    if (!details.dataset.cleanToggleV228) {
      details.dataset.cleanToggleV228 = "1";
      details.addEventListener("toggle", () => saveCollapseStateV228("settings", key, details.open));
    }
  });

  settingsTab.querySelectorAll("details.settings-collapse-section-v223,#settingsCollapseShellV223").forEach(el => el.remove());
}

function applyAdminLayoutSettingsV228() {
  const settings = savedAdminLayoutSettingsV213();
  PAGE_LOCATION_CHOICES_V213.forEach(([key, , tabId]) => {
    const tab = document.querySelector(`[data-tab="${CSS.escape(tabId)}"]`);
    if (tab) tab.classList.toggle("user-hidden-v202", settings.pages?.[key] === false);
  });

  organizeAdminPageV228();
  const activeTab = document.querySelector(".tab.active");
  if (activeTab?.classList.contains("user-hidden-v202")) switchToFirstAllowedTab();
}

function applySettingsLayoutV228() {
  organizeSettingsPageV228();
}

function innerCollapseDetailsV229(summary) {
  const details = summary?.parentElement;
  if (!(details instanceof HTMLDetailsElement)) return null;
  if (details.classList.contains("clean-collapse-section-v228")) return null;
  if (details.classList.contains("settings-section-v213")) return null;

  const insideAdmin = details.matches(".admin-card.admin-collapse") && details.closest(".admin-clean-section-v228");
  const insideSettings = details.closest("#settingsTab .settings-section-content-v213") && !details.classList.contains("settings-section-v213");
  return insideAdmin || insideSettings ? details : null;
}

function toggleInnerCollapseV229(summary, event) {
  const details = innerCollapseDetailsV229(summary);
  if (!details) return false;
  event?.preventDefault?.();
  event?.stopPropagation?.();
  details.open = !details.open;
  details.dataset.userOpenV229 = details.open ? "1" : "0";
  return true;
}

try {
  applyAdminLayoutSettingsV213 = applyAdminLayoutSettingsV228;
  applySettingsLayoutV213 = applySettingsLayoutV228;
} catch (error) {
  console.warn("Substituir layouts antigos falhou:", error);
}

const renderAdminOriginalV228 = typeof renderAdmin === "function" ? renderAdmin : null;
if (renderAdminOriginalV228 && !window.__renderAdminCleanV228) {
  window.__renderAdminCleanV228 = true;
  renderAdmin = function renderAdminCleanV228() {
    const result = renderAdminOriginalV228.apply(this, arguments);
    setTimeout(organizeAdminPageV228, 0);
    return result;
  };
}

const renderAdminSectionsOriginalV228 = typeof renderAdminSectionsV187 === "function" ? renderAdminSectionsV187 : null;
if (renderAdminSectionsOriginalV228 && !window.__renderAdminSectionsCleanV228) {
  window.__renderAdminSectionsCleanV228 = true;
  renderAdminSectionsV187 = function renderAdminSectionsCleanV228() {
    const result = renderAdminSectionsOriginalV228.apply(this, arguments);
    setTimeout(organizeAdminPageV228, 0);
    return result;
  };
}

const renderSettingsOriginalV228 = typeof renderAppSettingsPanelV162 === "function" ? renderAppSettingsPanelV162 : null;
if (renderSettingsOriginalV228 && !window.__renderSettingsCleanV228) {
  window.__renderSettingsCleanV228 = true;
  renderAppSettingsPanelV162 = function renderSettingsCleanV228() {
    const result = renderSettingsOriginalV228.apply(this, arguments);
    setTimeout(organizeSettingsPageV228, 0);
    return result;
  };
}

const renderAllOriginalV228 = typeof renderAll === "function" ? renderAll : null;
if (renderAllOriginalV228 && !window.__renderAllCleanCollapseV228) {
  window.__renderAllCleanCollapseV228 = true;
  renderAll = function renderAllCleanCollapseV228() {
    const result = renderAllOriginalV228.apply(this, arguments);
    setTimeout(() => {
      if ($("adminTab")?.classList.contains("active")) organizeAdminPageV228();
      if ($("settingsTab")?.classList.contains("active")) organizeSettingsPageV228();
    }, 0);
    return result;
  };
}

document.addEventListener("click", event => {
  if (toggleKnockoutUnlockControlV231(event)) return;

  const innerSummary = event.target.closest?.("#adminTab .admin-card.admin-collapse > summary, #settingsTab .settings-section-content-v213 details > summary");
  if (innerSummary && toggleInnerCollapseV229(innerSummary, event)) return;

  if (event.target.closest?.("[data-tab='adminTab']")) setTimeout(organizeAdminPageV228, 80);
  if (event.target.closest?.("[data-tab='settingsTab']")) setTimeout(organizeSettingsPageV228, 80);
}, true);

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => { if ($("adminTab")?.classList.contains("active")) organizeAdminPageV228(); }, 500);
  setTimeout(() => { if ($("settingsTab")?.classList.contains("active")) organizeSettingsPageV228(); }, 500);
});


// v241 — Ligação Users ↔ Jogadores + apostas da Fase Final por playerId.
// Users/Auth = contas/permissões. Players/Jogadores = identidade oficial de apostas/pontuação.

function playersCatalogV241() {
  const byId = new Map();

  function addPlayer(player, source = "auto") {
    if (!player) return;
    const name = String(player.name || player.playerName || player.nome || "").trim();
    const id = String(player.id || player.playerId || (name ? playerIdFromName(name) : "")).trim();
    if (!name || !id) return;

    const existing = byId.get(id) || {};
    byId.set(id, {
      ...existing,
      ...player,
      id,
      playerId: id,
      name,
      playerName: name,
      normalizedName: normalizeComparable(name),
      email: normalizeEmail(player.email || player.linkedEmail || existing.email || ""),
      linkedEmail: normalizeEmail(player.linkedEmail || player.email || existing.linkedEmail || ""),
      linkedUid: player.linkedUid || existing.linkedUid || "",
      active: player.active !== false,
      source: existing.source || player.source || source
    });
  }

  (appSettings.players || []).forEach(player => addPlayer(player, "settings"));
  (appSettings.users || []).forEach(name => addPlayer({ id: playerIdFromName(name), name, source: "manual" }, "manual"));

  (bets || []).forEach(bet => {
    const name = String(bet.playerName || bet.name || "").trim();
    if (!name) return;
    addPlayer({ id: bet.playerId || playerIdFromName(name), name, source: bet.source || "bets" }, "bets");
  });

  Object.keys(appSettings.extraPredictions || {}).forEach(name => addPlayer({ id: playerIdFromName(name), name, source: "extras" }, "extras"));
  Object.keys(appSettings.importedPoints || {}).forEach(name => addPlayer({ id: playerIdFromName(name), name, source: "pontos" }, "pontos"));

  (permissionsCache || []).forEach(profile => {
    const linkedPlayerId = profile.linkedPlayerId || "";
    if (!linkedPlayerId) return;
    const email = normalizeEmail(profile.email || profile.id);
    const name = String(profile.linkedPlayerName || profile.name || displayNameFromEmail(email) || "").trim();
    const existing = byId.get(linkedPlayerId);
    addPlayer({
      id: linkedPlayerId,
      name: existing?.name || name,
      linkedEmail: email,
      linkedUid: profile.uid || existing?.linkedUid || "",
      source: existing?.source || "linked"
    }, "linked");
  });

  const players = [...byId.values()].filter(player => player.active !== false).sort((a, b) => a.name.localeCompare(b.name, "pt"));

  appSettings.players = players.map(player => ({
    id: player.id,
    playerId: player.id,
    name: player.name,
    normalizedName: player.normalizedName,
    email: player.email || "",
    linkedEmail: player.linkedEmail || "",
    linkedUid: player.linkedUid || "",
    active: player.active !== false,
    source: player.source || "auto"
  }));

  return players;
}

function playerByIdV241(playerId) {
  return playersCatalogV241().find(player => player.id === playerId || player.playerId === playerId) || null;
}

function findSuggestedPlayerForUserV241(profile) {
  const email = normalizeEmail(profile?.email || profile?.id);
  const name = String(profile?.name || displayNameFromEmail(email) || "").trim();
  const normalizedName = normalizeComparable(name);
  const players = playersCatalogV241();

  const byLinkedEmail = players.find(player => normalizeEmail(player.linkedEmail || player.email) === email);
  if (byLinkedEmail) return byLinkedEmail;

  const byName = players.find(player => normalizeComparable(player.name) === normalizedName);
  if (byName) return byName;

  return players.find(player => {
    const n = normalizeComparable(player.name);
    return n && normalizedName && (n.includes(normalizedName) || normalizedName.includes(n));
  }) || null;
}

function linkedPlayerForProfileV241(profile = currentProfile) {
  if (!profile) return null;
  const direct = profile.linkedPlayerId ? playerByIdV241(profile.linkedPlayerId) : null;
  if (direct) return direct;
  const email = normalizeEmail(profile.email || profile.id);
  return playersCatalogV241().find(player => normalizeEmail(player.linkedEmail || player.email) === email) || null;
}

function linkedPlayerForCurrentUserV241() {
  return linkedPlayerForProfileV241(currentProfile);
}

function playerLinkStatusV241(profile) {
  const linked = linkedPlayerForProfileV241(profile);
  if (linked) return { key: "linked", label: "Ligado", player: linked };
  const suggestion = findSuggestedPlayerForUserV241(profile);
  if (suggestion) return { key: "suggestion", label: "Sugestão encontrada", player: suggestion };
  return { key: "missing", label: "Por ligar", player: null };
}

function playerOptionsHtmlV241(selectedId = "", includeEmpty = true) {
  return `
    ${includeEmpty ? `<option value="">— Por ligar —</option>` : ""}
    ${playersCatalogV241().map(player => `
      <option value="${escapeHtml(player.id)}" ${player.id === selectedId ? "selected" : ""}>
        ${escapeHtml(player.name)}
      </option>
    `).join("")}
  `;
}

function renderPlayerLinkBadgeV241(profile) {
  const status = playerLinkStatusV241(profile);
  return `<span class="player-link-badge-v241 player-link-${escapeHtml(status.key)}">${escapeHtml(status.label)}${status.player ? ` · ${escapeHtml(status.player.name)}` : ""}</span>`;
}

function currentUserCanBetKnockoutV241() {
  return Boolean(currentUser && currentProfile?.active !== false && hasPermission("knockout"));
}

function knockoutMatchStartMillisV241(match) {
  const raw = match?.matchDate || match?.date || match?.kickoff || match?.startAt || match?.time || "";
  if (!raw) return 0;
  const date = parsePortugalDate(raw);
  const time = date?.getTime?.() || 0;
  return Number.isFinite(time) ? time : 0;
}

function isKnockoutBetLockedV241(match) {
  if (!match) return true;
  if (!match.homeTeam || !match.awayTeam) return true;
  if (knockoutMatchHasResult(match)) return true;
  const start = knockoutMatchStartMillisV241(match);
  return Boolean(start && Date.now() >= start);
}

function knockoutBetForPlayerMatchV241(playerId, matchId) {
  return (bets || []).find(bet => bet.playerId === playerId && bet.gameId === matchId) || null;
}

function knockoutBetButtonLabelV241(match) {
  const player = linkedPlayerForCurrentUserV241();
  if (!player) return "Ligar jogador";
  const existing = knockoutBetForPlayerMatchV241(player.id, match.id);
  if (isKnockoutBetLockedV241(match)) return existing ? "Ver aposta" : "Bloqueado";
  return existing ? "Editar aposta" : "Apostar";
}

function ensureKnockoutBetModalV241() {
  let modal = $("knockoutBetModalV241");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "knockoutBetModalV241";
  modal.className = "modal hidden knockout-bet-modal-v241";
  modal.innerHTML = `
    <div class="modal-card knockout-bet-card-v241">
      <div class="modal-head">
        <div>
          <h2 id="knockoutBetTitleV241">Aposta da Fase Final</h2>
          <p id="knockoutBetSubtitleV241">Escolhe o resultado antes do jogo começar.</p>
        </div>
        <button id="closeKnockoutBetModalV241" class="icon-button" type="button" aria-label="Fechar">×</button>
      </div>
      <div id="knockoutBetBodyV241" class="knockout-bet-body-v241"></div>
      <div class="modal-actions">
        <button id="deleteKnockoutBetV241" class="secondary danger-soft-v241" type="button">Apagar aposta</button>
        <button id="saveKnockoutBetV241" class="primary" type="button">Guardar aposta</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  $("closeKnockoutBetModalV241")?.addEventListener("click", closeKnockoutBetModalV241);
  modal.addEventListener("click", event => {
    if (event.target === modal) closeKnockoutBetModalV241();
  });
  $("saveKnockoutBetV241")?.addEventListener("click", saveKnockoutBetFromModalV241);
  $("deleteKnockoutBetV241")?.addEventListener("click", deleteKnockoutBetFromModalV241);
  return modal;
}

let activeKnockoutBetMatchIdV241 = "";

function openKnockoutBetModalV241(matchId) {
  ensureKnockoutSettings();
  const match = knockoutMatchById(matchId);
  const modal = ensureKnockoutBetModalV241();
  const body = $("knockoutBetBodyV241");
  const saveBtn = $("saveKnockoutBetV241");
  const deleteBtn = $("deleteKnockoutBetV241");
  activeKnockoutBetMatchIdV241 = matchId;

  if (!match || !body) return;

  const player = linkedPlayerForCurrentUserV241();
  const locked = isKnockoutBetLockedV241(match);
  const existing = player ? knockoutBetForPlayerMatchV241(player.id, match.id) : null;
  const score = existing ? knockoutBetScorePair(existing) : null;
  const pens = existing ? knockoutBetPenaltyPair(existing) : null;

  $("knockoutBetTitleV241").textContent = `${match.homeTeam || "Equipa"} vs ${match.awayTeam || "Equipa"}`;
  $("knockoutBetSubtitleV241").textContent = player ? `Aposta ligada ao jogador: ${player.name}` : "A tua conta ainda não está ligada a nenhum jogador.";

  if (!player) {
    body.innerHTML = `<div class="knockout-bet-warning-v241"><strong>Conta sem jogador ligado</strong><span>Para apostar na Fase Final, o Admin tem de ligar o teu user ao jogador correto.</span></div>`;
    if (saveBtn) saveBtn.disabled = true;
    if (deleteBtn) deleteBtn.disabled = true;
    modal.classList.remove("hidden");
    return;
  }

  const lockedText = locked
    ? knockoutMatchHasResult(match)
      ? "Este jogo já tem resultado final. A aposta está bloqueada."
      : "Este jogo já começou ou ainda não está disponível. A aposta está bloqueada."
    : "Ainda podes guardar/alterar a aposta.";

  body.innerHTML = `
    <div class="knockout-bet-player-v241"><span>Jogador</span><strong>${escapeHtml(player.name)}</strong></div>
    <div class="knockout-bet-match-v241">
      <div><span>${escapeHtml(match.homeTeam || "A definir")}</span><input id="knockoutBetHomeV241" type="number" min="0" inputmode="numeric" value="${score ? score.home : ""}" ${locked ? "disabled" : ""} /></div>
      <b>VS</b>
      <div><span>${escapeHtml(match.awayTeam || "A definir")}</span><input id="knockoutBetAwayV241" type="number" min="0" inputmode="numeric" value="${score ? score.away : ""}" ${locked ? "disabled" : ""} /></div>
    </div>
    <details class="knockout-bet-penalties-v241" ${pens ? "open" : ""}>
      <summary>Penáltis, se apostares empate</summary>
      <div class="knockout-bet-match-v241 penalties">
        <div><span>${escapeHtml(match.homeTeam || "Casa")}</span><input id="knockoutBetHomePensV241" type="number" min="0" inputmode="numeric" value="${pens ? pens.home : ""}" ${locked ? "disabled" : ""} /></div>
        <b>Pen.</b>
        <div><span>${escapeHtml(match.awayTeam || "Fora")}</span><input id="knockoutBetAwayPensV241" type="number" min="0" inputmode="numeric" value="${pens ? pens.away : ""}" ${locked ? "disabled" : ""} /></div>
      </div>
    </details>
    <div class="knockout-bet-status-v241 ${locked ? "locked" : "open"}">${escapeHtml(lockedText)}</div>
  `;

  if (saveBtn) saveBtn.disabled = locked;
  if (deleteBtn) deleteBtn.disabled = locked || !existing;
  modal.classList.remove("hidden");
}

function closeKnockoutBetModalV241() {
  $("knockoutBetModalV241")?.classList.add("hidden");
  activeKnockoutBetMatchIdV241 = "";
}

async function saveKnockoutBetFromModalV241() {
  const match = knockoutMatchById(activeKnockoutBetMatchIdV241);
  const player = linkedPlayerForCurrentUserV241();
  if (!match || !player) return toast("A tua conta ainda não está ligada a um jogador.");
  if (isKnockoutBetLockedV241(match)) return toast("Aposta bloqueada para este jogo.");

  const home = Number($("knockoutBetHomeV241")?.value);
  const away = Number($("knockoutBetAwayV241")?.value);
  if (!Number.isFinite(home) || !Number.isFinite(away) || home < 0 || away < 0) return toast("Preenche o resultado da aposta.");

  const hpRaw = $("knockoutBetHomePensV241")?.value;
  const apRaw = $("knockoutBetAwayPensV241")?.value;
  const homePens = hpRaw === "" || hpRaw === undefined ? null : Number(hpRaw);
  const awayPens = apRaw === "" || apRaw === undefined ? null : Number(apRaw);

  if (home === away && (homePens === null || awayPens === null || !Number.isFinite(homePens) || !Number.isFinite(awayPens) || homePens === awayPens)) {
    return toast("Se apostas empate, indica penáltis e um vencedor.");
  }

  const winner = home > away ? match.homeTeam : away > home ? match.awayTeam : homePens > awayPens ? match.homeTeam : match.awayTeam;

  await persistBet({
    id: `${activeKnockoutBetMatchIdV241}_${player.id}`,
    gameId: activeKnockoutBetMatchIdV241,
    playerId: player.id,
    playerName: player.name,
    uid: currentUser?.uid || "",
    email: normalizeEmail(currentUser?.email || ""),
    source: "FaseFinalUser",
    type: "knockout",
    homeGuess: home,
    awayGuess: away,
    homePenalties: homePens,
    awayPenalties: awayPens,
    winner,
    updatedAt: new Date().toISOString()
  });

  addSystemLog("Aposta Fase Final", `${player.name} guardou aposta em ${match.homeTeam} vs ${match.awayTeam}.`, { matchId: match.id, playerId: player.id }, { sync: true });
  closeKnockoutBetModalV241();
  renderKnockout();
  renderScore();
  toast("Aposta guardada.");
}

async function deleteKnockoutBetFromModalV241() {
  const match = knockoutMatchById(activeKnockoutBetMatchIdV241);
  const player = linkedPlayerForCurrentUserV241();
  if (!match || !player) return;
  if (isKnockoutBetLockedV241(match)) return toast("Aposta bloqueada para este jogo.");
  const existing = knockoutBetForPlayerMatchV241(player.id, match.id);
  if (!existing) return closeKnockoutBetModalV241();

  bets = bets.filter(bet => !(bet.gameId === match.id && bet.playerId === player.id));
  markBetsForDelete([existing.id]);
  saveLocalData("apagar aposta fase final");
  scheduleFullSync("apagar aposta fase final", 300);
  closeKnockoutBetModalV241();
  renderKnockout();
  renderScore();
  toast("Aposta apagada.");
}

function addKnockoutBetButtonsV241() {
  const container = $("knockoutBracket");
  if (!container || !knockoutAvailable()) return;

  container.querySelectorAll("[data-ko-admin]").forEach(card => {
    const matchId = card.dataset.koAdmin;
    const match = knockoutMatchById(matchId);
    if (!match || !match.homeTeam || !match.awayTeam) return;
    if (card.querySelector("[data-ko-user-bet-v241]")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ko-user-bet-btn-v241";
    btn.dataset.koUserBetV241 = matchId;
    btn.textContent = knockoutBetButtonLabelV241(match);
    btn.disabled = !currentUserCanBetKnockoutV241() || (!linkedPlayerForCurrentUserV241() && !hasPermission("managePermissions"));
    card.appendChild(btn);
  });
}

const renderKnockoutOriginalV241 = typeof renderKnockout === "function" ? renderKnockout : null;
if (renderKnockoutOriginalV241 && !window.__renderKnockoutBetsV241) {
  window.__renderKnockoutBetsV241 = true;
  renderKnockout = function renderKnockoutWithBetsV241() {
    const result = renderKnockoutOriginalV241.apply(this, arguments);
    setTimeout(addKnockoutBetButtonsV241, 0);
    setTimeout(addKnockoutBetButtonsV241, 200);
    return result;
  };
}

document.addEventListener("click", event => {
  const betBtn = event.target.closest?.("[data-ko-user-bet-v241]");
  if (!betBtn) return;
  event.preventDefault();
  event.stopPropagation();
  openKnockoutBetModalV241(betBtn.dataset.koUserBetV241);
}, true);

const renderPermissionsUsersOriginalV241 = typeof renderPermissionsUsers === "function" ? renderPermissionsUsers : null;
if (renderPermissionsUsersOriginalV241 && !window.__renderPermissionsPlayerLinkV241) {
  window.__renderPermissionsPlayerLinkV241 = true;
  renderPermissionsUsers = function renderPermissionsUsersPlayerLinkV241() {
    const list = $("permissionsUsersList");
    if (!list) return;

    if (!hasPermission("managePermissions")) {
      list.innerHTML = `<div class="empty small-empty">Não tens permissão para gerir utilizadores.</div>`;
      return;
    }

    playersCatalogV241();

    if (!permissionsCache.length) {
      list.innerHTML = `<div class="empty small-empty">Ainda não existem utilizadores registados.</div>`;
      return;
    }

    const missing = permissionsCache.filter(user => !linkedPlayerForProfileV241(user)).length;
    const linked = permissionsCache.length - missing;

    const labels = {
      calendar: "Ver Calendário",
      score: "Ver Pontuação",
      knockout: "Ver Fase Final",
      notifications: "Ver Notificações",
      logs: "Ver Logs",
      settings: "Ver Configurações",
      adminTab: "Ver Admin",
      admin: "Poder Admin",
      editResults: "Editar resultados",
      importExcel: "Importar Excel",
      editUsers: "Users do jogo",
      editPoints: "Sistema pontos",
      editKnockout: "Editar Fase Final",
      managePermissions: "Permissões"
    };

    list.innerHTML = `
      <section class="player-link-summary-v241">
        <div>
          <strong>Ligação Users ↔ Jogadores</strong>
          <span>${linked} ligado(s) · ${missing} por ligar · ${playersCatalogV241().length} jogador(es) na liga</span>
        </div>
        <button class="secondary small" type="button" data-auto-link-players-v241>Auto ligar sugestões</button>
      </section>
      ${permissionsCache.map(user => {
        const email = normalizeEmail(user.email || user.id);
        const visibleName = String(user.name || "").trim() || displayNameFromEmail(email);
        const role = normalizeRole(user.role);
        const isOwnerUser = role === "owner";
        const perms = { ...permissionsForRole(role), ...(user.permissions || {}) };
        const active = user.active !== false;
        const status = playerLinkStatusV241(user);

        return `
          <article class="permission-user-card player-link-card-v241" data-permission-card="${escapeHtml(email)}">
            <div class="permission-user-head">
              <div>
                <strong>${escapeHtml(visibleName)}</strong>
                <span>${escapeHtml(email)} · ${roleLabel(role)} · ${active ? "Ativo" : "Bloqueado"}</span>
                ${renderPlayerLinkBadgeV241(user)}
              </div>
              <div class="permission-user-actions">
                <label class="permission-name-label">
                  Nome visível
                  <input class="permission-name-input" type="text" data-name-email="${escapeHtml(email)}" value="${escapeHtml(visibleName)}" placeholder="Nome visível" />
                </label>
                <label class="permission-player-label-v241">
                  Jogador ligado
                  <select data-linked-player-email-v241="${escapeHtml(email)}">
                    ${playerOptionsHtmlV241(user.linkedPlayerId || "", true)}
                  </select>
                </label>
                <select data-role-email="${escapeHtml(email)}">
                  <option value="user" ${role === "user" ? "selected" : ""}>User normal</option>
                  <option value="admin" ${role === "admin" ? "selected" : ""}>Admin</option>
                  <option value="owner" ${role === "owner" ? "selected" : ""}>Dono</option>
                </select>
                <label class="perm-active">
                  <input type="checkbox" data-active-email="${escapeHtml(email)}" ${active ? "checked" : ""} />
                  Ativo
                </label>
                <button class="primary small" type="button" data-save-permissions="${escapeHtml(email)}">Guardar</button>
              </div>
            </div>
            ${status.key === "suggestion" && !user.linkedPlayerId ? `
              <div class="player-link-suggestion-v241">
                Sugestão: <strong>${escapeHtml(status.player.name)}</strong>
                <button class="secondary small" type="button" data-confirm-player-link-v241="${escapeHtml(email)}" data-player-id="${escapeHtml(status.player.id)}">Confirmar ligação</button>
              </div>
            ` : ""}
            <div class="permission-grid">
              ${Object.entries(labels).map(([key, label]) => renderPermissionCheckbox(email, key, label, perms[key], isOwnerUser)).join("")}
            </div>
          </article>
        `;
      }).join("")}
    `;
  };
}

const savePermissionUserOriginalV241 = typeof savePermissionUser === "function" ? savePermissionUser : null;
if (savePermissionUserOriginalV241 && !window.__savePermissionPlayerLinkV241) {
  window.__savePermissionPlayerLinkV241 = true;
  savePermissionUser = async function savePermissionUserPlayerLinkV241(email) {
    if (!db || !firebaseApi) return toast("Firebase não está ligado.");
    if (!hasPermission("managePermissions")) return toast("Sem permissão para gerir utilizadores.");

    const normalized = normalizeEmail(email);
    const card = document.querySelector(`[data-permission-card="${CSS.escape(normalized)}"]`);
    const existingProfile = permissionsCache.find(user => normalizeEmail(user.email || user.id) === normalized) || {};

    const role = normalizeRole(document.querySelector(`[data-role-email="${CSS.escape(normalized)}"]`)?.value || "user");
    const activeInput = document.querySelector(`[data-active-email="${CSS.escape(normalized)}"]`);
    const active = activeInput ? activeInput.checked : true;
    const isOwnerUser = role === "owner";

    const nameInput = document.querySelector(`[data-name-email="${CSS.escape(normalized)}"]`);
    const visibleName = String(nameInput?.value || existingProfile.name || displayNameFromEmail(normalized)).trim() || displayNameFromEmail(normalized);

    const linkedSelect = document.querySelector(`[data-linked-player-email-v241="${CSS.escape(normalized)}"]`);
    const linkedPlayerId = linkedSelect ? linkedSelect.value : existingProfile.linkedPlayerId || "";
    const linkedPlayer = linkedPlayerId ? playerByIdV241(linkedPlayerId) : null;

    const permissions = permissionsForRole(role);
    if (card && !isOwnerUser) {
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
      linkedPlayerId,
      linkedPlayerName: linkedPlayer?.name || "",
      updatedAt: new Date().toISOString()
    };
    if (!profile.createdAt) profile.createdAt = new Date().toISOString();

    playersCatalogV241();
    appSettings.players = (appSettings.players || []).map(player => {
      if (linkedPlayerId && player.id === linkedPlayerId) {
        return { ...player, linkedEmail: normalized, linkedUid: profile.uid || player.linkedUid || "", email: player.email || "" };
      }
      if (player.linkedEmail && normalizeEmail(player.linkedEmail) === normalized && player.id !== linkedPlayerId) {
        return { ...player, linkedEmail: "", linkedUid: "" };
      }
      return player;
    });

    const { doc, setDoc } = firebaseApi;
    await withTimeout(setDoc(doc(db, "users", normalized), profile, { merge: true }), 12000, "guardar utilizador");

    markSettingsPending();
    saveLocalData("guardar ligação user jogador");
    scheduleFullSync("guardar ligação user jogador", 300);

    addSystemLog("Utilizador guardado", `${visibleName} (${normalized}) ficou ligado a ${linkedPlayer?.name || "nenhum jogador"}.`, {
      email: normalized,
      linkedPlayerId,
      linkedPlayerName: linkedPlayer?.name || "",
      role,
      active
    }, { sync: true });

    toast("Utilizador guardado.");
    await loadPermissionsUsers();
    renderPermissionsUsers();

    if (normalizeEmail(currentUser?.email) === normalized) {
      currentProfile = await readUserProfile(currentUser);
      currentProfile.linkedPlayerId = linkedPlayerId;
      currentProfile.linkedPlayerName = linkedPlayer?.name || "";
      updateSessionBox();
      applyPermissionsToUi();
    }
  };
}

async function confirmPlayerLinkV241(email, playerId) {
  const select = document.querySelector(`[data-linked-player-email-v241="${CSS.escape(normalizeEmail(email))}"]`);
  if (select) select.value = playerId;
  await savePermissionUser(email);
}

async function autoLinkPlayerSuggestionsV241() {
  if (!hasPermission("managePermissions")) return toast("Sem permissão.");
  let count = 0;

  for (const profile of permissionsCache) {
    if (profile.linkedPlayerId) continue;
    const suggestion = findSuggestedPlayerForUserV241(profile);
    if (!suggestion) continue;
    const email = normalizeEmail(profile.email || profile.id);
    const select = document.querySelector(`[data-linked-player-email-v241="${CSS.escape(email)}"]`);
    if (select) {
      select.value = suggestion.id;
      count += 1;
    }
  }

  toast(count ? `${count} sugestão(ões) pronta(s). Carrega Guardar em cada user.` : "Não encontrei sugestões novas.");
}

document.addEventListener("click", event => {
  const confirmBtn = event.target.closest?.("[data-confirm-player-link-v241]");
  if (confirmBtn) {
    event.preventDefault();
    confirmPlayerLinkV241(confirmBtn.dataset.confirmPlayerLinkV241, confirmBtn.dataset.playerId);
    return;
  }

  const autoBtn = event.target.closest?.("[data-auto-link-players-v241]");
  if (autoBtn) {
    event.preventDefault();
    autoLinkPlayerSuggestionsV241();
  }
}, true);

const readUserProfileOriginalV241 = typeof readUserProfile === "function" ? readUserProfile : null;
if (readUserProfileOriginalV241 && !window.__readProfilePlayerLinkV241) {
  window.__readProfilePlayerLinkV241 = true;
  readUserProfile = async function readUserProfileWithPlayerV241(user) {
    const profile = await readUserProfileOriginalV241(user);
    try {
      const linked = linkedPlayerForProfileV241(profile) || findSuggestedPlayerForUserV241(profile);
      if (linked && !profile.linkedPlayerId && normalizeEmail(linked.linkedEmail || linked.email) === normalizeEmail(profile.email)) {
        profile.linkedPlayerId = linked.id;
        profile.linkedPlayerName = linked.name;
      }
    } catch (error) {
      console.warn("Ligação jogador no perfil falhou:", error);
    }
    return profile;
  };
}

const updateSessionBoxOriginalV241 = typeof updateSessionBox === "function" ? updateSessionBox : null;
if (updateSessionBoxOriginalV241 && !window.__sessionPlayerLinkV241) {
  window.__sessionPlayerLinkV241 = true;
  updateSessionBox = function updateSessionBoxPlayerLinkV241() {
    updateSessionBoxOriginalV241();
    const label = $("sessionUserLabel");
    if (!label || !currentUser) return;

    const player = linkedPlayerForCurrentUserV241();
    $("sessionPlayerLinkV241")?.remove();

    const chip = document.createElement("small");
    chip.id = "sessionPlayerLinkV241";
    chip.className = `session-player-link-v241 ${player ? "linked" : "missing"}`;
    chip.textContent = player ? `Jogador: ${player.name}` : "Jogador por ligar";
    label.parentElement?.appendChild(chip);
  };
}

const renderAllOriginalV241 = typeof renderAll === "function" ? renderAll : null;
if (renderAllOriginalV241 && !window.__renderAllPlayersV241) {
  window.__renderAllPlayersV241 = true;
  renderAll = function renderAllPlayersV241() {
    try { playersCatalogV241(); } catch (error) { console.warn("Catálogo players falhou:", error); }
    const result = renderAllOriginalV241.apply(this, arguments);
    setTimeout(addKnockoutBetButtonsV241, 0);
    return result;
  };
}

// v243 — Modal automático da Fase Final, data/hora do jogo e bloqueio 5 min antes.
const KNOCKOUT_BET_LOCK_MINUTES_V243 = 5;
const KNOCKOUT_AUTO_DISMISSED_KEY_V243 = `${STORAGE_KEY}_ko_auto_dismissed_v243`;
let knockoutAutoModalOpeningV243 = false;
let knockoutAutoModalMatchIdV243 = "";
let knockoutAutoModalTimerV243 = null;

function knockoutMatchDateInputValueV243(match) {
  const raw = String(match?.matchDate || match?.date || match?.kickoff || match?.startAt || match?.time || "").trim();
  if (!raw) return "";
  const direct = raw.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  if (direct) return direct[1];
  const date = parsePortugalDate(raw);
  if (!date || Number.isNaN(date.getTime())) return "";
  const pad = value => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizeKnockoutMatchDateV243(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const direct = raw.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  if (direct) return direct[1];
  return knockoutMatchDateInputValueV243({ matchDate: raw });
}

knockoutMatchStartMillisV241 = function knockoutMatchStartMillisV243(match) {
  const normalized = knockoutMatchDateInputValueV243(match);
  if (!normalized) return 0;
  const date = parsePortugalDate(normalized);
  const time = date?.getTime?.() || 0;
  return Number.isFinite(time) ? time : 0;
};

function knockoutBetLockMillisV243(match) {
  const start = knockoutMatchStartMillisV241(match);
  return start ? start - (KNOCKOUT_BET_LOCK_MINUTES_V243 * 60 * 1000) : 0;
}

function knockoutBetDeadlineLabelV243(match) {
  const deadline = knockoutBetLockMillisV243(match);
  if (!deadline) return "Data/hora por definir";
  return dateTimePortugal(new Date(deadline));
}

isKnockoutBetLockedV241 = function isKnockoutBetLockedV243(match) {
  if (!match) return true;
  if (!match.homeTeam || !match.awayTeam) return true;
  if (knockoutMatchHasResult(match)) return true;
  const deadline = knockoutBetLockMillisV243(match);
  if (!deadline) return true;
  return Date.now() >= deadline;
};

knockoutBetForPlayerMatchV241 = function knockoutBetForPlayerMatchV243(playerId, matchId) {
  return (bets || []).find(bet => String(bet.playerId || "") === String(playerId || "") && String(bet.gameId || "") === String(matchId || "")) || null;
};

knockoutBetButtonLabelV241 = function knockoutBetButtonLabelV243(match) {
  const player = linkedPlayerForCurrentUserV241();
  if (!player) return "Ligar jogador";
  const existing = knockoutBetForPlayerMatchV241(player.id, match.id);
  if (!knockoutMatchStartMillisV241(match)) return existing ? "Ver aposta" : "Sem data/hora";
  if (isKnockoutBetLockedV241(match)) return existing ? "Ver aposta" : "Fora do jogo";
  return existing ? "Editar aposta" : "Apostar";
};

function knockoutQualifiedTeamFromBetV243(bet, match) {
  if (!bet || !match) return "";
  const direct = bet.qualifiedTeam || bet.winner || bet.winnerTeam || bet.predictedWinner || bet.teamWinner || "";
  if (direct) {
    const normalized = normalizeComparable(direct);
    if (normalized === normalizeComparable(match.homeTeam)) return match.homeTeam;
    if (normalized === normalizeComparable(match.awayTeam)) return match.awayTeam;
    return direct;
  }
  return knockoutBetWinnerName(bet, match);
}

function winnerOptionsHtmlV243(match, selected = "") {
  const teams = [match?.homeTeam || "", match?.awayTeam || ""].filter(Boolean);
  return `<option value="">Escolher equipa qualificada</option>${teams.map(team => `<option value="${escapeHtml(team)}" ${normalizeComparable(team) === normalizeComparable(selected) ? "selected" : ""}>${escapeHtml(team)}</option>`).join("")}`;
}

closeKnockoutBetModalV241 = function closeKnockoutBetModalV243() {
  if (knockoutAutoModalMatchIdV243) {
    try {
      const dismissed = JSON.parse(sessionStorage.getItem(KNOCKOUT_AUTO_DISMISSED_KEY_V243) || "[]");
      sessionStorage.setItem(KNOCKOUT_AUTO_DISMISSED_KEY_V243, JSON.stringify([...new Set([...(Array.isArray(dismissed) ? dismissed : []), knockoutAutoModalMatchIdV243])].filter(Boolean)));
    } catch {
      sessionStorage.setItem(KNOCKOUT_AUTO_DISMISSED_KEY_V243, JSON.stringify([knockoutAutoModalMatchIdV243]));
    }
  }
  $("knockoutBetModalV241")?.classList.add("hidden");
  activeKnockoutBetMatchIdV241 = "";
  knockoutAutoModalMatchIdV243 = "";
};

openKnockoutBetModalV241 = function openKnockoutBetModalV243(matchId, options = {}) {
  ensureKnockoutSettings();
  const match = knockoutMatchById(matchId);
  const modal = ensureKnockoutBetModalV241();
  const body = $("knockoutBetBodyV241");
  const saveBtn = $("saveKnockoutBetV241");
  const deleteBtn = $("deleteKnockoutBetV241");
  activeKnockoutBetMatchIdV241 = matchId;
  knockoutAutoModalMatchIdV243 = options.auto ? matchId : "";

  if (!match || !body) return;

  const player = linkedPlayerForCurrentUserV241();
  const locked = isKnockoutBetLockedV241(match);
  const hasDate = Boolean(knockoutMatchStartMillisV241(match));
  const existing = player ? knockoutBetForPlayerMatchV241(player.id, match.id) : null;
  const score = existing ? knockoutBetScorePair(existing) : null;
  const pens = existing ? knockoutBetPenaltyPair(existing) : null;
  const qualified = existing ? knockoutQualifiedTeamFromBetV243(existing, match) : "";

  $("knockoutBetTitleV241").textContent = `${match.homeTeam || "Equipa"} vs ${match.awayTeam || "Equipa"}`;
  $("knockoutBetSubtitleV241").textContent = player
    ? `Aposta ligada ao jogador: ${player.name}`
    : "A tua conta ainda não está ligada a nenhum jogador.";

  if (!player) {
    body.innerHTML = `<div class="knockout-bet-warning-v241"><strong>Conta sem jogador ligado</strong><span>Para apostar na Fase Final, o Admin tem de ligar o teu user ao jogador correto.</span></div>`;
    if (saveBtn) saveBtn.disabled = true;
    if (deleteBtn) deleteBtn.disabled = true;
    modal.classList.remove("hidden");
    return;
  }

  const deadlineText = knockoutBetDeadlineLabelV243(match);
  const lockedText = !hasDate
    ? "O Admin ainda não definiu a data/hora deste jogo. A aposta ainda não está aberta."
    : locked
      ? knockoutMatchHasResult(match)
        ? "Este jogo já tem resultado final. A aposta está bloqueada."
        : `O prazo terminou. Quem não apostou até ${deadlineText} fica fora deste jogo.`
      : `Podes apostar até ${deadlineText} (5 minutos antes do início).`;

  body.innerHTML = `
    ${options.auto ? `<div class="knockout-bet-auto-v243"><strong>Nova aposta da Fase Final</strong><span>Este jogo já tem equipas e data/hora. Faz a tua aposta antes do prazo.</span></div>` : ""}
    <div class="knockout-bet-player-v241"><span>Jogador</span><strong>${escapeHtml(player.name)}</strong></div>
    <div class="knockout-bet-deadline-v243"><span>Prazo limite</span><strong>${escapeHtml(deadlineText)}</strong></div>
    <div class="knockout-bet-match-v241">
      <div><span>${escapeHtml(match.homeTeam || "A definir")}</span><input id="knockoutBetHomeV241" type="number" min="0" inputmode="numeric" value="${score ? score.home : ""}" ${locked ? "disabled" : ""} /></div>
      <b>VS</b>
      <div><span>${escapeHtml(match.awayTeam || "A definir")}</span><input id="knockoutBetAwayV241" type="number" min="0" inputmode="numeric" value="${score ? score.away : ""}" ${locked ? "disabled" : ""} /></div>
    </div>
    <label class="knockout-bet-qualified-v243">Equipa que se qualifica
      <select id="knockoutBetWinnerV243" ${locked ? "disabled" : ""}>
        ${winnerOptionsHtmlV243(match, qualified)}
      </select>
    </label>
    <details class="knockout-bet-penalties-v241" ${pens ? "open" : ""}>
      <summary>Penáltis (opcional, se quiseres deixar mais completo)</summary>
      <div class="knockout-bet-match-v241 penalties">
        <div><span>${escapeHtml(match.homeTeam || "Casa")}</span><input id="knockoutBetHomePensV241" type="number" min="0" inputmode="numeric" value="${pens ? pens.home : ""}" ${locked ? "disabled" : ""} /></div>
        <b>Pen.</b>
        <div><span>${escapeHtml(match.awayTeam || "Fora")}</span><input id="knockoutBetAwayPensV241" type="number" min="0" inputmode="numeric" value="${pens ? pens.away : ""}" ${locked ? "disabled" : ""} /></div>
      </div>
    </details>
    <div class="knockout-bet-status-v241 ${locked ? "locked" : "open"}">${escapeHtml(lockedText)}</div>
  `;

  const homeInput = $("knockoutBetHomeV241");
  const awayInput = $("knockoutBetAwayV241");
  const winnerSelect = $("knockoutBetWinnerV243");
  const syncWinner = () => {
    if (!winnerSelect || winnerSelect.value) return;
    const home = Number(homeInput?.value);
    const away = Number(awayInput?.value);
    if (!Number.isFinite(home) || !Number.isFinite(away)) return;
    if (home > away) winnerSelect.value = match.homeTeam || "";
    if (away > home) winnerSelect.value = match.awayTeam || "";
  };
  homeInput?.addEventListener("input", syncWinner);
  awayInput?.addEventListener("input", syncWinner);

  if (saveBtn) saveBtn.disabled = locked;
  if (deleteBtn) deleteBtn.disabled = locked || !existing;
  modal.classList.remove("hidden");
  setTimeout(() => body.querySelector("input:not(:disabled), select:not(:disabled)")?.focus?.(), 50);
};

saveKnockoutBetFromModalV241 = async function saveKnockoutBetFromModalV243() {
  const match = knockoutMatchById(activeKnockoutBetMatchIdV241);
  const player = linkedPlayerForCurrentUserV241();
  if (!match || !player) return toast("A tua conta ainda não está ligada a um jogador.");
  if (isKnockoutBetLockedV241(match)) return toast("Aposta bloqueada para este jogo.");

  const homeRaw = $("knockoutBetHomeV241")?.value;
  const awayRaw = $("knockoutBetAwayV241")?.value;
  const home = Number(homeRaw);
  const away = Number(awayRaw);
  if (homeRaw === "" || awayRaw === "" || !Number.isFinite(home) || !Number.isFinite(away) || home < 0 || away < 0) return toast("Preenche o resultado da aposta.");

  const winner = $("knockoutBetWinnerV243")?.value || "";
  if (!winner) return toast("Escolhe a equipa que se qualifica.");

  if (home > away && normalizeComparable(winner) !== normalizeComparable(match.homeTeam)) return toast("A equipa qualificada não bate certo com o resultado.");
  if (away > home && normalizeComparable(winner) !== normalizeComparable(match.awayTeam)) return toast("A equipa qualificada não bate certo com o resultado.");

  const hpRaw = $("knockoutBetHomePensV241")?.value;
  const apRaw = $("knockoutBetAwayPensV241")?.value;
  const homePens = hpRaw === "" || hpRaw === undefined ? null : Number(hpRaw);
  const awayPens = apRaw === "" || apRaw === undefined ? null : Number(apRaw);

  if ((hpRaw === "" || hpRaw === undefined) !== (apRaw === "" || apRaw === undefined)) {
    return toast("Preenche os dois campos dos penáltis ou deixa os dois vazios.");
  }
  if (homePens !== null && (!Number.isFinite(homePens) || !Number.isFinite(awayPens) || homePens < 0 || awayPens < 0 || homePens === awayPens)) {
    return toast("Os penáltis têm de ter valores válidos e uma equipa vencedora.");
  }

  await persistBet({
    id: `${activeKnockoutBetMatchIdV241}_${player.id}`,
    gameId: activeKnockoutBetMatchIdV241,
    playerId: player.id,
    playerName: player.name,
    uid: currentUser?.uid || "",
    email: normalizeEmail(currentUser?.email || ""),
    source: "FaseFinalUser",
    type: "knockout",
    homeGuess: home,
    awayGuess: away,
    homePenalties: homePens,
    awayPenalties: awayPens,
    winner,
    qualifiedTeam: winner,
    deadlineAt: new Date(knockoutBetLockMillisV243(match)).toISOString(),
    matchDate: normalizeKnockoutMatchDateV243(match.matchDate),
    updatedAt: new Date().toISOString()
  });

  try {
    const dismissed = JSON.parse(sessionStorage.getItem(KNOCKOUT_AUTO_DISMISSED_KEY_V243) || "[]");
    sessionStorage.setItem(KNOCKOUT_AUTO_DISMISSED_KEY_V243, JSON.stringify((Array.isArray(dismissed) ? dismissed : []).filter(id => id !== activeKnockoutBetMatchIdV241)));
  } catch {}

  addSystemLog("Aposta Fase Final", `${player.name} guardou aposta em ${match.homeTeam} vs ${match.awayTeam}. Qualificado: ${winner}.`, { matchId: match.id, playerId: player.id, winner }, { sync: true });
  closeKnockoutBetModalV241();
  renderKnockout();
  renderScore();
  setTimeout(maybeOpenNextKnockoutBetModalV243, 500);
  toast("Aposta guardada.");
};

function dismissedAutoKnockoutMatchesV243() {
  try {
    const list = JSON.parse(sessionStorage.getItem(KNOCKOUT_AUTO_DISMISSED_KEY_V243) || "[]");
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

function eligibleAutoKnockoutBetMatchesV243() {
  const player = linkedPlayerForCurrentUserV241();
  if (!currentUserCanBetKnockoutV241() || !player || !knockoutAvailable()) return [];
  const dismissed = dismissedAutoKnockoutMatchesV243();
  return knockoutMatches()
    .filter(match => match?.homeTeam && match?.awayTeam)
    .filter(match => knockoutMatchStartMillisV241(match) > 0)
    .filter(match => !knockoutMatchHasResult(match))
    .filter(match => !isKnockoutBetLockedV241(match))
    .filter(match => !knockoutBetForPlayerMatchV241(player.id, match.id))
    .filter(match => !dismissed.has(match.id))
    .sort((a, b) => knockoutMatchStartMillisV241(a) - knockoutMatchStartMillisV241(b));
}

function maybeOpenNextKnockoutBetModalV243() {
  clearTimeout(knockoutAutoModalTimerV243);
  knockoutAutoModalTimerV243 = null;
  if (knockoutAutoModalOpeningV243) return;
  if (document.hidden) return;
  if ($("knockoutBetModalV241") && !$("knockoutBetModalV241").classList.contains("hidden")) return;

  const next = eligibleAutoKnockoutBetMatchesV243()[0];
  if (!next) return;

  knockoutAutoModalOpeningV243 = true;
  try {
    openKnockoutBetModalV241(next.id, { auto: true });
  } finally {
    knockoutAutoModalOpeningV243 = false;
  }
}

function scheduleKnockoutAutoBetCheckV243(delay = 700) {
  clearTimeout(knockoutAutoModalTimerV243);
  knockoutAutoModalTimerV243 = setTimeout(maybeOpenNextKnockoutBetModalV243, delay);
}

const renderAllOriginalV243 = typeof renderAll === "function" ? renderAll : null;
if (renderAllOriginalV243 && !window.__knockoutAutoBetV243) {
  window.__knockoutAutoBetV243 = true;
  renderAll = function renderAllWithKnockoutAutoBetV243() {
    const result = renderAllOriginalV243.apply(this, arguments);
    scheduleKnockoutAutoBetCheckV243(900);
    return result;
  };
}

const renderKnockoutOriginalV243 = typeof renderKnockout === "function" ? renderKnockout : null;
if (renderKnockoutOriginalV243 && !window.__renderKnockoutDateV243) {
  window.__renderKnockoutDateV243 = true;
  renderKnockout = function renderKnockoutWithAutoBetCheckV243() {
    const result = renderKnockoutOriginalV243.apply(this, arguments);
    scheduleKnockoutAutoBetCheckV243(900);
    return result;
  };
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) scheduleKnockoutAutoBetCheckV243(600);
});
document.addEventListener("DOMContentLoaded", () => scheduleKnockoutAutoBetCheckV243(1500));

// v244 — Correção do modal automático da Fase Final.
// Abre a aposta para users ligados a jogador assim que o Admin guardar equipas + data/hora,
// sem depender de o user estar na página da Fase Final ou de a fase estar desbloqueada no menu.
const KNOCKOUT_AUTO_DISMISSED_KEY_V244 = `${STORAGE_KEY}_ko_auto_dismissed_v244`;
let knockoutAutoIntervalV244 = null;

function knockoutAutoSignatureV244(match) {
  return [
    match?.id || "",
    normalizeComparable(match?.homeTeam || ""),
    normalizeComparable(match?.awayTeam || ""),
    normalizeKnockoutMatchDateV243(match?.matchDate || match?.date || match?.kickoff || "")
  ].join("|");
}

function dismissedAutoKnockoutSignaturesV244() {
  try {
    const list = JSON.parse(sessionStorage.getItem(KNOCKOUT_AUTO_DISMISSED_KEY_V244) || "[]");
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

function rememberDismissedAutoKnockoutV244(matchId) {
  const match = knockoutMatchById(matchId);
  const signature = knockoutAutoSignatureV244(match);
  if (!signature || signature === "|||") return;
  try {
    const dismissed = dismissedAutoKnockoutSignaturesV244();
    dismissed.add(signature);
    sessionStorage.setItem(KNOCKOUT_AUTO_DISMISSED_KEY_V244, JSON.stringify([...dismissed].slice(-80)));
  } catch {}
}

currentUserCanBetKnockoutV241 = function currentUserCanBetKnockoutV244() {
  return Boolean(currentUser && currentProfile?.active !== false);
};

closeKnockoutBetModalV241 = function closeKnockoutBetModalV244() {
  if (knockoutAutoModalMatchIdV243) rememberDismissedAutoKnockoutV244(knockoutAutoModalMatchIdV243);
  $("knockoutBetModalV241")?.classList.add("hidden");
  activeKnockoutBetMatchIdV241 = "";
  knockoutAutoModalMatchIdV243 = "";
};

eligibleAutoKnockoutBetMatchesV243 = function eligibleAutoKnockoutBetMatchesV244() {
  const player = linkedPlayerForCurrentUserV241();
  if (!currentUserCanBetKnockoutV241() || !player) return [];

  const dismissed = dismissedAutoKnockoutSignaturesV244();
  return knockoutMatches()
    .filter(match => match?.homeTeam && match?.awayTeam)
    .filter(match => knockoutMatchStartMillisV241(match) > 0)
    .filter(match => !knockoutMatchHasResult(match))
    .filter(match => !isKnockoutBetLockedV241(match))
    .filter(match => !knockoutBetForPlayerMatchV241(player.id, match.id))
    .filter(match => !dismissed.has(knockoutAutoSignatureV244(match)))
    .sort((a, b) => knockoutMatchStartMillisV241(a) - knockoutMatchStartMillisV241(b));
};

function forceKnockoutAutoBetCheckV244(delay = 500) {
  try { scheduleKnockoutAutoBetCheckV243(delay); } catch (error) { console.warn("Agendar modal Fase Final falhou:", error); }
}

const saveKnockoutMatchFromAdminOriginalV244 = typeof saveKnockoutMatchFromAdmin === "function" ? saveKnockoutMatchFromAdmin : null;
if (saveKnockoutMatchFromAdminOriginalV244 && !window.__saveKnockoutAutoCheckV244) {
  window.__saveKnockoutAutoCheckV244 = true;
  saveKnockoutMatchFromAdmin = async function saveKnockoutMatchFromAdminWithAutoCheckV244() {
    const result = await saveKnockoutMatchFromAdminOriginalV244.apply(this, arguments);
    forceKnockoutAutoBetCheckV244(600);
    return result;
  };
}

const queueRealtimeRenderOriginalV244 = typeof queueRealtimeRender === "function" ? queueRealtimeRender : null;
if (queueRealtimeRenderOriginalV244 && !window.__queueRealtimeAutoCheckV244) {
  window.__queueRealtimeAutoCheckV244 = true;
  queueRealtimeRender = function queueRealtimeRenderWithAutoCheckV244(reason = "firebase realtime") {
    const result = queueRealtimeRenderOriginalV244.apply(this, arguments);
    forceKnockoutAutoBetCheckV244(1800);
    return result;
  };
}

const loadDataOriginalV244 = typeof loadData === "function" ? loadData : null;
if (loadDataOriginalV244 && !window.__loadDataAutoCheckV244) {
  window.__loadDataAutoCheckV244 = true;
  loadData = async function loadDataWithAutoCheckV244() {
    const result = await loadDataOriginalV244.apply(this, arguments);
    forceKnockoutAutoBetCheckV244(900);
    return result;
  };
}

function startKnockoutAutoBetIntervalV244() {
  if (knockoutAutoIntervalV244) return;
  knockoutAutoIntervalV244 = setInterval(() => {
    if (!document.hidden) forceKnockoutAutoBetCheckV244(50);
  }, 15000);
}

startKnockoutAutoBetIntervalV244();
document.addEventListener("focusin", event => {
  if (window.__isMundialTextFieldActiveV250?.(event.target)) return;
  forceKnockoutAutoBetCheckV244(450);
});
document.addEventListener("click", event => {
  if (event.target.closest?.("#knockoutBetModalV241, #knockoutRecordModal, button, input, select, textarea, a")) return;
  forceKnockoutAutoBetCheckV244(900);
}, true);
document.addEventListener("DOMContentLoaded", () => {
  startKnockoutAutoBetIntervalV244();
  forceKnockoutAutoBetCheckV244(2200);
});



// v245 — Página inicial com botão obrigatório para apostas/resultados da Fase Final.
// Substitui a dependência do modal automático por uma zona visível e persistente no Calendário.
function isPrivilegedKnockoutAdminV245() {
  try { return Boolean(isAdmin || isAdminProfile()); } catch { return Boolean(isAdmin); }
}

function knockoutMatchReadyForBetV245(match) {
  return Boolean(match?.homeTeam && match?.awayTeam && knockoutMatchStartMillisV241(match) > 0 && !knockoutMatchHasResult(match));
}

function currentUserRequiredKnockoutBetsV245() {
  const player = linkedPlayerForCurrentUserV241();
  if (!currentUserCanBetKnockoutV241() || !player) return [];
  return knockoutMatches()
    .filter(knockoutMatchReadyForBetV245)
    .filter(match => !isKnockoutBetLockedV241(match))
    .filter(match => !knockoutBetForPlayerMatchV241(player.id, match.id))
    .sort((a, b) => knockoutMatchStartMillisV241(a) - knockoutMatchStartMillisV241(b));
}

function currentUserMissedKnockoutBetsV245() {
  const player = linkedPlayerForCurrentUserV241();
  if (!currentUserCanBetKnockoutV241() || !player) return [];
  return knockoutMatches()
    .filter(knockoutMatchReadyForBetV245)
    .filter(match => isKnockoutBetLockedV241(match))
    .filter(match => !knockoutBetForPlayerMatchV241(player.id, match.id))
    .sort((a, b) => knockoutMatchStartMillisV241(a) - knockoutMatchStartMillisV241(b));
}

function currentUserDoneKnockoutBetsV245() {
  const player = linkedPlayerForCurrentUserV241();
  if (!currentUserCanBetKnockoutV241() || !player) return [];
  return knockoutMatches()
    .filter(knockoutMatchReadyForBetV245)
    .filter(match => knockoutBetForPlayerMatchV241(player.id, match.id))
    .sort((a, b) => knockoutMatchStartMillisV241(a) - knockoutMatchStartMillisV241(b));
}

function adminMissingKnockoutResultsV245() {
  if (!isPrivilegedKnockoutAdminV245() || !hasPermission("editKnockout")) return [];
  return knockoutMatches()
    .filter(match => match?.homeTeam && match?.awayTeam)
    .filter(match => !knockoutMatchHasResult(match))
    .sort((a, b) => (knockoutMatchStartMillisV241(a) || 9999999999999) - (knockoutMatchStartMillisV241(b) || 9999999999999));
}

function knockoutDeadlineBadgeV245(match) {
  const lock = knockoutBetLockMillisV243(match);
  if (!lock) return "Sem prazo";
  const minutesLeft = Math.floor((lock - Date.now()) / 60000);
  if (minutesLeft < 0) return "Prazo terminado";
  if (minutesLeft < 60) return `${minutesLeft} min restantes`;
  return `Até ${dateTimePortugal(new Date(lock))}`;
}

function knockoutRequiredUserRowHtmlV245(match, mode = "open") {
  const locked = mode === "missed";
  return `
    <article class="ko-required-row-v245 ${locked ? "missed" : "open"}">
      <div class="ko-required-row-main-v245">
        <span>${escapeHtml(knockoutRoundLabel(match.round))} · Jogo ${escapeHtml(match.index)}</span>
        <strong>${escapeHtml(match.homeTeam)} vs ${escapeHtml(match.awayTeam)}</strong>
        <small>${escapeHtml(dateTimePortugal(match.matchDate))} · ${escapeHtml(knockoutDeadlineBadgeV245(match))}</small>
      </div>
      <button class="${locked ? "secondary" : "primary"} small" type="button" data-ko-bet-open-v245="${escapeHtml(match.id)}">${locked ? "Ver estado" : "Apostar agora"}</button>
    </article>`;
}

function knockoutRequiredAdminRowHtmlV245(match) {
  const dateText = knockoutMatchStartMillisV241(match) ? dateTimePortugal(match.matchDate) : "Data/hora por definir";
  return `
    <article class="ko-required-row-v245 admin">
      <div class="ko-required-row-main-v245">
        <span>${escapeHtml(knockoutRoundLabel(match.round))} · Jogo ${escapeHtml(match.index)}</span>
        <strong>${escapeHtml(match.homeTeam)} vs ${escapeHtml(match.awayTeam)}</strong>
        <small>${escapeHtml(dateText)} · sem resultado final</small>
      </div>
      <button class="secondary small" type="button" data-ko-admin-result-open-v245="${escapeHtml(match.id)}">Adicionar resultado</button>
    </article>`;
}

function knockoutRequiredHomePanelHtmlV245() {
  ensureKnockoutSettings();

  const player = linkedPlayerForCurrentUserV241();
  const required = currentUserRequiredKnockoutBetsV245();
  const missed = currentUserMissedKnockoutBetsV245();
  const done = currentUserDoneKnockoutBetsV245();
  const adminMissing = adminMissingKnockoutResultsV245();
  const hasKnockoutReady = knockoutMatches().some(match => match?.homeTeam && match?.awayTeam && knockoutMatchStartMillisV241(match));
  const shouldShowUserPanel = Boolean(currentUser && (player || hasKnockoutReady));
  const shouldShowAdminPanel = Boolean(adminMissing.length);

  if (!shouldShowUserPanel && !shouldShowAdminPanel) return "";

  const userHeadline = player
    ? required.length
      ? `${required.length} aposta${required.length === 1 ? "" : "s"} obrigatória${required.length === 1 ? "" : "s"} por preencher`
      : missed.length
        ? "Tens jogos da Fase Final onde já passou o prazo"
        : "Apostas da Fase Final em dia"
    : "Conta ainda sem jogador ligado";

  const userSubtitle = player
    ? required.length
      ? "Preenche estes resultados antes do prazo. Enquanto houver pendentes, a app mantém este aviso na página inicial."
      : missed.length
        ? "Os jogos abaixo já passaram o prazo de 5 minutos antes do início."
        : done.length
          ? "Não tens jogos obrigatórios por preencher neste momento."
          : "Ainda não existem jogos da Fase Final abertos para apostar."
    : "Para ser obrigatório, primeiro o Admin tem de ligar esta conta ao jogador correto.";

  const requiredRows = required.map(match => knockoutRequiredUserRowHtmlV245(match, "open")).join("");
  const missedRows = missed.slice(0, 6).map(match => knockoutRequiredUserRowHtmlV245(match, "missed")).join("");
  const adminRows = adminMissing.slice(0, 10).map(knockoutRequiredAdminRowHtmlV245).join("");
  const expanded = required.length || adminMissing.length;

  return `
    <section id="knockoutRequiredHomeV245" class="ko-required-home-v245 ${required.length ? "urgent" : "calm"} ${expanded ? "expanded" : ""}" data-ko-required-count-v245="${required.length}">
      <div class="ko-required-head-v245">
        <div class="ko-required-title-v245">
          <span class="ko-required-badge-v245">${required.length ? "Obrigatório" : "Fase Final"}</span>
          <div>
            <h3>${escapeHtml(userHeadline)}</h3>
            <p>${escapeHtml(userSubtitle)}</p>
          </div>
        </div>
        <div class="ko-required-actions-v245">
          ${required[0] ? `<button class="primary ko-required-main-btn-v245" type="button" data-ko-bet-open-v245="${escapeHtml(required[0].id)}">Apostar no próximo jogo</button>` : ""}
          <button class="secondary ko-required-main-btn-v245" type="button" data-ko-required-toggle-v245>${expanded ? "Ver/ocultar lista" : "Ver jogos"}</button>
        </div>
      </div>

      <div class="ko-required-list-v245">
        ${requiredRows ? `<div class="ko-required-block-v245"><strong>Por preencher agora</strong>${requiredRows}</div>` : ""}
        ${missedRows ? `<div class="ko-required-block-v245 missed"><strong>Prazo terminado</strong>${missedRows}</div>` : ""}
        ${player && !requiredRows && !missedRows ? `<div class="ko-required-empty-v245">Sem apostas obrigatórias pendentes.</div>` : ""}
        ${!player ? `<div class="ko-required-empty-v245 warning">Conta sem jogador ligado. O Admin deve abrir Admin → Users e ligar este user ao jogador certo.</div>` : ""}
        ${adminRows ? `<div class="ko-required-block-v245 admin"><strong>Admin · jogos da Fase Final sem resultado final</strong>${adminRows}</div>` : ""}
      </div>
    </section>`;
}

function injectKnockoutRequiredHomePanelV245() {
  try {
    const container = $("gamesList");
    if (!container) return;
    container.querySelector("#knockoutRequiredHomeV245")?.remove();
    const html = knockoutRequiredHomePanelHtmlV245();
    if (!html) return;
    const temp = document.createElement("div");
    temp.innerHTML = html.trim();
    const panel = temp.firstElementChild;
    if (panel) container.prepend(panel);
  } catch (error) {
    console.warn("Painel obrigatório Fase Final v245 falhou:", error);
  }
}

function focusKnockoutRequiredHomePanelV245() {
  if (!$('calendarTab')?.classList.contains('active')) {
    setActiveTabStateV217("calendarTab");
    updateActiveAppSection();
    renderCalendar();
  } else {
    injectKnockoutRequiredHomePanelV245();
  }
  setTimeout(() => {
    const panel = $("knockoutRequiredHomeV245");
    panel?.classList.add("expanded", "pulse-v245");
    panel?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => panel?.classList.remove("pulse-v245"), 1400);
  }, 80);
}

function shouldForceRequiredKnockoutBetsV245() {
  if (isPrivilegedKnockoutAdminV245()) return false;
  return currentUserRequiredKnockoutBetsV245().length > 0;
}

function refreshKnockoutRequiredPanelSoonV245(delay = 120) {
  setTimeout(() => {
    if ($("calendarTab")?.classList.contains("active")) injectKnockoutRequiredHomePanelV245();
  }, delay);
}

const renderCalendarOriginalV245 = typeof renderCalendar === "function" ? renderCalendar : null;
if (renderCalendarOriginalV245 && !window.__renderCalendarRequiredKnockoutV245) {
  window.__renderCalendarRequiredKnockoutV245 = true;
  renderCalendar = function renderCalendarWithRequiredKnockoutV245() {
    const result = renderCalendarOriginalV245.apply(this, arguments);
    injectKnockoutRequiredHomePanelV245();
    return result;
  };
}

const renderAllOriginalV245 = typeof renderAll === "function" ? renderAll : null;
if (renderAllOriginalV245 && !window.__renderAllRequiredKnockoutV245) {
  window.__renderAllRequiredKnockoutV245 = true;
  renderAll = function renderAllWithRequiredKnockoutV245() {
    const result = renderAllOriginalV245.apply(this, arguments);
    refreshKnockoutRequiredPanelSoonV245(150);
    return result;
  };
}

if (typeof maybeOpenNextKnockoutBetModalV243 === "function") {
  maybeOpenNextKnockoutBetModalV243 = function maybeOpenNextKnockoutBetPanelV245() {
    refreshKnockoutRequiredPanelSoonV245(50);
  };
}
if (typeof scheduleKnockoutAutoBetCheckV243 === "function") {
  scheduleKnockoutAutoBetCheckV243 = function scheduleKnockoutRequiredPanelCheckV245(delay = 300) {
    refreshKnockoutRequiredPanelSoonV245(delay);
  };
}
if (typeof forceKnockoutAutoBetCheckV244 === "function") {
  forceKnockoutAutoBetCheckV244 = function forceKnockoutRequiredPanelCheckV245(delay = 150) {
    refreshKnockoutRequiredPanelSoonV245(delay);
  };
}
try {
  if (typeof knockoutAutoIntervalV244 !== "undefined" && knockoutAutoIntervalV244) {
    clearInterval(knockoutAutoIntervalV244);
    knockoutAutoIntervalV244 = null;
  }
} catch {}

const saveKnockoutBetFromModalOriginalV245 = typeof saveKnockoutBetFromModalV241 === "function" ? saveKnockoutBetFromModalV241 : null;
if (saveKnockoutBetFromModalOriginalV245 && !window.__saveKnockoutRefreshRequiredV245) {
  window.__saveKnockoutRefreshRequiredV245 = true;
  saveKnockoutBetFromModalV241 = async function saveKnockoutBetFromModalRefreshRequiredV245() {
    const result = await saveKnockoutBetFromModalOriginalV245.apply(this, arguments);
    refreshKnockoutRequiredPanelSoonV245(250);
    return result;
  };
}

const deleteKnockoutBetFromModalOriginalV245 = typeof deleteKnockoutBetFromModalV241 === "function" ? deleteKnockoutBetFromModalV241 : null;
if (deleteKnockoutBetFromModalOriginalV245 && !window.__deleteKnockoutRefreshRequiredV245) {
  window.__deleteKnockoutRefreshRequiredV245 = true;
  deleteKnockoutBetFromModalV241 = async function deleteKnockoutBetFromModalRefreshRequiredV245() {
    const result = await deleteKnockoutBetFromModalOriginalV245.apply(this, arguments);
    refreshKnockoutRequiredPanelSoonV245(250);
    return result;
  };
}

document.addEventListener("click", event => {
  const betBtn = event.target.closest?.("[data-ko-bet-open-v245]");
  if (betBtn) {
    event.preventDefault();
    event.stopPropagation();
    const matchId = betBtn.dataset.koBetOpenV245;
    openKnockoutBetModalV241(matchId, { manual: true });
    return;
  }

  const adminBtn = event.target.closest?.("[data-ko-admin-result-open-v245]");
  if (adminBtn) {
    event.preventDefault();
    event.stopPropagation();
    openKnockoutRecordModal(adminBtn.dataset.koAdminResultOpenV245);
    return;
  }

  const toggleBtn = event.target.closest?.("[data-ko-required-toggle-v245]");
  if (toggleBtn) {
    event.preventDefault();
    event.stopPropagation();
    const panel = $("knockoutRequiredHomeV245");
    panel?.classList.toggle("expanded");
    return;
  }
}, true);

document.addEventListener("click", event => {
  const tabButton = event.target.closest?.(".tabs [data-tab]");
  if (!tabButton) return;
  const targetTab = tabButton.dataset.tab || "";
  if (!targetTab || targetTab === "calendarTab" || targetTab === "settingsTab" || targetTab === "adminTab") return;
  if (!shouldForceRequiredKnockoutBetsV245()) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  focusKnockoutRequiredHomePanelV245();
  toast("Primeiro tens de preencher as apostas obrigatórias da Fase Final.");
}, true);

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    refreshKnockoutRequiredPanelSoonV245(50);
    if (shouldForceRequiredKnockoutBetsV245()) focusKnockoutRequiredHomePanelV245();
  }, 1600);
});

// v247 - Modal automatico obrigatorio para apostas da Fase Final.
// Mantem a estrutura de apostas existente em "bets" e volta a abrir sozinho quando ha pendentes.
const KNOCKOUT_MANDATORY_CHECK_MS_V247 = 14000;
let knockoutMandatoryTimerV247 = null;
let knockoutMandatoryIntervalV247 = null;
let knockoutMandatoryCheckingV247 = false;
let knockoutMandatoryRetryV247 = 0;

function knockoutMatchMandatoryReadyV247(match) {
  return Boolean(
    match &&
    match.id &&
    match.homeTeam &&
    match.awayTeam &&
    knockoutMatchStartMillisV241(match) > 0 &&
    !knockoutMatchHasResult(match)
  );
}

function knockoutBetDeadlineMillisV247(match) {
  return typeof knockoutBetLockMillisV243 === "function"
    ? knockoutBetLockMillisV243(match)
    : (knockoutMatchStartMillisV241(match) || 0) - (5 * 60 * 1000);
}

function knockoutMandatoryDeadlineOpenV247(match) {
  const deadline = knockoutBetDeadlineMillisV247(match);
  return Boolean(deadline && Date.now() < deadline);
}

function knockoutMandatoryDataReadyV247() {
  if (!currentUser) return false;
  if (!currentProfile) return false;
  if (!appSettings || !appSettings.knockout || !Array.isArray(appSettings.knockout.matches)) return false;
  if (!Array.isArray(bets)) return false;
  return true;
}

function knockoutMandatoryPlayerV247() {
  try { return linkedPlayerForCurrentUserV241(); } catch { return null; }
}

function knockoutMandatoryPendingMatchesV247() {
  if (!knockoutMandatoryDataReadyV247()) return [];
  if (currentProfile?.active === false) return [];
  const player = knockoutMandatoryPlayerV247();
  if (!player) return [];

  return knockoutMatches()
    .filter(knockoutMatchMandatoryReadyV247)
    .filter(knockoutMandatoryDeadlineOpenV247)
    .filter(match => !knockoutBetForPlayerMatchV241(player.id, match.id))
    .sort((a, b) => knockoutMatchStartMillisV241(a) - knockoutMatchStartMillisV241(b));
}

function knockoutMandatoryMissedMatchesV247() {
  if (!knockoutMandatoryDataReadyV247()) return [];
  const player = knockoutMandatoryPlayerV247();
  if (!player) return [];

  return knockoutMatches()
    .filter(knockoutMatchMandatoryReadyV247)
    .filter(match => !knockoutMandatoryDeadlineOpenV247(match))
    .filter(match => !knockoutBetForPlayerMatchV241(player.id, match.id))
    .sort((a, b) => knockoutMatchStartMillisV241(a) - knockoutMatchStartMillisV241(b));
}

function knockoutMandatoryDoneMatchesV247() {
  if (!knockoutMandatoryDataReadyV247()) return [];
  const player = knockoutMandatoryPlayerV247();
  if (!player) return [];

  return knockoutMatches()
    .filter(knockoutMatchMandatoryReadyV247)
    .filter(match => knockoutBetForPlayerMatchV241(player.id, match.id))
    .sort((a, b) => knockoutMatchStartMillisV241(a) - knockoutMatchStartMillisV241(b));
}

function knockoutMandatoryStatusV247(match) {
  const player = knockoutMandatoryPlayerV247();
  if (!player) return { key: "no-player", label: "Sem jogador ligado" };
  if (!knockoutMatchMandatoryReadyV247(match)) return { key: "not-ready", label: "Nao obrigatorio" };
  if (knockoutMatchHasResult(match)) return { key: "result", label: "Resultado lancado" };
  const bet = knockoutBetForPlayerMatchV241(player.id, match.id);
  if (bet) return { key: "done", label: "Apostado" };
  if (!knockoutMandatoryDeadlineOpenV247(match)) return { key: "missed", label: "Fora deste jogo" };
  return { key: "pending", label: "Por apostar" };
}

function ensureKnockoutMandatoryModalV247() {
  let modal = $("knockoutMandatoryModalV247");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "knockoutMandatoryModalV247";
  modal.className = "modal hidden ko-mandatory-modal-v247";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "Apostas obrigatorias da Fase Final");
  modal.innerHTML = `
    <div class="modal-card ko-mandatory-card-v247">
      <div class="modal-head ko-mandatory-head-v247">
        <div>
          <h2>Apostas obrigatorias</h2>
          <p id="koMandatorySubtitleV247">Preenche os jogos da Fase Final antes do prazo.</p>
        </div>
        <button id="closeKnockoutMandatoryV247" class="icon-button" type="button" aria-label="Fechar">x</button>
      </div>
      <div id="koMandatoryBodyV247" class="ko-mandatory-body-v247"></div>
    </div>
  `;
  document.body.appendChild(modal);

  const blockClose = event => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    closeKnockoutMandatoryModalV247();
  };

  $("closeKnockoutMandatoryV247")?.addEventListener("click", blockClose);
  modal.addEventListener("click", event => {
    if (event.target === modal) blockClose(event);
  });

  return modal;
}

function knockoutMandatoryOptionHtmlV247(match, selected = "") {
  const teams = [match.homeTeam || "", match.awayTeam || ""].filter(Boolean);
  return `<option value="">Escolher equipa</option>${teams.map(team => `<option value="${escapeHtml(team)}" ${normalizeComparable(team) === normalizeComparable(selected) ? "selected" : ""}>${escapeHtml(team)}</option>`).join("")}`;
}

function knockoutMandatoryRowHtmlV247(match, player) {
  const deadline = knockoutBetDeadlineMillisV247(match);
  return `
    <article class="ko-mandatory-row-v247" data-ko-mandatory-match="${escapeHtml(match.id)}">
      <div class="ko-mandatory-match-v247">
        <span>${escapeHtml(knockoutRoundLabel(match.round))} - Jogo ${escapeHtml(match.index)}</span>
        <strong>${escapeHtml(match.homeTeam)} vs ${escapeHtml(match.awayTeam)}</strong>
        <small>Jogo: ${escapeHtml(dateTimePortugal(match.matchDate))} - Prazo: ${escapeHtml(dateTimePortugal(new Date(deadline)))}</small>
      </div>
      <div class="ko-mandatory-form-v247">
        <label>
          <span>${escapeHtml(match.homeTeam)}</span>
          <input class="ko-mandatory-home-v247" type="number" min="0" inputmode="numeric" placeholder="0" />
        </label>
        <b>VS</b>
        <label>
          <span>${escapeHtml(match.awayTeam)}</span>
          <input class="ko-mandatory-away-v247" type="number" min="0" inputmode="numeric" placeholder="0" />
        </label>
        <label class="ko-mandatory-qualified-v247">
          <span>Qualificada</span>
          <select class="ko-mandatory-winner-v247">${knockoutMandatoryOptionHtmlV247(match)}</select>
        </label>
        <button class="primary ko-mandatory-save-v247" type="button" data-ko-mandatory-save="${escapeHtml(match.id)}">Guardar aposta</button>
      </div>
    </article>
  `;
}

function renderKnockoutMandatoryModalV247() {
  const modal = ensureKnockoutMandatoryModalV247();
  const body = $("koMandatoryBodyV247");
  if (!body) return;

  const player = knockoutMandatoryPlayerV247();
  const pending = knockoutMandatoryPendingMatchesV247();
  const missed = knockoutMandatoryMissedMatchesV247();
  const done = knockoutMandatoryDoneMatchesV247();

  $("koMandatorySubtitleV247").textContent = player
    ? `${player.name} - ${pending.length} aposta(s) por preencher`
    : "Conta sem jogador ligado.";

  if (!player) {
    body.innerHTML = `<div class="ko-mandatory-empty-v247 warning"><strong>Conta sem jogador ligado</strong><span>O Admin tem de ligar este user ao jogador certo antes de haver apostas obrigatorias.</span></div>`;
    return;
  }

  if (!pending.length) {
    body.innerHTML = `
      <div class="ko-mandatory-empty-v247 success">
        <strong>Sem apostas obrigatorias pendentes</strong>
        <span>${missed.length ? `${missed.length} jogo(s) ja passaram o prazo sem aposta.` : done.length ? "As apostas abertas estao em dia." : "Ainda nao ha jogos da Fase Final abertos para apostar."}</span>
      </div>
    `;
    return;
  }

  body.innerHTML = `
    <div class="ko-mandatory-warning-v247">
      <strong>Obrigatorio antes do prazo</strong>
      <span>Este modal so fecha quando guardares todas as apostas pendentes ou quando o prazo terminar.</span>
    </div>
    ${pending.map(match => knockoutMandatoryRowHtmlV247(match, player)).join("")}
  `;
}

function openKnockoutMandatoryModalV247() {
  const pending = knockoutMandatoryPendingMatchesV247();
  if (!pending.length) {
    closeKnockoutMandatoryModalV247(true);
    return false;
  }
  const modal = ensureKnockoutMandatoryModalV247();
  renderKnockoutMandatoryModalV247();
  modal.classList.remove("hidden");
  document.body.classList.add("ko-mandatory-open-v247");
  setTimeout(() => modal.querySelector("input, select, button")?.focus?.(), 40);
  return true;
}

function closeKnockoutMandatoryModalV247(force = false) {
  const pending = knockoutMandatoryPendingMatchesV247();
  if (!force && pending.length) {
    toast("Tens apostas obrigatorias por preencher antes do prazo.");
    renderKnockoutMandatoryModalV247();
    return false;
  }
  $("knockoutMandatoryModalV247")?.classList.add("hidden");
  document.body.classList.remove("ko-mandatory-open-v247");
  return true;
}

async function saveMandatoryKnockoutBetV247(matchId) {
  const match = knockoutMatchById(matchId);
  const player = knockoutMandatoryPlayerV247();
  if (!match || !player) return toast("A tua conta ainda nao esta ligada a um jogador.");
  if (!knockoutMatchMandatoryReadyV247(match)) return toast("Este jogo ainda nao esta aberto para apostar.");
  if (!knockoutMandatoryDeadlineOpenV247(match)) {
    renderKnockoutMandatoryModalV247();
    scheduleKnockoutMandatoryCheckV247(100);
    return toast("O prazo terminou. Ficaste fora deste jogo.");
  }
  if (knockoutBetForPlayerMatchV241(player.id, match.id)) {
    renderKnockoutMandatoryModalV247();
    scheduleKnockoutMandatoryCheckV247(100);
    return toast("Esta aposta ja esta guardada.");
  }

  const row = document.querySelector(`[data-ko-mandatory-match="${CSS.escape(matchId)}"]`);
  const homeRaw = row?.querySelector(".ko-mandatory-home-v247")?.value ?? "";
  const awayRaw = row?.querySelector(".ko-mandatory-away-v247")?.value ?? "";
  const qualified = row?.querySelector(".ko-mandatory-winner-v247")?.value || "";
  const home = Number(homeRaw);
  const away = Number(awayRaw);

  if (homeRaw === "" || awayRaw === "" || !Number.isFinite(home) || !Number.isFinite(away) || home < 0 || away < 0 || !Number.isInteger(home) || !Number.isInteger(away)) {
    return toast("Preenche os golos com valores validos.");
  }
  if (!qualified) return toast("Escolhe a equipa que se qualifica.");
  if (![normalizeComparable(match.homeTeam), normalizeComparable(match.awayTeam)].includes(normalizeComparable(qualified))) {
    return toast("A equipa qualificada tem de ser uma das duas equipas do jogo.");
  }
  if (home > away && normalizeComparable(qualified) !== normalizeComparable(match.homeTeam)) {
    return toast("A equipa qualificada nao bate certo com o resultado apostado.");
  }
  if (away > home && normalizeComparable(qualified) !== normalizeComparable(match.awayTeam)) {
    return toast("A equipa qualificada nao bate certo com o resultado apostado.");
  }

  const bet = {
    id: `${match.id}_${player.id}`,
    gameId: match.id,
    round: match.round || "",
    roundLabel: knockoutRoundLabel(match.round),
    playerId: player.id,
    playerName: player.name,
    uid: currentUser?.uid || "",
    email: normalizeEmail(currentUser?.email || ""),
    source: "FaseFinalUser",
    type: "knockout",
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeGuess: home,
    awayGuess: away,
    winner: qualified,
    qualifiedTeam: qualified,
    deadlineAt: new Date(knockoutBetDeadlineMillisV247(match)).toISOString(),
    matchDate: normalizeKnockoutMatchDateV243(match.matchDate),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await persistBet(bet);
  addSystemLog("Aposta Fase Final", `${player.name} guardou aposta obrigatoria em ${match.homeTeam} vs ${match.awayTeam}. Qualificado: ${qualified}.`, { matchId: match.id, playerId: player.id, winner: qualified }, { sync: true });

  renderKnockoutMandatoryModalV247();
  decorateKnockoutMandatoryStatusesV247();
  renderScore();

  if (!knockoutMandatoryPendingMatchesV247().length) {
    closeKnockoutMandatoryModalV247(true);
    toast("Apostas obrigatorias guardadas.");
  } else {
    toast("Aposta guardada. Ainda tens pendentes.");
  }
  scheduleKnockoutMandatoryCheckV247(250);
}

function scheduleKnockoutMandatoryCheckV247(delay = 700) {
  clearTimeout(knockoutMandatoryTimerV247);
  knockoutMandatoryTimerV247 = setTimeout(runKnockoutMandatoryCheckV247, delay);
}

function runKnockoutMandatoryCheckV247() {
  if (knockoutMandatoryCheckingV247) return;
  knockoutMandatoryCheckingV247 = true;
  try {
    if (!currentUser || document.hidden) return;
    if (!knockoutMandatoryDataReadyV247()) {
      if (knockoutMandatoryRetryV247 < 24) {
        knockoutMandatoryRetryV247 += 1;
        scheduleKnockoutMandatoryCheckV247(700 + knockoutMandatoryRetryV247 * 250);
      }
      return;
    }

    knockoutMandatoryRetryV247 = 0;
    decorateKnockoutMandatoryStatusesV247();
    refreshKnockoutRequiredPanelSoonV245?.(120);

    const pending = knockoutMandatoryPendingMatchesV247();
    if (pending.length) {
      openKnockoutMandatoryModalV247();
    } else {
      closeKnockoutMandatoryModalV247(true);
    }
  } catch (error) {
    console.warn("Modal obrigatorio Fase Final v247 falhou:", error);
  } finally {
    knockoutMandatoryCheckingV247 = false;
  }
}

function startKnockoutMandatoryWatcherV247() {
  if (knockoutMandatoryIntervalV247) return;
  knockoutMandatoryIntervalV247 = setInterval(() => {
    if (!document.hidden) scheduleKnockoutMandatoryCheckV247(80);
  }, KNOCKOUT_MANDATORY_CHECK_MS_V247);
}

function knockoutAdminQualifiedOptionsV247(match) {
  const selected = match?.winner || match?.winnerTeam || match?.qualified || (knockoutMatchHasResult(match) ? knockoutWinner(match) : "");
  const teams = [match?.homeTeam || "", match?.awayTeam || ""].filter(Boolean);
  return `<option value="">A definir pelo resultado</option>${teams.map(team => `<option value="${escapeHtml(team)}" ${normalizeComparable(team) === normalizeComparable(selected) ? "selected" : ""}>${escapeHtml(team)}</option>`).join("")}`;
}

function addKnockoutQualifiedControlsV247(root = document) {
  root.querySelectorAll?.("[data-ko-admin]").forEach(row => {
    if (row.querySelector(".ko-qualified-team-v247")) return;
    const match = knockoutMatchById(row.dataset.koAdmin || "");
    if (!match) return;
    const target = row.querySelector(".ko-penalty-label") || row.querySelector(".ko-home-penalties")?.closest("label") || row.querySelector(".ko-away-penalties")?.closest("label");
    if (!target) return;
    const label = document.createElement("label");
    label.className = "ko-score-label ko-qualified-label-v247";
    label.innerHTML = `Equipa qualificada
      <select class="ko-qualified-team-v247" ${match.homeTeam && match.awayTeam ? "" : "disabled"}>
        ${knockoutAdminQualifiedOptionsV247(match)}
      </select>`;
    target.insertAdjacentElement("afterend", label);
  });
}

function decorateKnockoutMandatoryStatusesV247() {
  try {
    document.querySelectorAll("#knockoutBracket [data-ko-admin], #knockoutMobileV121 [data-ko-admin]").forEach(card => {
      const match = knockoutMatchById(card.dataset.koAdmin || "");
      if (!match) return;
      const status = knockoutMandatoryStatusV247(match);
      let badge = card.querySelector(".ko-user-status-v247");
      if (!badge) {
        badge = document.createElement("div");
        badge.className = "ko-user-status-v247";
        card.appendChild(badge);
      }
      badge.className = `ko-user-status-v247 ${status.key}`;
      badge.textContent = status.label;
    });
  } catch (error) {
    console.warn("Estados Fase Final v247 falharam:", error);
  }
}

const renderAllOriginalV247 = typeof renderAll === "function" ? renderAll : null;
if (renderAllOriginalV247 && !window.__renderAllMandatoryKnockoutV247) {
  window.__renderAllMandatoryKnockoutV247 = true;
  renderAll = function renderAllMandatoryKnockoutV247() {
    const result = renderAllOriginalV247.apply(this, arguments);
    setTimeout(addKnockoutQualifiedControlsV247, 0);
    scheduleKnockoutMandatoryCheckV247(650);
    return result;
  };
}

const renderKnockoutOriginalV247 = typeof renderKnockout === "function" ? renderKnockout : null;
if (renderKnockoutOriginalV247 && !window.__renderKnockoutMandatoryV247) {
  window.__renderKnockoutMandatoryV247 = true;
  renderKnockout = function renderKnockoutMandatoryV247() {
    const result = renderKnockoutOriginalV247.apply(this, arguments);
    setTimeout(() => {
      addKnockoutQualifiedControlsV247();
      decorateKnockoutMandatoryStatusesV247();
    }, 0);
    scheduleKnockoutMandatoryCheckV247(650);
    return result;
  };
}

const renderKnockoutAdminOriginalV247 = typeof renderKnockoutAdmin === "function" ? renderKnockoutAdmin : null;
if (renderKnockoutAdminOriginalV247 && !window.__renderKnockoutAdminQualifiedV247) {
  window.__renderKnockoutAdminQualifiedV247 = true;
  renderKnockoutAdmin = function renderKnockoutAdminQualifiedV247() {
    const result = renderKnockoutAdminOriginalV247.apply(this, arguments);
    setTimeout(addKnockoutQualifiedControlsV247, 0);
    return result;
  };
}

const openKnockoutRecordModalOriginalV247 = typeof openKnockoutRecordModal === "function" ? openKnockoutRecordModal : null;
if (openKnockoutRecordModalOriginalV247 && !window.__openKnockoutRecordQualifiedV247) {
  window.__openKnockoutRecordQualifiedV247 = true;
  openKnockoutRecordModal = function openKnockoutRecordModalQualifiedV247() {
    const result = openKnockoutRecordModalOriginalV247.apply(this, arguments);
    setTimeout(() => addKnockoutQualifiedControlsV247($("knockoutRecordModal") || document), 0);
    return result;
  };
}

const saveKnockoutMatchFromAdminOriginalV247 = typeof saveKnockoutMatchFromAdmin === "function" ? saveKnockoutMatchFromAdmin : null;
if (saveKnockoutMatchFromAdminOriginalV247 && !window.__saveKnockoutMandatoryV247) {
  window.__saveKnockoutMandatoryV247 = true;
  saveKnockoutMatchFromAdmin = async function saveKnockoutMatchFromAdminMandatoryV247() {
    const result = await saveKnockoutMatchFromAdminOriginalV247.apply(this, arguments);
    scheduleKnockoutMandatoryCheckV247(450);
    return result;
  };
}

const queueRealtimeRenderOriginalV247 = typeof queueRealtimeRender === "function" ? queueRealtimeRender : null;
if (queueRealtimeRenderOriginalV247 && !window.__queueRealtimeMandatoryV247) {
  window.__queueRealtimeMandatoryV247 = true;
  queueRealtimeRender = function queueRealtimeRenderMandatoryV247() {
    const result = queueRealtimeRenderOriginalV247.apply(this, arguments);
    scheduleKnockoutMandatoryCheckV247(1100);
    return result;
  };
}

const loadDataOriginalV247 = typeof loadData === "function" ? loadData : null;
if (loadDataOriginalV247 && !window.__loadDataMandatoryV247) {
  window.__loadDataMandatoryV247 = true;
  loadData = async function loadDataMandatoryV247() {
    const result = await loadDataOriginalV247.apply(this, arguments);
    scheduleKnockoutMandatoryCheckV247(800);
    return result;
  };
}

if (typeof maybeOpenNextKnockoutBetModalV243 === "function") {
  maybeOpenNextKnockoutBetModalV243 = function maybeOpenNextKnockoutBetModalV247() {
    runKnockoutMandatoryCheckV247();
  };
}
if (typeof scheduleKnockoutAutoBetCheckV243 === "function") {
  scheduleKnockoutAutoBetCheckV243 = function scheduleKnockoutAutoBetCheckV247(delay = 700) {
    scheduleKnockoutMandatoryCheckV247(delay);
  };
}
if (typeof forceKnockoutAutoBetCheckV244 === "function") {
  forceKnockoutAutoBetCheckV244 = function forceKnockoutAutoBetCheckV247(delay = 450) {
    scheduleKnockoutMandatoryCheckV247(delay);
  };
}
if (typeof shouldForceRequiredKnockoutBetsV245 === "function") {
  shouldForceRequiredKnockoutBetsV245 = function shouldForceRequiredKnockoutBetsModalV247() {
    return false;
  };
}

document.addEventListener("click", event => {
  const saveBtn = event.target.closest?.("[data-ko-mandatory-save]");
  if (saveBtn) {
    event.preventDefault();
    event.stopPropagation();
    saveMandatoryKnockoutBetV247(saveBtn.dataset.koMandatorySave);
    return;
  }

  const tabButton = event.target.closest?.(".tabs [data-tab]");
  if (!tabButton) return;
  if (!knockoutMandatoryPendingMatchesV247().length) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  openKnockoutMandatoryModalV247();
  toast("Primeiro tens de preencher as apostas obrigatorias da Fase Final.");
}, true);

document.addEventListener("input", event => {
  const row = event.target.closest?.("[data-ko-mandatory-match]");
  if (!row) return;
  const match = knockoutMatchById(row.dataset.koMandatoryMatch || "");
  const winner = row.querySelector(".ko-mandatory-winner-v247");
  if (!match || !winner || winner.value) return;
  const home = Number(row.querySelector(".ko-mandatory-home-v247")?.value);
  const away = Number(row.querySelector(".ko-mandatory-away-v247")?.value);
  if (!Number.isFinite(home) || !Number.isFinite(away)) return;
  if (home > away) winner.value = match.homeTeam || "";
  if (away > home) winner.value = match.awayTeam || "";
}, true);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) scheduleKnockoutMandatoryCheckV247(350);
});
window.addEventListener("focus", () => scheduleKnockoutMandatoryCheckV247(350));
document.addEventListener("DOMContentLoaded", () => {
  startKnockoutMandatoryWatcherV247();
  scheduleKnockoutMandatoryCheckV247(1800);
});
startKnockoutMandatoryWatcherV247();


// v250 — correção real do foco nos campos/selects.
// Problema: os watchers automáticos da Fase Final e alguns renders globais corriam
// logo depois de tocar num input/select/textarea. Isso reconstruía DOM ou abria modal
// e o campo perdia foco imediatamente. Esta guarda não mexe no valor dos campos:
// apenas adia renders/modais automáticos enquanto há um campo ativo.
const FORM_FOCUS_IDLE_MS_V250 = 1400;
let mundialFormLastInteractionV250 = 0;
let mundialFormIdleTimersV250 = new Map();

function mundialTextFieldV250(target) {
  try {
    const el = target?.closest?.("input, select, textarea, [contenteditable='true'], [contenteditable=''], [contenteditable='plaintext-only']");
    if (!el) return null;
    const tag = String(el.tagName || "").toLowerCase();
    const type = String(el.type || "").toLowerCase();
    if (tag === "textarea" || tag === "select") return el;
    if (el.isContentEditable) return el;
    if (tag !== "input") return null;
    if (["button", "submit", "reset", "checkbox", "radio", "file", "image", "hidden"].includes(type)) return null;
    return el;
  } catch {
    return null;
  }
}

function mundialActiveTextFieldV250() {
  return mundialTextFieldV250(document.activeElement);
}

function mundialMarkFormInteractionV250(target) {
  if (mundialTextFieldV250(target)) mundialFormLastInteractionV250 = Date.now();
}

function mundialFormIsActiveV250() {
  if (mundialActiveTextFieldV250()) return true;
  return Date.now() - mundialFormLastInteractionV250 < FORM_FOCUS_IDLE_MS_V250;
}

window.__isMundialTextFieldActiveV250 = function isMundialTextFieldActiveV250(target) {
  return Boolean(mundialTextFieldV250(target) || mundialFormIsActiveV250());
};

function mundialRunWhenFormIdleV250(key, fn, delay = FORM_FOCUS_IDLE_MS_V250) {
  const old = mundialFormIdleTimersV250.get(key);
  if (old) clearTimeout(old);
  const timer = setTimeout(() => {
    mundialFormIdleTimersV250.delete(key);
    if (mundialFormIsActiveV250()) {
      mundialRunWhenFormIdleV250(key, fn, delay);
      return;
    }
    try { fn(); } catch (error) { console.warn(`v250: ação adiada falhou (${key})`, error); }
  }, delay);
  mundialFormIdleTimersV250.set(key, timer);
}

// Marca interação em campos antes dos listeners antigos da app correrem.
["pointerdown", "mousedown", "touchstart", "click", "focusin", "keydown", "input", "change"].forEach(type => {
  document.addEventListener(type, event => mundialMarkFormInteractionV250(event.target), true);
});

document.addEventListener("focusout", event => {
  if (!mundialTextFieldV250(event.target)) return;
  mundialFormLastInteractionV250 = Date.now();
  mundialRunWhenFormIdleV250("post-focusout-check", () => {
    try { scheduleKnockoutMandatoryCheckV247?.(250); } catch {}
  }, FORM_FOCUS_IDLE_MS_V250);
}, true);

function mundialDeferAutoWorkV250(key, original, context, args) {
  if (!mundialFormIsActiveV250()) return original.apply(context, args);
  mundialRunWhenFormIdleV250(key, () => original.apply(context, args));
  return undefined;
}

function mundialPatchFunctionV250(name, getter, setter) {
  try {
    const original = getter();
    if (typeof original !== "function" || original.__mundialFocusPatchedV250) return;
    const patched = function mundialFocusSafeV250() {
      return mundialDeferAutoWorkV250(name, original, this, arguments);
    };
    patched.__mundialFocusPatchedV250 = true;
    setter(patched);
  } catch (error) {
    console.warn(`v250: não consegui proteger ${name}`, error);
  }
}

if (!window.__mundialGlobalFocusFixV250) {
  window.__mundialGlobalFocusFixV250 = true;

  // Renders principais que podem reconstruir inputs/selects.
  mundialPatchFunctionV250("renderAll", () => renderAll, value => { renderAll = value; });
  mundialPatchFunctionV250("renderActivePageV187", () => renderActivePageV187, value => { renderActivePageV187 = value; });
  mundialPatchFunctionV250("renderCalendar", () => renderCalendar, value => { renderCalendar = value; });
  mundialPatchFunctionV250("renderAdmin", () => renderAdmin, value => { renderAdmin = value; });
  mundialPatchFunctionV250("renderSettingsForm", () => renderSettingsForm, value => { renderSettingsForm = value; });
  mundialPatchFunctionV250("renderAppSettingsPanelV162", () => renderAppSettingsPanelV162, value => { renderAppSettingsPanelV162 = value; });
  mundialPatchFunctionV250("renderUserBetsEditor", () => renderUserBetsEditor, value => { renderUserBetsEditor = value; });
  mundialPatchFunctionV250("renderPermissionsUsers", () => renderPermissionsUsers, value => { renderPermissionsUsers = value; });
  mundialPatchFunctionV250("renderKnockout", () => renderKnockout, value => { renderKnockout = value; });
  mundialPatchFunctionV250("renderKnockoutAdmin", () => renderKnockoutAdmin, value => { renderKnockoutAdmin = value; });
  if (typeof renderAdminSectionsV187 === "function") mundialPatchFunctionV250("renderAdminSectionsV187", () => renderAdminSectionsV187, value => { renderAdminSectionsV187 = value; });
  if (typeof renderAdminSectionsV190 === "function") mundialPatchFunctionV250("renderAdminSectionsV190", () => renderAdminSectionsV190, value => { renderAdminSectionsV190 = value; });
  if (typeof organizeAdminPageV228 === "function") mundialPatchFunctionV250("organizeAdminPageV228", () => organizeAdminPageV228, value => { organizeAdminPageV228 = value; });
  if (typeof organizeSettingsPageV228 === "function") mundialPatchFunctionV250("organizeSettingsPageV228", () => organizeSettingsPageV228, value => { organizeSettingsPageV228 = value; });
  if (typeof renderSuspendedGameAdminV159 === "function") mundialPatchFunctionV250("renderSuspendedGameAdminV159", () => renderSuspendedGameAdminV159, value => { renderSuspendedGameAdminV159 = value; });
}

// Protege especificamente o modal obrigatório da Fase Final.
const scheduleKnockoutMandatoryCheckOriginalV250 = typeof scheduleKnockoutMandatoryCheckV247 === "function" ? scheduleKnockoutMandatoryCheckV247 : null;
if (scheduleKnockoutMandatoryCheckOriginalV250 && !window.__koMandatoryScheduleFocusFixV250) {
  window.__koMandatoryScheduleFocusFixV250 = true;
  scheduleKnockoutMandatoryCheckV247 = function scheduleKnockoutMandatoryCheckFocusFixV250(delay = 700) {
    if (mundialFormIsActiveV250()) {
      mundialRunWhenFormIdleV250("scheduleKnockoutMandatoryCheckV247", () => scheduleKnockoutMandatoryCheckOriginalV250.call(this, Math.max(250, delay)));
      return undefined;
    }
    return scheduleKnockoutMandatoryCheckOriginalV250.apply(this, arguments);
  };
}

const runKnockoutMandatoryCheckOriginalV250 = typeof runKnockoutMandatoryCheckV247 === "function" ? runKnockoutMandatoryCheckV247 : null;
if (runKnockoutMandatoryCheckOriginalV250 && !window.__koMandatoryRunFocusFixV250) {
  window.__koMandatoryRunFocusFixV250 = true;
  runKnockoutMandatoryCheckV247 = function runKnockoutMandatoryCheckFocusFixV250() {
    if (mundialFormIsActiveV250()) {
      mundialRunWhenFormIdleV250("runKnockoutMandatoryCheckV247", () => runKnockoutMandatoryCheckOriginalV250.apply(this, arguments));
      return undefined;
    }
    return runKnockoutMandatoryCheckOriginalV250.apply(this, arguments);
  };
}

const openKnockoutMandatoryModalOriginalV250 = typeof openKnockoutMandatoryModalV247 === "function" ? openKnockoutMandatoryModalV247 : null;
if (openKnockoutMandatoryModalOriginalV250 && !window.__koMandatoryOpenFocusFixV250) {
  window.__koMandatoryOpenFocusFixV250 = true;
  openKnockoutMandatoryModalV247 = function openKnockoutMandatoryModalFocusFixV250() {
    const active = mundialActiveTextFieldV250();
    const modal = document.getElementById("knockoutMandatoryModalV247");
    const activeInsideMandatory = Boolean(active && modal && modal.contains(active));

    // Não abrir o modal por cima de outro campo que o user acabou de tocar/escrever.
    if (mundialFormIsActiveV250() && !activeInsideMandatory) {
      mundialRunWhenFormIdleV250("openKnockoutMandatoryModalV247", () => openKnockoutMandatoryModalOriginalV250.apply(this, arguments));
      return false;
    }
    return openKnockoutMandatoryModalOriginalV250.apply(this, arguments);
  };
}

const renderKnockoutMandatoryModalOriginalV250 = typeof renderKnockoutMandatoryModalV247 === "function" ? renderKnockoutMandatoryModalV247 : null;
if (renderKnockoutMandatoryModalOriginalV250 && !window.__koMandatoryRenderFocusFixV250) {
  window.__koMandatoryRenderFocusFixV250 = true;
  renderKnockoutMandatoryModalV247 = function renderKnockoutMandatoryModalFocusFixV250() {
    const modal = document.getElementById("knockoutMandatoryModalV247");
    const active = mundialActiveTextFieldV250();
    const activeInsideMandatory = Boolean(active && modal && modal.contains(active));
    const body = document.getElementById("koMandatoryBodyV247");
    const hasRows = Boolean(body?.querySelector?.("[data-ko-mandatory-match]"));

    // Se o user está a preencher o próprio modal, não reconstruir o HTML.
    if (activeInsideMandatory && hasRows) {
      try {
        const subtitle = document.getElementById("koMandatorySubtitleV247");
        const player = knockoutMandatoryPlayerV247?.();
        const pending = knockoutMandatoryPendingMatchesV247?.() || [];
        if (subtitle && player) subtitle.textContent = `${player.name} - ${pending.length} aposta(s) por preencher`;
      } catch {}
      return undefined;
    }
    return renderKnockoutMandatoryModalOriginalV250.apply(this, arguments);
  };
}

const forceKnockoutAutoBetCheckOriginalV250 = typeof forceKnockoutAutoBetCheckV244 === "function" ? forceKnockoutAutoBetCheckV244 : null;
if (forceKnockoutAutoBetCheckOriginalV250 && !window.__koAutoForceFocusFixV250) {
  window.__koAutoForceFocusFixV250 = true;
  forceKnockoutAutoBetCheckV244 = function forceKnockoutAutoBetCheckFocusFixV250(delay = 500) {
    if (mundialFormIsActiveV250()) {
      mundialRunWhenFormIdleV250("forceKnockoutAutoBetCheckV244", () => forceKnockoutAutoBetCheckOriginalV250.call(this, delay));
      return undefined;
    }
    return forceKnockoutAutoBetCheckOriginalV250.apply(this, arguments);
  };
}

const queueRealtimeRenderOriginalV250 = typeof queueRealtimeRender === "function" ? queueRealtimeRender : null;
if (queueRealtimeRenderOriginalV250 && !window.__queueRealtimeFocusFixV250) {
  window.__queueRealtimeFocusFixV250 = true;
  queueRealtimeRender = function queueRealtimeRenderFocusFixV250(reason = "firebase realtime") {
    if (mundialFormIsActiveV250()) {
      mundialRunWhenFormIdleV250("queueRealtimeRender", () => queueRealtimeRenderOriginalV250.call(this, reason));
      return undefined;
    }
    return queueRealtimeRenderOriginalV250.apply(this, arguments);
  };
}

// Diagnóstico simples para testar no DevTools se voltar a acontecer.
window.debugFocusV250 = function debugFocusV250() {
  const active = document.activeElement;
  return {
    activeTag: active?.tagName || "",
    activeId: active?.id || "",
    activeClass: String(active?.className || ""),
    formActive: mundialFormIsActiveV250(),
    msSinceFormInteraction: Date.now() - mundialFormLastInteractionV250
  };
};

// v251 — lógica segura para detetar apostas obrigatórias da Fase Final.
// Esta camada centraliza a decisão "por apostar / apostado / fora do prazo" sem redesenhar o modal.
const KNOCKOUT_REQUIRED_VERSION_V251 = "251.0";
const KNOCKOUT_REQUIRED_LOCK_MINUTES_V251 = 5;

function knockoutRequiredNowV251() {
  return Date.now();
}

function knockoutRequiredDataReadyV251() {
  const missing = [];
  if (!currentUser) missing.push("auth/user");
  if (!currentProfile) missing.push("perfil");
  if (!appSettings) missing.push("definicoes");
  if (!appSettings?.knockout || !Array.isArray(appSettings.knockout.matches)) missing.push("jogos-fase-final");
  if (!Array.isArray(bets)) missing.push("apostas");
  return { ready: missing.length === 0, missing };
}

function knockoutRequiredCurrentPlayerV251() {
  try { return linkedPlayerForCurrentUserV241?.() || null; } catch { return null; }
}

function knockoutRequiredMatchStartMillisV251(match) {
  try {
    const time = knockoutMatchStartMillisV241?.(match) || 0;
    return Number.isFinite(Number(time)) ? Number(time) : 0;
  } catch {
    return 0;
  }
}

function knockoutRequiredDeadlineMillisV251(match) {
  const start = knockoutRequiredMatchStartMillisV251(match);
  return start ? start - (KNOCKOUT_REQUIRED_LOCK_MINUTES_V251 * 60 * 1000) : 0;
}

function knockoutRequiredHasFinalResultV251(match) {
  try { return Boolean(knockoutMatchHasResult?.(match)); } catch { return false; }
}

function knockoutRequiredExistingBetV251(player, match) {
  if (!player || !match?.id) return null;
  try {
    return knockoutBetForPlayerMatchV241?.(player.id, match.id) || null;
  } catch {
    return (bets || []).find(bet => String(bet?.playerId || "") === String(player.id || "") && String(bet?.gameId || "") === String(match.id || "")) || null;
  }
}

function knockoutRequiredReadinessV251(match) {
  const reasons = [];
  if (!match || !match.id) reasons.push("sem-id");
  if (!String(match?.homeTeam || "").trim()) reasons.push("sem-equipa-1");
  if (!String(match?.awayTeam || "").trim()) reasons.push("sem-equipa-2");
  if (!knockoutRequiredMatchStartMillisV251(match)) reasons.push("sem-data-hora");
  if (knockoutRequiredHasFinalResultV251(match)) reasons.push("resultado-lancado");

  return {
    ready: reasons.length === 0,
    reasons,
    startAt: knockoutRequiredMatchStartMillisV251(match),
    deadlineAt: knockoutRequiredDeadlineMillisV251(match)
  };
}

function knockoutRequiredDeadlineOpenV251(match, now = knockoutRequiredNowV251()) {
  const deadline = knockoutRequiredDeadlineMillisV251(match);
  return Boolean(deadline && Number(now) < deadline);
}

function knockoutRequiredStatusForMatchV251(match, player, now = knockoutRequiredNowV251()) {
  const readiness = knockoutRequiredReadinessV251(match);
  const bet = knockoutRequiredExistingBetV251(player, match);

  if (!readiness.ready) {
    return { key: "not-ready", label: "Não obrigatório", ready: false, reasons: readiness.reasons, bet: null, startAt: readiness.startAt, deadlineAt: readiness.deadlineAt };
  }

  if (!player) {
    return { key: "no-player", label: "Sem jogador ligado", ready: true, reasons: [], bet: null, startAt: readiness.startAt, deadlineAt: readiness.deadlineAt };
  }

  if (bet) {
    return { key: "done", label: "Apostado", ready: true, reasons: [], bet, startAt: readiness.startAt, deadlineAt: readiness.deadlineAt };
  }

  if (!knockoutRequiredDeadlineOpenV251(match, now)) {
    return { key: "missed", label: "Fora deste jogo", ready: true, reasons: [], bet: null, startAt: readiness.startAt, deadlineAt: readiness.deadlineAt };
  }

  return { key: "pending", label: "Por apostar", ready: true, reasons: [], bet: null, startAt: readiness.startAt, deadlineAt: readiness.deadlineAt };
}

function knockoutRequiredMatchSummaryV251(item) {
  const match = item.match || item;
  const status = item.status || knockoutRequiredStatusForMatchV251(match, knockoutRequiredCurrentPlayerV251());
  return {
    id: match?.id || "",
    round: match?.round || "",
    roundLabel: knockoutRoundLabel?.(match?.round) || match?.roundLabel || "Fase Final",
    index: match?.index || "",
    homeTeam: match?.homeTeam || "",
    awayTeam: match?.awayTeam || "",
    matchDate: match?.matchDate || match?.date || "",
    startAt: status.startAt || 0,
    deadlineAt: status.deadlineAt || 0,
    status: status.key,
    label: status.label,
    reasons: status.reasons || [],
    hasBet: Boolean(status.bet)
  };
}

function knockoutRequiredDetectionV251(options = {}) {
  const now = Number(options.now || knockoutRequiredNowV251());
  const data = knockoutRequiredDataReadyV251();
  const player = knockoutRequiredCurrentPlayerV251();
  const report = {
    version: KNOCKOUT_REQUIRED_VERSION_V251,
    dataReady: data.ready,
    missingData: data.missing,
    hasCurrentUser: Boolean(currentUser),
    userEmail: normalizeEmail?.(currentUser?.email || "") || "",
    profileRole: currentProfile?.role || "",
    profileActive: currentProfile?.active !== false,
    player: player ? { id: player.id, name: player.name } : null,
    mandatory: [],
    pending: [],
    missed: [],
    done: [],
    notReady: [],
    counts: { mandatory: 0, pending: 0, missed: 0, done: 0, notReady: 0 }
  };

  if (!data.ready || currentProfile?.active === false) {
    return report;
  }

  try { ensureKnockoutSettings?.(); } catch {}

  const matches = (typeof knockoutMatches === "function" ? knockoutMatches() : appSettings?.knockout?.matches || []) || [];
  matches.forEach(match => {
    const status = knockoutRequiredStatusForMatchV251(match, player, now);
    const item = { match, status };

    if (status.ready) report.mandatory.push(item);
    else report.notReady.push(item);

    if (status.key === "pending") report.pending.push(item);
    else if (status.key === "missed") report.missed.push(item);
    else if (status.key === "done") report.done.push(item);
  });

  const sortByStart = (a, b) => (a.status.startAt || 9999999999999) - (b.status.startAt || 9999999999999) || String(a.match?.id || "").localeCompare(String(b.match?.id || ""));
  report.mandatory.sort(sortByStart);
  report.pending.sort(sortByStart);
  report.missed.sort(sortByStart);
  report.done.sort(sortByStart);
  report.notReady.sort(sortByStart);
  report.counts = {
    mandatory: report.mandatory.length,
    pending: report.pending.length,
    missed: report.missed.length,
    done: report.done.length,
    notReady: report.notReady.length
  };
  return report;
}

function knockoutRequiredDebugReportV251(options = {}) {
  const report = knockoutRequiredDetectionV251(options);
  return {
    version: report.version,
    dataReady: report.dataReady,
    missingData: report.missingData,
    hasCurrentUser: report.hasCurrentUser,
    userEmail: report.userEmail,
    profileRole: report.profileRole,
    profileActive: report.profileActive,
    player: report.player,
    counts: report.counts,
    pending: report.pending.map(knockoutRequiredMatchSummaryV251),
    missed: report.missed.map(knockoutRequiredMatchSummaryV251),
    done: report.done.map(knockoutRequiredMatchSummaryV251),
    mandatory: report.mandatory.map(knockoutRequiredMatchSummaryV251),
    notReady: report.notReady.map(knockoutRequiredMatchSummaryV251)
  };
}

// Liga a lógica antiga dos painéis/modais à função central v251.
if (!window.__knockoutRequiredLogicV251) {
  window.__knockoutRequiredLogicV251 = true;

  try {
    knockoutMatchReadyForBetV245 = function knockoutMatchReadyForBetV251(match) {
      return knockoutRequiredReadinessV251(match).ready;
    };
  } catch {}

  try {
    currentUserRequiredKnockoutBetsV245 = function currentUserRequiredKnockoutBetsV251() {
      return knockoutRequiredDetectionV251().pending.map(item => item.match);
    };
    currentUserMissedKnockoutBetsV245 = function currentUserMissedKnockoutBetsV251() {
      return knockoutRequiredDetectionV251().missed.map(item => item.match);
    };
    currentUserDoneKnockoutBetsV245 = function currentUserDoneKnockoutBetsV251() {
      return knockoutRequiredDetectionV251().done.map(item => item.match);
    };
  } catch {}

  try {
    knockoutMatchMandatoryReadyV247 = function knockoutMatchMandatoryReadyV251(match) {
      return knockoutRequiredReadinessV251(match).ready;
    };
    knockoutBetDeadlineMillisV247 = function knockoutBetDeadlineMillisV251(match) {
      return knockoutRequiredDeadlineMillisV251(match);
    };
    knockoutMandatoryDeadlineOpenV247 = function knockoutMandatoryDeadlineOpenV251(match) {
      return knockoutRequiredDeadlineOpenV251(match);
    };
    knockoutMandatoryDataReadyV247 = function knockoutMandatoryDataReadyV251() {
      return knockoutRequiredDataReadyV251().ready;
    };
    knockoutMandatoryPlayerV247 = function knockoutMandatoryPlayerV251() {
      return knockoutRequiredCurrentPlayerV251();
    };
    knockoutMandatoryPendingMatchesV247 = function knockoutMandatoryPendingMatchesV251() {
      return knockoutRequiredDetectionV251().pending.map(item => item.match);
    };
    knockoutMandatoryMissedMatchesV247 = function knockoutMandatoryMissedMatchesV251() {
      return knockoutRequiredDetectionV251().missed.map(item => item.match);
    };
    knockoutMandatoryDoneMatchesV247 = function knockoutMandatoryDoneMatchesV251() {
      return knockoutRequiredDetectionV251().done.map(item => item.match);
    };
    knockoutMandatoryStatusV247 = function knockoutMandatoryStatusV251(match) {
      const status = knockoutRequiredStatusForMatchV251(match, knockoutRequiredCurrentPlayerV251());
      return { key: status.key, label: status.label };
    };
  } catch {}

  try {
    eligibleAutoKnockoutBetMatchesV243 = function eligibleAutoKnockoutBetMatchesV251() {
      return knockoutRequiredDetectionV251().pending.map(item => item.match);
    };
  } catch {}

  window.getKnockoutRequiredDetectionV251 = knockoutRequiredDetectionV251;
  window.debugKnockoutRequiredV251 = knockoutRequiredDebugReportV251;
}

// v252 — Modal automático obrigatório ligado à lógica segura v251.
// Nesta fase o modal não inventa regras: só abre quando o relatório central v251
// diz que há apostas pendentes reais da Fase Final.
const KNOCKOUT_MANDATORY_VERSION_V252 = "252.0";
let knockoutMandatoryTimerV252 = null;
let knockoutMandatoryOpeningV252 = false;

function knockoutMandatoryReportV252() {
  try {
    return knockoutRequiredDetectionV251?.() || null;
  } catch (error) {
    console.warn("Relatório obrigatório Fase Final v252 falhou:", error);
    return null;
  }
}

function knockoutMandatoryFormBusyV252() {
  try {
    if (typeof window.__isMundialTextFieldActiveV250 === "function" && window.__isMundialTextFieldActiveV250()) return true;
  } catch {}
  const active = document.activeElement;
  if (!active) return false;
  try {
    return Boolean(active.closest?.("input, select, textarea, [contenteditable='true'], [contenteditable=''], [contenteditable='plaintext-only']"));
  } catch {
    return false;
  }
}

function knockoutMandatoryModalVisibleV252() {
  const modal = document.getElementById("knockoutMandatoryModalV247");
  return Boolean(modal && !modal.classList.contains("hidden"));
}

function knockoutMandatoryPendingItemsV252() {
  const report = knockoutMandatoryReportV252();
  if (!report?.dataReady) return [];
  return Array.isArray(report.pending) ? report.pending : [];
}

function knockoutMandatoryPendingMatchesV252() {
  return knockoutMandatoryPendingItemsV252().map(item => item.match).filter(Boolean);
}

function knockoutMandatoryCanAutoOpenV252() {
  const report = knockoutMandatoryReportV252();
  if (!report?.dataReady) return { ok: false, reason: "dados-a-carregar", report };
  if (!report.player) return { ok: false, reason: "sem-jogador", report };
  if (currentProfile?.active === false) return { ok: false, reason: "user-inativo", report };
  if (!report.pending?.length) return { ok: false, reason: "sem-pendentes", report };
  if (document.hidden) return { ok: false, reason: "documento-oculto", report };
  return { ok: true, reason: "pendentes", report };
}

function runKnockoutMandatoryCheckV252() {
  clearTimeout(knockoutMandatoryTimerV252);
  knockoutMandatoryTimerV252 = null;

  if (knockoutMandatoryOpeningV252) return false;

  const decision = knockoutMandatoryCanAutoOpenV252();

  if (!decision.ok) {
    if (decision.report?.dataReady && !decision.report?.pending?.length) {
      try { closeKnockoutMandatoryModalV247?.(true); } catch {}
    } else if (!decision.report?.dataReady) {
      scheduleKnockoutMandatoryCheckV252(900);
    }
    return false;
  }

  const visible = knockoutMandatoryModalVisibleV252();
  if (knockoutMandatoryFormBusyV252() && !visible) {
    scheduleKnockoutMandatoryCheckV252(1200);
    return false;
  }

  knockoutMandatoryOpeningV252 = true;
  try {
    if (typeof renderKnockoutMandatoryModalV247 === "function" && visible) {
      // Se o modal já está aberto, deixa o render protegido da v250 decidir se pode atualizar.
      renderKnockoutMandatoryModalV247();
    }
    if (typeof openKnockoutMandatoryModalV247 === "function") {
      return openKnockoutMandatoryModalV247();
    }
  } catch (error) {
    console.warn("Abrir modal obrigatório Fase Final v252 falhou:", error);
  } finally {
    knockoutMandatoryOpeningV252 = false;
  }
  return false;
}

function scheduleKnockoutMandatoryCheckV252(delay = 700) {
  clearTimeout(knockoutMandatoryTimerV252);
  knockoutMandatoryTimerV252 = setTimeout(runKnockoutMandatoryCheckV252, Math.max(80, Number(delay) || 700));
}

if (!window.__koMandatoryModalV252) {
  window.__koMandatoryModalV252 = true;

  // A lista do modal passa a vir diretamente do relatório seguro v251.
  try {
    knockoutMandatoryPendingMatchesV247 = function knockoutMandatoryPendingMatchesV252Adapter() {
      return knockoutMandatoryPendingMatchesV252();
    };
    knockoutMandatoryMissedMatchesV247 = function knockoutMandatoryMissedMatchesV252Adapter() {
      const report = knockoutMandatoryReportV252();
      return report?.dataReady ? (report.missed || []).map(item => item.match).filter(Boolean) : [];
    };
    knockoutMandatoryDoneMatchesV247 = function knockoutMandatoryDoneMatchesV252Adapter() {
      const report = knockoutMandatoryReportV252();
      return report?.dataReady ? (report.done || []).map(item => item.match).filter(Boolean) : [];
    };
    knockoutMandatoryDataReadyV247 = function knockoutMandatoryDataReadyV252Adapter() {
      return Boolean(knockoutMandatoryReportV252()?.dataReady);
    };
  } catch {}

  // Substitui os checks antigos por uma entrada única e previsível.
  if (typeof runKnockoutMandatoryCheckV247 === "function") {
    runKnockoutMandatoryCheckV247 = function runKnockoutMandatoryCheckV252Adapter() {
      return runKnockoutMandatoryCheckV252();
    };
  }
  if (typeof scheduleKnockoutMandatoryCheckV247 === "function") {
    scheduleKnockoutMandatoryCheckV247 = function scheduleKnockoutMandatoryCheckV252Adapter(delay = 700) {
      return scheduleKnockoutMandatoryCheckV252(delay);
    };
  }

  // Neutraliza o modal antigo de jogo único: o automático passa a ser só o modal obrigatório.
  try {
    maybeOpenNextKnockoutBetModalV243 = function maybeOpenNextKnockoutBetModalV252() {
      return runKnockoutMandatoryCheckV252();
    };
    scheduleKnockoutAutoBetCheckV243 = function scheduleKnockoutAutoBetCheckV252(delay = 700) {
      return scheduleKnockoutMandatoryCheckV252(delay);
    };
    forceKnockoutAutoBetCheckV244 = function forceKnockoutAutoBetCheckV252(delay = 500) {
      return scheduleKnockoutMandatoryCheckV252(delay);
    };
  } catch {}

  // Gatilhos leves: auth/Firebase/render/navegação já chamam funções antigas,
  // mas estes cobrem entrada/reentrada da app sem criar loops pesados.
  document.addEventListener("DOMContentLoaded", () => scheduleKnockoutMandatoryCheckV252(1800));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleKnockoutMandatoryCheckV252(350); });
  window.addEventListener("focus", () => scheduleKnockoutMandatoryCheckV252(450));

  document.addEventListener("click", event => {
    if (!event.target?.closest?.(".tabs [data-tab], .app-nav, .bottom-nav, [data-route], .sidebar")) return;
    scheduleKnockoutMandatoryCheckV252(120);
  }, true);

  window.debugKnockoutMandatoryModalV252 = function debugKnockoutMandatoryModalV252() {
    const decision = knockoutMandatoryCanAutoOpenV252();
    return {
      version: KNOCKOUT_MANDATORY_VERSION_V252,
      decision: decision.reason,
      canOpen: decision.ok,
      formBusy: knockoutMandatoryFormBusyV252(),
      modalVisible: knockoutMandatoryModalVisibleV252(),
      report: typeof debugKnockoutRequiredV251 === "function" ? debugKnockoutRequiredV251() : decision.report
    };
  };
  window.forceKnockoutMandatoryModalV252 = function forceKnockoutMandatoryModalV252() {
    return runKnockoutMandatoryCheckV252();
  };

  scheduleKnockoutMandatoryCheckV252(2200);
}

