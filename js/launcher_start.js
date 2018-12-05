/* global $, Whisper, storage */
const $body = $(document.body);

// eslint-disable-next-line strict
window.view = new Whisper.LauncherView();
$body.html('');
window.view.$el.prependTo($body);
