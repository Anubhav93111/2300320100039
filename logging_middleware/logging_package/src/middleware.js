const { createLogger } = require("./logger");

function createLoggingMiddleware(config = {}) {
  const logger = createLogger(config);
  const packageName = (config.packageName || "middleware").toLowerCase();

  return function loggingMiddleware(req, res, next) {
    const method = String(req.method || "get").toLowerCase();
    const originalUrl = String(req.originalUrl || "/").toLowerCase();
    const startTime = Date.now();

    logger
      .log("backend", "info", packageName, `request started method=${method} url=${originalUrl}`)
      .catch(() => {
        // Logging should not block request execution.
      });

    res.on("finish", () => {
      const durationMs = Date.now() - startTime;
      const statusCode = Number(res.statusCode || 500);

      let level = "info";
      if (statusCode >= 500) {
        level = "error";
      } else if (statusCode >= 400) {
        level = "warn";
      }

      logger
        .log(
          "backend",
          level,
          packageName,
          `request finished method=${method} url=${originalUrl} status=${statusCode} duration_ms=${durationMs}`
        )
        .catch(() => {
          // Logging should not block request execution.
        });
    });

    next();
  };
}

module.exports = {
  createLoggingMiddleware
};
