// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationController } from './ConversationController.preload.js';
import type { ConversationModel } from './models/conversations.preload.js';
import type {
  cdsLookup,
  checkAccountExistence,
} from './textsecure/WebAPI.preload.js';
import { assertDev } from './util/assert.std.js';
import { isNotNil } from './util/isNotNil.std.js';
import { getServiceIdsForE164s } from './util/getServiceIdsForE164s.dom.js';

export type ServerType = Readonly<{
  cdsLookup: typeof cdsLookup;
  checkAccountExistence: typeof checkAccountExistence;
}>;

export async function updateConversationsWithUuidLookup({
  conversationController,
  conversations,
  server,
}: Readonly<{
  conversationController: Pick<
    ConversationController,
    'maybeMergeContacts' | 'get'
  >;
  conversations: ReadonlyArray<ConversationModel>;
  server: ServerType;
}>): Promise<void> {
  const e164s = conversations
    .map(conversation => conversation.get('e164'))
    .filter(isNotNil);
  if (!e164s.length) {
    return;
  }

  const { entries: serverLookup, transformedE164s } =
    await getServiceIdsForE164s(server.cdsLookup, e164s);

  await Promise.all(
    conversations.map(async conversation => {
      const e164 = conversation.get('e164');
      if (!e164) {
        return;
      }

      let finalConversation: ConversationModel;

      const e164ToUse = transformedE164s.get(e164) ?? e164;
      const pairFromServer = serverLookup.get(e164ToUse);
      if (pairFromServer) {
        const { conversation: maybeFinalConversation } =
          conversationController.maybeMergeContacts({
            aci: pairFromServer.aci,
            pni: pairFromServer.pni,
            e164: e164ToUse,
            reason: 'updateConversationsWithUuidLookup',
          });
        assertDev(
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
      let finalServiceId = finalConversation.getServiceId();
      if (!pairFromServer && finalServiceId) {
        const doesAccountExist =
          await server.checkAccountExistence(finalServiceId);
        if (!doesAccountExist) {
          finalConversation.updateServiceId(undefined);
          finalServiceId = undefined;
        }
      }

      if (!finalConversation.get('e164') || !finalServiceId) {
        finalConversation.setUnregistered();
      }
    })
  );
}
