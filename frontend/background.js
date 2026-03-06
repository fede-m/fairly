console.log("Background service worker loaded");

const backendUrl = "https://a5db-2001-a61-34ba-7501-94c1-6eca-3d93-91f3.ngrok-free.app/analyse";
async function call_backend(payload) {
  if (payload == null) {
    console.error("Not a valid payload!");
  }
  try {
    const response = await fetch(backendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Convert response to json
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error calling backend:", error);
    return { error: error.message };
  }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.action == "inputData") {
    /* data = [
      {"id": "1", "text":"myText1"},
      {"id": "2", "text":"myText2"},
      ...
    ] */
    const data = msg.payload;
    call_backend(data).then((result) => {
      if (sender.tab && sender.tab.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          action: "processedData",
          payload: result,
        });
      }
    });
  }
});
