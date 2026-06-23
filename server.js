const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const WIN_SCORE = 10_000_000;
const MILLION_SCORE = 1_000_000;
const MAX_PLAYERS = 6;

const cooldowns = {
  mine: 150,
  greed: 1200,
  mega: 2500,
  steal: 3000,
  tax: 4000,
  rug: 5000,
  jackpot: 7000
};

const players = {};
const logs = [];
let winner = null;

function cleanName(name) {
  return String(name || "Player")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 16) || "Player";
}

function addLog(text) {
  logs.push(text);
  if (logs.length > 12) logs.shift();
}

function sortedPlayers() {
  return Object.values(players).sort((a, b) => b.score - a.score);
}

function getState() {
  return {
    players: sortedPlayers(),
    logs,
    winner,
    winScore: WIN_SCORE,
    millionScore: MILLION_SCORE,
    maxPlayers: MAX_PLAYERS
  };
}

function emitState() {
  io.emit("state", getState());
}

function checkWinner(player) {
  if (!winner && player.score >= WIN_SCORE) {
    winner = player.name;
    addLog(`${player.name} 10.000.000 TREEZ yaptı ve kazandı!`);
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

io.on("connection", (socket) => {
  if (Object.keys(players).length >= MAX_PLAYERS) {
    socket.emit("roomFull");
    socket.disconnect();
    return;
  }

  players[socket.id] = {
    id: socket.id,
    name: "Player",
    score: 0,
    lastGain: 0,
    lastAction: {}
  };

  addLog("Yeni oyuncu masaya katıldı.");
  emitState();

  socket.on("setName", (name) => {
    const player = players[socket.id];
    if (!player) return;

    player.name = cleanName(name);
    addLog(`${player.name} ismini kaydetti.`);
    emitState();
  });

  socket.on("action", (type) => {
    const player = players[socket.id];
    if (!player) return;
    if (winner) return;
    if (!canUse(player, type)) return;

    const before = beforeScores();

    if (type === "mine") {
      const gain = 30 + Math.floor(Math.random() * 25) + Math.floor(player.score * 0.004);
      player.score += gain;
      addLog(`${player.name} TREEZ kazdı: +${gain}`);
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

        addLog(`${player.name}, ${target.name} oyuncusundan ${amount} TREEZ çaldı.`);
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

        addLog(`${player.name}, lider ${leader.name} oyuncusundan ${amount} TREEZ vergi aldı.`);
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
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    addLog("Bir oyuncu masadan çıktı.");
    emitState();
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`TREEZCOIN çalışıyor: http://localhost:${PORT}`);
});