const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  pingTimeout: 20000,
  pingInterval: 25000
});

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || "1234";

app.use(express.static("public"));

const CONFIG = {
  maxOnlinePlayers: 6,
  winScore: 10_000_000,
  roundSeconds: 10 * 60,
  startScore: 120_000,
  restartDelayMs: 6500
};

const BOT_DEFS = [
  {
    key: "bot_atlas",
    name: "Atlas",
    company: "ATLAS CAPITAL",
    role: "banker",
    style: "safe",
    preferredSectors: ["bank", "media", "mine"]
  },
  {
    key: "bot_shadow",
    name: "Shadow",
    company: "SHADOW FUND",
    role: "saboteur",
    style: "aggressive",
    preferredSectors: ["darknet", "palace", "exchange"]
  }
];


const ROLE_DEFS = {
  miner: {
    id: "miner",
    title: "Madenci",
    icon: "⛏️",
    desc: "Güvenli büyür, kolay batmaz.",
    plus: "TREEZ Kaz ve Maden avantajlı.",
    minus: "PvP hamleleri daha zayıf."
  },
  thief: {
    id: "thief",
    title: "Hırsız",
    icon: "🕵️",
    desc: "Hedef seçer, para söker.",
    plus: "Çalma ve baskı güçlü.",
    minus: "Isı hızlı yükselir."
  },
  banker: {
    id: "banker",
    title: "Banker",
    icon: "🏦",
    desc: "Kasa, sigorta, itibar.",
    plus: "Koruma sistemleri güçlü.",
    minus: "Riskli kazançlar daha zayıf."
  },
  whale: {
    id: "whale",
    title: "Balina",
    icon: "🐋",
    desc: "Büyük risk, büyük ödül.",
    plus: "Mega Pump, Jackpot, Kaldıraç güçlü.",
    minus: "Patlarsa daha çok yanar."
  },
  insurer: {
    id: "insurer",
    title: "Sigortacı",
    icon: "🧾",
    desc: "Hayatta kalma uzmanı.",
    plus: "Kayıpları daha iyi telafi eder.",
    minus: "Kazançları biraz düşük."
  },
  saboteur: {
    id: "saboteur",
    title: "Sabotajcı",
    icon: "💣",
    desc: "Lider ve sektör avcısı.",
    plus: "Lidere ve sektörlere karşı güçlü.",
    minus: "Kazım gücü düşük."
  },
  gambler: {
    id: "gambler",
    title: "Şansçı",
    icon: "🎲",
    desc: "Riskli hamlelerin delisi.",
    plus: "Jackpot ve riskte avantajlı.",
    minus: "Kötü sonuç daha sert."
  }
};

const SECTOR_DEFS = {
  mine: {
    id: "mine",
    title: "Maden Bölgesi",
    icon: "⛏️",
    desc: "TREEZ Kaz güçlenir. Güvenli büyüme sektörü.",
    emptyCost: 50_000,
    takeoverCost: 120_000
  },
  exchange: {
    id: "exchange",
    title: "Borsa Merkezi",
    icon: "📈",
    desc: "Katla, Mega Pump ve Kaldıraç güçlenir.",
    emptyCost: 70_000,
    takeoverCost: 140_000
  },
  bank: {
    id: "bank",
    title: "Banka Ağı",
    icon: "🏦",
    desc: "Kasa, sigorta ve itibar güçlenir.",
    emptyCost: 70_000,
    takeoverCost: 135_000
  },
  media: {
    id: "media",
    title: "Medya Merkezi",
    icon: "📺",
    desc: "İtibar artışı ve regülatörden korunma sağlar.",
    emptyCost: 55_000,
    takeoverCost: 115_000
  },
  darknet: {
    id: "darknet",
    title: "Darknet Pazarı",
    icon: "🕶️",
    desc: "Çalma, baskı ve kirli hamleler güçlenir.",
    emptyCost: 80_000,
    takeoverCost: 155_000
  },
  palace: {
    id: "palace",
    title: "Saray Bölgesi",
    icon: "👑",
    desc: "Lider avı ve taht hamleleri güçlenir.",
    emptyCost: 75_000,
    takeoverCost: 150_000
  }
};

const MARKET_EVENTS = [
  {
    id: "calm",
    title: "Piyasa Sakin",
    desc: "Dengeli market. Büyük çılgınlık yok.",
    duration: 70,
    mine: 1,
    risk: 1,
    pvp: 1
  },
  {
    id: "bull",
    title: "Boğa Sezonu",
    desc: "Kazançlar biraz artar, risk iştahı yükselir.",
    duration: 70,
    mine: 1.12,
    risk: 1.16,
    pvp: 1
  },
  {
    id: "bear",
    title: "Ayı Sezonu",
    desc: "Riskli hamlelerin kayıpları artar.",
    duration: 65,
    mine: 0.92,
    risk: 0.92,
    loss: 1.18,
    pvp: 1
  },
  {
    id: "liquidity",
    title: "Likidite Krizi",
    desc: "Büyük risk ve kaldıraç tehlikeli.",
    duration: 60,
    mine: 0.96,
    risk: 0.95,
    loss: 1.25,
    pvp: 1.05
  },
  {
    id: "taxWeek",
    title: "Vergi Haftası",
    desc: "Lider Vergisi ve regülatör baskısı artar.",
    duration: 65,
    mine: 1,
    risk: 1,
    tax: 1.25,
    regulator: 1.15,
    pvp: 1
  },
  {
    id: "meme",
    title: "Meme Coin Çılgınlığı",
    desc: "Jackpot ve Pump iştahı yükselir.",
    duration: 70,
    mine: 1.04,
    risk: 1.2,
    jackpot: 1.18,
    loss: 1.12,
    pvp: 1
  }
];

const COOLDOWNS = {
  mine: 650,
  greed: 1800,
  mega: 3600,
  steal: 4200,
  tax: 5200,
  rug: 7600,
  throne: 6800,
  jackpot: 8500,
  shield: 12000,
  riskScan: 9000,
  vault: 11000,
  insurance: 15000,
  leverage: 26000,
  reputation: 14000,
  rolePower: 22000,
  takeSector: 6500,
  pressureCompany: 7000,
  damageSector: 8000
};

const players = new Map(); // token -> player
const sockets = new Map(); // socket.id -> token
let roundCounter = 0;

let round = createRound();

function uid(prefix = "") {
  return prefix + crypto.randomBytes(8).toString("hex");
}

function now() {
  return Date.now();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rand(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function pct(value, ratio) {
  return Math.floor(value * ratio);
}

function cleanText(value, max = 20, fallback = "Player") {
  const text = String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  return text || fallback;
}

function sameText(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function sameCompany(a, b) {
  return String(a || "").trim().toUpperCase() === String(b || "").trim().toUpperCase();
}

function findExistingPlayerByProfile(payload = {}) {
  const wantedName = cleanText(payload.name, 16, "");
  const wantedCompany = cleanText(payload.company || (wantedName ? `${wantedName} Capital` : ""), 22, "").toUpperCase();

  if (!wantedName && !wantedCompany) return null;

  const list = getPlayersArray().filter((p) => !p.isBot);

  // Önce offline eşleşmeyi al. Böylece eski oyuncuya geri döner.
  let match = list.find((p) => !p.online && sameText(p.name, wantedName) && sameCompany(p.company, wantedCompany));
  if (match) return match;

  // Sonra online eşleşme varsa onu kullan. Eski socket koparılır, kopya oyuncu oluşmaz.
  match = list.find((p) => sameText(p.name, wantedName) && sameCompany(p.company, wantedCompany));
  return match || null;
}


function createRound() {
  roundCounter += 1;
  const roundNumber = roundCounter;
  const sectors = {};
  Object.values(SECTOR_DEFS).forEach((sector) => {
    sectors[sector.id] = {
      ...sector,
      ownerId: null,
      ownerName: "Boş",
      stability: 100
    };
  });

  return {
    id: uid("round_"),
    number: roundNumber,
    market() {
      return MARKET_EVENTS[this.marketIndex] || MARKET_EVENTS[0];
    },
    startedAt: now(),
    endsAt: now() + CONFIG.roundSeconds * 1000,
    winner: null,
    restarting: false,
    logs: [],
    sectors,
    marketIndex: 0,
    marketEndsAt: now() + MARKET_EVENTS[0].duration * 1000,
    finalCrisis: null,
    stats: {
      roundNumber: roundNumber,
      biggestGain: null,
      biggestLoss: null,
      mostStolen: {},
      mostAttacked: {},
      riskActions: {},
      leaderTime: {},
      sectorTakeovers: {},
      companyPressure: {},
      sectorDamage: {},
      regulatorHits: {},
      liquidations: {}
    }
  };
}

function freshPlayer(token, payload = {}) {
  const name = cleanText(payload.name, 16, "Player");
  const roleId = ROLE_DEFS[payload.role] ? payload.role : "";
  const company = cleanText(payload.company || `${name} Capital`, 22, `${name} Capital`).toUpperCase();

  return {
    id: uid("p_"),
    token,
    socketId: null,
    name,
    company,
    role: roleId,
    isBot: token.startsWith("bot_token_") && Boolean(payload.isBot),
    botStyle: token.startsWith("bot_token_") ? (payload.botStyle || "") : "",
    preferredSectors: token.startsWith("bot_token_") && Array.isArray(payload.preferredSectors) ? payload.preferredSectors : [],
    online: token.startsWith("bot_token_") && Boolean(payload.isBot),
    lastSeen: now(),
    score: CONFIG.startScore,
    vault: 0,
    shield: 0,
    insurance: 0,
    riskAnalysis: 0,
    heat: roleId === "thief" ? 18 : roleId === "saboteur" ? 22 : roleId === "banker" ? 4 : 10,
    reputation: roleId === "banker" ? 62 : roleId === "insurer" ? 58 : roleId === "thief" ? 38 : roleId === "saboteur" ? 35 : 50,
    pendingDecision: null,
    milestones: {},
    traits: {},
    leverageUntil: 0,
    liquidatedUntil: 0,
    lastGain: 0,
    cooldowns: {},
    actionCounts: {},
    attackedCount: 0,
    stolenTotal: 0,
    sectorsTaken: 0
  };
}

function ensureBots() {
  BOT_DEFS.forEach((bot) => {
    const token = `bot_token_${bot.key}`;
    if (players.has(token)) return;

    const player = freshPlayer(token, {
      name: bot.name,
      company: bot.company,
      role: bot.role,
      isBot: true,
      botStyle: bot.style,
      preferredSectors: bot.preferredSectors
    });

    player.id = `bot_${bot.key}`;
    player.online = true;
    player.socketId = null;
    player.heat = bot.role === "saboteur" ? 22 : bot.role === "banker" ? 4 : 10;
    player.reputation = bot.role === "banker" ? 62 : bot.role === "saboteur" ? 35 : 50;
    player.cooldowns = {};
    player.nextBotMoveAt = now() + rand(2500, 6500);
    players.set(token, player);
    addLog(`${player.name} bot masaya katıldı.`, true);
  });
}

function resetBotForRound(player) {
  player.online = true;
  player.socketId = null;
  if (player.token.includes("atlas")) {
    player.role = "banker";
    player.botStyle = "safe";
    player.preferredSectors = ["bank", "media", "mine"];
  } else if (player.token.includes("shadow")) {
    player.role = "saboteur";
    player.botStyle = "aggressive";
    player.preferredSectors = ["darknet", "palace", "exchange"];
  }
  player.nextBotMoveAt = now() + rand(2800, 7000);
}

function livingHumanPlayers() {
  return getActivePlayers().filter((p) => !p.isBot);
}

function chooseBotSector(player) {
  const preferred = Array.isArray(player.preferredSectors) ? player.preferredSectors : [];
  for (const id of preferred) {
    const sector = round.sectors[id];
    if (sector && sector.ownerId !== player.id) return id;
  }

  const open = Object.values(round.sectors).find((s) => !s.ownerId);
  if (open) return open.id;

  const enemy = Object.values(round.sectors).find((s) => s.ownerId && s.ownerId !== player.id);
  return enemy?.id || "";
}

function botAffordableSector(player) {
  const sectorId = chooseBotSector(player);
  if (!sectorId) return "";
  const sector = round.sectors[sectorId];
  const cost = sector.ownerId ? sector.takeoverCost : sector.emptyCost;
  return player.score >= cost ? sectorId : "";
}

function chooseBotMove(player) {
  const top = leader();
  const humans = livingHumanPlayers();
  const targetHuman = humans
    .filter((p) => p.id !== player.id && p.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  const sectorId = botAffordableSector(player);

  if (player.botStyle === "safe") {
    if (sectorId && Math.random() < 0.23) return { type: "takeSector", sectorId };
    if (player.shield < 1 && player.score > 110_000 && Math.random() < 0.18) return { type: "shield" };
    if (player.insurance < 1 && player.score > 150_000 && Math.random() < 0.16) return { type: "insurance" };
    if (player.heat > 55 && player.score > 110_000 && Math.random() < 0.18) return { type: "reputation" };
    if (player.score > 520_000 && Math.random() < 0.17) return { type: "greed" };
    return { type: "mine" };
  }

  // Shadow Fund: lideri dürten ama oyunu boğmayan saldırgan bot.
  if (sectorId && Math.random() < 0.18) return { type: "takeSector", sectorId };

  if (targetHuman && top && top.id === targetHuman.id && targetHuman.score > player.score * 1.15 && Math.random() < 0.28) {
    return { type: "pressureCompany", targetId: targetHuman.id };
  }

  if (targetHuman && targetHuman.score > 280_000 && Math.random() < 0.24) {
    return { type: "steal", targetId: targetHuman.id };
  }

  if (top && top.id !== player.id && top.score > 700_000 && Math.random() < 0.18) return { type: "tax" };
  if (player.score > 650_000 && Math.random() < 0.10) return { type: "mega" };
  if (player.score > 900_000 && Math.random() < 0.06) return { type: "jackpot" };
  if (player.heat > 70 && player.score > 100_000 && Math.random() < 0.16) return { type: "reputation" };
  return Math.random() < 0.35 ? { type: "greed" } : { type: "mine" };
}

function runBots() {
  if (round.winner || round.restarting) return;

  ensureBots();

  getPlayersArray().filter((p) => p.isBot).forEach((bot) => {
    bot.online = true;

    if (bot.pendingDecision) {
      const options = bot.pendingDecision.options || [];
      const choice = bot.botStyle === "safe"
        ? options.find((o) => /Temkinli|Regüle|Güvenli/i.test(o.title)) || options[0]
        : options.find((o) => /Agresif|Gölge|Piyasayı/i.test(o.title)) || options[0];

      if (choice) applyDecision(bot, choice.id);
      bot.nextBotMoveAt = now() + rand(2500, 5200);
      return;
    }

    if ((bot.nextBotMoveAt || 0) > now()) return;

    const move = chooseBotMove(bot);
    if (move) performAction(bot, move);

    bot.nextBotMoveAt = now() + (bot.botStyle === "safe" ? rand(3600, 7600) : rand(3200, 6800));
  });
}


function getPlayersArray() {
  return Array.from(players.values());
}

function getActivePlayers() {
  return getPlayersArray().filter((p) => p.score > 0 || p.vault > 0 || p.online);
}

function getOnlinePlayers() {
  return getPlayersArray().filter((p) => p.online && !p.isBot);
}

function findPlayerById(id) {
  return getPlayersArray().find((p) => p.id === id);
}

function roleTitle(player) {
  return ROLE_DEFS[player.role]?.title || "Rolsüz";
}

function roleIcon(player) {
  return ROLE_DEFS[player.role]?.icon || "◻️";
}

function hasSector(player, sectorId) {
  return Object.values(round.sectors).some((s) => s.id === sectorId && s.ownerId === player.id);
}

function countSectors(player) {
  return Object.values(round.sectors).filter((s) => s.ownerId === player.id).length;
}

function addLog(text, important = false) {
  round.logs.push({
    time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    text,
    important
  });
  if (round.logs.length > 42) round.logs.shift();
}

function addStatMap(name, key, amount = 1) {
  if (!round.stats[name]) round.stats[name] = {};
  round.stats[name][key] = (round.stats[name][key] || 0) + amount;
}

function registerGain(player, amount) {
  if (!amount) return;
  player.lastGain = amount;
  if (amount > 0) {
    if (!round.stats.biggestGain || amount > round.stats.biggestGain.amount) {
      round.stats.biggestGain = { name: player.name, amount };
    }
  } else {
    const loss = Math.abs(amount);
    if (!round.stats.biggestLoss || loss > round.stats.biggestLoss.amount) {
      round.stats.biggestLoss = { name: player.name, amount: loss };
    }
  }
}

function addScore(player, amount, reason = "", options = {}) {
  if (!player || round.winner) return 0;

  let finalAmount = Math.floor(amount);

  if (finalAmount < 0 && player.riskAnalysis > 0 && options.risky) {
    finalAmount = Math.ceil(finalAmount * 0.62);
    player.riskAnalysis -= 1;
    socketToast(player, "Risk Analizi kaybı azalttı.");
  }

  if (finalAmount < 0 && player.insurance > 0 && Math.abs(finalAmount) >= 70_000) {
    const refund = Math.floor(Math.abs(finalAmount) * (player.role === "insurer" ? 0.38 : player.role === "banker" ? 0.32 : 0.25));
    finalAmount += refund;
    player.insurance -= 1;
    socketToast(player, `Sigorta ${format(refund)} TREEZ telafi etti.`);
  }

  if (finalAmount < 0 && player.shield > 0 && options.attack) {
    finalAmount = Math.ceil(finalAmount * 0.46);
    player.shield -= 1;
    socketToast(player, "Kalkan saldırıyı azalttı.");
  }

  if (player.leverageUntil > now() && options.risky) {
    finalAmount = Math.floor(finalAmount * 2);
    if (finalAmount < -220_000) {
      liquidate(player);
    }
  }

  player.score = Math.max(0, player.score + finalAmount);
  registerGain(player, finalAmount);
  if (reason && finalAmount !== 0) {
    addLog(`${player.name}: ${reason} (${finalAmount > 0 ? "+" : ""}${format(finalAmount)} TREEZ)`, Math.abs(finalAmount) >= 180_000);
  }

  checkMilestones(player);
  checkWin();
  return finalAmount;
}

function liquidate(player) {
  if (!player || player.liquidatedUntil > now()) return;
  const extraLoss = Math.min(350_000, Math.floor(player.score * 0.08));
  player.score = Math.max(0, player.score - extraLoss);
  player.leverageUntil = 0;
  player.liquidatedUntil = now() + 35_000;
  player.heat = clamp(player.heat - 8, 0, 100);
  player.reputation = clamp(player.reputation - 10, 0, 100);
  addStatMap("liquidations", player.name);
  addLog(`${player.name} kaldıraçta LİKİDE oldu.`, true);
}

function addHeat(player, amount) {
  if (!player) return;
  const mediaSoftener = hasSector(player, "media") ? 0.82 : 1;
  const roleMultiplier = player.role === "thief" || player.role === "saboteur" ? 1.08 : 1;
  player.heat = clamp(player.heat + Math.round(amount * mediaSoftener * roleMultiplier), 0, 100);
}

function addRep(player, amount) {
  if (!player) return;
  const mediaBonus = hasSector(player, "media") && amount > 0 ? 1.18 : 1;
  player.reputation = clamp(player.reputation + Math.round(amount * mediaBonus), 0, 100);
}

function regulatorThreat(player) {
  if (!player) return 0;
  let threat = player.heat - Math.floor(player.reputation / 2);
  if (hasSector(player, "media")) threat -= 8;
  if (round.market().regulator) threat = Math.floor(threat * round.market().regulator);
  return clamp(threat, 0, 100);
}

function maybeRegulator(player) {
  const threat = regulatorThreat(player);
  if (threat < 58) return;
  const chance = threat / 170;
  if (Math.random() > chance) return;

  const fine = Math.min(220_000, Math.max(35_000, Math.floor(player.score * (0.025 + threat / 2000))));
  player.score = Math.max(0, player.score - fine);
  player.heat = clamp(player.heat - 18, 0, 100);
  player.reputation = clamp(player.reputation - 6, 0, 100);
  if (player.shield > 0 && Math.random() < 0.45) player.shield -= 1;
  addStatMap("regulatorHits", player.name);
  registerGain(player, -fine);
  addLog(`REGÜLATÖR ${player.name} şirketine ${format(fine)} TREEZ ceza kesti.`, true);
}

function market() {
  return MARKET_EVENTS[round.marketIndex] || MARKET_EVENTS[0];
}


function rotateMarket() {
  if (now() < round.marketEndsAt || round.winner) return;
  round.marketIndex = (round.marketIndex + 1) % MARKET_EVENTS.length;
  const m = round.market();
  round.marketEndsAt = now() + m.duration * 1000;
  addLog(`Piyasa değişti: ${m.title}.`, true);
}

function profileTitle(player) {
  if (player.heat >= 76 && player.reputation <= 35) return "Kara Liste";
  if (player.reputation >= 76 && player.heat <= 30) return "Kurumsal Dev";
  if (player.heat >= 65) return "Riskli Şirket";
  if (player.reputation >= 65) return "Saygın Fon";
  if ((player.actionCounts.steal || 0) + (player.actionCounts.pressureCompany || 0) >= 4) return "Avcı";
  if ((player.actionCounts.jackpot || 0) + (player.actionCounts.mega || 0) >= 4) return "Spekülatör";
  return "Dengeli";
}

function heatTitle(value) {
  if (value >= 76) return "Aranıyor";
  if (value >= 51) return "Tehlikeli";
  if (value >= 26) return "Şüpheli";
  return "Temiz";
}

function cooldownReady(player, type) {
  const until = player.cooldowns[type] || 0;
  if (until > now()) return false;
  player.cooldowns[type] = now() + (COOLDOWNS[type] || 1000);
  return true;
}

function socketToast(player, message) {
  if (player?.socketId) io.to(player.socketId).emit("toast", message);
}

function format(num) {
  return Math.floor(num || 0).toLocaleString("tr-TR");
}

function sortedPlayers() {
  return getPlayersArray().sort((a, b) => (b.score + b.vault * 0.25) - (a.score + a.vault * 0.25));
}

function leader() {
  return sortedPlayers()[0] || null;
}

function applyActionCount(player, type) {
  player.actionCounts[type] = (player.actionCounts[type] || 0) + 1;
  if (["greed", "mega", "jackpot", "rug", "leverage", "throne"].includes(type)) {
    addStatMap("riskActions", player.name);
  }
}

function checkMilestones(player) {
  if (!player || player.pendingDecision || (!player.socketId && !player.isBot)) return;
  const points = [500_000, 2_000_000, 5_000_000];
  for (const point of points) {
    if (player.score >= point && !player.milestones[point]) {
      player.pendingDecision = createMilestoneOffer(point);
      if (player.socketId) io.to(player.socketId).emit("decisionOffer", player.pendingDecision);
      addLog(`${player.name} ${format(point)} TREEZ şirket kararına geldi.`, false);
      return;
    }
  }
}

function createMilestoneOffer(point) {
  if (point === 500_000) {
    return {
      id: uid("dec_"),
      milestone: point,
      title: "500K Şirket Kimliği",
      desc: "Hafif ama yön belirleyen karar.",
      options: [
        { id: "safeStart", title: "Temkinli Fon", desc: "Kalkan +1, itibar +6. Kazanç değil güvenlik." },
        { id: "fastStart", title: "Agresif Fon", desc: "+70K nakit, ısı +8. Küçük hız, küçük risk." }
      ]
    };
  }

  if (point === 2_000_000) {
    return {
      id: uid("dec_"),
      milestone: point,
      title: "2M Piyasa Stratejisi",
      desc: "Şirket karakterin netleşiyor.",
      options: [
        { id: "regulated", title: "Regüle Büyüme", desc: "İtibar +14, sigorta +1. Kirli hamleler zayıflar." },
        { id: "shadow", title: "Gölge Ekonomi", desc: "Baskı ve çalma güçlenir. Isı +14." }
      ]
    };
  }

  return {
    id: uid("dec_"),
    milestone: point,
    title: "5M Final Planı",
    desc: "Artık final baskısı başlıyor.",
    options: [
      { id: "finalSafe", title: "Güvenli Çıkış", desc: "Kalkan +1, sigorta +1, final kaybı azalır." },
      { id: "finalSpeed", title: "Piyasayı Ez", desc: "+180K nakit, riskli hamleler güçlenir, ısı +12." }
    ]
  };
}

function applyDecision(player, optionId) {
  const offer = player.pendingDecision;
  if (!offer) return;

  if (optionId === "safeStart") {
    player.shield = Math.min(3, player.shield + 1);
    addRep(player, 6);
    player.traits.safeStart = true;
    addLog(`${player.name} Temkinli Fon seçti.`);
  } else if (optionId === "fastStart") {
    addScore(player, 70_000, "Agresif Fon sermayesi");
    addHeat(player, 8);
    player.traits.fastStart = true;
    addLog(`${player.name} Agresif Fon seçti.`);
  } else if (optionId === "regulated") {
    addRep(player, 14);
    player.insurance = Math.min(3, player.insurance + 1);
    player.traits.regulated = true;
    addLog(`${player.name} Regüle Büyüme seçti.`);
  } else if (optionId === "shadow") {
    addHeat(player, 14);
    player.traits.shadow = true;
    addLog(`${player.name} Gölge Ekonomi seçti.`);
  } else if (optionId === "finalSafe") {
    player.shield = Math.min(3, player.shield + 1);
    player.insurance = Math.min(3, player.insurance + 1);
    player.traits.finalSafe = true;
    addLog(`${player.name} Güvenli Çıkış planı aldı.`);
  } else if (optionId === "finalSpeed") {
    addScore(player, 180_000, "Final Hızı sermayesi");
    addHeat(player, 12);
    player.traits.finalSpeed = true;
    addLog(`${player.name} Piyasayı Ez planı aldı.`);
  }

  player.milestones[offer.milestone] = optionId;
  player.pendingDecision = null;
  broadcastState();
}

function getTarget(player, targetId = "") {
  if (targetId) {
    const target = findPlayerById(targetId);
    if (target && target.id !== player.id && (target.score > 0 || target.vault > 0 || target.online)) return target;
  }
  const candidates = getActivePlayers().filter((p) => p.id !== player.id && (p.score > 0 || p.vault > 0));
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    const leaderBoost = b.score - a.score;
    const heatBoost = (b.heat || 0) - (a.heat || 0);
    return leaderBoost + heatBoost * 5000;
  });
  return candidates[0];
}

function actionMine(player) {
  let gain = rand(18_000, 34_000);
  if (player.role === "miner") gain = Math.floor(gain * 1.28);
  if (hasSector(player, "mine")) gain = Math.floor(gain * 1.18);
  if (player.role === "insurer") gain = Math.floor(gain * 0.94);
  gain = Math.floor(gain * round.market().mine);
  addScore(player, gain, "", {});
  addRep(player, 1);
}

function actionGreed(player) {
  const successChance = 0.62 + (hasSector(player, "exchange") ? 0.04 : 0) + (player.role === "gambler" ? 0.03 : 0);
  if (Math.random() < successChance) {
    let gain = rand(55_000, 110_000);
    if (hasSector(player, "exchange")) gain = Math.floor(gain * 1.12);
    gain = Math.floor(gain * round.market().risk);
    addScore(player, gain, "Katla tuttu", { risky: true });
  } else {
    let loss = -rand(32_000, 75_000);
    if (round.market().loss) loss = Math.floor(loss * round.market().loss);
    if (player.role === "whale" || player.role === "gambler") loss = Math.floor(loss * 1.08);
    addScore(player, loss, "Katla patladı", { risky: true });
  }
  addHeat(player, 2);
}

function actionMega(player) {
  if (player.score < 80_000) return socketToast(player, "Mega Pump için en az 80K gerekir.");
  let chance = 0.38;
  if (player.role === "whale") chance += 0.05;
  if (player.role === "gambler") chance += 0.04;
  if (hasSector(player, "exchange")) chance += 0.04;
  if (player.traits.finalSpeed) chance += 0.03;

  if (Math.random() < chance) {
    let gain = rand(180_000, 420_000);
    gain = Math.floor(gain * round.market().risk);
    addScore(player, gain, "Mega Pump tuttu", { risky: true });
  } else {
    let loss = -rand(90_000, 230_000);
    if (round.market().loss) loss = Math.floor(loss * round.market().loss);
    if (player.role === "whale") loss = Math.floor(loss * 1.12);
    addScore(player, loss, "Mega Pump çöktü", { risky: true });
  }
  addHeat(player, 7);
}

function actionJackpot(player) {
  if (player.score < 180_000) return socketToast(player, "Jackpot için en az 180K gerekir.");
  const jackpotChance = 0.15; // özel istek: sabit %15
  if (Math.random() < jackpotChance) {
    let gain = rand(620_000, 1_050_000);
    if (player.role === "whale") gain = Math.floor(gain * 1.08);
    if (hasSector(player, "exchange")) gain = Math.floor(gain * 1.06);
    if (round.market().jackpot) gain = Math.floor(gain * round.market().jackpot);
    addScore(player, gain, "JACKPOT vurdu", { risky: true });
  } else {
    let loss = -rand(130_000, 260_000);
    if (player.role === "gambler") loss = Math.floor(loss * 1.12);
    if (round.market().loss) loss = Math.floor(loss * round.market().loss);
    addScore(player, loss, "Jackpot boş geçti", { risky: true });
  }
  addHeat(player, 8);
}

function actionShield(player) {
  if (player.score < 50_000) return socketToast(player, "Kalkan bedeli 50K.");
  addScore(player, -50_000, "Kalkan aldı");
  player.shield = Math.min(3, player.shield + 1);
  addRep(player, 2);
}

function actionInsurance(player) {
  const cost = player.role === "banker" || player.role === "insurer" ? 65_000 : 80_000;
  if (player.score < cost) return socketToast(player, `Sigorta için ${format(cost)} TREEZ gerekir.`);
  addScore(player, -cost, "Sigorta aldı");
  player.insurance = Math.min(3, player.insurance + 1);
  addRep(player, 3);
}

function actionRiskScan(player) {
  const cost = 35_000;
  if (player.score < cost) return socketToast(player, "Risk Analizi 35K.");
  addScore(player, -cost, "Risk Analizi aldı");
  player.riskAnalysis = Math.min(2, player.riskAnalysis + 1);
  addRep(player, 1);
}

function actionReputation(player) {
  const cost = 70_000;
  if (player.score < cost) return socketToast(player, "İtibar yönetimi için 70K gerekir.");
  addScore(player, -cost, "İtibar yönetimi");
  addHeat(player, -18);
  addRep(player, 10);
}

function actionVault(player) {
  const amount = Math.min(180_000, Math.floor(player.score * 0.14));
  if (amount < 30_000) return socketToast(player, "Kasaya koymak için daha fazla nakit gerekir.");
  player.score -= amount;
  player.vault += Math.floor(amount * (player.role === "banker" || hasSector(player, "bank") ? 1.04 : 1));
  registerGain(player, -amount);
  addLog(`${player.name} ${format(amount)} TREEZ kasaya aldı.`);
  addRep(player, 2);
}

function actionSteal(player, targetId) {
  const target = getTarget(player, targetId);
  if (!target) return socketToast(player, "Hedef yok.");
  let amount = Math.min(260_000, Math.max(35_000, Math.floor(target.score * 0.055)));
  if (player.role === "thief") amount = Math.floor(amount * 1.22);
  if (hasSector(player, "darknet")) amount = Math.floor(amount * 1.16);
  if (player.traits.shadow) amount = Math.floor(amount * 1.08);
  amount = Math.floor(amount * (round.market().pvp || 1));

  const actualLoss = Math.abs(addScore(target, -amount, `${player.name} cüzdan saldırısı`, { attack: true }));
  const gain = Math.floor(actualLoss * 0.72);
  addScore(player, gain, `${target.name} cüzdanından aldı`);
  target.attackedCount += 1;
  player.stolenTotal += gain;
  addHeat(player, 14);
  addRep(player, -7);
  addStatMap("mostStolen", player.name, gain);
  addStatMap("mostAttacked", target.name);
  addLog(`${player.name}, ${target.name} cüzdanına saldırdı.`, true);
}

function actionPressureCompany(player, targetId) {
  const target = getTarget(player, targetId);
  if (!target) return socketToast(player, "Hedef şirket seç.");
  const cost = player.role === "saboteur" || player.role === "thief" ? 45_000 : 60_000;
  if (player.score < cost) return socketToast(player, `Şirkete Baskı için ${format(cost)} gerekir.`);

  addScore(player, -cost, "Operasyon bedeli");
  let damage = Math.min(320_000, Math.max(45_000, Math.floor(target.score * 0.065)));
  if (player.role === "saboteur") damage = Math.floor(damage * 1.24);
  if (player.role === "thief") damage = Math.floor(damage * 1.12);
  if (hasSector(player, "darknet")) damage = Math.floor(damage * 1.14);
  if (hasSector(target, "bank")) damage = Math.floor(damage * 0.88);
  if (target.traits.finalSafe) damage = Math.floor(damage * 0.9);

  const actualLoss = Math.abs(addScore(target, -damage, `${player.name} şirket baskısı`, { attack: true }));
  const gain = Math.floor(actualLoss * 0.25);
  if (gain > 0) addScore(player, gain, "Baskıdan komisyon");
  addHeat(player, 18);
  addRep(player, -9);
  target.attackedCount += 1;
  addStatMap("companyPressure", player.name);
  addStatMap("mostAttacked", target.name);
  addLog(`${player.name}, ${target.name} şirketine baskı yaptı.`, true);
}

function actionTax(player) {
  const top = leader();
  if (!top || top.id === player.id) return socketToast(player, "Lider sen değilsen daha anlamlı. Şu an uygun lider yok.");
  const onlineOrActive = getActivePlayers();
  if (onlineOrActive.length < 2) return socketToast(player, "Vergi için başka oyuncu gerek.");

  let cut = Math.min(280_000, Math.max(55_000, Math.floor(top.score * 0.045)));
  if (round.market().tax) cut = Math.floor(cut * round.market().tax);
  if (player.role === "saboteur") cut = Math.floor(cut * 1.12);
  const actualCut = Math.abs(addScore(top, -cut, `${player.name} lider vergisi`, { attack: true }));
  const share = Math.floor(actualCut / onlineOrActive.length);
  onlineOrActive.forEach((p) => {
    p.score += share;
    registerGain(p, share);
  });
  addHeat(player, 8);
  addRep(player, -2);
  addLog(`${player.name} lider vergisi kesti. ${format(actualCut)} TREEZ tüm kullanıcılara bölüştü.`, true);
}

function actionThrone(player) {
  const top = leader();
  if (!top || top.id === player.id) return socketToast(player, "Taht Soygunu için senden başka lider gerek.");
  if (player.score < 70_000) return socketToast(player, "Taht Soygunu için en az 70K gerekir.");

  let damage = Math.min(420_000, Math.max(80_000, Math.floor(top.score * 0.075)));
  if (player.role === "saboteur") damage = Math.floor(damage * 1.22);
  if (hasSector(player, "palace")) damage = Math.floor(damage * 1.18);
  const actualLoss = Math.abs(addScore(top, -damage, `${player.name} Taht Soygunu`, { attack: true }));
  const gain = Math.floor(actualLoss * 0.35);
  addScore(player, gain, "Taht Soygunu payı", { risky: true });
  addHeat(player, 17);
  addRep(player, -8);
  addStatMap("mostAttacked", top.name);
  addLog(`${player.name} lider ${top.name} için Taht Soygunu yaptı.`, true);
}

function actionRug(player) {
  if (player.score < 120_000) return socketToast(player, "Rug Pull için en az 120K gerekir.");
  let chance = 0.42;
  if (player.role === "saboteur") chance += 0.06;
  if (hasSector(player, "darknet")) chance += 0.05;
  if (Math.random() < chance) {
    let total = 0;
    getActivePlayers().forEach((target) => {
      if (target.id === player.id) return;
      const loss = Math.min(180_000, Math.max(25_000, Math.floor(target.score * 0.035)));
      total += Math.abs(addScore(target, -loss, `${player.name} Rug Pull`, { attack: true }));
      addStatMap("mostAttacked", target.name);
    });
    addScore(player, Math.floor(total * 0.22), "Rug Pull payı", { risky: true });
    addLog(`${player.name} Rug Pull ile masayı sarstı.`, true);
  } else {
    addScore(player, -rand(130_000, 260_000), "Rug Pull geri tepti", { risky: true });
    addLog(`${player.name} Rug Pull denedi ama kendi yandı.`, true);
  }
  addHeat(player, 24);
  addRep(player, -13);
}

function actionLeverage(player) {
  if (player.score < 250_000) return socketToast(player, "Kaldıraç için en az 250K gerekir.");
  const cost = 45_000;
  addScore(player, -cost, "Kaldıraç açılış bedeli");
  player.leverageUntil = now() + (player.role === "whale" || hasSector(player, "exchange") ? 45_000 : 35_000);
  addHeat(player, 9);
  addLog(`${player.name} 2x kaldıraç açtı.`, true);
}

function actionRolePower(player) {
  const r = player.role;
  if (!r) return socketToast(player, "Önce rol seç.");
  if (r === "miner") {
    let gain = rand(110_000, 190_000);
    if (hasSector(player, "mine")) gain = Math.floor(gain * 1.15);
    addScore(player, gain, "Altın Damar");
    player.shield = Math.min(3, player.shield + 1);
  } else if (r === "thief") {
    actionPressureCompany(player);
    addHeat(player, 8);
  } else if (r === "banker") {
    player.insurance = Math.min(3, player.insurance + 1);
    player.shield = Math.min(3, player.shield + 1);
    addRep(player, 8);
    addScore(player, -35_000, "Banker Kasası");
  } else if (r === "whale") {
    actionMega(player);
  } else if (r === "insurer") {
    player.insurance = Math.min(3, player.insurance + 2);
    player.shield = Math.min(3, player.shield + 1);
    addRep(player, 6);
    addLog(`${player.name} Acil Poliçe açtı.`);
  } else if (r === "saboteur") {
    actionThrone(player);
    addHeat(player, 6);
  } else if (r === "gambler") {
    if (Math.random() < 0.5) {
      addScore(player, rand(180_000, 360_000), "Zar At tuttu", { risky: true });
    } else {
      addScore(player, -rand(120_000, 260_000), "Zar At patladı", { risky: true });
    }
    addHeat(player, 10);
  }
}

function actionTakeSector(player, sectorId) {
  const sector = round.sectors[sectorId];
  if (!sector) return socketToast(player, "Sektör seç.");
  if (sector.ownerId === player.id) return socketToast(player, "Bu sektör zaten sende.");

  const currentOwner = sector.ownerId ? findPlayerById(sector.ownerId) : null;
  let cost = currentOwner ? sector.takeoverCost : sector.emptyCost;
  if (player.role === "saboteur" && sector.id === "palace") cost = Math.floor(cost * 0.86);
  if (player.role === "miner" && sector.id === "mine") cost = Math.floor(cost * 0.86);
  if (player.role === "banker" && sector.id === "bank") cost = Math.floor(cost * 0.86);
  if (player.role === "thief" && sector.id === "darknet") cost = Math.floor(cost * 0.86);
  if (player.role === "whale" && sector.id === "exchange") cost = Math.floor(cost * 0.88);

  if (player.score < cost) return socketToast(player, `${sector.title} için ${format(cost)} TREEZ gerekir.`);

  addScore(player, -cost, `${sector.title} satın alma/ele geçirme bedeli`);
  if (currentOwner) {
    const damage = Math.min(180_000, Math.max(35_000, Math.floor(currentOwner.score * 0.035)));
    addScore(currentOwner, -damage, `${sector.title} kaybı`, { attack: true });
    addHeat(player, 10);
    addRep(player, -3);
    addLog(`${player.name}, ${currentOwner.name} şirketinden ${sector.title} sektörünü aldı.`, true);
  } else {
    addLog(`${player.name}, ${sector.title} sektörünü aldı.`, true);
    addRep(player, 2);
  }

  sector.ownerId = player.id;
  sector.ownerName = player.name;
  sector.stability = 100;
  player.sectorsTaken += 1;
  addStatMap("sectorTakeovers", player.name);
}

function actionDamageSector(player, sectorId) {
  const sector = round.sectors[sectorId];
  if (!sector) return socketToast(player, "Sektör seç.");
  if (!sector.ownerId) return socketToast(player, "Bu sektör zaten boş.");
  if (sector.ownerId === player.id) return socketToast(player, "Kendi sektörünü sabote etme. İnsanlık burada bile sınanıyor.");

  const owner = findPlayerById(sector.ownerId);
  if (!owner) {
    sector.ownerId = null;
    sector.ownerName = "Boş";
    sector.stability = 100;
    return;
  }

  const cost = player.role === "saboteur" ? 45_000 : 65_000;
  if (player.score < cost) return socketToast(player, `Sektöre zarar vermek için ${format(cost)} TREEZ gerekir.`);
  addScore(player, -cost, "Sektör sabotaj bedeli");

  let damage = Math.min(240_000, Math.max(35_000, Math.floor(owner.score * 0.05)));
  if (player.role === "saboteur") damage = Math.floor(damage * 1.22);
  if (hasSector(player, "darknet")) damage = Math.floor(damage * 1.12);

  const actualLoss = Math.abs(addScore(owner, -damage, `${sector.title} sabotajı`, { attack: true }));
  sector.stability = clamp(sector.stability - (player.role === "saboteur" ? 38 : 28), 0, 100);
  if (sector.stability <= 0) {
    addLog(`${player.name}, ${sector.title} sektörünü çökertti. Sektör boşa düştü.`, true);
    sector.ownerId = null;
    sector.ownerName = "Boş";
    sector.stability = 100;
  } else {
    addLog(`${player.name}, ${owner.name} kontrolündeki ${sector.title} sektörüne zarar verdi.`, true);
  }

  addHeat(player, 19);
  addRep(player, -10);
  addStatMap("sectorDamage", player.name);
  addStatMap("mostAttacked", owner.name);
}

function performAction(player, payload) {
  const type = typeof payload === "string" ? payload : payload?.type;
  const targetId = payload?.targetId || "";
  const sectorId = payload?.sectorId || "";

  if (!type || !player || round.winner) return;
  if (!player.role) return socketToast(player, "Önce rol seç.");
  if (player.pendingDecision) return socketToast(player, "Önce şirket kararını seç.");
  if (player.liquidatedUntil > now() && ["mega", "jackpot", "leverage", "rug"].includes(type)) {
    return socketToast(player, "Likidasyon sonrası büyük riskler kısa süre kilitli.");
  }
  if (!cooldownReady(player, type)) return socketToast(player, "Cooldown bekle.");

  player.lastGain = 0;
  applyActionCount(player, type);

  switch (type) {
    case "mine": actionMine(player); break;
    case "greed": actionGreed(player); break;
    case "mega": actionMega(player); break;
    case "jackpot": actionJackpot(player); break;
    case "shield": actionShield(player); break;
    case "insurance": actionInsurance(player); break;
    case "riskScan": actionRiskScan(player); break;
    case "reputation": actionReputation(player); break;
    case "vault": actionVault(player); break;
    case "steal": actionSteal(player, targetId); break;
    case "pressureCompany": actionPressureCompany(player, targetId); break;
    case "tax": actionTax(player); break;
    case "throne": actionThrone(player); break;
    case "rug": actionRug(player); break;
    case "leverage": actionLeverage(player); break;
    case "rolePower": actionRolePower(player); break;
    case "takeSector": actionTakeSector(player, sectorId); break;
    case "damageSector": actionDamageSector(player, sectorId); break;
    default:
      socketToast(player, "Bilinmeyen hamle.");
      return;
  }

  maybeRegulator(player);
  checkWin();
  broadcastState();
}


function resetPlayerForNewRound(player, clearRole = true) {
  player.score = CONFIG.startScore;
  player.vault = 0;
  player.shield = 0;
  player.insurance = 0;
  player.riskAnalysis = 0;

  if (clearRole) {
    player.role = "";
    player.heat = 10;
    player.reputation = 50;
  } else {
    player.heat = player.role === "thief" ? 18 : player.role === "saboteur" ? 22 : player.role === "banker" ? 4 : 10;
    player.reputation = player.role === "banker" ? 62 : player.role === "insurer" ? 58 : player.role === "thief" ? 38 : player.role === "saboteur" ? 35 : 50;
  }

  player.pendingDecision = null;
  player.milestones = {};
  player.traits = {};
  player.leverageUntil = 0;
  player.liquidatedUntil = 0;
  player.lastGain = 0;
  player.cooldowns = {};
  player.actionCounts = {};
  player.attackedCount = 0;
  player.stolenTotal = 0;
  player.sectorsTaken = 0;
}

function sendRoleResetToClient(player) {
  if (!player?.socketId) return;
  io.to(player.socketId).emit("session", {
    token: player.token,
    playerId: player.id,
    name: player.name,
    company: player.company,
    role: "",
    roleLocked: false
  });
  io.to(player.socketId).emit("needRole", { roles: Object.values(ROLE_DEFS) });
}

function checkWin() {
  if (round.winner || round.restarting) return;
  const top = leader();
  const timeLeft = Math.max(0, Math.ceil((round.endsAt - now()) / 1000));
  if (top && top.score >= CONFIG.winScore) {
    finishRound(`${top.name} 10M TREEZ yaptı`, top);
  } else if (timeLeft <= 0 && top) {
    finishRound(`Süre bitti. Lider ${top.name}`, top);
  }
}

function finishRound(reason, winnerPlayer) {
  round.winner = winnerPlayer.name;
  round.restarting = true;
  addLog(`${reason}. Kazanan: ${winnerPlayer.name}`, true);
  broadcastState();

  setTimeout(() => {
    const existing = getPlayersArray();
    round = createRound();
    existing.forEach((p) => {
      if (p.isBot) {
        resetPlayerForNewRound(p, false);
        resetBotForRound(p);
      } else {
        resetPlayerForNewRound(p, true);
        sendRoleResetToClient(p);
      }
    });
    ensureBots();
    addLog("Yeni masa başladı. İnsan oyuncular tekrar rol seçebilir.", true);
    broadcastState();
  }, CONFIG.restartDelayMs);
}

function tick() {
  rotateMarket();

  const top = leader();
  if (top && !round.winner) {
    addStatMap("leaderTime", top.name);
    if (round.stats.leaderTime[top.name] > 60 && round.stats.leaderTime[top.name] % 30 === 0) {
      top.heat = clamp(top.heat + 2, 0, 100);
    }
  }

  getPlayersArray().forEach((p) => {
    p.lastGain = 0;
    if (p.leverageUntil && p.leverageUntil < now()) p.leverageUntil = 0;
  });

  runBots();

  checkWin();
  broadcastState();
}

function serializePlayer(player) {
  const ownedSectors = Object.values(round.sectors).filter((s) => s.ownerId === player.id).map((s) => s.id);
  return {
    id: player.id,
    isBot: Boolean(player.isBot),
    name: player.name,
    company: player.company,
    role: player.role,
    roleTitle: roleTitle(player),
    roleIcon: roleIcon(player),
    online: player.online,
    score: player.score,
    realScore: player.score,
    vault: player.vault,
    shield: player.shield,
    insurance: player.insurance,
    riskAnalysis: player.riskAnalysis,
    heat: player.heat,
    heatTitle: heatTitle(player.heat),
    reputation: player.reputation,
    profile: profileTitle(player),
    pendingMilestone: Boolean(player.pendingDecision),
    ownedSectors,
    sectorsCount: ownedSectors.length,
    lastGain: player.lastGain,
    leverageActive: player.leverageUntil > now(),
    leverageLeft: Math.max(0, Math.ceil((player.leverageUntil - now()) / 1000)),
    liquidated: player.liquidatedUntil > now(),
    companyPathTitle: player.traits.safeStart ? "Temkinli" : player.traits.fastStart ? "Agresif" : player.traits.regulated ? "Regüle" : player.traits.shadow ? "Gölge" : "Standart",
    strategyTitle: player.traits.regulated ? "Regüle Büyüme" : player.traits.shadow ? "Gölge Ekonomi" : "Yok",
    finalPlanTitle: player.traits.finalSafe ? "Güvenli Çıkış" : player.traits.finalSpeed ? "Piyasayı Ez" : "Yok",
    attackedCount: player.attackedCount,
    stolenTotal: player.stolenTotal,
    regulatorThreat: regulatorThreat(player)
  };
}

function serializeState() {
  const m = round.market();
  const finalPhase = Math.max(0, Math.ceil((round.endsAt - now()) / 1000)) <= 120;
  return {
    serverTime: now(),
    roundId: round.id,
    roundNumber: round.number,
    winScore: CONFIG.winScore,
    maxPlayers: CONFIG.maxOnlinePlayers,
    onlineCount: getOnlinePlayers().length,
    timeLeft: Math.max(0, Math.ceil((round.endsAt - now()) / 1000)),
    finalPhase,
    finalCrisis: finalPhase ? { title: "Final Baskısı", desc: "Son iki dakikada lider hedef olur, risk büyür." } : null,
    market: {
      id: m.id,
      title: m.title,
      desc: m.desc,
      endsIn: Math.max(0, Math.ceil((round.marketEndsAt - now()) / 1000))
    },
    sectors: Object.values(round.sectors),
    roles: Object.values(ROLE_DEFS),
    players: sortedPlayers().map(serializePlayer),
    logs: round.logs,
    winner: round.winner,
    roundStats: round.stats
  };
}

function broadcastState() {
  io.emit("state", serializeState());
}

function resetRoundOnly() {
  round = createRound();
  getPlayersArray().forEach((p) => {
    if (p.isBot) {
      resetPlayerForNewRound(p, false);
      resetBotForRound(p);
    } else {
      resetPlayerForNewRound(p, true);
      sendRoleResetToClient(p);
    }
  });
  ensureBots();
  addLog("Admin masayı resetledi. İnsan oyuncular tekrar rol seçebilir.", true);
  broadcastState();
}

function wipeAll() {
  players.clear();
  sockets.clear();
  round = createRound();
  addLog("Admin komple wipe yaptı.", true);
  ensureBots();
  broadcastState();
}

function authAdmin(req, res) {
  if (req.query.key !== ADMIN_KEY) {
    res.status(403).send("wrong key");
    return false;
  }
  return true;
}

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    online: getOnlinePlayers().length,
    players: players.size,
    round: round.number,
    uptime: process.uptime()
  });
});

app.get("/reset", (req, res) => {
  if (!authAdmin(req, res)) return;
  resetRoundOnly();
  res.send("reset ok");
});

app.get("/wipe", (req, res) => {
  if (!authAdmin(req, res)) return;
  wipeAll();
  res.send("wipe ok");
});

app.get("/clear-players", (req, res) => {
  if (!authAdmin(req, res)) return;
  wipeAll();
  res.send("players cleared");
});

io.on("connection", (socket) => {
  socket.on("hello", (payload = {}) => {
    let token = typeof payload.token === "string" && payload.token.length > 8 ? payload.token : uid("t_");
    let player = players.get(token);

    if (!player) {
      const existingByProfile = findExistingPlayerByProfile(payload);

      if (existingByProfile) {
        player = existingByProfile;
        token = player.token;
        addLog(`${player.name} eski şirketine geri bağlandı.`, false);
      } else {
        if (getOnlinePlayers().length >= CONFIG.maxOnlinePlayers) {
          socket.emit("roomFull");
          return;
        }
        player = freshPlayer(token, payload);
        players.set(token, player);
        addLog(`${player.name} masaya katıldı.`, true);
      }
    }

    if (player.socketId && player.socketId !== socket.id) {
      const old = io.sockets.sockets.get(player.socketId);
      if (old) old.disconnect(true);
    }

    player.socketId = socket.id;
    player.online = true;
    player.lastSeen = now();
    sockets.set(socket.id, token);

    socket.emit("session", {
      token,
      playerId: player.id,
      name: player.name,
      company: player.company,
      role: player.role,
      roleLocked: Boolean(player.role)
    });

    if (!player.role) {
      socket.emit("needRole", { roles: Object.values(ROLE_DEFS) });
    }

    broadcastState();
  });

  socket.on("setProfile", (payload = {}) => {
    const token = sockets.get(socket.id);
    const player = players.get(token);
    if (!player) return;

    const nextName = cleanText(payload.name, 16, player.name);
    const nextCompany = cleanText(payload.company || `${nextName} Capital`, 22, `${nextName} Capital`).toUpperCase();

    const profileTaken = getPlayersArray().find((p) => {
      return p.id !== player.id && sameText(p.name, nextName) && sameCompany(p.company, nextCompany);
    });

    if (profileTaken) {
      socketToast(player, "Bu CEO adı + şirket zaten masada. Kopya şirket açamazsın.");
      socket.emit("session", { token, playerId: player.id, name: player.name, company: player.company, role: player.role, roleLocked: Boolean(player.role) });
      return;
    }

    player.name = nextName;
    player.company = nextCompany;
    const owned = Object.values(round.sectors).filter((s) => s.ownerId === player.id);
    owned.forEach((s) => { s.ownerName = player.name; });
    socket.emit("session", { token, playerId: player.id, name: player.name, company: player.company, role: player.role, roleLocked: Boolean(player.role) });
    broadcastState();
  });

  socket.on("setName", (name) => {
    const token = sockets.get(socket.id);
    const player = players.get(token);
    if (!player) return;
    player.name = cleanText(name, 16, player.name);
    socket.emit("session", { token, playerId: player.id, name: player.name, company: player.company, role: player.role, roleLocked: Boolean(player.role) });
    broadcastState();
  });

  socket.on("chooseRole", (roleId) => {
    const token = sockets.get(socket.id);
    const player = players.get(token);
    if (!player) return;
    if (player.role) {
      socketToast(player, "Rol sonradan değişmez.");
      socket.emit("session", { token, playerId: player.id, name: player.name, company: player.company, role: player.role, roleLocked: true });
      return;
    }
    if (!ROLE_DEFS[roleId]) {
      socketToast(player, "Geçersiz rol.");
      return;
    }
    player.role = roleId;
    if (roleId === "thief") { player.heat = 18; player.reputation = 38; }
    if (roleId === "saboteur") { player.heat = 22; player.reputation = 35; }
    if (roleId === "banker") { player.heat = 4; player.reputation = 62; }
    if (roleId === "insurer") { player.heat = 7; player.reputation = 58; }
    socket.emit("session", { token, playerId: player.id, name: player.name, company: player.company, role: player.role, roleLocked: true });
    addLog(`${player.name} rol seçti: ${roleTitle(player)}.`, true);
    broadcastState();
  });

  socket.on("decisionChoice", (optionId) => {
    const token = sockets.get(socket.id);
    const player = players.get(token);
    if (!player) return;
    applyDecision(player, optionId);
  });

  socket.on("action", (payload) => {
    const token = sockets.get(socket.id);
    const player = players.get(token);
    if (!player) return;
    performAction(player, payload);
  });

  socket.on("disconnect", () => {
    const token = sockets.get(socket.id);
    const player = players.get(token);
    sockets.delete(socket.id);
    if (player && player.socketId === socket.id) {
      player.online = false;
      player.socketId = null;
      player.lastSeen = now();
      addLog(`${player.name} offline oldu, şirket masada kaldı.`, false);
      broadcastState();
    }
  });
});

ensureBots();
setInterval(tick, 1000);

server.listen(PORT, () => {
  console.log(`TREEZCOIN server running on ${PORT}`);
});
