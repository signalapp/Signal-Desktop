// /* global $: false */
// /* global Whisper: false */

import React from 'react';
import { DebugLogView } from '../views/DebugLogView';

// $(document).on('keyup', e => {
//   'use strict';

//   if (e.keyCode === 27) {
//     window.closeDebugLog();
//   }
// });

// Whisper ?
global.setTimeout(() => {
  window.ReactDOM.render(<DebugLogView />, document.getElementById('root'));
}, 1000);
