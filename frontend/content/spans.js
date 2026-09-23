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
  if (!spanEl || !spanEl.dataset.original || !spanEl.dataset.reformulation || !spanEl.dataset.fullOriginal) {
    logger.error("Invalid span element - missing required data attributes");
    return null;
  }

  // saves users reformulations history
  const history = []

  // Create the div element
  const spanDiv = document.createElement("div");
  const fullOriginal = spanEl.dataset.fullOriginal ?? spanEl.dataset.original;
  spanDiv.id = `div-${spanEl.id}`;
  spanDiv.className = "span-div";
  spanDiv.style.display = "none";
  spanDiv.setAttribute("role", "dialog");
  spanDiv.setAttribute("aria-label", `Opzioni per: ${spanEl.dataset.fullOriginal }`);
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

  const p = document.createElement("p");
  // Show the old text crossed out and the new suggested solution
  const strong = document.createElement("strong")
  const del = document.createElement("del");
  del.textContent = fullOriginal ;
  strong.appendChild(del);
  const arrowSpan = document.createElement("span");
  arrowSpan.appendChild(svgToNode(ICONS.arrowRight)); // Constant, cannot be injected

  const reformulation = document.createElement("strong");
  reformulation.textContent = " " + spanEl.dataset.reformulation;

  p.appendChild(strong);
  p.appendChild(document.createTextNode(" "));
  p.appendChild(arrowSpan);
  p.appendChild(document.createTextNode(" "));
  p.appendChild(reformulation);
  p.style.margin = "0 0 8px 0";

  const inputWrap = document.createElement("div");
  inputWrap.className = "input-wrap";

  const inputLabel = document.createElement("label");
  inputLabel.setAttribute("for", `user-ref-${spanEl.id}`);
  inputLabel.textContent = "Accetta la riscrittura Fairly o proponi una nuova formulazione!";
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

    // handle highlights on more than one node
    const related = document.querySelectorAll(
      `[data-span-id="${CSS.escape(spanEl.dataset.spanId)}"]`
    );

    related.forEach((fragment) => {
      if (fragment !== spanEl) {
        fragment.replaceWith(document.createTextNode(""));
      }
    });

    // move focus to the next span
    const all = [...document.querySelectorAll("span.highlight")];
    const next = all[all.indexOf(spanEl) + 1];
    (next ?? document.getElementById("analyze")).focus();

    accept({span: spanEl, input: input ? true : false});
    spanDiv.style.display = "none";
  });

  // Discard (refuse, restore original)
  const discardBtn = document.createElement("button");
  discardBtn.className = "span-action-btn span-discard-btn";
  discardBtn.textContent = "Rifiuta";
  discardBtn.setAttribute("aria-label", "Rifiuta e ripristina testo originale");
  discardBtn.addEventListener("click", e => {
    e.stopPropagation();

    const related = document.querySelectorAll(
        `[data-span-id="${CSS.escape(spanEl.dataset.spanId)}"]`
    );

    related.forEach((fragment) => {
        if (fragment !== spanEl) {
          fragment.replaceWith(
            document.createTextNode(fragment.dataset.original)
          );
        }
    });

    // move focus to the next span
    const all = [...document.querySelectorAll("span.highlight")];
    const next = all[all.indexOf(spanEl) + 1];
    (next ?? document.getElementById("analyze")).focus();

    discard({span: spanEl});
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

/* helper for the spanpopupdiv */
function setSpanText(spanEl, value) {
  const textNode = Array.from(spanEl.childNodes).find(n => n.nodeType === Node.TEXT_NODE);
  if (textNode) textNode.nodeValue = value;
  else spanEl.insertBefore(document.createTextNode(value), spanEl.firstChild);
}

function cleanStaleDraftSpans(span) {
  // If they still have the class "highlight" it means they are still 
  if (span.classList.contains("highlight")) return;
  span.replaceWith(document.createTextNode(span.textContent));
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
    logger.error("Invalid contenteditable div - may have been removed");
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
  // Merge adjacent text nodes left over by previous highlights
  div.normalize();

  // Collect all the nodes in the walker
  const walker = document.createTreeWalker(div, NodeFilter.SHOW_TEXT);
  const logicalText = div.innerText.replace(/\r?\n/g, " "); 
  const nodes = [];
  let searchFrom = 0;
  let node;
  while ((node = walker.nextNode())) {
    const nodeStart = logicalText.indexOf(node.nodeValue, searchFrom);
    if (nodeStart === -1) continue;

    nodes.push({
      node,
      start: nodeStart,
      end: nodeStart + node.nodeValue.length
    });

    searchFrom = nodeStart + node.nodeValue.length;
  }

  // Sort spans by start_char, last first: splitting a text node keeps its first part in the
  // original node, so the precomputed offsets stay valid for the spans processed afterwards
  spans = spans.slice().sort((a, b) => b.start_char - a.start_char);
  try {

    spans.forEach((span) => {
        const affected = nodes.filter(
          item => span.start_char < item.end && span.end_char > item.start
        );

        if (affected.length === 0) return;

        const first = affected[0];
        const last = affected.at(-1);

        const range = document.createRange();

        range.setStart(
          first.node,
          Math.max(span.start_char - first.start, 0)
        );

        range.setEnd(
          last.node,
          Math.min(span.end_char - last.start, last.node.nodeValue.length)
        );
       
        affected.forEach((item, index) => {
            const range = document.createRange();

            range.setStart(item.node, Math.max(span.start_char - item.start, 0));
            range.setEnd(
              item.node,
              Math.min(span.end_char - item.start, item.node.nodeValue.length)
            );

            const highlight = document.createElement("span");
            highlight.appendChild(range.extractContents());

            configureHighlight(highlight, span, index === 0, div);
            range.insertNode(highlight);
        });
    })
    return true;
  } catch (error) {
    logger.error("Error highlighting spans:", error);
    return false;
  }
}

function configureHighlight(spanEl, span, isFirst, div) {
  spanEl.className = "highlight";
  spanEl.setAttribute("contenteditable", "false");
  spanEl.setAttribute("role", "button");
  spanEl.tabIndex = 0;

  spanEl.dataset.original = spanEl.textContent;
  spanEl.dataset.fullOriginal = span.original_text;
  spanEl.dataset.reformulation = span.reformulation;
  spanEl.dataset.spanId = span.span_id;
  spanEl.dataset.emailId = div.id;
  spanEl.dataset.currentUsed = spanEl.textContent;
  spanEl.setAttribute(
  "aria-label",
  `Suggerimento Fairly: sostituire ${span.original_text} con ${span.reformulation}. Premi Invio per le opzioni.`
);

  spanEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      spanEl.click();
    }
  });

  if (isFirst) {
  spanEl.id = span.span_id;
  const spanDiv = createSpanPopupDiv(spanEl);

  if (!spanDiv) {
    logger.error(`Failed to create popup for span: ${spanEl.textContent}`);
    return;
  }

  spanEl.addEventListener("click", (e) => {
    e.stopPropagation();
    clearAllPopups();

    document.querySelectorAll(".span-div").forEach((popup) => {
      if (popup.id !== spanDiv.id) popup.style.display = "none";
    });

    if (spanDiv.style.display === "block") {
      spanDiv.style.display = "none";
      spanDiv.style.visibility = "hidden";
      return;
    }

    if (!document.body.contains(spanDiv)) {
      document.body.appendChild(spanDiv);
    }

    positionPopup(spanDiv, spanEl);
    spanDiv.focus();
  });
}else {
  spanEl.addEventListener("click", (e) => {
    e.stopPropagation();

    const first = document.querySelector(
      `[data-span-id="${CSS.escape(span.span_id)}"]`
    );

    first?.click();
  });
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