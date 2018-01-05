const MongoClient = require('mongodb').MongoClient;

module.exports = (app, config, logger, callback) => {
  MongoClient.connect(config.uri, config.options)
    .then((connection) => {

      app.db = connection.db(config.dbName);

      logger.info("Database connection established");
      if (typeof callback === 'function') {
        callback(connection);
      }
    })
    .catch((err) => logger.error(err))
};
