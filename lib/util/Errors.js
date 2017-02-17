'use strict';

const _ = require('lodash');

function CommunicableError(code, message) {
  this.statusCode = code;
  this.message = message;
  this.ttt_error = true;
}

module.exports = {
  CommunicableError: CommunicableError
};
