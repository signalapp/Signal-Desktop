import { v4 as uuid } from 'uuid';
import { generateFakePubKey } from './pubkey';
import { ClosedGroupVisibleMessage } from '../../../session/messages/outgoing/visibleMessage/ClosedGroupVisibleMessage';
import { VisibleMessage } from '../../../session/messages/outgoing/visibleMessage/VisibleMessage';
import { OpenGroupMessageV2 } from '../../../session/apis/open_group_api/opengroupV2/OpenGroupMessageV2';
import { TestUtils } from '..';
import { OpenGroupRequestCommonType } from '../../../session/apis/open_group_api/opengroupV2/ApiUtil';
import { OpenGroupVisibleMessage } from '../../../session/messages/outgoing/visibleMessage/OpenGroupVisibleMessage';
import { MessageModel } from '../../../models/message';

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

export function generateOpenGroupVisibleMessage(): OpenGroupVisibleMessage {
  return new OpenGroupVisibleMessage({
    timestamp: Date.now(),
  });
}

export function generateOpenGroupV2RoomInfos(): OpenGroupRequestCommonType {
  // tslint:disable-next-line: no-http-string
  return { roomId: 'main', serverUrl: 'http://open.getsession.org' };
}

export function generateClosedGroupMessage(groupId?: string): ClosedGroupVisibleMessage {
  return new ClosedGroupVisibleMessage({
    identifier: uuid(),
    groupId: groupId ?? generateFakePubKey().key,
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
