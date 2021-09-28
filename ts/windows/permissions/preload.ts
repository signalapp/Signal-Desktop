// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import ReactDOM from 'react-dom';
import { contextBridge, ipcRenderer } from 'electron';

// It is important to call this as early as possible
import '../context';

import { createSetting } from '../../util/preload';
import { SignalWindow } from '../configure';
import { PermissionsPopup } from '../../components/PermissionsPopup';

const mediaCameraPermissions = createSetting('mediaCameraPermissions', {
  getter: false,
});
const mediaPermissions = createSetting('mediaPermissions', {
  getter: false,
});

contextBridge.exposeInMainWorld(
  'nativeThemeListener',
  window.SignalContext.nativeThemeListener
);

contextBridge.exposeInMainWorld('SignalWindow', {
  ...SignalWindow,
  renderWindow: () => {
    const forCalling = SignalWindow.config.forCalling === 'true';
    const forCamera = SignalWindow.config.forCamera === 'true';

    let message;
    if (forCalling) {
      if (forCamera) {
        message = SignalWindow.i18n('videoCallingPermissionNeeded');
      } else {
        message = SignalWindow.i18n('audioCallingPermissionNeeded');
      }
    } else {
      message = SignalWindow.i18n('audioPermissionNeeded');
    }

    function onClose() {
      ipcRenderer.send('close-permissions-popup');
    }

    ReactDOM.render(
      React.createElement(PermissionsPopup, {
        i18n: SignalWindow.i18n,
        message,
        onAccept: () => {
          if (!forCamera) {
            mediaPermissions.setValue(true);
          } else {
            mediaCameraPermissions.setValue(true);
          }
          onClose();
        },
        onClose,
      }),
      document.getElementById('app')
    );
  },
});
