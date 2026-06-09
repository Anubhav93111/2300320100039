# Logging Middleware Package

Reusable logging package for backend and frontend applications.

## Function Contract

```js
log(stack, level, packageName, message)
```

Note: In JavaScript strict mode, `package` is a reserved keyword, so the argument is named `packageName` but maps to `package` in the API payload.

## Constraints Enforced

- Protected route auth token required
- Lowercase fields enforced
- Allowed stack values: `backend`, `frontend`
- Allowed level values: `debug`, `info`, `warn`, `error`, `fatal`

## Installation

Use as a local package in your monorepo/workspace.

## Backend Usage

```js
const express = require("express");
const { createLoggingMiddleware, log } = require("../logging_package/src");

const app = express();

app.use(
  createLoggingMiddleware({
    authToken: process.env.LOG_API_TOKEN,
    packageName: "handler"
  })
);

app.get("/health", async (_req, res) => {
  await log("backend", "info", "handler", "health check passed", {
    authToken: process.env.LOG_API_TOKEN
  });

  res.status(200).json({ ok: true });
});
```

## Frontend Usage

```js
const { createLogger } = require("../logging_package/src");

const logger = createLogger({
  authToken: "your_token_here"
});

await logger.log("frontend", "info", "ui", "dashboard loaded successfully");
```

## API Target

- `POST http://4.224.186.213/evaluation-service/logs`
- Headers:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/json`

## Payload Sent

```json
{
  "stack": "backend",
  "level": "error",
  "package": "handler",
  "message": "received string expected bool"
}
```
