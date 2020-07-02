import { SignalService } from '../protobuf';
import { ClosedGroupRequestInfoMessage } from '../session/messages/outgoing/content/data/group/ClosedGroupRequestInfoMessage';
import { getMessageQueue } from '../session';
import { PubKey } from '../session/types';
import _ from 'lodash';

function isGroupBlocked(groupId: string) {
  return (
    window.textsecure.storage.get('blocked-groups', []).indexOf(groupId) >= 0
  );
}

function shouldIgnoreBlockedGroup(group: any, senderPubKey: string) {
  const groupId = group.id;
  const isBlocked = isGroupBlocked(groupId);
  const isLeavingGroup = Boolean(
    group.type === SignalService.GroupContext.Type.QUIT
  );

  const primaryDevicePubKey = window.storage.get('primaryDevicePubKey');
  const isMe =
    senderPubKey === window.textsecure.storage.user.getNumber() ||
    senderPubKey === primaryDevicePubKey;

  return isBlocked && !(isMe && isLeavingGroup);
}

/**
 * Returns true if the message is already completely handled and confirmed
 * and the processing of this message must stop.
 */
export async function preprocessGroupMessage(
  source: string,
  group: any,
  primarySource: string
) {
  const conversationId = group.id;
  const conversation = await window.ConversationController.getOrCreateAndWait(
    conversationId,
    'group'
  );

  if (conversation.isPublic()) {
    // window.console.log('No need to preprocess public group chat messages');
    return;
  }
  const GROUP_TYPES = SignalService.GroupContext.Type;

  if (shouldIgnoreBlockedGroup(group, source)) {
    window.log.warn('Message ignored; destined for blocked group');
    return true;
  }

  // NOTE: we use group admins to tell if this is
  // the creation of the group (initial update)
  const groupAdminsSet =
    conversation.get('groupAdmins') &&
    conversation.get('groupAdmins').length > 0;
  const newGroup = !groupAdminsSet;
  const knownMembers = conversation.get('members');

  if (!newGroup && knownMembers) {
    const fromMember = knownMembers.includes(primarySource);
    // if the group exists and we have its members,
    // we must drop a message from anyone else than the existing members.
    if (!fromMember) {
      window.log.warn(
        `Ignoring group message from non-member: ${primarySource}`
      );
      // returning true drops the message
      return true;
    }
  }
  if (group.type === GROUP_TYPES.REQUEST_INFO) {
    // We can only send the request info back if we have the information
    if (!newGroup) {
      window.libloki.api.debug.logGroupRequestInfo(
        `Received GROUP_TYPES.REQUEST_INFO from source: ${source}, primarySource: ${primarySource}, sending back group info.`
      );
      conversation.sendGroupInfo(source);
    }
    return true;
  }

  if (group.members && group.type === GROUP_TYPES.UPDATE) {
    if (newGroup) {
      conversation.updateGroupAdmins(group.admins);
    } else {
      // be sure to drop a message from a non admin if it tries to change group members
      // or change the group name
      const fromAdmin = conversation.get('groupAdmins').includes(primarySource);

      if (!fromAdmin) {
        // Make sure the message is not removing members / renaming the group
        const nameChanged = conversation.get('name') !== group.name;

        if (nameChanged) {
          window.log.warn('Non-admin attempts to change the name of the group');
        }

        const membersMissing =
          _.difference(conversation.get('members'), group.members).length > 0;

        if (membersMissing) {
          window.log.warn('Non-admin attempts to remove group members');
        }

        const messageAllowed = !nameChanged && !membersMissing;

        // Returning true drops the message
        if (!messageAllowed) {
          return true;
        }
      }
    }
    // send a session request for all the members we do not have a session with
    await window.libloki.api.sendSessionRequestsToMembers(group.members);
  } else if (newGroup) {
    // We have an unknown group, we should request info from the sender
    const requestInfo = {
      timestamp: Date.now(),
      groupId: conversationId,
    };
    const requestInfoMessage = new ClosedGroupRequestInfoMessage(requestInfo);
    const primarySourcePubKey = new PubKey(primarySource);
    await getMessageQueue().sendUsingMultiDevice(
      primarySourcePubKey,
      requestInfoMessage
    );
  }
  return false;
}

export async function onGroupReceived(ev: any) {
  const {
    ConversationController,
    libloki,
    storage,
    textsecure,
    Whisper,
  } = window;

  const details = ev.groupDetails;
  const { id } = details;

  libloki.api.debug.logGroupSync(
    'Got sync group message with group id',
    id,
    ' details:',
    details
  );

  const conversation = await ConversationController.getOrCreateAndWait(
    id,
    'group'
  );

  const updates: any = {
    name: details.name,
    members: details.members,
    color: details.color,
    type: 'group',
    is_medium_group: details.is_medium_group || false,
  };

  if (details.active) {
    const activeAt = conversation.get('active_at');

    // The idea is to make any new group show up in the left pane. If
    //   activeAt is null, then this group has been purposefully hidden.
    if (activeAt !== null) {
      updates.active_at = activeAt || Date.now();
    }
    updates.left = false;
  } else {
    updates.left = true;
  }

  if (details.blocked) {
    storage.addBlockedGroup(id);
  } else {
    storage.removeBlockedGroup(id);
  }

  conversation.set(updates);

  // Update the conversation avatar only if new avatar exists and hash differs
  const { avatar } = details;
  if (avatar && avatar.data) {
    const newAttributes = await window.Signal.Types.Conversation.maybeUpdateAvatar(
      conversation.attributes,
      avatar.data,
      {
        writeNewAttachmentData: window.Signal.writeNewAttachmentData,
        deleteAttachmentData: window.Signal.deleteAttachmentData,
      }
    );
    conversation.set(newAttributes);
  }

  await window.Signal.Data.updateConversation(id, conversation.attributes, {
    Conversation: Whisper.Conversation,
  });

  // send a session request for all the members we do not have a session with
  await window.libloki.api.sendSessionRequestsToMembers(updates.members);

  const { expireTimer } = details;
  const isValidExpireTimer = typeof expireTimer === 'number';
  if (!isValidExpireTimer) {
    return;
  }

  const source = textsecure.storage.user.getNumber();
  const receivedAt = Date.now();
  await conversation.updateExpirationTimer(expireTimer, source, receivedAt, {
    fromSync: true,
  });

  ev.confirm();
}
