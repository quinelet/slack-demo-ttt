'use strict';

const async = require('async');
const _ = require('lodash');

const Errors = require('../lib/util/Errors');
const UserMessage = require('../lib/util/UserMessage');

const TicTacToeController = require('../lib/controller/TicTacToeController');

const expressRouter = require('express').Router();

function ttt_command_error(context, message) {
  message = message || 'Invalid command usage.';
  return new UserMessage.UserMessage(null,
    `${message}\nSee ${context.command} help for more info\n`,
   UserMessage.PRIVATE);
}

function ttt_command_get_help(context) {
  return new UserMessage.UserMessage(null,
    `Tic-Tac-Toe command reference: \n` +
      `  ${context.command} help - print this help\n` +
      `  ${context.command} status - show board and status of current channel game\n` +
      `  ${context.command} challenge @player - start a new game with @player\n` +
      `  ${context.command} move <col> <row> - make a move in a game. Upper left corner is 1,1. Upper right is 3,1\n` +
      `  ${context.command} abort - clear the current or most recent game in the channel\n`,
    UserMessage.PRIVATE
  );
}

function handleCommand(context, cb) {
  // break into tokens, eating needless whitespace
  const parts = _.split(context.command_params, /\s+/);
  switch(parts[0]) {
    case 'status': {
        if (_.size(parts) !== 1) {
          return cb(null, ttt_command_error(context));
        }
        return TicTacToeController.status(context.game_id, cb);
    }
    case 'challenge': {
        const other_player = parts[1];
        if (_.isNil(other_player) || _.size(parts) !== 2) {
          return cb(null, ttt_command_error(context));
        }

        // extract username and userid from other player
        const results = other_player.match(/<@([a-zA-Z0-9]+)\|([a-zA-Z0-9_.\-]+?)>/);
        if (!results || !results[1] || !results[2]) {
          return cb(null, ttt_command_error(context, 'Please use @-style usernames when creating a game.'));
        }
        const otherUser = {
          user_id: results[1],
          user_name: results[2]
        };

        return TicTacToeController.challenge(context.game_id, context.thisUser, otherUser, cb);
    }
    case 'move': {
        const col = parseInt(parts[1]);
        const row = parseInt(parts[2]);
        if (!(Number.isInteger(col) && col >= 1 && col <= 3) ||
            !(Number.isInteger(row) && row >= 1 && row <= 3) ||
            _.size(parts) !== 3) {
          return cb(null, ttt_command_error(context));
        }
        return TicTacToeController.move(context.game_id, context.thisUser, col, row, cb);
    }
    case 'abort':
        if (_.size(parts) !== 1) {
          return cb(null, ttt_command_error(context));
        }
        return TicTacToeController.abort(context.game_id, context.thisUser, cb);

    case 'help':
        return cb(null, ttt_command_get_help(context));

    default:
        return cb(null, ttt_command_error(context));
  }
}

expressRouter.get('/command', function(req, res, next) {
  // slack occasionally does SSL checks, ignore queries of that nature.
  if (req.query.ssl_check) {
    res.status(200).send('let\'s rise up against our sadistic human masters');
    return;
  }

  const context = {
    token: req.query.token,
    game_id: `${req.query.team_id}/${req.query.channel_id}`,
    thisUser: {
      user_name: req.query.user_name,
      user_id: req.query.user_id
    },
    command: req.query.command,
    command_params: req.query.text
  };

  async.waterfall([
    function(cb) {
      if (context.token !== process.env.SLACK_COMMAND_TOKEN) {
        return cb(new Errors.CommunicableError(403, 'Incorrect Slack command token!'));
      }
      cb();
    },
    _.partial(handleCommand, context)
  ], function(err, userMessage) {
    if (err) { return next(err); }

    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(userMessage.getSlackMessage());
  });
});

module.exports = expressRouter;
