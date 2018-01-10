'use strict';
const auth = require('basic-auth');

module.exports = (config) => {
  return async (ctx, next) => {
    if (config.length === 0) {
      return next();
    }

    let credentials = auth(ctx.request);

    let authenticated = false;
    if (credentials) {
      for (let i = 0; i < config.length; i++) {
        if (config[i].identity === credentials.name && config[i].credential === credentials.pass) {
          authenticated = true;
          break;
        }
      }
    }
    if (authenticated === false) {
      ctx.throw(401, 'Authorization failed');
    }
    return next();
  };
};
