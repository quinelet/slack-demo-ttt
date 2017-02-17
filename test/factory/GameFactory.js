'use strict';

const _ = require('lodash');

const BOARD_ENTRIES = require('../../lib/definitions/GameDefinitions').BOARD_ENTRIES;
const O = BOARD_ENTRIES.O;
const X = BOARD_ENTRIES.X;
const C = BOARD_ENTRIES.CLEAR;

const GAME_OUTCOMES = require('../../lib/definitions/GameDefinitions').GAME_OUTCOMES;
const WUNK = GAME_OUTCOMES.UNDECIDED;

// construct a game that will pass schema validation
function makeGame(p1, p2, gameId, board) {
  return {
    players: _.sortBy([p1, p2]),
    board: board || [[C, C, C], [C, C, C], [C, C, C]],
    gameId: gameId,
    outcome: WUNK,
    move: 0,
    firstPlayerIndex: 0
  };
}

module.exports = {
  makeGame: makeGame
};
