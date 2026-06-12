console.log("Background service worker loaded");
const BASE_URL = "http://localhost:8000"
const API = {
  baseUrl: BASE_URL,

  get analyse() {return `${this.baseUrl}/analyse`;},
  get storeEvent() {return `${this.baseUrl}/store-event`;},
  get addUser() {return `${this.baseUrl}/add-user`;},
  get storeInfo() {return `${this.baseUrl}/store-info-event`;},
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

async function makeRequest(url, payload, errorContext = "request", timeoutMs = 30000) {
  // Check payload is valid
  if (payload == null) {
    console.error("Not a valid payload!");
    return { 
      error: true,
      message: "Invalid payload!",
      code: "INVALID_PAYLOAD"
    };
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    if (!response.ok) {
      console.error(`Backend error: ${response.status}`);
      return {
        error: true,
        message: `Error during ${errorContext} with status code ${response.status}`,
        code: "ANALYSIS_FAILED",
        status: response.status
      };
    }

    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("Request timeout");
      return {
        error: true,
        message: `${errorContext} took too long (>${timeoutMs/1000}s). Server may be unavailable.`,
        code: "TIMEOUT",
        details: "Request aborted"
      }
    }
    console.error("Network error:", error);
    return { 
      error: true,
      message: "Network error. Check if server available.",
      code: "NETWORK_ERROR",
      details: error.message 
    };
  }
}

async function analyseData(payload) {
  startKeepAlive();
  try{
    return await makeRequest(API.analyse, payload, "analysis", 40000);
  } finally {
    stopKeepAlive();
  }
}

async function storeEvent(payload) {
  return makeRequest(API.storeEvent, payload, "storing event");
}

async function addUser(payload) {
  return makeRequest(API.addUser, payload, "adding user");
}

async function storeInfo(payload) {
  return makeRequest(API.storeInfo, payload, "adding user");
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action == "analyseData") {
    /* data = [
      {"id": "1", "text":"myText1"},
      {"id": "2", "text":"myText2"},
      ...
    ] */
    const data = msg.payload;
    analyseData(data).then((result) => {
      if (sender.tab && sender.tab.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          action: "processedData",
          payload: result,
        }).catch((err) => {
          console.error("Failed to communicate with contentScript: ", err)
        });
      }
    });
  }
  else if (msg.action == "storeEvent") {
    const data = msg.payload;
    console.log(data);
    storeEvent(data)
      .then(res => console.log(res))
      .catch(err => console.error("Failed to store event:", err));
  }
  else if (msg.action == "addUser") {
    const data = msg.payload;
    console.log(data);
    addUser(data)
    .then(res => console.log(res))
    .catch(err => console.error("Failed to add user:", err));
  }
  else if (msg.action == "storeInfo"){
    const data = msg.payload;
    storeInfo(data)
    .then(res => console.log(res))
    .catch(err => console.log("Failed to store info event:", err))
  }
});

