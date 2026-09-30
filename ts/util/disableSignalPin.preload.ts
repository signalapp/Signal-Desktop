// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { itemStorage } from '../textsecure/Storage.preload.ts';
import { deleteFromSVR2 } from '../textsecure/WebAPI.preload.ts';
import { strictAssert } from './assert.std.ts';
import { createLogger } from '../logging/log.std.ts';
import { toLogFormat } from '../types/errors.std.ts';
import { pinReminderService } from '../services/pinReminder.preload.ts';

const log = createLogger('disableSignalPin');

export async function disableSignalPin(): Promise<void> {
  const { i18n } = window.SignalContext;

  try {
    const registrationLock = itemStorage.get('registrationLock');
    strictAssert(!registrationLock, 'reg lock must be off to disable pin');

    const backupTier = itemStorage.get('backupTier');
    strictAssert(
      backupTier == null,
      'remote backups must be off to disable pin'
    );

    const svrPin = itemStorage.get('svrPin');
    if (svrPin == null) {
      log.warn('PIN was empty. Trying to delete PIN anyway');
    }

    await deleteFromSVR2();
    await itemStorage.put('isSvrPinStored', false);
    await itemStorage.put('svrPin', undefined);
    await itemStorage.put('pinReminders', false);
    await pinReminderService.handlePinRemindersSettingChanged(false);
  } catch (error) {
    log.error('Failed to disable Signal PIN.', toLogFormat(error));
    window.reduxActions.globalModals.showErrorModal({
      title: i18n('icu:ErrorModal--title'),
      description: i18n('icu:ErrorModal--description'),
    });
  }
}
