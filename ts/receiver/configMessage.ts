import _ from 'lodash';
import { createOrUpdateItem } from '../data/data';
import { ConversationTypeEnum } from '../models/conversation';
import {
  joinOpenGroupV2WithUIEvents,
  parseOpenGroupV2,
} from '../opengroup/opengroupV2/JoinOpenGroupV2';
import { getOpenGroupV2ConversationId } from '../opengroup/utils/OpenGroupUtils';
import { SignalService } from '../protobuf';
import { getConversationController } from '../session/conversations';
import { UserUtils } from '../session/utils';
import { toHex } from '../session/utils/String';
import { configurationMessageReceived, trigger } from '../shims/events';
import { BlockedNumberController } from '../util';
import { removeFromCache } from './cache';
import { handleNewClosedGroup } from './closedGroups';
import { updateProfileOneAtATime } from './dataMessage';
import { EnvelopePlus } from './types';

async function handleOurProfileUpdate(
  sentAt: number | Long,
  configMessage: SignalService.ConfigurationMessage,
  ourPubkey: string
) {
  const latestProfileUpdateTimestamp = UserUtils.getLastProfileUpdateTimestamp();
  if (!latestProfileUpdateTimestamp || sentAt > latestProfileUpdateTimestamp) {
    window?.log?.info(
      `Handling our profileUdpate ourLastUpdate:${latestProfileUpdateTimestamp}, envelope sent at: ${sentAt}`
    );
    const { profileKey, profilePicture, displayName } = configMessage;

    const ourConversation = getConversationController().get(ourPubkey);
    if (!ourConversation) {
      window?.log?.error('We need a convo with ourself at all times');
      return;
    }

    const lokiProfile = {
      displayName,
      profilePicture,
    };
    await updateProfileOneAtATime(ourConversation, lokiProfile, profileKey);
    UserUtils.setLastProfileUpdateTimestamp(_.toNumber(sentAt));
    // do not trigger a signin by linking if the display name is empty
    if (displayName) {
      trigger(configurationMessageReceived, displayName);
    } else {
      window?.log?.warn('Got a configuration message but the display name is empty');
    }
  }
}

async function handleGroupsAndContactsFromConfigMessage(
  envelope: EnvelopePlus,
  configMessage: SignalService.ConfigurationMessage
) {
  await createOrUpdateItem({
    id: 'hasSyncedInitialConfigurationItem',
    value: true,
  });

  const numberClosedGroup = configMessage.closedGroups?.length || 0;

  window?.log?.info(
    `Received ${numberClosedGroup} closed group on configuration. Creating them... `
  );

  await Promise.all(
    configMessage.closedGroups.map(async c => {
      const groupUpdate = new SignalService.DataMessage.ClosedGroupControlMessage({
        type: SignalService.DataMessage.ClosedGroupControlMessage.Type.NEW,
        encryptionKeyPair: c.encryptionKeyPair,
        name: c.name,
        admins: c.admins,
        members: c.members,
        publicKey: c.publicKey,
      });
      try {
        await handleNewClosedGroup(envelope, groupUpdate);
      } catch (e) {
        window?.log?.warn('failed to handle  a new closed group from configuration message');
      }
    })
  );

  const numberOpenGroup = configMessage.openGroups?.length || 0;

  // Trigger a join for all open groups we are not already in.
  // Currently, if you left an open group but kept the conversation, you won't rejoin it here.
  for (let i = 0; i < numberOpenGroup; i++) {
    const currentOpenGroupUrl = configMessage.openGroups[i];
    const parsedRoom = parseOpenGroupV2(currentOpenGroupUrl);
    if (!parsedRoom) {
      continue;
    }
    const roomConvoId = getOpenGroupV2ConversationId(parsedRoom.serverUrl, parsedRoom.roomId);
    if (!getConversationController().get(roomConvoId)) {
      window?.log?.info(
        `triggering join of public chat '${currentOpenGroupUrl}' from ConfigurationMessage`
      );
      void joinOpenGroupV2WithUIEvents(currentOpenGroupUrl, false, true);
    }
  }
  if (configMessage.contacts?.length) {
    await Promise.all(configMessage.contacts.map(async c => handleContactReceived(c, envelope)));
  }
}

const handleContactReceived = async (
  contactReceived: SignalService.ConfigurationMessage.IContact,
  envelope: EnvelopePlus
) => {
  try {
    if (!contactReceived.publicKey) {
      return;
    }
    const contactConvo = await getConversationController().getOrCreateAndWait(
      toHex(contactReceived.publicKey),
      ConversationTypeEnum.PRIVATE
    );
    const profile = {
      displayName: contactReceived.name,
      profilePictre: contactReceived.profilePicture,
    };
    // updateProfile will do a commit for us
    contactConvo.set('active_at', _.toNumber(envelope.timestamp));

    if (
      window.lokiFeatureFlags.useMessageRequests === true &&
      window.inboxStore?.getState().userConfig.messageRequests &&
      contactReceived.isApproved === true
    ) {
      await contactConvo.setIsApproved(Boolean(contactReceived.isApproved));

      if (contactReceived.isBlocked === true) {
        await BlockedNumberController.block(contactConvo.id);
      } else {
        await BlockedNumberController.unblock(contactConvo.id);
      }
    }

    await updateProfileOneAtATime(contactConvo, profile, contactReceived.profileKey);
  } catch (e) {
    window?.log?.warn('failed to handle  a new closed group from configuration message');
  }
};

export async function handleConfigurationMessage(
  envelope: EnvelopePlus,
  configurationMessage: SignalService.ConfigurationMessage
): Promise<void> {
  window?.log?.info('Handling configuration message');
  const ourPubkey = UserUtils.getOurPubKeyStrFromCache();
  if (!ourPubkey) {
    return;
  }

  if (envelope.source !== ourPubkey) {
    window?.log?.info('Dropping configuration change from someone else than us.');
    return removeFromCache(envelope);
  }

  await handleOurProfileUpdate(envelope.timestamp, configurationMessage, ourPubkey);

  await handleGroupsAndContactsFromConfigMessage(envelope, configurationMessage);

  await removeFromCache(envelope);
}
