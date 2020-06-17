import { SignalService } from '../protobuf';
import { removeFromCache } from './cache';
import { EnvelopePlus } from './types';

async function handleSenderKeyRequest(
  envelope: EnvelopePlus,
  groupUpdate: any
) {
  const { SenderKeyAPI, StringView, textsecure, log } = window;

  const senderIdentity = envelope.source;
  const ourIdentity = await textsecure.storage.user.getNumber();
  const { groupId } = groupUpdate;

  log.debug('[sender key] sender key request from:', senderIdentity);

  const proto = new SignalService.DataMessage();

  // We reuse the same message type for sender keys
  const update = new SignalService.MediumGroupUpdate();

  const { chainKey, keyIdx } = await SenderKeyAPI.getSenderKeys(
    groupId,
    ourIdentity
  );

  update.type = SignalService.MediumGroupUpdate.Type.SENDER_KEY;
  update.groupId = groupId;
  update.senderKey = new SignalService.SenderKey({
    chainKey: StringView.arrayBufferToHex(chainKey),
    keyIdx,
  });

  proto.mediumGroupUpdate = update;

  textsecure.messaging.updateMediumGroup([senderIdentity], proto);

  removeFromCache(envelope);
}

async function handleSenderKey(envelope: EnvelopePlus, groupUpdate: any) {
  const { SenderKeyAPI, log } = window;
  const { groupId, senderKey } = groupUpdate;
  const senderIdentity = envelope.source;

  log.debug('[sender key] got a new sender key from:', senderIdentity);

  await SenderKeyAPI.saveSenderKeys(
    groupId,
    senderIdentity,
    senderKey.chainKey,
    senderKey.keyIdx
  );

  removeFromCache(envelope);
}

async function handleNewGroup(envelope: EnvelopePlus, groupUpdate: any) {
  const {
    SenderKeyAPI,
    StringView,
    Whisper,
    log,
    textsecure,
    Lodash: _,
  } = window;

  const senderIdentity = envelope.source;

  const ourIdentity = await textsecure.storage.user.getNumber();

  const {
    groupId,
    members: membersBinary,
    groupSecretKey,
    groupName,
    senderKey,
    admins,
  } = groupUpdate;

  const maybeConvo = await window.ConversationController.get(groupId);
  const groupExists = !!maybeConvo;

  const members = membersBinary.map((pk: any) =>
    StringView.arrayBufferToHex(pk.toArrayBuffer())
  );

  const convo = groupExists
    ? maybeConvo
    : await window.ConversationController.getOrCreateAndWait(groupId, 'group');

  {
    // Add group update message
    const now = Date.now();
    const message = convo.messageCollection.add({
      conversationId: convo.id,
      type: 'incoming',
      sent_at: now,
      received_at: now,
      group_update: {
        name: groupName,
        members,
      },
    });

    const messageId = await window.Signal.Data.saveMessage(message.attributes, {
      Message: Whisper.Message,
    });
    message.set({ id: messageId });
  }

  if (groupExists) {
    // ***** Updating the group *****
    log.info('Received a group update for medium group:', groupId);

    // Check that the sender is admin (make sure it words with multidevice)
    const isAdmin = convo.get('groupAdmins').includes(senderIdentity);

    if (!isAdmin) {
      log.warn('Rejected attempt to update a group by non-admin');
      removeFromCache(envelope);
      return;
    }

    convo.set('name', groupName);
    convo.set('members', members);

    // TODO: check that we are still in the group (when we enable deleting members)
    convo.saveChangesToDB();

    // Update other fields. Add a corresponding "update" message to the conversation
  } else {
    // ***** Creating a new group *****
    log.info('Received a new medium group:', groupId);

    // TODO: Check that we are even a part of this group?

    convo.set('is_medium_group', true);
    convo.set('active_at', Date.now());
    convo.set('name', groupName);
    convo.set('groupAdmins', admins);

    const secretKeyHex = StringView.arrayBufferToHex(
      groupSecretKey.toArrayBuffer()
    );

    await window.Signal.Data.createOrUpdateIdentityKey({
      id: groupId,
      secretKey: secretKeyHex,
    });

    // Save sender's key
    await SenderKeyAPI.saveSenderKeys(
      groupId,
      envelope.source,
      senderKey.chainKey,
      senderKey.keyIdx
    );

    const ownSenderKey = await SenderKeyAPI.createSenderKeyForGroup(
      groupId,
      ourIdentity
    );

    {
      // Send own key to every member
      const otherMembers = _.without(members, ourIdentity);

      const proto = new SignalService.DataMessage();

      // We reuse the same message type for sender keys
      const update = new SignalService.MediumGroupUpdate();
      update.type = SignalService.MediumGroupUpdate.Type.SENDER_KEY;
      update.groupId = groupId;
      update.senderKey = new SignalService.SenderKey({
        chainKey: ownSenderKey,
        keyIdx: 0,
      });

      proto.mediumGroupUpdate = update;

      textsecure.messaging.updateMediumGroup(otherMembers, proto);
    }

    // TODO: !!!! This will need to be re-enabled after message polling refactor !!!!!
    // Subscribe to this group
    // this.pollForAdditionalId(groupId);
  }

  removeFromCache(envelope);
}

export async function handleMediumGroupUpdate(
  envelope: EnvelopePlus,
  groupUpdate: any
) {
  const { type } = groupUpdate;
  const { Type } = SignalService.MediumGroupUpdate;

  if (type === Type.SENDER_KEY_REQUEST) {
    await handleSenderKeyRequest(envelope, groupUpdate);
  } else if (type === Type.SENDER_KEY) {
    await handleSenderKey(envelope, groupUpdate);
  } else if (type === Type.NEW_GROUP) {
    await handleNewGroup(envelope, groupUpdate);
  }
}
