import _ from 'lodash';
import { getMessageById } from '../../data/data';
import { SignalService } from '../../protobuf';
import { PnServer } from '../apis/push_notification_api';
import { OpenGroupVisibleMessage } from '../messages/outgoing/visibleMessage/OpenGroupVisibleMessage';
import { RawMessage } from '../types';
import { UserUtils } from '../utils';

// tslint:disable-next-line: no-unnecessary-class
export class MessageSentHandler {
  public static async handlePublicMessageSentSuccess(
    sentMessage: OpenGroupVisibleMessage,
    result: { serverId: number; serverTimestamp: number }
  ) {
    const { serverId, serverTimestamp } = result;
    try {
      const foundMessage = await MessageSentHandler.fetchHandleMessageSentData(sentMessage);

      if (!foundMessage) {
        throw new Error(
          'handlePublicMessageSentSuccess(): The message should be in memory for an openGroup message'
        );
      }

      foundMessage.set({
        serverTimestamp,
        serverId,
        isPublic: true,
        sent: true,
        sent_at: serverTimestamp, // we quote by sent_at, so we MUST sent_at: serverTimestamp
        sync: true,
        synced: true,
        sentSync: true,
      });
      await foundMessage.commit();
      foundMessage.getConversation()?.updateLastMessage();
    } catch (e) {
      window?.log?.error('Error setting public on message');
    }
  }

  // tslint:disable-next-line: cyclomatic-complexity
  public static async handleMessageSentSuccess(
    sentMessage: RawMessage,
    effectiveTimestamp: number,
    wrappedEnvelope?: Uint8Array
  ) {
    // The wrappedEnvelope will be set only if the message is not one of OpenGroupV2Message type.
    let fetchedMessage = await MessageSentHandler.fetchHandleMessageSentData(sentMessage);
    if (!fetchedMessage) {
      return;
    }

    let sentTo = fetchedMessage.get('sent_to') || [];

    const isOurDevice = UserUtils.isUsFromCache(sentMessage.device);

    // FIXME this is not correct and will cause issues with syncing
    // At this point the only way to check for medium
    // group is by comparing the encryption type
    const isClosedGroupMessage =
      sentMessage.encryption === SignalService.Envelope.Type.CLOSED_GROUP_MESSAGE;

    // We trigger a sync message only when the message is not to one of our devices, AND
    // the message is not for an open group (there is no sync for opengroups, each device pulls all messages), AND
    // if we did not sync or trigger a sync message for this specific message already
    const shouldTriggerSyncMessage =
      !isOurDevice &&
      !isClosedGroupMessage &&
      !fetchedMessage.get('synced') &&
      !fetchedMessage.get('sentSync');

    // A message is synced if we triggered a sync message (sentSync)
    // and the current message was sent to our device (so a sync message)
    const shouldMarkMessageAsSynced = isOurDevice && fetchedMessage.get('sentSync');

    const contentDecoded = SignalService.Content.decode(sentMessage.plainTextBuffer);
    const { dataMessage } = contentDecoded;

    /**
     * We should hit the notify endpoint for push notification only if:
     *  • It's a one-to-one chat or a closed group
     *  • The message has either text or attachments
     */
    const hasBodyOrAttachments = Boolean(
      dataMessage &&
        (dataMessage.body || (dataMessage.attachments && dataMessage.attachments.length))
    );
    const shouldNotifyPushServer = hasBodyOrAttachments && !isOurDevice;

    if (shouldNotifyPushServer) {
      // notify the push notification server if needed
      if (!wrappedEnvelope) {
        window?.log?.warn('Should send PN notify but no wrapped envelope set.');
      } else {
        // we do not really care about the result, neither of waiting for it
        void PnServer.notifyPnServer(wrappedEnvelope, sentMessage.device);
      }
    }

    // Handle the sync logic here
    if (shouldTriggerSyncMessage) {
      if (dataMessage) {
        try {
          await fetchedMessage.sendSyncMessage(
            dataMessage as SignalService.DataMessage,
            effectiveTimestamp
          );
          const tempFetchMessage = await MessageSentHandler.fetchHandleMessageSentData(sentMessage);
          if (!tempFetchMessage) {
            window?.log?.warn(
              'Got an error while trying to sendSyncMessage(): fetchedMessage is null'
            );
            return;
          }
          fetchedMessage = tempFetchMessage;
        } catch (e) {
          window?.log?.warn('Got an error while trying to sendSyncMessage():', e);
        }
      }
    } else if (shouldMarkMessageAsSynced) {
      fetchedMessage.set({ synced: true });
    }

    sentTo = _.union(sentTo, [sentMessage.device]);

    fetchedMessage.set({
      sent_to: sentTo,
      sent: true,
      expirationStartTimestamp: Date.now(),
      sent_at: effectiveTimestamp,
    });

    await fetchedMessage.commit();
    fetchedMessage.getConversation()?.updateLastMessage();
  }

  public static async handleMessageSentFailure(
    sentMessage: RawMessage | OpenGroupVisibleMessage,
    error: any
  ) {
    const fetchedMessage = await MessageSentHandler.fetchHandleMessageSentData(sentMessage);
    if (!fetchedMessage) {
      return;
    }

    if (error instanceof Error) {
      await fetchedMessage.saveErrors(error);
    }

    if (!(sentMessage instanceof OpenGroupVisibleMessage)) {
      const isOurDevice = UserUtils.isUsFromCache(sentMessage.device);
      // if this message was for ourself, and it was not already synced,
      // it means that we failed to sync it.
      // so just remove the flag saying that we are currently sending the sync message
      if (isOurDevice && !fetchedMessage.get('sync')) {
        fetchedMessage.set({ sentSync: false });
      }

      fetchedMessage.set({
        expirationStartTimestamp: Date.now(),
      });
    }

    // always mark the message as sent.
    // the fact that we have errors on the sent is based on the saveErrors()
    fetchedMessage.set({
      sent: true,
    });

    await fetchedMessage.commit();
    await fetchedMessage.getConversation()?.updateLastMessage();
  }

  /**
   * This function tries to find a message by messageId by first looking on the MessageController.
   * The MessageController holds all messages being in memory.
   * Those are the messages sent recently, recieved recently, or the one shown to the user.
   *
   * If the app restarted, it's very likely those messages won't be on the memory anymore.
   * In this case, this function will look for it in the database and return it.
   * If the message is found on the db, it will also register it to the MessageController so our subsequent calls are quicker.
   */
  private static async fetchHandleMessageSentData(m: RawMessage | OpenGroupVisibleMessage) {
    const dbMessage = await getMessageById(m.identifier);

    if (!dbMessage) {
      return null;
    }
    return dbMessage;
  }
}
