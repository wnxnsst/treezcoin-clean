const socket = io({
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 3500,
  timeout: 7000
});

let myToken = localStorage.getItem("treez_token");
let myName = localStorage.getItem("treez_name") || "Player";
let myCompany = localStorage.getItem("treez_company") || "";
let myRole = localStorage.getItem("treez_role");
let myPlayerId = "";
let audioContext = null;
let currentDecision = null;
let latestState = null;

const cooldowns = {
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
  evadeRegulator: 18000,
  targetPressure: 12500,
  sectorDamage: 15000
};

function el(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
    company: myCompany || "",
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
  setStatus("Bağlantı koptu. Socket.IO tekrar deniyor.");
});

socket.io.on("reconnect", () => {
  setStatus("Tekrar bağlandı.");
  sendHello();
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
  if (session.company) {
    myCompany = session.company;
    localStorage.setItem("treez_company", myCompany);
    const input = el("companyInput");
    if (input && !input.value) input.value = myCompany;
  }
  if (session.role) {
    myRole = session.role;
    localStorage.setItem("treez_role", myRole);
    hideRoleModal();
  }
  if (session.playerId) myPlayerId = session.playerId;
});

socket.on("toast", (message) => toast(message));

socket.on("needRole", (payload) => {
  if (!myRole) showRoleModal(payload?.roles || []);
});

socket.on("decisionOffer", (offer) => {
  showDecisionOffer(offer);
});

socket.on("roomFull", () => {
  document.body.innerHTML = `
    <div style="color:white;text-align:center;margin-top:120px;font-family:Arial">
      <h1>Oda Dolu</h1>
      <p>Max 6 online oyuncu girebilir.</p>
    </div>
  `;
});

function initAudio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
  } catch (err) {
    // Ses engellenirse oyunu çökertmeyelim. İnsan kulağı bu kadar merkezi olmamalı.
  }
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

function setProfile() {
  const nameInput = el("nameInput");
  const companyInput = el("companyInput");
  const name = (nameInput?.value || "Player").trim() || "Player";
  const company = (companyInput?.value || `${name} CAPITAL`).trim() || `${name} CAPITAL`;

  myName = name;
  myCompany = company.toUpperCase();
  localStorage.setItem("treez_name", myName);
  localStorage.setItem("treez_company", myCompany);

  socket.emit("setProfile", { name: myName, company: myCompany });
  playCoinSound();
}

function setName() {
  setProfile();
}

function sendAction(type, event) {
  if (!myRole) {
    toast("Önce rol seç.");
    showRoleModal();
    return;
  }
  if (currentDecision) {
    toast("Önce şirket kararını seç.");
    playRiskSound();
    return;
  }

  const button = event?.currentTarget;
  if (button && button.classList.contains("cooling")) return;

  socket.emit("action", type);

  const x = event?.clientX || window.innerWidth / 2;
  const y = event?.clientY || window.innerHeight / 2;

  if (type === "mine") {
    playCoinSound();
    createFloatingText(x, y, "+TREEZ");
  } else if (type === "jackpot") {
    playJackpotSound();
    createFloatingText(x, y, "JACKPOT");
  } else if (["rug", "leverage", "sector", "rolePower"].includes(type)) {
    playExplosionSound();
    createFloatingText(x, y, "HAMLE");
  } else {
    playRiskSound();
    createFloatingText(x, y, "RISK");
  }

  createParticles(x, y);
  if (button) startCooldown(button, cooldowns[type] || 900);
}

function selectedTargetId() {
  return el("targetCompanySelect")?.value || "leader";
}

function selectedSectorId() {
  return el("targetSectorSelect")?.value || "";
}

function sendTargetAction(type, event) {
  if (!myRole) {
    toast("Önce rol seç.");
    showRoleModal();
    return;
  }
  if (currentDecision) {
    toast("Önce şirket kararını seç.");
    playRiskSound();
    return;
  }

  const button = event?.currentTarget;
  if (button && button.classList.contains("cooling")) return;

  const payload = {
    type,
    targetId: selectedTargetId(),
    sectorId: selectedSectorId()
  };

  if (type === "targetPressure" && !payload.targetId) {
    toast("Önce hedef şirket seç.");
    return;
  }
  if (type === "sectorDamage" && !payload.sectorId) {
    toast("Önce hedef sektör seç.");
    return;
  }

  socket.emit("targetAction", payload);

  const x = event?.clientX || window.innerWidth / 2;
  const y = event?.clientY || window.innerHeight / 2;
  playExplosionSound();
  createFloatingText(x, y, type === "targetPressure" ? "BASKI" : "SABOTAJ");
  createParticles(x, y, 24);
  if (button) startCooldown(button, cooldowns[type] || 12000);
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
  if (num === null || num === undefined) return "GİZLİ";
  return Math.floor(num || 0).toLocaleString("tr-TR");
}

function formatTime(seconds) {
  const m = Math.floor((seconds || 0) / 60);
  const s = (seconds || 0) % 60;
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

function screenShake() {
  document.body.classList.remove("screenShake");
  void document.body.offsetWidth;
  document.body.classList.add("screenShake");
  setTimeout(() => document.body.classList.remove("screenShake"), 420);
}

function spawnBackgroundCoin() {
  const layer = el("coinRain");
  if (!layer) return;
  const coin = document.createElement("div");
  coin.className = "bgCoin";
  coin.innerText = "T";
  const size = 18 + Math.random() * 24;
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

  if (!roles || !roles.length) {
    roles = [
      { id: "miner", title: "Madenci", desc: "Güvenli TREEZ kasma.", plus: "Maden güçlü.", minus: "PvP zayıf." },
      { id: "thief", title: "Hırsız", desc: "Çalma odaklı.", plus: "Darknet güçlü.", minus: "Isı yüksek." },
      { id: "banker", title: "Banker", desc: "Kasa ve sigorta.", plus: "Banka güçlü.", minus: "Risk zayıf." },
      { id: "whale", title: "Balina", desc: "Yüksek risk.", plus: "Kaldıraç güçlü.", minus: "Likidasyon sert." },
      { id: "insurer", title: "Sigortacı", desc: "Savunma.", plus: "Krizlere dayanır.", minus: "Kazanç düşük." },
      { id: "saboteur", title: "Sabotajcı", desc: "Lider avcısı.", plus: "Saray güçlü.", minus: "Kazım zayıf." },
      { id: "gambler", title: "Şansçı", desc: "Risk oyuncusu.", plus: "Sürpriz güçlü.", minus: "Ceza sert." }
    ];
  }

  grid.innerHTML = "";
  roles.forEach((role) => {
    const button = document.createElement("button");
    button.className = "roleCard";
    button.innerHTML = `
      <strong>${escapeHtml(role.title)}</strong>
      <span>${escapeHtml(role.desc)}</span>
      <span><b>Artı:</b> ${escapeHtml(role.plus)}</span>
      <span><b>Eksi:</b> ${escapeHtml(role.minus)}</span>
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

function showDecisionOffer(offer) {
  currentDecision = offer;
  const modal = el("decisionModal");
  const title = el("decisionTitle");
  const desc = el("decisionDesc");
  const optionsBox = el("decisionOptions");
  if (!modal || !title || !desc || !optionsBox) return;

  title.innerText = offer.title || "Şirket Kararı";
  desc.innerText = offer.desc || "Seç ve sonuçlarına katlan. Basit ama insanlık için zor.";
  optionsBox.innerHTML = "";

  (offer.options || []).forEach((option) => {
    const button = document.createElement("button");
    button.className = "decisionChoice";
    button.innerHTML = `
      <strong>${escapeHtml(option.title)}</strong>
      <span>${escapeHtml(option.desc)}</span>
    `;
    button.onclick = () => {
      socket.emit("decisionChoice", { type: offer.type, choiceId: option.id });
      currentDecision = null;
      modal.classList.remove("show");
      playJackpotSound();
      createExplosion(window.innerWidth / 2, window.innerHeight / 2);
    };
    optionsBox.appendChild(button);
  });

  modal.classList.add("show");
  playExplosionSound();
}

function renderSectors(state) {
  const grid = el("sectorGrid");
  if (!grid) return;
  grid.innerHTML = "";
  (state.sectors || []).forEach((sector) => {
    const card = document.createElement("div");
    const ownedByMe = sector.owner === myPlayerId;
    card.className = `sectorCard ${ownedByMe ? "ownedByMe" : ""}`;
    card.innerHTML = `
      <div class="sectorIcon">${escapeHtml(sector.icon)}</div>
      <div class="sectorTitle">${escapeHtml(sector.title)}</div>
      <div class="sectorOwner">Sahip: ${escapeHtml(sector.ownerName || "Boş")}</div>
      <div class="sectorDesc">${escapeHtml(sector.desc)}</div>
    `;
    grid.appendChild(card);
  });
}

function badge(text, type = "") {
  return `<span class="badge ${type}">${escapeHtml(text)}</span>`;
}

function renderPlayers(state) {
  const playersDiv = el("players");
  if (!playersDiv) return;
  playersDiv.innerHTML = "";

  (state.players || []).forEach((player, index) => {
    const card = document.createElement("div");
    const rankClass = index === 0 ? "leaderCard" : index === 1 ? "secondCard" : "";
    const nameClass = index === 0 ? "fireLeader" : index === 1 ? "rgbRunner" : "normalName";
    const offlineClass = player.online ? "" : "offlineCard";
    const selfClass = player.id === myPlayerId ? "selfCard" : "";
    const heatClass = (player.heat || 0) >= 76 ? "redHeat" : "";
    const leverageClass = player.leverageActive ? "leverageOn" : "";
    card.className = `player ${rankClass} ${offlineClass} ${selfClass} ${heatClass} ${leverageClass}`;

    const scoreVisible = player.score !== null && player.score !== undefined;
    const progressScore = player.realScore || 0;
    const progress = Math.min((progressScore / state.winScore) * 100, 100);
    const heatValue = player.heat ?? 0;
    const repValue = player.reputation ?? 0;
    const gainText = player.lastGain > 0 ? `+${formatScore(player.lastGain)}` : player.lastGain < 0 ? `-${formatScore(Math.abs(player.lastGain))}` : "";

    const badges = [];
    badges.push(badge(player.online ? "online" : "offline", player.online ? "good" : ""));
    badges.push(badge(player.roleTitle || "Rolsüz"));
    if (player.heatTitle) badges.push(badge(player.heatTitle, heatValue >= 51 ? "hot" : "good"));
    if (player.shieldCharges > 0) badges.push(badge(`kalkan ${player.shieldCharges}`, "good"));
    if (player.riskAnalysisCharges > 0) badges.push(badge(`analiz ${player.riskAnalysisCharges}`, "good"));
    if (player.insurance > 0) badges.push(badge("sigorta", "good"));
    if (player.ownedSectors?.length) badges.push(badge(`sektör ${player.ownedSectors.length}`, "good"));
    if (player.bounty) badges.push(badge("bounty", "hot"));
    if (player.hidden) badges.push(badge("gizli"));
    if (player.liquidated) badges.push(badge("likide", "hot"));
    if (player.pendingMilestone) badges.push(badge("karar", "hot"));

    const pathText = player.companyPathTitle || "Yol yok";
    const levelText = player.developmentLevel ? `Lv.${player.developmentLevel}` : "";
    const compactBadges = badges.slice(0, 6).join("");

    card.innerHTML = `
      <div class="playerHeader">
        <div class="playerIdentity">
          <div class="${nameClass} playerName">${index + 1}. ${escapeHtml(player.name)}</div>
          <div class="companyName">${escapeHtml(player.company || "ŞİRKET YOK")}</div>
        </div>
        <div class="rankPill">#${index + 1}</div>
      </div>

      <div class="badgeLine">${compactBadges}</div>

      <div class="playerMoneyRow">
        <div class="score">${scoreVisible ? formatScore(player.score) : "GİZLİ"} TREEZ</div>
        <div class="vaultText">Kasa ${formatScore(player.vault)}</div>
      </div>

      <div class="playerMetaRow">
        <span>${escapeHtml(pathText)} ${escapeHtml(levelText)}</span>
        <span>Isı ${player.heat === null ? "?" : heatValue}</span>
        <span>İtibar ${player.reputation === null ? "?" : repValue}</span>
      </div>

      <div class="compactBars">
        <div class="barLine compact">
          <div class="barLabel"><span>10M</span><b>${Math.floor(progress)}%</b></div>
          <div class="barWrap"><div class="barFill progressFill" style="width:${progress}%"></div></div>
        </div>
        <div class="barLine compact">
          <div class="barLabel"><span>Isı</span><b>${player.heat === null ? "?" : heatValue}</b></div>
          <div class="barWrap"><div class="barFill heatFill" style="width:${heatValue}%"></div></div>
        </div>
        <div class="barLine compact">
          <div class="barLabel"><span>İtibar</span><b>${player.reputation === null ? "?" : repValue}</b></div>
          <div class="barWrap"><div class="barFill repFill" style="width:${repValue}%"></div></div>
        </div>
      </div>

      <div class="gain">${gainText}</div>
    `;
    playersDiv.appendChild(card);
  });
}

function renderMoneyBoard(players) {
  const board = el("moneyBoard");
  if (!board) return;
  let html = `<div class="moneyBoardTitle">CANLI TREEZ TABLOSU</div>`;
  (players || []).forEach((player, index) => {
    const rowClass = index === 0 ? "moneyRow leaderRow" : "moneyRow";
    const status = player.online ? "●" : "○";
    html += `
      <div class="${rowClass}">
        <span>${index + 1}. ${status} ${escapeHtml(player.name)}</span>
        <strong>${formatScore(player.score)}</strong>
      </div>
    `;
  });
  board.innerHTML = html;
}

function topEntry(obj) {
  const entries = Object.entries(obj || {});
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return { name: entries[0][0], value: entries[0][1] };
}

function renderStats(stats) {
  const box = el("statsBox");
  if (!box) return;
  const stolen = topEntry(stats?.mostStolen);
  const attacked = topEntry(stats?.mostAttacked);
  const risk = topEntry(stats?.riskActions);
  const leader = topEntry(stats?.leaderTime);
  const sector = topEntry(stats?.sectorTakeovers);
  const liq = topEntry(stats?.liquidations);
  const reg = topEntry(stats?.regulatorHits);

  box.innerHTML = `
    <div class="panelTitle">TUR İSTATİSTİKLERİ</div>
    <div class="statLine"><span>Tur</span><b>${stats?.roundNumber || 1}</b></div>
    <div class="statLine"><span>En büyük kazanç</span><b>${stats?.biggestGain ? `${escapeHtml(stats.biggestGain.name)} +${formatScore(stats.biggestGain.amount)}` : "-"}</b></div>
    <div class="statLine"><span>En büyük kayıp</span><b>${stats?.biggestLoss ? `${escapeHtml(stats.biggestLoss.name)} -${formatScore(stats.biggestLoss.amount)}` : "-"}</b></div>
    <div class="statLine"><span>En çok çalan</span><b>${stolen ? `${escapeHtml(stolen.name)} ${formatScore(stolen.value)}` : "-"}</b></div>
    <div class="statLine"><span>En çok hedef olan</span><b>${attacked ? `${escapeHtml(attacked.name)} ${attacked.value}` : "-"}</b></div>
    <div class="statLine"><span>En riskli</span><b>${risk ? `${escapeHtml(risk.name)} ${risk.value}` : "-"}</b></div>
    <div class="statLine"><span>En uzun lider</span><b>${leader ? `${escapeHtml(leader.name)} ${leader.value}s` : "-"}</b></div>
    <div class="statLine"><span>Sektör fatihi</span><b>${sector ? `${escapeHtml(sector.name)} ${sector.value}` : "-"}</b></div>
    <div class="statLine"><span>Likidasyon</span><b>${liq ? `${escapeHtml(liq.name)} ${liq.value}` : "-"}</b></div>
    <div class="statLine"><span>Regülatör kurbanı</span><b>${reg ? `${escapeHtml(reg.name)} ${reg.value}` : "-"}</b></div>
    <div class="statLine"><span>Hedef baskısı</span><b>${topEntry(stats?.targetedHits) ? `${escapeHtml(topEntry(stats.targetedHits).name)} ${topEntry(stats.targetedHits).value}` : "-"}</b></div>
    <div class="statLine"><span>Sektör sabotajı</span><b>${topEntry(stats?.sectorSabotage) ? `${escapeHtml(topEntry(stats.sectorSabotage).name)} ${topEntry(stats.sectorSabotage).value}` : "-"}</b></div>
  `;
}

function renderMyPanel(state) {
  const box = el("myCompanyPanel");
  if (!box) return;
  const me = (state.players || []).find((p) => p.id === myPlayerId);
  if (!me) {
    box.innerHTML = `<div class="panelTitle">BENİM ŞİRKET</div><div class="tiny">Bağlantı bekleniyor...</div>`;
    return;
  }
  const items = me.inventory?.length ? me.inventory.map((item) => `• ${escapeHtml(item.title)}: ${escapeHtml(item.desc)}`).join("<br>") : "Eşya yok";
  box.innerHTML = `
    <div class="panelTitle">BENİM ŞİRKET</div>
    <div class="statLine"><span>Şirket</span><b>${escapeHtml(me.company)}</b></div>
    <div class="statLine"><span>Rol</span><b>${escapeHtml(me.roleTitle)}</b></div>
    <div class="statLine"><span>Gizli rakip</span><b>${escapeHtml(me.secretRivalName || "Atanmadı")}</b></div>
    <div class="statLine"><span>Şirket yolu</span><b>${escapeHtml(me.companyPathTitle || "Yok")}</b></div>
    <div class="statLine"><span>Strateji</span><b>${escapeHtml(me.strategyTitle || "Yok")}</b></div>
    <div class="statLine"><span>Final planı</span><b>${escapeHtml(me.finalPlanTitle || "Yok")}</b></div>
    <div class="statLine"><span>Kaldıraç</span><b>${me.leverageActive ? `${me.leverageLeft}s` : "Kapalı"}</b></div>
    <div class="statLine"><span>Regülatör tehdidi</span><b>${state.regulatorThreat || 0}/100</b></div>
    <div class="tiny"><b>Envanter</b><br>${items}</div>
  `;
}

let lastImportantLog = "";
function renderLogs(logs) {
  const logsDiv = el("logs");
  if (!logsDiv) return;
  logsDiv.innerHTML = "";
  [...(logs || [])].reverse().forEach((log) => {
    const div = document.createElement("div");
    div.className = log.important ? "log important" : "log";
    div.innerText = `[${log.time}] ${log.text}`;
    logsDiv.appendChild(div);
  });

  const newestImportant = [...(logs || [])].reverse().find((log) => log.important);
  if (newestImportant && newestImportant.text !== lastImportantLog) {
    lastImportantLog = newestImportant.text;
    if (/JACKPOT|LİKİDE|FİNAL|REGÜLATÖR|Rug Pull/i.test(newestImportant.text)) {
      screenShake();
      playExplosionSound();
    }
  }
}

function renderTop(state) {
  const marketBox = el("marketBox");
  const roundBox = el("roundBox");
  const warningBox = el("warningBox");
  const winnerBox = el("winnerBox");

  if (marketBox) {
    const crisis = state.finalCrisis ? ` | ${state.finalCrisis.title}` : "";
    marketBox.innerText = `${state.market.title} (${state.market.endsIn}s)${crisis}`;
    marketBox.title = `${state.market.desc}${state.finalCrisis ? " | " + state.finalCrisis.desc : ""}`;
  }
  if (roundBox) {
    roundBox.innerText = `${formatTime(state.timeLeft)} | Online ${state.onlineCount}/${state.maxPlayers}`;
  }
  if (warningBox) {
    const finalText = state.finalCrisis ? `Final Krizi: ${state.finalCrisis.title}` : state.finalPhase ? "Final krizi yaklaşıyor" : "TREEZCOIN aktif";
    warningBox.innerText = `${finalText} | Jackpot %15 | Kalkan 50K | TREEZ Kaz logda yok | Lider hedef olur`;
  }
  if (winnerBox) {
    winnerBox.innerText = state.winner ? `${state.winner} KAZANDI! Yeni masa birazdan başlar.` : "";
  }
}


function renderTargetControls(state) {
  const targetSelect = el("targetCompanySelect");
  const sectorSelect = el("targetSectorSelect");

  if (targetSelect) {
    const current = targetSelect.value;
    const players = (state.players || []).filter((player) => player.id !== myPlayerId);
    let html = `<option value="leader">Lider şirket</option><option value="rich">En zengin şirket</option><option value="hot">En yüksek ısı</option>`;
    players.forEach((player) => {
      const money = player.score === null || player.score === undefined ? "GİZLİ" : formatScore(player.score);
      html += `<option value="${escapeHtml(player.id)}">${escapeHtml(player.company || player.name)} • ${money}</option>`;
    });
    targetSelect.innerHTML = html;
    if ([...targetSelect.options].some((opt) => opt.value === current)) targetSelect.value = current;
  }

  if (sectorSelect) {
    const current = sectorSelect.value;
    let html = "";
    (state.sectors || []).forEach((sector) => {
      html += `<option value="${escapeHtml(sector.id)}">${escapeHtml(sector.icon)} ${escapeHtml(sector.title)} • ${escapeHtml(sector.ownerName || "Boş")}</option>`;
    });
    sectorSelect.innerHTML = html;
    if ([...sectorSelect.options].some((opt) => opt.value === current)) sectorSelect.value = current;
  }
}

socket.on("state", (state) => {
  latestState = state;
  renderTop(state);
  renderSectors(state);
  renderPlayers(state);
  renderMoneyBoard(state.players);
  renderStats(state.roundStats || {});
  renderMyPanel(state);
  renderLogs(state.logs || []);
  renderTargetControls(state);
});

window.addEventListener("load", () => {
  const nameInput = el("nameInput");
  const companyInput = el("companyInput");
  if (nameInput && myName) nameInput.value = myName;
  if (companyInput && myCompany) companyInput.value = myCompany;
});
