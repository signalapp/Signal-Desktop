// The idea with this file is to make it webpackable for the style guide

const Crypto = require('./crypto');
const Data = require('../../ts/data/data');
const Notifications = require('../../ts/notifications');
const OS = require('../../ts/OS');
const Settings = require('./settings');
const Util = require('../../ts/util');
const LinkPreviews = require('./link_previews');
const { Message } = require('../../ts/components/conversation/message/message-item/Message');

// Components
const {
  SessionRegistrationView,
} = require('../../ts/components/registration/SessionRegistrationView');

const { SessionInboxView } = require('../../ts/components/SessionInboxView');

// Types
const SettingsType = require('../../ts/types/Settings');

exports.setup = () => {
  Data.init();

  const Components = {
    SessionInboxView,
    SessionRegistrationView,
    Message,
  };

  const Types = {
    Settings: SettingsType,
  };

  return {
    Components,
    Crypto,
    Data,
    LinkPreviews,
    Notifications,
    OS,
    Settings,
    Types,
    Util,
  };
};
