
module.exports = class DuplicateException extends Error {
  constructor(errors) {
    super();
    this.errors = errors;
  }
}
