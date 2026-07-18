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
function startAnalysis() {
  // Check whether the Failry widget still exists
  if (!isWidgetValid()) {
    logger.warn("Fairly widget not found. Extension might have been reloaded");
    return; // Early exit if widget is gone
  }

  // Perform both detection and generation sequentially 
  const currentLocation = window.location.href;
  // Delete all spans that were not accepted
  discard({ ref_reason: "analysis_refresh", isAll: true });

  if (currentLocation.startsWith("https://mail.google.com/")) {
    // remove pop-ups
    clearAllPopups()

    // Select all elements on the page which are editable (the open emails) 
    const editableElements = Array.from(document.querySelectorAll('div[role="textbox"][contenteditable="true"]'))
      .filter(el => {
        // Check if element has a parent with data-compose-id and is visible
        const hasComposeParent = el.closest('[data-compose-id]') !== null;
        const isVisible = el.offsetParent !== null;
        return hasComposeParent && isVisible;
      });
    // Check if there are open emails 
    if (editableElements.length > 0) {

      // Store editable elements with their text content 
      const dataObj = {};
      const selected = document.querySelector(".checklist-choice:checked");

      if (!selected) {
        // Create new warning popup
        const btnWrapper = document.getElementById("info-btn-wrapper");
        showPopup("warning", "E' necessario selezionare una strategia di riformulazione!", "warning-msg", btnWrapper);
        logger.log("startAnalysis: No strategy selected.");
        setLoadingState(false);
        return;
      }

      // Prepare payload for background
      dataObj["strategy"] = selected.id;
      dataObj["data"] = [];
      dataObj["session_id"] = SESSION_ID;
      dataObj["user_id"] = USER_EMAIL;
      // remember the selected options for future uses
      //chrome.storage.local.setItem("fairlyLastStrategy", selected.id);

      editableElements.forEach((element) => {
        element.dataset.fairlyUsed = true;
        const data = {};
        const key = element.id;
        const text = element.innerText;
        data["id"] = key;
        data["text"] = text;
        data["char_length"] = text.length;
        data["word_count"] = countWords(text);
        dataObj["data"].push(data);
      });
      // Send data to background 
      try {
        chrome.runtime.sendMessage({
          action: "analyseData",
          payload: dataObj,
        });

        // Set timeout: if no response in 45 seconds, show error
        if (analysisTimeoutId) clearTimeout(analysisTimeoutId);
        analysisTimeoutId = setTimeout(() => {
          logger.error("Analysis request timeout - no response from background");
          setLoadingState(false);
          const btnWrapper = document.getElementById("info-btn-wrapper");
          showPopup("error", ERROR_MESSAGES["TIMEOUT"] || "L'analisi ha impiegato troppo tempo. Il server potrebbe non essere disponibile.", "error-msg", btnWrapper);
        }, 45000);
      } catch (error) {
        logger.error("Failed to send message to background: ", error);
        setLoadingState(false);
        const btnWrapper = document.getElementById("info-btn-wrapper");
        showPopup("error", "Errore di comunicazione con l'estensione. Ricarica la pagina.", "error-msg", btnWrapper);
      }

    } else {
      const btnWrapper = document.getElementById("info-btn-wrapper");
      if (!btnWrapper) {
        logger.error("CRITICAL: info-btn-wrapper not found in DOM!");
        setLoadingState(false);
        return;
      }

      // Create new warning popup
      showPopup("warning", "Non ci sono mail da analizzare!", "warning-msg", btnWrapper);
      setLoadingState(false);
    }
  };
}

function countWords(text) {
  return text.trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

// Listens to messages coming from background.js --> in this case, the data processed from the backend
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "processedData") {
    // Clear the analysis timeout if it exists
    if (analysisTimeoutId) {
      clearTimeout(analysisTimeoutId);
      analysisTimeoutId = null;
    }

    // Check if widget exists
    if (!isWidgetValid()) {
      logger.warn("Fairly widget not found. Discarding analysis results.");
      setLoadingState(false);
      return;
    }

    setLoadingState(false);
    const response = msg.payload;

    // Check if error contains response
    if (response.error) {
      const btnWrapper = document.getElementById("info-btn-wrapper");
      showPopup("error", ERROR_MESSAGES[response.code] || "Si è verificato un errore. Riprova più tardi.", 'error-msg', btnWrapper);
      logger.error(`Analysis failed with ${response.code}: `, response.details);
      return;
    }

    /* ------------- Create the span elements in the email ------------- */
    let hasSpans = false;
    let highlightError = false;
    for (const id in response.results) {
      // Use ID to get the correct contenteditable window 
      const div = document.querySelector(`div[role="textbox"][contenteditable="true"]#${CSS.escape(id)}`); // NOTE: CSS.escape is used to escape the ":" in front of the id of the Gmail content windows 

      // Check if compose div still exists
      if (!div) {
        logger.warn(`Compose window ${id} no longer exists`);
        continue;
      }

      const spans = response.results[id].unfair_spans;
      if (spans && spans.length > 0) {

        // Highligh the spans that were detected and their alternatives 
        const highlightSuccess = highlightSpans(div, response.results[id].unfair_spans);
        if (!highlightSuccess) {
          logger.error(`Failed to highlight spans in email ${id}`);
          highlightError = true;
          continue;
        }
        hasSpans = true;
      }
    }

    /* ------------- Update buttons content ------------- */
    const btnWrapper = document.getElementById("info-btn-wrapper");
    if (highlightError) {
      showPopup("error", "Si è verificato un errore durante l'evidenziazione dei suggerimenti.", "error-msg", btnWrapper);
      setResultButtons(false);
      return;
    }
    if (hasSpans) {
      setResultButtons(true);
      // Remove existing messages
      clearAllPopups()
      showPopup("success", "Analisi completata. Premi sulle singole riscritture per accettare, rifiutare o proporre una nuova formulazione!", "no-span-message", btnWrapper, "span.highlight");
    } else {
      // Create new success message
      showPopup("success", "Analisi completata. Nessuno span non inclusivo trovato, ottimo lavoro!", "no-span-message", btnWrapper);
      // Keep analyze button as is, hide "Accept all" and "Refuse all", as there are no spans to accept
      setResultButtons(false);
    }
  }
});

document.addEventListener("click", (event) => {
  // Check if "Send" button was clicked (support in Italian and English)
  const sendBtn = event.target.closest('[role="button"][data-tooltip^="Invia"]') || event.target.closest('[role="button"][data-tooltip^="Send"]');
  if (!sendBtn) return;

  const composeWindow = sendBtn.closest('[role="dialog"]');
  const editor = composeWindow?.querySelector('[contenteditable="true"]');
  if (!editor) return;
  const fairlyUsed = editor.dataset.fairlyUsed === "true";
  const text = fairlyUsed ? editor.innerText : null;
  const textLength = fairlyUsed ? text.length : null;
  const wordCount =  fairlyUsed ? countWords(text) : null;
  const strategySelected = fairlyUsed ? document.querySelector(".checklist-choice:checked") : null;
  const payload = {
    event: "send",
    text: text,
    spans: [],
    session_id: SESSION_ID,
    user_id: USER_EMAIL,
    email_id: editor.id,
    fairly_used: fairlyUsed,
    strategy: fairlyUsed ? strategySelected.id : null,
    email_char_count: fairlyUsed ? textLength : null,
    email_word_count: fairlyUsed ? wordCount : null,
  };
  chrome.runtime.sendMessage({
    action: "storeEvent",
    payload: [payload]
  });
});

