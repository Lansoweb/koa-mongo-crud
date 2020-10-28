const { MongoClient } = require('mongodb');

module.exports = (config, logger, callback) => {
  MongoClient.connect(config.uri, config.options)
    .then((connection) => {
      if (logger) {
         logger.info('Database connection established');
      } else {
        console.log('Database connection established');
      }

      if (typeof callback === 'function') {
        callback(connection);
      }
    })
    .catch((err) => logger.error(err));
};
