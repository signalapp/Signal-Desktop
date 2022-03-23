// The idea with this file is to make it webpackable for the style guide

const Crypto = require('./crypto');
const Data = require('../../ts/data/data');
const OS = require('../../ts/OS');
const Util = require('../../ts/util');
const { Message } = require('../../ts/components/conversation/message/message-item/Message');

// Components
const {
  SessionRegistrationView,
} = require('../../ts/components/registration/SessionRegistrationView');

const { SessionInboxView } = require('../../ts/components/SessionInboxView');

exports.setup = () => {
  Data.init();

  const Components = {
    SessionInboxView,
    SessionRegistrationView,
    Message,
  };

  return {
    Components,
    Crypto,
    Data,
    OS,
    Util,
  };
};
