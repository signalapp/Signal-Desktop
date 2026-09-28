// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { getRegistrationLockString } from '../jobs/registrationJobQueue.preload.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';
import {
  disableRegistrationLock,
  setupRegistrationLock,
} from '../textsecure/WebAPI.preload.ts';
import { strictAssert } from './assert.std.ts';
import { createLogger } from '../logging/log.std.ts';
import { toLogFormat } from '../types/errors.std.ts';

const log = createLogger('maybeUpdateRegistrationLock');

export async function maybeUpdateRegistrationLock(
  isEnabled: boolean
): Promise<void> {
  const { i18n } = window.SignalContext;

  try {
    if (isEnabled) {
      const svrPin = itemStorage.get('svrPin');
      strictAssert(svrPin, 'pin must be set to enable reglock');

      await setupRegistrationLock(getRegistrationLockString());
      await itemStorage.put('registrationLock', true);
    } else {
      await disableRegistrationLock();
      await itemStorage.put('registrationLock', false);
    }
  } catch (error) {
    log.error(
      `Failed to set registration lock to ${isEnabled}.`,
      toLogFormat(error)
    );
    window.reduxActions.globalModals.showErrorModal({
      title: i18n('icu:ErrorModal--title'),
      description: i18n('icu:ErrorModal--description'),
    });
  }
}
