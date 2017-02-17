'use strict';

const async = require('async');
const _ = require('lodash');
const langUtils = require('langUtils');
const uuid = require('uuid');
const path = require('path');

const configs = require('./config/config');
_.each(configs, function(val, key) {
  process.env[key] = val;
});

const db = require('monk')(process.env.MONGO_DB);

function clearDb(cb) {
  async.waterfall([
    function(cb) {
      db.get('games').remove({}, langUtils.provide(cb));
    }
  ], cb);
}

module.exports = {
  clearDb: clearDb,
  db: db
};
