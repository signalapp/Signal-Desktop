import React from 'react';
import { DebugLogView } from '../components/DebugLogView';

global.setTimeout(() => {
  window.ReactDOM.render(<DebugLogView />, document.getElementById('root'));
}, 1000);
