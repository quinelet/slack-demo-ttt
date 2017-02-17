'use strict';

const _ = require('lodash');
const async = require('async');
const db = require('monk')(process.env.MONGO_DB);

const Errors = require('../util/Errors');

const SlackMisc = require('../util/SlackMisc');
const UserMessage = require('../util/UserMessage');

const GameModel = require('../model/GameModel');

const GAME_OUTCOMES = require('../definitions/GameDefinitions').GAME_OUTCOMES;

// Provide user-facing operations on games and game-sessions.
// Only CommunicableErrors (from GameModel) and UserMessages will be translated to users.
// gameId here is the session identifier for a game, one per '<team_id>/<channel_id>'

function challenge(gameId, user, otherUser, cb) {
  async.waterfall([
    _.partial(GameModel.loadGame, gameId),
    function(game, cb) {
      if (game && game.outcome === GAME_OUTCOMES.UNDECIDED) {
        return cb(null, new UserMessage.UserMessage(null,
          `A game between ${SlackMisc.getDisplayUser(game.players[0])} and ` +
            `${SlackMisc.getDisplayUser(game.players[1])} is already in progress!`,
          UserMessage.PRIVATE
        ));
      }
      async.waterfall([
        _.partial(GameModel.createGame, gameId, user, otherUser),
        function(game, cb) {
          return cb(null, new UserMessage.UserMessage(game,
            `Tictastic! Here comes a new challenger! ${SlackMisc.getDisplayUser(user)} vs ` +
              `${SlackMisc.getDisplayUser(otherUser)}!`,
            UserMessage.PUBLIC
          ));
        }
      ], cb);
    }
  ], cb);
}

function abort(gameId, user, cb) {
  async.waterfall([
    _.partial(GameModel.removeGame, gameId),
    function(cb) {
      return cb(null, new UserMessage.UserMessage(null,
        `${SlackMisc.getDisplayUser(user)} has aborted and cleared the most recent game`,
        UserMessage.PUBLIC
      ));
    }
  ], cb);
}

function move(gameId, user, col, row, cb) {
  async.waterfall([
    _.partial(GameModel.loadGame, gameId),
    function(game, cb) {
      if (!game) {
        return cb(null,
          new UserMessage.UserMessage(
            null,
            `No such game! Issue a challenge to start a new game.`,
            UserMessage.PRIVATE
          )
        );
      }

      async.waterfall([
        _.partial(GameModel.applyMove, game, user, col, row),
        _.partial(GameModel.saveGame),
        function(game, cb) {
          if (game.outcome === GAME_OUTCOMES.UNDECIDED) {
            return cb(null, new UserMessage.UserMessage(game,
              `${SlackMisc.getDisplayUser(user)} moved at ${col},${row}.`,
              UserMessage.PUBLIC));
          } else if (game.outcome === GAME_OUTCOMES.NONE) {
            return cb(null, new UserMessage.UserMessage(game,
              `Cats game!`,
              UserMessage.PUBLIC));
          } else {
            return cb(null, new UserMessage.UserMessage(game,
              `${SlackMisc.getDisplayUser(user)} wins with move at ${col},${row}!`,
              UserMessage.PUBLIC));
          }
        }
      ], cb);
    }
  ], cb);
}

function status(gameId, cb) {
  async.waterfall([
    _.partial(GameModel.loadGame, gameId),
    function(game, cb) {
      if (!game) {
        return cb(null, new UserMessage.UserMessage(null, 'No current game found.', UserMessage.PRIVATE));
      }
      return cb(null,
        new UserMessage.UserMessage(
          game,
          'The current game is:',
          UserMessage.PRIVATE));
    }
  ], cb);
}

module.exports = {
  abort: abort,
  challenge: challenge,
  move: move,
  status: status
};
