// The idea with this file is to make it webpackable for the style guide

const {
  SessionPasswordPrompt,
} = require('../../ts/components/session/SessionPasswordPrompt');

exports.setup = () => {
  const Components = {
    SessionPasswordPrompt,
  };

  return {
    Components,
  };
};
