// logger.js
function createLogger(filename) {
  let _errorCount = 0;
  const _maxErrors = 5; // per logger instance, per page load. Restarts on page refresh
  return {
    log: (...args) => console.log(`[${filename}]`, ...args),
    warn: (...args) => console.warn(`[${filename}]`, ...args),
    error: (...args) =>{ 
      console.error(`[${filename}]`, ...args);
      if (_errorCount >= _maxErrors) return; // rate limit
      _errorCount++;
      try {
        chrome.runtime.sendMessage({
          action: "logError",
          payload: {
            source: filename,
            message: args.map(String).join(" "),
            timestamp: new Date().toISOString(),
          }
        })
      } catch (_){}
    }
  };
}