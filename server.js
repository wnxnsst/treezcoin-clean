const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static("public"));

const VERSION = "TREEZCOIN 3.0";
const WIN_SCORE = 10_000_000;
const ROUND_SECONDS = 14 * 60;
const MAX_ONLINE_PLAYERS = 6;
const ADMIN_KEY = "1234";

const MILESTONES = [500_000, 2_000_000, 5_000_000];

const SHIELD_COST = 50_000;
const VAULT_DEPOSIT_COST_RATE = 0.04;
const MAX_SCORE = 50_000_000;

const cooldowns = {
  mine: 180,
  greed: 1600,
  mega: 3200,
  steal: 3600,
  tax: 5000,
  rug: 7000,
  throne: 6500,
  jackpot: 8000,
  shield: 12000,
  riskScan: 9000,
  vault: 11000,
  insurance: 15000,
  blackMarket: 13000,
  rolePower: 20000
};

const roles = {
  miner: {
    id: "miner",
    title: "Madenci",
    desc: "Güvenli TREEZ kasma rolü.",
    plus: "TREEZ Kaz daha güçlü.",
    minus: "Çalma ve Rug Pull daha zayıf."
  },
  thief: {
    id: "thief",
    title: "Hırsız",
    desc: "PvP ve çalma odaklı rol.",
    plus: "Cüzdan Çal daha güçlü.",
    minus: "Kalkanı daha zayıf."
  },
  banker: {
    id: "banker",
    title: "Banker",
    desc: "Kasa, sigorta ve istikrar rolü.",
    plus: "Kasa ve sigorta daha verimli.",
    minus: "Riskli aksiyon kazancı daha düşük."
  },
  whale: {
    id: "whale",
    title: "Balina",
    desc: "Yüksek risk, yüksek ödül rolü.",
    plus: "Jackpot ve Mega Pump daha güçlü.",
    minus: "Başarısız risklerde daha çok kaybeder."
  },
  insurer: {
    id: "insurer",
    title: "Sigortacı",
    desc: "Hayatta kalma ve savunma rolü.",
    plus: "Kayıpların bir kısmını geri alabilir.",
    minus: "Kazançları biraz daha düşük."
  },
  saboteur: {
    id: "saboteur",
    title: "Sabotajcı",
    desc: "Lideri ve zenginleri düşürme rolü.",
    plus: "Lidere saldırıları daha güçlü.",
    minus: "Kendi kazım gücü düşük."
  },
  gambler: {
    id: "gambler",
    title: "Şansçı",
    desc: "Riskli hamleleri seven rol.",
    plus: "Riskli hamlelerde biraz daha şanslı.",
    minus: "Kaybedince daha sert tokat yer."
  }
};

const marketEvents = [
  {
    id: "calm",
    title: "Piyasa Sakin",
    desc: "Özel etki yok.",
    duration: 65
  },
  {
    id: "bull",
    title: "Boğa Sezonu",
    desc: "Kazançlar biraz artar.",
    duration: 55
  },
  {
    id: "bear",
    title: "Ayı Sezonu",
    desc: "Kazançlar düşer, risk cezaları artar.",
    duration: 55
  },
  {
    id: "liquidity",
    title: "Likidite Krizi",
    desc: "Çalma güçlenir, kalkanlar zayıflar.",
    duration: 45
  },
  {
    id: "taxweek",
    title: "Vergi Haftası",
    desc: "Lider Vergisi daha güçlü olur.",
    duration: 45
  },
  {
    id: "memecoin",
    title: "Meme Coin Çılgınlığı",
    desc: "Jackpot daha sert ama daha tehlikeli.",
    duration: 45
  }
];

const milestonePacks = {
  500000: [
    [
      {
        id: "mini_shield",
        title: "Mini Kalkan",
        desc: "50 saniye boyunca ilk saldırıyı azaltır. Anında %6 ödeme yaparsın."
      },
      {
        id: "small_cash",
        title: "Küçük Nakit",
        desc: "+120K TREEZ alırsın ama 50 saniye boyunca çalma hedefi olursun."
      }
    ],
    [
      {
        id: "pay_tax",
        title: "Vergiyi Öde",
        desc: "%10 kaybedersin ama 60 saniye saldırı hasarın azalır."
      },
      {
        id: "avoid_tax",
        title: "Vergiden Kaç",
        desc: "Şimdi ödemezsin ama 60 saniye sana gelen saldırılar güçlenir."
      }
    ],
    [
      {
        id: "buy_insurance",
        title: "Sigorta Al",
        desc: "Sonraki büyük kaybının %35’i geri gelir. Küçük bedel ödersin."
      },
      {
        id: "risk_mode",
        title: "Risk Modu",
        desc: "60 saniye kazançların artar ama kayıpların da artar."
      }
    ]
  ],
  2000000: [
    [
      {
        id: "lock_money",
        title: "Parayı Kilitle",
        desc: "Bakiyenin %25’i kasaya geçer. Çalınamaz ama kazanma skoruna hemen sayılmaz."
      },
      {
        id: "full_risk",
        title: "Tam Risk",
        desc: "90 saniye kazançların artar ama saldırılara daha açık olursun."
      }
    ],
    [
      {
        id: "mark_leader",
        title: "Lideri İşaretle",
        desc: "Lidere 60 saniye bounty koyarsın. Herkes liderden daha çok kazanır."
      },
      {
        id: "stay_quiet",
        title: "Sessiz Kal",
        desc: "60 saniye görünürlüğün azalır. Sana saldıranlar daha az kazanır."
      }
    ],
    [
      {
        id: "hedge",
        title: "Hedge Aç",
        desc: "Negatif market olaylarından daha az etkilenirsin ama kazançların düşer."
      },
      {
        id: "long",
        title: "Long Aç",
        desc: "Pozitif markette daha çok kazanırsın ama negatifte daha çok kaybedersin."
      }
    ]
  ],
  5000000: [
    [
      {
        id: "hidden_balance",
        title: "Gizli Bakiye",
        desc: "90 saniye skorun tabloda düşük görünür ama kazımın azalır."
      },
      {
        id: "show_off",
        title: "Gösteriş Yap",
        desc: "Kazancın artar ama bütün saldırılar sana daha güçlü gelir."
      }
    ],
    [
      {
        id: "final_insurance",
        title: "Final Sigortası",
        desc: "Büyük kayıplara karşı güçlü koruma alırsın ama %12 ödeme yaparsın."
      },
      {
        id: "final_speed",
        title: "Final Hızı",
        desc: "Riskli aksiyon cooldownları düşer ama başarısızlık cezaları artar."
      }
    ],
    [
      {
        id: "bad_reputation",
        title: "Kötü Şöhret",
        desc: "Saldırıların güçlenir ama herkes sana saldırınca bonus kazanır."
      },
      {
        id: "good_reputation",
        title: "İtibar Kazan",
        desc: "Sana gelen saldırılar zayıflar ama Rug Pull kilitlenir."
      }
    ]
  ]
};

let players = {};
let logs = [];
let winner = null;
let roundStartedAt = Date.now();
let currentMarket = marketEvents[0];
let marketEndsAt = Date.now() + currentMarket.duration * 1000;
let lastLeaderId = null;

let roundStats = {
  biggestGain: null,
  biggestLoss: null,
  mostStolen: {},
  mostAttacked: {},
  riskActions: {},
  leaderTime: {},
  roundNumber: 1
};

function uid() {
  return crypto.randomBytes(8).toString("hex");
}

function now() {
  return Date.now();
}

function cleanName(name) {
  return String(name || "Player")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 16) || "Player";
}

function formatTreez(value) {
  return Math.floor(value || 0).toLocaleString("tr-TR");
}

function clampScore(player) {
  player.score = Math.max(0, Math.min(MAX_SCORE, Math.floor(player.score || 0)));
  player.vault = Math.max(0, Math.min(MAX_SCORE, Math.floor(player.vault || 0)));
}

function addLog(text, important = false) {
  logs.push({
    text,
    important,
    time: new Date().toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })
  });

  if (logs.length > 16) logs.shift();
}

function onlineCount() {
  return Object.values(players).filter((player) => player.online).length;
}

function sortedPlayers() {
  return Object.values(players).sort((a, b) => b.score - a.score);
}

function publicPlayer(player) {
  const visibleScore = getVisibleScore(player);

  return {
    id: player.id,
    token: player.token,
    name: player.name,
    role: player.role,
    roleTitle: roles[player.role]?.title || "Oyuncu",
    score: visibleScore,
    realScore: player.score,
    vault: player.vault,
    online: player.online,
    lastGain: player.lastGain,
    shieldUntil: player.shieldUntil,
    shieldCharges: player.shieldCharges,
    bountyUntil: player.bountyUntil,
    cursedUntil: player.cursedUntil,
    hiddenUntil: player.hiddenUntil,
    blacklistedBy: player.blacklistedBy || [],
    insurance: player.insurance,
    title: player.title || "",
    pendingMilestone: Boolean(player.pendingMilestone)
  };
}

function getVisibleScore(player) {
  if (player.hiddenUntil && player.hiddenUntil > now()) {
    return Math.floor(player.score * 0.78);
  }

  return player.score;
}

function getTimeLeft() {
  return Math.max(0, ROUND_SECONDS - Math.floor((now() - roundStartedAt) / 1000));
}

function getState() {
  const list = sortedPlayers();
  const leader = list[0] || null;

  return {
    version: VERSION,
    players: list.map(publicPlayer),
    logs,
    winner,
    winScore: WIN_SCORE,
    roundSeconds: ROUND_SECONDS,
    timeLeft: getTimeLeft(),
    maxPlayers: MAX_ONLINE_PLAYERS,
    market: {
      id: currentMarket.id,
      title: currentMarket.title,
      desc: currentMarket.desc,
      endsIn: Math.max(0, Math.floor((marketEndsAt - now()) / 1000))
    },
    leaderId: leader ? leader.id : null,
    roundStats,
    roles
  };
}

function emitState() {
  io.emit("state", getState());
}

function emitSession(socket, player) {
  socket.emit("session", {
    token: player.token,
    name: player.name,
    role: player.role,
    playerId: player.id
  });
}

function findByToken(token) {
  if (!token) return null;
  return Object.values(players).find((player) => player.token === token);
}

function findOfflineByName(name) {
  const key = cleanName(name).toLowerCase();

  return Object.values(players).find((player) => {
    return !player.online && cleanName(player.name).toLowerCase() === key;
  });
}

function defaultPlayer(socket, payload = {}) {
  const name = cleanName(payload.name);
  const role = roles[payload.role] ? payload.role : null;

  return {
    id: socket.id,
    token: payload.token || uid(),
    name,
    role,
    score: 0,
    vault: 0,
    lastGain: 0,
    lastAction: {},
    online: true,
    connectedAt: now(),
    nextMilestones: [...MILESTONES],
    completedMilestones: [],
    pendingMilestone: null,
    shieldUntil: 0,
    shieldCharges: 0,
    cursedUntil: 0,
    bountyUntil: 0,
    hiddenUntil: 0,
    attackVulnerableUntil: 0,
    defenseBoostUntil: 0,
    riskBoostUntil: 0,
    riskPenaltyUntil: 0,
    hedgeUntil: 0,
    longUntil: 0,
    insurance: 0,
    riskScan: 0,
    noRugUntil: 0,
    badRepUntil: 0,
    title: "",
    blacklistedBy: [],
    rolePowerReadyAt: 0
  };
}

function attachPlayer(socket, payload = {}) {
  let existing = findByToken(payload.token);

  if (!existing) {
    existing = findOfflineByName(payload.name);
  }

  if (existing) {
    delete players[existing.id];

    existing.id = socket.id;
    existing.online = true;
    existing.connectedAt = now();

    if (payload.name) existing.name = cleanName(payload.name);
    if (!existing.role && roles[payload.role]) existing.role = payload.role;

    players[socket.id] = existing;

    addLog(`${existing.name} geri döndü. TREEZ bakiyesi korundu.`, true);
    emitSession(socket, existing);
    return existing;
  }

  const player = defaultPlayer(socket, payload);
  players[socket.id] = player;

  addLog(`${player.name} masaya katıldı.`, true);
  emitSession(socket, player);
  return player;
}

function canUse(player, type) {
  const cooldown = cooldowns[type] || 500;
  const current = now();

  if (player.lastAction[type] && current - player.lastAction[type] < cooldown) {
    return false;
  }

  player.lastAction[type] = current;
  return true;
}

function beforeScores() {
  const before = {};

  Object.values(players).forEach((player) => {
    before[player.id] = {
      score: player.score,
      vault: player.vault
    };
  });

  return before;
}

function updateGains(before) {
  Object.values(players).forEach((player) => {
    clampScore(player);

    const old = before[player.id]?.score || 0;
    player.lastGain = player.score - old;

    if (player.lastGain > 0) {
      if (!roundStats.biggestGain || player.lastGain > roundStats.biggestGain.amount) {
        roundStats.biggestGain = {
          name: player.name,
          amount: player.lastGain
        };
      }
    }

    if (player.lastGain < 0) {
      const loss = Math.abs(player.lastGain);

      if (!roundStats.biggestLoss || loss > roundStats.biggestLoss.amount) {
        roundStats.biggestLoss = {
          name: player.name,
          amount: loss
        };
      }
    }
  });
}

function trackAttacked(target) {
  if (!target) return;
  roundStats.mostAttacked[target.name] = (roundStats.mostAttacked[target.name] || 0) + 1;
}

function trackStolen(player, amount) {
  if (!player || amount <= 0) return;
  roundStats.mostStolen[player.name] = (roundStats.mostStolen[player.name] || 0) + amount;
}

function trackRisk(player, type) {
  roundStats.riskActions[player.name] = (roundStats.riskActions[player.name] || 0) + 1;
}

function applyMarketGain(value) {
  let multiplier = 1;

  if (currentMarket.id === "bull") multiplier *= 1.18;
  if (currentMarket.id === "bear") multiplier *= 0.82;

  return Math.floor(value * multiplier);
}

function applyRoleGain(player, value, source = "generic") {
  let multiplier = 1;

  if (player.role === "miner" && source === "mine") multiplier *= 1.28;
  if (player.role === "saboteur" && source === "mine") multiplier *= 0.88;
  if (player.role === "insurer") multiplier *= 0.93;
  if (player.role === "banker" && source === "risk") multiplier *= 0.88;
  if (player.role === "whale" && source === "risk") multiplier *= 1.12;

  if (player.riskBoostUntil > now()) multiplier *= 1.14;
  if (player.longUntil > now() && currentMarket.id === "bull") multiplier *= 1.22;
  if (player.hedgeUntil > now() && currentMarket.id === "bull") multiplier *= 0.9;

  return Math.floor(value * multiplier);
}

function calculateLoss(player, rawLoss, source = "generic") {
  let loss = rawLoss;

  if (currentMarket.id === "bear") loss *= 1.1;
  if (currentMarket.id === "liquidity" && source === "steal") loss *= 1.15;

  if (player.role === "whale" && source === "risk") loss *= 1.16;
  if (player.role === "gambler" && source === "risk") loss *= 1.15;
  if (player.riskPenaltyUntil > now()) loss *= 1.2;
  if (player.longUntil > now() && currentMarket.id === "bear") loss *= 1.25;
  if (player.hedgeUntil > now() && currentMarket.id === "bear") loss *= 0.75;
  if (player.defenseBoostUntil > now()) loss *= 0.65;
  if (player.riskScan > 0 && source === "risk") {
    loss *= 0.7;
    player.riskScan -= 1;
  }

  return Math.floor(loss);
}

function damagePlayer(target, rawAmount, source = "generic", attacker = null) {
  if (!target || target.score <= 0) return 0;

  let amount = rawAmount;

  if (target.shieldCharges > 0 && target.shieldUntil > now()) {
    const shieldPower = target.role === "thief" ? 0.45 : 0.65;
    amount = Math.floor(amount * (1 - shieldPower));
    target.shieldCharges -= 1;

    if (target.shieldCharges <= 0) {
      target.shieldUntil = 0;
    }
  }

  if (target.role === "insurer") {
    amount = Math.floor(amount * 0.9);
  }

  if (target.attackVulnerableUntil > now()) {
    amount = Math.floor(amount * 1.25);
  }

  if (target.badRepUntil > now() && attacker) {
    amount = Math.floor(amount * 1.1);
  }

  amount = calculateLoss(target, amount, source);
  amount = Math.min(target.score, Math.max(0, Math.floor(amount)));

  target.score -= amount;

  if (target.insurance > 0 && amount >= 100_000) {
    const refund = Math.floor(amount * target.insurance);
    target.score += refund;
    target.insurance = 0;
    addLog(`${target.name} sigortadan ${formatTreez(refund)} TREEZ geri aldı.`, true);
  }

  trackAttacked(target);
  return amount;
}

function chance(player, baseChance, type = "risk") {
  let value = baseChance;

  if (player.role === "gambler" && type === "risk") value += 0.04;
  if (currentMarket.id === "bull" && type === "risk") value += 0.02;
  if (currentMarket.id === "bear" && type === "risk") value -= 0.02;
  if (currentMarket.id === "memecoin" && type === "jackpot") value += 0.03;

  return Math.max(0.02, Math.min(0.95, value));
}

function checkWinner(player) {
  if (!winner && player.score >= WIN_SCORE) {
    winner = player.name;
    addLog(`${player.name} 10.000.000 TREEZ yaptı ve oyunu kazandı!`, true);
    emitState();

    setTimeout(resetRound, 8000);
  }
}

function checkTimeWinner() {
  if (winner) return;
  if (getTimeLeft() > 0) return;

  const leader = sortedPlayers()[0];

  if (leader) {
    winner = leader.name;
    addLog(`Süre bitti. ${leader.name} lider olduğu için kazandı!`, true);
  } else {
    winner = "Kimse";
    addLog("Süre bitti ama masada kazanan yok. Trajik.", true);
  }

  emitState();
  setTimeout(resetRound, 8000);
}

function resetRound(keepPlayers = true) {
  Object.values(players).forEach((player) => {
    player.score = 0;
    player.vault = 0;
    player.lastGain = 0;
    player.lastAction = {};
    player.nextMilestones = [...MILESTONES];
    player.completedMilestones = [];
    player.pendingMilestone = null;
    player.shieldUntil = 0;
    player.shieldCharges = 0;
    player.cursedUntil = 0;
    player.bountyUntil = 0;
    player.hiddenUntil = 0;
    player.attackVulnerableUntil = 0;
    player.defenseBoostUntil = 0;
    player.riskBoostUntil = 0;
    player.riskPenaltyUntil = 0;
    player.hedgeUntil = 0;
    player.longUntil = 0;
    player.insurance = 0;
    player.riskScan = 0;
    player.noRugUntil = 0;
    player.badRepUntil = 0;
    player.blacklistedBy = [];
    player.title = "";
  });

  if (!keepPlayers) {
    players = {};
  }

  winner = null;
  logs = [];
  roundStartedAt = now();
  marketEndsAt = now() + currentMarket.duration * 1000;
  lastLeaderId = null;

  roundStats = {
    biggestGain: null,
    biggestLoss: null,
    mostStolen: {},
    mostAttacked: {},
    riskActions: {},
    leaderTime: {},
    roundNumber: roundStats.roundNumber + 1
  };

  addLog(`Yeni masa başladı. ${VERSION}`, true);
  emitState();
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function createMilestoneOffer(socket, player) {
  if (!player || winner) return;

  if (player.pendingMilestone) {
    socket.emit("milestoneOffer", publicMilestoneOffer(player.pendingMilestone));
    return;
  }

  const next = player.nextMilestones[0];

  if (!next || player.score < next) return;

  const packs = milestonePacks[next];

  if (!packs) {
    player.nextMilestones.shift();
    return;
  }

  const selectedPair = pickRandom(packs);

  player.pendingMilestone = {
    milestone: next,
    options: selectedPair
  };

  player.nextMilestones.shift();
  player.completedMilestones.push(next);

  addLog(`${player.name}, ${formatTreez(next)} TREEZ eşiğine ulaştı. Kritik karar açıldı.`, true);
  socket.emit("milestoneOffer", publicMilestoneOffer(player.pendingMilestone));
  emitState();
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

function applyMilestoneOption(player, optionId) {
  const option = player.pendingMilestone?.options.find((item) => item.id === optionId);
  if (!option) return false;

  player.pendingMilestone = null;

  if (option.id === "mini_shield") {
    const cost = Math.floor(player.score * 0.06);
    player.score -= cost;
    player.shieldUntil = now() + 50_000;
    player.shieldCharges += 1;
    addLog(`${player.name}, Mini Kalkan aldı. Bedel: ${formatTreez(cost)} TREEZ.`, true);
  }

  if (option.id === "small_cash") {
    player.score += 120_000;
    player.attackVulnerableUntil = now() + 50_000;
    addLog(`${player.name}, +120K aldı ama 50 saniye hedefe dönüştü.`, true);
  }

  if (option.id === "pay_tax") {
    const cost = Math.floor(player.score * 0.1);
    player.score -= cost;
    player.defenseBoostUntil = now() + 60_000;
    addLog(`${player.name}, vergiyi ödedi. Savunması geçici güçlendi.`, true);
  }

  if (option.id === "avoid_tax") {
    player.attackVulnerableUntil = now() + 60_000;
    addLog(`${player.name}, vergiden kaçtı. 60 saniye daha savunmasız.`, true);
  }

  if (option.id === "buy_insurance") {
    const cost = Math.floor(player.score * 0.08);
    player.score -= cost;
    player.insurance = player.role === "banker" ? 0.45 : 0.35;
    addLog(`${player.name}, sigorta aldı. Bedel: ${formatTreez(cost)} TREEZ.`, true);
  }

  if (option.id === "risk_mode") {
    player.riskBoostUntil = now() + 60_000;
    player.riskPenaltyUntil = now() + 60_000;
    addLog(`${player.name}, Risk Modu açtı. Kazanç da ceza da büyüdü.`, true);
  }

  if (option.id === "lock_money") {
    const amount = Math.floor(player.score * 0.25);
    player.score -= amount;
    player.vault += amount;
    addLog(`${player.name}, ${formatTreez(amount)} TREEZ kasaya kilitledi.`, true);
  }

  if (option.id === "full_risk") {
    player.riskBoostUntil = now() + 90_000;
    player.attackVulnerableUntil = now() + 90_000;
    addLog(`${player.name}, Tam Risk seçti. Para hızlı, tokat sert.`, true);
  }

  if (option.id === "mark_leader") {
    const leader = sortedPlayers()[0];
    if (leader && leader.id !== player.id) {
      leader.bountyUntil = now() + 60_000;
      addLog(`${player.name}, lider ${leader.name} için bounty açtı.`, true);
    } else {
      player.defenseBoostUntil = now() + 45_000;
      addLog(`${player.name}, lideri işaretleyemedi. Teselli savunması aldı.`, true);
    }
  }

  if (option.id === "stay_quiet") {
    player.hiddenUntil = now() + 60_000;
    player.defenseBoostUntil = now() + 60_000;
    addLog(`${player.name}, Sessiz Kal seçti. Görünürlüğü azaldı.`, true);
  }

  if (option.id === "hedge") {
    player.hedgeUntil = now() + 90_000;
    addLog(`${player.name}, Hedge açtı. Krizlerde daha dayanıklı.`, true);
  }

  if (option.id === "long") {
    player.longUntil = now() + 90_000;
    addLog(`${player.name}, Long açtı. Boğada iyi, ayıda felaket.`, true);
  }

  if (option.id === "hidden_balance") {
    player.hiddenUntil = now() + 90_000;
    player.riskPenaltyUntil = now() + 90_000;
    addLog(`${player.name}, Gizli Bakiye açtı. Skoru düşük görünecek.`, true);
  }

  if (option.id === "show_off") {
    player.riskBoostUntil = now() + 75_000;
    player.attackVulnerableUntil = now() + 75_000;
    addLog(`${player.name}, Gösteriş Yap seçti. Herkes artık daha iştahlı.`, true);
  }

  if (option.id === "final_insurance") {
    const cost = Math.floor(player.score * 0.12);
    player.score -= cost;
    player.insurance = player.role === "banker" ? 0.65 : 0.55;
    addLog(`${player.name}, Final Sigortası aldı. Bedel ağır ama koruma güçlü.`, true);
  }

  if (option.id === "final_speed") {
    player.riskBoostUntil = now() + 100_000;
    player.riskPenaltyUntil = now() + 100_000;
    addLog(`${player.name}, Final Hızı seçti. Fren yok, airbag şüpheli.`, true);
  }

  if (option.id === "bad_reputation") {
    player.badRepUntil = now() + 100_000;
    player.riskBoostUntil = now() + 100_000;
    addLog(`${player.name}, Kötü Şöhret aldı. Saldırıları güçlendi, hedef oldu.`, true);
  }

  if (option.id === "good_reputation") {
    player.defenseBoostUntil = now() + 100_000;
    player.noRugUntil = now() + 100_000;
    addLog(`${player.name}, İtibar Kazan seçti. Savunması güçlendi, Rug Pull kilitlendi.`, true);
  }

  return true;
}

function applyRolePower(player) {
  if (!player.role) return "Önce rol seçmelisin.";
  if (player.rolePowerReadyAt && player.rolePowerReadyAt > now()) return "Rol gücü beklemede.";

  player.rolePowerReadyAt = now() + 80_000;

  if (player.role === "miner") {
    player.defenseBoostUntil = now() + 45_000;
    player.score += applyMarketGain(90_000);
    return `${player.name}, Altın Damar açtı. +90K ve savunma aldı.`;
  }

  if (player.role === "thief") {
    const targets = sortedPlayers().filter((p) => p.id !== player.id && p.score > 0).slice(0, 2);
    let total = 0;

    targets.forEach((target) => {
      const amount = damagePlayer(target, Math.floor(target.score * 0.08), "steal", player);
      total += amount;
    });

    player.score += total;
    trackStolen(player, total);
    return `${player.name}, Gece Baskını yaptı ve ${formatTreez(total)} TREEZ topladı.`;
  }

  if (player.role === "banker") {
    const amount = Math.floor(player.score * 0.16);
    player.score -= amount;
    player.vault += amount;
    player.insurance = Math.max(player.insurance, 0.4);
    return `${player.name}, Banker Kasası açtı. Para kilitlendi ve sigorta güçlendi.`;
  }

  if (player.role === "whale") {
    if (Math.random() < 0.42) {
      const gain = Math.floor(player.score * 0.25);
      player.score += gain;
      return `${player.name}, Balina Pompası tuttu. +${formatTreez(gain)} TREEZ.`;
    }

    const loss = damagePlayer(player, Math.floor(player.score * 0.18), "risk");
    return `${player.name}, Balina Pompası patladı. ${formatTreez(loss)} TREEZ gitti.`;
  }

  if (player.role === "insurer") {
    player.insurance = Math.max(player.insurance, 0.5);
    player.shieldUntil = now() + 60_000;
    player.shieldCharges += 1;
    return `${player.name}, Acil Poliçe açtı. Sigorta ve kalkan aktif.`;
  }

  if (player.role === "saboteur") {
    const leader = sortedPlayers()[0];

    if (leader && leader.id !== player.id) {
      leader.bountyUntil = now() + 70_000;
      leader.attackVulnerableUntil = now() + 45_000;
      return `${player.name}, lider ${leader.name} üstüne sabotaj emri verdi.`;
    }

    player.score += 80_000;
    return `${player.name}, lider bulamadı. Sabotaj bütçesi +80K döndü.`;
  }

  if (player.role === "gambler") {
    if (Math.random() < 0.5) {
      player.score += 200_000;
      player.riskScan += 1;
      return `${player.name}, Zar At tuttu. +200K ve risk analizi aldı.`;
    }

    const loss = damagePlayer(player, Math.floor(player.score * 0.22), "risk");
    return `${player.name}, Zar At kötü geldi. ${formatTreez(loss)} TREEZ kaybetti.`;
  }

  return "Rol gücü uygulanamadı.";
}

function runAction(socket, player, type) {
  if (!player.role && type !== "chooseRole") {
    socket.emit("needRole", { roles });
    return;
  }

  if (winner) return;

  if (player.pendingMilestone && type !== "milestoneChoice") {
    socket.emit("milestoneOffer", publicMilestoneOffer(player.pendingMilestone));
    return;
  }

  if (!canUse(player, type)) return;

  const before = beforeScores();

  if (type === "mine") {
    let gain = 36 + Math.floor(Math.random() * 28) + Math.floor(player.score * 0.0025);
    gain = applyMarketGain(gain);
    gain = applyRoleGain(player, gain, "mine");

    player.score += gain;

    // Özel istek: TREEZ Kaz masa geçmişine yazılmaz.
  }

  if (type === "greed") {
    trackRisk(player, "greed");

    if (Math.random() < chance(player, 0.61)) {
      const gain = Math.floor(player.score * 0.42) + 15_000;
      player.score += applyRoleGain(player, gain, "risk");
      addLog(`${player.name}, Katla tuttu. +${formatTreez(gain)} TREEZ.`, true);
    } else {
      const loss = damagePlayer(player, Math.floor(player.score * 0.28), "risk");
      addLog(`${player.name}, Katla patladı. ${formatTreez(loss)} TREEZ kaybetti.`, true);
    }
  }

  if (type === "mega") {
    trackRisk(player, "mega");

    if (player.score < 80_000) {
      addLog(`${player.name}, Mega Pump için en az 80K TREEZ lazım.`, false);
    } else if (Math.random() < chance(player, 0.34)) {
      let gain = Math.floor(player.score * 1.25);
      gain = applyRoleGain(player, gain, "risk");
      player.score += gain;
      addLog(`${player.name}, Mega Pump tuttu. +${formatTreez(gain)} TREEZ.`, true);
    } else {
      const loss = damagePlayer(player, Math.floor(player.score * 0.42), "risk");
      addLog(`${player.name}, Mega Pump'ta tokat yedi. ${formatTreez(loss)} TREEZ gitti.`, true);
    }
  }

  if (type === "steal") {
    const targets = sortedPlayers().filter((p) => p.id !== player.id && p.score > 0);

    if (targets.length === 0) {
      addLog(`${player.name}, çalacak hedef bulamadı.`, false);
    } else {
      const target = targets[Math.floor(Math.random() * targets.length)];

      let rate = 0.18;
      if (player.role === "thief") rate += 0.05;
      if (player.role === "saboteur" && target.id === sortedPlayers()[0]?.id) rate += 0.04;
      if (currentMarket.id === "liquidity") rate += 0.03;
      if (target.bountyUntil > now()) rate += 0.04;

      const amount = damagePlayer(target, Math.floor(target.score * rate), "steal", player);
      player.score += amount;
      trackStolen(player, amount);

      addLog(`${player.name}, ${target.name} oyuncusundan ${formatTreez(amount)} TREEZ çaldı.`, true);
    }
  }

  if (type === "tax") {
    const leader = sortedPlayers()[0];

    if (!leader || leader.score <= 0) {
      addLog(`${player.name}, vergi alınacak lider bulamadı.`, false);
    } else {
      let rate = 0.12;
      if (currentMarket.id === "taxweek") rate += 0.04;
      if (leader.bountyUntil > now()) rate += 0.03;

      const tax = damagePlayer(leader, Math.floor(leader.score * rate), "tax", player);
      const receivers = sortedPlayers().filter((p) => p.id !== leader.id);

      if (receivers.length > 0) {
        const share = Math.floor(tax / receivers.length);

        receivers.forEach((receiver) => {
          receiver.score += share;
        });

        addLog(`${player.name}, lider vergisi başlattı. ${formatTreez(tax)} TREEZ herkese bölüştü.`, true);
      }
    }
  }

  if (type === "rug") {
    if (player.noRugUntil > now()) {
      addLog(`${player.name}, itibarlı takıldığı için Rug Pull kullanamıyor.`, false);
    } else if (player.score < 120_000) {
      addLog(`${player.name}, Rug Pull için en az 120K TREEZ lazım.`, false);
    } else {
      trackRisk(player, "rug");

      if (Math.random() < chance(player, 0.28)) {
        let total = 0;

        sortedPlayers()
          .filter((victim) => victim.id !== player.id && victim.score > 0)
          .forEach((victim) => {
            const loss = damagePlayer(victim, Math.floor(victim.score * 0.25), "rug", player);
            total += Math.floor(loss * 0.32);
          });

        player.score += total;
        addLog(`${player.name}, Rug Pull yaptı. Toplam ${formatTreez(total)} TREEZ topladı.`, true);
      } else {
        const loss = damagePlayer(player, Math.floor(player.score * 0.55), "risk");
        addLog(`${player.name}, Rug Pull patlattı ama kendi yandı. ${formatTreez(loss)} TREEZ gitti.`, true);
      }
    }
  }

  if (type === "throne") {
    const leader = sortedPlayers()[0];

    if (!leader || leader.id === player.id || leader.score <= 0) {
      addLog(`${player.name}, Taht Soygunu için uygun lider bulamadı.`, false);
    } else {
      trackRisk(player, "throne");

      const throneChance = player.role === "saboteur" ? 0.42 : 0.36;

      if (Math.random() < chance(player, throneChance)) {
        const amount = damagePlayer(leader, Math.floor(leader.score * 0.38), "steal", player);
        player.score += amount;
        trackStolen(player, amount);
        addLog(`${player.name}, Taht Soygunu yaptı. ${leader.name} üzerinden ${formatTreez(amount)} TREEZ aldı.`, true);
      } else {
        const loss = damagePlayer(player, Math.floor(player.score * 0.48), "risk");
        addLog(`${player.name}, Taht Soygunu denedi ama tökezledi. ${formatTreez(loss)} TREEZ kaybetti.`, true);
      }
    }
  }

  if (type === "jackpot") {
    if (player.score < 180_000) {
      addLog(`${player.name}, Jackpot için en az 180K TREEZ lazım.`, false);
    } else {
      trackRisk(player, "jackpot");

      const jackpotChance = chance(player, 0.15, "jackpot");

      if (Math.random() < jackpotChance) {
        let gain = Math.floor(player.score * 2.3);
        if (player.role === "whale") gain = Math.floor(gain * 1.15);
        if (currentMarket.id === "memecoin") gain = Math.floor(gain * 1.22);

        player.score += gain;
        addLog(`${player.name}, JACKPOT vurdu! +${formatTreez(gain)} TREEZ.`, true);
      } else {
        let rate = currentMarket.id === "memecoin" ? 0.55 : 0.42;
        const loss = damagePlayer(player, Math.floor(player.score * rate), "risk");
        addLog(`${player.name}, Jackpot kaçtı. ${formatTreez(loss)} TREEZ gitti.`, true);
      }
    }
  }

  if (type === "shield") {
    if (player.score < SHIELD_COST) {
      addLog(`${player.name}, kalkan için 50K TREEZ bulamadı. Fakirlik yine kazandı.`, false);
    } else {
      player.score -= SHIELD_COST;

      const duration = player.role === "insurer" ? 95_000 : player.role === "thief" ? 55_000 : 75_000;
      player.shieldUntil = now() + duration;
      player.shieldCharges += 1;

      addLog(`${player.name}, 50K ödeyip kalkan aldı.`, true);
    }
  }

  if (type === "riskScan") {
    const cost = 35_000;

    if (player.score < cost) {
      addLog(`${player.name}, Risk Analizi için 35K bulamadı. Analiz pahalı, şaşırtıcı şekilde.`, false);
    } else {
      player.score -= cost;
      player.riskScan += 1;
      addLog(`${player.name}, Risk Analizi aldı. Sonraki başarısız risk cezası azalacak.`, true);
    }
  }

  if (type === "vault") {
    const amount = Math.floor(player.score * 0.18);
    const cost = Math.floor(amount * VAULT_DEPOSIT_COST_RATE);

    if (amount < 50_000 || player.score < amount + cost) {
      addLog(`${player.name}, kasaya koyacak düzgün para bulamadı.`, false);
    } else {
      player.score -= amount + cost;
      player.vault += amount;
      addLog(`${player.name}, ${formatTreez(amount)} TREEZ kasaya koydu. İşlem ücreti: ${formatTreez(cost)}.`, true);
    }
  }

  if (type === "insurance") {
    const cost = player.role === "banker" ? 55_000 : 75_000;

    if (player.score < cost) {
      addLog(`${player.name}, sigorta için yeterli TREEZ bulamadı.`, false);
    } else {
      player.score -= cost;
      player.insurance = Math.max(player.insurance, player.role === "banker" ? 0.45 : 0.35);
      addLog(`${player.name}, sigorta aldı. Sonraki büyük kayıp telafi edilecek.`, true);
    }
  }

  if (type === "blackMarket") {
    const cost = 120_000;

    if (player.score < cost) {
      addLog(`${player.name}, Kara Borsa için 120K bulamadı.`, false);
    } else {
      player.score -= cost;

      const roll = Math.random();

      if (roll < 0.34) {
        player.shieldUntil = now() + 45_000;
        player.shieldCharges += 1;
        addLog(`${player.name}, Kara Borsa'dan mini kalkan aldı.`, true);
      } else if (roll < 0.67) {
        player.riskScan += 1;
        addLog(`${player.name}, Kara Borsa'dan risk koruması aldı.`, true);
      } else {
        player.hiddenUntil = now() + 55_000;
        addLog(`${player.name}, Kara Borsa'dan gizli bakiye aldı.`, true);
      }
    }
  }

  if (type === "rolePower") {
    const message = applyRolePower(player);
    addLog(message, true);
  }

  updateGains(before);
  checkWinner(player);
  emitState();
  createMilestoneOffer(socket, player);
}

function chooseMarket() {
  currentMarket = pickRandom(marketEvents);
  marketEndsAt = now() + currentMarket.duration * 1000;

  addLog(`Piyasa değişti: ${currentMarket.title}. ${currentMarket.desc}`, true);
  emitState();
}

function tick() {
  const leader = sortedPlayers()[0];

  if (leader) {
    if (lastLeaderId !== leader.id) {
      lastLeaderId = leader.id;
    }

    roundStats.leaderTime[leader.name] = (roundStats.leaderTime[leader.name] || 0) + 1;

    if (roundStats.leaderTime[leader.name] === 70) {
      leader.bountyUntil = now() + 70_000;
      addLog(`${leader.name}, uzun süre lider kaldı. Lider laneti başladı.`, true);
    }

    if (roundStats.leaderTime[leader.name] > 130) {
      leader.attackVulnerableUntil = now() + 30_000;
    }
  }

  Object.values(players).forEach((player) => {
    if (player.role === "miner" && player.online && !winner) {
      player.score += 120;
    }

    if (player.role === "banker" && player.vault > 0 && player.online && !winner) {
      player.score += Math.floor(player.vault * 0.0005);
    }

    clampScore(player);
  });

  if (now() >= marketEndsAt) {
    chooseMarket();
  }

  checkTimeWinner();
  emitState();
}

setInterval(tick, 1000);

app.get("/reset", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.send("Yetkisiz.");

  resetRound(true);
  res.send("TREEZCOIN masa sıfırlandı.");
});

app.get("/wipe", (req, res) => {
  if (req.query.key !== ADMIN_KEY) return res.send("Yetkisiz.");

  resetRound(false);
  res.send("TREEZCOIN tüm oyuncular silindi.");
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    version: VERSION,
    online: onlineCount(),
    players: Object.keys(players).length,
    timeLeft: getTimeLeft(),
    market: currentMarket.title
  });
});

io.on("connection", (socket) => {
  if (onlineCount() >= MAX_ONLINE_PLAYERS) {
    socket.emit("roomFull");
    socket.disconnect();
    return;
  }

  let player = null;

  const fallbackTimer = setTimeout(() => {
    if (!player && socket.connected) {
      player = attachPlayer(socket, {
        name: "Player"
      });

      addLog("Hello sinyali gecikti. Oyuncu otomatik masaya alındı.", false);
      emitState();
    }
  }, 900);

  socket.on("hello", (payload) => {
    clearTimeout(fallbackTimer);

    if (player) {
      emitSession(socket, player);
      emitState();

      if (!player.role) {
        socket.emit("needRole", { roles });
      }

      createMilestoneOffer(socket, player);
      return;
    }

    player = attachPlayer(socket, payload || {});
    emitState();

    if (!player.role) {
      socket.emit("needRole", { roles });
    }

    createMilestoneOffer(socket, player);
  });

  socket.on("setName", (name) => {
    if (!player) {
      player = attachPlayer(socket, {
        name
      });
    }

    player.name = cleanName(name);
    addLog(`${player.name} ismini güncelledi.`, false);
    emitSession(socket, player);
    emitState();
  });

  socket.on("chooseRole", (roleId) => {
    if (!player) return;
    if (!roles[roleId]) return;

    if (player.role) {
      socket.emit("toast", "Rol zaten seçildi.");
      return;
    }

    player.role = roleId;
    addLog(`${player.name}, ${roles[roleId].title} rolünü seçti.`, true);
    emitSession(socket, player);
    emitState();
  });

  socket.on("action", (type) => {
    if (!player) return;
    runAction(socket, player, type);
  });

  socket.on("milestoneChoice", (optionId) => {
    if (!player) return;
    if (!player.pendingMilestone) return;

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

    if (player.name === "Player" && player.score <= 0 && player.vault <= 0 && !player.role) {
      delete players[player.id];
      addLog("İsimsiz oyuncu masadan çıktı.", false);
    } else {
      player.online = false;
      player.lastAction = {};
      addLog(`${player.name} masadan ayrıldı ama TREEZ bakiyesi kaldı.`, false);
    }

    emitState();
  });
});

addLog(`${VERSION} başlatıldı.`, true);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`${VERSION} çalışıyor: http://localhost:${PORT}`);
});
