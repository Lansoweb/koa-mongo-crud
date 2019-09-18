
const config = {
  name: 'example',
  version: '1.0.0',
  db: {
    dbName: 'dbName',
    uri: 'mongodb://uri',
    options: {
      socketTimeoutMS: 5000,
    },
  },
  auth: [
    {
      identity: 'username',
      credential: 'password',
    },
  ],
};

module.exports = config;
