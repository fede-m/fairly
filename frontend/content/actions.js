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


function discard(span = undefined, ref_reason = "user_refuse"){
    
    const highlightedSpans = span ? [span] : Array.from(document.querySelectorAll("span.highlight"));
    // No spans to modify
    if (highlightedSpans.length === 0) return;

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
    grouped.forEach((spanList, eId) =>{
        // Prepare event to store
            const refuseEvent = {
                    event: "refuse",
                    spans: [],
                    session_id: SESSION_ID,
                    user_id: USER_EMAIL,
                    email_id: eId,
                    refuse_reason: ref_reason
                };

            // Restore original text
            spanList.forEach((s) => { 
                const original = s.dataset.original; 
                const reformulation = s.dataset.reformulation; 
                const userForm = s.dataset.userContent;
                const spanObj = {
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

    if (span === undefined) resetButtons();
    chrome.runtime.sendMessage({
                action:"storeEvent",
                payload: refuseEvents
            });
} 

function accept(span = undefined, input = false){
    const highlightedSpans = span ? [span] : Array.from(document.querySelectorAll("span.highlight"));
    // No spans to modify
    if (highlightedSpans.length === 0) return;

    const grouped = new Map();
    highlightedSpans.forEach(s => {
        let emailId = s.dataset.emailId;
        if (!grouped.has(emailId)) {
            grouped.set(emailId, []);
        }
        grouped.get(emailId).push(s);
    }
    );

    const acceptEvents = [];
    grouped.forEach((spanList, eId) =>{
        // Prepare event to store
        const acceptEvent = {
                event: input ? "edit" : "accept",
                spans: [],
                session_id: SESSION_ID,
                user_id: USER_EMAIL,
                email_id: eId,
            };

        // Restore original text
        spanList.forEach((s) => { 
            const original = s.dataset.original; 
            const reformulation = s.dataset.reformulation;
            const currentUsed = input ? s.dataset.currentUsed : s.dataset.reformulation;
            const userForm = s.dataset.userContent;
            
            const spanObj = {
                original: original,
                reformulation: reformulation,
                current_used: reformulation,
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
    }
    );
    if (span === undefined) resetButtons();
    chrome.runtime.sendMessage({
                action:"storeEvent",
                payload: acceptEvents
            });
}