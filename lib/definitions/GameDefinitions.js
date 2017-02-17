'use strict';

const _ = require('lodash');

const GAME_OUTCOMES_LIST = [
  'X',
  'O',
  'UNDECIDED',
  'NONE'
];

const BOARD_ENTRIES_LIST = [
  'X',
  'O',
  'CLEAR'
];

module.exports = {
  BOARD_ENTRIES: _.merge(
    { ALL: BOARD_ENTRIES_LIST },
    _.zipObject(BOARD_ENTRIES_LIST, BOARD_ENTRIES_LIST)
  ),
  GAME_OUTCOMES: _.merge(
    { ALL: GAME_OUTCOMES_LIST },
    _.zipObject(GAME_OUTCOMES_LIST, GAME_OUTCOMES_LIST)
  )
};


