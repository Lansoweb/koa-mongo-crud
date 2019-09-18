/* eslint-disable global-require */
module.exports = {
  CrudController: require('./src/crud/controller'),
  CrudMapper: require('./src/crud/mapper'),
  ValidationException: require('./src/crud/validation-exception'),
  DuplicationException: require('./src/crud/duplication-exception'),
  ResponseTimeMiddleware: require('./src/middleware/response-time'),
  ErrorMiddleware: require('./src/middleware/error'),
  NewRelicMiddleware: require('./src/middleware/newrelic'),
  AuthMiddleware: require('./src/middleware/auth'),
  ApiServer: require('./src/server'),
  Uuid: require('./src/infra/uuid'),
  MongoQF: require('./src/crud/mongodb-query-filter'),
};
