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

const GameModel = proxyquire('../../lib/model/GameModel', {
  '../util/random': randomStub
});

const GameSchema = require('../../lib/schemas/GameSchema');

const BOARD_ENTRIES = require('../../lib/definitions/GameDefinitions').BOARD_ENTRIES;
const O = BOARD_ENTRIES.O;
const X = BOARD_ENTRIES.X;
const C = BOARD_ENTRIES.CLEAR;

const GAME_OUTCOMES = require('../../lib/definitions/GameDefinitions').GAME_OUTCOMES;
const WP1 = GAME_OUTCOMES.X;
const WP2 = GAME_OUTCOMES.O;
const WCATS = GAME_OUTCOMES.NONE;
const WUNK = GAME_OUTCOMES.UNDECIDED;

const GameFactory = require('../factory/GameFactory');

const p1 = { user_id: 'DJI1233', user_name: 'p1' };
const p2 = { user_id: 'FJI1233', user_name: 'p2' };
const p3 = { user_id: 'AJI1233', user_name: 'p3' };
const p4 = { user_id: 'MJI1233', user_name: 'p4' };

describe('GameModel', function() {
  before(function(cb) {
    setupUtils.clearDb(cb);
  });

  describe('getWinner', function() {
    function makeBoard(row1, row2, row3) {
      return {
        board: [row1, row2, row3],
        players: ['player1', 'player2']
      };
    }

    it('detects col wins', function() {
      const tests = [
        makeBoard(
          [O, O, X],
          [O, X, O],
          [O, O, X]
        ),
        makeBoard(
          [X, O, X],
          [X, O, O],
          [O, O, X]
        ),
        makeBoard(
          [X, O, O],
          [O, X, O],
          [X, O, O]
        ),
        makeBoard(
          [X, X, O],
          [X, O, X],
          [X, X, O]
        ),
        makeBoard(
          [O, X, X],
          [X, X, O],
          [O, X, X]
        ),
        makeBoard(
          [O, X, X],
          [X, O, X],
          [O, X, X]
        )
      ];
      const results = _.map(tests, GameModel.getWinner);
      expect(results).toEqual([WP2, WP2, WP2, WP1, WP1, WP1]);
    });

    it('detects row wins', function() {
      const tests = [
        makeBoard(
          [O, O, X],
          [X, X, O],
          [O, O, O]
        ),
        makeBoard(
          [X, O, X],
          [O, O, O],
          [X, X, O]
        ),
        makeBoard(
          [O, O, O],
          [X, X, O],
          [O, O, X]
        ),
        makeBoard(
          [X, X, O],
          [O, O, X],
          [X, X, X]
        ),
        makeBoard(
          [O, X, O],
          [X, X, X],
          [O, O, X]
        ),
        makeBoard(
          [X, X, X],
          [O, O, X],
          [X, X, O]
        )
      ];
      const results = _.map(tests, GameModel.getWinner);
      expect(results).toEqual([WP2, WP2, WP2, WP1, WP1, WP1]);
    });

    it('detects diagonal wins', function() {
      const tests = [
        makeBoard(
          [X, O, O],
          [O, X, O],
          [O, O, X]
        ),
        makeBoard(
          [O, O, X],
          [O, X, O],
          [X, O, O]
        ),
        makeBoard(
          [O, X, X],
          [X, O, X],
          [X, X, O]
        ),
        makeBoard(
          [X, X, O],
          [X, O, X],
          [O, X, X]
        )
      ];
      const results = _.map(tests, GameModel.getWinner);
      expect(results).toEqual([WP1, WP1, WP2, WP2]);
    });

    it('detects cats game', function() {
      const tests = [
        makeBoard(
          [O, X, O],
          [X, X, O],
          [X, O, X]
        ),
        makeBoard(
          [O, O, X],
          [X, X, O],
          [O, O, X]
        )
      ];
      const results = _.map(tests, GameModel.getWinner);
      expect(results).toEqual([WCATS, WCATS]);
    });

    it('detects no-winner when no winner yet', function() {
      const tests = [
        makeBoard(
          [C, X, O],
          [X, X, O],
          [X, O, X]
        ),
        makeBoard(
          [O, O, X],
          [C, X, O],
          [O, C, X]
        ),
        makeBoard(
          [O, C, O],
          [X, X, X],
          [C, O, X]
        )
      ];
      const results = _.map(tests, GameModel.getWinner);
      expect(results).toEqual([WUNK, WUNK, WP1]);
    });
  });

  describe('createGame', function() {
    it('created games pass validation', function(cb) {
      async.waterfall([
        _.partial(GameModel.createGame, 'model_game_create_1', p1, p2),
        function(game, cb) {
          Joi.validate(game, GameSchema, cb);
        }
      ], function(err, validGame) {
        expect(err).toNotExist();
        expect(validGame).toExist();
        cb();
      });
    });

    it('first player is randomly chosen', function(cb) {
      useRandomStub = true;
      async.series([
        function(cb) {
          randomOverride = 0.25;
          GameModel.createGame('model_game_create_2', p1, p2, cb);
        },
        function(cb) {
          randomOverride = 0.75;
          GameModel.createGame('model_game_create_3', p1, p2, cb);
        }
      ], function(err, res) {
        expect(err).toNotExist();
        expect(_.size(res)).toEqual(2);
        expect(res[0].firstPlayerIndex).toNotEqual(res[1].firstPlayerIndex);
        cb();
      });
    });

    after(function(cb) {
      useRandomStub = false;
      cb();
    });
  });

  describe('player utility functions', function(cb) {
    let game1, game2;
    before(function(cb) {
      useRandomStub = true;
      async.series([
        function(cb) {
          randomOverride = 0.25;
          GameModel.createGame('model_game_utility_1', p1, p2, cb);
        },
        function(cb) {
          randomOverride = 0.75;
          GameModel.createGame('model_game_utility_2', p3, p4, cb);
        }
      ], function(err, res) {
        expect(err).toNotExist();
        expect(_.size(res)).toEqual(2);
        game1 = res[0];
        game2 = res[1];
        cb();
      });
    });

    it('player queries work as expected', function() {
      expect(GameModel.getFirstPlayerIndex(game1)).toEqual(0);
      expect(GameModel.getFirstPlayerIndex(game2)).toEqual(1);
      expect(GameModel.getSecondPlayerIndex(game1)).toEqual(1);
      expect(GameModel.getSecondPlayerIndex(game2)).toEqual(0);
      expect(GameModel.isXTurn(game1)).toBeTruthy();
      expect(GameModel.isXTurn(game2)).toBeTruthy();
      expect(GameModel.getNextPlayer(game1)).toEqual(p1);
      expect(GameModel.getNextPlayer(game2)).toEqual(p4);
      game1.move++;
      game2.move++;
      expect(GameModel.isXTurn(game1)).toBeFalsy();
      expect(GameModel.isXTurn(game2)).toBeFalsy();
      expect(GameModel.getNextPlayer(game1)).toEqual(p2);
      expect(GameModel.getNextPlayer(game2)).toEqual(p3);
    });

    after(function(cb) {
      useRandomStub = false;
      cb();
    });
  });

  describe('applyMove', function() {
    it('invalid indexes are handled', function(cb) {
      let pass = 0;
      function mkTestCb(cb, testString) {
        return function testCb(err) {
          if (err && _.includes(err.message, testString)) {
            pass++;
          }
          cb();
        };
      }

      let game;
      async.waterfall([
        function(cb) {
          gamesCollection.insert(GameFactory.makeGame(p1, p2, 'model_game_move_1',
            [[C, C, C], [C, C, C], [C, C, C]]
          ), cb);
        },
        function(_game, cb) {
          game = _game;
          GameModel.applyMove(game, p1, 'zoo', 3, mkTestCb(cb, 'Invalid board location'));
        },
        function(cb) {
          GameModel.applyMove(game, p1, 5, 3, mkTestCb(cb, 'Invalid board location'));
        },
        function(cb) {
          GameModel.applyMove(game, p1, 0, 3, mkTestCb(cb, 'Invalid board location'));
        },
        function(cb) {
          GameModel.applyMove(game, p1, 0.5, 3, mkTestCb(cb, 'Invalid board location'));
        },
        function(cb) {
          GameModel.applyMove(game, p1, 1, 'zoo', mkTestCb(cb, 'Invalid board location'));
        },
        function(cb) {
          GameModel.applyMove(game, p1, 1, 5, mkTestCb(cb, 'Invalid board location'));
        },
        function(cb) {
          GameModel.applyMove(game, p1, 1, 0, mkTestCb(cb, 'Invalid board location'));
        },
        function(cb) {
          GameModel.applyMove(game, p1, 1, 0.5, mkTestCb(cb, 'Invalid board location'));
        },
      ], function(err, res) {
        expect(pass).toEqual(8);
        cb();
      });
    });
    it('players cannot play in a game that does not include them', function(cb) {
      async.waterfall([
        function(cb) {
          gamesCollection.insert(GameFactory.makeGame(p1, p2, 'model_game_move_2',
            [[C, C, C], [C, C, C], [C, C, C]]
          ), cb);
        },
        function(game, cb) {
          GameModel.applyMove(game, 'p7', 1, 1, cb);
        }
      ], function(err, res) {
        expect(err).toExist();
        expect(err.message).toContain('not a player');
        cb();
      });
    });
    it('players cannot move when it is not their turn', function(cb) {
      let game;
      async.waterfall([
        function(cb) {
          gamesCollection.insert(GameFactory.makeGame(p1, p2, 'model_game_move_3',
            [[C, C, C], [C, C, C], [C, C, C]]
          ), cb);
        },
        function(game, cb) {
          GameModel.applyMove(game, p2, 1, 1, cb);
        }
      ], function(err, res) {
        expect(err).toExist();
        expect(err.message).toContain('not your turn');
        cb();
      });
    });
    it('players cannot move in an occupied space', function(cb) {
      let game;
      async.waterfall([
        function(cb) {
          gamesCollection.insert(GameFactory.makeGame(p1, p2, 'model_game_move_4',
            [[C, C, C], [C, C, C], [C, C, C]]
          ), cb);
        },
        function(game, cb) {
          GameModel.applyMove(game, p1, 1, 1, cb);
        },
        function(game, cb) {
          GameModel.applyMove(game, p2, 1, 1, cb);
        }
      ], function(err, res) {
        expect(err).toExist();
        expect(err.message).toContain('already moved at that board location');
        cb();
      });
    });
    it('correct player is X, O', function(cb) {
      async.waterfall([
        function(cb) {
          gamesCollection.insert(GameFactory.makeGame(p1, p2, 'model_game_move_5',
            [[C, C, C], [C, C, C], [C, C, C]]
          ), cb);
        },
        function(game, cb) {
          GameModel.applyMove(game, p1, 1, 1, cb);
        },
        function(game, cb) {
          GameModel.applyMove(game, p2, 1, 2, cb);
        }
      ], function(err, game) {
        expect(err).toNotExist();
        expect(game.board[0][0]).toEqual(X);
        expect(game.board[0][1]).toEqual(O);
        cb();
      });
    });
    it('completed games reject further moves', function(cb) {
      async.waterfall([
        function(cb) {
          gamesCollection.insert(GameFactory.makeGame(p1, p2, 'model_game_move_6',
            [[C, C, C], [C, C, C], [C, C, C]]
          ), cb);
        },
        function(game, cb) {
          GameModel.applyMove(game, p1, 1, 1, cb);
        },
        function(game, cb) {
          GameModel.applyMove(game, p2, 2, 1, cb);
        },
        function(game, cb) {
          GameModel.applyMove(game, p1, 1, 2, cb);
        },
        function(game, cb) {
          GameModel.applyMove(game, p2, 2, 3, cb);
        },
        function(game, cb) {
          GameModel.applyMove(game, p1, 1, 3, cb); // <- winning move
        },
        function(game, cb) {
          GameModel.applyMove(game, p2, 3, 3, cb);
        }
      ], function(err, res) {
        expect(err).toExist();
        expect(err.message).toContain('already over');
        cb();
      });
    });
  });

  describe('loadGame', function() {
    before(function(cb) {
      // create several games
      async.series([
        _.partial(gamesCollection.insert, GameFactory.makeGame(p1, p2, 'model_game_load_1',
          [[C, C, O], [X, O, C], [C, C, C]]
        )),
        _.partial(gamesCollection.insert, GameFactory.makeGame(p1, p3, 'model_game_load_2',
          [[X, O, C], [O, X, C], [O, O, O]]
        ))
      ], cb);
    });

    it('finds existing games', function(cb) {
      async.parallel({
        game1: _.partial(GameModel.loadGame, 'model_game_load_1'),
        game2: _.partial(GameModel.loadGame, 'model_game_load_2')
      }, function(err, res) {
        expect(res.game1).toExist();
        expect(res.game2).toExist();
        expect(res.game1.players).toContain(p1);
        expect(res.game1.players).toContain(p2);
        expect(res.game2.players).toContain(p1);
        expect(res.game2.players).toContain(p3);
        expect(res.game1.board[0][0]).toEqual(C);
        expect(res.game2.board[0][0]).toEqual(X);
        cb();
      });
    });
    it('returns null/undefined on no-such-game', function(cb) {
      async.parallel({
        unknown_game: _.partial(GameModel.loadGame, 'model_game_load_nonexisting')
      }, function(err, res) {
        expect(res.unknown_game).toNotExist();
        cb();
      });
    });
  });

  describe('saveGame', function() {
    it('can save', function(cb) {
      async.waterfall([
        _.partial(GameModel.saveGame,
          GameFactory.makeGame(p1, p2, 'model_game_save_1', [[C, C, O], [X, O, C], [C, C, C]]))
      ], function(err, res) {
        expect(err).toNotExist();
        expect(res).toExist();
        expect(res.gameId).toEqual('model_game_save_1');
        cb();
      });
    });

    it('can save again', function(cb) {
      async.waterfall([
        function(cb) {
          async.series([
            _.partial(GameModel.saveGame,
              GameFactory.makeGame(p1, p2, 'model_game_save_2', [[C, C, O], [X, O, C], [C, C, C]])),
            _.partial(GameModel.saveGame,
              GameFactory.makeGame(p1, p2, 'model_game_save_2', [[X, C, O], [X, O, C], [C, C, C]]))
          ], langUtils.provide(cb));
        },
        function(cb) {
          gamesCollection.findOne({ gameId: 'model_game_save_2' }, cb);
        }
      ], function(err, res) {
        expect(err).toNotExist();
        expect(res.gameId).toEqual('model_game_save_2');
        expect(res.board[0][0]).toEqual(X);
        cb();
      });
    });

    it('games that dont pass schema are rejected', function(cb) {
      GameModel.saveGame(
        _.extend(
          GameFactory.makeGame(p1, p2, 'model_game_save_schemareject', [[C, C, O], [X, O, C], [C, C, C]]),
          { zardoz: 'blargh' }),
        function(err) {
          expect(err).toExist();
          expect(err.message).toContain('zardoz');
          cb();
        });
    });
  });

  describe('e2e', function() {
    before(function(cb) {
      useRandomStub = true;
      randomOverride = 0;
      cb();
    });

    it('create-load-move-save-load', function(cb) {
      async.waterfall([
        _.partial(GameModel.createGame, 'model_game_e2e_1', p1, p2),
        function(game, cb) {
          GameModel.loadGame(game.gameId, cb);
        },
        function(game, cb) {
          GameModel.applyMove(game, p1, 2, 2, cb);
        },
        function(game, cb) {
          GameModel.saveGame(game, cb);
        },
        function(game, cb) {
          GameModel.loadGame(game.gameId, cb);
        }
      ], function(err, game) {
        expect(err).toNotExist();
        expect(game).toExist();
        expect(game.board[1][1]).toEqual(X);
        cb();
      });
    });

    after(function(cb) {
      useRandomStub = false;
      cb();
    });
  });
});
