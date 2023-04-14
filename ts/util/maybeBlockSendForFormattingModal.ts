// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { DraftBodyRanges } from '../types/BodyRange';
import { BodyRange } from '../types/BodyRange';
import { explodePromise } from './explodePromise';

export async function maybeBlockSendForFormattingModal(
  bodyRanges: DraftBodyRanges
): Promise<boolean> {
  if (!bodyRanges.some(BodyRange.isFormatting)) {
    return true;
  }

  const explodedPromise = explodePromise<boolean>();
  window.reduxActions.globalModals.showFormattingWarningModal(explodedPromise);
  return explodedPromise.promise;
}
