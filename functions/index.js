const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { setGlobalOptions } = require("firebase-functions/v2");
const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");

initializeApp();
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

const db = getFirestore();
const messaging = getMessaging();
const ADMIN_EMAILS = new Set(["pica.fern@gmail.com"]);

function cleanString(value, fallback = "") {
  return String(value || fallback).trim();
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
