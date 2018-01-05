
module.exports = class ValidationException extends Error {
  constructor(errors) {
    super();
    this.errors = errors;
  }
}
