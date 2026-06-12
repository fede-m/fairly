# Error propagation

| Error Type  | Description                               | Where it Happens | Error propagation stack |Current Handling | Missing/incomplete |

|:-------------|-----------------------------------------:|------------------------:|------------------------:|----------------:|:-------------------|

|LLM Timeout   | LLM API doesn't respond within 40 seconds| `llm.py`: `generation()`| `llm.py` raises Exception --> `main.py` catches in inner try-except --> returns |setosa     |

|          4.8|         3.0|          1.4|         0.1|setosa     |

|          6.1|         2.8|          4.7|         1.2|versicolor |

|          6.1|         3.0|          4.6|         1.4|versicolor |


## Error-types handling
### GenAI error or BERT error
- Description: generation or detection fail
- Where it Happens:  `llm.py`: `generation()`/ `detection()`
- Error propagation: 
    1. `llm.py` raises Exception
    2. `main.py` catches in inner try-except and returns {error: true, message: "ANALYSIS_FAILED"}
    3. `background.js` catches it and returns "ANALYSIS_FAILED" to `contentScript.js` using `processedData` message
    4. `contentScript.js` receives the `processedData` message, checks for errors and shows the popup for the error message "ANALYSIS_FAILED"

### Request timeout
- Description: the whole request takes longer than 40 seconds
- Where it Happens:  `background.js` (adding the `controller.signal`) to the payload. NOTE: there is also a timeout in the OpenAI client in `llm.py` that ensures the call to the LLM closes after 40 seconds, so that it does not block other requests.
- Error propagation: 
    1. `background.js` --> `fetch` raises an error as the request took longer than 40 seconds. 
    2. `background.js` returns "TIMEOUT" error to `contentScript.js` using `processedData` message
    4. `contentScript.js` receives the `processedData` message, checks for errors and shows the popup for the error message "TIMEOUT"


### Network error
- Description: triggers when fetch() returns an error before the timeout ends. This can happen in these situations: 
    - backend server is completely down (refuses connection)
    - internet disconnected
    - DNS resolution fails
    - Invalid JSON response
    - Invalid JSON input
    - CORS error
- Where it Happens:  `background.js`
- Error propagation: 
    1. `background.js` --> `fetch` raises an error
    2. `background.js` returns "NETWORK_ERROR" error to `contentScript.js` using `processedData` message
    3. `contentScript.js` receives the `processedData` message, checks for errors and shows the popup for the error message "NETWORK_ERROR"

### Invalid Payload
- Description: `contentScript.js` sends an invalid payload to `background.js`, so that it cannot process the request. NOTE: it does not check whether specific fields are in the payload request. This is handled backend side and would trigger a NETWORK_ERROR
- Where it Happens:  `background.js`
- Error propagation: 
    1. `background.js` --> check that the payload is not null
    2. `contentScript.js` receives the `processedData` message, checks for errors and shows the popup for the error message "INVALID_PAYLOAD"

### Widget DOM lost
- Description: the widget is removed before the response arrives
- Where it happens: `contentScript.js` in the `processedData` listener
- Error propagation:
    1. the `processedData` listener checks with the function isWidgetValid() if the widget is still in the DOM
    2. if it is not, it sets loading to false and returns early

### Basckground Failure
- Description: the background server crashes. `contentScript` needs a timeout so that the widget stops loading in case it receives no response back from the background.
- Where it happens: `contentScript.js` in the `startAnalysis` function. Here, a 45-seconds timeout is set, so that if it does not receive a response from background within this time (200 or error), the widget stops loading and an error popup is shown.
- Error propagation:
    1. `startAnalysis` sends a request to the background, which propagates it to the backend. After the call, a 45-seconds timeout is set
    2. if background returns a response (200 or error) within this framework (`processedData` listener), the timeout is set back to null
    3. if no response is sent within 45 seconds, it means the background is down (otherwise the 40-seconds background timeout would have triggered), and `contentScript` resets the timeout, stops the loading, and shows the error popup


 