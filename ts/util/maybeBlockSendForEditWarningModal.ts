// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { explodePromise } from './explodePromise';

export async function maybeBlockSendForEditWarningModal(): Promise<boolean> {
  const explodedPromise = explodePromise<boolean>();
  window.reduxActions.globalModals.showSendEditWarningModal(explodedPromise);
  return explodedPromise.promise;
}
