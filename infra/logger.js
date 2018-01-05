const Log4js = require('log4js');

module.exports = (app, config) => {
  Log4js.configure(config);
  return Log4js.getLogger();
}
