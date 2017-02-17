'use strict';

// convenience method (formats a user object to a formatted Slack username)
function getDisplayUser(user) {
  return `<@${user.user_id}|${user.user_name}>`;
}

module.exports = {
  getDisplayUser: getDisplayUser
};
