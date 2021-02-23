import { createOrUpdateItem, getItemById } from '../../../ts/data/data';
import { getMessageQueue } from '..';
import { ConversationController } from '../conversations';
import { getCurrentConfigurationMessage } from './Messages';
import { RawMessage } from '../types';
import { DAYS } from './Number';

const ITEM_ID_LAST_SYNC_TIMESTAMP = 'lastSyncedTimestamp';

const getLastSyncTimestampFromDb = async (): Promise<number | undefined> =>
  (await getItemById(ITEM_ID_LAST_SYNC_TIMESTAMP))?.value;

const writeLastSyncTimestampToDb = async (timestamp: number) =>
  createOrUpdateItem({ id: ITEM_ID_LAST_SYNC_TIMESTAMP, value: timestamp });

export const syncConfigurationIfNeeded = async () => {
  const lastSyncedTimestamp = (await getLastSyncTimestampFromDb()) || 0;
  const now = Date.now();

  // if the last sync was less than 2 days before, return early.
  if (Math.abs(now - lastSyncedTimestamp) < DAYS * 2) {
    return;
  }

  const allConvos = ConversationController.getInstance().getConversations();
  const configMessage = await getCurrentConfigurationMessage(allConvos);
  try {
    // window.log.info('syncConfigurationIfNeeded with', configMessage);

    await getMessageQueue().sendSyncMessage(configMessage);
  } catch (e) {
    window.log.warn(
      'Caught an error while sending our ConfigurationMessage:',
      e
    );
    // we do return early so that next time we use the old timestamp again
    // and so try again to trigger a sync
    return;
  }
  await writeLastSyncTimestampToDb(now);
};

export const forceSyncConfigurationNowIfNeeded = async (
  waitForMessageSent = false
) => {
  const allConvos = ConversationController.getInstance().getConversations();
  const configMessage = await getCurrentConfigurationMessage(allConvos);

  async function waitForMessageSentEvent(message: RawMessage) {
    return new Promise(resolve => {
      if (message.identifier === configMessage.identifier) {
        // might have fail in fact
        debugger;
        resolve(true);
      }
    });
  }

  try {
    // passing the callback like that
    if (waitForMessageSent) {
      await getMessageQueue().sendSyncMessage(
        configMessage,
        waitForMessageSentEvent as any
      );
      return waitForMessageSentEvent;
    } else {
      await getMessageQueue().sendSyncMessage(configMessage);
    }
  } catch (e) {
    window.log.warn(
      'Caught an error while sending our ConfigurationMessage:',
      e
    );
  }

  return Promise.resolve();
};
