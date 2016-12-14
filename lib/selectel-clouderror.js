function SelectelCloudError(message, status) {
  this.name = "SelectelCloudError";
  this.message = message;
  this.status = status || null;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, this.constructor);
  } else {
    this.stack = (new Error()).stack;
  }
}
SelectelCloudError.prototype = Object.create(Error.prototype);
SelectelCloudError.prototype.constructor = SelectelCloudError;

module.exports = SelectelCloudError;