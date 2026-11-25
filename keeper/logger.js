const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const level  = LEVELS[process.env.LOG_LEVEL ?? "info"] ?? 1;

function timestamp() {
  return new Date().toISOString();
}

function log(lvl, ...args) {
  if (LEVELS[lvl] >= level) {
    const prefix = `[${timestamp()}] [${lvl.toUpperCase()}]`;
    if (lvl === "error") console.error(prefix, ...args);
    else                 console.log(prefix, ...args);
  }
}

module.exports = {
  debug: (...a) => log("debug", ...a),
  info:  (...a) => log("info",  ...a),
  warn:  (...a) => log("warn",  ...a),
  error: (...a) => log("error", ...a),
};
