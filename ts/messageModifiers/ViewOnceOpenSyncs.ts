// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { AciString } from '../types/ServiceId.std.js';
import type { ReadonlyMessageAttributesType } from '../model-types.d.ts';
import { DataReader } from '../sql/Client.preload.js';
import * as Errors from '../types/errors.std.js';
import { createLogger } from '../logging/log.std.js';
import { getMessageIdForLogging } from '../util/idForLogging.preload.js';
import { markViewOnceMessageViewed } from '../services/MessageUpdater.preload.js';
import { MessageModel } from '../models/messages.preload.js';

const log = createLogger('ViewOnceOpenSyncs');

export type ViewOnceOpenSyncAttributesType = {
  removeFromMessageReceiverCache: () => unknown;
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
      const itemSource = item.sourceServiceId;
      const syncSource = sync.sourceAci;

      return Boolean(itemSource && syncSource && itemSource === syncSource);
    });

    const syncSourceAci = sync.sourceAci;
    const syncTimestamp = sync.timestamp;
    const wasMessageFound = Boolean(found);
    log.info(`${logId} receive:`, {
      syncSourceAci,
      syncTimestamp,
      wasMessageFound,
    });

    if (!found) {
      return;
    }

    const message = window.MessageCache.register(new MessageModel(found));
    await markViewOnceMessageViewed(message, { fromSync: true });

    viewOnceSyncs.delete(sync.timestamp);
    sync.removeFromMessageReceiverCache();
  } catch (error) {
    log.error(`${logId} error:`, Errors.toLogFormat(error));
  }
}
