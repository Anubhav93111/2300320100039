const { log, createLogger, LOG_API_URL, ALLOWED_STACKS, ALLOWED_LEVELS } = require("./logger");
const { createLoggingMiddleware } = require("./middleware");

module.exports = {
  log,
  createLogger,
  createLoggingMiddleware,
  LOG_API_URL,
  ALLOWED_STACKS,
  ALLOWED_LEVELS
};
