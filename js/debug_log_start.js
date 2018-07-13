$(document).on('keyup', function(e) {
  if (e.keyCode === 27) {
    window.closeDebugLog();
  }
});

const $body = $(document.body);

// got.js appears to need this to successfully submit debug logs to the cloud
window.setImmediate = window.nodeSetImmediate;

window.view = new Whisper.DebugLogView();
window.view.$el.appendTo($body);
