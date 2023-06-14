// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { explodePromise } from './explodePromise';

export async function maybeBlockSendForFormattingModal(): Promise<boolean> {
  const explodedPromise = explodePromise<boolean>();
  window.reduxActions.globalModals.showFormattingWarningModal(explodedPromise);
  return explodedPromise.promise;
}
