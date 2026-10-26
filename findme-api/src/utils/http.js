// Small helpers shared by controllers.

// An error that carries the HTTP status code the client should receive.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Validates data against a zod schema; throws a 400 with the first readable message.
function parse(schema, data) {
  // A missing body is treated as an empty form, so the user sees "Email is required" instead of a technical message.
  const result = schema.safeParse(data === undefined ? {} : data);
  if (!result.success) throw new HttpError(400, result.error.issues[0].message);
  return result.data;
}

module.exports = { HttpError, parse };
