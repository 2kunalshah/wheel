(function () {
  const store = window.SpinWheelStore;
  const franchiseId = store.getFranchiseIdFromUrl();
  let config = store.getConfig(franchiseId);

  const messageEl = document.getElementById("adminMessage");
  const fieldsEditor = document.getElementById("fieldsEditor");
  const prizeEditor = document.getElementById("prizeEditor");

  const refs = {
    franchiseSelect: document.getElementById("cfgFranchiseSelect"),
    newFranchiseId: document.getElementById("cfgNewFranchiseId"),
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
    qrImage: document.getElementById("qrImage"),
  };

  hydrateForm();

  document.getElementById("createFranchiseBtn").addEventListener("click", createFranchise);
  refs.franchiseSelect.addEventListener("change", switchFranchise);
  document.getElementById("addFieldBtn").addEventListener("click", addField);
  document.getElementById("addPrizeBtn").addEventListener("click", addPrize);
  document.getElementById("saveCfgBtn").addEventListener("click", saveConfig);
  document.getElementById("resetCfgBtn").addEventListener("click", resetConfig);
  document.getElementById("exportLeadsBtn").addEventListener("click", exportLeads);
  document.getElementById("clearLeadsBtn").addEventListener("click", clearLeads);
  refs.publicUrl.addEventListener("input", renderQr);

  function hydrateForm() {
    renderFranchiseOptions();

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

    const defaultPublic = `${window.location.origin}${window.location.pathname.replace("admin.html", "index.html")}`;
    refs.publicUrl.value = config.publicUrl || store.withFranchiseParam(defaultPublic, franchiseId);
    const playerLink = document.querySelector('.footer-note a[href=\"./index.html\"]');
    if (playerLink) {
      playerLink.href = `./index.html?franchise=${encodeURIComponent(franchiseId)}`;
    }

    renderFieldsEditor();
    renderPrizeEditor();
    renderQr();
  }

  function renderFranchiseOptions() {
    const franchises = store.listFranchises();
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

  function createFranchise() {
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

  function saveConfig() {
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

    config = store.saveConfig(config, franchiseId);
    renderFieldsEditor();
    renderPrizeEditor();
    renderQr();
    setMessage(`Configuration saved for '${franchiseId}'.`);
  }

  function resetConfig() {
    config = store.resetConfig(franchiseId);
    hydrateForm();
    setMessage(`Configuration reset for '${franchiseId}'.`);
  }

  function renderQr() {
    const text = refs.publicUrl.value.trim();
    if (!text) {
      refs.qrImage.removeAttribute("src");
      return;
    }

    const playerUrl = store.withFranchiseParam(text, franchiseId);
    const encoded = encodeURIComponent(playerUrl);
    refs.qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encoded}`;
  }

  async function exportLeads() {
    try {
      const response = await fetch(`/api/leads?franchise=${encodeURIComponent(franchiseId)}`);
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
      const response = await fetch(`/api/leads?franchise=${encodeURIComponent(franchiseId)}`, {
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
})();
