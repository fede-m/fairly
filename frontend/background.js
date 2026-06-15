importScripts("config.js", "logger.js");

const logger = createLogger("background.js");
logger.log("Background service worker loaded");

const API = {
  baseUrl: CONFIG.BASE_URL,

  get analyse() { return `${this.baseUrl}/analyse`; },
  get storeEvent() { return `${this.baseUrl}/store-event`; },
  get storeFeedback() { return `${this.baseUrl}/store-feedback`; }
}

async function analyseData(payload) {
  if (payload == null) {
    logger.error("Not a valid payload!");
    return { error: "Invalid payload!" };
  }
  try {
    const startTime = performance.now();
    logger.log("[" + new Date().toISOString() + "] Sending data to backend... API:", API.analyse);
    const response = await fetch(API.analyse, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const responseTime = performance.now();
    const elapsedMs = (responseTime - startTime).toFixed(2);
    logger.log("[" + new Date().toISOString() + "] Got response from backend. Status:", response.status, "Elapsed time:", elapsedMs + "ms");
    // Convert response to json
    const result = await response.json();
    const endTime = performance.now();
    const totalElapsedMs = (endTime - startTime).toFixed(2);
    logger.log("[" + new Date().toISOString() + "] Parsed JSON from backend. Total elapsed time:", totalElapsedMs + "ms");
    return result;
  } catch (error) {
    logger.error("Error calling backend:", error);
    return { error: error.message };
  }
}

async function storeEvent(payload) {
  if (payload == null) {
    logger.error("Not a valid payload!");
  }
  try {
    logger.log(payload);
    logger.log(JSON.stringify(payload));
    const response = await fetch(API.storeEvent, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    return result;
  }
  catch (error) {
    logger.error("Error calling backend:", error);
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
    logger.log("Received analyseData action. Payload:", msg.payload);
    const data = msg.payload;
    const tabId = sender.tab ? sender.tab.id : null;
    analyseData(data).then((result) => {
      logger.log("Returned from analyseData(). Checking tabId:", tabId);
      if (tabId) {
        logger.log("Sending processedData to tab:", tabId, "with result:", result);
        chrome.tabs.sendMessage(tabId, {
          action: "processedData",
          payload: result,
        });
      } else {
        logger.warn("No tabId available to send the message back to!");
      }
    });
    // Immediately reply so the contentScript's callback doesn't throw a "port closed" error
    logger.log("Sending initial processing_started response back to tab.");
    sendResponse({ status: "processing_started" });
    return true;
  }
  else if (msg.action == "storeEvent") {
    const data = msg.payload;
    logger.log(data);
    storeEvent(data)
      .then(res => logger.log(res))
      .catch(err => logger.error("Failed to store event:", err));
  }
  else if (msg.action == "storeFeedback") { }

});

