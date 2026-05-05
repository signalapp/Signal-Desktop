// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import type { AciString, PniString } from '../types/ServiceId.std.ts';

const log = createLogger('isRelinkingToSameAccount');

export function isCleanStart({
  existingAci,
  existingPni,
  existingNumber,
  registrationEverDone,
}: {
  existingAci: AciString | undefined;
  existingPni: PniString | undefined;
  existingNumber: string | undefined;
  registrationEverDone: boolean;
}): boolean {
  return (
    existingAci == null &&
    existingPni == null &&
    existingNumber == null &&
    !registrationEverDone
  );
}

export function isRelinkingToSameAccount({
  newAci,
  newNumber,
  previousAci,
  previousNumber,
}: {
  newAci: AciString;
  newNumber: string | undefined;
  previousAci: AciString | undefined;
  previousNumber: string | undefined;
}): boolean {
  if (!previousAci && !previousNumber) {
    return false;
  }

  if (!previousAci) {
    log.warn('no previous ACI, only a number');

    if (previousNumber === newNumber) {
      return true;
    }

    log.warn('new E164 is different');
    return false;
  }

  if (newAci === previousAci) {
    return true;
  }

  log.warn('new ACI is different');
  return false;
}
