import { SignalService } from './../protobuf';
import { removeFromCache } from './cache';
import { MultiDeviceProtocol } from '../session/protocols';
import { EnvelopePlus } from './types';
import { ConversationType, getEnvelopeId } from './common';
import { preprocessGroupMessage } from './groups';

import { MessageModel } from '../../js/models/messages';
import { PubKey } from '../session/types';
import { handleMessageJob } from './queuedJob';
import { handleEndSession } from './sessionHandling';
import { handleMediumGroupUpdate } from './mediumGroups';
import { handleUnpairRequest } from './multidevice';
import { downloadAttachment } from './attachments';
import _ from 'lodash';
import { StringUtils } from '../session/utils';

export async function updateProfile(
  conversation: any,
  profile: SignalService.DataMessage.ILokiProfile,
  profileKey: any
) {
  const { dcodeIO, textsecure, Signal } = window;

  // Retain old values unless changed:
  const newProfile = conversation.get('profile') || {};

  newProfile.displayName = profile.displayName;

  // TODO: may need to allow users to reset their avatars to null
  if (profile.avatar) {
    const prevPointer = conversation.get('avatarPointer');
    const needsUpdate = !prevPointer || !_.isEqual(prevPointer, profile.avatar);

    if (needsUpdate) {
      conversation.set('avatarPointer', profile.avatar);
      conversation.set('profileKey', profileKey);

      const downloaded = await downloadAttachment({
        url: profile.avatar,
        isRaw: true,
      });

      // null => use jazzicon
      let path = null;
      if (profileKey) {
        // Convert profileKey to ArrayBuffer, if needed
        const encoding = typeof profileKey === 'string' ? 'base64' : null;
        try {
          const profileKeyArrayBuffer = dcodeIO.ByteBuffer.wrap(
            profileKey,
            encoding
          ).toArrayBuffer();
          const decryptedData = await textsecure.crypto.decryptProfile(
            downloaded.data,
            profileKeyArrayBuffer
          );
          const upgraded = await Signal.Migrations.processNewAttachment({
            ...downloaded,
            data: decryptedData,
          });
          ({ path } = upgraded);
        } catch (e) {
          window.log.error(`Could not decrypt profile image: ${e}`);
        }
      }
      newProfile.avatar = path;
    }
  } else {
    newProfile.avatar = null;
  }

  await conversation.setLokiProfile(newProfile);

  if (conversation.isSecondaryDevice()) {
    const primaryConversation = await conversation.getPrimaryConversation();
    await primaryConversation.setLokiProfile(newProfile);
  }
}

function cleanAttachment(attachment: any) {
  return {
    ..._.omit(attachment, 'thumbnail'),
    id: attachment.id.toString(),
    key: attachment.key ? StringUtils.decode(attachment.key, 'base64') : null,
    digest: attachment.digest
      ? StringUtils.decode(attachment.digest, 'base64')
      : null,
  };
}

function cleanAttachments(decrypted: any) {
  const { quote, group } = decrypted;

  // Here we go from binary to string/base64 in all AttachmentPointer digest/key fields

  if (group && group.type === SignalService.GroupContext.Type.UPDATE) {
    if (group.avatar !== null) {
      group.avatar = cleanAttachment(group.avatar);
    }
  }

  decrypted.attachments = (decrypted.attachments || []).map(cleanAttachment);
  decrypted.preview = (decrypted.preview || []).map((item: any) => {
    const { image } = item;

    if (!image) {
      return item;
    }

    return {
      ...item,
      image: cleanAttachment(image),
    };
  });

  decrypted.contact = (decrypted.contact || []).map((item: any) => {
    const { avatar } = item;

    if (!avatar || !avatar.avatar) {
      return item;
    }

    return {
      ...item,
      avatar: {
        ...item.avatar,
        avatar: cleanAttachment(item.avatar.avatar),
      },
    };
  });

  if (quote) {
    if (quote.id) {
      quote.id = _.toNumber(quote.id);
    }

    quote.attachments = (quote.attachments || []).map((item: any) => {
      const { thumbnail } = item;

      if (!thumbnail) {
        return item;
      }

      return {
        ...item,
        thumbnail: cleanAttachment(item.thumbnail),
      };
    });
  }
}

export async function processDecrypted(envelope: EnvelopePlus, decrypted: any) {
  /* tslint:disable:no-bitwise */
  const FLAGS = SignalService.DataMessage.Flags;

  // Now that its decrypted, validate the message and clean it up for consumer
  //   processing
  // Note that messages may (generally) only perform one action and we ignore remaining
  //   fields after the first action.

  if (decrypted.flags == null) {
    decrypted.flags = 0;
  }
  if (decrypted.expireTimer == null) {
    decrypted.expireTimer = 0;
  }

  if (decrypted.flags & FLAGS.END_SESSION) {
    decrypted.body = '';
    decrypted.attachments = [];
    decrypted.group = null;
    return Promise.resolve(decrypted);
  } else if (decrypted.flags & FLAGS.EXPIRATION_TIMER_UPDATE) {
    decrypted.body = '';
    decrypted.attachments = [];
  } else if (decrypted.flags & FLAGS.PROFILE_KEY_UPDATE) {
    decrypted.body = '';
    decrypted.attachments = [];
  } else if (decrypted.flags & FLAGS.SESSION_RESTORE) {
    // do nothing
  } else if (decrypted.flags & FLAGS.UNPAIRING_REQUEST) {
    // do nothing
  } else if (decrypted.flags !== 0) {
    throw new Error('Unknown flags in message');
  }

  if (decrypted.group) {
    decrypted.group.id = new TextDecoder('utf-8').decode(decrypted.group.id);

    switch (decrypted.group.type) {
      case SignalService.GroupContext.Type.UPDATE:
        decrypted.body = '';
        decrypted.attachments = [];
        break;
      case SignalService.GroupContext.Type.QUIT:
        decrypted.body = '';
        decrypted.attachments = [];
        break;
      case SignalService.GroupContext.Type.DELIVER:
        decrypted.group.name = null;
        decrypted.group.members = [];
        decrypted.group.avatar = null;
        break;
      case SignalService.GroupContext.Type.REQUEST_INFO:
        decrypted.body = '';
        decrypted.attachments = [];
        break;
      default:
        await removeFromCache(envelope);
        throw new Error('Unknown group message type');
    }
  }

  const attachmentCount = decrypted.attachments.length;
  const ATTACHMENT_MAX = 32;
  if (attachmentCount > ATTACHMENT_MAX) {
    await removeFromCache(envelope);
    throw new Error(
      `Too many attachments: ${attachmentCount} included in one message, max is ${ATTACHMENT_MAX}`
    );
  }

  cleanAttachments(decrypted);

  return decrypted;
  /* tslint:disable:no-bitwise */
}

function isMessageEmpty(message: SignalService.DataMessage) {
  const {
    flags,
    body,
    attachments,
    group,
    quote,
    contact,
    preview,
    groupInvitation,
    mediumGroupUpdate,
  } = message;

  return (
    !flags &&
    _.isEmpty(body) &&
    _.isEmpty(attachments) &&
    _.isEmpty(group) &&
    _.isEmpty(quote) &&
    _.isEmpty(contact) &&
    _.isEmpty(preview) &&
    _.isEmpty(groupInvitation) &&
    _.isEmpty(mediumGroupUpdate)
  );
}

export async function handleDataMessage(
  envelope: EnvelopePlus,
  dataMessage: SignalService.IDataMessage
): Promise<void> {
  window.log.info('data message from', getEnvelopeId(envelope));

  if (dataMessage.mediumGroupUpdate) {
    await handleMediumGroupUpdate(envelope, dataMessage.mediumGroupUpdate);
    return;
  }

  // tslint:disable-next-line no-bitwise
  if (
    dataMessage.flags &&
    dataMessage.flags & SignalService.DataMessage.Flags.END_SESSION
  ) {
    await handleEndSession(envelope.source);
    return;
  }
  const message = await processDecrypted(envelope, dataMessage);
  const ourPubKey = window.textsecure.storage.user.getNumber();
  const senderPubKey = envelope.source;
  const isMe = senderPubKey === ourPubKey;
  const conversation = window.ConversationController.get(senderPubKey);

  const { UNPAIRING_REQUEST } = SignalService.DataMessage.Flags;

  // eslint-disable-next-line no-bitwise
  const isUnpairingRequest = Boolean(message.flags & UNPAIRING_REQUEST);

  if (isUnpairingRequest) {
    return handleUnpairRequest(envelope, ourPubKey);
  }

  // Check if we need to update any profile names
  if (!isMe && conversation && message.profile) {
    await updateProfile(conversation, message.profile, message.profileKey);
  }
  if (isMessageEmpty(message)) {
    window.log.warn(`Message ${getEnvelopeId(envelope)} ignored; it was empty`);
    return removeFromCache(envelope);
  }

  const source = envelope.senderIdentity || senderPubKey;

  const isOwnDevice = async (device: string) => {
    const pubKey = new PubKey(device);
    const allDevices = await MultiDeviceProtocol.getAllDevices(pubKey);

    return allDevices.some(d => d.isEqual(pubKey));
  };

  const ownDevice = await isOwnDevice(source);

  const ownMessage = conversation.isMediumGroup() && ownDevice;

  const ev: any = {};
  if (ownMessage) {
    // Data messages for medium groups don't arrive as sync messages. Instead,
    // linked devices poll for group messages independently, thus they need
    // to recognise some of those messages at their own.
    ev.type = 'sent';
  } else {
    ev.type = 'message';
  }

  if (envelope.senderIdentity) {
    message.group = {
      id: envelope.source,
    };
  }

  ev.confirm = () => removeFromCache(envelope);
  ev.data = {
    source,
    sourceDevice: envelope.sourceDevice,
    timestamp: _.toNumber(envelope.timestamp),
    receivedAt: envelope.receivedAt,
    unidentifiedDeliveryReceived: envelope.unidentifiedDeliveryReceived,
    message,
  };

  await handleMessageEvent(ev);
}

interface MessageId {
  source: any;
  sourceDevice: any;
  timestamp: any;
}

async function isMessageDuplicate({
  source,
  sourceDevice,
  timestamp,
}: MessageId) {
  const { Errors } = window.Signal.Types;

  try {
    const result = await window.Signal.Data.getMessageBySender(
      { source, sourceDevice, sent_at: timestamp },
      {
        Message: window.Whisper.Message,
      }
    );

    return Boolean(result);
  } catch (error) {
    window.log.error('isMessageDuplicate error:', Errors.toLogFormat(error));
    return false;
  }
}

async function handleProfileUpdate(
  profileKeyBuffer: any,
  convoId: string,
  convoType: ConversationType,
  isIncoming: boolean
) {
  const profileKey = profileKeyBuffer.toString('base64');

  if (!isIncoming) {
    const receiver = await window.ConversationController.getOrCreateAndWait(
      convoId,
      convoType
    );
    // First set profileSharing = true for the conversation we sent to
    receiver.set({ profileSharing: true });
    await receiver.saveChangesToDB();

    // Then we update our own profileKey if it's different from what we have
    const ourNumber = window.textsecure.storage.user.getNumber();
    const me = await window.ConversationController.getOrCreate(
      ourNumber,
      'private'
    );

    // Will do the save for us if needed
    await me.setProfileKey(profileKey);
  } else {
    const sender = await window.ConversationController.getOrCreateAndWait(
      convoId,
      'private'
    );

    // Will do the save for us
    await sender.setProfileKey(profileKey);
  }
}

interface MessageCreationData {
  timestamp: number;
  isPublic: boolean;
  receivedAt: number;
  sourceDevice: number; // always 1 isn't it?
  unidentifiedDeliveryReceived: any; // ???
  isRss: boolean;
  source: boolean;
  serverId: string;

  // Needed for synced outgoing messages
  unidentifiedStatus: any; // ???
  expirationStartTimestamp: any; // ???
  destination: string;
}

export function initIncomingMessage(data: MessageCreationData): MessageModel {
  const {
    timestamp,
    isPublic,
    receivedAt,
    sourceDevice,
    unidentifiedDeliveryReceived,
    isRss,
    source,
    serverId,
  } = data;

  const type = 'incoming';

  const messageData: any = {
    source,
    sourceDevice,
    serverId, // + (not present below in `createSentMessage`)
    sent_at: timestamp,
    received_at: receivedAt || Date.now(),
    conversationId: source,
    unidentifiedDeliveryReceived, // +
    type,
    direction: 'incoming', // +
    unread: 1, // +
    isPublic, // +
    isRss, // +
  };

  return new window.Whisper.Message(messageData);
}

function createSentMessage(data: MessageCreationData): MessageModel {
  const now = Date.now();
  let sentTo = [];

  const {
    timestamp,
    isPublic,
    receivedAt,
    sourceDevice,
    unidentifiedStatus,
    expirationStartTimestamp,
    destination,
  } = data;

  let unidentifiedDeliveries;

  if (unidentifiedStatus && unidentifiedStatus.length) {
    sentTo = unidentifiedStatus.map((item: any) => item.destination);
    const unidentified = _.filter(unidentifiedStatus, (item: any) =>
      Boolean(item.unidentified)
    );
    // eslint-disable-next-line no-param-reassign
    unidentifiedDeliveries = unidentified.map((item: any) => item.destination);
  }

  const sentSpecificFields = {
    sent_to: sentTo,
    sent: true,
    unidentifiedDeliveries: unidentifiedDeliveries || [],
    expirationStartTimestamp: Math.min(
      expirationStartTimestamp || data.timestamp || now,
      now
    ),
  };

  const messageData: any = {
    source: window.textsecure.storage.user.getNumber(),
    sourceDevice,
    sent_at: timestamp,
    received_at: isPublic ? receivedAt : now,
    conversationId: destination, // conversation ID will might change later (if it is a group)
    type: 'outgoing',
    ...sentSpecificFields,
  };

  return new window.Whisper.Message(messageData);
}

function createMessage(
  data: MessageCreationData,
  isIncoming: boolean
): MessageModel {
  if (isIncoming) {
    return initIncomingMessage(data);
  } else {
    return createSentMessage(data);
  }
}

function sendDeliveryReceipt(source: string, timestamp: any) {
  // FIXME audric
  // const receiptMessage = new DeliveryReceiptMessage({
  //   timestamp: Date.now(),
  //   timestamps: [timestamp],
  // });
  // const device = new PubKey(source);
  // await getMessageQueue().sendUsingMultiDevice(device, receiptMessage);
}

// tslint:disable:cyclomatic-complexity max-func-body-length */
export async function handleMessageEvent(event: any): Promise<void> {
  const { data, confirm } = event;

  const isIncoming = event.type === 'message';

  if (!data || !data.message) {
    window.log.warn('Invalid data passed to handleMessageEvent.', event);
    confirm();
    return;
  }

  const { message, destination } = data;

  let { source } = data;

  const isGroupMessage = Boolean(message.group);

  const type = isGroupMessage
    ? ConversationType.GROUP
    : ConversationType.PRIVATE;

  // MAXIM: So id is actually conversationId
  const id = isIncoming ? source : destination;

  const {
    PROFILE_KEY_UPDATE,
    SESSION_RESTORE,
  } = SignalService.DataMessage.Flags;

  // eslint-disable-next-line no-bitwise
  const isProfileUpdate = Boolean(message.flags & PROFILE_KEY_UPDATE);

  if (isProfileUpdate) {
    await handleProfileUpdate(message.profileKey, id, type, isIncoming);
    confirm();
    return;
  }

  const msg = createMessage(data, isIncoming);

  // if the message is `sent` (from secondary device) we have to set the sender manually... (at least for now)
  source = source || msg.get('source');

  const isDuplicate = await isMessageDuplicate(data);

  if (isDuplicate) {
    // RSS expects duplicates, so squelch log
    if (!source.match(/^rss:/)) {
      window.log.warn('Received duplicate message', msg.idForLogging());
    }
    confirm();
    return;
  }

  const isOurDevice = await MultiDeviceProtocol.isOurDevice(source);

  const shouldSendReceipt =
    isIncoming &&
    data.unidentifiedDeliveryReceived &&
    !isGroupMessage &&
    !isOurDevice;

  if (shouldSendReceipt) {
    sendDeliveryReceipt(source, data.timestamp);
  }

  await window.ConversationController.getOrCreateAndWait(id, type);

  // =========== Process flags =============

  // eslint-disable-next-line no-bitwise
  if (message.flags & SESSION_RESTORE) {
    // Show that the session reset is "in progress" even though we had a valid session
    msg.set({ endSessionType: 'ongoing' });
  }

  const ourNumber = window.textsecure.storage.user.getNumber();

  // =========================================

  // Conversation Id is:
  //  - primarySource if it is an incoming DM message,
  //  - destination if it is an outgoing message,
  //  - group.id if it is a group message
  let conversationId = id;

  const primarySource = await MultiDeviceProtocol.getPrimaryDevice(source);
  if (isGroupMessage) {
    /* handle one part of the group logic here:
               handle requesting info of a new group,
               dropping an admin only update from a non admin, ...
             */
    conversationId = message.group.id;
    const shouldReturn = await preprocessGroupMessage(
      source,
      message.group,
      primarySource.key
    );

    // handleGroupMessage() can process fully a message in some cases
    // so we need to return early if that's the case
    if (shouldReturn) {
      confirm();
      return;
    }
  } else if (source !== ourNumber) {
    // Ignore auth from our devices
    conversationId = primarySource.key;
  }

  // the conversation with the primary device of that source (can be the same as conversationOrigin)
  const conversation = window.ConversationController.get(conversationId);

  conversation.queueJob(() => {
    handleMessageJob(
      msg,
      conversation,
      message,
      ourNumber,
      confirm,
      source,
      primarySource
    ).ignore();
  });
}
