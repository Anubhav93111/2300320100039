const LOG_API_URL = "http://4.224.186.213/evaluation-service/logs";

const ALLOWED_STACKS = new Set(["backend", "frontend"]);
const ALLOWED_LEVELS = new Set(["debug", "info", "warn", "error", "fatal"]);

function normalizeAndValidateLowercase(value, fieldName) {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    throw new Error(`${fieldName} cannot be empty`);
  }

  return normalized;
}

function validateStack(stack) {
  const normalizedStack = normalizeAndValidateLowercase(stack, "stack");
  if (!ALLOWED_STACKS.has(normalizedStack)) {
    throw new Error(`stack must be one of: ${Array.from(ALLOWED_STACKS).join(", ")}`);
  }

  return normalizedStack;
}

function validateLevel(level) {
  const normalizedLevel = normalizeAndValidateLowercase(level, "level");
  if (!ALLOWED_LEVELS.has(normalizedLevel)) {
    throw new Error(`level must be one of: ${Array.from(ALLOWED_LEVELS).join(", ")}`);
  }

  return normalizedLevel;
}

function validatePackage(packageName) {
  const normalizedPackage = normalizeAndValidateLowercase(packageName, "package");
  if (!/^[a-z0-9._-]+$/.test(normalizedPackage)) {
    throw new Error("package must contain only lowercase letters, numbers, dots, underscores, or hyphens");
  }

  return normalizedPackage;
}

function validateMessage(message) {
  const normalizedMessage = normalizeAndValidateLowercase(message, "message");
  if (normalizedMessage.length > 500) {
    throw new Error("message must be <= 500 characters");
  }

  return normalizedMessage;
}

async function postLog(payload, options = {}) {
  const endpoint = options.endpoint || LOG_API_URL;
  const authToken = options.authToken || process.env.LOG_API_TOKEN;

  if (!authToken) {
    throw new Error("Missing auth token. Provide authToken in options or set LOG_API_TOKEN");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${authToken}`
    },
    body: JSON.stringify(payload)
  });

  const raw = await response.text();
  let body = null;

  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch (_err) {
      body = { raw };
    }
  }

  if (!response.ok) {
    const details = body ? JSON.stringify(body) : "no response body";
    throw new Error(`Log API failed with ${response.status}: ${details}`);
  }

  return {
    success: true,
    status: response.status,
    data: body
  };
}

async function log(stack, level, packageName, message, options = {}) {
  const payload = {
    stack: validateStack(stack),
    level: validateLevel(level),
    package: validatePackage(packageName),
    message: validateMessage(message)
  };

  return postLog(payload, options);
}

function createLogger(config = {}) {
  return {
    log: (stack, level, packageName, message, options = {}) =>
      log(stack, level, packageName, message, { ...config, ...options })
  };
}

module.exports = {
  LOG_API_URL,
  log,
  createLogger,
  ALLOWED_STACKS: Array.from(ALLOWED_STACKS),
  ALLOWED_LEVELS: Array.from(ALLOWED_LEVELS)
};
