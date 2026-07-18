/** UI state helpers */ 
function clearAllPopups() {
  ["error-msg", "warning-msg", "no-span-message"].forEach(id => {
    document.getElementById(id)?.remove();
  });
}

function showPopup(type, message, id, container, focusTarget = null) {
  if (!container) {
    logger.error("showPopup: container is missing for message:", message);
    return;
  }

  clearAllPopups()
  container.style.position = "relative";
  const popup = document.createElement("div");
  popup.id = id;
  //popup.className = `message-popup ${type === "success" ? "success-popup" : "warning-popup"}`;
  popup.className = `message-popup ${POPUP_MESSAGES[type]}`
  popup.style.visibility = "visible";

  const msg = document.createElement("span");
  msg.textContent = message;

  const closeBtn = document.createElement("button");
  closeBtn.className = "popup-close-btn";
  closeBtn.appendChild(svgToNode(ICONS.close));
  closeBtn.setAttribute("aria-label", "Chiudi messaggio");
  closeBtn.addEventListener("click", () => {
    popup.remove();
    document.getElementById("fairly-live").textContent = "";

    // Usato per fine analisi spostare focus sugli span
    if (focusTarget) {
      const target = typeof focusTarget === "string"
        ? document.querySelector(focusTarget)
        : focusTarget;
      target?.focus();
    }
  });

  popup.appendChild(msg);
  popup.appendChild(closeBtn);
  container.appendChild(popup);

  document.getElementById("fairly-live").textContent = message;
}

function setLoadingState(isLoading) {
  const analyzeBtn = document.getElementById("analyze");

  if (!analyzeBtn) {
    logger.error("setLoadingState: 'analyze' button not found in DOM.");
    return;
  }

  if (isLoading) {
    analyzeBtn.disabled = true;
    analyzeBtn.dataset.originalText = analyzeBtn.textContent;
    const spinner = document.createElement("span");
    spinner.className = "spinner";
    analyzeBtn.replaceChildren(spinner);
    document.getElementById("fairly-live").textContent = "Analisi in corso...";
  } else {
    analyzeBtn.disabled = false;
    analyzeBtn.replaceChildren(document.createTextNode(analyzeBtn.dataset.originalText || "Analizza"));
  }
}

function setResultButtons(visible) {
  const acceptBtn = document.getElementById("accept-all");
  const refuseBtn = document.getElementById("refuse-all");
  if (!acceptBtn || !refuseBtn) {
    logger.error("setResultButtons: 'accept-all' or 'refuse-all' buttons are missing from the DOM.");
    return;
  }

  const display = visible ? "block" : "none";
  const hidden = !visible;

  [acceptBtn, refuseBtn].forEach(btn => {
    btn.style.display = display;
    btn.inert = hidden;
    hidden
      ? btn.setAttribute("aria-hidden", "true")
      : btn.removeAttribute("aria-hidden");
  });

  document.getElementById("info-btn-wrapper").style.justifyContent =
    visible ? "space-between" : "flex-end";
}