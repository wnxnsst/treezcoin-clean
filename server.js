const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static("public"));

const WIN_SCORE = 10_000_000;
const MILLION_SCORE = 1_000_000;
const MILESTONE_STEP = 500_000;
const MAX_ONLINE_PLAYERS = 6;
const ADMIN_KEY = "1234";

const cooldowns = {
  mine: 150,
  greed: 1200,
  mega: 2500,
  steal: 3000,
  tax: 4000,
  rug: 5000,
  throne: 6000,
  jackpot: 7000
};

const players = {};
const logs = [];
let winner = null;

const safeMilestoneOptions = [
  {
    id: "safe_500k",
    title: "Güvenli Kasa",
    desc: "Anında +500.000 TREEZ alırsın. Sıkıcı ama çalışıyor."
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
  }
];

function cleanName(name) {
  return String(name || "Player")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 16) || "Player";
}

function nameKey(name) {
  return cleanName(name).toLowerCase();
}

function formatTreez(value) {
  return Math.floor(value || 0).toLocaleString("tr-TR");
}

function addLog(text) {
  logs.push(text);
  if (logs.length > 14) logs.shift();
}

function onlineCount() {
  return Object.values(players).filter((player) => player.online).length;
}

function sortedPlayers() {
  return Object.values(players).sort((a, b) => b.score - a.score);
}

function findOfflinePlayerByName(name) {
  const key = nameKey(name);

  return Object.values(players).find((player) => {
    return !player.online && nameKey(player.name) === key;
  });
}

function getState() {
  return {
    players: sortedPlayers(),
    logs,
    winner,
    winScore: WIN_SCORE,
    millionScore: MILLION_SCORE,
    milestoneStep: MILESTONE_STEP,
    maxPlayers: MAX_ONLINE_PLAYERS
  };
}

function emitState() {
  io.emit("state", getState());
}

function resetGameAfterWin() {
  Object.values(players).forEach((player) => {
    player.score = 0;
    player.lastGain = 0;
    player.lastAction = {};
    player.nextMilestone = MILESTONE_STEP;
    player.pendingMilestone = null;
  });

  winner = null;
  logs.length = 0;

  addLog("Yeni masa başladı.");
  emitState();
}

function checkWinner(player) {
  if (!winner && player.score >= WIN_SCORE) {
    winner = player.name;
    addLog(`${player.name} 10.000.000 TREEZ yaptı ve kazandı!`);

    emitState();

    setTimeout(() => {
      resetGameAfterWin();
    }, 8000);
  }
}

function canUse(player, type) {
  const now = Date.now();
  const cooldown = cooldowns[type] || 500;

  if (player.lastAction[type] && now - player.lastAction[type] < cooldown) {
    return false;
  }

  player.lastAction[type] = now;
  return true;
}

function beforeScores() {
  const before = {};

  Object.values(players).forEach((player) => {
    before[player.id] = player.score;
  });

  return before;
}

function updateGains(before) {
  Object.values(players).forEach((player) => {
    player.score = Math.max(0, Math.floor(player.score));
    player.lastGain = player.score - (before[player.id] || 0);
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
  if (!player) return;
  if (winner) return;

  if (player.pendingMilestone) {
    socket.emit("milestoneOffer", publicMilestoneOffer(player.pendingMilestone));
    return;
  }

  if (player.score < player.nextMilestone) return;

  const safeOption = pickRandom(safeMilestoneOptions);
  const riskOption = pickRandom(riskMilestoneOptions);

  player.pendingMilestone = {
    milestone: player.nextMilestone,
    options: [safeOption, riskOption]
  };

  player.nextMilestone += MILESTONE_STEP;

  addLog(`${player.name}, ${formatTreez(player.pendingMilestone.milestone)} TREEZ eşiğine ulaştı. Özel seçim açıldı.`);

  socket.emit("milestoneOffer", publicMilestoneOffer(player.pendingMilestone));
  emitState();
}

function applyMilestoneOption(player, optionId) {
  const option = player.pendingMilestone?.options.find((item) => item.id === optionId);

  if (!option) {
    return false;
  }

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

    sortedPlayers()
      .filter((target) => target.id !== player.id && target.score > 0)
      .forEach((target) => {
        const amount = Math.floor(target.score * 0.08);
        target.score -= amount;
        total += amount;
      });

    player.score += total;
    addLog(`${player.name}, Vergi İadesi seçti ve toplam ${formatTreez(total)} TREEZ topladı.`);
  }

  if (option.id === "wipe_others_25") {
    if (Math.random() < 0.25) {
      sortedPlayers()
        .filter((target) => target.id !== player.id)
        .forEach((target) => {
          target.score = 0;
        });

      addLog(`${player.name}, Kıyamet Fişi tuttu. Herkesin parası sıfırlandı.`);
    } else {
      const loss = Math.floor(player.score * 0.75);
      player.score -= loss;

      addLog(`${player.name}, Kıyamet Fişi denedi ama patladı. ${formatTreez(loss)} TREEZ kaybetti.`);
    }
  }

  if (option.id === "leader_half_38") {
    const target = sortedPlayers().find((p) => p.id !== player.id && p.score > 0);

    if (!target) {
      addLog(`${player.name}, Taht Darbesi seçti ama hedef bulamadı.`);
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

      sortedPlayers()
        .filter((target) => target.id !== player.id && target.score > 0)
        .forEach((target) => {
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
      const richerPlayers = sortedPlayers().filter((target) => {
        return target.id !== player.id && target.score > player.score;
      });

      if (richerPlayers.length === 0) {
        player.score += 250_000;
        addLog(`${player.name}, Üsttekileri Biç seçti ama üstünde kimse yoktu. Teselli +250.000 TREEZ aldı.`);
      } else {
        richerPlayers.forEach((target) => {
          const loss = Math.floor(target.score * 0.35);
          target.score -= loss;
        });

        addLog(`${player.name}, Üsttekileri Biç tuttu. Senden zengin herkes %35 kaybetti.`);
      }
    } else {
      const loss = Math.floor(player.score * 0.30);
      player.score -= loss;

      addLog(`${player.name}, Üsttekileri Biç denedi ama kendi biçildi. ${formatTreez(loss)} TREEZ kaybetti.`);
    }
  }

  return true;
}

app.get("/reset", (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.send("Yetkisiz.");
  }

  Object.values(players).forEach((player) => {
    player.score = 0;
    player.lastGain = 0;
    player.lastAction = {};
    player.nextMilestone = MILESTONE_STEP;
    player.pendingMilestone = null;
  });

  winner = null;
  logs.length = 0;

  addLog("Leaderboard temizlendi.");
  emitState();

  res.send("TREEZCOIN leaderboard temizlendi.");
});

io.on("connection", (socket) => {
  if (onlineCount() >= MAX_ONLINE_PLAYERS) {
    socket.emit("roomFull");
    socket.disconnect();
    return;
  }

  players[socket.id] = {
    id: socket.id,
    name: "Player",
    score: 0,
    lastGain: 0,
    lastAction: {},
    nextMilestone: MILESTONE_STEP,
    pendingMilestone: null,
    online: true
  };

  addLog("Yeni oyuncu masaya katıldı.");
  emitState();

  socket.on("setName", (name) => {
    let player = players[socket.id];
    if (!player) return;

    const cleaned = cleanName(name);
    const offlinePlayer = findOfflinePlayerByName(cleaned);

    if (offlinePlayer && offlinePlayer.id !== player.id) {
      const oldId = offlinePlayer.id;

      players[socket.id] = {
        ...offlinePlayer,
        id: socket.id,
        name: cleaned,
        online: true,
        lastAction: {}
      };

      delete players[oldId];

      player = players[socket.id];

      addLog(`${player.name} geri döndü. Eski TREEZ bakiyesi korundu.`);
    } else {
      player.name = cleaned;
      player.online = true;
      addLog(`${player.name} ismini kaydetti.`);
    }

    emitState();
    createMilestoneOffer(socket, player);
  });

  socket.on("action", (type) => {
    const player = players[socket.id];
    if (!player) return;
    if (winner) return;

    if (player.pendingMilestone) {
      socket.emit("milestoneOffer", publicMilestoneOffer(player.pendingMilestone));
      return;
    }

    if (!canUse(player, type)) return;

    const before = beforeScores();

    if (type === "mine") {
      const gain = 30 + Math.floor(Math.random() * 25) + Math.floor(player.score * 0.004);
      player.score += gain;
      addLog(`${player.name} TREEZ kazdı: +${formatTreez(gain)}`);
    }

    if (type === "greed") {
      if (Math.random() < 0.68) {
        player.score = Math.max(2, player.score * 2);
        addLog(`${player.name} Katla yaptı. Skor x2.`);
      } else {
        player.score = Math.floor(player.score * 0.45);
        addLog(`${player.name} Katla yaparken patladı.`);
      }
    }

    if (type === "mega") {
      if (player.score < 50) {
        addLog(`${player.name} Mega Pump için en az 50 TREEZ lazım.`);
      } else if (Math.random() < 0.44) {
        player.score *= 5;
        addLog(`${player.name} Mega Pump tuttu. Skor x5.`);
      } else {
        player.score = Math.floor(player.score * 0.15);
        addLog(`${player.name} Mega Pump'ta ağır tokat yedi.`);
      }
    }

    if (type === "steal") {
      const targets = sortedPlayers().filter((p) => p.id !== player.id && p.score > 0);

      if (targets.length === 0) {
        addLog(`${player.name} çalacak oyuncu bulamadı.`);
      } else {
        const target = targets[Math.floor(Math.random() * targets.length)];
        const amount = Math.max(1, Math.floor(target.score * 0.24));

        target.score -= amount;
        player.score += amount;

        addLog(`${player.name}, ${target.name} oyuncusundan ${formatTreez(amount)} TREEZ çaldı.`);
      }
    }

    if (type === "tax") {
      const leader = sortedPlayers()[0];

      if (!leader || leader.id === player.id || leader.score <= 0) {
        addLog(`${player.name} liderden vergi alamadı.`);
      } else {
        const amount = Math.max(1, Math.floor(leader.score * 0.18));

        leader.score -= amount;
        player.score += amount;

        addLog(`${player.name}, lider ${leader.name} oyuncusundan ${formatTreez(amount)} TREEZ vergi aldı.`);
      }
    }

    if (type === "rug") {
      if (player.score < 100) {
        addLog(`${player.name} Rug Pull için en az 100 TREEZ lazım.`);
      } else if (Math.random() < 0.38) {
        const victims = sortedPlayers().filter((p) => p.id !== player.id);

        victims.forEach((victim) => {
          const loss = Math.floor(victim.score * 0.32);
          victim.score -= loss;
          player.score += Math.floor(loss * 0.55);
        });

        addLog(`${player.name} Rug Pull yaptı. Masa yandı.`);
      } else {
        player.score = 0;
        addLog(`${player.name} Rug Pull denedi ama kendi sıfırlandı.`);
      }
    }

    if (type === "throne") {
      const leader = sortedPlayers()[0];

      if (!leader || leader.id === player.id || leader.score <= 0) {
        addLog(`${player.name} Taht Soygunu yapamadı. Zaten lider kendisi.`);
      } else if (Math.random() < 0.38) {
        const amount = Math.max(1, Math.floor(leader.score * 0.50));

        leader.score -= amount;
        player.score += amount;

        addLog(`${player.name}, lider ${leader.name} oyuncusundan ${formatTreez(amount)} TREEZ çaldı. Taht sallandı.`);
      } else {
        const loss = Math.floor(player.score * 0.75);

        player.score -= loss;

        addLog(`${player.name} Taht Soygunu denedi ama patladı. ${formatTreez(loss)} TREEZ kaybetti.`);
      }
    }

    if (type === "jackpot") {
      if (player.score < 500) {
        addLog(`${player.name} Jackpot için en az 500 TREEZ lazım.`);
      } else if (Math.random() < 0.22) {
        player.score *= 20;
        addLog(`${player.name} Jackpot vurdu. Skor x20.`);
      } else {
        player.score = Math.floor(player.score * 0.05);
        addLog(`${player.name} Jackpot kaybetti. Kasa yine kazandı.`);
      }
    }

    updateGains(before);
    checkWinner(player);
    emitState();
    createMilestoneOffer(socket, player);
  });

  socket.on("milestoneChoice", (optionId) => {
    const player = players[socket.id];
    if (!player) return;
    if (winner) return;
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
    const player = players[socket.id];

    if (!player) return;

    if (player.name === "Player" && player.score <= 0) {
      delete players[socket.id];
      addLog("İsimsiz oyuncu masadan çıktı.");
    } else {
      player.online = false;
      player.lastAction = {};
      addLog(`${player.name} masadan ayrıldı ama TREEZ bakiyesi kaldı.`);
    }

    emitState();
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`TREEZCOIN çalışıyor: http://localhost:${PORT}`);
});
