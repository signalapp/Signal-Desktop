// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assertDev } from '../../util/assert.std.js';
import { isDirectConversation } from '../../util/whatTypeOfConversation.dom.js';
import { createLogger } from '../../logging/log.std.js';
import { isAciString } from '../../util/isAciString.std.js';
import type { reportSpamJobQueue } from '../reportSpamJobQueue.preload.js';
import type { ConversationType } from '../../state/ducks/conversations.preload.js';

const log = createLogger('addReportSpamJob');

export async function addReportSpamJob({
  conversation,
  getMessageServerGuidsForSpam,
  jobQueue,
}: Readonly<{
  conversation: Readonly<
    Pick<ConversationType, 'id' | 'type' | 'serviceId' | 'reportingToken'>
  >;
  getMessageServerGuidsForSpam: (
    conversationId: string
  ) => Promise<Array<string>>;
  jobQueue: Pick<typeof reportSpamJobQueue, 'add'>;
}>): Promise<void> {
  assertDev(
    isDirectConversation(conversation),
    'addReportSpamJob: cannot report spam for non-direct conversations'
  );

  const { serviceId: aci } = conversation;
  if (!aci || !isAciString(aci)) {
    log.info(
      'got a conversation with no aci, which the server does not support. Doing nothing'
    );
    return;
  }

  const serverGuids = await getMessageServerGuidsForSpam(conversation.id);
  if (!serverGuids.length) {
    // This can happen under normal conditions. We haven't always stored server GUIDs, so
    //   a user might try to report spam for a conversation that doesn't have them. (It
    //   may also indicate developer error, but that's not necessarily the case.)
    log.info('got no server GUIDs from the database. Doing nothing');
    return;
  }

  await jobQueue.add({ aci, serverGuids, token: conversation.reportingToken });
}
