// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { contextBridge } from 'electron';
import { MinimalSignalContext } from '../minimalContext.preload.js';
import { createSetting } from '../../util/preload.preload.js';
import { drop } from '../../util/drop.std.js';

const mediaCameraPermissions = createSetting('mediaCameraPermissions', {
  getter: false,
});
const mediaPermissions = createSetting('mediaPermissions', {
  getter: false,
});

const params = new URLSearchParams(document.location.search);
const forCalling = params.get('forCalling') === 'true';
const forCamera = params.get('forCamera') === 'true';

function onClose() {
  drop(MinimalSignalContext.executeMenuRole('close'));
}

const Signal = {
  PermissionsWindowProps: {
    forCalling,
    forCamera,
    onAccept: () => {
      if (!forCamera) {
        drop(mediaPermissions.setValue(true));
      } else {
        drop(mediaCameraPermissions.setValue(true));
      }
      onClose();
    },
    onClose,
  },
};
contextBridge.exposeInMainWorld('Signal', Signal);
contextBridge.exposeInMainWorld('SignalContext', MinimalSignalContext);
