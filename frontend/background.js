console.log("Background service worker loaded");
const BASE_URL = "http://localhost:8000"
const API = {
  //baseUrl: "https://a3cd-2001-a61-34ba-7501-e85a-563f-72e6-b0da.ngrok-free.app",
  baseUrl: BASE_URL,

  get analyse() { return `${this.baseUrl}/analyse`; },
  get storeEvent() { return `${this.baseUrl}/store-event`; },
  get storeFeedback() { return `${this.baseUrl}/store-feedback`; }
}

async function analyseData(payload) {
  if (payload == null) {
    console.error("[background] Not a valid payload!");
    return { error: "Invalid payload!" };
  }
  try {
    const startTime = performance.now();
    console.log("[background] [" + new Date().toISOString() + "] Sending data to backend... API:", API.analyse);
    const response = await fetch(API.analyse, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const responseTime = performance.now();
    const elapsedMs = (responseTime - startTime).toFixed(2);
    console.log("[background] [" + new Date().toISOString() + "] Got response from backend. Status:", response.status, "Elapsed time:", elapsedMs + "ms");
    // Convert response to json
    const result = await response.json();
    const endTime = performance.now();
    const totalElapsedMs = (endTime - startTime).toFixed(2);
    console.log("[background] [" + new Date().toISOString() + "] Parsed JSON from backend. Total elapsed time:", totalElapsedMs + "ms");
    return result;
  } catch (error) {
    console.error("[background] Error calling backend:", error);
    return { error: error.message };
  }
}

async function storeEvent(payload) {
  if (payload == null) {
    console.error("Not a valid payload!");
  }
  try {
    console.log(payload);
    console.log(JSON.stringify(payload));
    const response = await fetch(API.storeEvent, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    return result;
  }
  catch (error) {
    console.error("Error calling backend:", error);
    return { error: error.message };
  }
}

async function storeFeedback() { }

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action == "analyseData") {
    /* data = [
      {"id": "1", "text":"myText1"},
      {"id": "2", "text":"myText2"},
      ...
    ] */
    console.log("[background] Received analyseData action. Payload:", msg.payload);
    const data = msg.payload;
    const tabId = sender.tab ? sender.tab.id : null;
    analyseData(data).then((result) => {
      console.log("[background] Returned from analyseData(). Checking tabId:", tabId);
      if (tabId) {
        console.log("[background] Sending processedData to tab:", tabId, "with result:", result);
        chrome.tabs.sendMessage(tabId, {
          action: "processedData",
          payload: result,
        });
      } else {
        console.warn("[background] No tabId available to send the message back to!");
      }
    });
    // Immediately reply so the contentScript's callback doesn't throw a "port closed" error
    console.log("[background] Sending initial processing_started response back to tab.");
    sendResponse({ status: "processing_started" });
    return true;
  }
  else if (msg.action == "storeEvent") {
    const data = msg.payload;
    console.log(data);
    storeEvent(data)
      .then(res => console.log(res))
      .catch(err => console.error("Failed to store event:", err));
  }
  else if (msg.action == "storeFeedback") { }

});

