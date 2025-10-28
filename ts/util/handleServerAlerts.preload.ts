// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.js';
import { isMoreRecentThan } from './timestamp.std.js';
import { DAY, WEEK } from './durations/index.std.js';
import { isNotNil } from './isNotNil.std.js';
import { clearTimeoutIfNecessary } from './clearTimeoutIfNecessary.std.js';
import { safeSetTimeout } from './timeout.std.js';
import { itemStorage } from '../textsecure/Storage.preload.js';
import {
  ServerAlert,
  type ServerAlertsType,
} from '../types/ServerAlert.std.js';

const log = createLogger('handleServerAlerts');

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
  const existingAlerts = itemStorage.get('serverAlerts') ?? {};
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
      log.info(`got new alert: ${alert}`);
    }

    if (alert === ServerAlert.CRITICAL_IDLE_PRIMARY_DEVICE) {
      maybeShowCriticalIdlePrimaryDeviceModal(newAlerts[alert]);
    }
  }

  if (existingAlertNames.size > 0) {
    log.info(`removed alerts: ${[...existingAlertNames].join(', ')}`);
  }

  await itemStorage.put('serverAlerts', newAlerts);
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

let criticalAlertModalTimeout: NodeJS.Timeout | null = null;
const DELAY_BEFORE_SHOWING_MODAL_FIRST_TIME = 3 * DAY;
const DELAY_BEFORE_SHOWING_MODAL_SUBSEQUENTLY = DAY;
function maybeShowCriticalIdlePrimaryDeviceModal(
  alertInfo: ServerAlertsType[ServerAlert.CRITICAL_IDLE_PRIMARY_DEVICE]
) {
  clearTimeoutIfNecessary(criticalAlertModalTimeout);
  criticalAlertModalTimeout = null;

  if (!alertInfo) {
    return;
  }

  const { firstReceivedAt, modalLastDismissedAt } = alertInfo;

  let nextModalShowsAt: number | undefined;

  if (
    isMoreRecentThan(firstReceivedAt, DELAY_BEFORE_SHOWING_MODAL_FIRST_TIME)
  ) {
    nextModalShowsAt = firstReceivedAt + DELAY_BEFORE_SHOWING_MODAL_FIRST_TIME;
  } else if (modalLastDismissedAt == null) {
    nextModalShowsAt = Date.now();
  } else {
    nextModalShowsAt =
      modalLastDismissedAt + DELAY_BEFORE_SHOWING_MODAL_SUBSEQUENTLY;
  }

  criticalAlertModalTimeout = safeSetTimeout(
    () => window.reduxActions.globalModals.showCriticalIdlePrimaryDeviceModal(),
    nextModalShowsAt - Date.now()
  );
}

export async function onCriticalIdlePrimaryDeviceModalDismissed(): Promise<void> {
  const existingAlerts = itemStorage.get('serverAlerts') ?? {};
  const existingAlert =
    existingAlerts[ServerAlert.CRITICAL_IDLE_PRIMARY_DEVICE];

  if (!existingAlert) {
    log.warn(
      'Critical idle primary device modal shown but the alert is not present'
    );
    return;
  }

  const newAlert = {
    ...existingAlert,
    modalLastDismissedAt: Date.now(),
  };

  await itemStorage.put('serverAlerts', {
    ...existingAlerts,
    [ServerAlert.CRITICAL_IDLE_PRIMARY_DEVICE]: newAlert,
  });

  maybeShowCriticalIdlePrimaryDeviceModal(newAlert);
}
