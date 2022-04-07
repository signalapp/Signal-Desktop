/* global $, Whisper */
// const $body = $(document.body);

import React from 'react';
import { SessionPasswordPrompt } from '../components/SessionPasswordPrompt';

// // eslint-disable-next-line strict
// window.view = new Whisper.PasswordView();
// $body.html('');
// window.view.$el.prependTo($body);
// className: 'password overlay',
// Component: window.Signal.Components.SessionPasswordPrompt,
window.ReactDOM.render(<SessionPasswordPrompt />, document.getElementById('root'));
