/* global window: false */

// Because we aren't hosting the Style Guide in Electron, we can't rely on preload.js
//   to set things up for us. This gives us the minimum bar shims for everything it
//   provdes.
//
// Remember, the idea here is just to enable visual testing, no full functionality. Most
//   of thise can be very simple.

window.PROTO_ROOT = '/protos';
window.nodeSetImmediate = () => {};

window.libphonenumber = {
  parse: number => ({
    e164: number,
    isValidNumber: true,
    getCountryCode: () => '1',
    getNationalNumber: () => number,
  }),
  isValidNumber: () => true,
  getRegionCodeForNumber: () => '1',
  format: number => number.e164,
  PhoneNumberFormat: {},
};

window.Signal = {};
window.Signal.Backup = {};
window.Signal.Crypto = {};
window.Signal.Logs = {};
window.Signal.Migrations = {
  getPlaceholderMigrations: () => [{
    migrate: (transaction, next) => {
      console.log('migration version 1');
      transaction.db.createObjectStore('conversations');
      next();
    },
    version: 1
  }],
  loadAttachmentData: attachment => Promise.resolve(attachment),
};

window.Signal.Components = {};

window.EmojiConvertor = function EmojiConvertor() {};
window.EmojiConvertor.prototype.init_colons = () => {};
window.EmojiConvertor.prototype.signalReplace = html => html;
window.EmojiConvertor.prototype.replace_unified = string => string;
window.EmojiConvertor.prototype.img_sets = {
  apple: {},
};

window.i18n = () => '';

window.Signal.Migrations.V17 = {};
window.Signal.OS = {};
window.Signal.Types = {};
window.Signal.Types.Attachment = {};
window.Signal.Types.Conversation = {};
window.Signal.Types.Errors = {};
window.Signal.Types.Message = {
  initializeSchemaVersion: attributes => attributes,
};
window.Signal.Types.MIME = {};
window.Signal.Types.Settings = {};
window.Signal.Views = {};
window.Signal.Views.Initialization = {};
window.Signal.Workflow = {};
