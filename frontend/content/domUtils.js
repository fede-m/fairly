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

function createSpanPopupDiv(spanEl) {
  // Validate span element 
  if (!spanEl || !spanEl.dataset.original || !spanEl.dataset.reformulation) {
    console.error("Invalid span element - missing required data attributes");
    return null;
  }

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
  p.innerHTML = `<strong><del>${spanEl.dataset.original}</del> ${ICONS.arrowRight} ${spanEl.dataset.reformulation}<strong>`;
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

    accept(spanEl, input ? true : false);
    spanDiv.style.display = "none";
  });

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


/**
* Highlights detected unfair spans within a contenteditable div and replaces them with inclusive reformulations.
* Removes any existing highlights first, then walks through all text nodes to find and wrap
* matching text ranges in styled span elements. Each highlighted span:
* - Displays the AI-suggested reformulation instead of the original text
* - Stores original text and reformulation in data attributes
* - Has an attached popup (via createSpanPopupDiv) for user interaction
* - Is positioned intelligently to avoid viewport overflow
* @param {HTMLDivElement} div - The contenteditable element containing the email text
* @param {Array<{start_char: number, end_char: number, reformulation: string}>} spans - Array of span objects with character positions and suggested reformulations
* @returns {void}
*/

function highlightSpans(div, spans) {
  // Validate input
  if (!div || !div.isConnected) {
    console.error("Invalid contenteditable div - may have been removed");
    return false; 
  }

  if (!spans || spans.length === 0) {
    return false;
  }

  // Remove already present spans 
  const highlightedSpans = div.querySelectorAll("span.highlight");
  // Get all span elements 
  highlightedSpans.forEach((span) => {
    // Restore the original text 
    const original = span.dataset.original ?? span.textContent;
    // Replace the span with its text content (removes highlight) 
    span.replaceWith(document.createTextNode(original));
  });
  // Create a walker to pass through all the text nodes of the current content window 
  const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT, null, false);
  // Collect all the nodes in the walker 
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    nodes.push(node);
  }
  // Sort spans by start_char 
  spans = spans.slice().sort((a, b) => a.start_char - b.start_char);
  // Keep track of the index of the text in the node 
  let charIndex = 0;
  let spanId = 0;

  try {
      nodes.forEach((node) => {
        // Get text and start and end char of node 
        const nodeText = node.nodeValue;
        const nodeStart = charIndex;
        const nodeEnd = charIndex + nodeText.length;

        // Find all spans that overlap with this node 
        const nodeSpans = spans.filter((span) => span.start_char < nodeEnd && span.end_char > nodeStart);
        // If no span is found, simply update the index 
        if (nodeSpans.length === 0) {
          charIndex += nodeText.length;
          return;
        }
        // Build an array of {text, isHighlight} -> each will be a new node later and the highlight true/false will define if you need to wrap it into a span or not 
        let parts = [];
        let lastIdx = 0;
        nodeSpans.forEach((span) => {
          // Calculate start and end index of the part to highlight in the current node text (considering that it goes from 0 to node.length) 
          const spanStart = Math.max(span.start_char - nodeStart, 0);
          const spanEnd = Math.min(span.end_char - nodeStart, nodeText.length);
          if (spanStart > lastIdx) {
            // Add the "before" text 
            parts.push({
              text: nodeText.slice(lastIdx, spanStart),
              isHighlight: false,
              reformulation: null,
            });
          }
          // Add the text of the span 
          const part = {
            text: nodeText.slice(spanStart, spanEnd),
            isHighlight: true,
            reformulation: span.reformulation
          };
          parts.push(part);
          lastIdx = spanEnd;
        });
        // Add the after text (after having processed all the spans in the current node) 
        if (lastIdx < nodeText.length) {
          parts.push({
            text: nodeText.slice(lastIdx),
            isHighlight: false,
            reformulation: null
          });
        }
        // Create temporary fragment to substitute the node with 
        const frag = document.createDocumentFragment();
        parts.forEach((part, idx) => {

          if (part.isHighlight) {

            const spanEl = document.createElement("span");
            spanEl.id = `span-${++spanId}`;
            spanEl.className = "highlight";
            // Keep original text
            spanEl.innerText = part.text;
            spanEl.setAttribute("contenteditable", "false");
            // button-like behaviour
            spanEl.setAttribute("role", "button");
            // reachable by tab key
            spanEl.tabIndex = 0
            // aria label optimist
            spanEl.setAttribute("aria-label",
              `Suggerimento Fairly: sostituire ${part.text} con ${part.reformulation}. Premi Invio per le opzioni.`
            );
            // Store original text and reformulation in the object 
            spanEl.dataset.original = part.text;
            spanEl.dataset.reformulation = part.reformulation;
            spanEl.dataset.currentUsed = part.text;
            spanEl.dataset.emailId = div.id;

            // space and enter open the spandiv
            spanEl.addEventListener("keydown", (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                spanEl.click();
              }
            });

            const spanDiv = createSpanPopupDiv(spanEl);

            if (!spanDiv) {
              console.error(`Failed to create popup for span: ${part.text}`);
                // Option 1: Skip this span and continue
                frag.appendChild(spanEl); // Add span without popup
                return;
            }
            
            frag.appendChild(spanEl);
            // Add click event 
            spanEl.addEventListener("click", (e) => {
              e.stopPropagation();
              // close popups
              clearAllPopups();
              // Hide all other spanDivs
              document.querySelectorAll(".span-div").forEach(s => {
                if (s.id !== spanDiv.id) { s.style.display = "none"; }
              });
              // Toggle visibility
              const isVisible = spanDiv.style.display === "block";

              if (isVisible) {
                spanDiv.style.display = "none";
                spanDiv.style.visibility = "hidden";
              } else {
                // Append to body if not already present
                if (!document.body.contains(spanDiv)) {
                  document.body.appendChild(spanDiv);
                }

                positionPopup(spanDiv, spanEl)
                spanDiv.focus();
              }
            })
          } else if (part.text) {
            frag.appendChild(document.createTextNode(part.text));
          }
        });
        node.replaceWith(frag);
        charIndex += nodeText.length;
      });
      
      return true;
    
  } catch (error) {
    console.error("Error highlighting spans:", error);
    return false;
  }
}

/* helper function to position */
function positionPopup(spanDiv, spanEl) {
  spanDiv.style.visibility = "hidden";
  spanDiv.style.display = "block";

  // Force reflow to get accurate dimensions before positioning
  void spanDiv.offsetHeight;

  const popupWidth = spanDiv.offsetWidth;
  const popupHeight = spanDiv.offsetHeight;
  const rects = spanEl.getClientRects();
  const startRect = rects.length > 0 ? rects[0] : spanEl.getBoundingClientRect();

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const GAP = 6;

  let left = startRect.left + window.scrollX;
  let top = startRect.bottom + window.scrollY + GAP;

  // Horizontal overflow prevention
  if (left + popupWidth > viewportWidth + window.scrollX) {
    left = startRect.right + window.scrollX - popupWidth;
    if (left < window.scrollX) left = window.scrollX + 8;
  }
  if (left < window.scrollX) left = window.scrollX + 8;

  // Vertical overflow prevention
  if (top + popupHeight > viewportHeight + window.scrollY) {
    const topAbove = startRect.top + window.scrollY - popupHeight - GAP;
    top = topAbove >= window.scrollY
      ? topAbove
      : viewportHeight + window.scrollY - popupHeight - 8;
  }

  spanDiv.style.left = `${left}px`;
  spanDiv.style.top = `${top}px`;
  spanDiv.style.visibility = "visible";
}