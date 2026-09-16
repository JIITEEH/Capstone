// Throw from any controller; errorHandler turns it into a JSON response
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
