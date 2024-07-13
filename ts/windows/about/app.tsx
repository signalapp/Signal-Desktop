// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import ReactDOM from 'react-dom';

import { About } from '../../components/About';
import { i18n } from '../sandboxedInit';
import { strictAssert } from '../../util/assert';

const { AboutWindowProps } = window.Signal;

strictAssert(AboutWindowProps, 'window values not provided');

let platform = '';
if (AboutWindowProps.platform === 'darwin') {
  if (AboutWindowProps.arch === 'arm64') {
    platform = ` (${i18n('icu:appleSilicon')})`;
  } else {
    platform = ' (Intel)';
  }
}

const environmentText = `${AboutWindowProps.environmentText}${platform}`;

ReactDOM.render(
  <About
    closeAbout={() => window.SignalContext.executeMenuRole('close')}
    environment={environmentText}
    i18n={i18n}
    version={window.SignalContext.getVersion()}
  />,
  document.getElementById('app')
);
