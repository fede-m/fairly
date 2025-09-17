console.log("Background service worker loaded");

const backgroundUrl = "https://f95bacaa5d56.ngrok-free.app/analyze";
async function call_backend(data) {
  const payload = { data: data };
  try {
    const response = await fetch(backgroundUrl, {
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
