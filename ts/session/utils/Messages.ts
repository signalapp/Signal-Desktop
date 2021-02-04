import { RawMessage } from '../types/RawMessage';
import {
  ContentMessage,
  ExpirationTimerUpdateMessage,
} from '../messages/outgoing';
import { EncryptionType, PubKey } from '../types';
import { ClosedGroupMessage } from '../messages/outgoing/content/data/group/ClosedGroupMessage';
import { ClosedGroupNewMessage } from '../messages/outgoing/content/data/group/ClosedGroupNewMessage';
import { ConversationModel } from '../../../js/models/conversations';
import {
  ConfigurationMessage,
  ConfigurationMessageClosedGroup,
} from '../messages/outgoing/content/ConfigurationMessage';
import uuid from 'uuid';
import * as Data from '../../../js/modules/data';
import { UserUtils } from '.';
import { ECKeyPair } from '../../receiver/keypairs';
import _ from 'lodash';

export function getEncryptionTypeFromMessageType(
  message: ContentMessage
): EncryptionType {
  // ClosedGroupNewMessage is sent using established channels, so using fallback
  if (message instanceof ClosedGroupNewMessage) {
    return EncryptionType.Fallback;
  }

  // 1. any ClosedGroupMessage which is not a ClosedGroupNewMessage must be encoded with ClosedGroup
  // 2. if TypingMessage or ExpirationTimer and groupId is set => must be encoded with ClosedGroup too
  if (
    message instanceof ClosedGroupMessage ||
    (message instanceof ExpirationTimerUpdateMessage && message.groupId)
  ) {
    return EncryptionType.ClosedGroup;
  } else {
    return EncryptionType.Fallback;
  }
}

export async function toRawMessage(
  device: PubKey,
  message: ContentMessage
): Promise<RawMessage> {
  const timestamp = message.timestamp;
  const ttl = message.ttl();
  // window?.log?.debug('toRawMessage proto:', message.contentProto());
  const plainTextBuffer = message.plainTextBuffer();

  const encryption = getEncryptionTypeFromMessageType(message);

  // tslint:disable-next-line: no-unnecessary-local-variable
  const rawMessage: RawMessage = {
    identifier: message.identifier,
    plainTextBuffer,
    timestamp,
    device: device.key,
    ttl,
    encryption,
  };

  return rawMessage;
}

export const getCurrentConfigurationMessage = async (
  convos: Array<ConversationModel>
) => {
  const ourPubKey = (await UserUtils.getOurNumber()).key;
  const openGroupsIds = convos
    .filter(
      c =>
        !!c.get('active_at') &&
        c.get('members').includes(ourPubKey) &&
        c.isPublic() &&
        !c.get('left')
    )
    .map(c => c.id) as Array<string>;
  const closedGroupModels = convos.filter(
    c =>
      !!c.get('active_at') &&
      c.isMediumGroup() &&
      !c.get('left') &&
      !c.get('isKickedFromGroup')
  );

  const closedGroups = await Promise.all(
    closedGroupModels.map(async c => {
      const groupPubKey = c.get('id');
      const fetchEncryptionKeyPair = await Data.getLatestClosedGroupEncryptionKeyPair(
        groupPubKey
      );
      if (!fetchEncryptionKeyPair) {
        return null;
      }

      return new ConfigurationMessageClosedGroup({
        publicKey: groupPubKey,
        name: c.get('name'),
        members: c.get('members') || [],
        admins: c.get('groupAdmins') || [],
        encryptionKeyPair: ECKeyPair.fromHexKeyPair(fetchEncryptionKeyPair),
      });
    })
  );

  const onlyValidClosedGroup = closedGroups.filter(m => m !== null) as Array<
    ConfigurationMessageClosedGroup
  >;
  return new ConfigurationMessage({
    identifier: uuid(),
    timestamp: Date.now(),
    activeOpenGroups: openGroupsIds,
    activeClosedGroups: onlyValidClosedGroup,
  });
};
