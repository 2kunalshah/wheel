(function () {
  const CONFIG_KEY = "spinwheel.config.v1";
  const LEADS_KEY = "spinwheel.leads.v1";

  const defaultConfig = {
    eventBadge: "Trade Show Giveaway",
    headline: "Spin The Wheel",
    subheadline: "Enter your details for a chance to win.",
    logoPath: "./assets/dw_logo.svg",
    franchise: {
      locationName: "Degree Wellness Franchise",
      addressLine1: "123 Wellness Way",
      addressLine2: "",
      city: "Chicago",
      state: "IL",
      postalCode: "60601",
    },
    theme: {
      primary: "#2f5d63",
      accent: "#66aeb2",
      bg: "#f5f5f3",
    },
    publicUrl: "",
    fields: [
      {
        id: "name",
        label: "Full Name",
        type: "text",
        required: true,
        enabled: true,
      },
      {
        id: "phone",
        label: "Phone Number",
        type: "tel",
        required: true,
        enabled: true,
      },
      {
        id: "email",
        label: "Email Address",
        type: "email",
        required: true,
        enabled: true,
      },
    ],
    prizes: [
      {
        id: "p1",
        name: "Premium Swag Bag",
        weight: 5,
        inventory: 10,
        color: "#ff9f1c",
        imageUrl: "",
      },
      {
        id: "p2",
        name: "Coffee Gift Card",
        weight: 20,
        inventory: 40,
        color: "#2ec4b6",
        imageUrl: "",
      },
      {
        id: "p3",
        name: "Sticker Pack",
        weight: 35,
        inventory: 100,
        color: "#e71d36",
        imageUrl: "",
      },
      {
        id: "p4",
        name: "Thanks For Playing",
        weight: 40,
        inventory: -1,
        color: "#3a86ff",
        imageUrl: "",
      },
    ],
    wheel: {
      spinDurationMs: 5000,
      minRotations: 6,
      maxRotations: 10,
    },
    wheelStyle: {
      labelColor: "#ffffff",
      separatorColor: "#ffffff",
      centerFillColor: "#ffffff",
      centerStrokeColor: "#0e1222",
      pointerColor: "#19272d",
    },
  };

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function normalizeConfig(candidate) {
    const merged = Object.assign({}, clone(defaultConfig), candidate || {});
    merged.theme = Object.assign({}, defaultConfig.theme, (candidate && candidate.theme) || {});
    merged.wheel = Object.assign({}, defaultConfig.wheel, (candidate && candidate.wheel) || {});
    merged.wheelStyle = Object.assign({}, defaultConfig.wheelStyle, (candidate && candidate.wheelStyle) || {});
    merged.franchise = Object.assign({}, defaultConfig.franchise, (candidate && candidate.franchise) || {});
    merged.logoPath = String((candidate && candidate.logoPath) || defaultConfig.logoPath);

    if (!Array.isArray(merged.fields) || merged.fields.length === 0) {
      merged.fields = clone(defaultConfig.fields);
    }

    if (!Array.isArray(merged.prizes) || merged.prizes.length < 2) {
      merged.prizes = clone(defaultConfig.prizes);
    }

    merged.fields = merged.fields.map((f, idx) => ({
      id: sanitizeId(f.id || `field_${idx + 1}`),
      label: String(f.label || `Field ${idx + 1}`),
      type: normalizeFieldType(f.type),
      required: Boolean(f.required),
      enabled: f.enabled !== false,
    }));

    merged.prizes = merged.prizes.map((p, idx) => ({
      id: sanitizeId(p.id || `prize_${idx + 1}`),
      name: String(p.name || `Prize ${idx + 1}`),
      weight: Math.max(0, Number(p.weight) || 0),
      inventory: Number.isFinite(Number(p.inventory)) ? Number(p.inventory) : -1,
      color: isHexColor(p.color) ? p.color : randomColor(idx),
      imageUrl: typeof p.imageUrl === "string" ? p.imageUrl.trim() : "",
    }));
    enforceUniquePrizeColors(merged.prizes);

    merged.wheelStyle.labelColor = isHexColor(merged.wheelStyle.labelColor) ? merged.wheelStyle.labelColor : defaultConfig.wheelStyle.labelColor;
    merged.wheelStyle.separatorColor = isHexColor(merged.wheelStyle.separatorColor) ? merged.wheelStyle.separatorColor : defaultConfig.wheelStyle.separatorColor;
    merged.wheelStyle.centerFillColor = isHexColor(merged.wheelStyle.centerFillColor) ? merged.wheelStyle.centerFillColor : defaultConfig.wheelStyle.centerFillColor;
    merged.wheelStyle.centerStrokeColor = isHexColor(merged.wheelStyle.centerStrokeColor) ? merged.wheelStyle.centerStrokeColor : defaultConfig.wheelStyle.centerStrokeColor;
    merged.wheelStyle.pointerColor = isHexColor(merged.wheelStyle.pointerColor) ? merged.wheelStyle.pointerColor : defaultConfig.wheelStyle.pointerColor;

    merged.wheel.spinDurationMs = clampInt(merged.wheel.spinDurationMs, 1000, 15000, 5000);
    merged.wheel.minRotations = clampInt(merged.wheel.minRotations, 1, 30, 6);
    merged.wheel.maxRotations = clampInt(merged.wheel.maxRotations, merged.wheel.minRotations, 40, 10);

    return merged;
  }

  function clampInt(value, min, max, fallback) {
    const n = parseInt(value, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function randomColor(seed) {
    const colors = ["#ff9f1c", "#2ec4b6", "#e71d36", "#3a86ff", "#8338ec", "#06d6a0", "#ff006e"];
    return colors[seed % colors.length];
  }

  function enforceUniquePrizeColors(prizes) {
    const seen = new Set();
    prizes.forEach((prize) => {
      if (!isHexColor(prize.color) || seen.has(prize.color.toLowerCase())) {
        prize.color = generateUniquePrizeColor(Array.from(seen));
      }
      seen.add(prize.color.toLowerCase());
    });
  }

  function hsvToHex(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0;
    let g = 0;
    let b = 0;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function generateUniquePrizeColor(existingColors) {
    const existing = new Set((existingColors || []).map((c) => String(c).toLowerCase()));
    for (let i = 0; i < 40; i += 1) {
      const hue = Math.floor(Math.random() * 360);
      const sat = 0.58 + Math.random() * 0.3;
      const val = 0.7 + Math.random() * 0.25;
      const color = hsvToHex(hue, sat, val).toLowerCase();
      if (!existing.has(color)) return color;
    }
    return hsvToHex(Math.floor(Math.random() * 360), 0.7, 0.85);
  }

  function isHexColor(value) {
    return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
  }

  function sanitizeId(value) {
    return String(value)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "") || `id_${Date.now()}`;
  }

  function normalizeFieldType(type) {
    const allowed = ["text", "email", "tel", "number"];
    return allowed.includes(type) ? type : "text";
  }

  function getConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (!raw) return clone(defaultConfig);
      return normalizeConfig(JSON.parse(raw));
    } catch (e) {
      return clone(defaultConfig);
    }
  }

  function saveConfig(config) {
    const normalized = normalizeConfig(config);
    localStorage.setItem(CONFIG_KEY, JSON.stringify(normalized));
    return normalized;
  }

  function resetConfig() {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(defaultConfig));
    return clone(defaultConfig);
  }

  function getLeads() {
    try {
      const raw = localStorage.getItem(LEADS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveLeads(leads) {
    localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
  }

  function addLead(lead) {
    const leads = getLeads();
    leads.push(lead);
    saveLeads(leads);
  }

  function clearLeads() {
    localStorage.removeItem(LEADS_KEY);
  }

  function countPrizeWins(prizeId) {
    return getLeads().filter((lead) => lead.prizeId === prizeId).length;
  }

  function getAvailablePrizes(config) {
    return config.prizes.filter((prize) => prize.weight > 0).filter((prize) => {
      if (prize.inventory < 0) return true;
      return countPrizeWins(prize.id) < prize.inventory;
    });
  }

  function pickWeightedPrize(config) {
    const prizes = getAvailablePrizes(config);
    if (prizes.length === 0) return null;
    const total = prizes.reduce((sum, p) => sum + p.weight, 0);
    let cursor = Math.random() * total;
    for (let i = 0; i < prizes.length; i += 1) {
      cursor -= prizes[i].weight;
      if (cursor <= 0) return prizes[i];
    }
    return prizes[prizes.length - 1];
  }

  function toCsv(rows) {
    if (!rows.length) return "";
    const headers = Object.keys(rows[0]);
    const escape = (value) => {
      const s = value == null ? "" : String(value);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [headers.join(",")];
    rows.forEach((row) => lines.push(headers.map((h) => escape(row[h])).join(",")));
    return lines.join("\n");
  }

  window.SpinWheelStore = {
    defaultConfig: clone(defaultConfig),
    getConfig,
    saveConfig,
    resetConfig,
    getLeads,
    addLead,
    clearLeads,
    countPrizeWins,
    getAvailablePrizes,
    pickWeightedPrize,
    toCsv,
    generateUniquePrizeColor,
  };
})();
