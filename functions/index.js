const admin = require("firebase-admin");


if (!admin.apps.length) admin.initializeApp();
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { getAuth } = require("firebase-admin/auth");
const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

const db = getFirestore();
const messaging = getMessaging();
const auth = getAuth();
const ADMIN_EMAILS = new Set(["pica.fern@gmail.com"]);
const FOOTBALL_SYSTEM_ACTOR_V151 = { uid: "scheduler", email: "sistema@app-mundial2026" };
const QUIET_TZ = "Europe/Lisbon";
const DEFAULT_QUIET_START_HOUR = 23;
const DEFAULT_QUIET_END_HOUR = 9;
function cleanString(value, fallback = "") {
  return String(value || fallback).trim();
}

function normalizeEmail(value) {
  return cleanString(value).toLowerCase().trim();
}


function shortText(value, max = 120) {
  const text = cleanString(value).replace(/\s+/g, " ");
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function normalize(value) {
  return cleanString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasResult(game) {
  return game && game.homeScore !== null && game.homeScore !== undefined && game.homeScore !== "" &&
    game.awayScore !== null && game.awayScore !== undefined && game.awayScore !== "";
}

function scoreChanged(before, after) {
  return String(before?.homeScore ?? "") !== String(after?.homeScore ?? "") ||
    String(before?.awayScore ?? "") !== String(after?.awayScore ?? "");
}

function gameStatus(value) {
  return cleanString(value?.footballDataStatus || value?.statusApi || value?.status).toUpperCase();
}

function isLiveGameStatus(value) {
  return ["IN_PLAY", "PAUSED", "LIVE"].includes(gameStatus(value));
}

function isFinishedGameStatus(value) {
  return ["FINISHED", "AWARDED"].includes(gameStatus(value));
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function effectiveGameScore(value) {
  const liveHome = numberOrNull(value?.liveHomeScore);
  const liveAway = numberOrNull(value?.liveAwayScore);
  if (liveHome !== null && liveAway !== null) return { home: liveHome, away: liveAway };
  const home = numberOrNull(value?.homeScore);
  const away = numberOrNull(value?.awayScore);
  if (home !== null && away !== null) return { home, away };
  return null;
}

function gameLabel(value) {
  return `${cleanString(value?.homeTeam, "Casa")} vs ${cleanString(value?.awayTeam, "Fora")}`;
}

function notificationUrl(open, type, room = "") {
  const params = new URLSearchParams();
  params.set("open", open);
  params.set("notif", type);
  if (room) params.set("room", room);
  return `./index.html?${params.toString()}`;
}

function tokenAliases(tokenData) {
  const name = cleanString(tokenData.name);
  const email = cleanString(tokenData.email);
  const first = name.split(/\s+/)[0] || "";
  const emailUser = email.split("@")[0] || "";
  return [name, first, emailUser]
    .map(normalize)
    .filter(alias => alias.length >= 2);
}

function messageMentionsToken(text, tokenData) {
  const normalizedText = normalize(text);
  return tokenAliases(tokenData).some(alias => normalizedText.includes(`@${alias}`));
}

function lisbonHourNow() {
  const parts = new Intl.DateTimeFormat("pt-PT", {
    timeZone: QUIET_TZ,
    hour: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  return Number(parts.find(part => part.type === "hour")?.value || "0");
}

function isHourInRange(hour, start, end) {
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

function tokenInQuietHours(tokenData) {
  const quiet = tokenData?.quietHours || {};
  if (quiet.enabled === false) return false;
  const start = Number.isFinite(Number(quiet.startHour)) ? Number(quiet.startHour) : DEFAULT_QUIET_START_HOUR;
  const end = Number.isFinite(Number(quiet.endHour)) ? Number(quiet.endHour) : DEFAULT_QUIET_END_HOUR;
  return isHourInRange(lisbonHourNow(), start, end);
}

async function loadEnabledTokens({ room = "", pref = "", adminOnly = false, excludeUid = "", onlyUid = "", ignoreQuietHours = false } = {}) {
  const snap = await db.collection("notificationTokens").where("enabled", "==", true).get();
  return snap.docs
    .map(doc => ({ id: doc.id, ref: doc.ref, data: doc.data() || {} }))
    .filter(item => item.data.token)
    .filter(item => !onlyUid || item.data.uid === onlyUid)
    .filter(item => !excludeUid || item.data.uid !== excludeUid)
    .filter(item => !pref || item.data.preferences?.[pref] !== false)
    .filter(item => ignoreQuietHours || !tokenInQuietHours(item.data))
    .filter(item => !room || item.data.rooms?.[room] === true)
    .filter(item => !adminOnly || item.data.rooms?.admin === true || ADMIN_EMAILS.has(cleanString(item.data.email).toLowerCase()));
}

async function markInvalidToken(item, error) {
  const code = error?.code || "";
  if (!code.includes("registration-token-not-registered") && !code.includes("invalid-registration-token")) return;
  try {
    await item.ref.set({
      enabled: false,
      invalidAt: FieldValue.serverTimestamp(),
      invalidReason: code
    }, { merge: true });
  } catch (writeError) {
    logger.warn("Nao consegui marcar token invalido", writeError);
  }
}

async function sendTokenNotifications(items, buildPayload) {
  const sends = items.map(async item => {
    const payload = buildPayload(item.data);
    if (!payload) return null;
    try {
      await messaging.send({ token: item.data.token, ...payload });
      return true;
    } catch (error) {
      logger.warn("Notificacao falhou", { tokenDoc: item.id, code: error?.code });
      await markInvalidToken(item, error);
      return false;
    }
  });
  const results = await Promise.all(sends);
  return results.filter(Boolean).length;
}

async function notifyChatMessage(room, messageId, message, adminOnly = false) {
  if (!message || message.type === "system") return;
  const text = shortText(message.text || (message.imageData ? "Imagem" : message.audioData ? "Audio" : "Nova mensagem"));
  const senderName = cleanString(message.name, "Alguem");
  const roomPref = room === "admin" ? "chatAdmin" : "chatGeneral";
  const tokens = await loadEnabledTokens({ room, adminOnly, excludeUid: message.uid || "" });

  const sent = await sendTokenNotifications(tokens, tokenData => {
    const mentioned = messageMentionsToken(message.text || "", tokenData);
    if (mentioned && tokenData.preferences?.mentions === false) return null;
    if (!mentioned && tokenData.preferences?.[roomPref] === false) return null;

    const type = mentioned ? "mention" : (room === "admin" ? "chat_admin" : "chat_general");
    const title = mentioned ? `${senderName} mencionou-te` : (room === "admin" ? "Nova mensagem no chat admin" : "Nova mensagem no chat geral");
    const body = `${senderName}: ${text}`;
    return {
      notification: { title, body },
      data: {
        type,
        room,
        id: messageId,
        uid: cleanString(message.uid),
        title,
        body,
        tag: `mundial-${type}-${messageId}`,
        url: notificationUrl("chat", type, room)
      }
    };
  });
  logger.info("Notificacoes de chat enviadas", { room, messageId, sent });
}

exports.notifyGeneralChat = onDocumentCreated("chatMessages/{messageId}", async event => {
  await notifyChatMessage("general", event.params.messageId, event.data?.data() || {}, false);
});

exports.notifyAdminChat = onDocumentCreated("chatAdminMessages/{messageId}", async event => {
  await notifyChatMessage("admin", event.params.messageId, event.data?.data() || {}, true);
});

exports.notifyResultSaved = onDocumentWritten("games/{gameId}", async event => {
  const before = event.data?.before?.data() || null;
  const after = event.data?.after?.data() || null;
  if (!after || !hasResult(after) || !scoreChanged(before, after)) return;

  const home = cleanString(after.homeTeam, "Casa");
  const away = cleanString(after.awayTeam, "Fora");
  const score = `${after.homeScore}-${after.awayScore}`;
  const title = "Resultado novo guardado";
  const body = `${home} ${score} ${away}`;
  const tokens = await loadEnabledTokens({ pref: "results", excludeUid: after.updatedBy || "" });

  const sent = await sendTokenNotifications(tokens, () => ({
    notification: { title, body },
    data: {
      type: "result",
      id: event.params.gameId,
      uid: cleanString(after.updatedBy),
      title,
      body,
      tag: `mundial-result-${event.params.gameId}`,
      url: notificationUrl("calendar", "result")
    }
  }));
  logger.info("Notificacoes de resultado enviadas", { gameId: event.params.gameId, sent });
});

exports.notifyGameLiveEvents = onDocumentWritten("games/{gameId}", async event => {
  const before = event.data?.before?.data() || null;
  const after = event.data?.after?.data() || null;
  if (!after) return;

  const home = cleanString(after.homeTeam, "Casa");
  const away = cleanString(after.awayTeam, "Fora");
  const label = `${home} vs ${away}`;
  const beforeScore = effectiveGameScore(before);
  const afterScore = effectiveGameScore(after);
  const started = !isLiveGameStatus(before) && isLiveGameStatus(after);
  const finished = !isFinishedGameStatus(before) && isFinishedGameStatus(after);
  const goalHome = afterScore && (afterScore.home > (beforeScore?.home ?? 0)) && (isLiveGameStatus(after) || isLiveGameStatus(before));
  const goalAway = afterScore && (afterScore.away > (beforeScore?.away ?? 0)) && (isLiveGameStatus(after) || isLiveGameStatus(before));

  const jobs = [];

  if (started) {
    jobs.push({
      pref: "gameStart",
      title: "Jogo começou",
      body: label,
      type: "game_start",
      tag: `mundial-game-start-${event.params.gameId}`
    });
  }

  if (goalHome || goalAway) {
    const scorer = goalHome && goalAway ? "Golos no jogo" : `Golo ${goalHome ? home : away}`;
    const score = afterScore ? `${afterScore.home}-${afterScore.away}` : "";
    jobs.push({
      pref: "goals",
      title: scorer,
      body: score ? `${home} ${score} ${away}` : label,
      type: "goal",
      tag: `mundial-goal-${event.params.gameId}-${afterScore?.home ?? "x"}-${afterScore?.away ?? "x"}`
    });
  }

  if (finished) {
    const score = afterScore ? `${afterScore.home}-${afterScore.away}` : "";
    jobs.push({
      pref: "gameEnd",
      title: "Jogo acabou",
      body: score ? `${home} ${score} ${away}` : label,
      type: "game_end",
      tag: `mundial-game-end-${event.params.gameId}`
    });
  }

  for (const job of jobs) {
    const tokens = await loadEnabledTokens({ pref: job.pref, excludeUid: after.updatedBy || "" });
    const sent = await sendTokenNotifications(tokens, () => ({
      notification: { title: job.title, body: job.body },
      data: {
        type: job.type,
        id: event.params.gameId,
        uid: cleanString(after.updatedBy),
        title: job.title,
        body: job.body,
        tag: job.tag,
        url: notificationUrl("calendar", job.type)
      }
    }));
    logger.info("Notificacoes de evento de jogo enviadas", { gameId: event.params.gameId, type: job.type, sent });
  }
});

function knockoutSignal(settings) {
  const knockout = settings?.knockout || {};
  return JSON.stringify({
    adminUnlocked: Boolean(knockout.adminUnlocked),
    matches: Array.isArray(knockout.matches) ? knockout.matches.map(match => ({
      id: match.id || "",
      homeTeam: match.homeTeam || "",
      awayTeam: match.awayTeam || "",
      homeScore: match.homeScore ?? "",
      awayScore: match.awayScore ?? "",
      homePenalties: match.homePenalties ?? "",
      awayPenalties: match.awayPenalties ?? ""
    })) : []
  });
}

exports.notifyKnockoutUpdated = onDocumentWritten("settings/main", async event => {
  const before = event.data?.before?.data() || {};
  const after = event.data?.after?.data() || {};
  if (!after.knockout || knockoutSignal(before) === knockoutSignal(after)) return;

  const title = "Fase final atualizada";
  const body = "A fase final do Mundial Pontos 2026 foi alterada.";
  const tokens = await loadEnabledTokens({ pref: "knockout", excludeUid: after.updatedBy || "" });

  const sent = await sendTokenNotifications(tokens, () => ({
    notification: { title, body },
    data: {
      type: "knockout",
      id: "settings-main",
      uid: cleanString(after.updatedBy),
      title,
      body,
      tag: "mundial-knockout-updated",
      url: notificationUrl("knockout", "knockout")
    }
  }));
  logger.info("Notificacoes da fase final enviadas", { sent });
});

exports.notifyTestNotification = onDocumentCreated("notificationTests/{testId}", async event => {
  const test = event.data?.data() || {};
  if (!test.uid) return;
  if (test.source === "requestPushTest-clean") return;

  const title = "Teste Firebase";
  const body = "As notificacoes da app estao a funcionar neste dispositivo.";
  const tokens = await loadEnabledTokens({ onlyUid: test.uid });

  const sent = await sendTokenNotifications(tokens, () => ({
    notification: { title, body },
    data: {
      type: "test",
      id: event.params.testId,
      uid: cleanString(test.uid),
      title,
      body,
      tag: `mundial-notification-test-${event.params.testId}`,
      url: notificationUrl("chat", "test", "general")
    }
  }));

  await event.data.ref.set({
    sent,
    checkedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  logger.info("Notificacao de teste enviada", { testId: event.params.testId, sent });
});



const FOOTBALL_TEAM_ALIASES = {
  "mexico": "mexico",
  "south africa": "africa do sul",
  "korea republic": "coreia do sul",
  "south korea": "coreia do sul",
  "czechia": "chequia",
  "czech republic": "chequia",
  "canada": "canada",
  "bosnia and herzegovina": "bosnia",
  "bosnia-herzegovina": "bosnia",
  "bosnia": "bosnia",
  "qatar": "qatar",
  "switzerland": "suica",
  "brazil": "brasil",
  "morocco": "marrocos",
  "haiti": "haiti",
  "scotland": "escocia",
  "australia": "australia",
  "turkiye": "turquia",
  "turkey": "turquia",
  "germany": "alemanha",
  "curacao": "curacao",
  "curaçao": "curacao",
  "netherlands": "paises baixos",
  "japan": "japao",
  "cote divoire": "costa do marfim",
  "cote d ivoire": "costa do marfim",
  "côte divoire": "costa do marfim",
  "ivory coast": "costa do marfim",
  "ecuador": "equador",
  "sweden": "suecia",
  "tunisia": "tunisia",
  "spain": "espanha",
  "cape verde": "cabo verde",
  "belgium": "belgica",
  "egypt": "egito",
  "saudi arabia": "arabia saudita",
  "uruguay": "uruguai",
  "iran": "irao",
  "new zealand": "nova zelandia",
  "france": "franca",
  "senegal": "senegal",
  "iraq": "iraque",
  "norway": "noruega",
  "argentina": "argentina",
  "algeria": "argelia",
  "austria": "austria",
  "jordan": "jordania",
  "dr congo": "rd congo",
  "democratic republic of congo": "rd congo",
  "congo dr": "rd congo",
  "england": "inglaterra",
  "croatia": "croacia",
  "ghana": "gana",
  "panama": "panama",
  "uzbekistan": "uzbequistao",
  "colombia": "colombia",
  "united states": "estados unidos",
  "usa": "estados unidos",
  "paraguay": "paraguai"
};

function footballNormalize(value) {
  return cleanString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function footballTeamKey(value) {
  const base = footballNormalize(value);
  return FOOTBALL_TEAM_ALIASES[base] || base;
}

function footballApiTeamName(team) {
  return cleanString(team?.name || team?.shortName || team?.tla || "");
}

function footballApiScore(match) {
  const full = match?.score?.fullTime || {};
  const regular = match?.score?.regularTime || {};
  const penalties = match?.score?.penalties || {};

  const home = full.home ?? regular.home;
  const away = full.away ?? regular.away;

  if (home === null || home === undefined || away === null || away === undefined) return null;

  return {
    homeScore: Number(home),
    awayScore: Number(away),
    homePenalties: penalties.home === null || penalties.home === undefined ? null : Number(penalties.home),
    awayPenalties: penalties.away === null || penalties.away === undefined ? null : Number(penalties.away)
  };
}

function footballMatchDateMillis(value) {
  const millis = new Date(value || "").getTime();
  return Number.isFinite(millis) ? millis : 0;
}

function footballSamePair(apiMatch, localMatch) {
  const apiHome = footballTeamKey(footballApiTeamName(apiMatch.homeTeam));
  const apiAway = footballTeamKey(footballApiTeamName(apiMatch.awayTeam));
  const localHome = footballTeamKey(localMatch.homeTeam);
  const localAway = footballTeamKey(localMatch.awayTeam);
  return apiHome && apiAway && apiHome === localHome && apiAway === localAway;
}

function footballFindLocalMatch(apiMatch, localMatches) {
  const apiId = String(apiMatch.id || "");
  if (apiId) {
    const byExternal = localMatches.find(match => String(match.footballDataId || match.externalId || "") === apiId);
    if (byExternal) return byExternal;
  }

  const sameTeams = localMatches.filter(match => footballSamePair(apiMatch, match));
  if (!sameTeams.length) return null;
  if (sameTeams.length === 1) return sameTeams[0];

  const apiDate = footballMatchDateMillis(apiMatch.utcDate);
  if (!apiDate) return sameTeams[0];

  return sameTeams
    .map(match => ({ match, diff: Math.abs(footballMatchDateMillis(match.matchDate || match.utcDate || match.date) - apiDate) }))
    .sort((a, b) => a.diff - b.diff)[0]?.match || sameTeams[0];
}

async function assertFootballDataAdminV147(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    const err = new Error("Login Firebase em falta.");
    err.status = 401;
    throw err;
  }

  const decoded = await auth.verifyIdToken(token);
  const email = normalizeEmail(decoded.email || "");
  if (!email) {
    const err = new Error("Email Firebase em falta.");
    err.status = 403;
    throw err;
  }

  if (ADMIN_EMAILS.has(email)) return { uid: decoded.uid, email };

  let profile = {};
  try {
    const byEmail = await db.collection("users").doc(email).get();
    if (byEmail.exists) profile = byEmail.data() || {};
  } catch {}

  try {
    if (!Object.keys(profile).length && decoded.uid) {
      const byUid = await db.collection("users").doc(decoded.uid).get();
      if (byUid.exists) profile = byUid.data() || {};
    }
  } catch {}

  const role = cleanString(profile.role || profile.tipo || "").toLowerCase();
  const permissions = profile.permissions || profile.permissoes || {};
  const canEdit =
    profile.active !== false &&
    profile.ativo !== false &&
    (
      role === "admin" ||
      role === "administrador" ||
      role === "master" ||
      permissions.editResults === true ||
      permissions.editarResultados === true ||
      permissions.admin === true
    );

  if (!canEdit) {
    const err = new Error("Sem permissão para atualizar resultados.");
    err.status = 403;
    throw err;
  }

  return { uid: decoded.uid, email };
}


function footballFormatDateYmd(date) {
  return date.toISOString().slice(0, 10);
}

function footballDateWindow(daysBefore = 1, daysAfter = 7) {
  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - daysBefore);
  const to = new Date(now);
  to.setUTCDate(to.getUTCDate() + daysAfter);
  return { from: footballFormatDateYmd(from), to: footballFormatDateYmd(to) };
}

function footballMatchSummary(match) {
  const score = footballApiScore(match);
  return {
    footballDataId: String(match.id || ""),
    utcDate: cleanString(match.utcDate),
    status: cleanString(match.status),
    stage: cleanString(match.stage),
    group: cleanString(match.group),
    homeTeam: footballApiTeamName(match.homeTeam),
    awayTeam: footballApiTeamName(match.awayTeam),
    homeScore: score?.homeScore ?? null,
    awayScore: score?.awayScore ?? null,
    homePenalties: score?.homePenalties ?? null,
    awayPenalties: score?.awayPenalties ?? null
  };
}

function footballShouldLockMatch(match) {
  const status = String(match?.status || "").toUpperCase();
  return status && !["SCHEDULED", "TIMED", "POSTPONED"].includes(status);
}

function footballReadableSyncMode(mode) {
  if (String(mode || "").includes("smart")) return "Inteligente";
  if (mode === "auto") return "Automático";
  return "Manual";
}



function footballApiAnyScoreV153(match) {
  const score = match?.score || {};
  const candidates = [
    score.fullTime,
    score.regularTime,
    score.halfTime
  ].filter(Boolean);

  for (const item of candidates) {
    const home = item.home;
    const away = item.away;
    if (home !== null && home !== undefined && away !== null && away !== undefined) {
      const penalties = score.penalties || {};
      return {
        homeScore: Number(home),
        awayScore: Number(away),
        homePenalties: penalties.home === null || penalties.home === undefined ? null : Number(penalties.home),
        awayPenalties: penalties.away === null || penalties.away === undefined ? null : Number(penalties.away)
      };
    }
  }

  return null;
}

function footballIsFinishedV153(match) {
  return ["FINISHED", "AWARDED"].includes(String(match?.status || "").toUpperCase());
}

function footballMatchPayloadV153(apiMatch, actor, score = null) {
  const payload = {
    footballDataId: String(apiMatch.id || ""),
    footballDataStatus: cleanString(apiMatch.status),
    footballDataStage: cleanString(apiMatch.stage),
    footballDataGroup: cleanString(apiMatch.group),
    footballDataUtcDate: cleanString(apiMatch.utcDate),
    footballDataLocked: footballShouldLockMatch(apiMatch),
    footballDataUpdatedBy: actor.email,
    source: "football-data.org",
    updatedAt: new Date().toISOString(),
    firebaseUpdatedAt: FieldValue.serverTimestamp()
  };

  if (score) {
    payload.homeScore = score.homeScore;
    payload.awayScore = score.awayScore;
    if (score.homePenalties !== null && score.homePenalties !== undefined) payload.homePenalties = score.homePenalties;
    if (score.awayPenalties !== null && score.awayPenalties !== undefined) payload.awayPenalties = score.awayPenalties;
  }

  return payload;
}


function footballMatchPayloadV158(apiMatch, actor, score = null) {
  const apiStatus = String(apiMatch?.status || "").toUpperCase();
  const isFinished = ["FINISHED", "AWARDED"].includes(apiStatus);

  const payload = {
    footballDataId: String(apiMatch.id || ""),
    footballDataStatus: cleanString(apiMatch.status),
    footballDataStage: cleanString(apiMatch.stage),
    footballDataGroup: cleanString(apiMatch.group),
    footballDataUtcDate: cleanString(apiMatch.utcDate),
    footballDataLocked: footballShouldLockMatch(apiMatch),
    footballDataUpdatedBy: actor.email,
    source: "football-data.org",
    updatedAt: new Date().toISOString(),
    firebaseUpdatedAt: FieldValue.serverTimestamp()
  };

  if (score && isFinished) {
    payload.homeScore = score.homeScore;
    payload.awayScore = score.awayScore;
    payload.liveHomeScore = FieldValue.delete();
    payload.liveAwayScore = FieldValue.delete();
    if (score.homePenalties !== null && score.homePenalties !== undefined) payload.homePenalties = score.homePenalties;
    if (score.awayPenalties !== null && score.awayPenalties !== undefined) payload.awayPenalties = score.awayPenalties;
  } else if (score) {
    payload.liveHomeScore = score.homeScore;
    payload.liveAwayScore = score.awayScore;
    payload.liveUpdatedAt = new Date().toISOString();
  }

  return payload;
}


const SMART_SYNC_PRE_START_MS_V201 = 5 * 60 * 1000;
const SMART_SYNC_POST_FINISH_MS_V201 = 5 * 60 * 1000;
const SMART_SYNC_LATE_CONFIRM_MS_V201 = 6 * 60 * 60 * 1000;

function footballSmartStatusV201(game = {}) {
  return cleanString(game.footballDataStatus || game.statusApi || game.status).toUpperCase();
}

function footballSmartDateMillisV201(game = {}) {
  const value = game.matchDate || game.footballDataUtcDate || game.utcDate || game.date || game.startTime;
  const millis = new Date(value || "").getTime();
  return Number.isFinite(millis) ? millis : 0;
}

function footballSmartHasFinalScoreV201(game = {}) {
  return game.homeScore !== null && game.homeScore !== undefined && game.homeScore !== "" &&
    game.awayScore !== null && game.awayScore !== undefined && game.awayScore !== "";
}

function footballSmartIsLiveStatusV201(status = "") {
  return ["IN_PLAY", "PAUSED", "LIVE", "1H", "2H", "HT", "ET", "PEN_LIVE"].includes(String(status || "").toUpperCase());
}

function footballSmartIsFinishedStatusV201(status = "") {
  return ["FINISHED", "AWARDED"].includes(String(status || "").toUpperCase());
}

function footballSmartWinnerV201(match = {}) {
  if (!match.homeTeam || !match.awayTeam) return "";
  if (!footballSmartHasFinalScoreV201(match)) return "";
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
  if (!Number.isFinite(homePens) || !Number.isFinite(awayPens)) return "";
  if (homePens > awayPens) return match.homeTeam;
  if (awayPens > homePens) return match.awayTeam;
  return "";
}

function footballSmartPropagateKnockoutV201(matches = []) {
  const byId = new Map(matches.map(match => [match.id, match]));
  let changed = false;

  for (const match of matches) {
    if (!match?.nextMatchId || !match.nextSlot) continue;
    const winner = footballSmartWinnerV201(match);
    if (!winner) continue;
    const next = byId.get(match.nextMatchId);
    if (!next) continue;

    if (next[match.nextSlot] !== winner) {
      next[match.nextSlot] = winner;
      next.updatedAt = new Date().toISOString();
      changed = true;

      next.homeScore = null;
      next.awayScore = null;
      next.homePenalties = null;
      next.awayPenalties = null;
      next.liveHomeScore = null;
      next.liveAwayScore = null;
    }
  }

  return changed;
}

function footballSmartKnockoutPropagationOkV201(match = {}, matches = []) {
  if (!match.nextMatchId || !match.nextSlot) return true;
  const winner = footballSmartWinnerV201(match);
  if (!winner) return false;
  const next = matches.find(item => item.id === match.nextMatchId);
  if (!next) return true;
  return next[match.nextSlot] === winner;
}

function footballSmartGameReasonV201(game = {}, now = Date.now(), collection = "games", allKnockout = []) {
  const status = footballSmartStatusV201(game);
  const start = footballSmartDateMillisV201(game);
  const minutesToStart = start ? Math.round((start - now) / 60000) : null;
  const finalScore = footballSmartHasFinalScoreV201(game);
  const finished = footballSmartIsFinishedStatusV201(status);
  const live = footballSmartIsLiveStatusV201(status);
  const lastError = cleanString(game.lastApiError || game.syncError || game.lastSyncError);
  const finishedAt = new Date(game.finishedAt || game.syncEndedAt || game.updatedAt || game.liveUpdatedAt || game.footballDataUtcDate || "").getTime();
  const justFinished = finished && Number.isFinite(finishedAt) && now - finishedAt <= SMART_SYNC_POST_FINISH_MS_V201;
  const nearStart = start && start - now <= SMART_SYNC_PRE_START_MS_V201 && now - start <= SMART_SYNC_LATE_CONFIRM_MS_V201 && !finalScore;
  const recentlyStartedWithoutFinal = start && now >= start && now - start <= SMART_SYNC_LATE_CONFIRM_MS_V201 && !finalScore;
  const finishedMissingFinal = finished && !finalScore;
  const scoreNotConfirmed = finished && finalScore && game.scoreConfirmed !== true;
  const pointsNotConfirmed = finished && finalScore && game.pointsConfirmed !== true;
  const knockoutNotPropagated = collection === "knockout" && finished && finalScore && !footballSmartKnockoutPropagationOkV201(game, allKnockout);

  if (lastError) return { active: true, reason: `erro pendente: ${lastError}`, minutesToStart };
  if (live) return { active: true, reason: "jogo a decorrer", minutesToStart };
  if (nearStart) return { active: true, reason: "jogo perto de começar", minutesToStart };
  if (justFinished) return { active: true, reason: "jogo terminou há menos de 5 minutos", minutesToStart };
  if (finishedMissingFinal) return { active: true, reason: "resultado final por guardar", minutesToStart };
  if (scoreNotConfirmed) return { active: true, reason: "resultado final por confirmar", minutesToStart };
  if (pointsNotConfirmed) return { active: true, reason: "pontos por confirmar", minutesToStart };
  if (knockoutNotPropagated) return { active: true, reason: "vencedor da fase final por propagar", minutesToStart };
  if (recentlyStartedWithoutFinal) return { active: true, reason: "jogo recente sem resultado final", minutesToStart };

  return { active: false, reason: start ? "fora da janela ativa" : "sem data de jogo", minutesToStart };
}

function footballSmartGameLabelV201(game = {}) {
  return `${cleanString(game.homeTeam, "Casa")} vs ${cleanString(game.awayTeam, "Fora")}`;
}

function footballSmartNextSyncCandidateV201(items = [], now = Date.now()) {
  return items
    .filter(item => item.start)
    .sort((a, b) => {
      const aStart = a.start - SMART_SYNC_PRE_START_MS_V201;
      const bStart = b.start - SMART_SYNC_PRE_START_MS_V201;
      return Math.abs(aStart - now) - Math.abs(bStart - now);
    })[0] || null;
}

async function footballSmartPrecheckV201({ actor, mode, competition, season } = {}) {
  const now = Date.now();
  const syncMetaRef = db.collection("settings").doc("footballData");
  const [gamesSnap, settingsSnap] = await Promise.all([
    db.collection("games").get(),
    db.collection("settings").doc("main").get()
  ]);

  const localGames = gamesSnap.docs.map(doc => ({ id: doc.id, collection: "games", ...(doc.data() || {}) }));
  const settings = settingsSnap.data() || {};
  const knockoutMatches = Array.isArray(settings.knockout?.matches)
    ? settings.knockout.matches.map(match => ({ ...match, collection: "knockout" }))
    : [];

  const groupCandidates = localGames.map(game => {
    const check = footballSmartGameReasonV201(game, now, "games", knockoutMatches);
    return {
      ...check,
      id: game.id,
      label: footballSmartGameLabelV201(game),
      start: footballSmartDateMillisV201(game),
      collection: "games"
    };
  });

  const knockoutCandidates = knockoutMatches.map(game => {
    const check = footballSmartGameReasonV201(game, now, "knockout", knockoutMatches);
    return {
      ...check,
      id: game.id,
      label: footballSmartGameLabelV201(game),
      start: footballSmartDateMillisV201(game),
      collection: "knockout"
    };
  });

  const allCandidates = [...groupCandidates, ...knockoutCandidates];
  const active = allCandidates.filter(item => item.active);
  const next = footballSmartNextSyncCandidateV201(allCandidates, now);
  const activeReason = active[0]?.reason || "";
  const status = active.length ? "active" : "waiting";

  const meta = {
    syncMode: "smart",
    provider: "football-data",
    mode: "Inteligente",
    status,
    state: status,
    activeSyncGames: active.map(item => ({
      id: item.id,
      label: item.label,
      collection: item.collection,
      reason: item.reason,
      minutesToStart: item.minutesToStart
    })),
    activeSyncGamesCount: active.length,
    nextSyncGame: next ? {
      id: next.id,
      label: next.label,
      collection: next.collection
    } : null,
    nextSyncStartsAt: next?.start ? new Date(next.start - SMART_SYNC_PRE_START_MS_V201).toISOString() : "",
    lastCheckAt: FieldValue.serverTimestamp(),
    lastCheckIso: new Date().toISOString(),
    lastActiveReason: activeReason,
    lastSkippedReason: active.length ? "" : "sem jogos dentro da janela ativa",
    providerCompetition: competition || "WC",
    providerSeason: season || "2026",
    schedulerMode: mode || "smart",
    checkedBy: actor?.email || FOOTBALL_SYSTEM_ACTOR_V151.email
  };

  await syncMetaRef.set(meta, { merge: true });

  return {
    ok: true,
    shouldSync: active.length > 0,
    meta,
    active,
    localGames,
    settings,
    knockoutMatches
  };
}

async function runFootballDataSyncCoreV151(options = {}) {
  const actor = options.actor || FOOTBALL_SYSTEM_ACTOR_V151;
  const competition = cleanString(options.competition || "WC");
  const season = cleanString(options.season || "2026");
  const syncMode = cleanString(options.mode || "smart");
  const windowDaysBefore = Number(options.daysBefore ?? 1);
  const windowDaysAfter = Number(options.daysAfter ?? 7);
  const forceSync = options.force === true || syncMode === "manual";

  const precheck = await footballSmartPrecheckV201({ actor, mode: syncMode, competition, season });

  if (!forceSync && !precheck.shouldSync) {
    logger.info("Football-data smart sync ignorada", {
      reason: precheck.meta.lastSkippedReason,
      nextSyncGame: precheck.meta.nextSyncGame?.label || "",
      nextSyncStartsAt: precheck.meta.nextSyncStartsAt || ""
    });

    return {
      ok: true,
      skipped: true,
      competition,
      season,
      mode: "smart",
      status: "waiting",
      provider: "football-data",
      reason: precheck.meta.lastSkippedReason,
      activeSyncGames: [],
      nextSyncGame: precheck.meta.nextSyncGame,
      nextSyncStartsAt: precheck.meta.nextSyncStartsAt,
      lastCheckIso: precheck.meta.lastCheckIso
    };
  }

  const token = cleanString(process.env.FOOTBALL_DATA_TOKEN || process.env.FOOTBALL_DATA_API_KEY);
  if (!token) {
    const err = new Error("FOOTBALL_DATA_TOKEN não está configurado no GitHub Secret / functions .env.");
    await db.collection("settings").doc("footballData").set({
      syncMode: "smart",
      provider: "football-data",
      status: "error",
      state: "error",
      lastError: err.message,
      lastErrorAt: FieldValue.serverTimestamp(),
      lastErrorIso: new Date().toISOString()
    }, { merge: true });
    err.status = 500;
    throw err;
  }

  const url = new URL(`https://api.football-data.org/v4/competitions/${encodeURIComponent(competition)}/matches`);
  if (season) url.searchParams.set("season", season);
  const dateWindow = footballDateWindow(windowDaysBefore, windowDaysAfter);
  url.searchParams.set("dateFrom", dateWindow.from);
  url.searchParams.set("dateTo", dateWindow.to);

  let apiResponse;
  let apiText = "";
  let apiData = {};

  try {
    apiResponse = await fetch(url, {
      headers: {
        "X-Auth-Token": token,
        "Accept": "application/json"
      }
    });

    apiText = await apiResponse.text();
    try { apiData = JSON.parse(apiText); } catch {}

    if (!apiResponse.ok) {
      const err = new Error(apiData.message || apiData.error || `football-data HTTP ${apiResponse.status}`);
      err.status = apiResponse.status;
      throw err;
    }
  } catch (error) {
    await db.collection("settings").doc("footballData").set({
      syncMode: "smart",
      provider: "football-data",
      status: "error",
      state: "error",
      lastError: error.message || String(error),
      lastErrorAt: FieldValue.serverTimestamp(),
      lastErrorIso: new Date().toISOString(),
      lastActiveReason: precheck.meta.lastActiveReason || "erro API"
    }, { merge: true });
    throw error;
  }

  const matches = Array.isArray(apiData.matches) ? apiData.matches : [];
  const finished = matches.filter(match => ["FINISHED", "AWARDED"].includes(String(match.status || "").toUpperCase()) && footballApiScore(match));
  const upcoming = matches
    .filter(match => !["FINISHED", "AWARDED"].includes(String(match.status || "").toUpperCase()))
    .slice(0, 12)
    .map(footballMatchSummary);
  const knockoutFixtures = matches
    .filter(match => String(match.stage || "").toUpperCase() !== "GROUP_STAGE")
    .filter(match => footballApiTeamName(match.homeTeam) && footballApiTeamName(match.awayTeam))
    .sort((a, b) => footballMatchDateMillis(a.utcDate) - footballMatchDateMillis(b.utcDate))
    .map(footballMatchSummary)
    .slice(0, 48);
  const liveOrLocked = matches
    .filter(footballShouldLockMatch)
    .map(footballMatchSummary);

  const gamesSnap = await db.collection("games").get();
  const localGames = gamesSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() || {}) }));

  const settingsRef = db.collection("settings").doc("main");
  const settingsSnap = await settingsRef.get();
  const settings = settingsSnap.data() || {};
  const knockoutMatches = Array.isArray(settings.knockout?.matches) ? settings.knockout.matches : [];

  const batch = db.batch();
  const updatedGames = [];
  const updatedKnockoutMatches = [];
  let writes = 0;
  let finalConfirmed = 0;
  let liveUpdated = 0;
  let knockoutPropagationChanged = false;

  const matchedGamesStatusV153 = [];

  matches.forEach(apiMatch => {
    const score = footballApiAnyScoreV153(apiMatch);
    const apiStatus = String(apiMatch.status || "").toUpperCase();
    const isFinished = footballIsFinishedV153(apiMatch);
    const isGroupStage = String(apiMatch.stage || "").toUpperCase() === "GROUP_STAGE";
    const groupTarget = footballFindLocalMatch(apiMatch, localGames);
    const knockoutTarget = !isGroupStage ? footballFindLocalMatch(apiMatch, knockoutMatches) : null;

    if (groupTarget) {
      const payload = footballMatchPayloadV158(apiMatch, actor, score);
      payload.lastApiCheckAt = FieldValue.serverTimestamp();
      payload.lastApiStatus = cleanString(apiMatch.status);
      payload.lastSyncReason = precheck.meta.lastActiveReason || "sync inteligente";
      payload.syncActive = footballSmartIsLiveStatusV201(apiStatus) || isFinished || footballShouldLockMatch(apiMatch);
      payload.syncStartedAt = payload.syncActive ? (groupTarget.syncStartedAt || new Date().toISOString()) : groupTarget.syncStartedAt || "";
      payload.lastApiError = FieldValue.delete();

      if (isFinished && score) {
        payload.scoreConfirmed = true;
        payload.pointsConfirmed = true;
        payload.syncEndedAt = groupTarget.syncEndedAt || new Date().toISOString();
        payload.syncConfirmedAt = new Date().toISOString();
        payload.syncActive = false;
        finalConfirmed += 1;
      } else if (score) {
        payload.scoreConfirmed = false;
        payload.pointsConfirmed = false;
        liveUpdated += 1;
      }

      batch.set(db.collection("games").doc(groupTarget.id), payload, { merge: true });
      writes += 1;

      const updatePayload = {
        id: groupTarget.id,
        homeTeam: groupTarget.homeTeam,
        awayTeam: groupTarget.awayTeam,
        ...payload,
        status: payload.footballDataStatus,
        stage: payload.footballDataStage,
        firebaseUpdatedAt: null
      };

      matchedGamesStatusV153.push(updatePayload);

      if (score && isFinished) updatedGames.push(updatePayload);
    }

    if (knockoutTarget) {
      const payload = footballMatchPayloadV158(apiMatch, actor, score);
      Object.assign(knockoutTarget, {
        footballDataId: payload.footballDataId,
        footballDataStatus: payload.footballDataStatus,
        footballDataStage: payload.footballDataStage,
        footballDataGroup: payload.footballDataGroup,
        footballDataUtcDate: payload.footballDataUtcDate,
        footballDataLocked: payload.footballDataLocked,
        source: payload.source,
        updatedAt: payload.updatedAt,
        lastApiCheckAt: new Date().toISOString(),
        lastApiStatus: cleanString(apiMatch.status),
        lastSyncReason: precheck.meta.lastActiveReason || "sync inteligente",
        syncActive: footballSmartIsLiveStatusV201(apiStatus) || isFinished || footballShouldLockMatch(apiMatch),
        syncStartedAt: knockoutTarget.syncStartedAt || new Date().toISOString(),
        lastApiError: ""
      });

      if (score && isFinished) {
        knockoutTarget.homeScore = score.homeScore;
        knockoutTarget.awayScore = score.awayScore;
        knockoutTarget.liveHomeScore = null;
        knockoutTarget.liveAwayScore = null;
        knockoutTarget.homePenalties = score.homePenalties;
        knockoutTarget.awayPenalties = score.awayPenalties;
        knockoutTarget.scoreConfirmed = true;
        knockoutTarget.pointsConfirmed = true;
        knockoutTarget.syncEndedAt = knockoutTarget.syncEndedAt || new Date().toISOString();
        knockoutTarget.syncConfirmedAt = new Date().toISOString();
        knockoutTarget.syncActive = false;
        finalConfirmed += 1;
      } else if (score) {
        knockoutTarget.liveHomeScore = score.homeScore;
        knockoutTarget.liveAwayScore = score.awayScore;
        knockoutTarget.liveUpdatedAt = new Date().toISOString();
        knockoutTarget.scoreConfirmed = false;
        knockoutTarget.pointsConfirmed = false;
        liveUpdated += 1;
      }

      updatedKnockoutMatches.push({
        id: knockoutTarget.id,
        homeTeam: knockoutTarget.homeTeam,
        awayTeam: knockoutTarget.awayTeam,
        footballDataId: knockoutTarget.footballDataId,
        footballDataStatus: knockoutTarget.footballDataStatus,
        footballDataStage: knockoutTarget.footballDataStage,
        footballDataGroup: knockoutTarget.footballDataGroup,
        footballDataUtcDate: knockoutTarget.footballDataUtcDate,
        footballDataLocked: knockoutTarget.footballDataLocked,
        source: knockoutTarget.source,
        homeScore: knockoutTarget.homeScore ?? null,
        awayScore: knockoutTarget.awayScore ?? null,
        liveHomeScore: knockoutTarget.liveHomeScore ?? null,
        liveAwayScore: knockoutTarget.liveAwayScore ?? null,
        homePenalties: knockoutTarget.homePenalties ?? null,
        awayPenalties: knockoutTarget.awayPenalties ?? null,
        scoreConfirmed: knockoutTarget.scoreConfirmed === true,
        pointsConfirmed: knockoutTarget.pointsConfirmed === true,
        updatedAt: knockoutTarget.updatedAt,
        status: knockoutTarget.footballDataStatus,
        stage: knockoutTarget.footballDataStage
      });
    }
  });

  if (updatedKnockoutMatches.length) {
    knockoutPropagationChanged = footballSmartPropagateKnockoutV201(knockoutMatches);
  }

  const syncMetaRef = db.collection("settings").doc("footballData");
  batch.set(syncMetaRef, {
    syncMode: "smart",
    provider: "football-data",
    mode: "Inteligente",
    status: "active",
    state: "active",
    lastCheckAt: FieldValue.serverTimestamp(),
    lastCheckIso: new Date().toISOString(),
    lastRealSyncAt: FieldValue.serverTimestamp(),
    lastRealSyncIso: new Date().toISOString(),
    lastSyncAt: FieldValue.serverTimestamp(),
    lastSyncIso: new Date().toISOString(),
    lastSyncBy: actor.email,
    lastActiveReason: precheck.meta.lastActiveReason || "sync inteligente",
    lastSkippedReason: "",
    competition,
    season,
    dateFrom: dateWindow.from,
    dateTo: dateWindow.to,
    apiMatches: matches.length,
    finished: finished.length,
    updatedGames: updatedGames.length,
    matchedGamesStatus: matchedGamesStatusV153.length,
    updatedKnockoutMatches: updatedKnockoutMatches.length,
    finalConfirmed,
    liveUpdated,
    knockoutPropagationChanged,
    activeSyncGames: precheck.meta.activeSyncGames,
    activeSyncGamesCount: precheck.meta.activeSyncGamesCount,
    nextSyncGame: precheck.meta.nextSyncGame,
    nextSyncStartsAt: precheck.meta.nextSyncStartsAt,
    upcoming,
    knockoutFixtures,
    liveOrLocked,
    lastError: FieldValue.delete()
  }, { merge: true });
  writes += 1;

  if (updatedKnockoutMatches.length || knockoutPropagationChanged) {
    const nextSettings = {
      ...settings,
      knockout: {
        ...(settings.knockout || {}),
        matches: knockoutMatches
      },
      footballDataLastSyncAt: FieldValue.serverTimestamp(),
      footballDataLastSyncBy: actor.email
    };
    batch.set(settingsRef, nextSettings, { merge: true });
    writes += 1;
  }

  if (writes > 0) await batch.commit();

  await db.collection("systemLogs").add({
    action: "Football-data smart sync",
    detail: `Sync inteligente: ${updatedGames.length} grupo(s), ${updatedKnockoutMatches.length} fase final, ${liveUpdated} live, ${finalConfirmed} final confirmado.`,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actor.email,
    meta: {
      competition,
      season,
      mode: syncMode,
      apiMatches: matches.length,
      finished: finished.length,
      updatedGames: updatedGames.length,
      matchedGamesStatus: matchedGamesStatusV153.length,
      updatedKnockoutMatches: updatedKnockoutMatches.length,
      finalConfirmed,
      liveUpdated,
      knockoutPropagationChanged,
      reason: precheck.meta.lastActiveReason
    }
  });

  return {
    ok: true,
    competition,
    season,
    mode: "smart",
    provider: "football-data",
    status: "active",
    reason: precheck.meta.lastActiveReason,
    apiMatches: matches.length,
    finished: finished.length,
    updatedGames,
    matchedGamesStatus: matchedGamesStatusV153,
    updatedKnockoutMatches,
    finalConfirmed,
    liveUpdated,
    knockoutPropagationChanged,
    upcoming,
    knockoutFixtures,
    liveOrLocked,
    lastSyncIso: new Date().toISOString()
  };
}

exports.syncFootballDataWorldCup = onRequest({
  region: "europe-west1",
  timeoutSeconds: 90,
  memory: "256MiB",
  }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Usa POST." });
    return;
  }

  try {
    const actor = await assertFootballDataAdminV147(req);
    const result = await runFootballDataSyncCoreV151({
      actor,
      competition: req.body?.competition || "WC",
      season: req.body?.season || "2026",
      mode: req.body?.mode || "manual",
      daysBefore: req.body?.daysBefore ?? 1,
      daysAfter: req.body?.daysAfter ?? 7
    });
    res.json(result);
  } catch (error) {
    logger.error("syncFootballDataWorldCup falhou", error);
    res.status(error.status || 500).json({
      ok: false,
      error: error.message || "Erro ao atualizar football-data."
    });
  }
});


exports.syncFootballDataWorldCupScheduled = onSchedule({
  schedule: "* * * * *",
  region: "europe-west1",
  timeZone: "Europe/Lisbon",
  timeoutSeconds: 90,
  memory: "256MiB"
}, async () => {
  try {
    const result = await runFootballDataSyncCoreV151({
      actor: FOOTBALL_SYSTEM_ACTOR_V151,
      competition: "WC",
      season: "2026",
      mode: "smart-scheduled-1min",
      daysBefore: 1,
      daysAfter: 7
    });

    logger.info("Football-data smart sync concluída", {
      skipped: result.skipped === true,
      status: result.status,
      reason: result.reason,
      apiMatches: result.apiMatches || 0,
      finished: result.finished || 0,
      updatedGames: result.updatedGames?.length || 0,
      updatedKnockoutMatches: result.updatedKnockoutMatches?.length || 0
    });
  } catch (error) {
    logger.error("Football-data smart sync falhou", error);
    try {
      await db.collection("settings").doc("footballData").set({
        syncMode: "smart",
        provider: "football-data",
        status: "error",
        state: "error",
        lastError: error.message || String(error),
        lastErrorAt: FieldValue.serverTimestamp(),
        lastErrorIso: new Date().toISOString()
      }, { merge: true });
    } catch (writeError) {
      logger.error("Falhou guardar erro da smart sync", writeError);
    }
  }
});




// Push HTTP Functions limpas. Admin SDK inicializado uma única vez no topo.
function setCorsPush(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function readJsonBodyPush(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.rawBody?.toString("utf8") || "{}");
  } catch {
    return {};
  }
}

async function requestIdentityPush(req, body) {
  const authHeader = String(req.get("Authorization") || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token) {
    try {
      const decoded = await auth.verifyIdToken(token);
      return { uid: decoded.uid || "", email: normalizeEmail(decoded.email || body.email || "") };
    } catch (error) {
      logger.warn("Push auth token inválido; vou usar body fallback", { code: error?.code });
    }
  }
  return { uid: cleanString(body.uid), email: normalizeEmail(body.email) };
}

function safeDocIdPush(...parts) {
  const raw = parts.map(part => cleanString(part)).filter(Boolean).join("_") || `anon_${Date.now()}`;
  return raw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 180);
}

function cleanPushPreferences(input = {}) {
  return {
    gameStart: input.gameStart !== false,
    goals: input.goals !== false,
    gameEnd: input.gameEnd !== false,
    results: input.results !== false,
    knockout: input.knockout !== false,
    chatGeneral: input.chatGeneral === true,
    chatAdmin: input.chatAdmin !== false,
    mentions: input.mentions !== false
  };
}

function roomsFromPushPreferences(preferences = {}) {
  return {
    general: preferences.chatGeneral === true,
    admin: preferences.chatAdmin !== false
  };
}

function cleanQuietHours(input = {}) {
  return {
    enabled: input.enabled !== false,
    startHour: Number.isFinite(Number(input.startHour)) ? Number(input.startHour) : DEFAULT_QUIET_START_HOUR,
    endHour: Number.isFinite(Number(input.endHour)) ? Number(input.endHour) : DEFAULT_QUIET_END_HOUR,
    timezone: cleanString(input.timezone, QUIET_TZ)
  };
}

function isPushAdmin(identity = {}) {
  return ADMIN_EMAILS.has(normalizeEmail(identity.email));
}

function cleanPushTestPayload(body = {}) {
  const requestedType = cleanString(body.testType || body.type || "test");
  const type = ["gameStart", "goals", "gameEnd", "results", "knockout", "chatGeneral", "chatAdmin", "mentions", "custom"].includes(requestedType) ? requestedType : "test";
  const team = shortText(body.team || body.goalTeam || "Portugal", 60);
  const game = shortText(body.game || body.match || "Portugal vs Uzbequistao", 90);
  const customTitle = shortText(body.title, 90);
  const customBody = shortText(body.body || body.message, 180);

  const defaults = {
    gameStart: { title: "Jogo começou", body: `${game} já começou.`, dataType: "game-start", pref: "gameStart" },
    goals: { title: `Golo ${team}`, body: `Golo de ${team} no jogo ${game}.`, dataType: "goal", pref: "goals" },
    gameEnd: { title: "Jogo acabou", body: `${game} terminou.`, dataType: "game-end", pref: "gameEnd" },
    results: { title: "Resultado novo guardado", body: `${game}: resultado atualizado.`, dataType: "result", pref: "results" },
    knockout: { title: "Fase final atualizada", body: "A fase final do Mundial Pontos 2026 foi alterada.", dataType: "knockout", pref: "knockout" },
    chatGeneral: { title: "Nova mensagem no chat geral", body: "Mensagem de teste no chat geral.", dataType: "chat_general", pref: "chatGeneral" },
    chatAdmin: { title: "Nova mensagem no chat admin", body: "Mensagem de teste no chat admin.", dataType: "chat_admin", pref: "chatAdmin" },
    mentions: { title: `${team} mencionou-te`, body: "Teste de menção no chat.", dataType: "mention", pref: "mentions" },
    custom: { title: "Teste push Mundial", body: "As notificações push estão a funcionar.", dataType: "test", pref: "" },
    test: { title: "Teste push Mundial", body: "As notificações push estão a funcionar neste dispositivo.", dataType: "test", pref: "" }
  };

  const selected = defaults[type] || defaults.test;
  return {
    title: customTitle || selected.title,
    body: customBody || selected.body,
    dataType: selected.dataType,
    pref: selected.pref,
    team,
    game
  };
}

exports.registerPushToken = onRequest({ cors: true, region: "us-central1" }, async (req, res) => {
  setCorsPush(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method-not-allowed" });

  try {
    const body = readJsonBodyPush(req);
    const token = cleanString(body.token);
    if (!token) return res.status(400).json({ ok: false, error: "missing-token" });

    const identity = await requestIdentityPush(req, body);
    if (!identity.uid && !identity.email) return res.status(400).json({ ok: false, error: "missing-user" });

    const preferences = cleanPushPreferences(body.preferences || {});
    const quietHours = cleanQuietHours(body.quietHours || body.preferences?.quietHours || {});
    const docId = safeDocIdPush(identity.uid || identity.email, body.deviceId || Buffer.from(token).toString("base64url").slice(0, 32));

    await db.collection("notificationTokens").doc(docId).set({
      token,
      uid: identity.uid,
      email: identity.email,
      enabled: true,
      platform: cleanString(body.platform, "web"),
      deviceId: cleanString(body.deviceId),
      userAgent: cleanString(body.userAgent),
      preferences,
      quietHours,
      rooms: roomsFromPushPreferences(preferences),
      appVersion: cleanString(body.appVersion),
      updatedAt: new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp()
    }, { merge: true });

    return res.json({ ok: true, id: docId });
  } catch (error) {
    logger.error("registerPushToken error", error);
    return res.status(500).json({ ok: false, error: error.message || "internal" });
  }
});

exports.savePushPreferences = onRequest({ cors: true, region: "us-central1" }, async (req, res) => {
  setCorsPush(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method-not-allowed" });

  try {
    const body = readJsonBodyPush(req);
    const identity = await requestIdentityPush(req, body);
    if (!identity.uid && !identity.email) return res.status(400).json({ ok: false, error: "missing-user" });

    const preferences = cleanPushPreferences(body.preferences || {});
    const quietHours = cleanQuietHours(body.quietHours || body.preferences?.quietHours || {});
    const docId = safeDocIdPush(identity.uid || identity.email);

    await db.collection("notificationPreferences").doc(docId).set({
      uid: identity.uid,
      email: identity.email,
      preferences,
      quietHours,
      appVersion: cleanString(body.appVersion),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    const tokens = await db.collection("notificationTokens")
      .where(identity.uid ? "uid" : "email", "==", identity.uid || identity.email)
      .get();
    await Promise.all(tokens.docs.map(doc => doc.ref.set({
      preferences,
      quietHours,
      rooms: roomsFromPushPreferences(preferences),
      updatedAt: new Date().toISOString()
    }, { merge: true })));

    return res.json({ ok: true, id: docId, updatedTokens: tokens.size });
  } catch (error) {
    logger.error("savePushPreferences error", error);
    return res.status(500).json({ ok: false, error: error.message || "internal" });
  }
});

exports.requestPushTest = onRequest({ cors: true, region: "us-central1" }, async (req, res) => {
  setCorsPush(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method-not-allowed" });

  try {
    const body = readJsonBodyPush(req);
    const identity = await requestIdentityPush(req, body);
    const directToken = cleanString(body.token);
    const quietHours = cleanQuietHours(body.quietHours || body.preferences?.quietHours || {});
    const sendAllDevices = body.allDevices === true || body.allDevices === "true";
    const ignoreQuietHours = body.ignoreQuietHours !== false;
    const testPayload = cleanPushTestPayload(body);
    let sent = 0;

    const title = testPayload.title;
    const messageBody = testPayload.body;
    const payload = {
      notification: { title, body: messageBody },
      data: {
        type: testPayload.dataType,
        title,
        body: messageBody,
        team: testPayload.team,
        game: testPayload.game,
        tag: `mundial-push-test-${Date.now()}`,
        url: notificationUrl("notifications", "test")
      }
    };

    if (directToken && !sendAllDevices && (ignoreQuietHours || !tokenInQuietHours({ quietHours }))) {
      await messaging.send({ token: directToken, ...payload });
      sent = 1;
    } else {
      const tokens = isPushAdmin(identity)
        ? await loadEnabledTokens({ pref: testPayload.pref, ignoreQuietHours })
        : identity.uid
          ? await loadEnabledTokens({ onlyUid: identity.uid, pref: testPayload.pref, ignoreQuietHours })
          : [];
      sent = await sendTokenNotifications(tokens, () => payload);
    }

    await db.collection("notificationTests").add({
      uid: identity.uid,
      email: identity.email,
      hasDirectToken: Boolean(directToken),
      sent,
      testType: testPayload.dataType,
      title,
      body: messageBody,
      source: "requestPushTest-clean",
      appVersion: cleanString(body.appVersion),
      createdAt: FieldValue.serverTimestamp()
    });

    return res.json({ ok: true, sent, title, body: messageBody, type: testPayload.dataType });
  } catch (error) {
    logger.error("requestPushTest error", error);
    return res.status(500).json({ ok: false, error: error.message || "internal" });
  }
});
