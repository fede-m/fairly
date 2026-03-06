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
    // TODO: store interaction on MongoDB
    // If there is no specific span, delete all current spans
    if (span === undefined) {
        // Get all span elements
        const highlightedSpans = document.querySelectorAll("span.highlight"); 
        // Restore original text
        highlightedSpans.forEach((span) => { 
            const original = span.dataset.original; 
            // Remove associated spanDiv
            const spanDiv = document.getElementById(`div-${span.id}`);
            if (spanDiv) spanDiv.remove();
            span.replaceWith(document.createTextNode(original));
        });

        resetButtons();

    } else {
        // Reject only the current span
        const original = span.dataset.original;
        // Remove associated spanDiv
        const spanDiv = document.getElementById(`div-${span.id}`);
        if (spanDiv) spanDiv.remove();
        span.replaceWith(document.createTextNode(original));

    }
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