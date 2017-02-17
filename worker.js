'use strict';

const assert = require('assert');
const expressServer = require('express')();
const _ = require('lodash');
const Errors = require('./lib/util/Errors');
const https = require('https');
const fs = require('fs');

//
// SSL web worker
// multiple listening workers is fine when run under cluster.
//

// Load worker config into environment.
const configs = require('./config/config');
_.each(configs, function(val, key) {
  process.env[key] = val;
});

assert(process.env.PORT, 'Required config PORT (listen-port) missing');

assert(process.env.MONGO_DB,
  'Required config MONGO_DB (mongo connection path) missing.'
);
assert(process.env.SSL_CERT_PATH,
  'Required config SSL_CERT_PATH (cert file) missing'
);
assert(process.env.SSL_CERT_KEY_PATH,
  'Required config SSL_CERT_KEY_PATH (key file) missing'
);
assert(process.env.SSL_CERT_CHAIN_PATH,
  'Required config SSL_CERT_CHAIN_PATH (cert chain file) missing. Empty file ok.'
);

// mask errors that aren't shareable with clients
function genericErrorHandler(err, req, res, next) {
  // !err should be impossible, but an assert here seems like a good idea.
  assert(err, 'Express error handler triggered unexpectedly. Routing failure?');

  // log errors
  console.log(`worker ${process.pid} Logging error: ${err.message}`);

  // communicate them clearly if possible
  if (err.statusCode && err.ttt_error) {
    return res.status(err.statusCode).send(err.message);
  }

  // don't communicate detailed errors to clients that aren't client-facing.
  return res.status(500).send('Unspecified error');
}

// health-check route
expressServer.get('/status', function (req, res, next) {
  res.send({ ttt: 'ok' });
});

// routes
expressServer.use('/ttt/', require('./routes/ttt'));
expressServer.use(genericErrorHandler);

const worker = https.createServer({
  ca: fs.readFileSync(process.env.SSL_CERT_CHAIN_PATH), // empty file is fine.
  cert: fs.readFileSync(process.env.SSL_CERT_PATH),
  key: fs.readFileSync(process.env.SSL_CERT_KEY_PATH)
}, expressServer).listen(process.env.PORT, function(err) {
  console.log(`worker ${process.pid} listening:`, err || 'ok');
});

module.exports = worker;
