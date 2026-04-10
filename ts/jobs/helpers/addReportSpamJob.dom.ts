// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assertDev } from '../../util/assert.std.ts';
import { isDirectConversation } from '../../util/whatTypeOfConversation.dom.ts';
import { createLogger } from '../../logging/log.std.ts';
import { isAciString } from '../../util/isAciString.std.ts';
import type { reportSpamJobQueue } from '../reportSpamJobQueue.preload.ts';
import type { ConversationType } from '../../state/ducks/conversations.preload.ts';

const log = createLogger('addReportSpamJob');

// The Aci being reported is always the directConversation's Aci.
// When groupConversationId is missing, then we report messages in the directConversation.
// When groupConversationId is specified, then we report messages or group updates
// from the Aci within that group.
export async function addReportSpamJob({
  directConversation,
  getMessageServerGuidsForSpam,
  groupConversationId,
  jobQueue,
}: Readonly<{
  directConversation: Readonly<
    Pick<ConversationType, 'id' | 'type' | 'serviceId' | 'reportingToken'>
  >;
  getMessageServerGuidsForSpam: (
    conversationId: string,
    sourceServiceId?: string
  ) => Promise<Array<string>>;
  groupConversationId?: string;
  jobQueue: Pick<typeof reportSpamJobQueue, 'add'>;
}>): Promise<void> {
  assertDev(
    isDirectConversation(directConversation),
    'addReportSpamJob: cannot report spam for non-direct conversations'
  );

  const { serviceId: aci, reportingToken: token } = directConversation;
  if (!aci || !isAciString(aci)) {
    log.info(
      'got a conversation with no aci, which the server does not support. Doing nothing'
    );
    return;
  }

  let serverGuids: Array<string> = [];
  if (groupConversationId) {
    serverGuids = await getMessageServerGuidsForSpam(groupConversationId, aci);
  } else {
    serverGuids = await getMessageServerGuidsForSpam(directConversation.id);
  }

  if (!serverGuids.length) {
    // This can happen under normal conditions. We haven't always stored server GUIDs, so
    //   a user might try to report spam for a conversation that doesn't have them. (It
    //   may also indicate developer error, but that's not necessarily the case.)
    log.info('got no server GUIDs from the database. Doing nothing');
    return;
  }

  await jobQueue.add({ aci, serverGuids, token });
}
