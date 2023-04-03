import { v4 as uuid } from 'uuid';
import { generateFakePubKey } from './pubkey';
import { ClosedGroupVisibleMessage } from '../../../session/messages/outgoing/visibleMessage/ClosedGroupVisibleMessage';
import { VisibleMessage } from '../../../session/messages/outgoing/visibleMessage/VisibleMessage';
import { OpenGroupMessageV2 } from '../../../session/apis/open_group_api/opengroupV2/OpenGroupMessageV2';
import { TestUtils } from '..';
import { OpenGroupRequestCommonType } from '../../../session/apis/open_group_api/opengroupV2/ApiUtil';
import { OpenGroupVisibleMessage } from '../../../session/messages/outgoing/visibleMessage/OpenGroupVisibleMessage';
import { MessageModel } from '../../../models/message';
import {
  OpenGroupMessageV4,
  OpenGroupReactionMessageV4,
} from '../../../session/apis/open_group_api/opengroupV2/OpenGroupServerPoller';
import { OpenGroupReaction } from '../../../types/Reaction';

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
    expireTimer: undefined,
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
  // tslint:disable-next-line: no-http-string
  return { roomId: 'main', serverUrl: 'http://open.getsession.org' };
}

export function generateClosedGroupMessage(
  groupId?: string,
  timestamp?: number
): ClosedGroupVisibleMessage {
  return new ClosedGroupVisibleMessage({
    identifier: uuid(),
    groupId: groupId ?? generateFakePubKey().key,
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
