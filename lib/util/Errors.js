'use strict';

const _ = require('lodash');

// Error class that express error handle is allowed to make visible to callers.
function CommunicableError(code, message) {
  this.statusCode = code;
  this.message = message;
  this.ttt_error = true;
}

module.exports = {
  CommunicableError: CommunicableError
};
