'use strict';

const setupUtils = require('../setupUtils');

const async = require('async');
const _ = require('lodash');
const expect = require('expect');
const langUtils = require('langUtils');
const Joi = require('joi');

const SlackMisc = require('../../lib/util/SlackMisc');

const request = require('supertest');

const db = setupUtils.db;
const gamesCollection = db.get('games');

const proxyquire = require('proxyquire');

// stub random so we can control who goes first in tests
const server = proxyquire('../../worker', {
  './routes/ttt': proxyquire('../../routes/ttt', {
    '../lib/controller/TicTacToeController': proxyquire('../../lib/controller/TicTacToeController', {
      '../model/GameModel': proxyquire('../../lib/model/GameModel', {
        '../util/random': function() {
          return 0; // alphabetic turn order
        }
      })
    })
  })
});

const player1 = { user_id: 'FOIDINFON', user_name: 'player1' };
const player2 = { user_id: 'ZOIOINFON', user_name: 'player2' };
const player3 = { user_id: 'JKSIUHIFA', user_name: 'player3' };

function generateCommand(user, channel, commandText, overrides) {
  return _.extend({
    token: process.env.SLACK_COMMAND_TOKEN,
    user_name: user.user_name,
    user_id: user.user_id,
    team_id: 'test_team_id',
    channel_id: channel,
    command: 'ttt',
    text: commandText,
  }, overrides);
}

describe('route-ttt', function() {
  before(function(cb) {
    setTimeout(cb, 500);
  });

  after(function(cb) {
    server.close(cb);
  });

  describe('Slack endpoint basics', function() {
    it('tolerates Slack ssl_check queries', function(cb) {
      request(server)
        .get('/ttt/command')
        .query({ ssl_check: 1 })
        .end(function(err, res) {
          expect(err).toNotExist();
          expect(res.statusCode).toEqual(200);
          cb();
        });
    });

    it('rejects bad Slack api token', function(cb) {
      request(server)
        .get('/ttt/command')
        .query(
          {
            token: 'incorrect_token',
            command: 'ttt',
            text: 'help'
          })
        .end(function(err, res) {
          expect(err).toNotExist();
          expect(res.statusCode).toEqual(403);
          expect(res.text).toContain('Incorrect Slack command token');
          cb();
        });
    });
  });

  describe('command unrecognized', function() {
    it('provides command help', function(cb) {
      request(server)
        .get('/ttt/command')
        .query(generateCommand(player1, 'routes_ttt_command_test_err', 'wehtano'))
        .end(function(err, res) {
          expect(err).toNotExist();
          expect(res.statusCode).toEqual(200);
          expect(res.body.text).toContain('Invalid command usage');
          cb();
        });
    });
  });

  describe('command help', function() {
    it('provides command help', function(cb) {
      request(server)
        .get('/ttt/command')
        .query(generateCommand(player1, 'routes_ttt_command_test_help', 'help'))
        .end(function(err, res) {
          expect(err).toNotExist();
          expect(res.statusCode).toEqual(200);
          expect(res.body.text).toContain('Tic-Tac-Toe command reference');
          cb();
        });
    });
  });

  describe('command challenge', function() {
    it('rejects bad parameters', function(cb) {
      async.series([
        function(cb) {
          request(server)
            .get('/ttt/command')
            .query(generateCommand(player1, 'routes_ttt_challenge_test_err1', 'challenge'))
            .end(function(err, res) {
              expect(err).toNotExist();
              expect(res.statusCode).toEqual(200);
              expect(res.body.text).toContain('Invalid command usage');
              cb();
            });
        },
        function(cb) {
          request(server)
            .get('/ttt/command')
            .query(generateCommand(player1, 'routes_ttt_challenge_test_err1', 'challenge UUIUIUUUUI'))
            .end(function(err, res) {
              expect(err).toNotExist();
              expect(res.statusCode).toEqual(200);
              expect(res.body.text).toContain('Please use @-style');
              cb();
            });
        },
        function(cb) {
          request(server)
            .get('/ttt/command')
            .query(generateCommand(player1, 'routes_ttt_challenge_test_err1', 'challenge <@DIIJSOIJ|>'))
            .end(function(err, res) {
              expect(err).toNotExist();
              expect(res.statusCode).toEqual(200);
              expect(res.body.text).toContain('Please use @-style');
              cb();
            });
        },
        function(cb) {
          request(server)
            .get('/ttt/command')
            .query(generateCommand(player1, 'routes_ttt_challenge_test_err1', 'challenge <@|username>'))
            .end(function(err, res) {
              expect(err).toNotExist();
              expect(res.statusCode).toEqual(200);
              expect(res.body.text).toContain('Please use @-style');
              cb();
            });
        },
        function(cb) {
          request(server)
            .get('/ttt/command')
            .query(generateCommand(player1,
              'routes_ttt_challenge_test_err2',
              `challenge ${SlackMisc.getDisplayUser(player2)} toomanyargs`))
            .end(function(err, res) {
              expect(err).toNotExist();
              expect(res.statusCode).toEqual(200);
              expect(res.body.text).toContain('Invalid command usage');
              cb();
            });
        }
      ], cb);
    });

    it('creates a game', function(cb) {
      const challengeUser1 = { user_id: 'MODFOJSDOS', user_name: 'challenge_u_1' };
      const challengeUser2 = { user_id: 'NINIDSSF3', user_name: 'challenge_u_2' };
      async.waterfall([
        function(cb) {
          request(server)
            .get('/ttt/command')
            .query(generateCommand(challengeUser1,
              'routes_ttt_challenge_test',
              `challenge ${SlackMisc.getDisplayUser(challengeUser2)}`))
            .end(function(err, res) {
              expect(err).toNotExist();
              expect(res.statusCode).toEqual(200);
              expect(res.body.text).toContain('Here comes a new challenger!');
              cb();
            });
        },
        _.partial(gamesCollection.findOne, { 'players.user_id': challengeUser1.user_id })
      ], function(err, game) {
        expect(err).toNotExist();
        expect(game).toExist();
        expect(game.players).toInclude(challengeUser1);
        expect(game.players).toInclude(challengeUser2);
        cb();
      });
    });
  });

  describe('command status', function() {
    it('rejects bad parameters', function(cb) {
      request(server)
        .get('/ttt/command')
        .query(generateCommand(player1, 'routes_ttt_status_test', 'status argtoomany'))
        .end(function(err, res) {
          expect(err).toNotExist();
          expect(res.statusCode).toEqual(200);
          expect(res.body.text).toContain('Invalid command usage');
          cb();
        });
    });

    it('get game status on nonexisting game', function(cb) {
      request(server)
        .get('/ttt/command')
        .query(generateCommand(player1, 'routes_ttt_status_test', 'status'))
        .end(function(err, res) {
          expect(err).toNotExist();
          expect(res.statusCode).toEqual(200);
          expect(res.body.text).toContain('No current game found');
          cb();
        });
    });

    it('get game status on existing game', function(cb) {
      async.waterfall([
        function(cb) {
          request(server)
            .get('/ttt/command')
            .query(generateCommand(player1,
              'routes_ttt_status_test2',
              `challenge ${SlackMisc.getDisplayUser(player2)}}`))
            .end(function(err, res) {
              expect(err).toNotExist();
              expect(res.statusCode).toEqual(200);
              expect(res.body.text).toContain('Here comes a new challenger!');
              cb();
            });
        },
        function(cb) {
          request(server)
            .get('/ttt/command')
            .query(generateCommand(player1, 'routes_ttt_status_test2', 'status'))
            .end(function(err, res) {
              expect(err).toNotExist();
              expect(res.statusCode).toEqual(200);
              expect(res.body.text).toContain('current game');
              expect(res.body.text).toContain('player1');
              expect(res.body.text).toContain('player2');
              cb();
            });
        }
      ], function(err) {
        expect(err).toNotExist();
        cb();
      });
    });
  });

  describe('command abort', function() {
    it('rejects bad parameters', function(cb) {
      request(server)
        .get('/ttt/command')
        .query(generateCommand(player1, 'routes_ttt_abort_test_err1', 'abort the game'))
        .end(function(err, res) {
          expect(err).toNotExist();
          expect(res.statusCode).toEqual(200);
          expect(res.body.text).toContain('Invalid command usage');
          cb();
        });
    });
    it('aborts a running game', function(cb) {
      async.waterfall([
        function(cb) {
          request(server)
            .get('/ttt/command')
            .query(generateCommand(player1,
              'routes_ttt_abort_test_game',
              `challenge ${SlackMisc.getDisplayUser(player2)}`))
            .end(function(err, res) {
              expect(err).toNotExist();
              expect(res.statusCode).toEqual(200);
              expect(res.body.text).toContain('Here comes a new challenger!');
              cb();
            });
        },
        function(cb) {
          request(server)
            .get('/ttt/command')
            .query(generateCommand(player3, 'routes_ttt_abort_test_game', 'abort'))
            .end(cb);
        }
      ], function(err, res) {
        expect(err).toNotExist();
        expect(res.statusCode).toEqual(200);
        expect(res.body.text).toContain('player3> has aborted and cleared');
        cb();
      });
    });
  });

  describe('command move', function() {
    it('rejects bad parameters', function(cb) {
      async.series([
        function(cb) {
          request(server)
            .get('/ttt/command')
            .query(generateCommand(player1, 'routes_ttt_move_test_err', 'move'))
            .end(function(err, res) {
              expect(err).toNotExist();
              expect(res.statusCode).toEqual(200);
              expect(res.body.text).toContain('Invalid command usage');
              cb();
            });
        },
        function(cb) {
          request(server)
            .get('/ttt/command')
            .query(generateCommand(player1, 'routes_ttt_move_test_err', 'move'))
            .end(function(err, res) {
              expect(err).toNotExist();
              expect(res.statusCode).toEqual(200);
              expect(res.body.text).toContain('Invalid command usage');
              cb();
            });
        },
        function(cb) {
          request(server)
            .get('/ttt/command')
            .query(generateCommand(player1, 'routes_ttt_move_test_err', 'move 1'))
            .end(function(err, res) {
              expect(err).toNotExist();
              expect(res.statusCode).toEqual(200);
              expect(res.body.text).toContain('Invalid command usage');
              cb();
            });
        },
        function(cb) {
          request(server)
            .get('/ttt/command')
            .query(generateCommand(player1, 'routes_ttt_move_test_err', 'move 1 2 3'))
            .end(function(err, res) {
              expect(err).toNotExist();
              expect(res.statusCode).toEqual(200);
              expect(res.body.text).toContain('Invalid command usage');
              cb();
            });
        },
        function(cb) {
          request(server)
            .get('/ttt/command')
            .query(generateCommand(player1, 'routes_ttt_move_test_err', 'move 1 a'))
            .end(function(err, res) {
              expect(err).toNotExist();
              expect(res.statusCode).toEqual(200);
              expect(res.body.text).toContain('Invalid command usage');
              cb();
            });
        },
        function(cb) {
          request(server)
            .get('/ttt/command')
            .query(generateCommand(player1, 'routes_ttt_move_test_err', 'move a 1'))
            .end(function(err, res) {
              expect(err).toNotExist();
              expect(res.statusCode).toEqual(200);
              expect(res.body.text).toContain('Invalid command usage');
              cb();
            });
        },
        function(cb) {
          request(server)
            .get('/ttt/command')
            .query(generateCommand(player1, 'routes_ttt_move_test_err', 'move 0 2'))
            .end(function(err, res) {
              expect(err).toNotExist();
              expect(res.statusCode).toEqual(200);
              expect(res.body.text).toContain('Invalid command usage');
              cb();
            });
        },
        function(cb) {
          request(server)
            .get('/ttt/command')
            .query(generateCommand(player1, 'routes_ttt_move_test_err', 'move 7 2'))
            .end(function(err, res) {
              expect(err).toNotExist();
              expect(res.statusCode).toEqual(200);
              expect(res.body.text).toContain('Invalid command usage');
              cb();
            });
        },
        function(cb) {
          request(server)
            .get('/ttt/command')
            .query(generateCommand(player1, 'routes_ttt_move_test_err', 'move 1 0'))
            .end(function(err, res) {
              expect(err).toNotExist();
              expect(res.statusCode).toEqual(200);
              expect(res.body.text).toContain('Invalid command usage');
              cb();
            });
        },
        function(cb) {
          request(server)
            .get('/ttt/command')
            .query(generateCommand(player1, 'routes_ttt_move_test_err', 'move 1 7'))
            .end(function(err, res) {
              expect(err).toNotExist();
              expect(res.statusCode).toEqual(200);
              expect(res.body.text).toContain('Invalid command usage');
              cb();
            });
        }
      ], cb);
    });

    it('reject move on nonexisting game', function(cb) {
      request(server)
        .get('/ttt/command')
        .query(generateCommand(player1, 'routes_ttt_move_test_nonexisting', 'move 2 2'))
        .end(function(err, res) {
          expect(err).toNotExist();
          expect(res.statusCode).toEqual(200);
          expect(res.body.text).toContain('No such game');
          cb();
        });
    });

    it('move on existing game', function(cb) {
      async.waterfall([
        function(cb) {
          request(server)
            .get('/ttt/command')
            .query(generateCommand(player1,
              'routes_ttt_move_test_existing',
              `challenge ${SlackMisc.getDisplayUser(player2)}`))
            .end(function(err, res) {
              expect(err).toNotExist();
              expect(res.statusCode).toEqual(200);
              expect(res.body.text).toContain('Here comes a new challenger!');
              cb();
            });
        },
        function(cb) {
          request(server)
            .get('/ttt/command')
            .query(generateCommand(player1, 'routes_ttt_move_test_existing', 'move 2 2'))
            .end(function(err, res) {
              expect(err).toNotExist();
              expect(res.statusCode).toEqual(200);
              expect(res.body.text).toMatch(/player1> moved at 2,2/);
              cb();
            });
        }
      ], function(err) {
        expect(err).toNotExist();
        cb();
      });
    });
  });
});

