(function () {
  const store = window.SpinWheelStore;
  const franchiseId = store.getFranchiseIdFromUrl();
  let config = store.getConfig(franchiseId);

  const refs = {
    logo: document.getElementById("raffleLogo"),
    badge: document.getElementById("raffleBadge"),
    title: document.getElementById("raffleTitle"),
    description: document.getElementById("raffleDescription"),
    franchiseInfo: document.getElementById("raffleFranchiseInfo"),
    name: document.getElementById("raffleName"),
    email: document.getElementById("raffleEmail"),
    phone: document.getElementById("rafflePhone"),
    scanBtn: document.getElementById("scanCardBtn"),
    scanInput: document.getElementById("scanCardInput"),
    scanStatus: document.getElementById("scanStatus"),
    ocrDebug: document.getElementById("ocrDebug"),
    ocrText: document.getElementById("ocrText"),
    submitBtn: document.getElementById("raffleSubmitBtn"),
    formMessage: document.getElementById("raffleFormMessage"),
    statusText: document.getElementById("raffleStatusText"),
    prizeGallery: document.getElementById("rafflePrizeGallery"),
    winnersBody: document.getElementById("raffleWinnersBody"),
  };

  refs.submitBtn.addEventListener("click", submitEntry);
  refs.scanBtn.addEventListener("click", () => refs.scanInput.click());
  refs.scanInput.addEventListener("change", handleScan);
  bootstrap();
  setInterval(refreshStatus, 10000);

  async function bootstrap() {
    await syncConfigFromServer();
    applyBranding(config);
    await refreshStatus();
    const adminLink = document.querySelector('.footer-note a[href="./admin.html"]');
    if (adminLink) adminLink.href = `./admin.html?franchise=${encodeURIComponent(franchiseId)}`;
  }

  async function syncConfigFromServer() {
    try {
      const response = await fetch(`/api/config?franchise=${encodeURIComponent(franchiseId)}`);
      if (!response.ok) return;
      const payload = await response.json();
      if (payload && payload.config && typeof payload.config === "object") {
        config = store.saveConfig(payload.config, franchiseId);
      }
    } catch (error) {
      // local config fallback
    }
  }

  function applyBranding(cfg) {
    document.documentElement.style.setProperty("--primary", cfg.theme.primary);
    document.documentElement.style.setProperty("--accent", cfg.theme.accent);
    document.documentElement.style.setProperty("--bg", cfg.theme.bg);

    refs.logo.src = cfg.logoPath || "./assets/dw_logo.svg";
    refs.badge.textContent = (cfg.raffle && cfg.raffle.title) || "Live Raffle";
    refs.title.textContent = (cfg.raffle && cfg.raffle.title) || "Live Raffle";
    refs.description.textContent = (cfg.raffle && cfg.raffle.description) || "Enter for your chance to win.";

    const franchiseParts = [
      cfg.franchise.locationName,
      cfg.franchise.addressLine1,
      cfg.franchise.addressLine2,
      [cfg.franchise.city, cfg.franchise.state, cfg.franchise.postalCode].filter(Boolean).join(" "),
    ].filter(Boolean);
    refs.franchiseInfo.textContent = franchiseParts.join(" • ");
  }

  async function submitEntry() {
    const name = refs.name.value.trim();
    const email = refs.email.value.trim();
    const phone = refs.phone.value.trim();

    if (!name || !email || !phone) {
      refs.formMessage.textContent = "Name, email, and phone are required.";
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      refs.formMessage.textContent = "Please enter a valid email address.";
      return;
    }

    if (phone.replace(/\D/g, "").length < 10) {
      refs.formMessage.textContent = "Please enter a valid phone number.";
      return;
    }

    refs.submitBtn.disabled = true;
    try {
      const response = await fetch("/api/raffle/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          franchiseId,
          entry: { name, email, phone },
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      refs.formMessage.textContent = "Entry submitted. Winners will appear on this page after the draw.";
      refs.name.value = "";
      refs.email.value = "";
      refs.phone.value = "";
      await refreshStatus();
    } catch (error) {
      refs.formMessage.textContent = error.message || "Could not submit entry.";
    } finally {
      refs.submitBtn.disabled = false;
    }
  }

  async function refreshStatus() {
    try {
      const response = await fetch(`/api/raffle/status?franchise=${encodeURIComponent(franchiseId)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();

      const entriesCount = Number(payload.entriesCount) || 0;
      const winners = Array.isArray(payload.winners) ? payload.winners : [];
      const drawnAt = payload.drawnAt || "";
      const raffleConfig = payload.raffle || {};

      if (drawnAt) {
        refs.statusText.textContent = `Draw completed on ${formatDateTime(drawnAt)}. ${entriesCount} total entries.`;
      } else if (raffleConfig.drawAt) {
        refs.statusText.textContent = `Draw is scheduled for ${formatDateTime(raffleConfig.drawAt)}. ${entriesCount} entries so far.`;
      } else {
        refs.statusText.textContent = `${entriesCount} entries so far. Winners will appear here once the draw is run.`;
      }

      renderPrizeGallery(raffleConfig.prizes || []);

      refs.submitBtn.disabled = raffleConfig.acceptEntries === false;
      if (raffleConfig.acceptEntries === false && !drawnAt) {
        refs.formMessage.textContent = "Raffle entries are currently closed.";
      }

      refs.winnersBody.innerHTML = winners.length
        ? winners
            .map(
              (winner) => `<tr>
                <td>${escapeHtml(winner.prize || "")}</td>
                <td>${winner.prizeImageUrl ? `<img class="raffle-prize-image" src="${escapeHtml(winner.prizeImageUrl)}" alt="Prize image" />` : "—"}</td>
                <td>${escapeHtml(winner.name || "")}</td>
              </tr>`
            )
            .join("")
        : `<tr><td colspan="3">No winners yet.</td></tr>`;
    } catch (error) {
      refs.statusText.textContent = "Could not load raffle status.";
      refs.winnersBody.innerHTML = `<tr><td colspan="4">Status unavailable.</td></tr>`;
    }
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderPrizeGallery(prizes) {
    if (!refs.prizeGallery) return;
    const items = Array.isArray(prizes) ? prizes : [];
    refs.prizeGallery.innerHTML = items.length
      ? items
          .map((prize) => {
            const name = prize && prize.name ? prize.name : "Prize";
            const image = prize && prize.imageUrl ? prize.imageUrl : "";
            return `<div class="raffle-prize-card">
              <div class="raffle-prize-media">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" />` : `<div class="raffle-prize-placeholder">Prize</div>`}</div>
              <div class="raffle-prize-name">${escapeHtml(name)}</div>
            </div>`;
          })
          .join("")
      : "";
  }

  async function handleScan(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    refs.scanStatus.textContent = "Scanning business card...";
    refs.ocrDebug.classList.add("hidden");
    refs.ocrText.textContent = "";
    refs.scanBtn.disabled = true;

    try {
      const text = await recognizeTextFromImage(file);
      const extracted = parseBusinessCard(text);
      if (extracted.name && !refs.name.value) refs.name.value = extracted.name;
      if (extracted.email && !refs.email.value) refs.email.value = extracted.email;
      if (extracted.phone && !refs.phone.value) refs.phone.value = extracted.phone;
      refs.scanStatus.textContent = extracted.foundAny ? "Details filled from scan. Please review." : "Scan completed. No details detected.";
      if (text) {
        refs.ocrDebug.classList.remove("hidden");
        refs.ocrText.textContent = text.trim();
      }
    } catch (error) {
      refs.scanStatus.textContent = "Could not scan business card.";
    } finally {
      refs.scanBtn.disabled = false;
      refs.scanInput.value = "";
    }
  }

  async function recognizeTextFromImage(file) {
    if (window.RaffleOcrProvider && typeof window.RaffleOcrProvider.recognize === "function") {
      return window.RaffleOcrProvider.recognize(file);
    }

    if (!window.Tesseract || typeof window.Tesseract.recognize !== "function") {
      throw new Error("OCR provider not available");
    }

    const prepared = await preprocessImage(file);
    const result = await window.Tesseract.recognize(prepared, "eng", { logger: () => {} });
    return (result && result.data && result.data.text) ? result.data.text : "";
  }

  async function preprocessImage(file) {
    const dataUrl = await fileToDataUrl(file);
    const img = await loadImage(dataUrl);
    const maxWidth = 1400;
    const scale = Math.min(1, maxWidth / img.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      const boosted = Math.min(255, gray * 1.1 + 10);
      data[i] = boosted;
      data[i + 1] = boosted;
      data[i + 2] = boosted;
    }
    ctx.putImageData(imageData, 0, 0);

    return canvas.toDataURL("image/jpeg", 0.85);
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function parseBusinessCard(text) {
    const cleaned = String(text || "").replace(/\r/g, "");
    const lines = cleaned.split("\n").map((line) => line.trim()).filter(Boolean);
    const normalized = normalizeOcrText(cleaned);

    const emailMatch = normalized.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = findPhoneNumber(normalized);

    const email = emailMatch ? emailMatch[0] : "";
    const phone = phoneMatch || "";
    const name = findBestName(lines, email);

    return {
      name,
      email,
      phone,
      foundAny: Boolean(name || email || phone),
    };
  }

  function normalizeOcrText(text) {
    return String(text || "")
      .replace(/\s*@\s*/g, "@")
      .replace(/\s*\.\s*/g, ".")
      .replace(/\s+dot\s+/gi, ".")
      .replace(/\s+at\s+/gi, "@")
      .replace(/[|]/g, "l");
  }

  function findPhoneNumber(text) {
    const matches = text.match(/(\+?\d[\d\s().-]{7,}\d)/g) || [];
    for (const match of matches) {
      const digitsOnly = match.replace(/\D/g, "");
      if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
        return digitsOnly.length === 11 && digitsOnly.startsWith("1") ? digitsOnly.slice(1) : digitsOnly;
      }
    }
    const fallbackDigits = text.replace(/\D/g, "");
    if (fallbackDigits.length >= 10) {
      const last10 = fallbackDigits.slice(-10);
      return last10;
    }
    return "";
  }

  function findBestName(lines, email) {
    const banned = /(llc|inc|ltd|company|corp|co\.|pllc|pc|clinic|wellness|franchise|center|group|office|suite|owner|director|manager|president|ceo|cfo|cto|vp|sales|marketing|founder)/i;
    const candidates = [];

    for (const raw of lines) {
      if (raw.includes("@")) continue;
      if (/www\.|http/i.test(raw)) continue;
      if (/\d/.test(raw)) continue;
      if (raw.length < 3 || raw.length > 40) continue;
      if (banned.test(raw)) continue;

      const cleaned = raw.replace(/[^a-zA-Z\s'-]/g, " ").replace(/\s+/g, " ").trim();
      if (cleaned.length < 3) continue;

      const words = cleaned.split(" ");
      if (words.length > 4) continue;

      const score = scoreName(cleaned);
      candidates.push({ value: cleaned, score });
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0] ? normalizeName(candidates[0].value) : "";

    if (best) return best;

    if (email) {
      const local = email.split("@")[0] || "";
      const guess = local.replace(/[._-]+/g, " ").replace(/\d+/g, " ").trim();
      return normalizeName(guess);
    }

    return "";
  }

  function scoreName(value) {
    const words = value.split(" ");
    let score = 0;
    if (words.length >= 2 && words.length <= 3) score += 3;
    if (words.length === 1) score += 1;
    if (value.length >= 6 && value.length <= 24) score += 2;
    const capWords = words.filter((w) => /^[A-Z]/.test(w)).length;
    score += capWords;
    return score;
  }

  function normalizeName(value) {
    if (!value) return "";
    const cleaned = value.replace(/[^a-zA-Z\s'-]/g, " ").replace(/\s+/g, " ").trim();
    if (!cleaned) return "";
    return cleaned
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }
})();
