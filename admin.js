(function () {
  const store = window.SpinWheelStore;
  const franchiseId = store.getFranchiseIdFromUrl();
  const testFranchiseId = "test-usa";
  let config = store.getConfig(franchiseId);
  let serverFranchiseIds = [];
  let leadsCache = [];
  let testsCache = [];
  let raffleStatus = { entriesCount: 0, winners: [], drawnAt: "" };
  let adminAuthToken = "";
  let adminProfile = null;

  const messageEl = document.getElementById("adminMessage");
  const fieldsEditor = document.getElementById("fieldsEditor");
  const prizeEditor = document.getElementById("prizeEditor");
  const adminApp = document.getElementById("adminApp");
  const adminAuthGate = document.getElementById("adminAuthGate");
  const adminLoginButton = document.getElementById("adminLoginButton");
  const adminLoginStatus = document.getElementById("adminLoginStatus");
  const adminLogoutBtn = document.getElementById("adminLogoutBtn");
  const adminUserLabel = document.getElementById("adminUserLabel");

  const refs = {
    franchiseSelect: document.getElementById("cfgFranchiseSelect"),
    newFranchiseId: document.getElementById("cfgNewFranchiseId"),
    eventName: document.getElementById("cfgEventName"),
    eventBadge: document.getElementById("cfgEventBadge"),
    headline: document.getElementById("cfgHeadline"),
    subheadline: document.getElementById("cfgSubheadline"),
    locationName: document.getElementById("cfgLocationName"),
    address1: document.getElementById("cfgAddress1"),
    address2: document.getElementById("cfgAddress2"),
    city: document.getElementById("cfgCity"),
    state: document.getElementById("cfgState"),
    postalCode: document.getElementById("cfgPostalCode"),
    primary: document.getElementById("cfgPrimary"),
    accent: document.getElementById("cfgAccent"),
    bg: document.getElementById("cfgBg"),
    spinDuration: document.getElementById("cfgSpinDuration"),
    minRotations: document.getElementById("cfgMinRotations"),
    maxRotations: document.getElementById("cfgMaxRotations"),
    wheelPointerColor: document.getElementById("cfgWheelPointerColor"),
    wheelLabelColor: document.getElementById("cfgWheelLabelColor"),
    wheelSeparatorColor: document.getElementById("cfgWheelSeparatorColor"),
    wheelCenterFillColor: document.getElementById("cfgWheelCenterFillColor"),
    wheelCenterStrokeColor: document.getElementById("cfgWheelCenterStrokeColor"),
    publicUrl: document.getElementById("cfgPublicUrl"),
    raffleTitle: document.getElementById("cfgRaffleTitle"),
    raffleDescription: document.getElementById("cfgRaffleDescription"),
    rafflePrize1: document.getElementById("cfgRafflePrize1"),
    rafflePrize2: document.getElementById("cfgRafflePrize2"),
    rafflePrize3: document.getElementById("cfgRafflePrize3"),
    rafflePrize1Image: document.getElementById("cfgRafflePrize1Image"),
    rafflePrize2Image: document.getElementById("cfgRafflePrize2Image"),
    rafflePrize3Image: document.getElementById("cfgRafflePrize3Image"),
    raffleDrawAt: document.getElementById("cfgRaffleDrawAt"),
    raffleAcceptEntries: document.getElementById("cfgRaffleAcceptEntries"),
    raffleUrl: document.getElementById("cfgRaffleUrl"),
    raffleTargetUrl: document.getElementById("raffleTargetUrl"),
    raffleQrImage: document.getElementById("raffleQrImage"),
    raffleSummary: document.getElementById("raffleSummary"),
    raffleWinnersTableBody: document.getElementById("raffleWinnersTableBody"),
    raffleEntriesTableBody: document.getElementById("raffleEntriesTableBody"),
    qrImage: document.getElementById("qrImage"),
    qrTargetUrl: document.getElementById("qrTargetUrl"),
    leadSearchInput: document.getElementById("leadSearchInput"),
    leadsTableBody: document.getElementById("leadsTableBody"),
    testsTableBody: document.getElementById("testsTableBody"),
    testResultsTableBody: document.getElementById("testResultsTableBody"),
    testSummary: document.getElementById("testSummary"),
  };

  initAdminAuth();

  document.getElementById("createFranchiseBtn").addEventListener("click", createFranchise);
  refs.franchiseSelect.addEventListener("change", switchFranchise);
  document.getElementById("addFieldBtn").addEventListener("click", addField);
  document.getElementById("addPrizeBtn").addEventListener("click", addPrize);
  document.getElementById("saveCfgBtn").addEventListener("click", saveConfig);
  document.getElementById("resetCfgBtn").addEventListener("click", resetConfig);
  document.getElementById("exportLeadsBtn").addEventListener("click", exportLeads);
  document.getElementById("clearLeadsBtn").addEventListener("click", clearLeads);
  document.getElementById("refreshLeadsBtn").addEventListener("click", refreshLeadsLookup);
  document.getElementById("loadTestsBtn").addEventListener("click", loadTests);
  document.getElementById("runTestsBtn").addEventListener("click", runTests);
  document.getElementById("runRaffleBtn").addEventListener("click", runRaffleDraw);
  document.getElementById("resetRaffleBtn").addEventListener("click", resetRaffle);
  document.getElementById("exportRaffleEntriesBtn").addEventListener("click", exportRaffleEntries);
  refs.publicUrl.addEventListener("input", renderQr);
  refs.raffleUrl.addEventListener("input", renderRaffleLink);
  refs.leadSearchInput.addEventListener("input", renderLeadsTable);
  adminLogoutBtn.addEventListener("click", handleLogout);

  async function bootstrap() {
    await syncConfigFromServer();
    await syncFranchiseCatalogFromServer();
    hydrateForm();
    await refreshLeadsLookup();
    await refreshRaffleStatus();
    await refreshRaffleEntries();
    await loadTests();
  }

  async function initAdminAuth() {
    adminAuthToken = localStorage.getItem("spinwheel.admin.token") || "";
    adminProfile = safeParse(localStorage.getItem("spinwheel.admin.profile")) || null;
    updateAdminUserLabel();

    const config = await fetchAuthConfig();
    if (!config || !config.clientId) {
      adminAuthGate.classList.add("hidden");
      adminApp.classList.remove("hidden");
      if (adminLoginStatus) {
        adminLoginStatus.textContent = "Google client ID not configured. Set GOOGLE_CLIENT_ID to enable login.";
      }
      bootstrap();
      return;
    }

    if (adminAuthToken) {
      adminAuthGate.classList.add("hidden");
      adminApp.classList.remove("hidden");
      bootstrap();
      return;
    }

    adminApp.classList.add("hidden");
    adminAuthGate.classList.remove("hidden");
    if (adminLoginStatus) {
      adminLoginStatus.textContent = "Use your Google account to sign in.";
    }

    if (window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.initialize({
        client_id: config.clientId,
        callback: handleGoogleCredential,
      });
      window.google.accounts.id.renderButton(adminLoginButton, {
        theme: "outline",
        size: "large",
        width: 260,
      });
    } else {
      adminLoginStatus.textContent = "Google login library failed to load.";
    }
  }

  async function fetchAuthConfig() {
    try {
      const response = await fetch("/api/auth/google-config");
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  function handleGoogleCredential(response) {
    if (!response || !response.credential) {
      adminLoginStatus.textContent = "Google sign-in failed. Try again.";
      return;
    }
    adminAuthToken = response.credential;
    adminProfile = parseJwtProfile(response.credential);
    localStorage.setItem("spinwheel.admin.token", adminAuthToken);
    localStorage.setItem("spinwheel.admin.profile", JSON.stringify(adminProfile || {}));
    updateAdminUserLabel();
    adminAuthGate.classList.add("hidden");
    adminApp.classList.remove("hidden");
    bootstrap();
  }

  function handleLogout() {
    adminAuthToken = "";
    adminProfile = null;
    localStorage.removeItem("spinwheel.admin.token");
    localStorage.removeItem("spinwheel.admin.profile");
    adminApp.classList.add("hidden");
    adminAuthGate.classList.remove("hidden");
    if (adminLoginStatus) {
      adminLoginStatus.textContent = "Signed out. Please sign in.";
    }
  }

  function updateAdminUserLabel() {
    if (!adminUserLabel) return;
    if (adminProfile && (adminProfile.name || adminProfile.email)) {
      adminUserLabel.textContent = `Signed in as ${adminProfile.name || adminProfile.email}`;
    } else {
      adminUserLabel.textContent = "";
    }
  }

  function parseJwtProfile(token) {
    try {
      const payload = token.split(".")[1];
      const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      return { name: decoded.name, email: decoded.email, picture: decoded.picture };
    } catch (error) {
      return null;
    }
  }

  function safeParse(raw) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  async function apiFetch(url, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    if (adminAuthToken) headers.Authorization = `Bearer ${adminAuthToken}`;
    return fetch(url, Object.assign({}, options, { headers }));
  }

  async function syncConfigFromServer() {
    try {
      const response = await apiFetch(`/api/config?franchise=${encodeURIComponent(franchiseId)}`);
      if (!response.ok) return;
      const payload = await response.json();
      if (payload && payload.config && typeof payload.config === "object") {
        config = store.saveConfig(payload.config, franchiseId);
      }
    } catch (error) {
      // Local store remains fallback if server is unavailable.
    }
  }

  async function syncFranchiseCatalogFromServer() {
    try {
      const response = await apiFetch("/api/franchises");
      if (!response.ok) return;
      const payload = await response.json();
      if (payload && Array.isArray(payload.franchises)) {
        serverFranchiseIds = payload.franchises.map((id) => store.resolveFranchiseId(id));
      }
    } catch (error) {
      serverFranchiseIds = [];
    }
  }

  function hydrateForm() {
    renderFranchiseOptions();

    refs.eventName.value = config.eventName || "";
    refs.eventBadge.value = config.eventBadge;
    refs.headline.value = config.headline;
    refs.subheadline.value = config.subheadline;
    refs.locationName.value = config.franchise.locationName;
    refs.address1.value = config.franchise.addressLine1;
    refs.address2.value = config.franchise.addressLine2;
    refs.city.value = config.franchise.city;
    refs.state.value = config.franchise.state;
    refs.postalCode.value = config.franchise.postalCode;
    refs.primary.value = config.theme.primary;
    refs.accent.value = config.theme.accent;
    refs.bg.value = config.theme.bg;
    refs.spinDuration.value = config.wheel.spinDurationMs;
    refs.minRotations.value = config.wheel.minRotations;
    refs.maxRotations.value = config.wheel.maxRotations;
    refs.wheelPointerColor.value = config.wheelStyle.pointerColor;
    refs.wheelLabelColor.value = config.wheelStyle.labelColor;
    refs.wheelSeparatorColor.value = config.wheelStyle.separatorColor;
    refs.wheelCenterFillColor.value = config.wheelStyle.centerFillColor;
    refs.wheelCenterStrokeColor.value = config.wheelStyle.centerStrokeColor;
    refs.raffleTitle.value = (config.raffle && config.raffle.title) || "Live Raffle";
    refs.raffleDescription.value = (config.raffle && config.raffle.description) || "Enter for your chance to win.";
    refs.rafflePrize1.value = (config.raffle && config.raffle.prizes && config.raffle.prizes[0] && config.raffle.prizes[0].name) || "Prize 1";
    refs.rafflePrize2.value = (config.raffle && config.raffle.prizes && config.raffle.prizes[1] && config.raffle.prizes[1].name) || "Prize 2";
    refs.rafflePrize3.value = (config.raffle && config.raffle.prizes && config.raffle.prizes[2] && config.raffle.prizes[2].name) || "Prize 3";
    refs.rafflePrize1Image.value = (config.raffle && config.raffle.prizes && config.raffle.prizes[0] && config.raffle.prizes[0].imageUrl) || "";
    refs.rafflePrize2Image.value = (config.raffle && config.raffle.prizes && config.raffle.prizes[1] && config.raffle.prizes[1].imageUrl) || "";
    refs.rafflePrize3Image.value = (config.raffle && config.raffle.prizes && config.raffle.prizes[2] && config.raffle.prizes[2].imageUrl) || "";
    refs.raffleAcceptEntries.checked = !(config.raffle && config.raffle.acceptEntries === false);
    refs.raffleDrawAt.value = toDateTimeLocal(config.raffle && config.raffle.drawAt);
    refs.raffleUrl.value = config.raffleUrl || "";

    const defaultPublic = `${window.location.origin}${window.location.pathname.replace("admin.html", "index.html")}`;
    refs.publicUrl.value = config.publicUrl || store.withFranchiseParam(defaultPublic, franchiseId);
    const playerLink = document.querySelector('.footer-note a[href=\"./index.html\"]');
    if (playerLink) {
      playerLink.href = `./index.html?franchise=${encodeURIComponent(franchiseId)}`;
    }

    renderFieldsEditor();
    renderPrizeEditor();
    renderQr();
    renderRaffleLink();
  }

  function renderFranchiseOptions() {
    const local = store.listFranchises();
    const fromServer = serverFranchiseIds.map((id) => ({ id, name: id }));
    const byId = new Map();
    [...fromServer, ...local].forEach((f) => {
      if (!byId.has(f.id)) byId.set(f.id, f);
      if (f.name && f.name !== f.id) byId.set(f.id, f);
    });
    const franchises = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
    refs.franchiseSelect.innerHTML = franchises
      .map((f) => `<option value="${escapeHtml(f.id)}" ${f.id === franchiseId ? "selected" : ""}>${escapeHtml(f.name)} (${escapeHtml(f.id)})</option>`)
      .join("");
  }

  function switchFranchise() {
    const nextId = store.resolveFranchiseId(refs.franchiseSelect.value);
    if (nextId === franchiseId) return;
    const url = new URL(window.location.href);
    url.searchParams.set("franchise", nextId);
    window.location.assign(url.toString());
  }

  async function createFranchise() {
    const rawId = refs.newFranchiseId.value.trim();
    if (!rawId) {
      setMessage("Enter a franchise ID first.");
      return;
    }

    const newId = store.resolveFranchiseId(rawId);
    const baseConfig = JSON.parse(JSON.stringify(config));
    if (!baseConfig.franchise.locationName) {
      baseConfig.franchise.locationName = newId;
    }

    const created = store.createFranchise(newId, baseConfig);
    if (!created) {
      setMessage(`Franchise '${newId}' already exists.`);
      return;
    }

    try {
      const response = await apiFetch("/api/franchises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ franchiseId: newId, baseConfig }),
      });
      if (!response.ok && response.status !== 409) {
        throw new Error(`HTTP ${response.status}`);
      }
      if (response.status === 409) {
        setMessage(`Franchise '${newId}' exists on server. Switching to it.`);
      }
    } catch (error) {
      setMessage(`Franchise '${newId}' created locally. Server sync failed.`);
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("franchise", newId);
    window.location.assign(url.toString());
  }

  function renderFieldsEditor() {
    fieldsEditor.innerHTML = "";
    config.fields.forEach((field, idx) => {
      const row = document.createElement("div");
      row.className = "editor-row";
      row.innerHTML = `
        <label>
          Label
          <input data-kind="field-label" data-index="${idx}" type="text" value="${escapeHtml(field.label)}" />
        </label>
        <label>
          Type
          <select data-kind="field-type" data-index="${idx}">
            ${["text", "email", "tel", "number"].map((t) => `<option value="${t}" ${field.type === t ? "selected" : ""}>${t}</option>`).join("")}
          </select>
        </label>
        <label class="checkbox">
          <input data-kind="field-required" data-index="${idx}" type="checkbox" ${field.required ? "checked" : ""} /> Required
        </label>
        <label class="checkbox">
          <input data-kind="field-enabled" data-index="${idx}" type="checkbox" ${field.enabled ? "checked" : ""} /> Enabled
        </label>
        <button data-kind="field-remove" data-index="${idx}" type="button" class="btn btn-danger small">Delete</button>
      `;
      fieldsEditor.appendChild(row);
    });

    fieldsEditor.querySelectorAll("input, select, button").forEach((el) => {
      el.addEventListener("change", handleFieldEdit);
      el.addEventListener("click", handleFieldEdit);
    });
  }

  function renderPrizeEditor() {
    prizeEditor.innerHTML = "";
    config.prizes.forEach((prize, idx) => {
      const row = document.createElement("div");
      row.className = "editor-row";
      row.innerHTML = `
        <label>
          Prize
          <input data-kind="prize-name" data-index="${idx}" type="text" value="${escapeHtml(prize.name)}" />
        </label>
        <label>
          Weight
          <input data-kind="prize-weight" data-index="${idx}" type="number" min="0" step="1" value="${prize.weight}" />
        </label>
        <label>
          Inventory (-1 = unlimited)
          <input data-kind="prize-inventory" data-index="${idx}" type="number" step="1" value="${prize.inventory}" />
        </label>
        <label>
          Color
          <input data-kind="prize-color" data-index="${idx}" type="color" value="${prize.color}" />
        </label>
        <label class="full-width">
          Prize Image URL (optional)
          <input data-kind="prize-image-url" data-index="${idx}" type="url" placeholder="https://..." value="${escapeHtml(prize.imageUrl || "")}" />
        </label>
        <button data-kind="prize-remove" data-index="${idx}" type="button" class="btn btn-danger small">Delete</button>
      `;
      prizeEditor.appendChild(row);
    });

    prizeEditor.querySelectorAll("input, button").forEach((el) => {
      el.addEventListener("change", handlePrizeEdit);
      el.addEventListener("click", handlePrizeEdit);
    });
  }

  function handleFieldEdit(event) {
    const idx = Number(event.target.dataset.index);
    if (!Number.isInteger(idx)) return;

    const kind = event.target.dataset.kind;
    if (kind === "field-remove") {
      config.fields.splice(idx, 1);
      renderFieldsEditor();
      return;
    }

    const field = config.fields[idx];
    if (!field) return;

    if (kind === "field-label") field.label = event.target.value;
    if (kind === "field-type") field.type = event.target.value;
    if (kind === "field-required") field.required = event.target.checked;
    if (kind === "field-enabled") field.enabled = event.target.checked;
  }

  function handlePrizeEdit(event) {
    const idx = Number(event.target.dataset.index);
    if (!Number.isInteger(idx)) return;

    const kind = event.target.dataset.kind;
    if (kind === "prize-remove") {
      config.prizes.splice(idx, 1);
      renderPrizeEditor();
      return;
    }

    const prize = config.prizes[idx];
    if (!prize) return;

    if (kind === "prize-name") prize.name = event.target.value;
    if (kind === "prize-weight") prize.weight = Number(event.target.value);
    if (kind === "prize-inventory") prize.inventory = Number(event.target.value);
    if (kind === "prize-color") prize.color = event.target.value;
    if (kind === "prize-image-url") prize.imageUrl = event.target.value.trim();
  }

  function addField() {
    config.fields.push({
      id: `custom_${Date.now()}`,
      label: "Custom Field",
      type: "text",
      required: false,
      enabled: true,
    });
    renderFieldsEditor();
  }

  function addPrize() {
    const color = store.generateUniquePrizeColor(config.prizes.map((p) => p.color));
    config.prizes.push({
      id: `prize_${Date.now()}`,
      name: "New Prize",
      weight: 10,
      inventory: -1,
      color,
      imageUrl: "",
    });
    renderPrizeEditor();
  }

  async function saveConfig() {
    config.eventName = refs.eventName.value.trim();
    config.eventBadge = refs.eventBadge.value.trim();
    config.headline = refs.headline.value.trim();
    config.subheadline = refs.subheadline.value.trim();
    config.franchise.locationName = refs.locationName.value.trim();
    config.franchise.addressLine1 = refs.address1.value.trim();
    config.franchise.addressLine2 = refs.address2.value.trim();
    config.franchise.city = refs.city.value.trim();
    config.franchise.state = refs.state.value.trim();
    config.franchise.postalCode = refs.postalCode.value.trim();
    config.theme.primary = refs.primary.value;
    config.theme.accent = refs.accent.value;
    config.theme.bg = refs.bg.value;
    config.wheel.spinDurationMs = Number(refs.spinDuration.value);
    config.wheel.minRotations = Number(refs.minRotations.value);
    config.wheel.maxRotations = Number(refs.maxRotations.value);
    config.wheelStyle.pointerColor = refs.wheelPointerColor.value;
    config.wheelStyle.labelColor = refs.wheelLabelColor.value;
    config.wheelStyle.separatorColor = refs.wheelSeparatorColor.value;
    config.wheelStyle.centerFillColor = refs.wheelCenterFillColor.value;
    config.wheelStyle.centerStrokeColor = refs.wheelCenterStrokeColor.value;
    config.publicUrl = refs.publicUrl.value.trim();
    config.raffleUrl = refs.raffleUrl.value.trim();
    config.raffle = config.raffle || {};
    config.raffle.title = refs.raffleTitle.value.trim() || "Live Raffle";
    config.raffle.description = refs.raffleDescription.value.trim() || "Enter for your chance to win.";
    config.raffle.prizes = [
      { name: refs.rafflePrize1.value.trim() || "Prize 1", imageUrl: refs.rafflePrize1Image.value.trim() },
      { name: refs.rafflePrize2.value.trim() || "Prize 2", imageUrl: refs.rafflePrize2Image.value.trim() },
      { name: refs.rafflePrize3.value.trim() || "Prize 3", imageUrl: refs.rafflePrize3Image.value.trim() },
    ];
    config.raffle.drawAt = fromDateTimeLocal(refs.raffleDrawAt.value);
    config.raffle.acceptEntries = refs.raffleAcceptEntries.checked;

    config = store.saveConfig(config, franchiseId);
    await persistConfigToServer(config);
    renderFieldsEditor();
    renderPrizeEditor();
    renderQr();
    renderRaffleLink();
    setMessage(`Configuration saved for '${franchiseId}'.`);
  }

  async function resetConfig() {
    config = store.resetConfig(franchiseId);
    await persistConfigToServer(config);
    hydrateForm();
    setMessage(`Configuration reset for '${franchiseId}'.`);
  }

  async function persistConfigToServer(nextConfig) {
    try {
      const response = await apiFetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ franchiseId, config: nextConfig }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      setMessage(`Saved locally for '${franchiseId}'. Server sync failed.`);
    }
  }

  function renderQr() {
    const text = refs.publicUrl.value.trim();
    if (!text) {
      refs.qrImage.removeAttribute("src");
      refs.qrTargetUrl.textContent = "";
      return;
    }

    const playerUrl = store.withFranchiseParam(text, franchiseId);
    refs.qrTargetUrl.textContent = playerUrl;
    const encoded = encodeURIComponent(playerUrl);
    refs.qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encoded}`;
  }

  function renderRaffleLink() {
    const base = refs.raffleUrl.value.trim() || `${window.location.origin}/raffle.html`;
    const raffleUrl = store.withFranchiseParam(base, franchiseId);
    refs.raffleTargetUrl.textContent = raffleUrl;
    const encoded = encodeURIComponent(raffleUrl);
    if (refs.raffleQrImage) {
      refs.raffleQrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encoded}`;
    }
    const raffleLink = document.querySelector('.footer-note a[href="./raffle.html"]');
    if (raffleLink) raffleLink.href = `./raffle.html?franchise=${encodeURIComponent(franchiseId)}`;
  }

  async function refreshRaffleStatus() {
    try {
      const response = await apiFetch(`/api/raffle/status?franchise=${encodeURIComponent(franchiseId)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      raffleStatus = {
        entriesCount: Number(payload.entriesCount) || 0,
        winners: Array.isArray(payload.winners) ? payload.winners : [],
        drawnAt: payload.drawnAt || "",
      };
      renderRaffleWinners();
      refs.raffleSummary.textContent = raffleStatus.drawnAt
        ? `Entries: ${raffleStatus.entriesCount}. Last draw: ${formatCapturedAt(raffleStatus.drawnAt)}.`
        : `Entries: ${raffleStatus.entriesCount}. Draw has not run yet.`;
    } catch (error) {
      raffleStatus = { entriesCount: 0, winners: [], drawnAt: "" };
      renderRaffleWinners();
      refs.raffleSummary.textContent = "Could not load raffle status.";
    }
  }

  async function refreshRaffleEntries() {
    try {
      const response = await apiFetch(`/api/raffle/entries?franchise=${encodeURIComponent(franchiseId)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const entries = Array.isArray(payload.entries) ? payload.entries : [];
      renderRaffleEntries(entries);
    } catch (error) {
      refs.raffleEntriesTableBody.innerHTML = `<tr><td colspan="4">Could not load raffle entries.</td></tr>`;
    }
  }

  function renderRaffleEntries(entries) {
    refs.raffleEntriesTableBody.innerHTML = entries.length
      ? entries
          .map(
            (entry) => `<tr>
              <td>${escapeHtml(formatCapturedAt(entry.enteredAt))}</td>
              <td>${escapeHtml(entry.name || "")}</td>
              <td>${escapeHtml(entry.email || "")}</td>
              <td>${escapeHtml(entry.phone || "")}</td>
            </tr>`
          )
          .join("")
      : `<tr><td colspan="4">No raffle entries yet.</td></tr>`;
  }

  function renderRaffleWinners() {
    const winners = raffleStatus.winners || [];
    refs.raffleWinnersTableBody.innerHTML = winners.length
      ? winners
          .map(
            (winner) => `<tr>
              <td>${escapeHtml(winner.prize || "")}</td>
              <td>${winner.prizeImageUrl ? `<img class="raffle-prize-image" src="${escapeHtml(winner.prizeImageUrl)}" alt="Prize image" />` : "—"}</td>
              <td>${escapeHtml(winner.name || "")}</td>
              <td>${escapeHtml(winner.email || "")}</td>
              <td>${escapeHtml(winner.phone || "")}</td>
            </tr>`
          )
          .join("")
      : `<tr><td colspan="5">No winners selected yet.</td></tr>`;
  }

  async function runRaffleDraw() {
    try {
      const response = await apiFetch("/api/raffle/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ franchiseId }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await refreshRaffleStatus();
      await refreshRaffleEntries();
      setMessage(`Raffle draw completed for '${franchiseId}'.`);
    } catch (error) {
      setMessage("Raffle draw failed.");
    }
  }

  async function resetRaffle() {
    try {
      const response = await apiFetch("/api/raffle/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ franchiseId }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await refreshRaffleStatus();
      await refreshRaffleEntries();
      setMessage(`Raffle reset for '${franchiseId}'.`);
    } catch (error) {
      setMessage("Could not reset raffle.");
    }
  }

  async function exportRaffleEntries() {
    try {
      const response = await apiFetch(`/api/raffle/entries?franchise=${encodeURIComponent(franchiseId)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!(payload.count > 0)) {
        setMessage(`No raffle entries to export for '${franchiseId}'.`);
        return;
      }
      const link = document.createElement("a");
      link.href = `/api/raffle/download?franchise=${encodeURIComponent(franchiseId)}&format=csv`;
      link.download = "";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await refreshRaffleEntries();
      setMessage(`Downloaded ${payload.count} raffle entries for '${franchiseId}'.`);
    } catch (error) {
      setMessage("Raffle export failed.");
    }
  }

  async function refreshLeadsLookup() {
    try {
      const response = await apiFetch(`/api/leads?franchise=${encodeURIComponent(franchiseId)}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      leadsCache = Array.isArray(payload.leads) ? payload.leads : [];
    } catch (error) {
      leadsCache = store.getLeads(franchiseId);
    }
    renderLeadsTable();
  }

  function renderLeadsTable() {
    const search = refs.leadSearchInput.value.trim().toLowerCase();
    const rows = leadsCache
      .map((lead) => ({
        capturedAt: lead.capturedAt || "",
        eventName: lead.eventName || config.eventName || "",
        name: lead.name || "",
        phone: lead.phone || "",
        email: lead.email || "",
        prizeName: lead.wonPrizeName || lead.prizeName || lead.prizeId || "",
      }))
      .filter((lead) => {
        if (!search) return true;
        return [lead.eventName, lead.name, lead.phone, lead.email, lead.prizeName].join(" ").toLowerCase().includes(search);
      })
      .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));

    refs.leadsTableBody.innerHTML = rows.length
      ? rows
          .map(
            (lead) => `<tr>
              <td>${escapeHtml(formatCapturedAt(lead.capturedAt))}</td>
              <td>${escapeHtml(lead.eventName)}</td>
              <td>${escapeHtml(lead.name)}</td>
              <td>${escapeHtml(lead.phone)}</td>
              <td>${escapeHtml(lead.email)}</td>
              <td>${escapeHtml(lead.prizeName)}</td>
            </tr>`
          )
          .join("")
      : `<tr><td colspan="6">No matching leads for this franchise.</td></tr>`;
  }

  function formatCapturedAt(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }

  async function loadTests() {
    try {
      const response = await apiFetch("/api/tests");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      testsCache = Array.isArray(payload.tests) ? payload.tests : [];
      renderTestsTable();
      refs.testSummary.textContent = `Loaded ${testsCache.length} tests for Test, USA (${testFranchiseId}).`;
    } catch (error) {
      testsCache = [];
      renderTestsTable();
      refs.testSummary.textContent = "Could not load tests.";
    }
  }

  function renderTestsTable() {
    refs.testsTableBody.innerHTML = testsCache.length
      ? testsCache
          .map(
            (test) => `<tr>
              <td>${escapeHtml(test.id)}</td>
              <td>${escapeHtml(test.name)}</td>
              <td>${escapeHtml(test.description || "")}</td>
            </tr>`
          )
          .join("")
      : `<tr><td colspan="3">No tests loaded.</td></tr>`;
  }

  async function runTests() {
    refs.testSummary.textContent = "Running tests...";
    try {
      const response = await apiFetch("/api/tests/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ franchiseId: testFranchiseId }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const report = await response.json();
      renderTestResults(report);
      refs.testSummary.textContent = `Test run complete for Test, USA (${testFranchiseId}): ${report.passed}/${report.total} passed, ${report.failed} failed.`;
    } catch (error) {
      refs.testResultsTableBody.innerHTML = `<tr><td colspan="4">Test execution failed.</td></tr>`;
      refs.testSummary.textContent = "Test execution failed.";
    }
  }

  function renderTestResults(report) {
    const rows = Array.isArray(report.results) ? report.results : [];
    refs.testResultsTableBody.innerHTML = rows.length
      ? rows
          .map(
            (result) => `<tr>
              <td>${escapeHtml(result.status)}</td>
              <td>${escapeHtml(result.id)}</td>
              <td>${escapeHtml(String(result.durationMs || 0))}</td>
              <td>${escapeHtml(result.error || "")}</td>
            </tr>`
          )
          .join("")
      : `<tr><td colspan="4">No test results.</td></tr>`;
  }

  async function exportLeads() {
    try {
      const response = await apiFetch(`/api/leads?franchise=${encodeURIComponent(franchiseId)}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      if (!payload.count) {
        setMessage(`No leads to export for '${franchiseId}'.`);
        return;
      }

      const link = document.createElement("a");
      link.href = `/api/leads/download?franchise=${encodeURIComponent(franchiseId)}&format=csv`;
      link.download = "";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setMessage(`Downloaded ${payload.count} leads for '${franchiseId}'.`);
    } catch (error) {
      const leads = store.getLeads(franchiseId);
      if (!leads.length) {
        setMessage(`No leads to export for '${franchiseId}'.`);
        return;
      }
      const csv = store.toCsv(leads);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trade-show-leads-${franchiseId}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage(`Server unavailable. Exported browser copy (${leads.length} leads).`);
    }
  }

  async function clearLeads() {
    try {
      const response = await apiFetch(`/api/leads?franchise=${encodeURIComponent(franchiseId)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      setMessage(`Could not clear lead file for '${franchiseId}'.`);
      return;
    }
    store.clearLeads(franchiseId);
    leadsCache = [];
    renderLeadsTable();
    setMessage(`All leads cleared for '${franchiseId}'.`);
  }

  function setMessage(msg) {
    messageEl.textContent = msg;
    setTimeout(() => {
      if (messageEl.textContent === msg) {
        messageEl.textContent = "";
      }
    }, 3000);
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function toDateTimeLocal(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function fromDateTimeLocal(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString();
  }
})();
