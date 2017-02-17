const path = require('path');

module.exports = {
  // mongodb connection string
  MONGO_DB: 'localhost:27017/ttt',

  // SSL listen port for web worker
  PORT: 9443,

  // path to SSL certificate (PEM encoded)
  SSL_CERT_PATH: path.join(__dirname, 'cert.pem'),

  // path to SSL key (PEM encoded)
  SSL_CERT_KEY_PATH: path.join(__dirname, 'privkey.pem'),

  // path to full SSL cert chain (if any). Use an empty file if not needed.
  SSL_CERT_CHAIN_PATH: path.join(__dirname, 'chain.pem'),

  // slack command API token
  SLACK_COMMAND_TOKEN: 'm9fuiVSoiYpUxSrFyEfUAPLw' 
};

