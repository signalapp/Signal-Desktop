// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// This has to be the first import because of monkey-patching
import '../shims';

import React from 'react';
import ReactDOM from 'react-dom';
import { contextBridge } from 'electron';

import { SignalContext } from '../context';

import { createSetting } from '../../util/preload';
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

contextBridge.exposeInMainWorld('SignalContext', {
  ...SignalContext,
  renderWindow: () => {
    const { forCalling, forCamera } = SignalContext.config;

    let message;
    if (forCalling) {
      if (forCamera) {
        message = SignalContext.i18n('videoCallingPermissionNeeded');
      } else {
        message = SignalContext.i18n('audioCallingPermissionNeeded');
      }
    } else {
      message = SignalContext.i18n('audioPermissionNeeded');
    }

    function onClose() {
      SignalContext.executeMenuRole('close');
    }

    ReactDOM.render(
      React.createElement(PermissionsPopup, {
        i18n: SignalContext.i18n,
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
