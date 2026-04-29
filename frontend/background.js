console.log("Background service worker loaded");
const BASE_URL = "http://localhost:8000"
const API = {
  //baseUrl: "https://a3cd-2001-a61-34ba-7501-e85a-563f-72e6-b0da.ngrok-free.app",
  baseUrl: BASE_URL,

  get analyse() {return `${this.baseUrl}/analyse`;},
  get storeEvent() {return `${this.baseUrl}/store-event`;},
  get storeFeedback() {return `${this.baseUrl}/store-feedback`;}
}

async function analyseData(payload) {
  // Check payload is valid
  if (payload == null) {
    console.error("Not a valid payload!");
    return { error: true,
      message: "Invalid payload!",
      code: "INVALID_PAYLOAD"
    };
  }
  try {
    const response = await fetch(API.analyse, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

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
    return result;
  } catch (error) {
    console.error("Network error:", error);
    return { 
      error: true,
      message: "Network error. Check if server available.",
      code: "NETWORK_ERROR",
      details: error.message 
    };
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

async function storeFeedback() { }

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
  else if (msg.action == "storeFeedback") { }
});

