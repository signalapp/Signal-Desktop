// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { render } from 'react-dom';
import { DebugLogWindow } from '../../components/DebugLogWindow';
import { i18n } from '../sandboxedInit';
import { strictAssert } from '../../util/assert';

const { DebugLogWindowProps } = window.Signal;

strictAssert(DebugLogWindowProps, 'window values not provided');

render(
  <DebugLogWindow
    closeWindow={() => window.SignalContext.executeMenuRole('close')}
    downloadLog={DebugLogWindowProps.downloadLog}
    i18n={i18n}
    fetchLogs={DebugLogWindowProps.fetchLogs}
    uploadLogs={DebugLogWindowProps.uploadLogs}
  />,
  document.getElementById('app')
);
