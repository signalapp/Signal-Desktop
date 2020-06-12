// TODO: fix libloki and textsecure not being available here yet

import { preprocessGroupMessage } from './groups';
import { handleMessageJob } from './queuedJob';
import { handleEndSession } from './sessionHandling';
import { handleUnpairRequest } from './multidevice';
import { EnvelopePlus } from './types';
import { ConversationModel } from './conversation';
import { EndSessionType, MessageModel } from './message';
import { downloadAttachment } from './attachments';
import { handleMediumGroupUpdate } from './mediumGroups';

import { SignalService } from './../protobuf';

import { removeFromCache } from './cache';
import { toNumber } from 'lodash';
import { DataMessage } from '../session/messages/outgoing';

export { handleEndSession, handleMediumGroupUpdate };

const _ = window.Lodash;

interface MessageCreationData {
  timestamp: number;
  isPublic: boolean;
  receivedAt: number;
  sourceDevice: number; // always 1 isn't it?
  unidentifiedDeliveryReceived: any; // ???
  friendRequest: boolean;
  isRss: boolean;
  source: boolean;
  serverId: string;

  // Needed for synced outgoing messages
  unidentifiedStatus: any; // ???
  expirationStartTimestamp: any; // ???
  destination: string;
}

function initIncomingMessage(data: MessageCreationData): MessageModel {
  const {
    timestamp,
    isPublic,
    receivedAt,
    sourceDevice,
    unidentifiedDeliveryReceived,
    friendRequest,
    isRss,
    source,
    serverId,
  } = data;

  const type = friendRequest ? 'friend-request' : 'incoming';

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

  if (friendRequest) {
    messageData.friendStatus = 'pending';
  }

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

enum ConversationType {
  GROUP = 'group',
  PRIVATE = 'private',
}

function sendDeliveryReceipt(source: string, timestamp: any) {
  const { wrap, sendOptions } = window.ConversationController.prepareForSend(
    source
  );
  wrap(
    window.textsecure.messaging.sendDeliveryReceipt(
      source,
      timestamp,
      sendOptions
    )
  ).catch((error: any) => {
    window.log.error(
      `Failed to send delivery receipt to ${source} for message ${timestamp}:`,
      error && error.stack ? error.stack : error
    );
  });
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

async function handleSessionRequest(source: string) {
  await window.libloki.api.sendSessionEstablishedMessage(source);
}

async function handleSecondaryDeviceFriendRequest(pubKey: string) {
  // fetch the device mapping from the server
  const deviceMapping = await window.lokiFileServerAPI.getUserDeviceMapping(
    pubKey
  );
  if (!deviceMapping) {
    return false;
  }
  // Only handle secondary pubkeys
  if (deviceMapping.isPrimary === '1' || !deviceMapping.authorisations) {
    return false;
  }
  const { authorisations } = deviceMapping;
  // Secondary devices should only have 1 authorisation from a primary device
  if (authorisations.length !== 1) {
    return false;
  }
  const authorisation = authorisations[0];
  if (!authorisation) {
    return false;
  }
  if (!authorisation.grantSignature) {
    return false;
  }
  const isValid = await window.libloki.crypto.validateAuthorisation(
    authorisation
  );
  if (!isValid) {
    return false;
  }
  const correctSender = pubKey === authorisation.secondaryDevicePubKey;
  if (!correctSender) {
    return false;
  }
  const { primaryDevicePubKey } = authorisation;
  // ensure the primary device is a friend
  const c = window.ConversationController.get(primaryDevicePubKey);
  if (!c || !(await c.isFriendWithAnyDevice())) {
    return false;
  }
  await window.libloki.storage.savePairingAuthorisation(authorisation);

  return true;
}

async function handleAutoFriendRequestMessage(
  source: string,
  ourPubKey: string,
  conversation: ConversationModel
) {
  const isMe = source === ourPubKey;
  // If we got a friend request message (session request excluded) or
  // if we're not friends with the current user that sent this private message
  // Check to see if we need to auto accept their friend request
  if (isMe) {
    window.log.info('refusing to add a friend request to ourselves');
    throw new Error('Cannot add a friend request for ourselves!');
  }
  // auto-accept friend request if the device is paired to one of our friend's primary device
  const shouldAutoAcceptFR = await handleSecondaryDeviceFriendRequest(source);
  if (shouldAutoAcceptFR) {
    window.libloki.api.debug.logAutoFriendRequest(
      `Received AUTO_FRIEND_REQUEST from source: ${source}`
    );
    // Directly setting friend request status to skip the pending state
    await conversation.setFriendRequestStatus(
      window.friends.friendRequestStatusEnum.friends
    );
    // sending a message back = accepting friend request

    window.libloki.api.sendBackgroundMessage(
      source,
      window.textsecure.OutgoingMessage.DebugMessageType.AUTO_FR_ACCEPT
    );
    // return true to notify the message is fully processed
    return true;
  }
  return false;
}

function getEnvelopeId(envelope: EnvelopePlus) {
  if (envelope.source) {
    return `${envelope.source}.${envelope.sourceDevice} ${toNumber(
      envelope.timestamp
    )} (${envelope.id})`;
  }

  return envelope.id;
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

function cleanAttachment(attachment: any) {
  return {
    ..._.omit(attachment, 'thumbnail'),
    id: attachment.id.toString(),
    key: attachment.key ? attachment.key.toString('base64') : null,
    digest: attachment.digest ? attachment.digest.toString('base64') : null,
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
      quote.id = toNumber(quote.id);
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

export function processDecrypted(envelope: EnvelopePlus, decrypted: any) {
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
  } else if (decrypted.flags & FLAGS.SESSION_REQUEST) {
    // do nothing
  } else if (decrypted.flags & FLAGS.SESSION_RESTORE) {
    // do nothing
  } else if (decrypted.flags & FLAGS.UNPAIRING_REQUEST) {
    // do nothing
  } else if (decrypted.flags !== 0) {
    throw new Error('Unknown flags in message');
  }

  if (decrypted.group) {
    decrypted.group.id = decrypted.group.id?.toBinary();

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
        removeFromCache(envelope);
        throw new Error('Unknown group message type');
    }
  }

  const attachmentCount = decrypted.attachments.length;
  const ATTACHMENT_MAX = 32;
  if (attachmentCount > ATTACHMENT_MAX) {
    removeFromCache(envelope);
    throw new Error(
      `Too many attachments: ${attachmentCount} included in one message, max is ${ATTACHMENT_MAX}`
    );
  }

  cleanAttachments(decrypted);

  return decrypted;
  /* tslint:disable:no-bitwise */
}

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
}

export async function handleDataMessage(
  envelope: EnvelopePlus,
  dataMessage: SignalService.DataMessage
): Promise<void> {
  window.log.info('data message from', getEnvelopeId(envelope));

  if (dataMessage.mediumGroupUpdate) {
    handleMediumGroupUpdate(envelope, dataMessage.mediumGroupUpdate).ignore();
    // TODO: investigate the meaning of this return value
    return;
  }

  // eslint-disable-next-line no-bitwise
  if (dataMessage.flags & SignalService.DataMessage.Flags.END_SESSION) {
    await handleEndSession(envelope.source);
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

  // Loki - Temp hack until new protocol
  // A friend request is a non-group text message which we haven't processed yet
  const isGroupMessage = Boolean(message.group || message.mediumGroupUpdate);
  const friendRequestStatusNoneOrExpired = conversation
    ? conversation.isFriendRequestStatusNoneOrExpired()
    : true;
  const isFriendRequest =
    !isGroupMessage &&
    !_.isEmpty(message.body) &&
    friendRequestStatusNoneOrExpired;

  const source = envelope.senderIdentity || senderPubKey;

  const isOwnDevice = async (pubkey: string) => {
    const primaryDevice = window.storage.get('primaryDevicePubKey');
    const secondaryDevices = await window.libloki.storage.getPairedDevicesFor(
      primaryDevice
    );

    const allDevices = [primaryDevice, ...secondaryDevices];
    return allDevices.includes(pubkey);
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
    friendRequest: isFriendRequest,
    source,
    sourceDevice: envelope.sourceDevice,
    timestamp: toNumber(envelope.timestamp),
    receivedAt: envelope.receivedAt,
    unidentifiedDeliveryReceived: envelope.unidentifiedDeliveryReceived,
    message,
  };

  await handleMessageEvent(ev);
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

  const isGroupMessage = message.group;

  const type = isGroupMessage
    ? ConversationType.GROUP
    : ConversationType.PRIVATE;

  // MAXIM: So id is actually conversationId
  const id = isIncoming ? source : destination;

  const {
    PROFILE_KEY_UPDATE,
    SESSION_REQUEST,
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

  // Note(LOKI): don't send receipt for FR as we don't have a session yet
  const shouldSendReceipt =
    isIncoming &&
    data.unidentifiedDeliveryReceived &&
    !data.friendRequest &&
    !isGroupMessage;

  if (shouldSendReceipt) {
    sendDeliveryReceipt(source, data.timestamp);
  }

  await window.ConversationController.getOrCreateAndWait(id, type);

  // =========== Process flags =============

  /**
   * A session request message is a friend-request message with the flag
   * SESSION_REQUEST set to true.
   */
  // eslint-disable-next-line no-bitwise
  const sessionRequest =
    data.friendRequest && !!(message.flags & SESSION_REQUEST);

  // NOTE: I don't need to create/use msg if it is a session request!

  if (sessionRequest) {
    await handleSessionRequest(source);
    confirm();
    return;
  }

  // eslint-disable-next-line no-bitwise
  if (message.flags & SESSION_RESTORE) {
    // Show that the session reset is "in progress" even though we had a valid session
    msg.set({ endSessionType: EndSessionType.ONGOING });
  }

  const ourNumber = window.textsecure.storage.user.getNumber();

  // AFR are only relevant for incoming messages
  if (isIncoming) {
    // the conversation with this real device
    const conversationOrigin = window.ConversationController.get(source);

    // Session request have been dealt with before, so a friend request here is
    // not a session request message. Also, handleAutoFriendRequestMessage() only
    // handles the autoAccept logic of an auto friend request.
    if (
      data.friendRequest ||
      (!isGroupMessage && !conversationOrigin.isFriend())
    ) {
      const accepted = await handleAutoFriendRequestMessage(
        source,
        ourNumber,
        conversationOrigin
      );

      if (accepted) {
        confirm();
        return;
      }
    }
  }

  // =========================================

  // Conversation Id is:
  //  - primarySource if it is an incoming DM message,
  //  - destination if it is an outgoing message,
  //  - group.id if it is a group message
  let conversationId = id;

  const authorisation = await window.libloki.storage.getGrantAuthorisationForSecondaryPubKey(
    source
  );

  const primarySource =
    (authorisation && authorisation.primaryDevicePubKey) || source;

  if (isGroupMessage) {
    /* handle one part of the group logic here:
           handle requesting info of a new group,
           dropping an admin only update from a non admin, ...
         */
    conversationId = message.group.id;
    const shouldReturn = await preprocessGroupMessage(
      source,
      message.group,
      primarySource
    );

    // handleGroupMessage() can process fully a message in some cases
    // so we need to return early if that's the case
    if (shouldReturn) {
      confirm();
      return;
    }
  }

  if (source !== ourNumber && authorisation) {
    // Ignore auth from our devices
    conversationId = authorisation.primaryDevicePubKey;
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
      isGroupMessage,
      primarySource
    ).ignore();
  });
}
// tslint:enable:cyclomatic-complexity max-func-body-length */
