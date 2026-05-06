// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { createRoot } from 'react-dom/client';
import '../sandboxedInit.dom.ts';
import { PermissionsPopup } from '../../components/PermissionsPopup.dom.tsx';
import { strictAssert } from '../../util/assert.std.ts';
import { AppProvider } from '../AppProvider.dom.tsx';

const { PermissionsWindowProps } = window.Signal;
const { i18n } = window.SignalContext;

strictAssert(PermissionsWindowProps, 'window values not provided');

const { forCalling, forCamera } = PermissionsWindowProps;

let message;
if (forCalling) {
  if (forCamera) {
    message = i18n('icu:videoCallingPermissionNeeded');
  } else {
    message = i18n('icu:audioCallingPermissionNeeded');
  }
} else {
  message = i18n('icu:audioPermissionNeeded');
}

const app = document.getElementById('app');
strictAssert(app != null, 'No #app');

createRoot(app).render(
  <AppProvider>
    <PermissionsPopup
      i18n={i18n}
      message={message}
      onAccept={PermissionsWindowProps.onAccept}
      onClose={PermissionsWindowProps.onClose}
    />
  </AppProvider>
);
