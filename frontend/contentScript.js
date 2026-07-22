const logger = createLogger("contentScript.js");

let SESSION_ID = null;
let USER_EMAIL = null;
let STRATEGY_ORDER = null;
let CONSENT_GIVEN = null;
let analysisTimeoutId = null;



function emailEndsWithAllowedDomain() {
  if (!USER_EMAIL) return false;
  return DOMAINS.some(d => USER_EMAIL.toLowerCase().endsWith(d)) || USER_EMAIL == TEST_ACCOUNT
}

async function initializeSession() {
  // Get user email
  const meta = document.getElementsByName("og-profile-acct");

  if (!meta || !meta.length) {
    logger.warn("Could not find user email meta tag.");
    return false;
  }

  USER_EMAIL = meta[0].content;
  if (!emailEndsWithAllowedDomain()) {
    logger.warn("Not a valid domain!");
    return false;
  }

  // Get session ID safely
  try {
    SESSION_ID = crypto.randomUUID();
  } catch (e) {
    logger.warn("crypto.randomUUID unavailable, using fallback.", e);
    SESSION_ID = Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  try {
    // Get strategies order
    const result = await chrome.storage.local.get("fairlyStrategyOrder");
    if (result.fairlyStrategyOrder) {
      STRATEGY_ORDER = result.fairlyStrategyOrder;
    } else {
      const strategies = Object.keys(STRATEGIES);
      const randomizedOrder = [...strategies].sort(() => Math.random() - 0.5);
      await chrome.storage.local.set({ "fairlyStrategyOrder": randomizedOrder });
      STRATEGY_ORDER = randomizedOrder;
    }
  } catch (e) {
    logger.warn("localStorage unavailable, using random strategy order.", e);
    STRATEGY_ORDER = Object.keys(STRATEGIES).sort(() => Math.random() - 0.5);
  }

  return true;
}

function isWidgetValid() {
  /**
   * Checks that the Fairly widget is still in the DOM
   * Since Gmail is a SOA (Single-Page App) if the user reloads the extension or the page is modified, 
   * the widget might be removed
   * @returns bool
  */
  return document.getElementById("fairly-widget") !== null;
}

async function initExtension() {

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

  if (typeof DOMAINS === 'undefined' || typeof STRATEGIES === 'undefined') {
    logger.error("Missing global dependencies.");
    return;
  }

  // Initialize Session with user information and create Session ID
  if (!await initializeSession()) {
    logger.error("Inizializzazione di Fairly fallita! Fairly non supporta domini diversi da 'unito.it'");
    return;
  };

  // Check if a widget already exists 
  if (document.getElementById("fairly-widget")) return;

  // Check if user already gave consent
  const { fairlyConsentGiven } = await chrome.storage.local.get("fairlyConsentGiven");
  if (!fairlyConsentGiven) {
    showConsentDialog();
    return;
  }

  const { fairlyUserInfoStored } = await chrome.storage.local.get("fairlyUserInfoStored");

  if (!fairlyUserInfoStored) {
    const user = {
      user_id: USER_EMAIL,
      strategy_order: STRATEGY_ORDER
    }
    chrome.runtime.sendMessage({
      action: "addUser",
      payload: user
    });
    await chrome.storage.local.set({ "fairlyUserInfoStored": true })
  }

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
    const dx = e.clientX - offsetX - (parseInt(widget.style.left, 10) || 0);
    const dy = e.clientY - offsetY - (parseInt(widget.style.top, 10) || 0);
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
    if (!e.target.closest(".message-popup") && !e.target.closest("#analyze")) {
      clearAllPopups();
    }

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

  // Observer to cleanup the spans after the user has closed the email (with Fairly spans still opened)
  const draftCleanupObserver = new MutationObserver((mutations) => {
    /**
     * The MutationObserver is a browser feature that watches for changes in the DOM
     * It records every time elements are added/removed from the page, attributes change, text content changes
     * Here, we need it to observe whether there is a new compose window added (the user clicked on "Write email" or is responding to an email)
     * and, if it is, we want to check whether it contains stale spens (that is, spans that were neither accepted not refused by the user 
     * and are therefore never converted into a text node) and clean it up
     */
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        // Get only elements nodes
        if (node.nodeType != Node.ELEMENT_NODE) continue;
        // Check if current node contains span elements
        const fairlySpans = node.querySelectorAll('span[aria-label^="Suggerimento Fairly"]');
        // Delete if they are stale spans
        fairlySpans.forEach((span) => {
          cleanStaleDraftSpans(span);
        }
        )
      }
    };
  });
  draftCleanupObserver.observe(document.body, { childList: true, subtree: true })
}

// Create the extension on page load
window.addEventListener("load", () => {
  // Prevent multiple injection of the script in Gmail 
  if (document.getElementById("fairly-widget")) return;
  setTimeout(initExtension, 2000);
});