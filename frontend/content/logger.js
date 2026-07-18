// logger.js
function createLogger(filename) {
  return {
    log: (...args) => console.log(`[${filename}]`, ...args),
    error: (...args) => console.error(`[${filename}]`, ...args),
    warn: (...args) => console.warn(`[${filename}]`, ...args)
  };
}