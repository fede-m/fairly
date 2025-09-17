// Create Fairly widget to show on page

// function highlightSpans(div, spans) {
//   // Create a walker to pass through all the text nodes of the current content window
//   const walker = document.createTreeWalker(
//     div,
//     NodeFilter.SHOW_TEXT,
//     null,
//     false
//   );
//   const nodes = [];
//   let node;
//   while ((node = walker.nextNode())) {
//     nodes.push(node);
//   }

//   // Keep track of the index of the text in the node
//   let charIndex = 0;
//   nodes.forEach((node) => {
//     // Get text and start and end char of node
//     const nodeText = node.nodeValue;
//     console.log(nodeText);
//     const nodeStart = charIndex;
//     const nodeEnd = charIndex + nodeText.length;
//     const frag = document.createDocumentFragment();
//     console.log(nodeText);
//     spans.forEach((span) => {
//       // Get start and end index of span
//       const start = span.start_char;
//       const end = span.end_char;

//       // Check if span is contained within current node
//       if (start < nodeEnd && end > nodeStart) {
//         // Calculate start and end index of the part to highlight in the current node text (considering that it goes from 0 to node.length)
//         const spanStart = Math.max(start - charIndex, 0);
//         const spanEnd = Math.min(end - charIndex, nodeText.length);

//         // Get the text before and after the highlight, and the text to highlight
//         const before = nodeText.slice(0, spanStart);
//         const highlight = nodeText.slice(spanStart, spanEnd);
//         const after = nodeText.slice(spanEnd);

//         // create span element
//         const spanEl = document.createElement("span");
//         spanEl.className = "highlight";
//         spanEl.innerText = highlight;

//         // Create temporary fragment to substitute the node with

//         if (before) frag.appendChild(document.createTextNode(before));
//         frag.appendChild(spanEl);
//         if (after) frag.appendChild(document.createTextNode(after));
//       }
//     });
//     node.replaceWith(frag);
//     charIndex += nodeText.length;
//   });
// }

function highlightSpans(div, spans) {
  // Remove already present spans
  const highlightedSpans = div.querySelectorAll("span.highlight"); // Get all span elements
  highlightedSpans.forEach((span) => {
    // Replace the span with its text content
    span.replaceWith(document.createTextNode(span.textContent));
  });

  // Get the new highlights

  // Create a walker to pass through all the text nodes of the current content window
  const walker = document.createTreeWalker(
    div,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

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
  nodes.forEach((node) => {
    // Get text and start and end char of node
    const nodeText = node.nodeValue;
    const nodeStart = charIndex;
    const nodeEnd = charIndex + nodeText.length;

    // Find all spans that overlap with this node
    const nodeSpans = spans.filter(
      (span) => span.start_char < nodeEnd && span.end_char > nodeStart
    );
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
        });
      }
      // Add the text of the span
      parts.push({
        text: nodeText.slice(spanStart, spanEnd),
        isHighlight: true,
      });

      lastIdx = spanEnd;
    });
    // Add the after text (after having processed all the spans in the current node)
    if (lastIdx < nodeText.length) {
      parts.push({ text: nodeText.slice(lastIdx), isHighlight: false });
    }
    // Create temporary fragment to substitute the node with
    const frag = document.createDocumentFragment();
    parts.forEach((part) => {
      if (part.isHighlight) {
        const spanEl = document.createElement("span");
        spanEl.className = "highlight";
        spanEl.innerText = part.text;
        spanEl.setAttribute("contenteditable", "false"); // Make highlight not editable
        frag.appendChild(spanEl);
      } else if (part.text) {
        frag.appendChild(document.createTextNode(part.text));
      }
    });
    node.replaceWith(frag);
    charIndex += nodeText.length;
  });
}

function createWidget() {
  // Check if a widget already exists
  if (document.getElementById("fairly-widget")) return;

  const widget = document.createElement("div");
  widget.id = "fairly-widget";
  widget.style.position = "fixed";
  widget.style.bottom = "20px";
  widget.style.right = "30px";
  widget.style.zIndex = "9999";

  const img = document.createElement("img");
  img.id = "fairly-widget-toggle";
  // The chrome.runtime.getURL('fairly_logo.png') constructs a full internal URL to the extension's resources
  img.src = chrome.runtime.getURL("fairly_logo.png");
  img.style.cssText = `
        width:50px; 
        height:50px; 
        border-radius:50%; 
        cursor: pointer; 
        box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        `;
  widget.appendChild(img);
  document.body.appendChild(widget);

  // Implement dragging
  let offsetX = 0,
    offsetY = 0; // store where inside the widget the mouse was clicked
  let isDragging = false; // tracks whether the mouse is currently dragging the widget
  let moved = false; // track if the user has moved the widget to distinguish a drag from a click

  widget.addEventListener("mousedown", (e) => {
    isDragging = true;
    moved = false;
    img.style.cursor = "grabbing"; // pointer shows hand grabbing something
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

  widget.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const dx = e.clientX - offsetX - parseInt(widget.style.left);
    const dy = e.clientY - offsetY - parseInt(widget.style.top);

    if (!moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) moved = true;
    widget.style.left = e.clientX - offsetX + "px";
    widget.style.top = e.clientY - offsetY + "px";
  });

  widget.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    img.style.cursor = "grab"; // cursor shows the hand like something can be grabbed
    if (!moved) {
      // Check if we are on Gmail or docs
      const currentLocation = window.location.href;

      if (currentLocation.startsWith("https://mail.google.com/")) {
        // Select all elements on the page which are editable (the open emails)
        const editableElements = document.querySelectorAll(
          '[contenteditable="true"]'
        );

        // Check if there are open emails
        if (editableElements.length > 0) {
          // Store editable elements with their text content
          const dataList = [];
          editableElements.forEach((element) => {
            const data = {};
            const key = element.id;
            data["id"] = key;
            data["text"] = element.innerText;
            dataList.push(data);
          });

          // Send data to background
          chrome.runtime.sendMessage({
            action: "inputData",
            payload: dataList,
          });
        }
      }
    }
  });
}

// Retrieve processed data from background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "processedData") {
    console.log(msg.payload);
    const response = msg.payload;

    // document
    //   .querySelectorAll('div[contenteditable="true"]')
    //   .forEach((contentEditable) => {
    //     const id = contentEditable.id;
    //     if (id) {
    //       highlightSpans(
    //         contentEditable,
    //         response.data[id].unfair_spans
    //       );
    //     }
    //   });
    for (const id in response.data) {
      // Use ID to get the correct contenteditable window
      const div = document.querySelector(
        `div[contenteditable="true"]#${CSS.escape(id)}` // NOTE: CSS.escape is used to escape the ":" in front of the id of the Gmail content windows
      );
      highlightSpans(div, response.data[id].unfair_spans);
    }
  }
});

window.addEventListener("load", () => {
  setTimeout(createWidget, 2000);
});
