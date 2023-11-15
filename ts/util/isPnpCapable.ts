// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as log from '../logging/log';

export function isPnpCapable(): boolean {
  const me = window.ConversationController.getOurConversation();
  if (!me) {
    log.warn('isPnpCapable: missing our conversation');
    return false;
  }

  // These capabilities are filled by a periodic background check for our
  // account.
  const capabilities = me.get('capabilities');
  if (!capabilities) {
    log.warn('isPnpCapable: no cached capabilities');
    return false;
  }

  // `capabilities.pni` becomes true once all linked devices and the primary
  // advertise this capability.
  return capabilities.pni === true;
}
