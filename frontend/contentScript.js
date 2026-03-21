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
  if (meta) {
    USER_EMAIL = meta[0].content;
  }
  if (!emailEndsWithAllowedDomain()) {
    console.warn("Not a valid domain!");
    return false;
  }

    // Get session ID
    SESSION_ID = crypto.randomUUID();
    
    // Get strategies order
    const strategyOrder = localStorage.getItem("fairlyStrategyOrder");
    if (strategyOrder){
        STRATEGY_ORDER = JSON.parse(strategyOrder);
    } else {
        const strategies = Object.keys(STRATEGIES);
        const randomizedOrder = [...strategies].sort(() => Math.random() - 0.5)
        localStorage.setItem("fairlyStrategyOrder", JSON.stringify(randomizedOrder));
        STRATEGY_ORDER =randomizedOrder;
    }
    return true;
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
    discard(span = undefined, ref_reason = "analysis_refresh");
    if (currentLocation.startsWith("https://mail.google.com/")) { 
        // Select all elements on the page which are editable (the open emails) 
        const editableElements = document.querySelectorAll('[contenteditable="true"]'); 
        // Check if there are open emails 
        if (editableElements.length > 0) {
            
            // Remove existing warning popup
            const existingWarning = document.getElementById("warning-msg");
            if (existingWarning) existingWarning.remove()
            
            // Store editable elements with their text content 
            const dataObj = {}; 
            const selected = document.querySelector(".checklist-choice:checked");

            // Prepare payload for background
            dataObj["strategy"] = selected.id; 
            dataObj["data"] = [];
            dataObj["session_id"] = SESSION_ID;
            dataObj["user_id"] = USER_EMAIL;

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
      // Remove existing warning popup
      const existingWarning = document.getElementById("warning-msg");
      if (existingWarning) existingWarning.remove()

      // Create new warning popup
      const warningPopup = document.createElement("div");
      warningPopup.className = "warning-popup message-popup";
      warningPopup.id = "warning-msg";

      const warningMsg = document.createElement("span");
      warningMsg.textContent = "Non ci sono mail da analizzare!";
      document.getElementById("fairly-live").textContent = "Non ci sono mail da analizzare.";

      const closeBtn = document.createElement("button");
      closeBtn.innerHTML = ICONS.close;
      closeBtn.className = "popup-close-btn";
      closeBtn.setAttribute("aria-label", "Chiudi avviso");
      closeBtn.addEventListener("click", () => {
        warningPopup.remove();
      })

      warningPopup.appendChild(warningMsg);
      warningPopup.appendChild(closeBtn);

      // Get button wrapper
      const btnWrapper = document.getElementById("info-btn-wrapper");
      btnWrapper.appendChild(warningPopup);
    }
  };
}

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
  const tabBar = document.createElement("div");
  tabBar.className = "top-bar";
  const logo = document.createElement("img");
  logo.src = chrome.runtime.getURL("fairly_logo_complete.png");
  logo.className = "fairly-logo-complete";
  logo.alt = "Fairly";
  tabBar.appendChild(logo);
  infoDiv.appendChild(tabBar);

  // Add text 
  const paragraph = document.createElement("p");
  paragraph.innerText = "Scegli una soluzione piú inclusiva!";
  paragraph.style.fontSize = "14px";
  infoDiv.appendChild(paragraph);

  // Check-list container 
  const checklist = document.createElement("div");
  checklist.className = "checklist";


  function createChecklistItem(labelText, strategyName, hasNested, nestedOption = [], defaultSelected = false) {
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


    // Check that the strategy name is correct 
    if (strategyName === null || (strategyName != null && !Object.keys(STRATEGIES).includes(strategyName))) {
      console.warn("createChecklistItem: invalid strategyName", strategyName)
      strategyName = ""
    }

    const item = document.createElement("div");
    item.className = "checklist-item";

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
      arrowBtn.setAttribute("aria-label", `Espandi opzioni: ${labelText}`);
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

      // Loop through the possible options for the current strategy
      nestedOption.forEach((optText, idx) => {

        // Create label and checkbox for option
        const nestedLabel = document.createElement("label");
        const nestedCheckbox = document.createElement("input");

        nestedCheckbox.type = "checkbox";
        nestedCheckbox.className = "thickbox checklist-choice";
        nestedCheckbox.id = `${strategyName}-${idx}`

        if (defaultSelected == true && idx == 0) {
          nestedCheckbox.checked = true;
        }
        nestedCheckbox.addEventListener("click", function () {
          document.querySelectorAll(".checklist-choice").forEach(cb => {
            cb.checked = cb === this;
          });
        });
        nestedLabel.appendChild(nestedCheckbox);
        nestedLabel.appendChild(document.createTextNode(" " + optText));
        nestedDiv.appendChild(nestedLabel);
      });
      item.appendChild(nestedDiv);
      // Show/hide nested options on parent 
      container.addEventListener("click", () => {

        if (nestedDiv.style.display == "none") {
          nestedDiv.style.display = "flex";
          arrowBtn.innerHTML = arrowUpSVG;
          arrowBtn.setAttribute("aria-expanded", "true");

          // Close all other nestedDiv
          const nestedDivs = document.querySelectorAll(".nested-checklist");
          nestedDivs.forEach((div) => {
            if (div !== nestedDiv) {
              div.style.display = "none";
            }
          })

          // Change the arrow buttons
          const arrowBtns = document.querySelectorAll(".arrow-btn");
          arrowBtns.forEach((arrow) => {
            if (arrow !== arrowBtn) {
              arrow.innerHTML = arrowDownSVG;
              arrow.setAttribute("aria-expanded", "false");
            }
          })

          // Check the first option of the current nested div
          document.querySelectorAll(".checklist-choice").forEach(cb => {
            cb.checked = false;
          });
          nestedDiv.firstChild.firstChild.checked = true;

        } else {
          nestedDiv.style.display = "none";
          arrowBtn.innerHTML = arrowDownSVG;
          arrowBtn.setAttribute("aria-expanded", "false");
        }
      });
    } else {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "thickbox checklist-choice";
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(" " + labelText));
      item.appendChild(label);
      checkbox.addEventListener("change", function () {
        // Check if the current checkbox is selected 
        if (this.checked) {
          // Unselect all other checkboxes 
          document.querySelectorAll(".checklist-choice").forEach(cb => {
            if (cb !== this) {
              cb.checked = false;
            };
          });
        }
      })
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
        strategyObj.nestedOptions,
        defaultSelected
      ));
  })

  // checklist.appendChild(createChecklistItem("Doppia forma (M/F)", STRATEGIES.CV, true, ["gli studenti e le studenti", "i/le studenti"], true)); 
  // checklist.appendChild(createChecklistItem("Nome astratto", STRATEGIES.CO, true, ["la comunità studentesca"], false)); 
  // checklist.appendChild(createChecklistItem("Forme innovative", STRATEGIES.IO, true, ["l* student*", "l@ student@", "lx studentx", "lu studentu", "lə studentə"], false)); 
  // checklist.appendChild(createChecklistItem("Tripla forma (M/F/N)", STRATEGIES.IV, true, ["gli studenti, le studenti e l* student*", "gli/le/l* student*"], false)); 

  /* -------------- Create buttons ----------------------------- */
  const buttonWrapper = document.createElement("div");
  buttonWrapper.id = "info-btn-wrapper";
  buttonWrapper.className = "btn-wrapper";

  // ------------------- Accept all button -------------------
  const acceptAllBtn = document.createElement("button");
  acceptAllBtn.id = "accept-all";
  acceptAllBtn.className = "accept-all-btn";
  acceptAllBtn.textContent = 'Accetta tutto';
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
    startAnalysis();

  });


  buttonWrapper.appendChild(acceptAllBtn);
  buttonWrapper.appendChild(refuseAllBtn);
  buttonWrapper.appendChild(analyzeButton);
  infoDiv.appendChild(checklist);
  infoDiv.appendChild(buttonWrapper);
  return infoDiv;
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

  // Create the div element
  const spanDiv = document.createElement("div");
  spanDiv.id = `div-${spanEl.id}`;
  spanDiv.className = "span-div";
  spanDiv.style.display = "none";
  spanDiv.setAttribute("role", "dialog");
  spanDiv.setAttribute("aria-label", `Opzioni per: ${spanEl.dataset.original}`);
  spanDiv.setAttribute("tabindex", "-1");

  // Show the old text
  const p = document.createElement("p");
  //p.style.padding = "0px";
  p.innerHTML = `<strong><del>${spanEl.dataset.original}</del><strong>`;
  p.style.margin = "0px";
  p.style.fontSize = "13px";

  const inputWrap = document.createElement("div");
  inputWrap.className = "input-wrap";

  const inputLabel = document.createElement("label");
  inputLabel.setAttribute("for", `user-ref-${spanEl.id}`);
  inputLabel.textContent = "La tua soluzione inclusiva";
  inputLabel.className = "sr-only"; // visually hidden but accessible
  inputLabel.style.display = "none";  // at creation label is hidden

  const inputFormulation = document.createElement("input");
  inputFormulation.id = `user-ref-${spanEl.id}`;
  inputFormulation.type = "text";
  inputFormulation.placeholder = "Es. studenti e studentesse";

  inputWrap.appendChild(inputLabel);

  inputFormulation.style.display = "none";

  inputFormulation.addEventListener("click", (event) => {
    event.stopPropagation();
  });


  const saveBtn = document.createElement("button");
  saveBtn.className = "save-btn";
  saveBtn.innerHTML = ICONS.save;
  saveBtn.setAttribute("aria-label", "Salva formulazione personalizzata");

  saveBtn.style.display = "none";
  saveBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      storeUserInput(inputFormulation, spanEl)
  });

  const revertChangeBtn = document.createElement("button");
  revertChangeBtn.className = "revert-btn";
  revertChangeBtn.innerHTML = ICONS.revert;

  revertChangeBtn.style.display = "none";

  revertChangeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      revertUserInput(spanEl);
  });

  inputWrap.appendChild(inputFormulation);
  inputWrap.appendChild(saveBtn);
  inputWrap.appendChild(revertChangeBtn);

  // Display buttons to change/accept/refuse option
  const btnWrap = document.createElement("div");
  btnWrap.className = "btn-wrapper";

  // Edit current option (allow user to input their reformulation)
  const editBtn = document.createElement("button");
  editBtn.className = "edit-btn";
  editBtn.innerHTML = ICONS.edit;

  editBtn.addEventListener("click", () => {
      if (inputFormulation.style.display == "none") {
          inputFormulation.style.display = "block";
          saveBtn.style.display = "block";
          revertChangeBtn.style.display = "block";
      } else {
          inputFormulation.style.display = "none";
          saveBtn.style.display = "none";
          revertChangeBtn.style.display = "none";
      }
    })

    // Accept current reformulation for the span
    const accBtn = document.createElement("button");
    accBtn.className = "small-acc-btn";
    accBtn.innerHTML = ICONS.accept;
    
    accBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        accept(spanEl);
    });

    // Refuse reformulations for the span (keep the original text)
    const refBtn = document.createElement("button");
    refBtn.className = "small-ref-btn";
    refBtn.innerHTML = ICONS.refuse;

    refBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        discard(spanEl);
    })

    btnWrap.appendChild(editBtn);
    btnWrap.appendChild(accBtn);
    btnWrap.appendChild(refBtn);
    spanDiv.appendChild(p);
    spanDiv.appendChild(inputWrap);
    spanDiv.appendChild(btnWrap);

    spanDiv.addEventListener("click", (event) => {
    event.stopPropagation();
    const input = inputFormulation.value.trim();
    if (input) {
      spanEl.dataset.userContent = input;
      spanEl.dataset.currentUsed = input;
      const textNode = Array.from(spanEl.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
      if (textNode) {
        textNode.nodeValue = input;
      } else {
        spanEl.insertBefore(document.createTextNode(input), spanEl.firstChild)
      }
      // Clean the input formulation
      inputFormulation.value = "";

    }
  });

  const revertChangeBtn = document.createElement("button");
  revertChangeBtn.className = "revert-btn";
  revertChangeBtn.innerHTML = ICONS.revert;
  revertChangeBtn.setAttribute("aria-label", "Ripristina suggerimento AI");

  revertChangeBtn.style.display = "none";

  revertChangeBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const refValue = spanEl.dataset.reformulation;
    if (refValue) {
      spanEl.dataset.currentUsed = refValue;
      const textNode = Array.from(spanEl.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
      if (textNode) {
        textNode.nodeValue = refValue;
      } else {
        spanEl.insertBefore(document.createTextNode(refValue), spanEl.firstChild);
      }
    }
  });

  inputWrap.appendChild(inputFormulation);
  inputWrap.appendChild(saveBtn);
  inputWrap.appendChild(revertChangeBtn);

  // Display buttons to change/accept/refuse option
  const btnWrap = document.createElement("div");
  btnWrap.className = "btn-wrapper";

  // Edit current option (allow user to input their reformulation)
  const editBtn = document.createElement("button");
  editBtn.className = "edit-btn";
  editBtn.innerHTML = ICONS.edit;
  editBtn.setAttribute("aria-label", "Modifica formulazione");

  editBtn.addEventListener("click", () => {
    if (inputFormulation.style.display == "none") {
      inputFormulation.style.display = "block";
      inputLabel.style.display = "block";
      saveBtn.style.display = "block";
      revertChangeBtn.style.display = "block";
    } else {
      inputFormulation.style.display = "none";
      inputLabel.style.display = "none";
      saveBtn.style.display = "none";
      revertChangeBtn.style.display = "none";
    }
  })

  // Accept current reformulation for the span
  const accBtn = document.createElement("button");
  accBtn.className = "small-acc-btn";
  accBtn.innerHTML = ICONS.accept;
  accBtn.setAttribute("aria-label", "Accetta questa riformulazione");

  accBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    accept(spanEl);
  });

  // Refuse reformulations for the span (keep the original text)
  const refBtn = document.createElement("button");
  refBtn.className = "small-ref-btn";
  refBtn.innerHTML = ICONS.refuse;
  refBtn.setAttribute("aria-label", "Rifiuta questa riformulazione");

  refBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    discard(spanEl);
  })

  btnWrap.appendChild(editBtn);
  btnWrap.appendChild(accBtn);
  btnWrap.appendChild(refBtn);
  spanDiv.appendChild(p);
  spanDiv.appendChild(inputWrap);
  spanDiv.appendChild(btnWrap);

  spanDiv.addEventListener("click", (event) => {
    event.stopPropagation();
  });

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
      if (isOpen) infoDiv.focus(); // move focus into dialog on open
    }
  });

  document.addEventListener("click", (e) => {
    // If click is not inside the span div or a highlight span, close all spandivs
    if (!e.target.closest(".span-div") && !e.target.closest(".highlight")) {
      document.querySelectorAll(".span-div").forEach(s => {
        s.style.display = "none";
      });
    }
  });
}


// Listens to messages coming from background.js --> in this case, the data processed from the backend
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "processedData") {
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
    const refuseBtn = document.getElementById("refuse-all");
    const acceptBtn = document.getElementById("accept-all");
    const analyzeBtn = document.getElementById("analyze");
    const btnWrapper = document.getElementById("info-btn-wrapper");

    if (hasSpans) {
      // Make Refuse All and Accept All buttons clickable 
      analyzeBtn.innerHTML = ICONS.analyse;
      analyzeBtn.setAttribute("aria-label", "Analizza");
      acceptBtn.style.display = "block";
      acceptBtn.removeAttribute("aria-hidden");
      refuseBtn.style.display = "block";
      refuseBtn.removeAttribute("aria-hidden");
      btnWrapper.style.justifyContent = "space-between";

      // Remove existing success messages
      const existingMsg = document.getElementById("no-span-message");
      if (existingMsg) existingMsg.remove();

    } else {
      // Remove existing success messages
      const existingPopup = document.getElementById("no-span-message");
      if (existingPopup) existingPopup.remove()

      // Create new success message
      const successPopup = document.createElement("div");
      successPopup.id = "no-span-message";
      successPopup.className = "message-popup success-popup";

      const successMsg = document.createElement("span");
      successMsg.textContent = "Nessuno span unfair trovato, ottimo lavoro!";
      document.getElementById("fairly-live").textContent = successMsg.textContent;

      // Crete close btn
      const closeBtn = document.createElement("button");
      closeBtn.className = "popup-close-btn";
      closeBtn.innerHTML = ICONS.close;
      closeBtn.setAttribute("aria-label", "Chiudi messaggio");
      closeBtn.addEventListener("click", () => {
        successPopup.remove();
      });

      successPopup.appendChild(successMsg);
      successPopup.appendChild(closeBtn);

      // Position relative to the btnWrapper
      btnWrapper.style.position = "relative";
      btnWrapper.appendChild(successPopup);

      // Keep analyze button as is, hide "Accept all" and "Refuse all", as there are no spans to accept
      acceptBtn.style.display = "none";
      acceptBtn.setAttribute("aria-hidden", "true");
      refuseBtn.style.display = "none";
      refuseBtn.setAttribute("aria-hidden", "true");
      btnWrapper.style.justifyContent = "flex-end";

    }
  }
});


// Create the extension on page load
window.addEventListener("load", () => {
    // Prevent multiple injection of the script in Gmail 
    if (window.__fairlyInitialized) return;

    window.__fairlyInitialized = true;
  setTimeout(initExtension, 2000);
});

// Just before reloading the page, we clean up any span introduced by our widget
// window.addEventListener("beforeunload", () => {
//     discard();
// });