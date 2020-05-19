/* eslint-disable global-require */
const has = require('lodash.has');
const Koa = require('koa');
const helmet = require('koa-helmet');
const ErrorMiddleware = require('./middleware/error');
const AuthMiddleware = require('./middleware/auth');
const ResponseTimeMiddleware = require('./middleware/response-time');

module.exports = (config, callback) => {
  const app = new Koa();

  app.use(helmet());
  app.use(ResponseTimeMiddleware);
  app.use(ErrorMiddleware);
  app.use(AuthMiddleware(config.auth, config.authAllowedRoutes || []));

  if (has(config, 'logging')) {
    app.logger = require('./infra/logger')(config.logging);
  }

  require('./infra/mongo')(config.db, app.logger, (connection) => {
    app.db = connection.db(config.db.dbName);

    if (typeof callback === 'function') {
      callback(app);
    }

    const server = app.listen(config.web.port || 3000, () => {
      const host = server.address().address;
      const { port } = server.address();

      app.logger.info('App %s %s listening at http://%s:%s', config.name, config.version, host, port);
    });
  });
  return app;
};
