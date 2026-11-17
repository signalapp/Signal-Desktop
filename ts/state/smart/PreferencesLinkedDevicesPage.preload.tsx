// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';

import { useSelector } from 'react-redux';

import { useLinkedDevicesActions } from '../ducks/linkedDevices.preload.ts';
import { getIntl, getTheme } from '../selectors/user.std.ts';
import { PreferencesLinkedDevicesPage } from '../../components/preferences/linkedDevices/PreferencesLinkedDevicesPage.dom.tsx';
import { getDevices, getWorkflow } from '../selectors/linkedDevices.std.ts';

export function SmartPreferencesLinkedDevicesPage(): ReactNode {
  const {
    cancelLinking,
    moveToChoosingTransferMessages,
    refreshDevices,
    removeDevice,
    renameDevice,
    sendInfoForLink,
    startLinking,
  } = useLinkedDevicesActions();

  const i18n = useSelector(getIntl);
  const theme = useSelector(getTheme);
  const workflow = useSelector(getWorkflow);
  const devices = useSelector(getDevices);

  return (
    <PreferencesLinkedDevicesPage
      cancelLinking={cancelLinking}
      devices={devices}
      i18n={i18n}
      moveToChoosingTransferMessages={moveToChoosingTransferMessages}
      refreshDevices={refreshDevices}
      renameDevice={renameDevice}
      removeDevice={removeDevice}
      sendInfoForLink={sendInfoForLink}
      startLinking={startLinking}
      theme={theme}
      workflow={workflow}
    />
  );
}
