// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import ReactDOM from 'react-dom';

import { CallingScreenSharingController } from '../../components/CallingScreenSharingController';
import { i18n } from '../sandboxedInit';
import { strictAssert } from '../../util/assert';

const { ScreenShareWindowProps } = window.Signal;

strictAssert(ScreenShareWindowProps, 'window values not provided');

ReactDOM.render(
  <div className="App dark-theme">
    <CallingScreenSharingController
      i18n={i18n}
      onCloseController={() => window.SignalContext.executeMenuRole('close')}
      onStopSharing={ScreenShareWindowProps.onStopSharing}
      presentedSourceName={ScreenShareWindowProps.presentedSourceName}
    />
  </div>,

  document.getElementById('app')
);
