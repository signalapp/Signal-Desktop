// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationController } from './ConversationController';
import type { ConversationModel } from './models/conversations';
import type SendMessage from './textsecure/SendMessage';
import { assert } from './util/assert';
import { getOwn } from './util/getOwn';
import { isNotNil } from './util/isNotNil';

export async function updateConversationsWithUuidLookup({
  conversationController,
  conversations,
  messaging,
}: Readonly<{
  conversationController: Pick<
    ConversationController,
    'maybeMergeContacts' | 'get'
  >;
  conversations: ReadonlyArray<ConversationModel>;
  messaging: Pick<SendMessage, 'getUuidsForE164s' | 'checkAccountExistence'>;
}>): Promise<void> {
  const e164s = conversations
    .map(conversation => conversation.get('e164'))
    .filter(isNotNil);
  if (!e164s.length) {
    return;
  }

  const serverLookup = await messaging.getUuidsForE164s(e164s);

  await Promise.all(
    conversations.map(async conversation => {
      const e164 = conversation.get('e164');
      if (!e164) {
        return;
      }

      let finalConversation: ConversationModel;

      const uuidFromServer = getOwn(serverLookup, e164);
      if (uuidFromServer) {
        const maybeFinalConversation =
          conversationController.maybeMergeContacts({
            aci: uuidFromServer,
            e164,
            reason: 'updateConversationsWithUuidLookup',
          });
        assert(
          maybeFinalConversation,
          'updateConversationsWithUuidLookup: expected a conversation to be found or created'
        );
        finalConversation = maybeFinalConversation;
      } else {
        finalConversation = conversation;
      }

      // We got no uuid from CDS so either the person is now unregistered or
      // they can't be looked up by a phone number. Check that uuid still exists,
      // and if not - drop it.
      let finalUuid = finalConversation.getUuid();
      if (!uuidFromServer && finalUuid) {
        const doesAccountExist = await messaging.checkAccountExistence(
          finalUuid
        );
        if (!doesAccountExist) {
          finalConversation.updateUuid(undefined);
          finalUuid = undefined;
        }
      }

      if (!finalConversation.get('e164') || !finalUuid) {
        finalConversation.setUnregistered();
      }
    })
  );
}
