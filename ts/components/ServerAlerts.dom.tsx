// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import {
  ServerAlert,
  type ServerAlertsType,
} from '../types/ServerAlert.std.js';
import type { WidthBreakpoint } from './_util.std.js';
import type { LocalizerType } from '../types/I18N.std.js';
import { CriticalIdlePrimaryDeviceDialog } from './CriticalIdlePrimaryDeviceDialog.dom.js';
import { strictAssert } from '../util/assert.std.js';
import { WarningIdlePrimaryDeviceDialog } from './WarningIdlePrimaryDeviceDialog.dom.js';

export function getServerAlertDialog(
  alerts: ServerAlertsType | undefined,
  getServerAlertToShow: (alerts: ServerAlertsType) => ServerAlert | null,
  saveAlerts: (alerts: ServerAlertsType) => Promise<void>,
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
                await saveAlerts({
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
