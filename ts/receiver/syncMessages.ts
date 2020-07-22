import { EnvelopePlus } from './types';
import { SignalService } from '../protobuf';
import { removeFromCache } from './cache';
import { getEnvelopeId } from './common';
import _ from 'lodash';
import ByteBuffer from 'bytebuffer';

import { handleEndSession } from './sessionHandling';
import { handleMediumGroupUpdate } from './mediumGroups';
import { handleMessageEvent, processDecrypted } from './dataMessage';
import { updateProfile } from './receiver';
import { handleContacts } from './multidevice';
import { updateOrCreateGroupFromSync } from '../session/medium_group';
import { MultiDeviceProtocol } from '../session/protocols';

export async function handleSyncMessage(
  envelope: EnvelopePlus,
  syncMessage: SignalService.ISyncMessage
): Promise<void> {
  const { textsecure } = window;

  // We should only accept sync messages from our devices
  const ourNumber = textsecure.storage.user.getNumber();
  const ourDevices = await MultiDeviceProtocol.getAllDevices(ourNumber);
  const validSyncSender = ourDevices.some(
    device => device.key === envelope.source
  );
  if (!validSyncSender) {
    throw new Error(
      "Received sync message from a device we aren't paired with"
    );
  }

  if (syncMessage.sent) {
    const sentMessage = syncMessage.sent;
    const message = sentMessage.message as SignalService.IDataMessage;
    const to = message.group
      ? `group(${message.group.id})`
      : sentMessage.destination;

    window.log.info(
      'sent message to',
      to,
      _.toNumber(sentMessage.timestamp),
      'from',
      getEnvelopeId(envelope)
    );
    await handleSentMessage(envelope, sentMessage);
  } else if (syncMessage.contacts) {
    return handleContacts(envelope, syncMessage.contacts);
  } else if (syncMessage.groups) {
    await handleGroupsSync(envelope, syncMessage.groups);
  } else if (syncMessage.openGroups) {
    await handleOpenGroups(envelope, syncMessage.openGroups);
  } else if (syncMessage.blocked) {
    await handleBlocked(envelope, syncMessage.blocked);
  } else if (syncMessage.request) {
    window.log.info('Got SyncMessage Request');
    await removeFromCache(envelope);
  } else if (syncMessage.read && syncMessage.read.length) {
    window.log.info('read messages from', getEnvelopeId(envelope));
    await handleRead(envelope, syncMessage.read);
  } else if (syncMessage.verified) {
    await handleVerified(envelope, syncMessage.verified);
  } else if (syncMessage.configuration) {
    await handleConfiguration(envelope, syncMessage.configuration);
  }
  throw new Error('Got empty SyncMessage');
}

// handle a SYNC message for a message
// sent by another device
async function handleSentMessage(
  envelope: EnvelopePlus,
  sentMessage: SignalService.SyncMessage.ISent
) {
  const {
    destination,
    timestamp,
    expirationStartTimestamp,
    unidentifiedStatus,
    message: msg,
  } = sentMessage;

  if (!msg) {
    window.log('Inner message is missing in a sync message');
    await removeFromCache(envelope);
    return;
  }

  const { ConversationController } = window;

  // tslint:disable-next-line no-bitwise
  if (msg.flags && msg.flags & SignalService.DataMessage.Flags.END_SESSION) {
    await handleEndSession(destination as string);
  }

  if (msg.mediumGroupUpdate) {
    await handleMediumGroupUpdate(envelope, msg.mediumGroupUpdate);
  }

  const message = await processDecrypted(envelope, msg);

  const primaryDevicePubKey = window.storage.get('primaryDevicePubKey');

  // handle profileKey and avatar updates
  if (envelope.source === primaryDevicePubKey) {
    const { profileKey, profile } = message;
    const primaryConversation = ConversationController.get(primaryDevicePubKey);
    if (profile) {
      await updateProfile(primaryConversation, profile, profileKey);
    }
  }

  const ev: any = new Event('sent');
  ev.confirm = removeFromCache.bind(null, envelope);
  ev.data = {
    destination,
    timestamp: _.toNumber(timestamp),
    device: envelope.sourceDevice,
    unidentifiedStatus,
    message,
  };
  if (expirationStartTimestamp) {
    ev.data.expirationStartTimestamp = _.toNumber(expirationStartTimestamp);
  }

  await handleMessageEvent(ev);
}

// This doesn't have to be async...
function handleAttachment(attachment: any) {
  return {
    ...attachment,
    data: ByteBuffer.wrap(attachment.data).toArrayBuffer(), // ByteBuffer to ArrayBuffer
  };
}

async function handleOpenGroups(
  envelope: EnvelopePlus,
  openGroups: Array<SignalService.SyncMessage.IOpenGroupDetails>
) {
  const groupsArray = openGroups.map(openGroup => openGroup.url);
  window.libloki.api.debug.logGroupSync(
    `Received GROUP_SYNC with open groups: [${groupsArray}]`
  );
  openGroups.forEach(({ url, channelId }) => {
    window.attemptConnection(url, channelId);
  });
  await removeFromCache(envelope);
}

async function handleBlocked(
  envelope: EnvelopePlus,
  blocked: SignalService.SyncMessage.IBlocked
) {
  window.log.info('Setting these numbers as blocked:', blocked.numbers);
  window.textsecure.storage.put('blocked', blocked.numbers);

  const groupIds = _.map(blocked.groupIds, (groupId: any) =>
    groupId.toBinary()
  );
  window.log.info(
    'Setting these groups as blocked:',
    groupIds.map((groupId: any) => `group(${groupId})`)
  );
  window.textsecure.storage.put('blocked-groups', groupIds);

  await removeFromCache(envelope);
}

async function onReadSync(readAt: any, sender: any, timestamp: any) {
  window.log.info('read sync', sender, timestamp);

  const receipt = window.Whisper.ReadSyncs.add({
    sender,
    timestamp,
    read_at: readAt,
  });

  await window.Whisper.ReadSyncs.onReceipt(receipt);
}

async function handleRead(
  envelope: EnvelopePlus,
  readArray: Array<SignalService.SyncMessage.IRead>
) {
  const results = [];
  for (const read of readArray) {
    const promise = onReadSync(
      _.toNumber(envelope.timestamp),
      read.sender,
      _.toNumber(read.timestamp)
    );
    results.push(promise);
  }

  await Promise.all(results);

  await removeFromCache(envelope);
}

async function handleVerified(
  envelope: EnvelopePlus,
  verified: SignalService.IVerified
) {
  const ev: any = new Event('verified');

  ev.verified = {
    state: verified.state,
    destination: verified.destination,
    identityKey: verified.identityKey?.buffer,
  };

  await onVerified(ev);

  await removeFromCache(envelope);
}

export async function onVerified(ev: any) {
  const { ConversationController, textsecure, Whisper } = window;
  const { Errors } = window.Signal.Types;

  const number = ev.verified.destination;
  const key = ev.verified.identityKey;
  let state;

  const c = new Whisper.Conversation({
    id: number,
  });
  const error = c.validateNumber();
  if (error) {
    window.log.error(
      'Invalid verified sync received:',
      Errors.toLogFormat(error)
    );
    return;
  }

  switch (ev.verified.state) {
    case SignalService.Verified.State.DEFAULT:
      state = 'DEFAULT';
      break;
    case SignalService.Verified.State.VERIFIED:
      state = 'VERIFIED';
      break;
    case SignalService.Verified.State.UNVERIFIED:
      state = 'UNVERIFIED';
      break;
    default:
      window.log.error(`Got unexpected verified state: ${ev.verified.state}`);
  }

  window.log.info(
    'got verified sync for',
    number,
    state,
    ev.viaContactSync ? 'via contact sync' : ''
  );

  const contact = await ConversationController.getOrCreateAndWait(
    number,
    'private'
  );
  const options = {
    viaSyncMessage: true,
    viaContactSync: ev.viaContactSync,
    key,
  };

  if (state === 'VERIFIED') {
    await contact.setVerified(options);
  } else if (state === 'DEFAULT') {
    await contact.setVerifiedDefault(options);
  } else {
    await contact.setUnverified(options);
  }

  if (ev.confirm) {
    ev.confirm();
  }
}

async function handleConfiguration(
  envelope: EnvelopePlus,
  configuration: SignalService.SyncMessage.IConfiguration
) {
  window.log.info('got configuration sync message');

  const { storage } = window;

  const {
    readReceipts,
    typingIndicators,
    unidentifiedDeliveryIndicators,
    linkPreviews,
  } = configuration;

  storage.put('read-receipt-setting', readReceipts);

  if (
    unidentifiedDeliveryIndicators === true ||
    unidentifiedDeliveryIndicators === false
  ) {
    storage.put(
      'unidentifiedDeliveryIndicators',
      unidentifiedDeliveryIndicators
    );
  }

  if (typingIndicators === true || typingIndicators === false) {
    storage.put('typing-indicators-setting', typingIndicators);
  }

  if (linkPreviews === true || linkPreviews === false) {
    storage.put('link-preview-setting', linkPreviews);
  }

  await removeFromCache(envelope);
}

async function handleGroupsSync(
  envelope: EnvelopePlus,
  groups: SignalService.SyncMessage.IGroups
) {
  window.log.info('group sync');

  const attachmentPointer = handleAttachment(groups);

  const groupBuffer = new window.GroupBuffer(attachmentPointer.data);
  let groupDetails = groupBuffer.next();
  const promises = [];
  while (groupDetails !== undefined) {
    groupDetails.id = groupDetails.id.toBinary();

    const promise = updateOrCreateGroupFromSync(groupDetails).catch(
      (e: any) => {
        window.log.error('error processing group', e);
      }
    );

    promises.push(promise);
    groupDetails = groupBuffer.next();
  }

  // Note: we do not return here because we don't want to block the next message on
  // this attachment download and a lot of processing of that attachment.
  void Promise.all(promises);

  await removeFromCache(envelope);
}
