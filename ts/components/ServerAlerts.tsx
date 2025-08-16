// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import {
  getServerAlertToShow,
  ServerAlert,
  type ServerAlertsType,
} from '../util/handleServerAlerts';
import type { WidthBreakpoint } from './_util';
import type { LocalizerType } from '../types/I18N';
import { CriticalIdlePrimaryDeviceDialog } from './CriticalIdlePrimaryDeviceDialog';
import { strictAssert } from '../util/assert';
import { WarningIdlePrimaryDeviceDialog } from './WarningIdlePrimaryDeviceDialog';

export function getServerAlertDialog(
  alerts: ServerAlertsType | undefined,
  dialogProps: {
    containerWidthBreakpoint: WidthBreakpoint;
    i18n: LocalizerType;
  }
): JSX.Element | null {
  if (!alerts) {
    return null;
  }
  const alertToShow = getServerAlertToShow(alerts);
  if (!alertToShow) {
    return null;
  }

  if (alertToShow === ServerAlert.CRITICAL_IDLE_PRIMARY_DEVICE) {
    return <CriticalIdlePrimaryDeviceDialog {...dialogProps} />;
  }

  if (alertToShow === ServerAlert.IDLE_PRIMARY_DEVICE) {
    const alert = alerts[ServerAlert.IDLE_PRIMARY_DEVICE];
    strictAssert(alert, 'alert must exist');

    // Only allow dismissing it once
    const isDismissable = alert.dismissedAt == null;

    return (
      <WarningIdlePrimaryDeviceDialog
        {...dialogProps}
        handleClose={
          isDismissable
            ? async () => {
                await window.storage.put('serverAlerts', {
                  ...alerts,
                  [ServerAlert.IDLE_PRIMARY_DEVICE]: {
                    ...alert,
                    dismissedAt: Date.now(),
                  },
                });
              }
            : undefined
        }
      />
    );
  }

  return null;
}
