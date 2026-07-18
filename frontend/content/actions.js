function resetButtons() {
  // Show only the Analyze button
  const accBtn = document.getElementById("accept-all");
  const refBtn = document.getElementById("refuse-all");
  const analyseBtn = document.getElementById("analyze");
  const btnWrap = document.getElementById("info-btn-wrapper");

  accBtn.style.display = "none";
  refBtn.style.display = "none";
  analyseBtn.textContent = "Analizza";
  btnWrap.style.justifyContent = "flex-end";
}


function discard({ span = undefined, ref_reason = "user_refuse", isAll = false } = {}) {

  const highlightedSpans = span ? [span] : Array.from(document.querySelectorAll("span.highlight"));
  // No spans to modify
  if (highlightedSpans.length === 0) return;

  const strategySelected = document.querySelector(".checklist-choice:checked");
  const grouped = new Map();
  highlightedSpans.forEach(s => {
    let emailId = s.dataset.emailId;
    if (!grouped.has(emailId)) {
      grouped.set(emailId, []);
    }
    grouped.get(emailId).push(s);
  }
  );

  const refuseEvents = [];
  grouped.forEach((spanList, eId) => {
    // Prepare event to store
    const refuseEvent = {
      event: "refuse",
      spans: [],
      text: null,
      session_id: SESSION_ID,
      user_id: USER_EMAIL,
      email_id: eId,
      strategy: strategySelected.id,
      refuse_reason: ref_reason,
      is_all: isAll
    };

    // Restore original text
    spanList.forEach((s) => {
      const original = s.dataset.original;
      const reformulation = s.dataset.reformulation;
      const userForm = s.dataset.userContent;
      const spanObj = {
        span_id: s.id,
        original: original,
        reformulation: reformulation,
        current_used: original,
        user_form: userForm
      }

      if (userForm) {
        spanObj.user_form = userForm;
      }
      // Add span event
      refuseEvent.spans.push(spanObj);

      // Remove associated spanDiv
      const spanDiv = document.getElementById(`div-${s.id}`);
      if (spanDiv) spanDiv.remove();
      s.replaceWith(document.createTextNode(original));
    });
    refuseEvents.push(refuseEvent);

    // Trigger input event on the contenteditable div to notify Gmail of changes
    const contentDiv = document.querySelector(`div[role="textbox"][contenteditable="true"]#${CSS.escape(eId)}`);
    if (contentDiv) {
      contentDiv.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  );

  if (document.querySelectorAll("span.highlight").length === 0) {
    setResultButtons(false);
  }

  if (span === undefined) resetButtons();
  try {
    chrome.runtime.sendMessage({
      action: "storeEvent",
      payload: refuseEvents
    });
  } catch (error) {
    logger.error("Failed to store event: ", error);
  }

}


function accept({ span = undefined, input = false, isAll = false } = {}) {
  const highlightedSpans = span ? [span] : Array.from(document.querySelectorAll("span.highlight"));
  // No spans to modify
  if (highlightedSpans.length === 0) return;

  const strategySelected = document.querySelector(".checklist-choice:checked");
  const grouped = new Map();
  highlightedSpans.forEach(s => {
    let emailId = s.dataset.emailId;
    if (!grouped.has(emailId)) {
      grouped.set(emailId, []);
    };
    grouped.get(emailId).push(s);
  });

  const acceptEvents = [];
  grouped.forEach((spanList, eId) => {
    // Prepare event to store
    const acceptEvent = {
      event: input ? "edit" : "accept",
      spans: [],
      text: null,
      session_id: SESSION_ID,
      user_id: USER_EMAIL,
      strategy: strategySelected.id,
      email_id: eId,
      is_all: isAll
    };

    // Restore original text
    spanList.forEach((s) => {
      const original = s.dataset.original;
      const reformulation = s.dataset.reformulation;
      const currentUsed = input ? s.dataset.currentUsed : s.dataset.reformulation;
      const userForm = s.dataset.userContent;
      const spanObj = {
        span_id: s.id,
        original: original,
        reformulation: reformulation,
        current_used: currentUsed,
      }

      if (userForm) {
        spanObj.user_form = userForm
      }
      // Add span event
      acceptEvent.spans.push(spanObj);
      // Remove associated spanDiv
      const spanDiv = document.getElementById(`div-${s.id}`);
      if (spanDiv) spanDiv.remove();
      s.replaceWith(document.createTextNode(currentUsed));
    });

    acceptEvents.push(acceptEvent);

    // Trigger input event on the contenteditable div to notify Gmail of changes
    const contentDiv = document.querySelector(`div[role="textbox"][contenteditable="true"]#${CSS.escape(eId)}`);
    if (contentDiv) {
      contentDiv.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (document.querySelectorAll("span.highlight").length === 0) {
      setResultButtons(false);
    }
    if (span === undefined) resetButtons();
    try {
      chrome.runtime.sendMessage({
        action: "storeEvent",
        payload: acceptEvents
      });
    } catch (error) {
      logger.error("Failed to store event: ", error);
    }
  }
  );
}