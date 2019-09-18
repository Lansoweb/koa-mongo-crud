/* eslint-disable no-underscore-dangle */
/* eslint-disable global-require */

const DEFAULT_TRANSACTION_NAME = (method, path) => `Koajs/${path[0] === '/' ? path.slice(1) : path}#${method}`;

module.exports = async (ctx, next) => {
  // eslint-disable-next-line import/no-unresolved
  const newrelic = require('newrelic');

  try {
    await next();
    if (typeof ctx._matchedRoute !== 'undefined') {
      newrelic.setTransactionName(DEFAULT_TRANSACTION_NAME(ctx.method, ctx._matchedRoute));
    }
  } catch (err) {
    if (typeof err.errors === 'object') {
      err.status = 422;
    }
    newrelic.noticeError(err);
    if (typeof ctx._matchedRoute !== 'undefined') {
      newrelic.setTransactionName(DEFAULT_TRANSACTION_NAME(ctx.method, ctx._matchedRoute));
    }
    throw err;
  }
};
