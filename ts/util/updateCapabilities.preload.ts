// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { toLogFormat } from '../types/errors.std.ts';
import { createLogger } from '../logging/log.std.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';
import { registerCapabilities } from '../textsecure/WebAPI.preload.ts';
import { getCapabilities } from './getCapabilities.std.ts';

const log = createLogger('updateCapabilities');

export async function updateCapabilities(): Promise<void> {
  try {
    await registerCapabilities(
      getCapabilities({
        optionalPhoneNumber: itemStorage.user.getOptionalNumber() == null,
        hasPin:
          window.ConversationController.areWePrimaryDevice() &&
          Boolean(itemStorage.get('isSvrPinStored')),
      })
    );
  } catch (error) {
    log.error(
      'Error: Unable to register our capabilities.',
      toLogFormat(error)
    );
  }
}
