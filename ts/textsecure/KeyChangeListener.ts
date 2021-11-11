// Copyright 2017-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { UUID } from '../types/UUID';
import type { SignalProtocolStore } from '../SignalProtocolStore';

export function init(signalProtocolStore: SignalProtocolStore): void {
  signalProtocolStore.on('keychange', async (uuid: UUID): Promise<void> => {
    const conversation = await window.ConversationController.getOrCreateAndWait(
      uuid.toString(),
      'private'
    );
    conversation.addKeyChange(uuid);

    const groups =
      await window.ConversationController.getAllGroupsInvolvingUuid(uuid);
    for (const group of groups) {
      group.addKeyChange(uuid);
    }
  });
}
