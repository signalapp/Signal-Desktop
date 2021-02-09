import { createOrUpdateItem, getItemById } from '../../../js/modules/data';
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
    window.log.info('syncConfigurationIfNeeded with', configMessage);

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
  window.log.info('forceSyncConfigurationNowIfNeeded with', configMessage);

  const waitForMessageSentEvent = new Promise(resolve => {
    const ourResolver = (message: any) => {
      if (message.identifier === configMessage.identifier) {
        getMessageQueue().events.off('sendSuccess', ourResolver);
        getMessageQueue().events.off('sendFail', ourResolver);
        resolve(true);
      }
    };
    getMessageQueue().events.on('sendSuccess', ourResolver);
    getMessageQueue().events.on('sendFail', ourResolver);
  });

  try {
    // this just adds the message to the sending queue.
    // if waitForMessageSent is set, we need to effectively wait until then
    await Promise.all([
      getMessageQueue().sendSyncMessage(configMessage),
      waitForMessageSentEvent,
    ]);
  } catch (e) {
    window.log.warn(
      'Caught an error while sending our ConfigurationMessage:',
      e
    );
  }
  if (!waitForMessageSent) {
    return;
  }

  return waitForMessageSentEvent;
};
