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
let myRole = localStorage.getItem("treez_role") || "";
let myPlayerId = "";
let latestState = null;
let currentDecision = null;
let audioContext = null;

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
  insurance: 15000,
  leverage: 26000,
  reputation: 14000,
  rolePower: 22000,
  takeSector: 6500,
  pressureCompany: 7000,
  damageSector: 8000
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

function formatScore(num) {
  if (num === null || num === undefined) return "GİZLİ";
  return Math.floor(num || 0).toLocaleString("tr-TR");
}

function formatTime(seconds) {
  const m = Math.floor((seconds || 0) / 60);
  const s = (seconds || 0) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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
  setTimeout(() => box.classList.remove("show"), 2100);
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
  setStatus("ONLINE");
  sendHello();
  setTimeout(sendHello, 400);
  setTimeout(sendHello, 1200);
});

socket.on("disconnect", () => {
  setStatus("BAĞLANTI YOK");
});

socket.io.on("reconnect", () => {
  setStatus("TEKRAR ONLINE");
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
    <div class="roomFull">
      <h1>Oda Dolu</h1>
      <p>Max 6 online oyuncu girebilir.</p>
    </div>
  `;
});

function initAudio() {
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

function playTone(freq, duration, type = "sine", volume = 0.06) {
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
  } catch (err) {}
}

function playCoinSound() {
  playTone(900, 0.08, "square", 0.045);
  setTimeout(() => playTone(1350, 0.08, "triangle", 0.035), 45);
}

function playRiskSound() {
  playTone(180, 0.12, "sawtooth", 0.045);
  setTimeout(() => playTone(420, 0.12, "sawtooth", 0.035), 70);
}

function playBigSound() {
  playTone(520, 0.07, "square", 0.055);
  setTimeout(() => playTone(820, 0.07, "square", 0.055), 75);
  setTimeout(() => playTone(1220, 0.12, "triangle", 0.055), 150);
}

function setProfile() {
  const nameInput = el("nameInput");
  const companyInput = el("companyInput");
  const name = (nameInput?.value || "Player").trim() || "Player";
  const company = (companyInput?.value || `${name} Capital`).trim() || `${name} Capital`;

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
    return;
  }

  const button = event?.currentTarget;
  if (button && button.classList.contains("cooling")) return;

  let payload = { type };

  if (type === "steal") {
    const targetId = el("targetPlayerSelect")?.value || "";
    if (targetId) payload.targetId = targetId;
  }

  socket.emit("action", payload);

  const x = event?.clientX || window.innerWidth / 2;
  const y = event?.clientY || window.innerHeight / 2;

  if (type === "mine") {
    playCoinSound();
    createFloatingText(x, y, "+TREEZ");
  } else if (["jackpot", "rug", "throne", "rolePower"].includes(type)) {
    playBigSound();
    createFloatingText(x, y, "RISK");
  } else {
    playRiskSound();
  }

  createParticles(x, y);
  if (button) startCooldown(button, cooldowns[type] || 1000);
}

function sendTargetAction(type, event) {
  if (!myRole) {
    toast("Önce rol seç.");
    showRoleModal();
    return;
  }
  const targetId = el("targetPlayerSelect")?.value || "";
  const sectorId = el("targetSectorSelect")?.value || "";

  if (type === "pressureCompany" && !targetId) return toast("Hedef şirket seç.");
  if (type === "damageSector" && !sectorId) return toast("Hedef sektör seç.");

  const payload = { type };
  if (targetId) payload.targetId = targetId;
  if (sectorId) payload.sectorId = sectorId;

  socket.emit("action", payload);

  const button = event?.currentTarget;
  if (button) startCooldown(button, cooldowns[type] || 1000);
  playBigSound();
}

function sendSectorAction(type, sectorId, event) {
  if (!sectorId) return;
  if (!myRole) {
    toast("Önce rol seç.");
    showRoleModal();
    return;
  }

  socket.emit("action", { type, sectorId });

  const button = event?.currentTarget;
  if (button) startCooldown(button, cooldowns[type] || 1000);
  playRiskSound();
}

function startCooldown(button, duration) {
  const fill = button.querySelector(".cooldownFill");
  if (!fill) return;

  button.classList.add("cooling");
  const start = performance.now();

  function animate(current) {
    const progress = Math.min((current - start) / duration, 1);
    fill.style.width = `${100 - progress * 100}%`;
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

function createFloatingText(x, y, text) {
  const node = document.createElement("div");
  node.className = "floating";
  node.innerText = text;
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 850);
}

function createParticles(x, y, count = 14) {
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    const angle = Math.random() * Math.PI * 2;
    const distance = 32 + Math.random() * 58;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    p.style.setProperty("--y", `${Math.sin(angle) * distance}px`);
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 650);
  }
}

function showRoleModal(roles = []) {
  const modal = el("roleModal");
  const grid = el("roleGrid");
  if (!modal || !grid) return;

  if (!roles.length) {
    roles = [
      { id: "miner", title: "Madenci", icon: "⛏️", desc: "Güvenli TREEZ kasma.", plus: "Maden güçlü.", minus: "PvP zayıf." },
      { id: "thief", title: "Hırsız", icon: "🕵️", desc: "Çalma odaklı.", plus: "Baskı güçlü.", minus: "Isı yüksek." },
      { id: "banker", title: "Banker", icon: "🏦", desc: "Kasa ve sigorta.", plus: "Koruma iyi.", minus: "Risk zayıf." },
      { id: "whale", title: "Balina", icon: "🐋", desc: "Yüksek risk.", plus: "Büyük kazanç.", minus: "Büyük kayıp." },
      { id: "insurer", title: "Sigortacı", icon: "🧾", desc: "Savunma.", plus: "Krizlere dayanır.", minus: "Kazanç düşük." },
      { id: "saboteur", title: "Sabotajcı", icon: "💣", desc: "Lider avcısı.", plus: "Sektör baskısı.", minus: "Kazım zayıf." },
      { id: "gambler", title: "Şansçı", icon: "🎲", desc: "Risk oyuncusu.", plus: "Jackpot iyi.", minus: "Ceza sert." }
    ];
  }

  grid.innerHTML = "";
  roles.forEach((role) => {
    const button = document.createElement("button");
    button.className = "roleCard";
    button.innerHTML = `
      <strong>${escapeHtml(role.icon || "◻️")} ${escapeHtml(role.title)}</strong>
      <span>${escapeHtml(role.desc)}</span>
      <span><b>Artı:</b> ${escapeHtml(role.plus)}</span>
      <span><b>Eksi:</b> ${escapeHtml(role.minus)}</span>
    `;
    button.onclick = () => {
      myRole = role.id;
      localStorage.setItem("treez_role", myRole);
      socket.emit("chooseRole", role.id);
      hideRoleModal();
      playBigSound();
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
  const options = el("decisionOptions");
  if (!modal || !title || !desc || !options) return;

  title.innerText = offer.title || "Şirket Kararı";
  desc.innerText = offer.desc || "";
  options.innerHTML = "";

  (offer.options || []).forEach((option) => {
    const button = document.createElement("button");
    button.className = "decisionChoice";
    button.innerHTML = `
      <strong>${escapeHtml(option.title)}</strong>
      <span>${escapeHtml(option.desc)}</span>
    `;
    button.onclick = () => {
      socket.emit("decisionChoice", option.id);
      currentDecision = null;
      modal.classList.remove("show");
      playBigSound();
    };
    options.appendChild(button);
  });

  modal.classList.add("show");
}

function sectorOwnerLabel(sector) {
  return sector.ownerId ? sector.ownerName : "Boş";
}

function renderSectors(state) {
  const grid = el("sectorGrid");
  if (!grid) return;

  grid.innerHTML = "";
  (state.sectors || []).forEach((sector) => {
    const mine = sector.ownerId === myPlayerId;
    const card = document.createElement("div");
    card.className = `sectorCard ${mine ? "ownedByMe" : ""}`;
    const disabledTake = mine ? "disabled" : "";
    const disabledDamage = !sector.ownerId || mine ? "disabled" : "";

    card.innerHTML = `
      <div class="sectorTop">
        <div class="sectorIcon">${escapeHtml(sector.icon)}</div>
        <div class="sectorInfo">
          <div class="sectorTitle">${escapeHtml(sector.title)}</div>
          <div class="sectorOwner">${escapeHtml(sectorOwnerLabel(sector))}</div>
        </div>
      </div>
      <div class="sectorDesc">${escapeHtml(sector.desc)}</div>
      <div class="sectorStability">
        <span>Stabilite</span>
        <b>${sector.stability || 100}%</b>
      </div>
      <div class="sectorBar"><div style="width:${sector.stability || 100}%"></div></div>
      <div class="sectorActions">
        <button ${disabledTake} onclick="sendSectorAction('takeSector', '${sector.id}', event)">Al</button>
        <button ${disabledDamage} onclick="sendSectorAction('damageSector', '${sector.id}', event)">Zarar Ver</button>
      </div>
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
    badges.push(badge(`${player.roleIcon || ""} ${player.roleTitle || "Rolsüz"}`));
    if (player.heatTitle) badges.push(badge(player.heatTitle, heatValue >= 51 ? "hot" : "good"));
    if (player.shield > 0) badges.push(badge(`kalkan ${player.shield}`, "good"));
    if (player.insurance > 0) badges.push(badge(`sigorta ${player.insurance}`, "good"));
    if (player.ownedSectors?.length) badges.push(badge(`sektör ${player.ownedSectors.length}`, "good"));
    if (player.leverageActive) badges.push(badge(`2x ${player.leverageLeft}s`, "hot"));
    if (player.pendingMilestone) badges.push(badge("karar", "hot"));

    card.innerHTML = `
      <div class="playerHeader">
        <div class="playerIdentity">
          <div class="${nameClass} playerName">${index + 1}. ${escapeHtml(player.name)}</div>
          <div class="companyName">${escapeHtml(player.company || "ŞİRKET YOK")}</div>
        </div>
        <div class="rankPill">#${index + 1}</div>
      </div>

      <div class="badgeLine">${badges.slice(0, 7).join("")}</div>

      <div class="playerMoneyRow">
        <div class="score">${scoreVisible ? formatScore(player.score) : "GİZLİ"} TREEZ</div>
        <div class="vaultText">Kasa ${formatScore(player.vault)}</div>
      </div>

      <div class="playerMetaRow">
        <span>${escapeHtml(player.profile || "Dengeli")}</span>
        <span>Isı ${player.heat === null ? "?" : heatValue}</span>
        <span>İtibar ${player.reputation === null ? "?" : repValue}</span>
      </div>

      <div class="compactBars">
        <div class="barLine compact">
          <div class="barLabel"><span>10M</span><b>${Math.floor(progress)}%</b></div>
          <div class="barWrap"><div class="barFill progressFill" style="width:${progress}%"></div></div>
        </div>
        <div class="barLine compact">
          <div class="barLabel"><span>Isı</span><b>${heatValue}</b></div>
          <div class="barWrap"><div class="barFill heatFill" style="width:${heatValue}%"></div></div>
        </div>
        <div class="barLine compact">
          <div class="barLabel"><span>İtibar</span><b>${repValue}</b></div>
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

  let html = `<div class="panelTitle">CANLI TREEZ</div>`;
  (players || []).forEach((player, index) => {
    html += `
      <div class="moneyRow ${index === 0 ? "leaderRow" : ""}">
        <span>${index + 1}. ${player.online ? "●" : "○"} ${escapeHtml(player.name)}</span>
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
  const sector = topEntry(stats?.sectorTakeovers);
  const pressure = topEntry(stats?.companyPressure);

  box.innerHTML = `
    <span>Tur ${stats?.roundNumber || 1}</span>
    <span>Çalan: ${stolen ? escapeHtml(stolen.name) : "-"}</span>
    <span>Hedef: ${attacked ? escapeHtml(attacked.name) : "-"}</span>
    <span>Sektör: ${sector ? escapeHtml(sector.name) : "-"}</span>
    <span>Baskı: ${pressure ? escapeHtml(pressure.name) : "-"}</span>
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

  box.innerHTML = `
    <div class="panelTitle">BENİM ŞİRKET</div>
    <div class="myBig">${escapeHtml(me.company)}</div>
    <div class="mySub">${escapeHtml(me.name)} • ${escapeHtml(me.roleTitle)}</div>
    <div class="myGrid">
      <div><span>Nakit</span><b>${formatScore(me.score)}</b></div>
      <div><span>Kasa</span><b>${formatScore(me.vault)}</b></div>
      <div><span>Isı</span><b>${me.heat}</b></div>
      <div><span>İtibar</span><b>${me.reputation}</b></div>
      <div><span>Sektör</span><b>${me.ownedSectors?.length || 0}</b></div>
      <div><span>Reg.</span><b>${me.regulatorThreat}</b></div>
    </div>
  `;
}

function renderTargetPanel(state) {
  const playerSelect = el("targetPlayerSelect");
  const sectorSelect = el("targetSectorSelect");

  if (playerSelect) {
    const current = playerSelect.value;
    const candidates = (state.players || []).filter((p) => p.id !== myPlayerId);
    playerSelect.innerHTML = `<option value="">Hedef şirket seç</option>` + candidates.map((p) => {
      return `<option value="${p.id}">${escapeHtml(p.name)} • ${escapeHtml(p.company)} • ${formatScore(p.score)}</option>`;
    }).join("");
    if ([...playerSelect.options].some((o) => o.value === current)) playerSelect.value = current;
  }

  if (sectorSelect) {
    const current = sectorSelect.value;
    sectorSelect.innerHTML = `<option value="">Hedef sektör seç</option>` + (state.sectors || []).map((s) => {
      return `<option value="${s.id}">${escapeHtml(s.icon)} ${escapeHtml(s.title)} • ${escapeHtml(s.ownerName || "Boş")}</option>`;
    }).join("");
    if ([...sectorSelect.options].some((o) => o.value === current)) sectorSelect.value = current;
  }
}

let lastImportantLog = "";

function renderLogs(logs) {
  const logsDiv = el("logs");
  if (!logsDiv) return;
  logsDiv.innerHTML = "";

  [...(logs || [])].reverse().slice(0, 12).forEach((log) => {
    const div = document.createElement("div");
    div.className = log.important ? "log important" : "log";
    div.innerText = `[${log.time}] ${log.text}`;
    logsDiv.appendChild(div);
  });

  const newestImportant = [...(logs || [])].reverse().find((log) => log.important);
  if (newestImportant && newestImportant.text !== lastImportantLog) {
    lastImportantLog = newestImportant.text;
    if (/JACKPOT|LİKİDE|FİNAL|REGÜLATÖR|Rug Pull|baskı|sektör/i.test(newestImportant.text)) {
      playBigSound();
    }
  }
}

function renderTop(state) {
  const marketBox = el("marketBox");
  const roundBox = el("roundBox");
  const warningBox = el("warningBox");
  const winnerBox = el("winnerBox");
  const kpiLeader = el("kpiLeader");
  const kpiHeat = el("kpiHeat");
  const kpiRep = el("kpiRep");
  const kpiReg = el("kpiReg");
  const kpiCrisis = el("kpiCrisis");

  const players = state.players || [];
  const leader = players[0];
  const hottest = [...players].sort((a, b) => (b.heat || 0) - (a.heat || 0))[0];
  const reputable = [...players].sort((a, b) => (b.reputation || 0) - (a.reputation || 0))[0];

  if (marketBox) {
    marketBox.innerText = `${state.market.title} (${state.market.endsIn}s)`;
    marketBox.title = state.market.desc;
  }
  if (roundBox) roundBox.innerText = `${formatTime(state.timeLeft)} • Online ${state.onlineCount}/${state.maxPlayers}`;
  if (warningBox) warningBox.innerText = state.finalPhase ? "Final Baskısı: lider hedefte, risk büyüyor." : "Jackpot %15 • Kalkan 50K • Sektörler seçerek alınır.";
  if (winnerBox) winnerBox.innerText = state.winner ? `${state.winner} KAZANDI! Yeni masa birazdan başlar.` : "";

  if (kpiLeader) kpiLeader.innerText = leader ? leader.name : "-";
  if (kpiHeat) kpiHeat.innerText = hottest ? `${hottest.name} ${hottest.heat}` : "-";
  if (kpiRep) kpiRep.innerText = reputable ? `${reputable.name} ${reputable.reputation}` : "-";
  if (kpiReg) kpiReg.innerText = leader ? `${leader.regulatorThreat}/100` : "-";
  if (kpiCrisis) kpiCrisis.innerText = state.finalPhase ? "AKTİF" : "PASİF";
}

socket.on("state", (state) => {
  latestState = state;
  renderTop(state);
  renderSectors(state);
  renderPlayers(state);
  renderMoneyBoard(state.players);
  renderStats(state.roundStats || {});
  renderMyPanel(state);
  renderTargetPanel(state);
  renderLogs(state.logs || []);
});

window.addEventListener("load", () => {
  const nameInput = el("nameInput");
  const companyInput = el("companyInput");
  if (nameInput && myName) nameInput.value = myName;
  if (companyInput && myCompany) companyInput.value = myCompany;
});
