// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import ReactDOM from 'react-dom';

import { About } from '../../components/About';
import { strictAssert } from '../../util/assert';

const { AboutWindow } = window.Signal;

strictAssert(AboutWindow, 'window values not provided');

ReactDOM.render(
  <About
    closeAbout={() => AboutWindow.executeMenuRole('close')}
    environment={AboutWindow.environmentText}
    executeMenuRole={AboutWindow.executeMenuRole}
    hasCustomTitleBar={AboutWindow.hasCustomTitleBar}
    i18n={AboutWindow.i18n}
    version={AboutWindow.version}
  />,
  document.getElementById('app')
);
