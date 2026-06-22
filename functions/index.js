const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { getAuth } = require("firebase-admin/auth");
const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");

initializeApp();
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

const db = getFirestore();
const messaging = getMessaging();
const auth = getAuth();
const ADMIN_EMAILS = new Set(["pica.fern@gmail.com"]);
const FOOTBALL_SYSTEM_ACTOR_V151 = { uid: "scheduler", email: "sistema@app-mundial2026" };
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

async function loadEnabledTokens({ room = "", pref = "", adminOnly = false, excludeUid = "", onlyUid = "" } = {}) {
  const snap = await db.collection("notificationTokens").where("enabled", "==", true).get();
  return snap.docs
    .map(doc => ({ id: doc.id, ref: doc.ref, data: doc.data() || {} }))
    .filter(item => item.data.token)
    .filter(item => !onlyUid || item.data.uid === onlyUid)
    .filter(item => !excludeUid || item.data.uid !== excludeUid)
    .filter(item => !pref || item.data.preferences?.[pref] !== false)
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
  const pref = room === "admin" ? "chatAdmin" : "chatGeneral";
  const tokens = await loadEnabledTokens({ room, pref, adminOnly, excludeUid: message.uid || "" });

  const sent = await sendTokenNotifications(tokens, tokenData => {
    const mentioned = messageMentionsToken(message.text || "", tokenData);
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
  if (mode === "auto") return "Automático";
  return "Manual";
}


async function runFootballDataSyncCoreV151(options = {}) {
  const actor = options.actor || FOOTBALL_SYSTEM_ACTOR_V151;
  const competition = cleanString(options.competition || "WC");
  const season = cleanString(options.season || "2026");
  const syncMode = cleanString(options.mode || "auto-24-7");
  const windowDaysBefore = Number(options.daysBefore ?? 1);
  const windowDaysAfter = Number(options.daysAfter ?? 7);

  const token = cleanString(process.env.FOOTBALL_DATA_TOKEN || process.env.FOOTBALL_DATA_API_KEY);
  if (!token) {
    const err = new Error("FOOTBALL_DATA_TOKEN não está configurado no GitHub Secret / functions .env.");
    err.status = 500;
    throw err;
  }

  const url = new URL(`https://api.football-data.org/v4/competitions/${encodeURIComponent(competition)}/matches`);
  if (season) url.searchParams.set("season", season);
  const dateWindow = footballDateWindow(windowDaysBefore, windowDaysAfter);
  url.searchParams.set("dateFrom", dateWindow.from);
  url.searchParams.set("dateTo", dateWindow.to);

  const apiResponse = await fetch(url, {
    headers: {
      "X-Auth-Token": token,
      "Accept": "application/json"
    }
  });

  const apiText = await apiResponse.text();
  let apiData = {};
  try { apiData = JSON.parse(apiText); } catch {}

  if (!apiResponse.ok) {
    const err = new Error(apiData.message || apiData.error || `football-data HTTP ${apiResponse.status}`);
    err.status = apiResponse.status;
    throw err;
  }

  const matches = Array.isArray(apiData.matches) ? apiData.matches : [];
  const finished = matches.filter(match => ["FINISHED", "AWARDED"].includes(String(match.status || "").toUpperCase()) && footballApiScore(match));
  const upcoming = matches
    .filter(match => !["FINISHED", "AWARDED"].includes(String(match.status || "").toUpperCase()))
    .slice(0, 12)
    .map(footballMatchSummary);
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

  finished.forEach(apiMatch => {
    const score = footballApiScore(apiMatch);
    if (!score) return;

    const isGroupStage = String(apiMatch.stage || "").toUpperCase() === "GROUP_STAGE";
    const groupTarget = footballFindLocalMatch(apiMatch, localGames);
    const knockoutTarget = !isGroupStage ? footballFindLocalMatch(apiMatch, knockoutMatches) : null;

    if (groupTarget) {
      const payload = {
        footballDataId: String(apiMatch.id || ""),
        footballDataStatus: cleanString(apiMatch.status),
        footballDataStage: cleanString(apiMatch.stage),
        footballDataLocked: footballShouldLockMatch(apiMatch),
        footballDataUpdatedBy: actor.email,
        source: "football-data.org",
        homeScore: score.homeScore,
        awayScore: score.awayScore,
        updatedAt: new Date().toISOString(),
        firebaseUpdatedAt: FieldValue.serverTimestamp()
      };

      batch.set(db.collection("games").doc(groupTarget.id), payload, { merge: true });
      writes += 1;
      updatedGames.push({
        id: groupTarget.id,
        homeTeam: groupTarget.homeTeam,
        awayTeam: groupTarget.awayTeam,
        ...payload,
        firebaseUpdatedAt: null
      });
    }

    if (knockoutTarget) {
      knockoutTarget.footballDataId = String(apiMatch.id || "");
      knockoutTarget.footballDataStatus = cleanString(apiMatch.status);
      knockoutTarget.footballDataStage = cleanString(apiMatch.stage);
      knockoutTarget.source = "football-data.org";
      knockoutTarget.homeScore = score.homeScore;
      knockoutTarget.awayScore = score.awayScore;
      knockoutTarget.homePenalties = score.homePenalties;
      knockoutTarget.awayPenalties = score.awayPenalties;
      knockoutTarget.updatedAt = new Date().toISOString();

      updatedKnockoutMatches.push({
        id: knockoutTarget.id,
        homeTeam: knockoutTarget.homeTeam,
        awayTeam: knockoutTarget.awayTeam,
        footballDataId: knockoutTarget.footballDataId,
        footballDataStatus: knockoutTarget.footballDataStatus,
        footballDataStage: knockoutTarget.footballDataStage,
        source: knockoutTarget.source,
        homeScore: knockoutTarget.homeScore,
        awayScore: knockoutTarget.awayScore,
        homePenalties: knockoutTarget.homePenalties,
        awayPenalties: knockoutTarget.awayPenalties,
        updatedAt: knockoutTarget.updatedAt
      });
    }
  });

  const syncMetaRef = db.collection("settings").doc("footballData");
  batch.set(syncMetaRef, {
    lastSyncAt: FieldValue.serverTimestamp(),
    lastSyncIso: new Date().toISOString(),
    lastSyncBy: actor.email,
    mode: footballReadableSyncMode(syncMode),
    competition,
    season,
    dateFrom: dateWindow.from,
    dateTo: dateWindow.to,
    apiMatches: matches.length,
    finished: finished.length,
    updatedGames: updatedGames.length,
    updatedKnockoutMatches: updatedKnockoutMatches.length,
    upcoming,
    liveOrLocked
  }, { merge: true });
  writes += 1;

  if (updatedKnockoutMatches.length) {
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
    action: "Football-data sync 24/7",
    detail: `Atualizados ${updatedGames.length} jogo(s) e ${updatedKnockoutMatches.length} jogo(s) da fase final.`,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: actor.email,
    meta: {
      competition,
      season,
      mode: syncMode,
      apiMatches: matches.length,
      finished: finished.length,
      updatedGames: updatedGames.length,
      updatedKnockoutMatches: updatedKnockoutMatches.length
    }
  });

  return {
    ok: true,
    competition,
    season,
    mode: syncMode,
    apiMatches: matches.length,
    finished: finished.length,
    updatedGames,
    updatedKnockoutMatches,
    upcoming,
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
  schedule: "every 1 minutes",
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
      mode: "auto-24-7-1min",
      daysBefore: 1,
      daysAfter: 7
    });

    logger.info("Football-data 24/7 sync concluída", {
      apiMatches: result.apiMatches,
      finished: result.finished,
      updatedGames: result.updatedGames.length,
      updatedKnockoutMatches: result.updatedKnockoutMatches.length
    });
  } catch (error) {
    logger.error("Football-data 24/7 sync falhou", error);
    throw error;
  }
});
