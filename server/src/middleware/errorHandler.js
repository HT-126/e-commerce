import { HttpError } from "../utils/httpError.js";

// Express knows this is an ERROR handler because it has 4 parameters.
export function errorHandler(err, req, res, next) {
  // If the answer already started, we cannot send another one
  if (res.headersSent) return next(err);

  // Expected failure thrown by a service: its message is written for the client
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...err.extra });
  }

  console.error(err); // full details stay on the server

  // express.json() gives 4xx errors a status (broken JSON = 400, too big = 413)
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;

  res.status(status).json({
    error: status === 500 ? "Internal server error" : "Bad request",
  });
}
