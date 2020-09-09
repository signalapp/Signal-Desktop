/* global Whisper: false */

// eslint-disable-next-line func-names
(function() {
  window.Whisper = window.Whisper || {};
  window.Whisper.Database = window.Whisper.Database || {};
  window.Whisper.Database.id = window.Whisper.Database.id || 'signal';
  window.Whisper.Database.nolog = true;

  Whisper.Database.handleDOMException = (prefix, error, reject) => {
    window.log.error(
      `${prefix}:`,
      error && error.name,
      error && error.message,
      error && error.code
    );
    reject(error || new Error(prefix));
  };
})();
