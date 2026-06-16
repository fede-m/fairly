importScripts("config.js", "logger.js");

const logger = createLogger("background.js");
logger.log("Background service worker loaded");

const API = {
  baseUrl: CONFIG.BASE_URL,

  get analyse() {return `${this.baseUrl}/analyse`;},
  get storeEvent() {return `${this.baseUrl}/store-event`;},
}

let keepAliveInterval = null;

function startKeepAlive() {
  /** Keep service worker alive during backend call.
   * Without this, MV3 service workers are terminated after ~30 seconds of inactivity.
   * If the LLM call lasts longer, the response is lost.
   */
  if (keepAliveInterval) return;
  // Ping every 25 seconds to prevent service worker termination by Chrome
  keepAliveInterval = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {}); 
  }, 25000);
}

function stopKeepAlive() {
  /**
   * Stops the pinging every 25 seconds to keep the service worker alive
   *  when the call to the backend is done
   */
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

async function analyseData(payload) {
  startKeepAlive();
  // Check payload is valid
  if (payload == null) {
    console.error("Not a valid payload!");
    return { error: true,
      message: "Invalid payload!",
      code: "INVALID_PAYLOAD"
    };
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
    // Check HTTP status
    if (!response.ok) {
      console.error(`Backend error: ${response.status}`);
      return {
        error: true,
        message: `Error during the analysis with status code ${response.status}`,
        code: "ANALYSIS_FAILED",
        status: response.status
      };
    }

    // Convert response to json
    const result = await response.json();
    const endTime = performance.now();
    const totalElapsedMs = (endTime - startTime).toFixed(2);
    logger.log("[" + new Date().toISOString() + "] Parsed JSON from backend. Total elapsed time:", totalElapsedMs + "ms");
    return result;
  } catch (error) {
    console.error("Network error:", error);
    return { 
      error: true,
      message: "Network error. Check if server available.",
      code: "NETWORK_ERROR",
      details: error.message 
    };
  } finally {
    stopKeepAlive();
  }
}

async function storeEvent(payload) {
  // Check payload is valid
  if (payload == null) {
    console.error("Not a valid payload!");
    return { error: true,
      message: "Invalid payload!",
      code: "INVALID_PAYLOAD"
    };
  }
  try {
    const response = await fetch(API.storeEvent, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    // Check HTTP status
    if (!response.ok) {
      console.error(`Backend error: ${response.status}`);
      return {
        error: true,
        message: `Error during storing with status code ${response.status}`,
        code: "STORE_FAILED",
        status: response.status
      };
    }

    const result = await response.json();
    return result;
  }
  catch (error) {
    console.error("Network error:", error);
    return { 
      error: true,
      message: "Network error. Check if server available.",
      code: "NETWORK_ERROR",
      details: error.message 
    };
  }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
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
        }).catch((err) => {
          console.error("Failed to communicate with contentScript: ", err)
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
    storeEvent(data)
      .then(res => logger.log(res))
      .catch(err => logger.error("Failed to store event:", err));
  }
});

