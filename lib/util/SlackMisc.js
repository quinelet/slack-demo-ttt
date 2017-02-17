'use strict';

function getDisplayUser(user) {
  return `<@${user.user_id}|${user.user_name}>`;
}

module.exports = {
  getDisplayUser: getDisplayUser
};
