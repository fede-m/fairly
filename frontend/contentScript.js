let SESSION_ID = null;
let USER_EMAIL = null;
let STRATEGY_ORDER = null;
/* Create HTML elements for the UI */
function createWidget() {
  /**
   * Creates the main Fairly widget container element.
   * This is the draggable floating widget that appears on the page.
   * @returns {HTMLDivElement} The widget container div element
   */
  const widget = document.createElement("div");
  widget.id = "fairly-widget";
  widget.className = "widget-div";
  widget.setAttribute("role", "complementary");
  widget.setAttribute("aria-label", "Fairly widget");
  const img = document.createElement("img");
  img.id = "fairly-widget-toggle";
  return widget;
}

function createImgLogo() {
  /**
   * Creates the Fairly logo image element for the widget.
   * Uses chrome.runtime.getURL to resolve the extension's internal resource path.
   * @returns {HTMLImageElement} The logo image element
   */
  const img = document.createElement("img");
  // The chrome.runtime.getURL('fairly_logo.png') constructs a full internal URL to the extension's resources 
  img.src = chrome.runtime.getURL("fairly_logo.png");
  img.className = "fairly-logo";
  img.alt = "Fairly - apri pannello";
  return img;
}

function emailEndsWithAllowedDomain() {
  return DOMAINS.some(d => USER_EMAIL.toLowerCase().endsWith(d))
}

function initializeSession() {
  // Get user email
  const meta = document.getElementsByName("og-profile-acct");

  if (!meta || !meta.length) {
    console.warn("Could not find user email meta tag.");
    return false;
  }

  USER_EMAIL = meta[0].content;
  if (!emailEndsWithAllowedDomain()) {
    console.warn("Not a valid domain!");
    return false;
  }

<<<<<<< accessibility
  // Get session ID
  SESSION_ID = crypto.randomUUID();
  console.log(SESSION_ID);

  try {
=======
    // Get session ID
    SESSION_ID = crypto.randomUUID();
    
>>>>>>> main
    // Get strategies order
    const strategyOrder = localStorage.getItem("fairlyStrategyOrder");
    if (strategyOrder) {
      STRATEGY_ORDER = JSON.parse(strategyOrder);
    } else {
<<<<<<< accessibility
      const strategies = Object.keys(STRATEGIES);
      const randomizedOrder = [...strategies].sort(() => Math.random() - 0.5)
      localStorage.setItem("fairlyStrategyOrder", JSON.stringify(randomizedOrder));
      STRATEGY_ORDER = randomizedOrder;
    }
  } catch (e) {
    console.warn("localStorage unavailable, using random strategy order.", e);
    STRATEGY_ORDER = Object.keys(STRATEGIES).sort(() => Math.random() - 0.5);
  }

  return true;
}


function setLoadingState(isLoading) {
  const analyzeBtn = document.getElementById("analyze");

  if (!analyzeBtn) return;

  if (isLoading) {
    analyzeBtn.disabled = true;
    analyzeBtn.dataset.originalText = analyzeBtn.textContent;
    analyzeBtn.innerHTML = `<span class="spinner"></span>`;
    document.getElementById("fairly-live").textContent = "Analisi in corso...";
  } else {
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = analyzeBtn.dataset.originalText || "Analizza";
  }
}

function clearAllPopups() {
  ["warning-msg", "no-span-message"].forEach(id => {
    document.getElementById(id)?.remove();
  });
}

function showPopup(type, message, id, container, focusTarget = null) {
  clearAllPopups()

  container.style.position = "relative";

  const popup = document.createElement("div");
  popup.id = id;
  popup.className = `message-popup ${type === "success" ? "success-popup" : "warning-popup"}`;
  // popup.setAttribute("role", type === "success" ? "status" : "alert"); ridondante ?

  const msg = document.createElement("span");
  msg.textContent = message;

  const closeBtn = document.createElement("button");
  closeBtn.className = "popup-close-btn";
  closeBtn.innerHTML = ICONS.close;
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
=======
        const strategies = Object.keys(STRATEGIES);
        const randomizedOrder = [...strategies].sort(() => Math.random() - 0.5)
        localStorage.setItem("fairlyStrategyOrder", JSON.stringify(randomizedOrder));
        STRATEGY_ORDER =randomizedOrder;
>>>>>>> main
    }

  });

  popup.appendChild(msg);
  popup.appendChild(closeBtn);
  container.appendChild(popup);

  document.getElementById("fairly-live").textContent = message;
}

function setResultButtons(visible) {
  const acceptBtn = document.getElementById("accept-all");
  const refuseBtn = document.getElementById("refuse-all");
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

function startAnalysis() {
  // TODO: Store interaction (selected strategy) in MongoDB
  // TODO: Add loading animation while waiting for the model response


  /**
   * Initiates the inclusive language analysis on the current Gmail page.
   * First discards any previously highlighted spans, then:
   * 1. Verifies the page is Gmail (mail.google.com)
   * 2. Collects all contenteditable elements (open email drafts)
   * 3. Validates that a strategy is selected from the checklist
   * 4. Packages email IDs and text content with the selected strategy
   * 5. Sends data to background.js for backend processing
   * Displays a warning popup if no editable emails are found.
   * @returns {void}
  */

  // Perform both detection and generation sequentially 
  const currentLocation = window.location.href;
  // Delete all spans that were not accepted
  discard();

  if (currentLocation.startsWith("https://mail.google.com/")) {
    // remove pop-ups
    clearAllPopups()
    // Select all elements on the page which are editable (the open emails) 
    const editableElements = document.querySelectorAll('[contenteditable="true"]');
    // Check if there are open emails 
    if (editableElements.length > 0) {

      // Store editable elements with their text content 
      const dataObj = {};
      const selected = document.querySelector(".checklist-choice:checked");

      if (!selected) {
        setLoadingState(false);
        console.warn("No strategy selected!");
        return;
      }

      // Prepare payload for background
      dataObj["strategy"] = selected.id;
      dataObj["data"] = []
      editableElements.forEach((element) => {
        const data = {};
        const key = element.id;
        data["id"] = key;
        data["text"] = element.innerText;
        dataObj["data"].push(data);
      });

      console.log(dataObj);
      // Send data to background 
      chrome.runtime.sendMessage({
        action: "analyseData",
        payload: dataObj,
      })
    } else {
      // Create new warning popup
      const btnWrapper = document.getElementById("info-btn-wrapper");
      showPopup("warning", "Non ci sono mail da analizzare!", "warning-msg", btnWrapper);
      setLoadingState(false);
    }
  };
}

function createRadio(id, ariaLabel, defaultChecked = false) {
  const input = document.createElement("input");
  input.type = "radio";
  input.name = "strategy";
  input.className = "thickbox checklist-choice";
  input.id = id;
  input.setAttribute("aria-label", ariaLabel);
  input.checked = defaultChecked;
  return input;
}

function collapseAllNested(exceptDiv, exceptBtn) {
  document.querySelectorAll(".nested-checklist").forEach(div => {
    if (div === exceptDiv) return;
    div.style.display = "none";
    div.setAttribute("aria-hidden", "true");
    div.querySelectorAll('input[type="radio"]').forEach(r => { r.tabIndex = -1; });
  });
  document.querySelectorAll(".arrow-btn").forEach(btn => {
    if (btn === exceptBtn) return;
    btn.innerHTML = ICONS.arrowDown;
    btn.setAttribute("aria-expanded", "false");
  });
}

const closeAllInfoPopovers = (focusTriggerId = null) => {
  document.querySelectorAll(".info-popover").forEach((p) => {
    p.hidden = true;
    p.setAttribute("aria-hidden", "true");

    const triggerId = p.dataset.triggerId;
    const trigger = triggerId ? document.getElementById(triggerId) : null;
    if (trigger) {
      trigger.setAttribute("aria-expanded", "false");
      trigger.removeAttribute("aria-describedby");
    }
  });

  if (focusTriggerId) {
    document.getElementById(focusTriggerId)?.focus();
  }
};

function createInfoDiv() {
  /**
   * Creates the main info panel that appears when clicking on the widget.
   * Contains the strategy selection checklist (with nested options for each strategy)
   * and action buttons (Analyze, Accept All, Refuse All).
   * @returns {HTMLDivElement} The info panel div element
   */

  /* -----------------  infoDiv element ----------------- */
  const infoDiv = document.createElement("div");
  infoDiv.id = "fairly-info";
  infoDiv.className = "info-div";
  infoDiv.style.display = "none";
  infoDiv.setAttribute("role", "dialog");
  infoDiv.setAttribute("aria-modal", "true");
  infoDiv.setAttribute("aria-label", "Fairly - scegli strategia inclusiva");
  infoDiv.setAttribute("tabindex", "-1");

  /* -----------------  infoDiv content ----------------- */
  // Add tab bar at the top of the div with widget title 
  const logo = document.createElement("img");
  logo.src = chrome.runtime.getURL("logo_merge3.png");
  logo.className = "fairly-logo-complete";
  logo.alt = "Fairly";
  infoDiv.appendChild(logo);

  // Add text 
  const paragraph = document.createElement("p");
  paragraph.innerText = "Scegli una soluzione piú inclusiva!";
  infoDiv.appendChild(paragraph);

  // Check-list container 
  const checklist = document.createElement("div");
  checklist.className = "checklist";
  checklist.setAttribute("role", "radiogroup");
  checklist.setAttribute("aria-label", "Seleziona una strategia inclusiva");

  function createChecklistItem(labelText, strategyName, hasNested, strategyInfo, nestedOption = [], defaultSelected = false) {
    /**
     * Helper function to create a checklist item for each strategy.
     * Supports both simple checkboxes and expandable nested options with accordion behavior.
     * Only one option can be selected at a time across all checklist items.
     * @param {string} labelText - Display label for the checklist item (e.g., "Doppia forma (M/F)")
     * @param {string} strategyName - Strategy identifier from STRATEGIES constant (CV, CO, IO, IV)
     * @param {boolean} hasNested - Whether this item has expandable nested options
     * @param {string[]} [nestedOption=[]] - Array of nested option labels to display
     * @param {boolean} [defaultSelected=false] - Whether the first nested option should be pre-selected
     * @returns {HTMLDivElement} The checklist item element
     */

    const item = document.createElement("div");

    if (!strategyName || !Object.keys(STRATEGIES).includes(strategyName)) {
      console.warn("createChecklistItem: invalid strategyName", strategyName);
      return item;
    }

    item.className = "checklist-item";
    item.setAttribute(
      "aria-label",
      `Strategia inclusiva: ${labelText}. ${hasNested ? "Contiene opzioni selezionabili" : "Selezionabile direttamente"}`
    );

    if (hasNested && (nestedOption.length > 0)) {
      // Create the item to contain arrow and label on the same line
      const container = document.createElement("div");
      container.className = "options-container";
      // Create arrows to toggle the nested options
      const arrowDownSVG = ICONS.arrowDown;
      const arrowUpSVG = ICONS.arrowUp;

      const arrowBtn = document.createElement("button");
      arrowBtn.className = "arrow-btn";
      arrowBtn.innerHTML = arrowDownSVG;
      arrowBtn.setAttribute(
        "aria-label",
        `Espandi opzioni per la strategia: ${labelText}`
      );
      arrowBtn.setAttribute("aria-expanded", "false")
      arrowBtn.style.cursor = "pointer";
      arrowBtn.style.marginRight = "8px";

      // Create the label for the options (e.g. "Doppia forma")
      const label = document.createElement("span");
      label.textContent = labelText;
      label.style.cursor = "pointer";

      // Append all the elements to the container and current item
      container.appendChild(arrowBtn);
      container.appendChild(label);
      item.appendChild(container);

      // Create the div for the nested options (e.g. "lo studente e la studente")
      const nestedDiv = document.createElement("div");
      nestedDiv.className = "nested-checklist";
      nestedDiv.style.display = "none";
      nestedDiv.setAttribute("role", "radiogroup");
      nestedDiv.setAttribute("aria-hidden", "true");
      nestedDiv.setAttribute(
        "aria-label",
        `Opzioni per la strategia ${labelText}`
      );

      // Loop through the possible options for the current strategy
      nestedOption.forEach((optText, idx) => {

        // Create label and checkbox for option
        const nestedLabel = document.createElement("label");
        const nestedCheckbox = createRadio(
          `${strategyName}-${idx}`,
          `Opzione della strategia ${labelText}: ${optText}`,
          defaultSelected && idx === 0
        );
        nestedCheckbox.tabIndex = -1;

        nestedLabel.appendChild(nestedCheckbox);
        nestedLabel.appendChild(document.createTextNode(" " + optText));
        nestedDiv.appendChild(nestedLabel);
      });
      item.appendChild(nestedDiv);
      // Show/hide nested options on parent 
      // Remove cursor from arrowBtn, let container handle it
      arrowBtn.style.pointerEvents = "none";
      container.style.cursor = "pointer";
      container.addEventListener("click", () => {
        const isExpanding = nestedDiv.style.display === "none";
        nestedDiv.style.display = isExpanding ? "flex" : "none";
        nestedDiv.setAttribute("aria-hidden", !isExpanding ? "true" : "false");

        // Toggle keyboard accessibility
        nestedDiv.querySelectorAll('input[type="radio"]').forEach(radio => {
          radio.tabIndex = isExpanding ? 0 : -1;
        });

        arrowBtn.innerHTML = isExpanding ? arrowUpSVG : arrowDownSVG;
        arrowBtn.setAttribute("aria-expanded", isExpanding ? "true" : "false");
        arrowBtn.setAttribute(
          "aria-label",
          `${isExpanding ? "Comprimi" : "Espandi"} opzioni per la strategia: ${labelText}`
        );

        if (isExpanding) {
          // Close other nested divs
          collapseAllNested(nestedDiv, arrowBtn);
          const firstRadio = nestedDiv.querySelector('input[type="radio"]');
          firstRadio?.focus();
          firstRadio?.click();
        }
      });
    } else {
      const label = document.createElement("label");
      const checkbox = createRadio(strategyName, `Strategia inclusiva: ${labelText}`);

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(" " + labelText));
      item.appendChild(label);
    }

    if (strategyInfo) {
      const infoBtn = document.createElement("button");
      infoBtn.className = "info-btn";
      infoBtn.innerHTML = ICONS.info;
      infoBtn.type = "button";

      const safeId = String(strategyName).toLowerCase().replace(/[^a-z0-9_-]/g, "");
      const triggerId = `info-btn-${safeId}`;
      const popoverId = `info-popover-${safeId}`;

      infoBtn.id = triggerId;
      infoBtn.setAttribute("aria-expanded", "false");
      infoBtn.setAttribute("aria-controls", popoverId);
      infoBtn.setAttribute("aria-haspopup", "true");

      const infoPopover = document.createElement("div");
      infoPopover.className = "info-popover";
      infoPopover.id = popoverId;
      infoPopover.setAttribute("aria-hidden", "true");
      infoPopover.setAttribute("tabindex", "-1");
      infoPopover.dataset.triggerId = triggerId;
      infoPopover.textContent = strategyInfo;
      infoPopover.hidden = true;

      const updateButtonLabel = () => {
        const isOpen = !infoPopover.hidden;
        infoBtn.setAttribute("aria-label",
          isOpen ? `Chiudi informazioni su ${labelText}` : `Apri informazioni su ${labelText}`
        );
        infoBtn.setAttribute("aria-expanded", String(isOpen));
      };

      const openPopover = () => {
        closeAllInfoPopovers();

        // Move to infoDiv if not already there
        const panel = infoBtn.closest(".info-div");
        if (panel && !panel.contains(infoPopover)) {
          panel.appendChild(infoPopover);
        }

        infoPopover.hidden = false;
        infoPopover.setAttribute("aria-hidden", "false");
        infoBtn.setAttribute("aria-describedby", popoverId);
        updateButtonLabel();

        // Position relative to infoDiv
        requestAnimationFrame(() => {
          const panelRect = panel.getBoundingClientRect();
          const btnRect = infoBtn.getBoundingClientRect();
          infoPopover.style.top = (btnRect.bottom - panelRect.top + 6) + "px";
          infoPopover.style.right = (panelRect.right - btnRect.right) + "px";
          infoPopover.focus();
        });

        // screenreader reads this
        const srHint = document.createElement("span");
        srHint.className = "sr-only";
        srHint.textContent = "Premi Escape per chiudere.";
        infoPopover.appendChild(srHint);
      };

      const closePopover = (returnFocusToTrigger = false) => {
        infoPopover.hidden = true;
        infoPopover.setAttribute("aria-hidden", "true");
        infoBtn.removeAttribute("aria-describedby");
        updateButtonLabel();
        // Keep focus inside the checklist item
        if (returnFocusToTrigger) {
          infoBtn.focus();
        }
      };

      infoBtn.addEventListener("click", (e) => {
        infoPopover.hidden ? openPopover() : closePopover(false);
      });

      infoBtn.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" && infoPopover.hidden) {
          e.preventDefault();
          e.stopPropagation();
          openPopover();
        }
        if (e.key === "Escape" && !infoPopover.hidden) {
          e.preventDefault();
          e.stopPropagation();
          closePopover(true);
        }
      });

      infoPopover.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          closePopover(true);
        }
      });

      updateButtonLabel();

      item.appendChild(infoBtn);
    }

    return item;
  }

  // Create the strategies options 
  STRATEGY_ORDER.forEach((strategy, idx) => {
    let strategyObj = STRATEGIES[strategy];
    let hasNested = strategyObj.nestedOptions.length > 0 ? true : false;
    let defaultSelected = idx === 0;
    checklist.appendChild(
      createChecklistItem(
        strategyObj.name,
        strategyObj.id,
        hasNested,
        strategyObj.info,
        strategyObj.nestedOptions,
        defaultSelected
      ));
  })

  /* -------------- Create buttons ----------------------------- */
  const buttonWrapper = document.createElement("div");
  buttonWrapper.id = "info-btn-wrapper";
  buttonWrapper.className = "btn-wrapper";

  // ------------------- Accept all button -------------------
  const acceptAllBtn = document.createElement("button");
  acceptAllBtn.id = "accept-all";
  acceptAllBtn.className = "accept-all-btn";
  acceptAllBtn.textContent = 'Accetta tutto';
  acceptAllBtn.inert = true; /*prevents accessibility tree*/
  acceptAllBtn.style.display = "none";
  acceptAllBtn.setAttribute("aria-hidden", "true");
  acceptAllBtn.addEventListener("click", () => {
    accept();
  });
  // ------------------- Refuse all button -------------------
  const refuseAllBtn = document.createElement("button");
  refuseAllBtn.id = "refuse-all";
  refuseAllBtn.className = "refuse-all-btn";
  refuseAllBtn.textContent = "Rifiuta tutto";
  refuseAllBtn.inert = true; /*prevents accessibility tree*/
  refuseAllBtn.style.display = "none";
  refuseAllBtn.setAttribute("aria-hidden", "true");
  refuseAllBtn.addEventListener("click", () => {
    discard();
  });
  // ------------------- Analyze button -------------------
  const analyzeButton = document.createElement("button");
  analyzeButton.id = "analyze";
  analyzeButton.className = "analyze-btn";
  analyzeButton.textContent = "Analizza";

  // Start analysis when clicking on analyze button
  analyzeButton.addEventListener("click", () => {
    setLoadingState(true);
    startAnalysis();
  });


  buttonWrapper.appendChild(acceptAllBtn);
  buttonWrapper.appendChild(refuseAllBtn);
  buttonWrapper.appendChild(analyzeButton);
  infoDiv.appendChild(checklist);
  infoDiv.appendChild(buttonWrapper);

  // ESC closes open popover and keeps focus inside widget
  // focus trap
  infoDiv.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const openPopover = infoDiv.querySelector('.info-popover:not([hidden])');
      if (!openPopover) return;
      e.preventDefault();
      e.stopPropagation();
      closeAllInfoPopovers(openPopover.dataset.triggerId || null);
    }
    if (e.key === "Tab") {
      const focusable = [...infoDiv.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [tabindex="0"]'
      )].filter(el => !el.closest('[aria-hidden="true"]'));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // popover closing if clicking oustide of it
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".info-btn") && !e.target.closest(".info-popover")) {
      closeAllInfoPopovers();
    }
  });

  return infoDiv;
}

/* helper for the spanpopupdiv */
function setSpanText(spanEl, value) {
  const textNode = Array.from(spanEl.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
  if (textNode) textNode.nodeValue = value;
  else spanEl.insertBefore(document.createTextNode(value), spanEl.firstChild);
}

function createSpanPopupDiv(spanEl) {
  /**
   * Creates a popup div for an individual highlighted span.
   * Displays the original text (crossed out) and provides controls to:
   * - Edit: Enter a custom inclusive reformulation
   * - Save: Save the user's custom reformulation (which is then displayed, still highlighted, inside the email)
   * - Revert: Restore the AI-suggested reformulation
   * - Accept: Apply the current reformulation and remove the highlight
   * - Refuse: Discard the reformulation and restore the original text
   * @param {HTMLSpanElement} spanEl - The highlighted span element this popup is associated with
   * @returns {HTMLDivElement} The popup div element
   */

  // saves users reformulations history
  const history = []

  // Create the div element
  const spanDiv = document.createElement("div");
  spanDiv.id = `div-${spanEl.id}`;
  spanDiv.className = "span-div";
  spanDiv.style.display = "none";
  spanDiv.setAttribute("role", "dialog");
  spanDiv.setAttribute("aria-label", `Opzioni per: ${spanEl.dataset.original}`);
  spanDiv.setAttribute("tabindex", "-1");

  // close on esc
  spanDiv.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { spanDiv.style.display = "none"; spanEl.focus(); }
    if (e.key === "Tab") {
      const focusable = [...spanDiv.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [tabindex="0"]'
      )];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Show the old text
  const p = document.createElement("p");
  //p.style.padding = "0px";
  p.innerHTML = `<strong><del>${spanEl.dataset.original}</del><strong>`;
  p.style.margin = "0 0 8px 0";

  const inputWrap = document.createElement("div");
  inputWrap.className = "input-wrap";

  const inputLabel = document.createElement("label");
  inputLabel.setAttribute("for", `user-ref-${spanEl.id}`);
  inputLabel.textContent = "Accetta la riformulazione Fairly o scrivi la tua riformulazione inclusiva.";//\nSalvandola, Fairly la proporrà nelle future analisi.";
  inputLabel.className = "span-div-input-label";

  const inputFormulation = document.createElement("input");
  inputFormulation.id = `user-ref-${spanEl.id}`;
  inputFormulation.type = "text";
  inputFormulation.placeholder = "Es. studenti e studentesse";
  /*inputFormulation.value = spanEl.dataset.currentUsed ?? "";*/
  inputFormulation.addEventListener("click", e => e.stopPropagation());

  inputWrap.appendChild(inputLabel);
  inputWrap.appendChild(inputFormulation);

  // Buttons
  const spanBtnWrap = document.createElement("div");
  spanBtnWrap.className = "btn-wrapper span-div-btn-wrapper";

  // Accept (keep current span text, no input change)
  const accBtn = document.createElement("button");
  accBtn.className = "span-action-btn span-acc-btn";
  accBtn.textContent = "Accetta";
  accBtn.setAttribute("aria-label", "Accetta questa riformulazione");
  accBtn.addEventListener("click", e => {
    e.stopPropagation();
    const input = inputFormulation.value.trim();
    if (input) {
      spanEl.dataset.userContent = input;
      spanEl.dataset.currentUsed = input;
      setSpanText(spanEl, input);
    }

    // move focus to the next span
    const all = [...document.querySelectorAll("span.highlight")];
    const next = all[all.indexOf(spanEl) + 1];
    (next ?? document.getElementById("analyze")).focus();

    accept(spanEl);
    spanDiv.style.display = "none";
  });

  // Save & accept (apply input value then accept)
  //const saveAccBtn = document.createElement("button");
  //saveAccBtn.className = "span-action-btn span-save-acc-btn";
  //saveAccBtn.textContent = "Salva e accetta";
  //saveAccBtn.setAttribute("aria-label", "Salva la tua riformulazione e accetta");
  //
  //// Initially disable the button
  //saveAccBtn.disabled = true;
  //// Listen for input changes
  //inputFormulation.addEventListener("input", () => {
  //  saveAccBtn.disabled = !inputFormulation.value.trim();
  //});
  //
  //saveAccBtn.addEventListener("click", e => {
  //  e.stopPropagation();
  //  const input = inputFormulation.value.trim();
  //  if (input) {
  //    history.push(spanEl.dataset.currentUsed);
  //    spanEl.dataset.userContent = input;
  //    spanEl.dataset.currentUsed = input;
  //    setSpanText(spanEl, input);
  //  }
  //  accept(spanEl);
  //  spanDiv.style.display = "none";
  //});

  // Discard (refuse, restore original)
  const discardBtn = document.createElement("button");
  discardBtn.className = "span-action-btn span-discard-btn";
  discardBtn.textContent = "Rifiuta";
  discardBtn.setAttribute("aria-label", "Rifiuta e ripristina testo originale");
  discardBtn.addEventListener("click", e => {
    e.stopPropagation();

    // move focus to the next span
    const all = [...document.querySelectorAll("span.highlight")];
    const next = all[all.indexOf(spanEl) + 1];
    (next ?? document.getElementById("analyze")).focus();

    discard(spanEl);
    spanDiv.style.display = "none";
  });

  // Revert to previous
  //const revertBtn = document.createElement("button");
  //revertBtn.className = "span-action-btn span-revert-btn";
  //revertBtn.textContent = "Ripristina";
  //revertBtn.setAttribute("aria-label", "Ripristina la riformulazione precedente");
  //revertBtn.addEventListener("click", e => {
  //  e.stopPropagation();
  //  if (history.length > 0) {
  //    const prev = history.pop();
  //    spanEl.dataset.currentUsed = prev;
  //    setSpanText(spanEl, prev);
  //    inputFormulation.value = prev;
  //  }
  //});

  spanBtnWrap.appendChild(accBtn);
  //spanBtnWrap.appendChild(saveAccBtn);
  spanBtnWrap.appendChild(discardBtn);
  //spanBtnWrap.appendChild(revertBtn);

  spanDiv.appendChild(p);
  spanDiv.appendChild(inputWrap);
  spanDiv.appendChild(spanBtnWrap);
  spanDiv.addEventListener("click", e => e.stopPropagation());

  return spanDiv
}

function initExtension() {

  /**
   * Initializes the Fairly Chrome extension on the current page.
   * Creates a unique session ID, builds the widget UI (logo + info panel),
   * appends it to the document body, and sets up:
   * - Drag-and-drop functionality for repositioning the widget
   * - Click handler to toggle the info panel visibility
   * - Document click handler to close span popups when clicking outside
   * Guards against duplicate initialization by checking for existing widget.
   * @returns {void}
  */

  // Initialize Session with user information and create Session ID
  if (!initializeSession()) {
    return;
  };

  // Check if a widget already exists 
  if (document.getElementById("fairly-widget")) return;


  /* --------- Initialize Widget elements --------- */
  const widget = createWidget();
  const img = createImgLogo();

  img.setAttribute("aria-expanded", "false");
  img.setAttribute("role", "button");
  img.setAttribute("tabindex", "0");
  img.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      img.click();
    }
  });

  const infoDiv = createInfoDiv();
  // Append elements following hierarchy 
  widget.appendChild(img);
  widget.appendChild(infoDiv);
  document.body.appendChild(widget);
  // live region for dynamic announcements
  const liveRegion = document.createElement("div");
  liveRegion.id = "fairly-live";
  liveRegion.setAttribute("aria-live", "polite");
  liveRegion.setAttribute("aria-atomic", "true");
  liveRegion.className = "sr-only";
  liveRegion.setAttribute("role", "status");
  document.body.appendChild(liveRegion);
  // Implement dragging 
  let offsetX = 0, offsetY = 0;
  // store where inside the widget the mouse was clicked 
  let isDragging = false; // tracks whether the mouse is currently dragging the widget 
  let moved = false; // track if the user has moved the widget to distinguish a drag from a click

  img.addEventListener("mousedown", (e) => {
    isDragging = true;
    moved = false;
    // Get the widget current pixel position and calculate the offset inside the element 
    const rect = widget.getBoundingClientRect();
    // Calculate distance from widget's top/left edge to where the user clicked --> needed to avoid the widget to jump to align to its left corner when you start dragging 
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    // Switch from bottom-right coordinates to top-left 
    widget.style.top = rect.top + "px";
    widget.style.left = rect.left + "px";
    widget.style.bottom = "";
    widget.style.right = "";
    // stops text/image selection from starting 
    e.preventDefault();
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - offsetX - parseInt(widget.style.left);
    const dy = e.clientY - offsetY - parseInt(widget.style.top);
    if (!moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) moved = true;
    widget.style.left = e.clientX - offsetX + "px";
    widget.style.top = e.clientY - offsetY + "px";
  });

  document.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
  });

  img.addEventListener("click", (e) => {
    // Open the infoDiv when clicking on the widget image 
    if (!moved) {
      const isOpen = infoDiv.style.display === "none";
      infoDiv.style.display = isOpen ? "block" : "none";
      img.setAttribute("aria-expanded", String(isOpen));
      if (isOpen) {
        infoDiv.setAttribute("aria-modal", "true");
        infoDiv.focus();
      } else {
        infoDiv.setAttribute("aria-modal", "false");
        closeAllInfoPopovers();
      }
    }
  });

  document.addEventListener("click", (e) => {
    // If click is not inside the span div or a highlight span, close all spandivs
    if (!e.target.closest(".span-div") && !e.target.closest(".highlight")) {
      document.querySelectorAll(".span-div").forEach(s => {
        s.style.display = "none";
      });
    }
    clearAllPopups();
  });

  // close the widget if esc is pressed and nothing else is open
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (infoDiv.style.display === "none") return;
    if (infoDiv.querySelector(".info-popover:not([hidden])")) return;
    if (document.querySelector(".span-div[style*='display: block']")) return;
    infoDiv.style.display = "none";
    img.setAttribute("aria-expanded", "false");
    img.focus();
  });
}


// Listens to messages coming from background.js --> in this case, the data processed from the backend
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "processedData") {
    setLoadingState(false);
    console.log(msg.payload);
    const response = msg.payload;

    /* ------------- Create the span elements in the email ------------- */
    let hasSpans = false;
    for (const id in response.results) {
      // Use ID to get the correct contenteditable window 
      const div = document.querySelector(`div[contenteditable="true"]#${CSS.escape(id)}` // NOTE: CSS.escape is used to escape the ":" in front of the id of the Gmail content windows 
      );
      const spans = response.results[id].unfair_spans;
      if (spans && spans.length > 0) {
        hasSpans = true;
        // Highligh the spans that were detected and their alternatives 
        highlightSpans(div, response.results[id].unfair_spans);
      }
    }

    /* ------------- Update buttons content ------------- */
    const btnWrapper = document.getElementById("info-btn-wrapper");

    if (hasSpans) {
      setResultButtons(true);
      // Remove existing messages
      clearAllPopups()
      showPopup("success", "Analisi completata. Premi sulle singole ri-formulazioni per accettare, rifiutare o proporre una tua riformulazione.", "no-span-message", btnWrapper, "span.highlight");
    } else {
      // Create new success message
      showPopup("success", "Analisi completata. Nessuno span non inclusivo trovato, ottimo lavoro!", "no-span-message", btnWrapper);
      // Keep analyze button as is, hide "Accept all" and "Refuse all", as there are no spans to accept
      setResultButtons(false);
    }
  }
});


// Create the extension on page load
<<<<<<< accessibility
window.addEventListener("load", () => {
  // Prevent multiple injection of the script in Gmail 
  if (window.__fairlyInitialized) return;

  window.__fairlyInitialized = true;
  setTimeout(initExtension, 2000);
=======
window.addEventListener("load", () => { 
    // Prevent multiple injection of the script in Gmail 
    if (window.__fairlyInitialized) return;

    window.__fairlyInitialized = true;
    setTimeout(initExtension, 2000); 
>>>>>>> main
});

// Just before reloading the page, we clean up any span introduced by our widget
// window.addEventListener("beforeunload", () => {
//     discard();
// });