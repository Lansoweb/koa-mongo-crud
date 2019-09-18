const Status = require('http-status');

module.exports = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    if (typeof err.errors === 'object') {
      err.status = 422;
    }
    ctx.status = err.status || 500;
    ctx.body = {
      type: `https://httpstatuses.com/${ctx.status}`,
      title: Status[ctx.status],
      status: ctx.status,
      detail: err.message || err.errors,
    };
  }
};
