/* global $, Whisper */
const $body = $(document.body);

// eslint-disable-next-line strict
window.view = new Whisper.PasswordView();
$body.html('');
window.view.$el.prependTo($body);
