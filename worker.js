'use strict';

const assert = require('assert');
const expressServer = require('express')();
const _ = require('lodash');
const Errors = require('./lib/util/Errors');
const https = require('https');
const fs = require('fs');

// Load worker config
const configs = require('./config/config');
_.each(configs, function(val, key) {
  process.env[key] = val;
});

assert(process.env.PORT);
assert(process.env.SSL_CERT_PATH);
assert(process.env.SSL_CERT_KEY_PATH);

function genericErrorHandler(err, req, res, next) {
  assert(err, 'express error handler triggered unexpectedly!');

  // log errors
  console.log(`Logging error: ${err.message}`);

  // communicate them clearly if possible
  if (err.statusCode && err.ttt_error) {
    return res.status(err.statusCode).send(err.message);
  }

  // don't communicate detailed errors to clients
  return res.status(500).send('Unspecified error');
}

expressServer.get('/status', function (req, res, next) {
  res.send({ ttt: 'ok' });
});

// routes
expressServer.use('/ttt/', require('./routes/ttt'));
expressServer.use(genericErrorHandler);

const worker = https.createServer({
  ca: fs.readFileSync(process.env.SSL_CERT_CHAIN_PATH),
  cert: fs.readFileSync(process.env.SSL_CERT_PATH),
  key: fs.readFileSync(process.env.SSL_CERT_KEY_PATH)
}, expressServer).listen(process.env.PORT);

module.exports = worker;
