const path = require('path');

module.exports = {
  MONGO_DB: 'localhost:27017/ttt_testdb',
  PORT: 0, // auto-bind
  SSL_CERT_PATH: path.join(__dirname, 'cert.pem'),
  SSL_CERT_KEY_PATH: path.join(__dirname, 'key.pem'),
  SSL_CERT_CHAIN_PATH: path.join(__dirname, 'chain.pem'),
  SLACK_COMMAND_TOKEN: 'abkdmfloij-1478732-afcf3',
  NODE_TLS_REJECT_UNAUTHORIZED: '0'
};

