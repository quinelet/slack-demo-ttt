'use strict';

const async = require('async');
const _ = require('lodash');
const expect = require('expect');
const langUtils = require('langUtils');
const Joi = require('joi');

const setupUtils = require('../setupUtils.js');
const db = setupUtils.db;
const gamesCollection = db.get('games');

const proxyquire = require('proxyquire');

// stub random so we can control who goes first in tests
let useRandomStub = false;
let randomOverride = 0;
const randomStub = function() {
  return useRandomStub ? randomOverride : Math.random();
};

const TicTacToeController = proxyquire('../../lib/controller/TicTacToeController', {
  '../model/GameModel': proxyquire('../../lib/model/GameModel', {
    '../util/random': randomStub
  })
});

const GameSchema = require('../../lib/schemas/GameSchema');

const BOARD_ENTRIES = require('../../lib/definitions/GameDefinitions').BOARD_ENTRIES;
const O = BOARD_ENTRIES.O;
const X = BOARD_ENTRIES.X;
const C = BOARD_ENTRIES.CLEAR;

const p1 = { user_id: 'DJI1233', user_name: 'p1' };
const p2 = { user_id: 'FJI1233', user_name: 'p2' };
const p3 = { user_id: 'AJI1233', user_name: 'p3' };

describe('TicTacToeController', function() {
  before(function(cb) {
    setupUtils.clearDb(cb);
  });

  describe('challenge', function() {
    it('allows a game to be created new in a channel', function(cb) {
      useRandomStub = true;
      randomOverride = 0;
      TicTacToeController.challenge('challenge_game_1', p1, p2, function(err, res) {
        expect(err).toNotExist();
        expect(res.game).toExist();
        expect(res.game.firstPlayerIndex).toEqual(0);
        expect(res.text).toContain('Here comes a new challenger!');
        expect(res.text).toContain('p1');
        expect(res.text).toContain('p2');
        cb();
      });
    });
    it('does not allow new games to be created if one is running', function(cb) {
      useRandomStub = true;
      randomOverride = 0;
      async.waterfall([
        _.partial(TicTacToeController.challenge, 'challenge_game_2', p1, p2),
        function(message, cb) {
          expect(message.text).toContain('Here comes a new challenger!');
          TicTacToeController.challenge('challenge_game_2', p1, p3, cb);
        }
      ], function(err, res) {
        expect(err).toNotExist();
        expect(res.text).toContain('is already in progress');
        expect(res.text).toContain('p1');
        expect(res.text).toContain('p2');
        cb();
      });
    });
    it('allows a game to be created if the last game has ended', function(cb) {
      useRandomStub = true;
      randomOverride = 0;
      async.waterfall([
        _.partial(TicTacToeController.challenge, 'challenge_game_3', p1, p2),
        function(message, cb) {
          expect(message.text).toContain('Here comes a new challenger!');
          // win the game for p1
          const sequence = [
            [p1, 1, 1], [p2, 2, 1],
            [p1, 1, 2], [p2, 2, 2],
            [p1, 1, 3]
          ];
          async.mapSeries(sequence, function(move, cb) {
            TicTacToeController.move('challenge_game_3', move[0], move[1], move[2], cb);
          }, function(err, res) {
            if (err) { return cb(err); }
            // return the last status message, which includes the win announcements as appropriate
            cb(null, _.last(res));
          });
        },
        function(message, cb) {
          expect(message.text).toContain('p1> wins with move at 1,3');
          TicTacToeController.challenge('challenge_game_3', p1, p3, cb);
        }
      ], function(err, res) {
        expect(err).toNotExist();
        expect(res.text).toContain('Here comes a new challenger!');
        expect(res.text).toContain(p1.user_name);
        expect(res.text).toContain(p3.user_name);
        cb();
      });
    });
  });

  describe('move', function() {
    let games;
    before(function(cb) {
      useRandomStub = true;
      randomOverride = 0;
      cb();
    });

    it('returns a usermessage for moves on non-existent games', function(cb) {
      TicTacToeController.move('move_game_1_nonexisting', p1, 1, 1, function(err, res) {
        expect(err).toNotExist();
        expect(res).toExist();
        expect(res.text).toContain('No such game');
        cb();
      });
    });
    it('reports moves as user messages', function(cb) {
      async.waterfall([
        _.partial(TicTacToeController.challenge, 'move_game_2', p1, p2),
        function(message, cb) {
          TicTacToeController.move('move_game_2', p1, 1, 1, cb);
        }
      ], function(err, message) {
        expect(err).toNotExist();
        expect(message).toExist();
        expect(message.text).toContain('moved at');
        cb();
      });
    });
    it('reports game outcomes', function(cb) {
      const sequences = {
        move_game_3_win: [
          [p1, 1, 1], [p2, 2, 1],
          [p1, 1, 2], [p2, 2, 2],
          [p1, 1, 3]
        ],
        move_game_3_draw: [
          [p1, 1, 1], [p2, 2, 1],
          [p1, 3, 1], [p2, 1, 2],
          [p1, 3, 2], [p2, 2, 2],
          [p1, 1, 3], [p2, 3, 3],
          [p1, 2, 3]
        ]
      };
      async.waterfall([
        function(cb) {
          async.parallel({
            move_game_3_win:
              _.partial(TicTacToeController.challenge, 'move_game_3_win', p1, p2),
            move_game_3_draw:
              _.partial(TicTacToeController.challenge, 'move_game_3_draw', p1, p2)
          }, cb);
        },
        function(messages, cb) {
          async.mapSeries(['move_game_3_win', 'move_game_3_draw'], function(scenario, cb) {
            async.mapSeries(sequences[scenario], function(move, cb) {
              TicTacToeController.move(scenario, move[0], move[1], move[2], cb);
            }, function(err, res) {
              if (err) { return cb(err); }
              // return the last status message, which includes the win announcements as appropriate
              cb(null, _.last(res));
            });
          }, cb);
        }
      ], function(err, res) {
        expect(err).toNotExist();
        expect(res[0].text).toInclude('p1> wins');
        expect(res[1].text).toInclude('Cats game');
        cb();
      });
    });
  });

  describe('status', function() {
    it('returns a userMessage object for an existing game', function(cb) {
      async.waterfall([
        _.partial(TicTacToeController.challenge, 'status_test_game_1', p1, p2),
        function(message, cb) {
          TicTacToeController.status('status_test_game_1', cb);
        }
      ], function(err, message) {
        expect(err).toNotExist();
        expect(message).toExist();
        expect(message.game.gameId).toEqual('status_test_game_1');
        expect(message.game.players).toContain(p1);
        expect(message.game.players).toContain(p2);
        cb();
      });
    });
    it('returns a usermessage object for nonexisting game', function(cb) {
      TicTacToeController.status('status_test_game_2', function(err, res) {
        expect(err).toNotExist();
        expect(res).toExist();
        expect(res.text).toContain('No current game found');
        cb();
      });
    });
    it('returns a usermessage object for completed game where X won', function(cb) {
      useRandomStub = true;
      randomOverride = 0;
      async.waterfall([
        _.partial(TicTacToeController.challenge, 'status_test_game_3', p1, p2),
        function(message, cb) {
          expect(message.text).toContain('Here comes a new challenger!');
          // win the game for p1
          const sequence = [
            [p1, 1, 1], [p2, 2, 1],
            [p1, 1, 2], [p2, 2, 2],
            [p1, 1, 3]
          ];
          async.mapSeries(sequence, function(move, cb) {
            TicTacToeController.move('status_test_game_3', move[0], move[1], move[2], cb);
          }, function(err, res) {
            if (err) { return cb(err); }
            // return the last status message, which includes the win announcements as appropriate
            cb(null, _.last(res));
          });
        },
        function(message, cb) {
          expect(message.text).toContain('p1> wins with move at 1,3');
          TicTacToeController.status('status_test_game_3', cb);
        }
      ], function(err, userMessage) {
        expect(err).toNotExist();
        expect(userMessage).toExist();
        expect(userMessage.game.move).toEqual(5);
        expect(userMessage.game.outcome).toEqual('X');
        const slackMessage = userMessage.getSlackMessage();
        expect(slackMessage.text).toContain('[X] won');
        cb();
      });
    });
    it('returns a usermessage object for completed game where O won', function(cb) {
      useRandomStub = true;
      randomOverride = 0;
      async.waterfall([
        _.partial(TicTacToeController.challenge, 'status_test_game_4', p1, p2),
        function(message, cb) {
          expect(message.text).toContain('Here comes a new challenger!');
          // win the game for p1
          const sequence = [
            [p1, 1, 1], [p2, 2, 1],
            [p1, 1, 2], [p2, 2, 2],
            [p1, 3, 1], [p2, 2, 3]
          ];
          async.mapSeries(sequence, function(move, cb) {
            TicTacToeController.move('status_test_game_4', move[0], move[1], move[2], cb);
          }, function(err, res) {
            if (err) { return cb(err); }
            // return the last status message, which includes the win announcements as appropriate
            cb(null, _.last(res));
          });
        },
        function(message, cb) {
          expect(message.text).toContain('p2> wins with move at 2,3');
          TicTacToeController.status('status_test_game_4', cb);
        }
      ], function(err, userMessage) {
        expect(err).toNotExist();
        expect(userMessage).toExist();
        expect(userMessage.game.move).toEqual(6);
        expect(userMessage.game.outcome).toEqual('O');
        const slackMessage = userMessage.getSlackMessage();
        expect(slackMessage.text).toContain('[O] won');
        cb();
      });
    });
    it('returns a usermessage object for completed cats game', function(cb) {
      useRandomStub = true;
      randomOverride = 0;
      async.waterfall([
        _.partial(TicTacToeController.challenge, 'status_test_game_5', p1, p2),
        function(message, cb) {
          expect(message.text).toContain('Here comes a new challenger!');
          // win the game for p1
          const sequence = [
            [p1, 1, 1], [p2, 2, 2],
            [p1, 3, 2], [p2, 3, 1],
            [p1, 1, 3], [p2, 2, 3],
            [p1, 2, 1], [p2, 1, 2],
            [p1, 3, 3]
          ];
          async.mapSeries(sequence, function(move, cb) {
            TicTacToeController.move('status_test_game_5', move[0], move[1], move[2], cb);
          }, function(err, res) {
            if (err) { return cb(err); }
            // return the last status message, which includes the win announcements as appropriate
            cb(null, _.last(res));
          });
        },
        function(message, cb) {
          expect(message.text).toContain('Cats game');
          TicTacToeController.status('status_test_game_5', cb);
        }
      ], function(err, userMessage) {
        expect(err).toNotExist();
        expect(userMessage).toExist();
        expect(userMessage.game.move).toEqual(9);
        expect(userMessage.game.outcome).toEqual('NONE');
        const slackMessage = userMessage.getSlackMessage();
        expect(slackMessage.text).toNotContain('[O] won');
        expect(slackMessage.text).toNotContain('[X] won');
        expect(slackMessage.text).toContain('Cats game!');
        cb();
      });
    });
  });
});
