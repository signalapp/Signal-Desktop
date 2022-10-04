/* global $, Whisper */
// const $body = $(document.body);

import React from 'react';
import { SessionPasswordPrompt } from '../components/SessionPasswordPrompt';
import { SessionToastContainer } from '../components/SessionToastContainer';
import { SessionTheme } from '../state/ducks/SessionTheme';

window.ReactDOM.render(
  <SessionTheme>
    <SessionToastContainer />
    <SessionPasswordPrompt />
  </SessionTheme>,
  document.getElementById('root')
);
