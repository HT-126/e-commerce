// An expected failure (not found, conflict, ...). Services throw it, errorHandler answers with it.
// `extra` is merged into the JSON body, e.g. { variantId } for a stock conflict.
export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
