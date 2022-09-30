/* global $, Whisper */
// const $body = $(document.body);

import React from 'react';
import { SessionPasswordPrompt } from '../components/SessionPasswordPrompt';
import { SessionTheme } from '../state/ducks/SessionTheme';

window.ReactDOM.render(
  <SessionTheme>
    <SessionPasswordPrompt />
  </SessionTheme>,
  document.getElementById('root')
);
