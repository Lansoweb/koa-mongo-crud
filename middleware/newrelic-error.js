const newrelic = require('newrelic');

const DEFAULT_TRANSACTION_NAME = (method, path) => 'Koajs/' + (path[0] === '/' ? path.slice(1) : path) + '#' + method;

module.exports = async (ctx, next) => {
  try {
    await next();
    newrelic.setTransactionName(DEFAULT_TRANSACTION_NAME(ctx.method, ctx._matchedRoute));
  } catch (err) {
    if (typeof err.errors === 'object') {
      err.status = 422;
    }
    newrelic.noticeError(err);
    newrelic.setTransactionName(DEFAULT_TRANSACTION_NAME(ctx.method, ctx._matchedRoute));
    throw err;
  }
};
