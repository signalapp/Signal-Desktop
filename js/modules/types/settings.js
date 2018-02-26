const OS = require('../os');

exports.shouldShowAudioNotificationSetting = () =>
  !OS.isLinux();
