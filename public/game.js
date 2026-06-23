const socket = io();

let myToken = localStorage.getItem("treez_token") || "";
let myName = localStorage.getItem("treez_name") || "";
let myRole = localStorage.getItem("treez_role") || "";
let myPlayerId = "";
let audioContext = null;
let currentMilestoneOffer = null;
let roleLocked = false;

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

function el(id) {
  return document.getElementById(id);
}

function setStatus(text) {
  const box = el("statusBox");
  if (box) box.innerText = text;
}

function toast(text) {
  const box = el("toast");
  if (!box) return;

  box.innerText = text;
  box.classList.remove("show");
  void box.offsetWidth;
  box.classList.add("show");

  setTimeout(() => box.classList.remove("show"), 1900);
}

function sendHello() {
  socket.emit("hello", {
    token: myToken,
    name: myName || "Player",
    role: myRole || ""
  });
}

socket.on("connect", () => {
  setStatus("Online bağlandı.");
  sendHello();

  setTimeout(sendHello, 400);
  setTimeout(sendHello, 1200);
});

socket.on("disconnect", () => {
  setStatus("Bağlantı koptu.");
});

socket.on("session", (session) => {
  if (session.token) {
    myToken = session.token;
    localStorage.setItem("treez_token", myToken);
  }

  if (session.name) {
    myName = session.name;
    localStorage.setItem("treez_name", myName);

    const input = el("nameInput");
    if (input && !input.value) input.value = myName;
  }

  if (session.role) {
    myRole = session.role;
    localStorage.setItem("treez_role", myRole);
    hideRoleModal();
    roleLocked = true;
  }

  if (session.playerId) {
    myPlayerId = session.playerId;
  }
});

socket.on("toast", (message) => {
  toast(message);
});

socket.on("needRole", (payload) => {
  if (!myRole) showRoleModal(payload.roles || {});
});

function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playTone(freq, duration, type = "sine", volume = 0.08) {
  initAudio();

  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(gain);
  gain.connect(audioContext.destination);

  osc.start(now);
  osc.stop(now + duration);
}

function playCoinSound() {
  playTone(900, 0.08, "square", 0.055);
  setTimeout(() => playTone(1350, 0.08, "triangle", 0.045), 45);
}

function playRiskSound() {
  playTone(180, 0.14, "sawtooth", 0.06);
  setTimeout(() => playTone(420, 0.18, "sawtooth", 0.05), 70);
}

function playJackpotSound() {
  playTone(520, 0.08, "square", 0.06);
  setTimeout(() => playTone(780, 0.08, "square", 0.06), 80);
  setTimeout(() => playTone(1040, 0.08, "square", 0.06), 160);
  setTimeout(() => playTone(1560, 0.16, "triangle", 0.07), 240);
}

function playExplosionSound() {
  playTone(120, 0.12, "sawtooth", 0.09);
  setTimeout(() => playTone(220, 0.12, "sawtooth", 0.08), 70);
  setTimeout(() => playTone(80, 0.22, "square", 0.07), 140);
}

function setName() {
  const input = el("nameInput");
  const name = input ? input.value.trim() : "Player";

  myName = name || "Player";
  localStorage.setItem("treez_name", myName);

  socket.emit("setName", myName);
  playCoinSound();
}

function sendAction(type, event) {
  if (!myRole) {
    toast("Önce rol seç.");
    showRoleModal();
    return;
  }

  if (currentMilestoneOffer) {
    toast("Önce kritik seçimini yap.");
    playRiskSound();
    return;
  }

  const button = event.currentTarget;

  if (button.classList.contains("cooling")) {
    return;
  }

  socket.emit("action", type);

  if (type === "mine") {
    playCoinSound();
    createFloatingText(event.clientX, event.clientY, "+TREEZ");
  } else if (type === "jackpot") {
    playJackpotSound();
    createFloatingText(event.clientX, event.clientY, "JACKPOT?");
  } else {
    playRiskSound();
    createFloatingText(event.clientX, event.clientY, "RISK");
  }

  createParticles(event.clientX, event.clientY);
  startCooldown(button, cooldowns[type] || 500);
}

function startCooldown(button, duration) {
  const fill = button.querySelector(".cooldownFill");
  if (!fill) return;

  button.classList.add("cooling");

  const start = performance.now();

  function animate(current) {
    const elapsed = current - start;
    const progress = Math.min(elapsed / duration, 1);
    const remaining = 100 - progress * 100;

    fill.style.width = `${remaining}%`;

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      fill.style.width = "0%";
      button.classList.remove("cooling");
    }
  }

  fill.style.width = "100%";
  requestAnimationFrame(animate);
}

function formatScore(num) {
  return Math.floor(num || 0).toLocaleString("tr-TR");
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function createFloatingText(x, y, text) {
  const node = document.createElement("div");
  node.className = "floating";
  node.innerText = text;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;

  document.body.appendChild(node);

  setTimeout(() => node.remove(), 900);
}

function createParticles(x, y, count = 18) {
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "particle";

    const angle = Math.random() * Math.PI * 2;
    const distance = 40 + Math.random() * 70;

    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    p.style.setProperty("--y", `${Math.sin(angle) * distance}px`);

    document.body.appendChild(p);

    setTimeout(() => p.remove(), 650);
  }
}

function createExplosion(x, y) {
  for (let i = 0; i < 80; i++) {
    const p = document.createElement("div");
    p.className = "explosionParticle";

    const angle = Math.random() * Math.PI * 2;
    const distance = 80 + Math.random() * 240;

    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    p.style.setProperty("--y", `${Math.sin(angle) * distance}px`);

    document.body.appendChild(p);

    setTimeout(() => p.remove(), 1000);
  }
}

function spawnBackgroundCoin() {
  const layer = el("coinRain");
  if (!layer) return;

  const coin = document.createElement("div");
  coin.className = "bgCoin";
  coin.innerText = "T";

  const size = 20 + Math.random() * 22;

  coin.style.width = `${size}px`;
  coin.style.height = `${size}px`;
  coin.style.left = `${Math.random() * 100}%`;
  coin.style.animationDuration = `${4 + Math.random() * 5}s`;

  layer.appendChild(coin);

  setTimeout(() => coin.remove(), 9500);
}

setInterval(spawnBackgroundCoin, 500);

function showRoleModal(roles = null) {
  const modal = el("roleModal");
  const grid = el("roleGrid");
  if (!modal || !grid) return;

  if (!roles || Object.keys(roles).length === 0) {
    roles = {
      miner: { title: "Madenci", desc: "Güvenli TREEZ kasma.", plus: "Kazım güçlü.", minus: "PvP zayıf." },
      thief: { title: "Hırsız", desc: "Çalma odaklı.", plus: "Çalma güçlü.", minus: "Kalkan zayıf." },
      banker: { title: "Banker", desc: "Kasa ve sigorta.", plus: "Koruma iyi.", minus: "Risk zayıf." },
      whale: { title: "Balina", desc: "Yüksek risk.", plus: "Büyük kazanç.", minus: "Büyük kayıp." },
      insurer: { title: "Sigortacı", desc: "Hayatta kalma.", plus: "Kayıp telafisi.", minus: "Kazanç düşük." },
      saboteur: { title: "Sabotajcı", desc: "Lider avcısı.", plus: "Anti-lider.", minus: "Kazım zayıf." },
      gambler: { title: "Şansçı", desc: "Risk oyuncusu.", plus: "Şans yüksek.", minus: "Ceza sert." }
    };
  }

  grid.innerHTML = "";

  Object.values(roles).forEach((role) => {
    const button = document.createElement("button");
    button.className = "roleCard";

    button.innerHTML = `
      <strong>${role.title}</strong>
      <span>${role.desc}</span>
      <span><b>Artı:</b> ${role.plus}</span>
      <span><b>Eksi:</b> ${role.minus}</span>
    `;

    button.onclick = () => {
      myRole = role.id;
      localStorage.setItem("treez_role", myRole);
      socket.emit("chooseRole", role.id);
      hideRoleModal();
      playJackpotSound();
    };

    grid.appendChild(button);
  });

  modal.classList.add("show");
}

function hideRoleModal() {
  const modal = el("roleModal");
  if (modal) modal.classList.remove("show");
}

function showMilestoneOffer(offer) {
  currentMilestoneOffer = offer;

  const modal = el("milestoneModal");
  const title = el("milestoneTitle");
  const optionsBox = el("milestoneOptions");

  if (!modal || !title || !optionsBox) return;

  title.innerText = `${formatScore(offer.milestone)} TREEZ KRİTİK KARAR`;
  optionsBox.innerHTML = "";

  offer.options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "milestoneChoice";

    button.innerHTML = `
      <strong>${option.title}</strong>
      <span>${option.desc}</span>
    `;

    button.onclick = () => {
      socket.emit("milestoneChoice", option.id);
      currentMilestoneOffer = null;
      modal.classList.remove("show");
      playJackpotSound();
      createExplosion(window.innerWidth / 2, window.innerHeight / 2);
    };

    optionsBox.appendChild(button);
  });

  modal.classList.add("show");
  playExplosionSound();
}

socket.on("milestoneOffer", (offer) => {
  showMilestoneOffer(offer);
});

socket.on("roomFull", () => {
  document.body.innerHTML = `
    <div style="color:white;text-align:center;margin-top:120px;font-family:Arial">
      <h1>Oda Dolu</h1>
      <p>Max 6 online oyuncu girebilir.</p>
    </div>
  `;
});

function renderMoneyBoard(players) {
  const board = el("moneyBoard");
  if (!board) return;

  let html = `<div class="moneyBoardTitle">CANLI TREEZ TABLOSU</div>`;

  players.forEach((player, index) => {
    const rowClass = index === 0 ? "moneyRow leaderRow" : "moneyRow";
    const status = player.online ? "●" : "○";

    html += `
      <div class="${rowClass}">
        <span>${index + 1}. ${status} ${player.name}</span>
        <strong>${formatScore(player.score)}</strong>
      </div>
    `;
  });

  board.innerHTML = html;
}

function topEntry(obj) {
  const entries = Object.entries(obj || {});
  if (entries.length === 0) return null;

  entries.sort((a, b) => b[1] - a[1]);
  return {
    name: entries[0][0],
    value: entries[0][1]
  };
}

function renderStats(stats) {
  const box = el("statsBox");
  if (!box) return;

  const stolen = topEntry(stats.mostStolen);
  const attacked = topEntry(stats.mostAttacked);
  const risk = topEntry(stats.riskActions);
  const leader = topEntry(stats.leaderTime);

  box.innerHTML = `
    <h3>Tur İstatistikleri</h3>
    <div class="statLine"><span>Tur</span><b>${stats.roundNumber}</b></div>
    <div class="statLine"><span>En büyük kazanç</span><b>${stats.biggestGain ? `${stats.biggestGain.name} +${formatScore(stats.biggestGain.amount)}` : "-"}</b></div>
    <div class="statLine"><span>En büyük kayıp</span><b>${stats.biggestLoss ? `${stats.biggestLoss.name} -${formatScore(stats.biggestLoss.amount)}` : "-"}</b></div>
    <div class="statLine"><span>En çok çalan</span><b>${stolen ? `${stolen.name} ${formatScore(stolen.value)}` : "-"}</b></div>
    <div class="statLine"><span>En çok hedef olan</span><b>${attacked ? `${attacked.name} ${attacked.value}` : "-"}</b></div>
    <div class="statLine"><span>En riskli</span><b>${risk ? `${risk.name} ${risk.value}` : "-"}</b></div>
    <div class="statLine"><span>En uzun lider</span><b>${leader ? `${leader.name} ${leader.value}s` : "-"}</b></div>
  `;
}

socket.on("state", (state) => {
  const playersDiv = el("players");
  const logsDiv = el("logs");
  const winnerBox = el("winnerBox");
  const warningBox = el("warningBox");
  const marketBox = el("marketBox");
  const roundBox = el("roundBox");

  if (!playersDiv || !logsDiv || !winnerBox || !warningBox) return;

  if (marketBox) {
    marketBox.innerText = `${state.market.title} (${state.market.endsIn}s)`;
    marketBox.title = state.market.desc;
  }

  if (roundBox) {
    roundBox.innerText = `${formatTime(state.timeLeft)} | Oyuncu ${state.players.filter((p) => p.online).length}/${state.maxPlayers}`;
  }

  playersDiv.innerHTML = "";

  state.players.forEach((player, index) => {
    const card = document.createElement("div");

    const rankClass =
      index === 0 ? "leaderCard" :
      index === 1 ? "secondCard" :
      "";

    const offlineClass = player.online ? "" : "offlineCard";
    const selfClass = player.id === myPlayerId ? "selfCard" : "";

    card.className = `player ${rankClass} ${offlineClass} ${selfClass}`;

    const nameClass =
      index === 0 ? "fireLeader" :
      index === 1 ? "rgbRunner" :
      "normalName";

    const progress = Math.min((player.realScore / state.winScore) * 100, 100);

    const gainText = player.lastGain > 0
      ? `+${formatScore(player.lastGain)}`
      : player.lastGain < 0
        ? `${formatScore(player.lastGain)}`
        : "";

    const badges = [];

    badges.push(player.online ? "online" : "offline");
    badges.push(player.roleTitle);

    if (player.shieldCharges > 0) badges.push("kalkan");
    if (player.vault > 0) badges.push("kasa");
    if (player.insurance > 0) badges.push("sigorta");
    if (player.bountyUntil && player.bountyUntil > Date.now()) badges.push("bounty");
    if (player.hiddenUntil && player.hiddenUntil > Date.now()) badges.push("gizli");
    if (player.pendingMilestone) badges.push("karar bekliyor");

    card.innerHTML = `
      <div class="${nameClass}">${index + 1}. ${player.name}</div>
      <div>${badges.map((badge) => `<span class="badge">${badge}</span>`).join("")}</div>
      <div class="score">${formatScore(player.score)} TREEZ</div>
      <div class="vaultText">Kasa: ${formatScore(player.vault)} TREEZ</div>
      <div class="gain">${gainText}</div>
      <div class="progressWrap">
        <div class="progressFill" style="width:${progress}%"></div>
      </div>
    `;

    playersDiv.appendChild(card);
  });

  logsDiv.innerHTML = "";

  [...state.logs].reverse().forEach((log) => {
    const div = document.createElement("div");
    div.className = log.important ? "log important" : "log";
    div.innerText = `[${log.time}] ${log.text}`;
    logsDiv.appendChild(div);
  });

  renderMoneyBoard(state.players);
  renderStats(state.roundStats);

  if (state.winner) {
    winnerBox.innerText = `${state.winner} KAZANDI! Yeni masa birazdan başlar.`;
  } else {
    winnerBox.innerText = "";
  }

  warningBox.innerText = `Milestone: 500K / 2M / 5M | Jackpot oranı %15 | Kalkan 50K | Lider vergisi herkese bölüşür.`;
});
