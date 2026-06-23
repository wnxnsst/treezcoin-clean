const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingInterval: 25000,
  pingTimeout: 20000
});

app.use(express.static("public", {
  etag: false,
  maxAge: 0,
  setHeaders(res) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  }
}));

const ADMIN_KEY = process.env.ADMIN_KEY || "1234";
const MAX_ONLINE_PLAYERS = 6;
const WIN_SCORE = 10_000_000;
const MILLION_SCORE = 1_000_000;
const MILESTONE_STEP = 500_000;
const MAX_SCORE = 99_999_999;
const ROUND_SECONDS = 14 * 60;
const MARKET_EVENT_SECONDS = 38;
const SAVE_FILE = path.join(__dirname, "data", "state.json");

const cooldowns = {
  mine: 120,
  greed: 1300,
  mega: 2600,
  steal: 3200,
  tax: 4300,
  rug: 5600,
  throne: 6200,
  jackpot: 7600,
  shield: 9000,
  focus: 12000
};

const costs = {
  shield: 150_000,
  focus: 220_000
};

let players = {};
let logs = [];
let winner = null;
let roundStartedAt = Date.now();
let marketEvent = {
  title: "Piyasa sakin",
  desc: "Henüz felaket yok. Bu bile şüpheli.",
  type: "neutral",
  endsAt: Date.now() + MARKET_EVENT_SECONDS * 1000
};
let nextMarketEventAt = Date.now() + MARKET_EVENT_SECONDS * 1000;
let saveTimer = null;

const safeMilestoneOptions = [
  {
    id: "safe_500k",
    title: "Güvenli Kasa",
    desc: "Anında +500.000 TREEZ alırsın. Sıkıcı ama işe yarar."
  },
  {
    id: "instant_1m",
    title: "Anında 1M",
    desc: "Anında +1.000.000 TREEZ alırsın. Risk yok, ego var."
  },
  {
    id: "growth_boost",
    title: "Portföy Büyüt",
    desc: "Bakiyene %25 eklenir. Bonus en fazla 900.000 TREEZ olur."
  },
  {
    id: "tax_refund",
    title: "Vergi İadesi",
    desc: "Diğer oyunculardan %8 toplarsın. Herkesi azıcık sinirlendirir."
  },
  {
    id: "shield_30",
    title: "Kalkan Al",
    desc: "30 saniye boyunca çalma, vergi ve rug etkilerinden korunursun."
  },
  {
    id: "comeback_bonus",
    title: "Geri Dönüş Paketi",
    desc: "Sıralamada gerideysen ekstra para alırsın. Biraz adalet, mide bulandırıcı."
  }
];

const riskMilestoneOptions = [
  {
    id: "wipe_others_25",
    title: "Kıyamet Fişi",
    desc: "%25 şansla sen hariç herkes sıfırlanır. Tutmazsa paranının %75'i gider."
  },
  {
    id: "leader_half_38",
    title: "Taht Darbesi",
    desc: "%38 şansla en güçlü rakibin parasının yarısını alırsın. Tutmazsa paranının %40'ı gider."
  },
  {
    id: "chaos_collect_35",
    title: "Piyasa Çöküşü",
    desc: "%35 şansla herkes %40 kaybeder, sen kaybın %30'unu toplarsın. Tutmazsa paranının %50'si gider."
  },
  {
    id: "double_or_burn",
    title: "İkiye Katla",
    desc: "%45 şansla paran x2 olur. Tutmazsa paranının yarısı gider."
  },
  {
    id: "above_you_hit",
    title: "Üsttekileri Biç",
    desc: "%50 şansla senden zengin olan herkes %35 kaybeder. Tutmazsa paranının %30'u gider."
  },
  {
    id: "all_in_sniper",
    title: "All-in Keskin Nişancı",
    desc: "%30 şansla liderden %70 alırsın. Tutmazsa kendi paranının %85'i gider."
  }
];

const marketEvents = [
  {
    type: "bull",
    title: "Boğa Koşusu",
    desc: "Kazım gelirleri 30 saniyeliğine artar.",
    duration: 30
  },
  {
    type: "bear",
    title: "Ayı Pazarı",
    desc: "Riskli butonlar biraz daha acımasız olur.",
    duration: 30
  },
  {
    type: "airdrop",
    title: "Airdrop Yağmuru",
    desc: "En gerideki online oyuncuya küçük destek düşer.",
    duration: 20
  },
  {
    type: "gas",
    title: "Gas Fee Krizi",
    desc: "Herkesten ufak komisyon kesilir. Blokzincir romantizmi.",
    duration: 15
  },
  {
    type: "whale",
    title: "Balina Uyandı",
    desc: "Lider biraz baskı yer, geridekiler nefes alır.",
    duration: 20
  }
];

function now() {
  return Date.now();
}

function randomId() {
  return crypto.randomBytes(16).toString("hex");
}

function clampScore(value) {
  return Math.max(0, Math.min(MAX_SCORE, Math.floor(value || 0)));
}

function cleanName(name) {
  return String(name || "Player")
    .replace(/[<>"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16) || "Player";
}

function nameKey(name) {
  return cleanName(name).toLowerCase();
}

function formatTreez(value) {
  return clampScore(value).toLocaleString("tr-TR");
}

function hasShield(player) {
  return Boolean(player && player.shieldUntil && player.shieldUntil > now());
}

function hasFocus(player) {
  return Boolean(player && player.focusUntil && player.focusUntil > now());
}

function addLog(text, important = false) {
  logs.push({
    id: randomId().slice(0, 8),
    text,
    important,
    time: now()
  });

  if (logs.length > 28) logs = logs.slice(-28);
}

function sortedPlayers() {
  return Object.values(players).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.totalEarned || 0) - (a.totalEarned || 0);
  });
}

function onlinePlayers() {
  return Object.values(players).filter((player) => player.online);
}

function onlineCount() {
  return onlinePlayers().length;
}

function findByToken(token) {
  if (!token) return null;
  return Object.values(players).find((player) => player.token === token);
}

function findOfflineByName(name) {
  const key = nameKey(name);
  return Object.values(players).find((player) => !player.online && nameKey(player.name) === key);
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    score: clampScore(player.score),
    lastGain: Math.floor(player.lastGain || 0),
    online: Boolean(player.online),
    pending: Boolean(player.pendingMilestone),
    shieldUntil: player.shieldUntil || 0,
    focusUntil: player.focusUntil || 0,
    actions: player.actions || 0,
    bestScore: clampScore(player.bestScore || player.score || 0),
    streak: player.streak || 0
  };
}

function getRoundRemaining() {
  const elapsed = Math.floor((now() - roundStartedAt) / 1000);
  return Math.max(0, ROUND_SECONDS - elapsed);
}

function getState() {
  return {
    players: sortedPlayers().map(publicPlayer),
    logs,
    winner,
    winScore: WIN_SCORE,
    millionScore: MILLION_SCORE,
    milestoneStep: MILESTONE_STEP,
    maxPlayers: MAX_ONLINE_PLAYERS,
    onlineCount: onlineCount(),
    roundRemaining: getRoundRemaining(),
    marketEvent,
    cooldowns,
    costs,
    serverTime: now()
  };
}

function emitState() {
  io.emit("state", getState());
  scheduleSave();
}

function emitToast(socket, text, type = "info") {
  socket.emit("toast", { text, type });
}

function emitSession(socket, player) {
  socket.emit("session", {
    token: player.token,
    playerId: player.id,
    name: player.name
  });
}

function beforeScores() {
  const before = {};
  Object.values(players).forEach((player) => {
    before[player.id] = player.score || 0;
  });
  return before;
}

function updateGains(before) {
  Object.values(players).forEach((player) => {
    const oldScore = before[player.id] || 0;
    player.score = clampScore(player.score);
    player.lastGain = player.score - oldScore;

    if (player.lastGain > 0) {
      player.totalEarned = clampScore((player.totalEarned || 0) + player.lastGain);
      player.bestScore = Math.max(player.bestScore || 0, player.score || 0);
    }
  });
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function publicMilestoneOffer(offer) {
  return {
    milestone: offer.milestone,
    options: offer.options.map((option) => ({
      id: option.id,
      title: option.title,
      desc: option.desc
    }))
  };
}

function createMilestoneOffer(socket, player) {
  if (!player || winner) return;

  if (player.pendingMilestone) {
    socket.emit("milestoneOffer", publicMilestoneOffer(player.pendingMilestone));
    return;
  }

  if (player.score < player.nextMilestone) return;

  const safeOption = pickRandom(safeMilestoneOptions);
  let riskOption = pickRandom(riskMilestoneOptions);

  while (riskOption.id === safeOption.id) {
    riskOption = pickRandom(riskMilestoneOptions);
  }

  player.pendingMilestone = {
    milestone: player.nextMilestone,
    options: [safeOption, riskOption]
  };

  player.nextMilestone += MILESTONE_STEP;

  addLog(`${player.name}, ${formatTreez(player.pendingMilestone.milestone)} TREEZ eşiğine ulaştı. Özel seçim açıldı.`, true);
  socket.emit("milestoneOffer", publicMilestoneOffer(player.pendingMilestone));
  emitState();
}

function resetRound(keepPlayers = true) {
  if (!keepPlayers) {
    players = {};
  } else {
    Object.values(players).forEach((player) => {
      player.score = 0;
      player.lastGain = 0;
      player.lastAction = {};
      player.nextMilestone = MILESTONE_STEP;
      player.pendingMilestone = null;
      player.shieldUntil = 0;
      player.focusUntil = 0;
      player.streak = 0;
    });
  }

  winner = null;
  logs = [];
  roundStartedAt = now();
  nextMarketEventAt = now() + MARKET_EVENT_SECONDS * 1000;
  marketEvent = {
    title: "Yeni masa",
    desc: "Herkes sıfırdan başladı. Trajedi yeniden yazılıyor.",
    type: "neutral",
    endsAt: nextMarketEventAt
  };

  addLog("Yeni masa başladı.", true);
  emitState();
}

function checkWinner(player) {
  if (!winner && player.score >= WIN_SCORE) {
    winner = player.name;
    addLog(`${player.name} 10.000.000 TREEZ yaptı ve kazandı!`, true);
    emitState();

    setTimeout(() => {
      resetRound(true);
    }, 9000);
  }
}

function canUse(socket, player, type) {
  const t = now();
  const cooldown = cooldowns[type] || 500;

  if (!cooldowns[type]) {
    emitToast(socket, "Böyle bir buton yok. Kod büyüsü tutmadı.", "error");
    return false;
  }

  if (player.pendingMilestone) {
    socket.emit("milestoneOffer", publicMilestoneOffer(player.pendingMilestone));
    emitToast(socket, "Önce özel seçimini yap.", "warn");
    return false;
  }

  if (player.lastAction[type] && t - player.lastAction[type] < cooldown) {
    return false;
  }

  if (player.lastGlobalAction && t - player.lastGlobalAction < 55) {
    return false;
  }

  player.lastAction[type] = t;
  player.lastGlobalAction = t;
  player.actions = (player.actions || 0) + 1;
  return true;
}

function spendCost(socket, player, action) {
  const cost = costs[action] || 0;
  if (player.score < cost) {
    emitToast(socket, `${action} için ${formatTreez(cost)} TREEZ lazım. Fakirlik yine teknik engel oldu.`, "warn");
    return false;
  }
  player.score -= cost;
  return true;
}

function applyMarketImmediate(event) {
  const before = beforeScores();

  if (event.type === "airdrop") {
    const pool = onlinePlayers().filter((player) => !player.pendingMilestone);
    if (pool.length > 0) {
      const target = [...pool].sort((a, b) => a.score - b.score)[0];
      const bonus = Math.max(120_000, Math.floor((sortedPlayers()[0]?.score || 0) * 0.04));
      target.score += Math.min(400_000, bonus);
      addLog(`${target.name} airdrop aldı: +${formatTreez(Math.min(400_000, bonus))} TREEZ.`);
    }
  }

  if (event.type === "gas") {
    Object.values(players).forEach((player) => {
      if (player.score > 0) player.score -= Math.floor(player.score * 0.025);
    });
    addLog("Gas Fee Krizi herkesten %2.5 kesti. Kimse şaşırmadı.");
  }

  if (event.type === "whale") {
    const leader = sortedPlayers()[0];
    if (leader && leader.score > 0) {
      const loss = Math.floor(leader.score * 0.07);
      leader.score -= loss;
      const lowPlayers = sortedPlayers().filter((p) => p.id !== leader.id).slice(-2);
      lowPlayers.forEach((p) => {
        p.score += Math.floor(loss / Math.max(1, lowPlayers.length) * 0.55);
      });
      addLog("Balina uyandı. Lider biraz sarsıldı, alttakilere kırıntı düştü.");
    }
  }

  updateGains(before);
}

function rollMarketEvent() {
  if (winner) return;
  if (onlineCount() === 0) return;
  if (now() < nextMarketEventAt) return;

  const event = pickRandom(marketEvents);
  marketEvent = {
    type: event.type,
    title: event.title,
    desc: event.desc,
    endsAt: now() + event.duration * 1000
  };

  nextMarketEventAt = now() + MARKET_EVENT_SECONDS * 1000;

  addLog(`Piyasa olayı: ${event.title}. ${event.desc}`, true);
  applyMarketImmediate(event);
  emitState();
}

function marketMultiplier(action) {
  if (marketEvent.type === "bull" && action === "mine") return 1.75;
  if (marketEvent.type === "bear" && ["mega", "rug", "throne", "jackpot"].includes(action)) return 0.88;
  return 1;
}

function applyMilestoneOption(player, optionId) {
  const option = player.pendingMilestone?.options.find((item) => item.id === optionId);
  if (!option) return false;

  player.pendingMilestone = null;

  if (option.id === "safe_500k") {
    player.score += 500_000;
    addLog(`${player.name}, Güvenli Kasa seçti ve +500.000 TREEZ aldı.`);
  }

  if (option.id === "instant_1m") {
    player.score += 1_000_000;
    addLog(`${player.name}, Anında 1M seçti ve +1.000.000 TREEZ aldı.`);
  }

  if (option.id === "growth_boost") {
    const bonus = Math.min(900_000, Math.floor(player.score * 0.25));
    player.score += bonus;
    addLog(`${player.name}, Portföy Büyüt seçti ve +${formatTreez(bonus)} TREEZ aldı.`);
  }

  if (option.id === "tax_refund") {
    let total = 0;
    sortedPlayers().filter((target) => target.id !== player.id && target.score > 0).forEach((target) => {
      if (hasShield(target)) return;
      const amount = Math.floor(target.score * 0.08);
      target.score -= amount;
      total += amount;
    });
    player.score += total;
    addLog(`${player.name}, Vergi İadesi seçti ve toplam ${formatTreez(total)} TREEZ topladı.`);
  }

  if (option.id === "shield_30") {
    player.shieldUntil = now() + 30_000;
    player.score += 180_000;
    addLog(`${player.name}, Kalkan aldı ve 30 saniye korumaya geçti.`);
  }

  if (option.id === "comeback_bonus") {
    const rank = sortedPlayers().findIndex((p) => p.id === player.id) + 1;
    const bonus = rank >= 4 ? 900_000 : rank === 3 ? 600_000 : 350_000;
    player.score += bonus;
    addLog(`${player.name}, Geri Dönüş Paketi aldı: +${formatTreez(bonus)} TREEZ.`);
  }

  if (option.id === "wipe_others_25") {
    if (Math.random() < 0.25) {
      sortedPlayers().filter((target) => target.id !== player.id).forEach((target) => {
        if (!hasShield(target)) target.score = 0;
      });
      addLog(`${player.name}, Kıyamet Fişi tuttu. Kalkanı olmayan herkes sıfırlandı.`, true);
    } else {
      const loss = Math.floor(player.score * 0.75);
      player.score -= loss;
      addLog(`${player.name}, Kıyamet Fişi denedi ama patladı. ${formatTreez(loss)} TREEZ kaybetti.`);
    }
  }

  if (option.id === "leader_half_38") {
    const target = sortedPlayers().find((p) => p.id !== player.id && p.score > 0 && !hasShield(p));
    if (!target) {
      addLog(`${player.name}, Taht Darbesi seçti ama kalkanı olmayan hedef bulamadı.`);
    } else if (Math.random() < 0.38) {
      const amount = Math.floor(target.score * 0.50);
      target.score -= amount;
      player.score += amount;
      addLog(`${player.name}, Taht Darbesi tuttu. ${target.name} oyuncusundan ${formatTreez(amount)} TREEZ aldı.`);
    } else {
      const loss = Math.floor(player.score * 0.40);
      player.score -= loss;
      addLog(`${player.name}, Taht Darbesi denedi ama olmadı. ${formatTreez(loss)} TREEZ kaybetti.`);
    }
  }

  if (option.id === "chaos_collect_35") {
    if (Math.random() < 0.35) {
      let collected = 0;
      sortedPlayers().filter((target) => target.id !== player.id && target.score > 0).forEach((target) => {
        if (hasShield(target)) return;
        const loss = Math.floor(target.score * 0.40);
        target.score -= loss;
        collected += Math.floor(loss * 0.30);
      });
      player.score += collected;
      addLog(`${player.name}, Piyasa Çöküşü yaptı ve ${formatTreez(collected)} TREEZ topladı.`);
    } else {
      const loss = Math.floor(player.score * 0.50);
      player.score -= loss;
      addLog(`${player.name}, Piyasa Çöküşü denedi ama kendi çöktü. ${formatTreez(loss)} TREEZ kaybetti.`);
    }
  }

  if (option.id === "double_or_burn") {
    if (Math.random() < 0.45) {
      player.score *= 2;
      addLog(`${player.name}, İkiye Katla tuttu. Skor x2 oldu.`);
    } else {
      const loss = Math.floor(player.score * 0.50);
      player.score -= loss;
      addLog(`${player.name}, İkiye Katla denedi ama yarısını kaybetti.`);
    }
  }

  if (option.id === "above_you_hit") {
    if (Math.random() < 0.50) {
      const richerPlayers = sortedPlayers().filter((target) => target.id !== player.id && target.score > player.score && !hasShield(target));
      if (richerPlayers.length === 0) {
        player.score += 250_000;
        addLog(`${player.name}, Üsttekileri Biç seçti ama üstünde açık hedef yoktu. Teselli +250.000 TREEZ aldı.`);
      } else {
        richerPlayers.forEach((target) => {
          target.score -= Math.floor(target.score * 0.35);
        });
        addLog(`${player.name}, Üsttekileri Biç tuttu. Kalkanı olmayan zenginler %35 kaybetti.`);
      }
    } else {
      const loss = Math.floor(player.score * 0.30);
      player.score -= loss;
      addLog(`${player.name}, Üsttekileri Biç denedi ama kendi biçildi. ${formatTreez(loss)} TREEZ kaybetti.`);
    }
  }

  if (option.id === "all_in_sniper") {
    const leader = sortedPlayers().find((p) => p.id !== player.id && p.score > 0 && !hasShield(p));
    if (!leader) {
      addLog(`${player.name}, All-in Keskin Nişancı seçti ama açık lider hedefi yoktu.`);
    } else if (Math.random() < 0.30) {
      const amount = Math.floor(leader.score * 0.70);
      leader.score -= amount;
      player.score += amount;
      addLog(`${player.name}, All-in Keskin Nişancı tuttu. ${leader.name} oyuncusundan ${formatTreez(amount)} TREEZ aldı.`, true);
    } else {
      const loss = Math.floor(player.score * 0.85);
      player.score -= loss;
      addLog(`${player.name}, All-in Keskin Nişancı kaçırdı ve ${formatTreez(loss)} TREEZ kaybetti.`);
    }
  }

  return true;
}

function createPlayer(socketId, name = "Player", token = randomId()) {
  return {
    id: socketId,
    token,
    name: cleanName(name),
    score: 0,
    bestScore: 0,
    totalEarned: 0,
    lastGain: 0,
    lastAction: {},
    lastGlobalAction: 0,
    actions: 0,
    streak: 0,
    nextMilestone: MILESTONE_STEP,
    pendingMilestone: null,
    shieldUntil: 0,
    focusUntil: 0,
    online: true,
    joinedAt: now(),
    lastSeen: now()
  };
}

function attachPlayer(socket, payload = {}) {
  const cleanedName = cleanName(payload.name || "Player");
  let token = String(payload.token || "").replace(/[^a-f0-9]/gi, "").slice(0, 64);

  let player = findByToken(token);

  if (player) {
    const oldId = player.id;
    player.id = socket.id;
    player.online = true;
    player.name = cleanedName === "Player" ? player.name : cleanedName;
    player.lastSeen = now();
    player.lastAction = {};

    delete players[oldId];
    players[socket.id] = player;
    addLog(`${player.name} geri bağlandı. Bakiye korundu.`);
    emitSession(socket, player);
    return player;
  }

  const offlineByName = cleanedName !== "Player" ? findOfflineByName(cleanedName) : null;

  if (offlineByName) {
    const oldId = offlineByName.id;
    offlineByName.id = socket.id;
    offlineByName.online = true;
    offlineByName.name = cleanedName;
    offlineByName.lastSeen = now();
    offlineByName.lastAction = {};
    if (!offlineByName.token) offlineByName.token = token || randomId();

    delete players[oldId];
    players[socket.id] = offlineByName;
    addLog(`${offlineByName.name} ismiyle geri dönüldü. Eski TREEZ bakiyesi korundu.`);
    emitSession(socket, offlineByName);
    return offlineByName;
  }

  if (!token) token = randomId();
  player = createPlayer(socket.id, cleanedName, token);
  players[socket.id] = player;
  addLog(`${player.name} masaya katıldı.`);
  emitSession(socket, player);
  return player;
}

function saveStateNow() {
  try {
    fs.mkdirSync(path.dirname(SAVE_FILE), { recursive: true });
    const data = {
      players: Object.fromEntries(Object.entries(players).map(([id, player]) => [id, {
        ...player,
        online: false,
        lastAction: {},
        pendingMilestone: null
      }])),
      logs,
      winner: null,
      roundStartedAt,
      marketEvent,
      nextMarketEventAt,
      savedAt: now()
    };
    fs.writeFileSync(SAVE_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("State save failed:", error.message);
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveStateNow, 350);
}

function loadState() {
  try {
    if (!fs.existsSync(SAVE_FILE)) return;
    const data = JSON.parse(fs.readFileSync(SAVE_FILE, "utf8"));
    players = data.players || {};
    logs = data.logs || [];
    winner = null;
    roundStartedAt = data.roundStartedAt || now();
    marketEvent = data.marketEvent || marketEvent;
    nextMarketEventAt = data.nextMarketEventAt || nextMarketEventAt;

    Object.values(players).forEach((player) => {
      player.online = false;
      player.lastAction = {};
      player.pendingMilestone = null;
      player.nextMilestone = player.nextMilestone || MILESTONE_STEP;
      player.token = player.token || randomId();
    });

    addLog("Kayıtlı masa geri yüklendi.", true);
  } catch (error) {
    console.error("State load failed:", error.message);
  }
}

function cleanupGhosts() {
  const cutoff = now() - 1000 * 60 * 60 * 8;
  Object.entries(players).forEach(([id, player]) => {
    const emptyGhost = !player.online && player.name === "Player" && player.score <= 0;
    const oldGhost = !player.online && player.score <= 0 && (player.lastSeen || 0) < cutoff;
    if (emptyGhost || oldGhost) delete players[id];
  });
}

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    online: onlineCount(),
    players: Object.keys(players).length,
    winner,
    uptime: process.uptime(),
    time: new Date().toISOString()
  });
});

app.get("/state", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(403).send("Yetkisiz.");
  res.json(getState());
});

app.get("/reset", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(403).send("Yetkisiz.");
  resetRound(true);
  res.send("TREEZCOIN leaderboard temizlendi. Oyuncular duruyor, para sıfırlandı.");
});

app.get("/wipe", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(403).send("Yetkisiz.");
  resetRound(false);
  res.send("TREEZCOIN tüm oyuncularla birlikte sıfırlandı.");
});

io.on("connection", (socket) => {
  if (onlineCount() >= MAX_ONLINE_PLAYERS) {
    socket.emit("roomFull");
    socket.disconnect();
    return;
  }

  let player = null;

  socket.on("hello", (payload) => {
    if (player) return;
    player = attachPlayer(socket, payload || {});
    emitState();
    createMilestoneOffer(socket, player);
  });

  socket.on("setName", (name) => {
    if (!player) player = attachPlayer(socket, { name });
    const cleaned = cleanName(name);
    player.name = cleaned;
    player.lastSeen = now();
    addLog(`${player.name} ismini kaydetti.`);
    emitSession(socket, player);
    emitState();
    createMilestoneOffer(socket, player);
  });

  socket.on("action", (type) => {
    if (!player) {
      player = attachPlayer(socket, { name: "Player" });
    }

    if (!player || winner) return;
    player.lastSeen = now();

    if (!canUse(socket, player, type)) return;

    const before = beforeScores();
    const m = marketMultiplier(type);

    if (type === "mine") {
      let gain = 40 + Math.floor(Math.random() * 30) + Math.floor(player.score * 0.004);
      if (hasFocus(player)) gain *= 2;
      gain = Math.floor(gain * m);
      player.score += gain;
      player.streak = (player.streak || 0) + 1;
      addLog(`${player.name} TREEZ kazdı: +${formatTreez(gain)}`);
    }

    if (type === "greed") {
      const chance = 0.66;
      if (Math.random() < chance) {
        player.score = Math.max(2, player.score * 2);
        player.streak = (player.streak || 0) + 1;
        addLog(`${player.name} Katla yaptı. Skor x2.`);
      } else {
        player.score = Math.floor(player.score * 0.45);
        player.streak = 0;
        addLog(`${player.name} Katla yaparken patladı.`);
      }
    }

    if (type === "mega") {
      if (player.score < 50) {
        addLog(`${player.name} Mega Pump için en az 50 TREEZ lazım.`);
      } else if (Math.random() < 0.42 * m) {
        player.score *= 5;
        player.streak = (player.streak || 0) + 1;
        addLog(`${player.name} Mega Pump tuttu. Skor x5.`, true);
      } else {
        player.score = Math.floor(player.score * 0.18);
        player.streak = 0;
        addLog(`${player.name} Mega Pump'ta ağır tokat yedi.`);
      }
    }

    if (type === "steal") {
      const targets = sortedPlayers().filter((p) => p.id !== player.id && p.score > 0);
      if (targets.length === 0) {
        addLog(`${player.name} çalacak oyuncu bulamadı.`);
      } else {
        const target = targets[Math.floor(Math.random() * targets.length)];
        if (hasShield(target)) {
          const loss = Math.floor(player.score * 0.08);
          player.score -= loss;
          addLog(`${player.name}, ${target.name} oyuncusuna saldırdı ama kalkan yedi. ${formatTreez(loss)} TREEZ kaybetti.`);
        } else {
          const amount = Math.max(1, Math.floor(target.score * 0.23));
          target.score -= amount;
          player.score += amount;
          addLog(`${player.name}, ${target.name} oyuncusundan ${formatTreez(amount)} TREEZ çaldı.`);
        }
      }
    }

    if (type === "tax") {
      const leader = sortedPlayers()[0];
      if (!leader || leader.id === player.id || leader.score <= 0) {
        addLog(`${player.name} liderden vergi alamadı.`);
      } else if (hasShield(leader)) {
        addLog(`${player.name} liderden vergi almak istedi ama liderde kalkan vardı.`);
      } else {
        const amount = Math.max(1, Math.floor(leader.score * 0.17));
        leader.score -= amount;
        player.score += amount;
        addLog(`${player.name}, lider ${leader.name} oyuncusundan ${formatTreez(amount)} TREEZ vergi aldı.`);
      }
    }

    if (type === "rug") {
      if (player.score < 100) {
        addLog(`${player.name} Rug Pull için en az 100 TREEZ lazım.`);
      } else if (Math.random() < 0.36 * m) {
        let collected = 0;
        sortedPlayers().filter((p) => p.id !== player.id).forEach((victim) => {
          if (hasShield(victim)) return;
          const loss = Math.floor(victim.score * 0.30);
          victim.score -= loss;
          collected += Math.floor(loss * 0.52);
        });
        player.score += collected;
        addLog(`${player.name} Rug Pull yaptı ve ${formatTreez(collected)} TREEZ topladı. Masa yine yandı.`, true);
      } else {
        player.score = 0;
        player.streak = 0;
        addLog(`${player.name} Rug Pull denedi ama kendi sıfırlandı.`);
      }
    }

    if (type === "throne") {
      const leader = sortedPlayers()[0];
      if (!leader || leader.id === player.id || leader.score <= 0) {
        addLog(`${player.name} Taht Soygunu yapamadı. Zaten lider kendisi.`);
      } else if (hasShield(leader)) {
        const loss = Math.floor(player.score * 0.20);
        player.score -= loss;
        addLog(`${player.name} Taht Soygunu denedi ama liderde kalkan vardı. ${formatTreez(loss)} TREEZ gitti.`);
      } else if (Math.random() < 0.38 * m) {
        const amount = Math.max(1, Math.floor(leader.score * 0.50));
        leader.score -= amount;
        player.score += amount;
        addLog(`${player.name}, lider ${leader.name} oyuncusundan ${formatTreez(amount)} TREEZ çaldı. Taht sallandı.`, true);
      } else {
        const loss = Math.floor(player.score * 0.72);
        player.score -= loss;
        player.streak = 0;
        addLog(`${player.name} Taht Soygunu denedi ama patladı. ${formatTreez(loss)} TREEZ kaybetti.`);
      }
    }

    if (type === "jackpot") {
      if (player.score < 500) {
        addLog(`${player.name} Jackpot için en az 500 TREEZ lazım.`);
      } else if (Math.random() < 0.21 * m) {
        player.score *= 16;
        addLog(`${player.name} Jackpot vurdu. Skor x16. Kumarhane ağlıyor gibi yaptı.`, true);
      } else {
        player.score = Math.floor(player.score * 0.06);
        player.streak = 0;
        addLog(`${player.name} Jackpot kaybetti. Kasa yine kazandı.`);
      }
    }

    if (type === "shield") {
      if (spendCost(socket, player, "shield")) {
        player.shieldUntil = now() + 28_000;
        addLog(`${player.name} Kalkan açtı. 28 saniye daha az ağlayacak.`);
      }
    }

    if (type === "focus") {
      if (spendCost(socket, player, "focus")) {
        player.focusUntil = now() + 18_000;
        addLog(`${player.name} Focus Boost aldı. Kazım kısa süreliğine güçlendi.`);
      }
    }

    updateGains(before);
    checkWinner(player);
    emitState();
    createMilestoneOffer(socket, player);
  });

  socket.on("milestoneChoice", (optionId) => {
    if (!player || winner || !player.pendingMilestone) return;

    const before = beforeScores();
    const ok = applyMilestoneOption(player, optionId);
    if (!ok) return;

    updateGains(before);
    checkWinner(player);
    emitState();
    createMilestoneOffer(socket, player);
  });

  socket.on("disconnect", () => {
    if (!player) return;
    player.online = false;
    player.lastSeen = now();
    player.lastAction = {};

    if (player.name === "Player" && player.score <= 0) {
      delete players[player.id];
      addLog("İsimsiz oyuncu masadan çıktı.");
    } else {
      addLog(`${player.name} masadan ayrıldı ama TREEZ bakiyesi kaldı.`);
    }

    emitState();
  });
});

setInterval(() => {
  cleanupGhosts();
  rollMarketEvent();

  if (!winner && getRoundRemaining() <= 0) {
    const leader = sortedPlayers()[0];
    if (leader && leader.score > 0) {
      winner = leader.name;
      addLog(`Süre bitti. ${leader.name} masanın lideri olarak kazandı!`, true);
      emitState();
      setTimeout(() => resetRound(true), 9000);
    } else {
      resetRound(true);
    }
  }

  io.emit("tick", {
    serverTime: now(),
    roundRemaining: getRoundRemaining(),
    marketEvent
  });
}, 1000);

process.on("SIGINT", () => {
  saveStateNow();
  process.exit();
});

process.on("SIGTERM", () => {
  saveStateNow();
  process.exit();
});

loadState();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`TREEZCOIN BIG REWORK çalışıyor: http://localhost:${PORT}`);
});
