// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';
import { isMoreRecentThan } from './timestamp';
import { WEEK } from './durations';
import { isNotNil } from './isNotNil';

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
  };
};

export function parseServerAlertsFromHeader(
  headerValue: string
): Array<ServerAlert> {
  return headerValue
    .split(',')
    .map(value => value.toLowerCase().trim())
    .map(header => {
      if (header === 'critical-idle-primary-device') {
        return ServerAlert.CRITICAL_IDLE_PRIMARY_DEVICE;
      }
      if (header === 'idle-primary-device') {
        return ServerAlert.IDLE_PRIMARY_DEVICE;
      }
      log.warn(
        'parseServerAlertFromHeader: unknown server alert received',
        headerValue
      );
      return null;
    })
    .filter(isNotNil);
}

export async function handleServerAlerts(
  receivedAlerts: Array<ServerAlert>
): Promise<void> {
  const existingAlerts = window.storage.get('serverAlerts') ?? {};
  const existingAlertNames = new Set(Object.keys(existingAlerts));

  const now = Date.now();
  const newAlerts: ServerAlertsType = {};

  for (const alert of receivedAlerts) {
    existingAlertNames.delete(alert);

    const existingAlert = existingAlerts[alert];
    if (existingAlert) {
      newAlerts[alert] = existingAlert;
    } else {
      newAlerts[alert] = {
        firstReceivedAt: now,
      };
      log.info(`handleServerAlerts: got new alert: ${alert}`);
    }
  }

  if (existingAlertNames.size > 0) {
    log.info(
      `handleServerAlerts: removed alerts: ${[...existingAlertNames].join(', ')}`
    );
  }

  await window.storage.put('serverAlerts', newAlerts);
}

export function getServerAlertToShow(
  alerts: ServerAlertsType
): ServerAlert | null {
  if (alerts[ServerAlert.CRITICAL_IDLE_PRIMARY_DEVICE]) {
    return ServerAlert.CRITICAL_IDLE_PRIMARY_DEVICE;
  }

  if (
    shouldShowIdlePrimaryDeviceAlert(alerts[ServerAlert.IDLE_PRIMARY_DEVICE])
  ) {
    return ServerAlert.IDLE_PRIMARY_DEVICE;
  }

  return null;
}

function shouldShowIdlePrimaryDeviceAlert(
  alertInfo: ServerAlertsType[ServerAlert.IDLE_PRIMARY_DEVICE]
): boolean {
  if (!alertInfo) {
    return false;
  }

  if (alertInfo.dismissedAt && isMoreRecentThan(alertInfo.dismissedAt, WEEK)) {
    return false;
  }

  return true;
}
