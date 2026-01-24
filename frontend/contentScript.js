const STRATEGIES = Object.freeze({ CV: "CV", CO: "CO", IO: "IO", IV: "IV" });
 /* Create HTML elements for the UI */ 
 
 function createWidget() { 
    const widget = document.createElement("div"); 
    widget.id = "fairly-widget"; 
    widget.className = "widget-div"; 
    const img = document.createElement("img"); 
    img.id = "fairly-widget-toggle"; 
    return widget; 
}

function createImgLogo() { 
    const img = document.createElement("img"); 
    // The chrome.runtime.getURL('fairly_logo.png') constructs a full internal URL to the extension's resources 
    img.src = chrome.runtime.getURL("fairly_logo.png"); 
    img.className = "fairly-logo"; 
    return img; 
} 

function startAnalysis() {
    // Perform both detection and generation sequentially 
    const currentLocation = window.location.href; 
    // Delete all spans that were not accepted
    discard()
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

            if (!selected) { console.warn("No strategy selected!"); 
                
                return; 
            } 
            dataObj["strategy"] = selected.id; 
            dataObj["data"] = [] 
            editableElements.forEach((element) => { 
                const data = {}; 
                const key = element.id; 
                data["id"] = key; 
                data["text"] = element.innerText;
                dataObj["data"].push(data); 
            }) 
            console.log(dataObj); 
            // Send data to background 
            chrome.runtime.sendMessage({ 
                action: "inputData", 
                payload: dataObj, }) 
        } else {
            // Remove existing warning popup
            const existingWarning = document.getElementById("warning-msg");
            if (existingWarning) existingWarning.remove()

            // Create new warning popup
            const warningPopup = document.createElement("div");
            warningPopup.className = "warning-popup message-popup";
            warningPopup.id = "warning-msg";

            const warningMsg = document.createElement("span");
            warningMsg.textContent = "⚠️ Non ci sono mail da analizzare!";

            const closeBtn = document.createElement("button");
            closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

            closeBtn.className = "popup-close-btn";

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

function createInfoDiv() { 
    const infoDiv = document.createElement("div"); 
    infoDiv.id = "fairly-info"; 
    infoDiv.className = "info-div"; 
    infoDiv.style.display = "none"; 
    /* infoDiv content */ 
    // Add tab bar at the top of the div with widget title 
    const tabBar = document.createElement("div"); 
    tabBar.className = "top-bar"; 
    const logo = document.createElement("img"); 
    logo.src = chrome.runtime.getURL("fairly_logo_complete.png"); 
    logo.className = "fairly-logo-complete"; 
    tabBar.appendChild(logo); 
    infoDiv.appendChild(tabBar); 
    
    // Add tabBar to infoDiv 
    // Add text 
    const paragraph = document.createElement("p"); 
    paragraph.innerText = "Scegli una soluzione piú inclusiva!"; 
    paragraph.style.fontSize = "14px"; 
    infoDiv.appendChild(paragraph); 
    // Check-list container 
    const checklist = document.createElement("div"); 
    checklist.className = "checklist"; 



    // Helper to create a checklist item
    function createChecklistItem(labelText, strategyName, hasNested, nestedOption = [], defaultSelected= false) { 
        // Check that the strategy name is correct 
        if (strategyName != null && !Object.values(STRATEGIES).includes(strategyName)) { 
            console.warn("createChecklistItem: invalid strategyName", strategyName) 
            strategyName = "" 
        }; 
        const item = document.createElement("div"); 

        item.className = "checklist-item"; 

        if (hasNested && (nestedOption.length > 0 )) { 
            // Create the item to contain arrow and label on the same line
            const container = document.createElement("div"); 
            container.className = "options-container"; 
            // Create arrows to toggle the nested options
            const arrowDownSVG = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="#202155" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`; 
            const arrowUpSVG = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 10l4-4 4 4" stroke="#202155" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
            
            const arrowBtn = document.createElement("button"); 
            arrowBtn.className = "arrow-btn";
            arrowBtn.innerHTML = arrowDownSVG; 
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
                // Whenever an option is clicked, we change its staus to "clicked" and unclick all the other options
                nestedCheckbox.addEventListener("click", function(e){
                        // Check if the current checkbox is selected 
                        if (this.checked) { 
                            // Uncheck all other checkboxes 
                            document.querySelectorAll(".checklist-choice").forEach(cb => { 
                                if (cb !== this) {cb.checked = false}; 
                            }); 
                            
                        } else {
                            e.preventDefault()
                            this.checked = true;
                        }
                        
                    
                }) 
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
                        }
                    })

                    // Check the first option of the current nested div
                    document.querySelectorAll(".checklist-choice").forEach(cb => {
                        cb.checked = false;
                    });
                    nestedDiv.firstChild.firstChild.checked = true;

                    // TODO: Delete this logic (delete the defaultSelected option)
                    
                    
                    // TODO: set the first child as the selected one (deleting all the other checks)

                } else { 
                    nestedDiv.style.display = "none"; 
                    arrowBtn.innerHTML = arrowDownSVG; 
                } 
            }); 
        } else { 
            const label = document.createElement("label"); 
            const checkbox = document.createElement("input"); 
            checkbox.type = "checkbox"; 
            checkbox.className = "thickbox checklist-choice"; 
            label.appendChild(checkbox); 
            label.appendChild(document.createTextNode(" "+ labelText)); 
            item.appendChild(label); 
            checkbox.addEventListener("change", function() { 
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
    checklist.appendChild(createChecklistItem("Doppia forma (M/F)", STRATEGIES.CV, true, ["gli studenti e le studenti", "i/le studenti"], true)); 
    checklist.appendChild(createChecklistItem("Nome astratto", STRATEGIES.CO, true, ["la comunità studentesca"], false)); 
    checklist.appendChild(createChecklistItem("Forme innovative", STRATEGIES.IO, true, ["l* student*", "l@ student@", "lx studentx", "lu studentu", "lə studentə"], false)); 
    checklist.appendChild(createChecklistItem("Tripla forma (M/F/N)", STRATEGIES.IV, true, ["gli studenti, le studenti e l* student*", "gli/le/l* student*"], false)); 
    
    // -------------- Create buttons ----------------------------- 
    const buttonWrapper = document.createElement("div"); 
    buttonWrapper.id = "info-btn-wrapper";
    buttonWrapper.className = "btn-wrapper"; 
    // ------------------- Accept all button -------------------
    const acceptAllBtn = document.createElement("button"); 
    acceptAllBtn.id = "accept-all"; 
    acceptAllBtn.className = "accept-all-btn"; 
    acceptAllBtn.textContent = 'Accetta tutto'; 
    acceptAllBtn.style.display = "none"; 
    acceptAllBtn.addEventListener("click", () => { 
        accept();
    }); 
    // ------------------- Refuse all button -------------------
    const refuseAllBtn = document.createElement("button"); 
    refuseAllBtn.id = "refuse-all"; 
    refuseAllBtn.className = "refuse-all-btn"; 
    refuseAllBtn.textContent = "Rifiuta tutto"; 
    refuseAllBtn.style.display = "none"; 
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
    // Create the div element
    const spanDiv = document.createElement("div");
    spanDiv.id = `div-${spanEl.id}`;
    spanDiv.className = "span-div";
    spanDiv.style.display = "none";

    // Show the old text
    const p = document.createElement("p");
    //p.style.padding = "0px";
    p.innerHTML = `<strong><del>${spanEl.dataset.original}</del><strong>`;
    p.style.margin = "0px";
    p.style.fontSize = "13px";

    const inputWrap = document.createElement("div");
    inputWrap.className = "input-wrap";

    const inputFormulation = document.createElement("input");
    inputFormulation.id = `user-ref-${spanEl.id}`;
    inputFormulation.type = "text";
    inputFormulation.placeholder = "La tua soluzione inclusiva";
    inputFormulation.style.display = "none";

    inputFormulation.addEventListener("click", (event) => {
    event.stopPropagation();
    });


    const saveBtn = document.createElement("button");
    saveBtn.className = "save-btn";
    saveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-save-icon lucide-save"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>`;

    saveBtn.style.display = "none";
    saveBtn.addEventListener("click", (event) => {
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
    revertChangeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-undo2-icon lucide-undo-2"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/></svg>`

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
    editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height= "16" width="15" viewBox="0 0 24 26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-pencil-line-icon lucide-pencil-line"><path d="M13 21h8"/><path d="m15 5 4 4"/><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>`

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
    accBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-icon lucide-check"><path d="M20 6 9 17l-5-5"/></svg>`
    
    accBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        accept(spanEl);
    });

    // Refuse reformulations for the span (keep the original text)
    const refBtn = document.createElement("button");
    refBtn.className = "small-ref-btn";
    refBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash2-icon lucide-trash-2"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`

    refBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        discard(spanEl);
    })

    btnWrap.appendChild(editBtn);
    btnWrap.appendChild(accBtn);
    btnWrap.appendChild(refBtn);
    spanDiv.appendChild(p);
    //spanDiv.appendChild(labelInput);
    spanDiv.appendChild(inputWrap);
    spanDiv.appendChild(btnWrap);

    spanDiv.addEventListener("click", (event) => {
    event.stopPropagation();
    });


    // Show the accept and discard buttons

    return spanDiv
}


function highlightSpans(div, spans) { 
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
    const walker = document.createTreeWalker( div, NodeFilter.SHOW_TEXT, null, false ); 
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
    nodes.forEach((node) => { 
        // Get text and start and end char of node 
        const nodeText = node.nodeValue; 
        const nodeStart = charIndex; 
        const nodeEnd = charIndex + nodeText.length; 

        // Find all spans that overlap with this node 
        const nodeSpans = spans.filter( (span) => span.start_char < nodeEnd && span.end_char > nodeStart ); 
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
                spanEl.innerText = part.reformulation; 
                spanEl.setAttribute("contenteditable", "false"); 
                // Store original text and reformulation in the object 
                spanEl.dataset.original = part.text; 
                spanEl.dataset.reformulation = part.reformulation;
                spanEl.dataset.currentUsed = part.reformulation;

                const spanDiv = createSpanPopupDiv(spanEl);

                frag.appendChild(spanEl); 
                // Add click event 
                spanEl.addEventListener("click", (e) => {
                    e.stopPropagation();
                    // Hide all other spanDivs
                    document.querySelectorAll(".span-div").forEach(s => {
                        if (s.id !== spanDiv.id) {s.style.display = "none";}
                    });
                    // Toggle visibility
                    const isVisible = spanDiv.style.display === "block";

                    if (isVisible) {
                        spanDiv.style.display = "none";
                    } else {
                        // Append to body if not already present
                        if (!document.body.contains(spanDiv)) {
                            document.body.appendChild(spanDiv);
                        }

                        spanDiv.style.visibility = "hidden";
                        spanDiv.style.display = "block";
                        
                        void spanDiv.offsetHeight;

                        // Get spanDiv dimensions (now that it's rendered)
                        const popupWidth = spanDiv.offsetWidth;
                        const popupHeight = spanDiv.offsetHeight;

                        // Use Range to get the start position of the span
                        // const range = document.createRange();
                        // range.selectNodeContents(spanEl);
                        // range.collapse(true); // true = start, false = end
                        // const startRect = range.getBoundingClientRect();
                        // Get all client rects for the span (handles multi-line spans)
                        const rects = spanEl.getClientRects();

                        let startRect;
                        if (rects.length > 0) {
                            startRect = rects[0];
                        } else {
                            startRect = spanEl.getBoundingClientRect();
                        }
                        // Get viewport dimensions
                        const viewportWidth = window.innerWidth;
                        const viewportHeight = window.innerHeight;

                        

                        // Add a small gap below the span
                        const GAP = 6;

                         // Calculate initial position (below the span start)
                        let left = startRect.left + window.scrollX;
                        let top = startRect.bottom + window.scrollY + GAP;

                        // --- Horizontal overflow prevention ---
                        // If popup would overflow right edge of viewport
                        if (left + popupWidth > viewportWidth + window.scrollX) {
                            // Align popup's right edge with span's right edge
                            left = startRect.right + window.scrollX - popupWidth;
                            
                            // If still overflowing left edge, clamp to left edge
                            if (left < window.scrollX) {
                                left = window.scrollX + 8; // 8px padding from edge
                            }
                        }
                        // Ensure it doesn't overflow left edge
                        if (left < window.scrollX) {
                            left = window.scrollX + 8;
                        }

                        // --- Vertical overflow prevention ---
                        // If popup would overflow bottom of viewport
                        if (top + popupHeight > viewportHeight + window.scrollY) {
                            // Try to place it above the span instead
                            const topAbove = startRect.top + window.scrollY - popupHeight - GAP;
                            
                            if (topAbove >= window.scrollY) {
                                // There's room above
                                top = topAbove;
                            } else {
                                // Not enough room above either, clamp to bottom with padding
                                top = viewportHeight + window.scrollY - popupHeight - 8;
                            }
                        }

                        // Apply final position
                        spanDiv.style.left = `${left}px`;

                        spanDiv.style.top = `${top}px`;
                        spanDiv.style.visibility = "visible";

                        
                    }

                })

                
            } else if (part.text) { 
                frag.appendChild(document.createTextNode(part.text)); 
            } 
        }); 
        node.replaceWith(frag); 
        charIndex += nodeText.length; 
    }); 
} 

function initExtension() { 
    // Check if a widget already exists 
    if (document.getElementById("fairly-widget")) return; 
    // Create needed elements 
    const widget = createWidget(); 
    const img = createImgLogo(); 
    const infoDiv = createInfoDiv(); 
    // Append elements following hierarchy 
    widget.appendChild(img); 
    widget.appendChild(infoDiv); 
    document.body.appendChild(widget); 
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
            infoDiv.style.display = infoDiv.style.display == "none"? "block" : "none"; 
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
    
    
// Retrieve processed data from background 
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => { 
    if (msg.action === "processedData") { 
        console.log(msg.payload); 
        const response = msg.payload; 

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
        
        const refuseBtn = document.getElementById("refuse-all"); 
        const acceptBtn = document.getElementById("accept-all"); 
        const analyzeBtn = document.getElementById("analyze"); 
        const btnWrapper = document.getElementById("info-btn-wrapper"); 

        if (hasSpans) {
            // Make Refuse All and Accept All buttons clickable 

            analyzeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-rotate-cw-icon lucide-rotate-cw"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>`
            acceptBtn.style.display = "block"; 
            refuseBtn.style.display = "block"; 
            btnWrapper.style.justifyContent = "space-between"; 

            // Remove existing success messages
            const existingMsg = document.getElementById("no-span-message");
            if(existingMsg) existingMsg.remove()
        } else {
            console.log("Nessuno span unfair trovato, ottimo lavoro!");
            // Remove existing success messages
            const existingPopup = document.getElementById("no-span-message");
            if(existingPopup) existingPopup.remove()

            // Create new success message
            const successPopup = document.createElement("div");
            successPopup.id = "no-span-message";
            successPopup.className = "message-popup success-popup";

            const successMsg = document.createElement("span");
            successMsg.textContent = "Nessuno span unfair trovato, ottimo lavoro!";

            // Crete close btn
            const closeBtn = document.createElement("button");
            closeBtn.className = "popup-close-btn";
            closeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
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

            refuseBtn.style.display = "none";
            btnWrapper.style.justifyContent = "flex-end";

        }
    } 
}); 
            


// Create the extension on page load
window.addEventListener("load", () => { setTimeout(initExtension, 2000); });

// Just before reloading the page, we clean up any span introduced by our widget
// window.addEventListener("beforeunload", () => {
//     discard();
// });