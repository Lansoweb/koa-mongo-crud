
const auth = require('basic-auth');

module.exports = (config, allowedRoutes = []) => async (ctx, next) => {
  const url = ctx.request.url.indexOf('?') !== -1 ? ctx.request.url.indexOf('?') : ctx.request.url.length;
  const route = ctx.request.url.substring(url, -1);

  if (config.length === 0 || allowedRoutes.indexOf(route) >= 0) {
    return next();
  }

  const credentials = auth(ctx.request);

  let authenticated = false;
  if (credentials) {
    for (let i = 0; i < config.length; i += 1) {
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
