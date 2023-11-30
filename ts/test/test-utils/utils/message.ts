import { isEmpty } from 'lodash';
import { v4 as uuid } from 'uuid';
import { TestUtils } from '..';
import { MessageModel } from '../../../models/message';
import { OpenGroupRequestCommonType } from '../../../session/apis/open_group_api/opengroupV2/ApiUtil';
import { OpenGroupMessageV2 } from '../../../session/apis/open_group_api/opengroupV2/OpenGroupMessageV2';
import {
  OpenGroupMessageV4,
  OpenGroupReactionMessageV4,
} from '../../../session/apis/open_group_api/opengroupV2/OpenGroupServerPoller';
import {
  DisappearingMessageType,
  ExpirationTimerUpdate,
} from '../../../session/disappearing_messages/types';
import { ExpirationTimerUpdateMessage } from '../../../session/messages/outgoing/controlMessage/ExpirationTimerUpdateMessage';
import { ClosedGroupVisibleMessage } from '../../../session/messages/outgoing/visibleMessage/ClosedGroupVisibleMessage';
import { OpenGroupVisibleMessage } from '../../../session/messages/outgoing/visibleMessage/OpenGroupVisibleMessage';
import { VisibleMessage } from '../../../session/messages/outgoing/visibleMessage/VisibleMessage';
import { PubKey } from '../../../session/types';
import { OpenGroupReaction } from '../../../types/Reaction';
import { generateFakePubKey } from './pubkey';

export function generateVisibleMessage({
  identifier,
  timestamp,
}: {
  identifier?: string;
  timestamp?: number;
} = {}): VisibleMessage {
  return new VisibleMessage({
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit',
    identifier: identifier ?? uuid(),
    timestamp: timestamp || Date.now(),
    attachments: undefined,
    quote: undefined,
    expirationType: null,
    expireTimer: null,
    lokiProfile: undefined,
    preview: undefined,
  });
}

export function generateOpenGroupMessageV2(): OpenGroupMessageV2 {
  return new OpenGroupMessageV2({
    sentTimestamp: Date.now(),
    sender: TestUtils.generateFakePubKey().key,
    base64EncodedData: 'whatever',
  });
}
export function generateOpenGroupMessageV4(): OpenGroupMessageV4 {
  return {
    posted: Date.now(),
    reactions: {},
    seqno: 0,
    session_id: TestUtils.generateFakePubKey().key,

    id: Math.floor(Math.random() * 100000),
    data: 'whatever',
  };
}

// this is for test purposes only
type OpenGroupMessageV2WithServerId = Omit<OpenGroupMessageV2, 'sender' | 'serverId'> & {
  sender: string;
  serverId: number;
};

export function generateOpenGroupMessageV2WithServerId(
  serverId: number
): OpenGroupMessageV2WithServerId {
  return new OpenGroupMessageV2({
    serverId,
    sentTimestamp: Date.now(),
    sender: TestUtils.generateFakePubKey().key,
    base64EncodedData: 'whatever',
  }) as OpenGroupMessageV2WithServerId;
}

export function generateOpenGroupVisibleMessage(): OpenGroupVisibleMessage {
  return new OpenGroupVisibleMessage({
    timestamp: Date.now(),
  });
}

export function generateOpenGroupV2RoomInfos(): OpenGroupRequestCommonType {
  return { roomId: 'main', serverUrl: 'http://open.getsession.org' };
}

export function generateClosedGroupMessage(
  groupId?: string,
  timestamp?: number
): ClosedGroupVisibleMessage {
  return new ClosedGroupVisibleMessage({
    identifier: uuid(),
    groupId: groupId ? PubKey.cast(groupId) : generateFakePubKey(),
    timestamp: timestamp || Date.now(),
    chatMessage: generateVisibleMessage(),
  });
}

export function generateFakeIncomingPrivateMessage(): MessageModel {
  const convoId = TestUtils.generateFakePubKeyStr();
  return new MessageModel({
    conversationId: convoId,
    source: convoId,
    type: 'incoming',
  });
}

export function generateFakeOutgoingPrivateMessage(pubkey?: string): MessageModel {
  const convoId = pubkey || TestUtils.generateFakePubKeyStr();
  return new MessageModel({
    conversationId: convoId,
    source: convoId,
    type: 'outgoing',
  });
}

export function generateFakeIncomingOpenGroupMessageV4({
  id,
  reactions,
  seqno,
}: {
  id: number;
  seqno?: number;
  reactions?: Record<string, OpenGroupReaction>;
}): OpenGroupMessageV4 | OpenGroupReactionMessageV4 {
  return {
    id, // serverId
    seqno: seqno ?? undefined,
    /** base64 */
    signature: 'whatever',
    /** timestamp number with decimal */
    posted: Date.now(),
    reactions: reactions ?? {},
  };
}

export function generateDisappearingVisibleMessage({
  identifier,
  timestamp,
  expirationType,
  expireTimer,
  expirationTimerUpdate,
}: {
  identifier?: string;
  timestamp?: number;
  expirationType?: DisappearingMessageType;
  expireTimer?: number;
  expirationTimerUpdate?: ExpirationTimerUpdate;
} = {}): ExpirationTimerUpdateMessage | VisibleMessage {
  if (!isEmpty(expirationTimerUpdate)) {
    return new ExpirationTimerUpdateMessage({
      identifier: identifier ?? uuid(),
      timestamp: timestamp || Date.now(),
      expirationType: expirationTimerUpdate.expirationType || null,
      expireTimer: expirationTimerUpdate.expireTimer,
    });
  }

  return new VisibleMessage({
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit',
    identifier: identifier ?? uuid(),
    timestamp: timestamp || Date.now(),
    attachments: undefined,
    quote: undefined,
    expirationType: expirationType ?? null,
    expireTimer: expireTimer ?? null,
    lokiProfile: undefined,
    preview: undefined,
  });
}

export function generateFakeExpirationTimerUpdate({
  expirationType,
  expireTimer,
  source = '',
}: {
  expirationType: DisappearingMessageType;
  expireTimer: number;
  source?: string;
}): MessageModel {
  const convoId = TestUtils.generateFakePubKeyStr();
  return new MessageModel({
    conversationId: convoId,
    source: convoId,
    type: 'incoming',
    expirationType,
    expireTimer,
    expirationTimerUpdate: {
      expirationType,
      expireTimer,
      source,
    },
    flags: 2,
  });
}
