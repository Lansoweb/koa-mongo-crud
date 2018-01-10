const crypto = require('crypto');
const v1 = require('uuid/v1');
const v4 = require('uuid/v4');
const v5 = require('uuid/v5');

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

module.exports = { v1, v4, v5, v4c: create(4), v6: create(6) };
