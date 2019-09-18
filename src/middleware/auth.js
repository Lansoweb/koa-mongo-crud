
const auth = require('basic-auth');

module.exports = (config, allowedRoutes = []) => async (ctx, next) => {
  if (config.length === 0 || allowedRoutes.indexOf(ctx.request.url) >= 0) {
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
