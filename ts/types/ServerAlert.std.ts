// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export enum ServerAlert {
  CRITICAL_IDLE_PRIMARY_DEVICE = 'critical_idle_primary_device',
  IDLE_PRIMARY_DEVICE = 'idle_primary_device',
}

export type ServerAlertsType = {
  [ServerAlert.IDLE_PRIMARY_DEVICE]?: {
    firstReceivedAt: number;
    dismissedAt?: number;
  };
  [ServerAlert.CRITICAL_IDLE_PRIMARY_DEVICE]?: {
    firstReceivedAt: number;
    modalLastDismissedAt?: number;
  };
};
