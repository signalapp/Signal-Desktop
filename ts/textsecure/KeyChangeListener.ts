// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ServiceIdString } from '../types/ServiceId';
import type { SignalProtocolStore } from '../SignalProtocolStore';

export function init(signalProtocolStore: SignalProtocolStore): void {
  signalProtocolStore.on(
    'keychange',
    async (serviceId: ServiceIdString, reason: string): Promise<void> => {
      const conversation =
        await window.ConversationController.getOrCreateAndWait(
          serviceId,
          'private'
        );
      void conversation.addKeyChange(reason);
    }
  );
}
