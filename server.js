const express = require("express");
const http = require("http");
const crypto = require("crypto");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static("public"));

const ADMIN_KEY = process.env.ADMIN_KEY || "1234";
const VERSION = "TREEZCOIN 4.0 - Borsa Savaşı";
const WIN_SCORE = 10_000_000;
const MAX_PLAYERS = 6;
const ROUND_MS = 14 * 60 * 1000;
const MARKET_MS = 70 * 1000;
const RESET_AFTER_WIN_MS = 9000;
const FINAL_CRISIS_MS = 2 * 60 * 1000;
const REGULATOR_MS = 27 * 1000;
const TOTAL_PLAYER_SOFT_CAP = 30;

const BASE_COOLDOWNS = {
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
  blackMarket: 13000,
  rolePower: 22000,
  sector: 12000,
  develop: 16000,
  leverage: 26000,
  reputation: 14000,
  useItem: 9000,
  evadeRegulator: 18000
};

const ROLES = {
  miner: {
    id: "miner",
    title: "Madenci",
    desc: "Güvenli TREEZ kasma rolü.",
    plus: "Maden ve TREEZ Kaz güçlü.",
    minus: "Kaldıraç ve kirli PvP zayıf."
  },
  thief: {
    id: "thief",
    title: "Hırsız",
    desc: "PvP ve çalma odaklı rol.",
    plus: "Darknet, Cüzdan Çal ve kirli kontratlar güçlü.",
    minus: "Regülatör daha hızlı kokunu alır."
  },
  banker: {
    id: "banker",
    title: "Banker",
    desc: "Kasa, sigorta ve istikrar rolü.",
    plus: "Banka Ağı, kasa ve sigorta güçlü.",
    minus: "Riskli aksiyonlar daha zayıf."
  },
  whale: {
    id: "whale",
    title: "Balina",
    desc: "Yüksek risk, yüksek ödül.",
    plus: "Borsa Merkezi, kaldıraç ve Mega Pump güçlü.",
    minus: "Likidasyon cezaları daha sert."
  },
  insurer: {
    id: "insurer",
    title: "Sigortacı",
    desc: "Hayatta kalma ve savunma rolü.",
    plus: "Final krizleri ve büyük kayıplar daha yumuşak.",
    minus: "Direkt kazançları biraz düşük."
  },
  saboteur: {
    id: "saboteur",
    title: "Sabotajcı",
    desc: "Lideri ve zenginleri düşürme rolü.",
    plus: "Saray, Taht Soygunu ve lider avı güçlü.",
    minus: "Kazım ve itibar zayıf."
  },
  gambler: {
    id: "gambler",
    title: "Şansçı",
    desc: "Riskli hamleleri seven rol.",
    plus: "Zar, meme piyasası ve sürpriz eşyalarda iyi.",
    minus: "Kaybedince cezası daha sert."
  }
};

const MARKETS = [
  { id: "calm", title: "Piyasa Sakin", desc: "Normal masa. Şimdilik kimse panik satmıyor.", mine: 1, riskChance: 0, riskGain: 1, riskLoss: 1, pvp: 1, tax: 1 },
  { id: "bull", title: "Boğa Sezonu", desc: "Kazançlar artar, herkes kendini dahi sanır.", mine: 1.13, riskChance: 0.03, riskGain: 1.1, riskLoss: 0.96, pvp: 0.98, tax: 1 },
  { id: "bear", title: "Ayı Sezonu", desc: "Riskler sertleşir, kasa kıymetli olur.", mine: 0.92, riskChance: -0.04, riskGain: 0.96, riskLoss: 1.12, pvp: 1.04, tax: 1.04 },
  { id: "liquidity", title: "Likidite Krizi", desc: "Kaldıraç kayıpları sertleşir, regülatör keyiflenir.", mine: 0.98, riskChance: -0.05, riskGain: 1.08, riskLoss: 1.22, pvp: 1.08, tax: 1.08 },
  { id: "taxweek", title: "Vergi Haftası", desc: "Lider Vergisi güçlenir, kirli para kokar.", mine: 1, riskChance: -0.01, riskGain: 0.98, riskLoss: 1.04, pvp: 1, tax: 1.25 },
  { id: "meme", title: "Meme Coin Çılgınlığı", desc: "Riskli hamleler parlar, sonra genelde biri ağlar.", mine: 1.05, riskChance: 0.04, riskGain: 1.18, riskLoss: 1.13, pvp: 1, tax: 1 }
];

const SECTOR_DEFS = {
  mine: { id: "mine", icon: "⛏", title: "Maden Bölgesi", desc: "TREEZ Kaz güçlenir.", role: "miner" },
  exchange: { id: "exchange", icon: "📈", title: "Borsa Merkezi", desc: "Katla, Mega Pump ve kaldıraç güçlenir.", role: "whale" },
  bank: { id: "bank", icon: "🏦", title: "Banka Ağı", desc: "Kasa ve sigorta güçlenir.", role: "banker" },
  media: { id: "media", icon: "📺", title: "Medya Merkezi", desc: "İtibar ve gizlilik güçlenir.", role: "insurer" },
  darknet: { id: "darknet", icon: "🕶", title: "Darknet Pazarı", desc: "Kara Borsa ve çalma güçlenir.", role: "thief" },
  palace: { id: "palace", icon: "👑", title: "Saray Bölgesi", desc: "Lider avı ve taht savaşı güçlenir.", role: "saboteur" }
};

const FINAL_CRISES = [
  { id: "audit", title: "Büyük Denetim", desc: "Isısı yüksek olanlar baskı yer, itibar değerlenir.", heatPain: 1.25, riskGain: 0.96, riskLoss: 1.08, tax: 1.08 },
  { id: "bullrush", title: "Boğa Çılgınlığı", desc: "Riskli kazançlar artar, başarısızlık daha fena yakar.", heatPain: 1, riskGain: 1.18, riskLoss: 1.18, tax: 1 },
  { id: "bankrun", title: "Banka Krizi", desc: "Nakit riskli, kasa ve sigorta değerli.", heatPain: 1.05, riskGain: 0.96, riskLoss: 1.12, tax: 1.05 },
  { id: "riot", title: "Halk İsyanı", desc: "Lider hedef olur, Taht Soygunu ve Lider Vergisi güçlenir.", heatPain: 1.05, riskGain: 1.04, riskLoss: 1.06, tax: 1.22 }
];

const BLACK_MARKET_ITEMS = [
  { id: "fakeWallet", title: "Sahte Cüzdan", desc: "1 kalkan verir ve ısıyı biraz düşürür." },
  { id: "taxFile", title: "Vergi Dosyası", desc: "Sonraki Lider Vergisi daha sert olur." },
  { id: "throneKey", title: "Taht Anahtarı", desc: "Sonraki Taht Soygunu daha şanslı olur." },
  { id: "smokeBomb", title: "Duman Bombası", desc: "Kısa süre gizlilik verir." },
  { id: "pumpSignal", title: "Pump Sinyali", desc: "Sonraki riskli kazanç büyür, patlarsa da üzülürsün." },
  { id: "pressKit", title: "Basın Paketi", desc: "İtibar artırır, ısı düşürür." },
  { id: "auditShield", title: "Denetim Kalkanı", desc: "Regülatör baskınını yumuşatır." },
  { id: "marketRumor", title: "Piyasa Dedikodusu", desc: "Market eventini rastgele değiştirir." }
];

const players = new Map();
let logs = [];
let roundStats;
let roundStart = Date.now();
let roundNumber = 1;
let marketIndex = 0;
let marketEndsAt = Date.now() + MARKET_MS;
let finalCrisis = null;
let finalCrisisAnnounced = false;
let winner = null;
let resetTimer = null;
let lastLeaderToken = null;
let leaderStartedAt = Date.now();
let lastRegulatorAt = Date.now();
let sectors = createFreshSectors();

function now() {
  return Date.now();
}

function randomToken() {
  return crypto.randomBytes(16).toString("hex");
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function format(n) {
  return Math.floor(n || 0).toLocaleString("tr-TR");
}

function safeName(value) {
  const raw = String(value || "Player").replace(/[<>]/g, "").trim();
  return raw.slice(0, 16) || "Player";
}

function safeCompany(value, fallbackName = "TREEZ HOLDING") {
  const raw = String(value || "").replace(/[<>]/g, "").trim().toUpperCase();
  const base = raw || `${safeName(fallbackName).toUpperCase()} CAPITAL`;
  return base.slice(0, 22);
}

function rand(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function createFreshSectors() {
  const obj = {};
  Object.keys(SECTOR_DEFS).forEach((id) => {
    obj[id] = { ...SECTOR_DEFS[id], owner: null, heat: 0 };
  });
  return obj;
}

function defaultStats() {
  return {
    biggestGain: null,
    biggestLoss: null,
    mostStolen: {},
    mostAttacked: {},
    riskActions: {},
    leaderTime: {},
    sectorTakeovers: {},
    liquidations: {},
    regulatorHits: {}
  };
}

roundStats = defaultStats();

function addLog(text, important = false) {
  if (!text || text.includes("TREEZ Kaz")) return;
  const time = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  logs.push({ time, text, important });
  if (logs.length > 70) logs = logs.slice(-70);
}

function toast(player, message) {
  if (player?.socketId) io.to(player.socketId).emit("toast", message);
}

function publicRoles() {
  return Object.values(ROLES);
}

function allPlayers() {
  return [...players.values()];
}

function onlinePlayers() {
  return allPlayers().filter((player) => player.online);
}

function activePlayers() {
  return allPlayers().filter((player) => player.online || player.score > 0 || player.vault > 0 || player.lastSeen > roundStart);
}

function visibleWorth(player) {
  return player.score;
}

function totalWorth(player) {
  return player.score + player.vault;
}

function sortedPlayers() {
  return activePlayers().sort((a, b) => visibleWorth(b) - visibleWorth(a));
}

function roleTitle(player) {
  return ROLES[player.role]?.title || "Rolsüz";
}

function playerName(token) {
  return players.get(token)?.name || "Bilinmeyen";
}

function sectorTitle(id) {
  return SECTOR_DEFS[id]?.title || "Sektör";
}

function ownsSector(player, id) {
  return sectors[id]?.owner === player.token;
}

function currentMarket() {
  return MARKETS[marketIndex] || MARKETS[0];
}

function currentCrisis() {
  return finalCrisis ? FINAL_CRIISES_BY_ID()[finalCrisis] : null;
}

function FINAL_CRIISES_BY_ID() {
  const map = {};
  FINAL_CRISES.forEach((c) => map[c.id] = c);
  return map;
}

function timeLeftMs() {
  return Math.max(0, ROUND_MS - (now() - roundStart));
}

function isFinalPhase() {
  return timeLeftMs() <= FINAL_CRISIS_MS;
}

function createPlayer(token, name, role, company) {
  return {
    token,
    id: token,
    socketId: null,
    online: false,
    name: safeName(name),
    company: safeCompany(company, name),
    role: ROLES[role]?.id || null,
    score: 0,
    vault: 0,
    insurance: 0,
    shieldCharges: 0,
    riskAnalysisCharges: 0,
    heat: 0,
    reputation: 50,
    inventory: [],
    companyPath: null,
    companyPathTitle: null,
    developmentLevel: 0,
    strategy: null,
    strategyTitle: null,
    finalPlan: null,
    finalPlanTitle: null,
    leverageUntil: 0,
    leverageStartedAt: 0,
    leverageMult: 1,
    liquidatedUntil: 0,
    auditShieldUntil: 0,
    taxFileUntil: 0,
    throneKeyUntil: 0,
    smokeUntil: 0,
    pumpSignal: false,
    bountyUntil: 0,
    hiddenUntil: 0,
    riskModeUntil: 0,
    finalSpeedUntil: 0,
    fullRiskUntil: 0,
    longBoost: false,
    taxVulnerableUntil: 0,
    taxCleanUntil: 0,
    badFameUntil: 0,
    pendingMilestone: null,
    pendingDecision: null,
    milestones: {},
    secretRival: null,
    lastGain: 0,
    lastAction: {},
    lastHeatDecay: now(),
    lastSeen: now(),
    createdAt: now()
  };
}

function normalizePlayer(player) {
  player.score = Math.max(0, Math.floor(player.score || 0));
  player.vault = Math.max(0, Math.floor(player.vault || 0));
  player.insurance = Math.max(0, Math.floor(player.insurance || 0));
  player.shieldCharges = clamp(Math.floor(player.shieldCharges || 0), 0, 5);
  player.riskAnalysisCharges = clamp(Math.floor(player.riskAnalysisCharges || 0), 0, 4);
  player.heat = clamp(Math.floor(player.heat || 0), 0, 100);
  player.reputation = clamp(Math.floor(player.reputation || 0), 0, 100);
  if (!Array.isArray(player.inventory)) player.inventory = [];
  player.inventory = player.inventory.slice(0, 2);
}

function heatTitle(heat) {
  if (heat >= 76) return "Kırmızı Liste";
  if (heat >= 51) return "Aranıyor";
  if (heat >= 26) return "Şüpheli";
  return "Temiz";
}

function profileTitle(player) {
  const stolen = roundStats.mostStolen[player.token] || 0;
  const risk = roundStats.riskActions[player.token] || 0;
  const attacked = roundStats.mostAttacked[player.token] || 0;
  if (player.heat >= 76) return "Kırmızı Listedeki CEO";
  if (player.leverageUntil > now()) return "Kaldıraç Bağımlısı";
  if (risk >= 8) return "Kumarbaz";
  if (stolen >= 250_000) return "Piyasa Korsanı";
  if (attacked >= 7) return "Hedef Tahtası";
  if (player.vault > player.score * 0.45 && player.vault > 250_000) return "Kasa Faresi";
  if (player.reputation >= 75) return "Temiz Fon";
  if (player.score >= 2_000_000) return "Piyasa Yapıcı";
  return "Normal İnsan Taklidi";
}

function snapshotScores() {
  const snap = {};
  allPlayers().forEach((player) => snap[player.token] = player.score);
  return snap;
}

function statMapToNames(map) {
  const out = {};
  Object.entries(map || {}).forEach(([token, value]) => out[playerName(token)] = value);
  return out;
}

function publicStats() {
  return {
    roundNumber,
    biggestGain: roundStats.biggestGain ? { name: playerName(roundStats.biggestGain.token), amount: roundStats.biggestGain.amount } : null,
    biggestLoss: roundStats.biggestLoss ? { name: playerName(roundStats.biggestLoss.token), amount: roundStats.biggestLoss.amount } : null,
    mostStolen: statMapToNames(roundStats.mostStolen),
    mostAttacked: statMapToNames(roundStats.mostAttacked),
    riskActions: statMapToNames(roundStats.riskActions),
    leaderTime: statMapToNames(roundStats.leaderTime),
    sectorTakeovers: statMapToNames(roundStats.sectorTakeovers),
    liquidations: statMapToNames(roundStats.liquidations),
    regulatorHits: statMapToNames(roundStats.regulatorHits)
  };
}

function regulatorThreat() {
  const list = activePlayers();
  if (!list.length) return 0;
  return Math.max(...list.map((p) => p.heat));
}

function sectorList() {
  return Object.values(sectors).map((sector) => ({
    id: sector.id,
    icon: sector.icon,
    title: sector.title,
    desc: sector.desc,
    owner: sector.owner,
    ownerName: sector.owner ? playerName(sector.owner) : "Boş"
  }));
}

function publicPlayer(player, requesterToken) {
  const t = now();
  const isSelf = player.token === requesterToken;
  const hidden = player.hiddenUntil > t || player.smokeUntil > t;
  const masked = hidden && !isSelf;
  const ownedSectors = Object.values(sectors).filter((s) => s.owner === player.token).map((s) => s.id);

  return {
    id: player.token,
    name: player.name,
    company: player.company,
    role: player.role,
    roleTitle: roleTitle(player),
    online: player.online,
    score: masked ? null : player.score,
    realScore: player.score,
    vault: isSelf ? player.vault : masked ? null : player.vault,
    insurance: player.insurance,
    shieldCharges: player.shieldCharges,
    riskAnalysisCharges: player.riskAnalysisCharges,
    heat: masked ? null : player.heat,
    heatTitle: masked ? "Gizli" : heatTitle(player.heat),
    reputation: masked ? null : player.reputation,
    profile: profileTitle(player),
    inventoryCount: player.inventory.length,
    inventory: isSelf ? player.inventory : [],
    companyPathTitle: player.companyPathTitle,
    strategyTitle: player.strategyTitle,
    finalPlanTitle: player.finalPlanTitle,
    developmentLevel: player.developmentLevel,
    ownedSectors,
    leverageActive: player.leverageUntil > t,
    leverageLeft: Math.max(0, Math.ceil((player.leverageUntil - t) / 1000)),
    liquidated: player.liquidatedUntil > t,
    bounty: player.bountyUntil > t,
    hidden,
    pendingMilestone: !!player.pendingMilestone,
    lastGain: player.lastGain || 0,
    secretRivalName: isSelf && player.secretRival ? playerName(player.secretRival) : null
  };
}

function publicState(requesterToken = null) {
  const market = currentMarket();
  const crisis = finalCrisis ? FINAL_CRIISES_BY_ID()[finalCrisis] : null;
  return {
    version: VERSION,
    roundNumber,
    winScore: WIN_SCORE,
    maxPlayers: MAX_PLAYERS,
    timeLeft: Math.ceil(timeLeftMs() / 1000),
    finalPhase: isFinalPhase(),
    market: {
      id: market.id,
      title: market.title,
      desc: market.desc,
      endsIn: Math.max(0, Math.ceil((marketEndsAt - now()) / 1000))
    },
    finalCrisis: crisis ? { id: crisis.id, title: crisis.title, desc: crisis.desc } : null,
    regulatorThreat: regulatorThreat(),
    sectors: sectorList(),
    players: sortedPlayers().map((player) => publicPlayer(player, requesterToken)),
    logs,
    winner,
    roundStats: publicStats(),
    onlineCount: onlinePlayers().length
  };
}

function emitState() {
  for (const socket of io.sockets.sockets.values()) {
    const token = socket.data?.token || null;
    socket.emit("state", publicState(token));
  }
}

function finishAction(before, countStats = true) {
  allPlayers().forEach((player) => {
    normalizePlayer(player);
    const oldScore = before[player.token] || 0;
    const diff = player.score - oldScore;
    player.lastGain = diff;

    if (!countStats || diff === 0) return;
    if (diff > 0 && (!roundStats.biggestGain || diff > roundStats.biggestGain.amount)) {
      roundStats.biggestGain = { token: player.token, amount: diff };
    }
    if (diff < 0 && (!roundStats.biggestLoss || Math.abs(diff) > roundStats.biggestLoss.amount)) {
      roundStats.biggestLoss = { token: player.token, amount: Math.abs(diff) };
    }
  });
}

function cooldownFor(player, type) {
  let cd = BASE_COOLDOWNS[type] || 1000;
  const t = now();
  if (player.finalSpeedUntil > t && ["mine", "greed", "mega"].includes(type)) cd *= 0.72;
  if (player.role === "miner" && type === "mine") cd *= 0.88;
  if (player.role === "saboteur" && type === "mine") cd *= 1.13;
  if (player.role === "thief" && type === "steal") cd *= 0.9;
  if (player.role === "banker" && ["vault", "insurance"].includes(type)) cd *= 0.9;
  if (player.role === "whale" && type === "leverage") cd *= 0.88;
  if (ownsSector(player, "exchange") && ["greed", "mega", "leverage"].includes(type)) cd *= 0.92;
  if (ownsSector(player, "bank") && ["vault", "insurance"].includes(type)) cd *= 0.88;
  if (isFinalPhase() && ["tax", "throne"].includes(type)) cd *= 0.82;
  return Math.floor(cd);
}

function canUse(player, type) {
  const t = now();
  const cd = cooldownFor(player, type);
  if (player.lastAction[type] && t - player.lastAction[type] < cd) return false;
  player.lastAction[type] = t;
  return true;
}

function requireRole(player) {
  if (player.role) return true;
  toast(player, "Önce rol seç. Piyasa bile kimlik soruyor artık.");
  if (player.socketId) io.to(player.socketId).emit("needRole", { roles: publicRoles() });
  return false;
}

function charge(player, amount, message) {
  amount = Math.floor(amount);
  if (player.score < amount) {
    toast(player, `${message} için ${format(amount)} TREEZ lazım.`);
    return false;
  }
  player.score -= amount;
  return true;
}

function addHeat(player, amount) {
  let gain = amount;
  if (player.role === "thief" || player.role === "saboteur") gain *= 1.06;
  if (ownsSector(player, "media")) gain *= 0.82;
  if (player.companyPath === "aggressive") gain *= 1.1;
  if (player.strategy === "shadow") gain *= 1.16;
  if (player.auditShieldUntil > now()) gain *= 0.75;
  player.heat = clamp(player.heat + Math.ceil(gain), 0, 100);
}

function addReputation(player, amount) {
  player.reputation = clamp(player.reputation + Math.floor(amount), 0, 100);
}

function markRisk(player, n = 1) {
  roundStats.riskActions[player.token] = (roundStats.riskActions[player.token] || 0) + n;
}

function markStolen(player, amount) {
  if (amount <= 0) return;
  roundStats.mostStolen[player.token] = (roundStats.mostStolen[player.token] || 0) + amount;
}

function markAttacked(player, n = 1) {
  roundStats.mostAttacked[player.token] = (roundStats.mostAttacked[player.token] || 0) + n;
}

function markSectorTakeover(player) {
  roundStats.sectorTakeovers[player.token] = (roundStats.sectorTakeovers[player.token] || 0) + 1;
}

function markLiquidation(player) {
  roundStats.liquidations[player.token] = (roundStats.liquidations[player.token] || 0) + 1;
}

function markRegulatorHit(player) {
  roundStats.regulatorHits[player.token] = (roundStats.regulatorHits[player.token] || 0) + 1;
}

function finalRiskGainMultiplier() {
  const crisis = finalCrisis ? FINAL_CRIISES_BY_ID()[finalCrisis] : null;
  return crisis ? crisis.riskGain : 1;
}

function finalRiskLossMultiplier() {
  const crisis = finalCrisis ? FINAL_CRIISES_BY_ID()[finalCrisis] : null;
  return crisis ? crisis.riskLoss : 1;
}

function mineMultiplier(player) {
  let mult = currentMarket().mine;
  if (player.role === "miner") mult *= 1.3;
  if (player.role === "saboteur") mult *= 0.82;
  if (player.role === "insurer") mult *= 0.93;
  if (ownsSector(player, "mine")) mult *= 1.16;
  if (player.companyPath === "cautious") mult *= 0.97;
  if (player.developmentLevel > 0 && player.companyPath === "cautious") mult *= 1 + player.developmentLevel * 0.025;
  if (isFinalPhase()) mult *= 0.9;
  if (player.liquidatedUntil > now()) mult *= 0.8;
  return mult;
}

function riskGainMultiplier(player) {
  let mult = currentMarket().riskGain * finalRiskGainMultiplier();
  const t = now();
  if (player.role === "whale") mult *= 1.15;
  if (player.role === "banker") mult *= 0.91;
  if (player.role === "insurer") mult *= 0.94;
  if (player.companyPath === "speculative") mult *= 1.08 + player.developmentLevel * 0.02;
  if (player.companyPath === "aggressive") mult *= 1.04;
  if (player.strategy === "leverage") mult *= 1.05;
  if (player.finalPlan === "allin" && isFinalPhase()) mult *= 1.16;
  if (ownsSector(player, "exchange")) mult *= 1.1;
  if (player.riskModeUntil > t) mult *= 1.18;
  if (player.fullRiskUntil > t) mult *= 1.24;
  if (player.longBoost) mult *= 1.22;
  if (player.pumpSignal) mult *= 1.18;
  if (player.leverageUntil > t) mult *= player.leverageMult || 2;
  if (player.liquidatedUntil > t) mult *= 0.78;
  return mult;
}

function riskLossMultiplier(player) {
  let mult = currentMarket().riskLoss * finalRiskLossMultiplier();
  const t = now();
  if (player.role === "whale") mult *= 1.12;
  if (player.role === "gambler") mult *= 1.11;
  if (player.role === "insurer") mult *= 0.88;
  if (player.companyPath === "speculative") mult *= 1.08;
  if (player.strategy === "leverage") mult *= 1.08;
  if (player.finalPlan === "safe" && isFinalPhase()) mult *= 0.78;
  if (player.finalPlan === "allin" && isFinalPhase()) mult *= 1.2;
  if (player.riskModeUntil > t) mult *= 1.16;
  if (player.fullRiskUntil > t) mult *= 1.23;
  if (player.longBoost) mult *= 1.16;
  if (player.pumpSignal) mult *= 1.16;
  if (player.leverageUntil > t) mult *= player.leverageMult || 2;
  if (player.liquidatedUntil > t) mult *= 0.9;
  return mult;
}

function pvpMultiplier(player, type) {
  let mult = currentMarket().pvp;
  const t = now();
  if (player.role === "thief" && type === "steal") mult *= 1.23;
  if (player.role === "saboteur" && ["throne", "tax"].includes(type)) mult *= 1.18;
  if (player.role === "miner" && ["steal", "rug"].includes(type)) mult *= 0.78;
  if (player.role === "banker" && ["rug", "steal"].includes(type)) mult *= 0.88;
  if (ownsSector(player, "darknet") && ["steal", "rug", "blackMarket"].includes(type)) mult *= 1.16;
  if (ownsSector(player, "palace") && ["throne", "tax"].includes(type)) mult *= 1.14;
  if (player.companyPath === "aggressive") mult *= 1.08 + player.developmentLevel * 0.025;
  if (player.strategy === "shadow") mult *= 1.1;
  if (player.badFameUntil > t) mult *= 1.13;
  if (player.finalPlan === "dominate" && isFinalPhase()) mult *= 1.14;
  if (player.liquidatedUntil > t) mult *= 0.82;
  return mult;
}

function chance(base, player, kind = "risk") {
  let c = base + currentMarket().riskChance;
  const t = now();
  if (player.role === "gambler") c += 0.035;
  if (player.role === "whale" && ["mega", "leverage"].includes(kind)) c += 0.02;
  if (player.role === "banker" && kind === "risk") c -= 0.025;
  if (ownsSector(player, "exchange") && ["greed", "mega"].includes(kind)) c += 0.025;
  if (ownsSector(player, "darknet") && ["steal", "rug"].includes(kind)) c += 0.025;
  if (ownsSector(player, "palace") && kind === "throne") c += 0.035;
  if (player.throneKeyUntil > t && kind === "throne") c += 0.12;
  if (player.riskAnalysisCharges > 0 && kind !== "jackpot") c += 0.015;
  if (player.companyPath === "speculative") c += 0.01;
  if (player.strategy === "regulated") c += 0.01;
  if (player.heat >= 80) c -= 0.02;
  if (player.reputation >= 75) c += 0.01;
  if (player.liquidatedUntil > t) c -= 0.04;
  return clamp(c, 0.08, 0.86);
}

function insuranceRate(player) {
  let rate = 0.34;
  if (player.role === "insurer") rate = 0.54;
  if (player.role === "banker") rate = 0.45;
  if (ownsSector(player, "bank")) rate += 0.06;
  if (player.companyPath === "cautious") rate += 0.04;
  if (player.finalPlan === "safe" && isFinalPhase()) rate += 0.08;
  return clamp(rate, 0.2, 0.72);
}

function applyLoss(player, amount, options = {}) {
  let loss = Math.max(0, Math.floor(amount));
  const t = now();
  if (loss <= 0) return { removed: 0, recovery: 0, netLoss: 0, vaultHit: 0, liquidated: false };

  const leveragedAtStart = options.risk && player.leverageUntil > t;

  if (options.pvp && player.shieldCharges > 0) {
    const shieldPower = player.role === "thief" ? 0.64 : player.role === "insurer" ? 0.36 : 0.45;
    loss = Math.floor(loss * shieldPower);
    player.shieldCharges -= 1;
  }

  if (options.risk && player.riskAnalysisCharges > 0) {
    loss = Math.floor(loss * 0.45);
    player.riskAnalysisCharges -= 1;
  }

  if (options.risk) loss = Math.floor(loss * riskLossMultiplier(player));
  if (player.auditShieldUntil > t && options.regulator) loss = Math.floor(loss * 0.55);
  if (player.smokeUntil > t && options.pvp) loss = Math.floor(loss * 0.84);
  if (player.companyPath === "cautious" && options.pvp) loss = Math.floor(loss * 0.94);

  const scoreBefore = player.score;
  const removed = Math.min(player.score, loss);
  player.score -= removed;

  let recovery = 0;
  if (removed >= 75_000 && player.insurance > 0) {
    recovery = Math.min(player.insurance, Math.floor(removed * insuranceRate(player)));
    player.insurance -= recovery;
    player.score += recovery;
  }

  let vaultHit = 0;
  let liquidated = false;
  if (leveragedAtStart && removed >= Math.max(160_000, Math.floor(scoreBefore * 0.18))) {
    liquidated = true;
    player.leverageUntil = 0;
    player.liquidatedUntil = t + 45_000;
    const extra = Math.min(player.score, Math.floor(scoreBefore * (player.role === "whale" ? 0.11 : 0.08)));
    player.score -= extra;
    vaultHit = Math.min(player.vault, Math.floor(player.vault * (player.role === "whale" ? 0.07 : 0.045)));
    player.vault -= vaultHit;
    player.heat = clamp(player.heat - 8, 0, 100);
    player.reputation = clamp(player.reputation - 8, 0, 100);
    markLiquidation(player);
    addLog(`${player.company} LİKİDE OLDU. -${format(extra + vaultHit)} TREEZ ekstra darbe. Kaldıraç romantizmi bitti.`, true);
  }

  return { removed, recovery, netLoss: Math.max(0, removed + vaultHit - recovery), vaultHit, liquidated };
}

function weightedTarget(attacker, mode = "default") {
  const candidates = activePlayers().filter((p) => p.token !== attacker.token && (p.score > 0 || p.vault > 0));
  if (!candidates.length) return null;
  const leader = sortedPlayers()[0];
  const weighted = [];
  candidates.forEach((p) => {
    let weight = 1 + Math.floor(p.score / 180_000);
    if (!p.online) weight += 1;
    if (p.bountyUntil > now()) weight += 4;
    if (p.heat >= 70) weight += 2;
    if (leader && p.token === leader.token) weight += mode === "leader" ? 12 : 4;
    if (p.hiddenUntil > now() || p.smokeUntil > now()) weight = Math.max(1, Math.floor(weight * 0.45));
    for (let i = 0; i < Math.min(weight, 20); i++) weighted.push(p);
  });
  return pick(weighted.length ? weighted : candidates);
}

function distributeFromLeader(leader, amount, actor) {
  const receivers = activePlayers().filter((p) => p.token !== leader.token);
  if (!receivers.length) return 0;
  const share = Math.floor(amount / receivers.length);
  receivers.forEach((p) => p.score += share);
  if (actor) addReputation(actor, -2);
  return share * receivers.length;
}

function doMine(player) {
  const base = rand(12_000, 24_000);
  const gain = Math.floor(base * mineMultiplier(player));
  player.score += gain;
  addReputation(player, 0.4);
}

function doGreed(player) {
  markRisk(player);
  if (Math.random() < chance(0.55, player, "greed")) {
    const gain = Math.floor((rand(45_000, 90_000) + player.score * 0.045) * riskGainMultiplier(player));
    player.score += Math.min(gain, 520_000);
    addLog(`${player.name} Katla tuttu: +${format(Math.min(gain, 520_000))} TREEZ.`);
  } else {
    const lost = applyLoss(player, rand(38_000, 82_000) + player.score * 0.04, { risk: true });
    addLog(`${player.name} Katla patladı: -${format(lost.netLoss)} TREEZ.`);
  }
  player.longBoost = false;
  player.pumpSignal = false;
}

function doMega(player) {
  if (player.score < 80_000) return toast(player, "Mega Pump için en az 80K lazım.");
  markRisk(player);
  addHeat(player, 7);
  addReputation(player, -2);
  if (Math.random() < chance(0.39, player, "mega")) {
    const gain = Math.floor((rand(150_000, 270_000) + player.score * 0.13) * riskGainMultiplier(player));
    player.score += Math.min(gain, 1_050_000);
    addLog(`${player.company} Mega Pump bastı: +${format(Math.min(gain, 1_050_000))} TREEZ.`, true);
  } else {
    const lost = applyLoss(player, rand(110_000, 190_000) + player.score * 0.105, { risk: true });
    addLog(`${player.company} Mega Pump çöktü: -${format(lost.netLoss)} TREEZ.`, true);
  }
  player.longBoost = false;
  player.pumpSignal = false;
}

function doSteal(player) {
  const target = weightedTarget(player);
  if (!target) return toast(player, "Çalacak hedef yok. Trajik bir dürüstlük anı.");
  markRisk(player);
  addHeat(player, 12);
  addReputation(player, -4);
  const success = Math.random() < chance(0.61, player, "steal");
  if (!success) {
    const lost = applyLoss(player, rand(40_000, 95_000) + player.score * 0.035, { risk: true });
    addLog(`${player.name}, ${target.name} cüzdanına girmeye çalıştı ama yakalandı: -${format(lost.netLoss)} TREEZ.`);
    return;
  }
  const amount = Math.floor((rand(35_000, 80_000) + target.score * 0.07) * pvpMultiplier(player, "steal"));
  const result = applyLoss(target, amount, { pvp: true });
  const gained = Math.floor(result.removed * (player.role === "thief" ? 0.93 : 0.84));
  player.score += gained;
  markAttacked(target);
  markStolen(player, gained);
  addLog(`${player.name}, ${target.name} cüzdanından ${format(gained)} TREEZ çekti.`);
}

function doTax(player) {
  const leader = sortedPlayers()[0];
  if (!leader || leader.token === player.token) return toast(player, "Lider sensin. Kendinden vergi kesmek vergi dairesinin bile aklına gelmez.");
  addHeat(player, 6);
  const leaderAge = leader.token === lastLeaderToken ? now() - leaderStartedAt : 0;
  let mult = currentMarket().tax;
  if (finalCrisis === "riot") mult *= 1.22;
  if (leader.taxVulnerableUntil > now()) mult *= 1.18;
  if (player.taxFileUntil > now()) mult *= 1.22;
  if (leaderAge > 90_000) mult *= 1.12;
  if (ownsSector(player, "palace")) mult *= 1.12;
  if (player.role === "saboteur") mult *= 1.12;
  const amount = Math.floor((45_000 + leader.score * 0.055) * mult);
  const result = applyLoss(leader, amount, { pvp: true });
  const distributed = distributeFromLeader(leader, result.removed, player);
  markAttacked(leader);
  addLog(`${player.name} Lider Vergisi kesti. ${format(distributed)} TREEZ masaya bölüştü.`, true);
  player.taxFileUntil = 0;
}

function doRug(player) {
  if (player.score < 120_000) return toast(player, "Rug Pull için en az 120K lazım.");
  markRisk(player);
  addHeat(player, 18);
  addReputation(player, -7);
  if (Math.random() < chance(0.42, player, "rug")) {
    let total = 0;
    activePlayers().filter((p) => p.token !== player.token).forEach((target) => {
      const amount = Math.floor((target.score * 0.045 + rand(18_000, 44_000)) * pvpMultiplier(player, "rug"));
      const result = applyLoss(target, amount, { pvp: true });
      total += Math.floor(result.removed * 0.48);
      if (result.removed > 0) markAttacked(target);
    });
    player.score += total;
    markStolen(player, total);
    addLog(`${player.company} Rug Pull attı. Masadan ${format(total)} TREEZ süpürdü. Böyle ahlak dersi olmaz.`, true);
  } else {
    const lost = applyLoss(player, rand(130_000, 260_000) + player.score * 0.10, { risk: true });
    addLog(`${player.company} Rug Pull denerken kendi halısına takıldı: -${format(lost.netLoss)} TREEZ.`, true);
  }
}

function doThrone(player) {
  const leader = sortedPlayers()[0];
  if (!leader || leader.token === player.token) return toast(player, "Taht sende. Kendine soygun düzenlemek psikolojik bir vaka.");
  if (player.score < 70_000) return toast(player, "Taht Soygunu için 70K lazım.");
  markRisk(player);
  addHeat(player, 10);
  const leaderAge = leader.token === lastLeaderToken ? now() - leaderStartedAt : 0;
  const boosted = leader.bountyUntil > now() || leaderAge > 70_000;
  const successChance = chance(boosted ? 0.56 : 0.43, player, "throne");
  if (Math.random() < successChance) {
    const amount = Math.floor((leader.score * (boosted ? 0.105 : 0.075) + rand(80_000, 150_000)) * pvpMultiplier(player, "throne"));
    const result = applyLoss(leader, amount, { pvp: true });
    const gain = Math.floor(result.removed * 0.78);
    player.score += gain;
    markAttacked(leader);
    markStolen(player, gain);
    addLog(`${player.name}, lider ${leader.name} tahtından ${format(gain)} TREEZ kopardı.`, true);
  } else {
    const lost = applyLoss(player, rand(90_000, 180_000) + player.score * 0.055, { risk: true });
    addLog(`${player.name} Taht Soygunu'nda çuvalladı: -${format(lost.netLoss)} TREEZ.`, true);
  }
  player.throneKeyUntil = 0;
}

function doJackpot(player) {
  if (player.score < 180_000) return toast(player, "Jackpot için en az 180K lazım.");
  markRisk(player);
  addHeat(player, 9);
  const jackpotChance = 0.15;
  if (Math.random() < jackpotChance) {
    let gain = rand(450_000, 780_000) + player.score * 0.16;
    if (player.role === "whale") gain *= 1.18;
    if (player.role === "gambler") gain *= 1.12;
    if (player.companyPath === "speculative") gain *= 1.08;
    if (finalCrisis === "bullrush") gain *= 1.12;
    if (player.leverageUntil > now()) gain *= 1.35;
    gain = Math.floor(Math.min(gain, 1_600_000));
    player.score += gain;
    addLog(`${player.name} JACKPOT vurdu: +${format(gain)} TREEZ. %15 ihtimalle medeniyet kısa süreliğine çalıştı.`, true);
  } else {
    const lost = applyLoss(player, rand(150_000, 260_000) + player.score * 0.085, { risk: true });
    addLog(`${player.name} Jackpot kaybetti: -${format(lost.netLoss)} TREEZ.`);
  }
  player.longBoost = false;
  player.pumpSignal = false;
}

function doShield(player) {
  if (!charge(player, 50_000, "Kalkan")) return;
  player.shieldCharges = clamp(player.shieldCharges + 1, 0, 5);
  addReputation(player, 1);
  addLog(`${player.name} 50K ödeyip kalkan aldı.`);
}

function doRiskScan(player) {
  if (!charge(player, 35_000, "Risk Analizi")) return;
  player.riskAnalysisCharges = clamp(player.riskAnalysisCharges + 1, 0, 4);
  addReputation(player, 1);
  addLog(`${player.name} Risk Analizi açtı. Direkt para yok, beyin var. Nadir olay.`);
}

function doVault(player) {
  if (player.score < 60_000) return toast(player, "Kasaya koymak için 60K lazım.");
  let rate = 0.16;
  if (player.role === "banker") rate = 0.21;
  if (ownsSector(player, "bank")) rate += 0.04;
  if (player.companyPath === "cautious") rate += 0.035;
  if (isFinalPhase()) rate *= finalCrisis === "bankrun" ? 1.04 : 0.82;
  const lock = Math.floor(player.score * clamp(rate, 0.08, 0.28));
  const fee = Math.floor(lock * 0.025);
  player.score -= lock;
  player.vault += Math.max(0, lock - fee);
  addReputation(player, 2);
  addLog(`${player.name} ${format(lock - fee)} TREEZ kasaya koydu. Kazanma skorundan ayrıldı, çünkü bedava avantaj diye bir şey yok.`);
}

function doInsurance(player) {
  let cost = 80_000;
  if (player.role === "banker" || player.role === "insurer") cost = 65_000;
  if (ownsSector(player, "bank")) cost -= 8_000;
  if (isFinalPhase()) cost = Math.floor(cost * 1.2);
  if (!charge(player, cost, "Sigorta")) return;
  let cover = 170_000;
  if (player.role === "insurer") cover = 260_000;
  if (player.role === "banker") cover = 225_000;
  if (ownsSector(player, "bank")) cover += 55_000;
  if (player.companyPath === "cautious") cover += 35_000;
  player.insurance += cover;
  addReputation(player, 2);
  addLog(`${player.name} sigorta aldı: +${format(cover)} koruma.`);
}

function doBlackMarket(player) {
  if (player.inventory.length >= 2) return toast(player, "Envanter dolu. İki eşya sınırı var, pazar arabası değil bu.");
  if (!charge(player, 120_000, "Kara Borsa")) return;
  addHeat(player, ownsSector(player, "darknet") ? 10 : 14);
  addReputation(player, -4);
  let pool = BLACK_MARKET_ITEMS;
  if (player.role === "thief" || ownsSector(player, "darknet")) pool = [...pool, ...pool.slice(0, 5)];
  const item = pick(pool);
  player.inventory.push({ ...item });
  addLog(`${player.name} Kara Borsa'dan ${item.title} aldı. Fatura kesilmedi, sürpriz olmalı.`, true);
}

function doUseItem(player) {
  if (!player.inventory.length) return toast(player, "Kullanacak eşya yok.");
  const item = player.inventory.shift();
  const t = now();
  if (item.id === "fakeWallet") {
    player.shieldCharges = clamp(player.shieldCharges + 1, 0, 5);
    player.heat = clamp(player.heat - 8, 0, 100);
  }
  if (item.id === "taxFile") player.taxFileUntil = t + 60_000;
  if (item.id === "throneKey") player.throneKeyUntil = t + 60_000;
  if (item.id === "smokeBomb") {
    player.smokeUntil = t + 45_000;
    player.hiddenUntil = Math.max(player.hiddenUntil, t + 35_000);
  }
  if (item.id === "pumpSignal") player.pumpSignal = true;
  if (item.id === "pressKit") {
    addReputation(player, 16);
    player.heat = clamp(player.heat - 14, 0, 100);
  }
  if (item.id === "auditShield") player.auditShieldUntil = t + 85_000;
  if (item.id === "marketRumor") {
    marketIndex = rand(0, MARKETS.length - 1);
    marketEndsAt = t + MARKET_MS;
    addHeat(player, 6);
  }
  addLog(`${player.name} eşya kullandı: ${item.title}.`, true);
}

function doReputation(player) {
  const baseCost = player.heat > 70 ? 105_000 : 75_000;
  const cost = ownsSector(player, "media") ? Math.floor(baseCost * 0.82) : baseCost;
  if (!charge(player, cost, "İtibar Yönet")) return;
  player.heat = clamp(player.heat - (ownsSector(player, "media") ? 28 : 20), 0, 100);
  addReputation(player, ownsSector(player, "media") ? 14 : 10);
  addLog(`${player.company} itibar operasyonu yaptı. Isı düştü, vitrin parladı.`);
}

function doEvadeRegulator(player) {
  const cost = 90_000;
  if (!charge(player, cost, "Regülatörü Atlat")) return;
  const successChance = clamp(0.62 + player.reputation / 500 + (ownsSector(player, "media") ? 0.12 : 0) - player.heat / 420, 0.35, 0.88);
  if (Math.random() < successChance) {
    player.heat = clamp(player.heat - 34, 0, 100);
    player.auditShieldUntil = now() + 45_000;
    addReputation(player, 5);
    addLog(`${player.name} regülatörü atlattı. Evraklar tertemiz görünüyor, yani muhtemelen değil.`, true);
  } else {
    addHeat(player, 8);
    const lost = applyLoss(player, 85_000 + player.score * 0.035, { regulator: true });
    addLog(`${player.name} regülatörü atlatamadı: -${format(lost.netLoss)} TREEZ.`, true);
  }
}

function doLeverage(player) {
  if (player.score < 250_000) return toast(player, "Kaldıraç için en az 250K nakit lazım.");
  if (player.leverageUntil > now()) return toast(player, "Kaldıraç zaten aktif. İki kez uçurumdan atlamaya gerek yok.");
  const cost = player.role === "whale" || ownsSector(player, "exchange") ? 42_000 : 55_000;
  if (!charge(player, cost, "Kaldıraç")) return;
  let duration = 42_000;
  if (player.role === "whale") duration += 8_000;
  if (player.strategy === "leverage") duration += 8_000;
  if (player.finalPlan === "allin" && isFinalPhase()) duration += 6_000;
  player.leverageUntil = now() + duration;
  player.leverageStartedAt = now();
  player.leverageMult = 2;
  addHeat(player, 8);
  markRisk(player);
  addLog(`${player.company} 2x kaldıraç açtı. Kazanç da kayıp da büyür. İnsanlar hâlâ bunu romantik buluyor.`, true);
}

function preferredSectorFor(player) {
  if (player.role === "miner") return "mine";
  if (player.role === "thief") return "darknet";
  if (player.role === "banker") return "bank";
  if (player.role === "whale") return "exchange";
  if (player.role === "insurer") return "media";
  if (player.role === "saboteur") return "palace";
  return pick(Object.keys(SECTOR_DEFS));
}

function doSector(player) {
  const sectorIds = Object.keys(SECTOR_DEFS);
  let targetId = preferredSectorFor(player);
  if (sectors[targetId]?.owner === player.token) {
    targetId = pick(sectorIds.filter((id) => sectors[id].owner !== player.token));
  }
  if (!targetId) return toast(player, "Zaten bütün sektörler sende. İmparatorluk kurulmuş, sakin ol.");

  const target = sectors[targetId];
  const cost = target.owner ? 140_000 : 95_000;
  if (!charge(player, cost, "Sektör Ele Geçir")) return;

  addHeat(player, target.owner ? 10 : 6);
  markRisk(player);

  let c = 0.53 + player.reputation / 500 - player.heat / 600;
  if (SECTOR_DEFS[targetId].role === player.role) c += 0.11;
  if (player.companyPath === "aggressive") c += 0.04;
  if (player.strategy === "regulated") c += 0.025;
  if (target.owner) {
    const owner = players.get(target.owner);
    if (owner && owner.score > player.score) c -= 0.04;
    if (owner && owner.reputation < player.reputation) c += 0.035;
  }
  c = clamp(c, 0.25, 0.82);

  if (Math.random() < c) {
    const oldOwner = target.owner ? playerName(target.owner) : "Boşta";
    target.owner = player.token;
    markSectorTakeover(player);
    addReputation(player, 3);
    addLog(`${player.company}, ${target.icon} ${target.title} sektörünü aldı. Eski sahip: ${oldOwner}.`, true);
  } else {
    const lost = applyLoss(player, 75_000 + player.score * 0.035, { risk: true });
    addLog(`${player.company}, ${target.title} baskınında başarısız oldu: -${format(lost.netLoss)} TREEZ.`);
  }
}

function companyDecisionOptions() {
  return [
    { id: "path_cautious", title: "Temkinli Fon", desc: "Kasa, sigorta ve itibar güçlenir. Risk kazancı biraz yavaşlar." },
    { id: "path_aggressive", title: "Agresif Fon", desc: "PvP ve sektör baskını güçlenir. Isı daha hızlı artar." },
    { id: "path_speculative", title: "Spekülatif Fon", desc: "Katla, Mega Pump ve kaldıraç büyür. Patlayınca daha sert yakar." }
  ];
}

function doDevelop(player) {
  if (!player.companyPath) {
    player.pendingDecision = "companyPath";
    if (player.socketId) {
      io.to(player.socketId).emit("decisionOffer", {
        type: "companyPath",
        title: "Şirket Kimliği Seç",
        desc: "Bu masa boyunca şirketinin ana çizgisi bu olacak. Sonradan değiştirmek yok, insanlara fazla özgürlük verdik zaten.",
        options: companyDecisionOptions()
      });
    }
    return;
  }
  if (player.developmentLevel >= 3) return toast(player, "Şirket geliştirme maksimum 3 seviye.");
  const cost = 150_000 + player.developmentLevel * 90_000;
  if (!charge(player, cost, "Şirket Geliştir")) return;
  player.developmentLevel += 1;
  if (player.companyPath === "cautious") {
    player.insurance += 90_000;
    player.shieldCharges = clamp(player.shieldCharges + 1, 0, 5);
    addReputation(player, 7);
  }
  if (player.companyPath === "aggressive") {
    addHeat(player, 5);
    addReputation(player, -2);
    player.badFameUntil = now() + 45_000;
  }
  if (player.companyPath === "speculative") {
    player.riskAnalysisCharges = clamp(player.riskAnalysisCharges + 1, 0, 4);
    addHeat(player, 4);
  }
  addLog(`${player.company} şirket geliştirdi: ${player.companyPathTitle} Lv.${player.developmentLevel}.`, true);
}

function doRolePower(player) {
  const t = now();
  if (player.role === "miner") {
    const gain = Math.floor((120_000 + player.score * 0.045) * mineMultiplier(player));
    player.score += Math.min(gain, 480_000);
    player.shieldCharges = clamp(player.shieldCharges + 1, 0, 5);
    if (!ownsSector(player, "mine") && Math.random() < 0.35) sectors.mine.owner = player.token;
    addLog(`${player.name} Altın Damar buldu. Maden baskısı geldi.`, true);
  }
  if (player.role === "thief") {
    let total = 0;
    sortedPlayers().filter((target) => target.token !== player.token && target.score > player.score * 0.65).slice(0, 3).forEach((target) => {
      const result = applyLoss(target, Math.floor(target.score * 0.05), { pvp: true });
      total += Math.floor(result.removed * 0.9);
      if (result.removed > 0) markAttacked(target);
    });
    player.score += total;
    addHeat(player, 16);
    markStolen(player, total);
    if (Math.random() < 0.45) sectors.darknet.owner = player.token;
    addLog(`${player.name} Gece Baskını yaptı: +${format(total)} TREEZ.`, true);
  }
  if (player.role === "banker") {
    const lock = Math.floor(player.score * 0.18);
    player.score -= lock;
    player.vault += Math.floor(lock * 0.99);
    player.insurance += 220_000;
    sectors.bank.owner = player.token;
    addReputation(player, 5);
    addLog(`${player.name} Banker Kasası açtı. Banka Ağı üzerinde baskı kurdu.`, true);
  }
  if (player.role === "whale") {
    markRisk(player);
    if (Math.random() < chance(0.49, player, "mega")) {
      const gain = Math.floor((330_000 + player.score * 0.32) * riskGainMultiplier(player));
      player.score += Math.min(gain, 1_250_000);
      sectors.exchange.owner = player.token;
      addLog(`${player.name} Balina Pompası vurdu: +${format(Math.min(gain, 1_250_000))} TREEZ.`, true);
    } else {
      const lost = applyLoss(player, 240_000 + player.score * 0.22, { risk: true });
      addLog(`${player.name} Balina Pompası patladı: -${format(lost.netLoss)} TREEZ.`, true);
    }
    player.longBoost = false;
    player.pumpSignal = false;
  }
  if (player.role === "insurer") {
    player.insurance += 320_000;
    player.shieldCharges = clamp(player.shieldCharges + 2, 0, 5);
    player.hiddenUntil = Math.max(player.hiddenUntil, t + 35_000);
    sectors.media.owner = player.token;
    addReputation(player, 8);
    addLog(`${player.name} Acil Poliçe açtı. Medya da işi tatlı gösterdi.`, true);
  }
  if (player.role === "saboteur") {
    const leader = sortedPlayers()[0];
    if (leader && leader.token !== player.token) {
      leader.bountyUntil = t + 85_000;
      leader.taxVulnerableUntil = t + 75_000;
      sectors.palace.owner = player.token;
      addHeat(player, 8);
      addLog(`${player.name}, lider ${leader.name} üzerine bounty açtı. Saray kokusu geldi.`, true);
    } else {
      toast(player, "İşaretleyecek lider yok.");
    }
  }
  if (player.role === "gambler") {
    markRisk(player);
    if (Math.random() < 0.5) {
      const gain = Math.floor((230_000 + player.score * 0.18) * riskGainMultiplier(player));
      player.score += Math.min(gain, 850_000);
      if (Math.random() < 0.25) player.inventory.push({ ...pick(BLACK_MARKET_ITEMS) });
      addLog(`${player.name} Zar At kazandı: +${format(Math.min(gain, 850_000))} TREEZ.`, true);
    } else {
      const lost = applyLoss(player, 200_000 + player.score * 0.16, { risk: true });
      addLog(`${player.name} Zar At kaybetti: -${format(lost.netLoss)} TREEZ.`, true);
    }
    player.longBoost = false;
    player.pumpSignal = false;
    normalizePlayer(player);
  }
}

function milestoneOptions(milestone) {
  if (milestone === 500_000) {
    return [
      { id: "m500_cautious", title: "Temkinli Fon", desc: "Şirketin güvenli yola girer. Kasa/sigorta iyi, risk biraz yavaş." },
      { id: "m500_aggressive", title: "Agresif Fon", desc: "PvP ve sektör baskını iyi. Isı daha hızlı artar." },
      { id: "m500_speculative", title: "Spekülatif Fon", desc: "Riskli kazançlar iyi. Likidasyon daha tatsız." }
    ];
  }
  if (milestone === 2_000_000) {
    return [
      { id: "m2_regulated", title: "Regüle Büyüme", desc: "İtibar artar, regülatör cezası azalır. Kara Borsa zayıflar." },
      { id: "m2_shadow", title: "Gölge Ekonomi", desc: "Kara Borsa ve çalma güçlenir. Isı hızlı artar." },
      { id: "m2_leverage", title: "Kaldıraçlı Büyüme", desc: "Kaldıraç daha uzun sürer. Likidasyon daha sert olur." }
    ];
  }
  return [
    { id: "m5_safe", title: "Güvenli Çıkış", desc: "Final krizinde kayıplar azalır. Final kazancı biraz düşer." },
    { id: "m5_dominate", title: "Piyasayı Ezip Geç", desc: "Finalde saldırılar güçlenir. Hedef olma ihtimalin artar." },
    { id: "m5_allin", title: "Her Şeyi Bas", desc: "Finalde risk ve kaldıraç büyür. Likidasyon korkunç olur." }
  ];
}

function firstPendingMilestone(player) {
  return [500_000, 2_000_000, 5_000_000].find((milestone) => {
    return player.score >= milestone && !player.milestones[milestone] && player.pendingMilestone !== milestone;
  });
}

function sendDecisionOffer(player) {
  if (!player.socketId) return;

  if (player.pendingDecision === "companyPath") {
    io.to(player.socketId).emit("decisionOffer", {
      type: "companyPath",
      title: "Şirket Kimliği Seç",
      desc: "Bu masa boyunca şirketinin ana çizgisi bu olacak. Sonradan değiştirmek yok, çünkü ekonomi zaten yeterince saçma.",
      options: companyDecisionOptions()
    });
    return;
  }

  if (player.pendingMilestone) {
    io.to(player.socketId).emit("decisionOffer", {
      type: "milestone",
      milestone: player.pendingMilestone,
      title: `${format(player.pendingMilestone)} TREEZ Şirket Kararı`,
      desc: "Bu ödül kapısı değil. Bir şeyi güçlendirirken başka bir şeyi riske atıyorsun. İnsanlık sonunda karar mekaniğini keşfetti.",
      options: milestoneOptions(player.pendingMilestone)
    });
  }
}

function checkMilestone(player) {
  if (player.pendingMilestone) {
    sendDecisionOffer(player);
    return;
  }
  const milestone = firstPendingMilestone(player);
  if (!milestone) return;
  player.pendingMilestone = milestone;
  addLog(`${player.name}, ${format(milestone)} TREEZ eşiğine geldi. Şirket kararı bekliyor.`, true);
  sendDecisionOffer(player);
}

function applyCompanyPath(player, choiceId) {
  if (!["path_cautious", "path_aggressive", "path_speculative"].includes(choiceId)) return false;
  if (choiceId === "path_cautious") {
    player.companyPath = "cautious";
    player.companyPathTitle = "Temkinli Fon";
    player.insurance += 120_000;
    addReputation(player, 8);
  }
  if (choiceId === "path_aggressive") {
    player.companyPath = "aggressive";
    player.companyPathTitle = "Agresif Fon";
    player.badFameUntil = now() + 50_000;
    addHeat(player, 8);
  }
  if (choiceId === "path_speculative") {
    player.companyPath = "speculative";
    player.companyPathTitle = "Spekülatif Fon";
    player.riskAnalysisCharges = clamp(player.riskAnalysisCharges + 1, 0, 4);
    addHeat(player, 5);
  }
  player.pendingDecision = null;
  addLog(`${player.company} şirket kimliği seçti: ${player.companyPathTitle}.`, true);
  return true;
}

function applyMilestoneChoice(player, choiceId) {
  const milestone = player.pendingMilestone;
  if (!milestone) return false;
  const valid = milestoneOptions(milestone).some((option) => option.id === choiceId);
  if (!valid) return false;

  if (choiceId === "m500_cautious") {
    player.companyPath = "cautious";
    player.companyPathTitle = "Temkinli Fon";
    player.score = Math.max(0, player.score - 35_000);
    player.insurance += 170_000;
    player.shieldCharges = clamp(player.shieldCharges + 1, 0, 5);
    addReputation(player, 8);
  }
  if (choiceId === "m500_aggressive") {
    player.companyPath = "aggressive";
    player.companyPathTitle = "Agresif Fon";
    player.badFameUntil = now() + 65_000;
    addHeat(player, 12);
  }
  if (choiceId === "m500_speculative") {
    player.companyPath = "speculative";
    player.companyPathTitle = "Spekülatif Fon";
    player.riskModeUntil = now() + 75_000;
    addHeat(player, 8);
  }

  if (choiceId === "m2_regulated") {
    player.strategy = "regulated";
    player.strategyTitle = "Regüle Büyüme";
    player.heat = clamp(player.heat - 22, 0, 100);
    addReputation(player, 16);
    player.auditShieldUntil = now() + 80_000;
  }
  if (choiceId === "m2_shadow") {
    player.strategy = "shadow";
    player.strategyTitle = "Gölge Ekonomi";
    addHeat(player, 18);
    if (player.inventory.length < 2) player.inventory.push({ ...pick(BLACK_MARKET_ITEMS) });
  }
  if (choiceId === "m2_leverage") {
    player.strategy = "leverage";
    player.strategyTitle = "Kaldıraçlı Büyüme";
    player.riskAnalysisCharges = clamp(player.riskAnalysisCharges + 1, 0, 4);
    addHeat(player, 10);
  }

  if (choiceId === "m5_safe") {
    player.finalPlan = "safe";
    player.finalPlanTitle = "Güvenli Çıkış";
    player.score = Math.max(0, player.score - 160_000);
    player.insurance += 800_000;
    player.auditShieldUntil = now() + 110_000;
    addReputation(player, 12);
  }
  if (choiceId === "m5_dominate") {
    player.finalPlan = "dominate";
    player.finalPlanTitle = "Piyasayı Ezip Geç";
    player.badFameUntil = now() + 100_000;
    player.bountyUntil = now() + 90_000;
    addHeat(player, 16);
  }
  if (choiceId === "m5_allin") {
    player.finalPlan = "allin";
    player.finalPlanTitle = "Her Şeyi Bas";
    player.fullRiskUntil = now() + 110_000;
    player.riskAnalysisCharges = clamp(player.riskAnalysisCharges + 1, 0, 4);
    addHeat(player, 18);
  }

  player.milestones[milestone] = true;
  player.pendingMilestone = null;
  normalizePlayer(player);
  addLog(`${player.name} ${format(milestone)} kararını seçti: ${milestoneOptions(milestone).find((o) => o.id === choiceId)?.title}.`, true);
  return true;
}

function assignSecretRivals() {
  const list = activePlayers();
  if (list.length < 2) return;
  list.forEach((player, index) => {
    if (player.secretRival && players.get(player.secretRival)) return;
    const candidates = list.filter((p) => p.token !== player.token);
    if (!candidates.length) return;
    player.secretRival = candidates[(index + 1) % candidates.length].token;
  });
}

function checkSecretRivalBonus(player) {
  // Gizli rakip şimdilik para basmıyor. Ama UI baskısı veriyor.
  // Bilerek ödül koymuyoruz; yoksa iki kişi birbirini farm makinesine çevirir. İnsanlık bunu denerdi.
  if (!player.secretRival) return;
}

function checkWinner(player) {
  if (winner || !player) return;
  if (player.score >= WIN_SCORE) {
    endRound(`${player.company} 10.000.000 TREEZ yaptı ve piyasayı ele geçirdi!`, player.name);
  }
}

function endRound(reason, winnerName) {
  if (winner) return;
  winner = winnerName || "Lider";
  addLog(reason, true);
  emitState();
  clearTimeout(resetTimer);
  resetTimer = setTimeout(() => resetRound(false), RESET_AFTER_WIN_MS);
}

function resetPlayerForRound(player) {
  player.score = 0;
  player.vault = 0;
  player.insurance = 0;
  player.shieldCharges = 0;
  player.riskAnalysisCharges = 0;
  player.heat = 0;
  player.reputation = 50;
  player.inventory = [];
  player.companyPath = null;
  player.companyPathTitle = null;
  player.developmentLevel = 0;
  player.strategy = null;
  player.strategyTitle = null;
  player.finalPlan = null;
  player.finalPlanTitle = null;
  player.leverageUntil = 0;
  player.liquidatedUntil = 0;
  player.auditShieldUntil = 0;
  player.taxFileUntil = 0;
  player.throneKeyUntil = 0;
  player.smokeUntil = 0;
  player.pumpSignal = false;
  player.bountyUntil = 0;
  player.hiddenUntil = 0;
  player.riskModeUntil = 0;
  player.finalSpeedUntil = 0;
  player.fullRiskUntil = 0;
  player.longBoost = false;
  player.taxVulnerableUntil = 0;
  player.taxCleanUntil = 0;
  player.badFameUntil = 0;
  player.pendingMilestone = null;
  player.pendingDecision = null;
  player.milestones = {};
  player.secretRival = null;
  player.lastGain = 0;
  player.lastAction = {};
}

function cleanupOldOfflinePlayers() {
  const list = allPlayers().filter((p) => !p.online).sort((a, b) => a.lastSeen - b.lastSeen);
  while (players.size > TOTAL_PLAYER_SOFT_CAP && list.length) {
    const old = list.shift();
    players.delete(old.token);
  }
}

function resetRound(keepLogs = true) {
  roundNumber += 1;
  roundStart = now();
  marketIndex = rand(0, MARKETS.length - 1);
  marketEndsAt = now() + MARKET_MS;
  finalCrisis = null;
  finalCrisisAnnounced = false;
  winner = null;
  lastLeaderToken = null;
  leaderStartedAt = now();
  lastRegulatorAt = now();
  sectors = createFreshSectors();
  roundStats = defaultStats();
  allPlayers().forEach(resetPlayerForRound);
  if (!keepLogs) logs = [];
  addLog(`Yeni masa başladı: TREEZCOIN 4.0 Borsa Savaşı.`, true);
  cleanupOldOfflinePlayers();
  assignSecretRivals();
  emitState();
}

function wipeAll() {
  players.clear();
  logs = [];
  roundNumber = 1;
  roundStart = now();
  marketIndex = 0;
  marketEndsAt = now() + MARKET_MS;
  finalCrisis = null;
  finalCrisisAnnounced = false;
  winner = null;
  sectors = createFreshSectors();
  roundStats = defaultStats();
  addLog("Komple wipe atıldı. Ekonomi sıfırlandı. Keşke gerçek hayatta da bu kadar kolay olsa.", true);
  emitState();
}

function handleHello(socket, payload = {}) {
  let token = String(payload.token || "").trim();
  let player = token ? players.get(token) : null;

  if (!player) {
    if (onlinePlayers().length >= MAX_PLAYERS) {
      socket.emit("roomFull");
      return;
    }
    token = randomToken();
    player = createPlayer(token, payload.name, payload.role, payload.company);
    players.set(token, player);
    addLog(`${player.name} masaya katıldı.`);
  }

  player.socketId = socket.id;
  player.online = true;
  player.lastSeen = now();

  if (payload.name) player.name = safeName(payload.name);
  if (payload.company) player.company = safeCompany(payload.company, player.name);
  if (!player.role && ROLES[payload.role]) player.role = payload.role;
  if (!player.company) player.company = safeCompany(null, player.name);

  socket.data.token = token;
  socket.data.welcomed = true;

  socket.emit("session", {
    token,
    name: player.name,
    company: player.company,
    role: player.role,
    playerId: player.token
  });

  if (!player.role) socket.emit("needRole", { roles: publicRoles() });
  if (player.pendingMilestone || player.pendingDecision) sendDecisionOffer(player);
  assignSecretRivals();
  emitState();
}

function getSocketPlayer(socket) {
  const token = socket.data?.token;
  return token ? players.get(token) : null;
}

function handleAction(player, type) {
  if (winner) return;
  if (!requireRole(player)) return;
  if (player.pendingMilestone || player.pendingDecision) {
    toast(player, "Önce kararını seç. Şirket toplantısı yarım kalmış.");
    sendDecisionOffer(player);
    return;
  }
  if (!BASE_COOLDOWNS[type]) return;
  if (!canUse(player, type)) return;

  const before = snapshotScores();

  if (type === "mine") doMine(player);
  if (type === "greed") doGreed(player);
  if (type === "mega") doMega(player);
  if (type === "steal") doSteal(player);
  if (type === "tax") doTax(player);
  if (type === "rug") doRug(player);
  if (type === "throne") doThrone(player);
  if (type === "jackpot") doJackpot(player);
  if (type === "shield") doShield(player);
  if (type === "riskScan") doRiskScan(player);
  if (type === "vault") doVault(player);
  if (type === "insurance") doInsurance(player);
  if (type === "blackMarket") doBlackMarket(player);
  if (type === "rolePower") doRolePower(player);
  if (type === "sector") doSector(player);
  if (type === "develop") doDevelop(player);
  if (type === "leverage") doLeverage(player);
  if (type === "reputation") doReputation(player);
  if (type === "useItem") doUseItem(player);
  if (type === "evadeRegulator") doEvadeRegulator(player);

  finishAction(before);
  checkMilestone(player);
  checkSecretRivalBonus(player);
  checkWinner(player);
  assignSecretRivals();
  emitState();
}

function updateMarket() {
  if (now() < marketEndsAt) return;
  let next = rand(0, MARKETS.length - 1);
  if (next === marketIndex) next = (next + 1) % MARKETS.length;
  marketIndex = next;
  marketEndsAt = now() + MARKET_MS;
  addLog(`Piyasa değişti: ${currentMarket().title}. ${currentMarket().desc}`, true);
}

function updateFinalCrisis() {
  if (finalCrisisAnnounced || !isFinalPhase() || winner) return;
  const crisis = pick(FINAL_CRISES);
  finalCrisis = crisis.id;
  finalCrisisAnnounced = true;
  addLog(`FİNAL KRİZİ: ${crisis.title}. ${crisis.desc}`, true);
}

function updateLeaderPressure() {
  const leader = sortedPlayers()[0];
  if (!leader) return;
  if (leader.token !== lastLeaderToken) {
    lastLeaderToken = leader.token;
    leaderStartedAt = now();
    return;
  }
  roundStats.leaderTime[leader.token] = (roundStats.leaderTime[leader.token] || 0) + 1;
  const leaderAge = now() - leaderStartedAt;
  if (leaderAge > 55_000 && leader.score > 650_000) {
    leader.bountyUntil = Math.max(leader.bountyUntil, now() + 22_000);
    leader.heat = clamp(leader.heat + 1, 0, 100);
  }
  if (leaderAge > 110_000 && leader.score > 1_500_000) {
    leader.taxVulnerableUntil = Math.max(leader.taxVulnerableUntil, now() + 20_000);
  }
}

function updateHeatDecay() {
  const t = now();
  activePlayers().forEach((player) => {
    if (t - player.lastHeatDecay < 7500) return;
    player.lastHeatDecay = t;
    const decay = ownsSector(player, "media") ? 2 : 1;
    player.heat = clamp(player.heat - decay, 0, 100);
    if (player.reputation < 50 && player.heat < 30) player.reputation += 1;
  });
}

function runRegulator() {
  const t = now();
  if (t - lastRegulatorAt < REGULATOR_MS) return;
  lastRegulatorAt = t;

  const candidates = activePlayers().filter((p) => p.heat >= 55 && p.score > 80_000);
  if (!candidates.length) return;
  candidates.sort((a, b) => b.heat - a.heat || b.score - a.score);
  const target = candidates[0];
  const crisis = finalCrisis ? FINAL_CRIISES_BY_ID()[finalCrisis] : null;
  let pain = 65_000 + target.score * (target.heat >= 80 ? 0.065 : 0.04);
  if (crisis?.heatPain) pain *= crisis.heatPain;
  if (target.strategy === "regulated") pain *= 0.72;
  if (target.auditShieldUntil > t) pain *= 0.55;
  const result = applyLoss(target, pain, { regulator: true });
  target.heat = clamp(target.heat - 20, 0, 100);
  target.reputation = clamp(target.reputation - 9, 0, 100);
  if (target.inventory.length && Math.random() < 0.45) target.inventory.pop();
  markRegulatorHit(target);
  addLog(`REGÜLATÖR BASKINI: ${target.company} yakalandı. -${format(result.netLoss)} TREEZ. Isı düştü, ego da düştü.`, true);
}

function checkRoundTimer() {
  if (winner) return;
  if (timeLeftMs() > 0) return;
  const leader = sortedPlayers()[0];
  if (!leader || leader.score <= 0) {
    endRound("Süre bitti ama masada anlamlı lider yoktu. Yeni masa açılıyor.", "Kimse");
    return;
  }
  endRound(`Masa süresi bitti. Lider ${leader.name} kazandı.`, leader.name);
}

io.on("connection", (socket) => {
  socket.data.welcomed = false;

  socket.on("hello", (payload) => handleHello(socket, payload || {}));

  setTimeout(() => {
    if (!socket.data.welcomed) handleHello(socket, {});
  }, 900);

  socket.on("setProfile", (payload) => {
    const player = getSocketPlayer(socket);
    if (!player) return;
    player.name = safeName(payload?.name);
    player.company = safeCompany(payload?.company, player.name);
    addLog(`${player.name} profilini güncelledi: ${player.company}.`);
    socket.emit("session", { token: player.token, name: player.name, company: player.company, role: player.role, playerId: player.token });
    emitState();
  });

  socket.on("setName", (name) => {
    const player = getSocketPlayer(socket);
    if (!player) return;
    player.name = safeName(name);
    player.company = player.company || safeCompany(null, player.name);
    addLog(`${player.name} ismini kaydetti.`);
    socket.emit("session", { token: player.token, name: player.name, company: player.company, role: player.role, playerId: player.token });
    emitState();
  });

  socket.on("chooseRole", (roleId) => {
    const player = getSocketPlayer(socket);
    if (!player) return;
    if (player.role) {
      toast(player, "Rol zaten kilitli. Kararlarının arkasında durma simülasyonu başladı.");
      socket.emit("session", { token: player.token, name: player.name, company: player.company, role: player.role, playerId: player.token });
      return;
    }
    if (!ROLES[roleId]) {
      socket.emit("needRole", { roles: publicRoles() });
      return;
    }
    player.role = roleId;
    addLog(`${player.name} rol seçti: ${roleTitle(player)}.`, true);
    socket.emit("session", { token: player.token, name: player.name, company: player.company, role: player.role, playerId: player.token });
    emitState();
  });

  socket.on("decisionChoice", (payload) => {
    const player = getSocketPlayer(socket);
    if (!player) return;
    const before = snapshotScores();
    let ok = false;
    if (payload?.type === "milestone") ok = applyMilestoneChoice(player, payload.choiceId);
    if (payload?.type === "companyPath") ok = applyCompanyPath(player, payload.choiceId);
    if (!ok) return;
    finishAction(before);
    checkWinner(player);
    emitState();
  });

  socket.on("milestoneChoice", (choiceId) => {
    const player = getSocketPlayer(socket);
    if (!player) return;
    const before = snapshotScores();
    const ok = applyMilestoneChoice(player, choiceId);
    if (!ok) return;
    finishAction(before);
    checkWinner(player);
    emitState();
  });

  socket.on("action", (type) => {
    const player = getSocketPlayer(socket);
    if (!player) return;
    handleAction(player, type);
  });

  socket.on("disconnect", () => {
    const player = getSocketPlayer(socket);
    if (!player) return;
    if (player.socketId !== socket.id) return;
    player.online = false;
    player.socketId = null;
    player.lastSeen = now();
    addLog(`${player.name} offline oldu. Bakiyesi masada kaldı.`);
    emitState();
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    game: VERSION,
    roundNumber,
    players: players.size,
    online: onlinePlayers().length,
    winner,
    market: currentMarket().title,
    finalCrisis,
    uptime: Math.floor(process.uptime())
  });
});

app.get("/reset", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(403).send("Yanlış key.");
  resetRound(false);
  res.send("TREEZCOIN 4.0 masası resetlendi.");
});

app.get("/wipe", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.status(403).send("Yanlış key.");
  wipeAll();
  res.send("TREEZCOIN 4.0 komple wipe atıldı.");
});

setInterval(() => {
  updateMarket();
  updateFinalCrisis();
  updateLeaderPressure();
  updateHeatDecay();
  runRegulator();
  checkRoundTimer();
  emitState();
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`${VERSION} çalışıyor: http://localhost:${PORT}`);
});
