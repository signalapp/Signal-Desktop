// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString } from '../types/ServiceId';
import type { ReadonlyMessageAttributesType } from '../model-types.d';
import { DataReader } from '../sql/Client';
import * as Errors from '../types/errors';
import * as log from '../logging/log';
import { getMessageIdForLogging } from '../util/idForLogging';

export type ViewOnceOpenSyncAttributesType = {
  removeFromMessageReceiverCache: () => unknown;
  source?: string;
  sourceAci: AciString;
  timestamp: number;
};

const viewOnceSyncs = new Map<number, ViewOnceOpenSyncAttributesType>();

function remove(sync: ViewOnceOpenSyncAttributesType): void {
  viewOnceSyncs.delete(sync.timestamp);
  sync.removeFromMessageReceiverCache();
}

export function forMessage(
  message: ReadonlyMessageAttributesType
): ViewOnceOpenSyncAttributesType | null {
  const logId = `ViewOnceOpenSyncs.forMessage(${getMessageIdForLogging(
    message
  )})`;

  const viewOnceSyncValues = Array.from(viewOnceSyncs.values());

  const syncBySourceServiceId = viewOnceSyncValues.find(item => {
    return (
      item.sourceAci === message.sourceServiceId &&
      item.timestamp === message.sent_at
    );
  });

  if (syncBySourceServiceId) {
    log.info(`${logId}: Found early view once open sync for message`);
    remove(syncBySourceServiceId);
    return syncBySourceServiceId;
  }

  const syncBySource = viewOnceSyncValues.find(item => {
    return item.source === message.source && item.timestamp === message.sent_at;
  });
  if (syncBySource) {
    log.info(`${logId}: Found early view once open sync for message`);
    remove(syncBySource);
    return syncBySource;
  }

  return null;
}

export async function onSync(
  sync: ViewOnceOpenSyncAttributesType
): Promise<void> {
  viewOnceSyncs.set(sync.timestamp, sync);

  const logId = `ViewOnceOpenSyncs.onSync(timestamp=${sync.timestamp})`;

  try {
    const messages = await DataReader.getMessagesBySentAt(sync.timestamp);

    const found = messages.find(item => {
      const itemSourceAci = item.sourceServiceId;
      const syncSourceAci = sync.sourceAci;
      const itemSource = item.source;
      const syncSource = sync.source;

      return Boolean(
        (itemSourceAci && syncSourceAci && itemSourceAci === syncSourceAci) ||
          (itemSource && syncSource && itemSource === syncSource)
      );
    });

    const syncSource = sync.source;
    const syncSourceAci = sync.sourceAci;
    const syncTimestamp = sync.timestamp;
    const wasMessageFound = Boolean(found);
    log.info(`${logId} receive:`, {
      syncSource,
      syncSourceAci,
      syncTimestamp,
      wasMessageFound,
    });

    if (!found) {
      return;
    }

    const message = window.MessageCache.__DEPRECATED$register(
      found.id,
      found,
      'ViewOnceOpenSyncs.onSync'
    );
    await message.markViewOnceMessageViewed({ fromSync: true });

    viewOnceSyncs.delete(sync.timestamp);
    sync.removeFromMessageReceiverCache();
  } catch (error) {
    log.error(`${logId} error:`, Errors.toLogFormat(error));
  }
}
