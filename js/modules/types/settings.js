const OS = require('../os');

exports.isAudioNotificationSupported = () =>
  !OS.isLinux();
