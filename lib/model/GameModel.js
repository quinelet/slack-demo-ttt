'use strict';

const async = require('async');
const _ = require('lodash');
const Joi = require('joi');
const langUtils = require('langUtils');
const db = require('monk')(process.env.MONGO_DB);
const gamesCollection = db.get('games');

const Errors = require('../util/Errors');
const random = require('../util/random'); // for ease with stubbing in testing

const BOARD_ENTRIES = require('../definitions/GameDefinitions').BOARD_ENTRIES;
const GAME_OUTCOMES = require('../definitions/GameDefinitions').GAME_OUTCOMES;
const GameSchema = require('../schemas/GameSchema');

const WinChecks = [
  // rows
  [[0, 0], [1, 0], [2, 0]],
  [[0, 1], [1, 1], [2, 1]],
  [[0, 2], [1, 2], [2, 2]],

  //columns
  [[0, 0], [0, 1], [0, 2]],
  [[1, 0], [1, 1], [1, 2]],
  [[2, 0], [2, 1], [2, 2]],

  // diagonals
  [[0, 0], [1, 1], [2, 2]],
  [[0, 2], [1, 1], [2, 0]]
];

function checkThree(a, b, c) {
  if (a === b && b === c && a !== BOARD_ENTRIES.CLEAR) {
    // winner!
    if (a === BOARD_ENTRIES.O) {
      return GAME_OUTCOMES.O;
    } else {
      return GAME_OUTCOMES.X;
    }
  }
  return GAME_OUTCOMES.UNDECIDED;
}

function getWinner(game) {
  let outcome = GAME_OUTCOMES.UNDECIDED;
  _.each(WinChecks, function(condition) {
    const checkOutcome = checkThree(
      game.board[condition[0][0]][condition[0][1]],
      game.board[condition[1][0]][condition[1][1]],
      game.board[condition[2][0]][condition[2][1]]
    );
    if (checkOutcome !== GAME_OUTCOMES.UNDECIDED) {
      outcome = checkOutcome;
      return false;
    }
  });

  // check for draw game - no winner and no open spaces
  if (outcome === GAME_OUTCOMES.UNDECIDED &&
    _.every(game.board, function(col) {
      return _.every(col, function(pos) {
        return pos !== BOARD_ENTRIES.CLEAR;
      });
    })) {
    outcome = GAME_OUTCOMES.NONE;
  }
  return outcome;
}

function generateEmptyGame(gameId, user1, user2) {
  const players = _.sortBy([user1, user2], 'user_name');

  const first = Math.floor(random() * 2);
  return {
    players: players,
    firstPlayerIndex: first,
    gameId: gameId,
    board: [
      [BOARD_ENTRIES.CLEAR, BOARD_ENTRIES.CLEAR, BOARD_ENTRIES.CLEAR],
      [BOARD_ENTRIES.CLEAR, BOARD_ENTRIES.CLEAR, BOARD_ENTRIES.CLEAR],
      [BOARD_ENTRIES.CLEAR, BOARD_ENTRIES.CLEAR, BOARD_ENTRIES.CLEAR]
    ],
    outcome: GAME_OUTCOMES.UNDECIDED,
    move: 0
  };
}

function saveGame(game, cb) {
  // ensure stable ordering of players.
  game.players = _.sortBy(game.players, 'user_name');

  async.waterfall([
    _.partial(Joi.validate, game, GameSchema),
    function(validGame, cb) {
      gamesCollection.update(
        { gameId: game.gameId },
        validGame,
        { upsert: true },
        langUtils.provide(cb, validGame));
    }
  ], cb);
}

// Generate a new game with a unique id.
function createGame(gameId, user1, user2, cb) {
  const game = generateEmptyGame(gameId, user1, user2);
  saveGame(game, cb);
}

function loadGame(gameId, cb) {
  gamesCollection.findOne({ gameId: gameId }, cb);
}

function removeGame(gameId, cb) {
  gamesCollection.remove({ gameId: gameId }, langUtils.provide(cb));
}

function getFirstPlayerIndex(game) {
  return game.firstPlayerIndex;
}

function getSecondPlayerIndex(game) {
  return (game.firstPlayerIndex + 1) % 2;
}

function isXTurn(game) {
  return ((game.move % 2) === 0);
}

function getNextPlayer(game) {
  return isXTurn(game) ?
    game.players[getFirstPlayerIndex(game)] : game.players[getSecondPlayerIndex(game)];
}

function applyMove(game, user, col, row, cb) {
  if (!_.find(game.players, { user_id: user.user_id })) {
    return cb(new Errors.CommunicableError(200, 'You are not a player in this game!'));
  }

  if (!Number.isInteger(col) || col < 1 || col > 3 ||
      !Number.isInteger(row) || row < 1 || row > 3)
  {
    return cb(new Errors.CommunicableError(200, 'Invalid board location. Valid indexes 1-3.'));
  }

  if (game.outcome !== GAME_OUTCOMES.UNDECIDED) {
    return cb(new Errors.CommunicableError(200, 'That game is already over!'));
  }

  if (getNextPlayer(game).user_id !== user.user_id)  {
    return cb(new Errors.CommunicableError(200, 'It\'s not your turn.'));
  }

  if (game.board[col-1][row-1] !== BOARD_ENTRIES.CLEAR) {
    return cb(new Errors.CommunicableError(200, 'Someone has already moved at that board location!'));
  }

  // otherwise, move there with appropriate symbol
  game.board[col-1][row-1] = isXTurn(game) ? BOARD_ENTRIES.X : BOARD_ENTRIES.O;

  game.move++;

  game.outcome = getWinner(game);

  cb(null, game);
}

module.exports = {
  saveGame: saveGame,
  createGame: createGame,
  loadGame: loadGame,
  removeGame: removeGame,
  applyMove: applyMove,
  getFirstPlayerIndex: getFirstPlayerIndex,
  getSecondPlayerIndex: getSecondPlayerIndex,
  isXTurn: isXTurn,
  getNextPlayer: getNextPlayer,
  getWinner: getWinner
};
