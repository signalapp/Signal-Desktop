// Copyright 2017 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { UUID } from '../types/UUID';
import type { SignalProtocolStore } from '../SignalProtocolStore';

export function init(signalProtocolStore: SignalProtocolStore): void {
  signalProtocolStore.on(
    'keychange',
    async (uuid: UUID, reason: string): Promise<void> => {
      const conversation =
        await window.ConversationController.getOrCreateAndWait(
          uuid.toString(),
          'private'
        );
      void conversation.addKeyChange(reason);
    }
  );
}
