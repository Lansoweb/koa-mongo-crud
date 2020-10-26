/* eslint-disable max-len */
const crypto = require('crypto');
const {
  v1, v4, v5, validate: validateUUID,
} = require('uuid');

function create(version = 4) {
  function generateId() {
    const raw = v1();

    const prefix = `${raw.substring(15, 18)}${raw.substring(9, 13)}${raw.substring(0, 5)}${version}${raw.substring(5, 8)}`;
    const prefixFormatted = `${prefix.substr(0, 8)}-${prefix.substr(8, 4)}-${prefix.substr(12)}`;

    const random = crypto.randomBytes(8).toString('hex');

    return `${prefixFormatted}-${random.substring(0, 4)}-${random.substring(4)}`;
  }

  return generateId;
}

function validate(string) {
  if (validateUUID(string)) {
    return true;
  }

  // validates v4c
  return typeof string === 'string' && /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(string);
}

module.exports = {
  v1, v4, v5, v4c: create(4), v6: create(6), validate,
};
