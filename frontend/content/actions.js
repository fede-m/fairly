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


function discard(span = undefined){
    
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
                };

            // Restore original text
            spanList.forEach((s) => { 
                const original = s.dataset.original; 
                // Add span event
                refuseEvent.spans.push({
                    original: original,
                    reformulation: s.dataset.reformulation,
                    current_used: original
                });

                // Remove associated spanDiv
                const spanDiv = document.getElementById(`div-${s.id}`);
                if (spanDiv) spanDiv.remove();
                s.replaceWith(document.createTextNode(original));
            });
            refuseEvents.push(refuseEvent);
        }
    );

    if (span === undefined) resetButtons();

    chrome.runtime.sendMessage({
                action:"storeEvent",
                payload: refuseEvents
            });
    
} 

function accept(span = undefined){
    // TODO: store interaction on MongoDB
    if (span === undefined) {
        // Remove spans and replace them with the reformulated text
        const highlightedSpans = document.querySelectorAll("span.highlight");
        highlightedSpans.forEach(span => {
            const newText = span.dataset.currentUsed;
            // Remove associated spanDic
            const spanDiv = document.getElementById(`div-${span.id}`);
            if (spanDiv) {spanDiv.remove();}
            span.replaceWith(document.createTextNode(newText));
        });
        
        // Show only the Analyze button
        resetButtons();
    } else {
        const newText = span.dataset.currentUsed;
        // Remove associated spanDiv
        const spanDiv = document.getElementById(`div-${span.id}`);
        if (spanDiv) spanDiv.remove();
        span.replaceWith(document.createTextNode(newText));
    }
} 