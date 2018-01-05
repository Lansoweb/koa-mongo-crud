const Log4js = require('log4js');

module.exports = (app, config) => {
  Log4js.configure(config);
  app.logger = Log4js.getLogger();
}
