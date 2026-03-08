(function () {
  const store = window.SpinWheelStore;
  const config = store.getConfig();

  const entrySection = document.getElementById("entrySection");
  const wheelSection = document.getElementById("wheelSection");
  const resultSection = document.getElementById("resultSection");
  const leadForm = document.getElementById("leadForm");
  const formError = document.getElementById("formError");
  const startSpinBtn = document.getElementById("startSpinBtn");
  const spinBtn = document.getElementById("spinBtn");
  const playAgainBtn = document.getElementById("playAgainBtn");
  const resultMessage = document.getElementById("resultMessage");
  const canvas = document.getElementById("wheelCanvas");
  const ctx = canvas.getContext("2d");

  const state = {
    leadPayload: null,
    currentRotation: 0,
    spinning: false,
  };

  applyBranding(config);
  buildForm(config);
  drawWheel(config.prizes, state.currentRotation);

  startSpinBtn.addEventListener("click", handleContinue);
  spinBtn.addEventListener("click", handleSpin);
  playAgainBtn.addEventListener("click", resetFlow);

  function applyBranding(cfg) {
    document.getElementById("eventBadge").textContent = cfg.eventBadge;
    document.getElementById("headline").textContent = cfg.headline;
    document.getElementById("subheadline").textContent = cfg.subheadline;
    document.documentElement.style.setProperty("--primary", cfg.theme.primary);
    document.documentElement.style.setProperty("--accent", cfg.theme.accent);
    document.documentElement.style.setProperty("--bg", cfg.theme.bg);
  }

  function buildForm(cfg) {
    leadForm.innerHTML = "";
    cfg.fields.filter((field) => field.enabled).forEach((field) => {
      const label = document.createElement("label");
      label.className = "full-width";
      label.textContent = field.label;

      const input = document.createElement("input");
      input.type = field.type;
      input.name = field.id;
      input.id = `f_${field.id}`;
      input.required = field.required;
      input.autocomplete = "off";
      label.appendChild(input);
      leadForm.appendChild(label);
    });
  }

  function validateForm() {
    const activeFields = config.fields.filter((f) => f.enabled);
    const payload = {};

    for (let i = 0; i < activeFields.length; i += 1) {
      const field = activeFields[i];
      const input = document.getElementById(`f_${field.id}`);
      const value = input ? input.value.trim() : "";
      payload[field.id] = value;

      if (field.required && !value) {
        return { valid: false, message: `${field.label} is required.` };
      }

      if (field.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return { valid: false, message: "Please enter a valid email address." };
      }

      if (field.type === "tel" && value && value.replace(/\D/g, "").length < 10) {
        return { valid: false, message: "Please enter a valid phone number." };
      }
    }

    return { valid: true, payload };
  }

  function handleContinue() {
    const validation = validateForm();
    if (!validation.valid) {
      formError.textContent = validation.message;
      return;
    }

    if (!store.getAvailablePrizes(config).length) {
      formError.textContent = "No prizes are currently available. Please see booth staff.";
      return;
    }

    formError.textContent = "";
    state.leadPayload = validation.payload;
    entrySection.classList.add("hidden");
    wheelSection.classList.remove("hidden");
  }

  function handleSpin() {
    if (state.spinning) return;
    const chosenPrize = store.pickWeightedPrize(config);
    if (!chosenPrize) {
      formError.textContent = "No prizes are currently available.";
      return;
    }

    state.spinning = true;
    spinBtn.disabled = true;

    const targetIndex = config.prizes.findIndex((p) => p.id === chosenPrize.id);
    const segmentSize = (Math.PI * 2) / config.prizes.length;
    const randomOffset = (Math.random() - 0.5) * (segmentSize * 0.5);
    const targetAngle = (Math.PI * 1.5) - (targetIndex * segmentSize + segmentSize / 2) + randomOffset;

    const minR = config.wheel.minRotations;
    const maxR = Math.max(minR, config.wheel.maxRotations);
    const rotations = minR + Math.floor(Math.random() * (maxR - minR + 1));

    const startRotation = state.currentRotation;
    const finalRotation = startRotation + rotations * Math.PI * 2 + normalizeAngle(targetAngle - normalizeAngle(startRotation));
    const duration = config.wheel.spinDurationMs;
    const startedAt = performance.now();

    function animate(now) {
      const elapsed = now - startedAt;
      const t = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(t);
      state.currentRotation = startRotation + (finalRotation - startRotation) * eased;
      drawWheel(config.prizes, state.currentRotation);

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        finishSpin(chosenPrize);
      }
    }

    requestAnimationFrame(animate);
  }

  function finishSpin(prize) {
    const lead = {
      id: `lead_${Date.now()}`,
      capturedAt: new Date().toISOString(),
      ...state.leadPayload,
      prizeId: prize.id,
      prizeName: prize.name,
    };

    store.addLead(lead);

    wheelSection.classList.add("hidden");
    resultSection.classList.remove("hidden");
    resultMessage.textContent = prize.name;

    spinBtn.disabled = false;
    state.spinning = false;
  }

  function resetFlow() {
    state.leadPayload = null;
    leadForm.reset();
    resultSection.classList.add("hidden");
    entrySection.classList.remove("hidden");
  }

  function normalizeAngle(angle) {
    const twoPi = Math.PI * 2;
    return ((angle % twoPi) + twoPi) % twoPi;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function drawWheel(prizes, rotation) {
    const size = canvas.width;
    const center = size / 2;
    const radius = center - 8;
    const segmentSize = (Math.PI * 2) / prizes.length;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(rotation);

    prizes.forEach((prize, i) => {
      const start = i * segmentSize;
      const end = start + segmentSize;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = prize.color;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.save();
      ctx.rotate(start + segmentSize / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px system-ui, sans-serif";
      ctx.fillText(prize.name.slice(0, 22), radius - 20, 6);
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#0e1222";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.restore();
  }
})();
