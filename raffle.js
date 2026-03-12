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

      refs.submitBtn.disabled = raffleConfig.acceptEntries === false;
      if (raffleConfig.acceptEntries === false && !drawnAt) {
        refs.formMessage.textContent = "Raffle entries are currently closed.";
      }

      refs.winnersBody.innerHTML = winners.length
        ? winners
            .map(
              (winner) => `<tr>
                <td>${escapeHtml(winner.prize || "")}</td>
                <td>${escapeHtml(winner.name || "")}</td>
              </tr>`
            )
            .join("")
        : `<tr><td colspan="2">No winners yet.</td></tr>`;
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
      if (!extracted.foundAny && text) {
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

    const emailMatch = cleaned.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}/);
    const phoneMatch = cleaned.match(/(\\+?\\d[\\d\\s().-]{7,}\\d)/);

    let name = "";
    for (const line of lines) {
      if (line.includes("@")) continue;
      if (/\d/.test(line)) continue;
      if (line.length > 40) continue;
      if (line.length < 3) continue;
      name = line;
      break;
    }

    const email = emailMatch ? emailMatch[0] : "";
    const phone = phoneMatch ? phoneMatch[0].replace(/\\s+/g, " ").trim() : "";

    return {
      name,
      email,
      phone,
      foundAny: Boolean(name || email || phone),
    };
  }
})();
