const Joi = require('joi');

const BOARD_ENTRIES = require('../definitions/GameDefinitions').BOARD_ENTRIES.ALL;
const GAME_OUTCOMES = require('../definitions/GameDefinitions').GAME_OUTCOMES.ALL;

const BoardEntrySchema = Joi.string().allow(BOARD_ENTRIES);

const UserSchema = Joi.object().keys({
  user_id: Joi.string().required(),
  user_name: Joi.string().required()
});

const GameSchema = Joi.object().keys({
  _id: Joi.any().optional(),

  // unique. typically '<team_id>/<channel_id>' to link games to channels.
  gameId: Joi.string().min(4).required(),

  // users names may change if their user_id's remain the same.
  players: Joi.array().items(UserSchema).length(2).required(),

  board: Joi.array().items(
    Joi.array().items(BoardEntrySchema).length(3).required()
  ).length(3).required(),

  move: Joi.number().integer().min(0).required(),

  outcome: Joi.string().allow(GAME_OUTCOMES),

  // which player went first (is X)
  firstPlayerIndex: Joi.number().integer().allow([0, 1])
});

module.exports = GameSchema;
