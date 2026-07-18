/** Widget and UI elements construction */
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
  img.src = chrome.runtime.getURL("fairly_logo_fata.png");
  img.className = "fairly-logo";
  img.alt = "Fairly - apri pannello";
  return img;
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
      logger.warn("createChecklistItem: invalid strategyName", strategyName);
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
      arrowBtn.appendChild(svgToNode(arrowDownSVG));
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

      // saved strategy selection
      // const shouldExpand = savedStrategy ? savedStrategy.startsWith(strategyName + "-") : false;
      const shouldExpand = false

      nestedDiv.className = "nested-checklist";
      nestedDiv.style.display = shouldExpand ? "flex" : "none";
      nestedDiv.setAttribute("role", "radiogroup");
      nestedDiv.setAttribute("aria-hidden", shouldExpand ? "false" : "true");
      nestedDiv.setAttribute(
        "aria-label",
        `Opzioni per la strategia ${labelText}`
      );

      if (shouldExpand) {
        arrowBtn.replaceChildren(svgToNode(arrowUpSVG));
        arrowBtn.setAttribute("aria-expanded", "true");
      }

      // Loop through the possible options for the current strategy
      nestedOption.forEach((optText, idx) => {

        const radioId = `${strategyName}-${idx}`;
        // const isChecked = savedStrategy ? (savedStrategy === radioId) : (defaultSelected && idx === 0);

        // Create label and checkbox for option
        const nestedLabel = document.createElement("label");
        const nestedCheckbox = createRadio(
          radioId,
          `Opzione della strategia ${labelText}: ${optText}`,
          false
        );
        nestedCheckbox.tabIndex = shouldExpand ? 0 : -1;

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

        arrowBtn.replaceChildren(svgToNode(isExpanding ? arrowUpSVG : arrowDownSVG));
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
          //firstRadio?.click();
        }
      });
    } else {
      const radioId = strategyName;
      //const isChecked = savedStrategy ? (savedStrategy === radioId) : defaultSelected;
      const label = document.createElement("label");
      const checkbox = createRadio(radioId, `Strategia inclusiva: ${labelText}`, false);

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(" " + labelText));
      item.appendChild(label);
    }

    if (strategyInfo) {
      const infoBtn = document.createElement("button");
      infoBtn.className = "info-btn";
      infoBtn.appendChild(svgToNode(ICONS.info));
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
      const p = document.createElement("p");
      p.className = "info-popover-text";
      const a = document.createElement("a");
      a.textContent = "qui";
      a.href = LINK.INFO;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.style.marginLeft = "4px";
      a.addEventListener("click", (e) => {
        const infoData = {
          user_id: USER_EMAIL,
          session_id: SESSION_ID,
          strategy: strategyName,
          findout_more: true,
        };

        chrome.runtime.sendMessage({
          action: "storeInfo",
          payload: infoData
        });
      });
      p.appendChild(document.createTextNode(strategyInfo + " " + "Puoi saperne di più "));
      p.appendChild(a);
      p.appendChild(document.createTextNode("."))

      //infoPopover.textContent = strategyInfo;
      infoPopover.appendChild(p);
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
        const infoData = {
          user_id: USER_EMAIL,
          session_id: SESSION_ID,
          strategy: strategyName,
          findout_more: false,
        };

        chrome.runtime.sendMessage({
          action: "storeInfo",
          payload: infoData
        });
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

function collapseAllNested(exceptDiv, exceptBtn) {
  document.querySelectorAll(".nested-checklist").forEach(div => {
    if (div === exceptDiv) return;
    div.style.display = "none";
    div.setAttribute("aria-hidden", "true");
    div.querySelectorAll('input[type="radio"]').forEach(r => { r.tabIndex = -1; });
  });
  document.querySelectorAll(".arrow-btn").forEach(btn => {
    if (btn === exceptBtn) return;
    btn.replaceChildren(svgToNode(ICONS.arrowDown));
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
  logo.src = chrome.runtime.getURL("fairly_logo_fata_scritta.png");
  logo.className = "fairly-logo-complete";
  logo.alt = "Fairly";
  infoDiv.appendChild(logo);

  // Add text 
  const paragraph = document.createElement("p");
  paragraph.innerText = "Scegli una soluzione piú inclusiva!";
  infoDiv.appendChild(paragraph);

  // last used strategy
  // const savedStrategy = chrome.storage.local.getItem("fairlyLastStrategy");

  // Check-list container 
  const checklist = document.createElement("div");
  checklist.className = "checklist";
  checklist.setAttribute("role", "radiogroup");
  checklist.setAttribute("aria-label", "Seleziona una strategia inclusiva");

  // Create the strategies options 
  STRATEGY_ORDER.forEach((strategy, idx) => {
    let strategyObj = STRATEGIES[strategy];
    if (!strategyObj) {
      logger.warn(`Strategy '${strategy}' found in order but missing from STRATEGIES.`);
      return;
    }
    let hasNested = strategyObj.nestedOptions.length > 0 ? true : false;
    // let defaultSelected = idx === 0;
    checklist.appendChild(
      createChecklistItem(
        strategyObj.name,
        strategyObj.id,
        hasNested,
        strategyObj.info,
        strategyObj.nestedOptions,
        // defaultSelected
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
    accept({ isAll: true });
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
    discard({ isAll: true });
  });
  // ------------------- Analyze button -------------------
  const analyzeButton = document.createElement("button");
  analyzeButton.id = "analyze";
  analyzeButton.className = "analyze-btn";
  analyzeButton.textContent = "Analizza";

  // Start analysis when clicking on analyze button
  analyzeButton.addEventListener("click", (e) => {
    e.stopPropagation(); // Prevents document click listener from clearing the popup
    setLoadingState(true);
    startAnalysis();
  });

  // Privacy policy link
  const privacyLink = document.createElement("a");
  privacyLink.href = LINK.PRIVACY;
  privacyLink.textContent = "Privacy Policy";
  privacyLink.target = "_blank"; // Browser opens the link in a new tab
  privacyLink.rel = "noopener noreferrer"; // Prevents tab nabbing
  privacyLink.className = "privacy-link";
  privacyLink.setAttribute("aria-label", "Apri la Privacy Policy in una nuova scheda");

  buttonWrapper.appendChild(acceptAllBtn);
  buttonWrapper.appendChild(refuseAllBtn);
  buttonWrapper.appendChild(analyzeButton);
  infoDiv.appendChild(checklist);
  infoDiv.appendChild(buttonWrapper);
  infoDiv.appendChild(privacyLink);

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
        'button:not([disabled]), input:not([disabled]), a, [tabindex="0"]'
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

