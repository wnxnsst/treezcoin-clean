const socket = io({
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 2500,
  timeout: 20000
});

const STORAGE_TOKEN = "treezcoinPlayerTokenV3";
const STORAGE_NAME = "treezcoinPlayerNameV3";
const MILLION_EVENT_SCORE = 1_000_000;
const celebratedMillionPlayers = new Set();

let audioContext = null;
let currentMilestoneOffer = null;
let latestState = null;
let myPlayerId = null;
let myToken = localStorage.getItem(STORAGE_TOKEN) || "";
let myName = localStorage.getItem(STORAGE_NAME) || "Player";
let cooldowns = {};
let costs = {};

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatScore(num) {
  return Math.floor(num || 0).toLocaleString("tr-TR");
}

function formatMs(ms) {
  return Math.max(0, Math.ceil(ms / 1000));
}

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function setStatus(text) {
  const statusBox = $("statusBox");
  if (statusBox) statusBox.innerText = text;
}

function toast(text, type = "info") {
  const wrap = $("toastWrap");
  if (!wrap) return;

  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerText = text;
  wrap.appendChild(el);

  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(10px)";
    el.style.transition = "0.18s";
  }, 2800);

  setTimeout(() => el.remove(), 3200);
}

function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playTone(freq, duration, type = "sine", volume = 0.08) {
  try {
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
  } catch (error) {
    // Tarayıcı ses izni vermediyse sessizce geç. İnsanlık bir kere daha izin ekranına yenildi.
  }
}

function playCoinSound() {
  playTone(900, 0.08, "square", 0.055);
  setTimeout(() => playTone(1350, 0.08, "triangle", 0.045), 45);
  setTimeout(() => playTone(1800, 0.06, "sine", 0.035), 90);
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
  setTimeout(() => playTone(900, 0.08, "triangle", 0.06), 230);
}

function createFloatingText(x, y, text) {
  const el = document.createElement("div");
  el.className = "floating";
  el.innerText = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

function createParticles(x, y, count = 20) {
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
  for (let i = 0; i < 90; i++) {
    const p = document.createElement("div");
    p.className = "explosionParticle";

    const angle = Math.random() * Math.PI * 2;
    const distance = 80 + Math.random() * 260;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    p.style.setProperty("--y", `${Math.sin(angle) * distance}px`);

    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1000);
  }
}

function triggerMegaEvent(text) {
  const box = $("megaEvent");
  if (!box) return;

  box.innerHTML = text;
  box.classList.remove("show");
  void box.offsetWidth;
  box.classList.add("show");
  document.body.classList.add("screenShake");
  playExplosionSound();
  createExplosion(window.innerWidth / 2, window.innerHeight / 2);

  setTimeout(() => {
    box.classList.remove("show");
    document.body.classList.remove("screenShake");
  }, 1500);
}

function spawnBackgroundCoin() {
  const layer = $("coinRain");
  if (!layer) return;

  const coin = document.createElement("div");
  coin.className = "bgCoin";
  coin.innerText = "T";

  const size = 22 + Math.random() * 24;
  coin.style.width = `${size}px`;
  coin.style.height = `${size}px`;
  coin.style.left = `${Math.random() * 100}%`;
  coin.style.animationDuration = `${4 + Math.random() * 5}s`;

  layer.appendChild(coin);
  setTimeout(() => coin.remove(), 9500);
}

setInterval(spawnBackgroundCoin, 450);

function getMyPlayer() {
  if (!latestState) return null;
  return latestState.players.find((player) => player.id === myPlayerId) || null;
}

function setName() {
  const input = $("nameInput");
  const name = input ? input.value.trim() : "Player";
  myName = name || "Player";
  localStorage.setItem(STORAGE_NAME, myName);
  socket.emit("setName", myName);
  playCoinSound();
}

function setActionsLocked(locked) {
  document.querySelectorAll(".actionBtn").forEach((button) => {
    button.classList.toggle("locked", locked);
  });
}

function sendAction(type, event) {
  if (currentMilestoneOffer) {
    toast("Önce özel seçimini yap.", "warn");
    createFloatingText(window.innerWidth / 2, window.innerHeight / 2, "SEÇİM YAP");
    playRiskSound();
    return;
  }

  const button = event.currentTarget;
  if (button.classList.contains("cooling") || button.classList.contains("locked")) return;

  socket.emit("action", type);

  if (type === "mine") {
    playCoinSound();
    createFloatingText(event.clientX, event.clientY, "+TREEZ");
  } else if (type === "jackpot") {
    playJackpotSound();
    createFloatingText(event.clientX, event.clientY, "JACKPOT?");
  } else if (["shield", "focus"].includes(type)) {
    playCoinSound();
    createFloatingText(event.clientX, event.clientY, "BOOST");
  } else {
    playRiskSound();
    createFloatingText(event.clientX, event.clientY, "RISK");
  }

  createParticles(event.clientX, event.clientY);
  startCooldown(button, cooldowns[type] || 700);
}

function startCooldown(button, duration) {
  const fill = button.querySelector(".cooldownFill");
  if (!fill) return;

  button.classList.add("cooling");
  const start = performance.now();

  function animate(now) {
    const elapsed = now - start;
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

function effectBadge(label, remaining) {
  return `<span class="effectBadge">${label}: ${remaining}s</span>`;
}

function updateMyCard() {
  const player = getMyPlayer();
  const nameEl = $("myName");
  const scoreEl = $("myScore");
  const effectsEl = $("effectRow");

  if (!player) {
    if (nameEl) nameEl.innerText = myName || "Player";
    if (scoreEl) scoreEl.innerText = "0";
    if (effectsEl) effectsEl.innerHTML = "";
    return;
  }

  if (nameEl) nameEl.innerText = player.name;
  if (scoreEl) scoreEl.innerText = formatScore(player.score);

  if (effectsEl) {
    const now = Date.now();
    const parts = [];
    if (player.shieldUntil > now) parts.push(effectBadge("Kalkan", formatMs(player.shieldUntil - now)));
    if (player.focusUntil > now) parts.push(effectBadge("Focus", formatMs(player.focusUntil - now)));
    if (player.pending) parts.push(`<span class="effectBadge">Seçim bekliyor</span>`);
    effectsEl.innerHTML = parts.join("") || `<span class="effectBadge">Efekt yok</span>`;
  }
}

function updateMoneyBoard(players) {
  const board = $("moneyBoard");
  if (!board) return;

  let html = "";

  players.forEach((player, index) => {
    const rowClass = index === 0 ? "moneyRow leaderRow" : "moneyRow";
    const nameClass = index === 0 ? "fireLeader" : index === 1 ? "rgbRunner" : "normalName";
    const status = player.online ? "●" : "○";
    const mine = player.id === myPlayerId ? " sen" : "";

    html += `
      <div class="${rowClass}">
        <span class="${nameClass}">${index + 1}. ${status} ${escapeHtml(player.name)}${mine}</span>
        <strong>${formatScore(player.score)}</strong>
      </div>
    `;
  });

  board.innerHTML = html || `<div class="moneyRow">Oyuncu yok</div>`;
}

function updatePlayers(players, state) {
  const playersDiv = $("players");
  if (!playersDiv) return;
  playersDiv.innerHTML = "";

  players.forEach((player, index) => {
    const card = document.createElement("div");

    const rankClass = index === 0 ? "leaderCard" : index === 1 ? "secondCard" : "";
    const offlineClass = player.online ? "" : "offlineCard";
    const mineClass = player.id === myPlayerId ? "mineCard" : "";
    card.className = `player ${rankClass} ${offlineClass} ${mineClass}`;

    const nameClass = index === 0 ? "fireLeader" : index === 1 ? "rgbRunner" : "normalName";
    const progress = Math.min((player.score / state.winScore) * 100, 100);
    const gainText = player.lastGain > 0 ? `+${formatScore(player.lastGain)}` : player.lastGain < 0 ? `${formatScore(player.lastGain)}` : "";

    const badges = [];
    badges.push(player.online ? `<span class="badge onlineBadge">online</span>` : `<span class="badge offlineBadge">offline</span>`);
    if (player.pending) badges.push(`<span class="badge pendingBadge">seçim</span>`);
    if (player.shieldUntil > Date.now()) badges.push(`<span class="badge pendingBadge">kalkan</span>`);
    if (player.focusUntil > Date.now()) badges.push(`<span class="badge pendingBadge">focus</span>`);

    card.innerHTML = `
      <div class="playerTop">
        <div class="${nameClass}">${index + 1}. ${escapeHtml(player.name)}</div>
        <div>${badges.join(" ")}</div>
      </div>
      <div class="score">${formatScore(player.score)} TREEZ</div>
      <div class="gain">${gainText}</div>
      <div class="progressWrap"><div class="progressFill" style="width:${progress}%"></div></div>
    `;

    playersDiv.appendChild(card);

    if (player.score >= MILLION_EVENT_SCORE && !celebratedMillionPlayers.has(player.id)) {
      celebratedMillionPlayers.add(player.id);
      triggerMegaEvent(`${escapeHtml(player.name)}<br>1.000.000 TREEZ!`);
    }

    if (player.score < MILLION_EVENT_SCORE && celebratedMillionPlayers.has(player.id)) {
      celebratedMillionPlayers.delete(player.id);
    }
  });
}

function updateLogs(logs) {
  const logsDiv = $("logs");
  if (!logsDiv) return;

  logsDiv.innerHTML = "";

  [...logs].reverse().forEach((log) => {
    const div = document.createElement("div");
    div.className = `log ${log.important ? "important" : ""}`;
    div.innerText = log.text || String(log);
    logsDiv.appendChild(div);
  });
}

function updateMarket(state) {
  const title = $("marketTitle");
  const desc = $("marketDesc");

  if (title) title.innerText = state.marketEvent?.title || "Piyasa sakin";
  if (desc) desc.innerText = state.marketEvent?.desc || "Henüz gariplik yok. Bu zaten garip.";
}

function updateHeader(state) {
  const onlineBox = $("onlineBox");
  const timerBox = $("timerBox");
  const winnerBox = $("winnerBox");

  if (onlineBox) onlineBox.innerText = `${state.onlineCount}/${state.maxPlayers}`;
  if (timerBox) timerBox.innerText = formatTime(state.roundRemaining);

  if (winnerBox) {
    if (state.winner) {
      winnerBox.classList.add("show");
      winnerBox.innerText = `${state.winner} KAZANDI! Yeni masa birkaç saniye içinde başlar.`;
      setActionsLocked(true);
    } else {
      winnerBox.classList.remove("show");
      winnerBox.innerText = "";
      setActionsLocked(Boolean(currentMilestoneOffer));
    }
  }
}

function showMilestoneOffer(offer) {
  currentMilestoneOffer = offer;
  setActionsLocked(true);

  const modal = $("milestoneModal");
  const title = $("milestoneTitle");
  const optionsBox = $("milestoneOptions");

  if (!modal || !title || !optionsBox) return;

  title.innerText = `${formatScore(offer.milestone)} TREEZ EŞİĞİ!`;
  optionsBox.innerHTML = "";

  offer.options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "milestoneChoice";
    button.innerHTML = `
      <strong>${escapeHtml(option.title)}</strong>
      <span>${escapeHtml(option.desc)}</span>
    `;

    button.onclick = () => {
      socket.emit("milestoneChoice", option.id);
      currentMilestoneOffer = null;
      setActionsLocked(false);
      modal.classList.remove("show");
      playJackpotSound();
      createExplosion(window.innerWidth / 2, window.innerHeight / 2);
    };

    optionsBox.appendChild(button);
  });

  modal.classList.add("show");
  playExplosionSound();
}

function sendHello() {
  socket.emit("hello", {
    token: myToken,
    name: myName
  });
}

socket.on("connect", () => {
  setStatus("Online bağlandı.");

  sendHello();

  setTimeout(() => {
    sendHello();
  }, 400);

  setTimeout(() => {
    sendHello();
  }, 1200);
});

socket.on("disconnect", () => {
  setStatus("Bağlantı koptu. Yeniden bağlanıyor...");
});

socket.on("connect_error", () => {
  setStatus("Bağlanamadı. Sunucu uyanıyor olabilir.");
});

socket.on("session", (session) => {
  myToken = session.token;
  myPlayerId = session.playerId;
  myName = session.name;
  localStorage.setItem(STORAGE_TOKEN, myToken);
  localStorage.setItem(STORAGE_NAME, myName);

  const input = $("nameInput");
  if (input && (!input.value || input.value === "Player")) input.value = myName;
});

socket.on("toast", (payload) => {
  toast(payload.text, payload.type);
});

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

socket.on("tick", (tick) => {
  const timerBox = $("timerBox");
  if (timerBox) timerBox.innerText = formatTime(tick.roundRemaining);

  if (latestState) {
    latestState.roundRemaining = tick.roundRemaining;
    latestState.marketEvent = tick.marketEvent;
    updateMarket(latestState);
    updateMyCard();
  }
});

socket.on("state", (state) => {
  latestState = state;
  cooldowns = state.cooldowns || cooldowns;
  costs = state.costs || costs;

  updateHeader(state);
  updateMarket(state);
  updateMoneyBoard(state.players || []);
  updatePlayers(state.players || [], state);
  updateLogs(state.logs || []);
  updateMyCard();
});

window.addEventListener("beforeunload", () => {
  localStorage.setItem(STORAGE_TOKEN, myToken || "");
  localStorage.setItem(STORAGE_NAME, myName || "Player");
});
