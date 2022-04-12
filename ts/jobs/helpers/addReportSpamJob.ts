// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from '../../util/assert';
import * as log from '../../logging/log';
import type { ConversationType } from '../../state/ducks/conversations';
import type { reportSpamJobQueue } from '../reportSpamJobQueue';

export async function addReportSpamJob({
  conversation,
  getMessageServerGuidsForSpam,
  jobQueue,
}: Readonly<{
  conversation: Readonly<ConversationType>;
  getMessageServerGuidsForSpam: (
    conversationId: string
  ) => Promise<Array<string>>;
  jobQueue: Pick<typeof reportSpamJobQueue, 'add'>;
}>): Promise<void> {
  assert(
    conversation.type === 'direct',
    'addReportSpamJob: cannot report spam for non-direct conversations'
  );

  const { uuid } = conversation;
  if (!uuid) {
    log.info(
      'addReportSpamJob got a conversation with no UUID, which the server does not support. Doing nothing'
    );
    return;
  }

  const serverGuids = await getMessageServerGuidsForSpam(conversation.id);
  if (!serverGuids.length) {
    // This can happen under normal conditions. We haven't always stored server GUIDs, so
    //   a user might try to report spam for a conversation that doesn't have them. (It
    //   may also indicate developer error, but that's not necessarily the case.)
    log.info(
      'addReportSpamJob got no server GUIDs from the database. Doing nothing'
    );
    return;
  }

  await jobQueue.add({ uuid, serverGuids });
}
