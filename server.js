
const Koa = require('koa');
const helmet = require('koa-helmet');
const ErrorMiddleware = require('./middleware/error');
const AuthMiddleware = require('./middleware/auth');
const ResponseTimeMiddleware = require('./middleware/response-time');

module.exports = (config) => {

  const app = new Koa();

  app.use(helmet());
  app.use(ResponseTimeMiddleware);
  app.use(ErrorMiddleware);
  app.use(AuthMiddleware(config.auth));

  if (config.hasOwnProperty('logging')) {
    app.logger = require('./infra/logger')(config.logging);
  }

  require("./infra/mongo")(config.db, app.logger, (connection) => {

    app.db = connection.db(config.dbName);

    if (typeof callback === 'function') {
      callback(app);
    }

    let server = app.listen(config.web.port || 3000, () => {
      const host = server.address().address;
      const port = server.address().port;

      app.logger.info('App %s %s listening at http://%s:%s', config.name, config.version, host, port);
    });

  });
};
