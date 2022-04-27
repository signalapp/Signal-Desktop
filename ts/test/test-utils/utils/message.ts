import { v4 as uuid } from 'uuid';
import { generateFakePubKey, generateFakePubKeys } from './pubkey';
import { ClosedGroupVisibleMessage } from '../../../session/messages/outgoing/visibleMessage/ClosedGroupVisibleMessage';
import { ConversationAttributes, ConversationTypeEnum } from '../../../models/conversation';
import { VisibleMessage } from '../../../session/messages/outgoing/visibleMessage/VisibleMessage';
import { openGroupPrefixRegex } from '../../../session/apis/open_group_api/utils/OpenGroupUtils';
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
  return { roomId: 'main', serverUrl: 'http://116.203.70.33' };
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

interface MockConversationParams {
  id?: string;
  members?: Array<string>;
  type: ConversationTypeEnum;
  isMediumGroup?: boolean;
}

export class MockConversation {
  public id: string;
  public type: ConversationTypeEnum;
  public attributes: ConversationAttributes;

  constructor(params: MockConversationParams) {
    this.id = params.id ?? generateFakePubKey().key;

    const members = params.isMediumGroup
      ? params.members ?? generateFakePubKeys(10).map(m => m.key)
      : [];

    this.type = params.type;

    this.attributes = {
      id: this.id,
      name: '',
      profileName: undefined,
      type: params.type === ConversationTypeEnum.GROUP ? 'group' : params.type,
      members,
      left: false,
      expireTimer: 0,
      mentionedUs: false,
      unreadCount: 5,
      isKickedFromGroup: false,
      active_at: Date.now(),
      lastJoinedTimestamp: Date.now(),
      lastMessageStatus: undefined,
      lastMessage: null,
      zombies: [],
      triggerNotificationsFor: 'all',
      isTrustedForAttachmentDownload: false,
      isPinned: false,
      isApproved: false,
      didApproveMe: false,
    };
  }

  public isPrivate() {
    return this.type === ConversationTypeEnum.PRIVATE;
  }

  public isBlocked() {
    return false;
  }

  public isPublic() {
    return this.id.match(openGroupPrefixRegex);
  }

  public isMediumGroup() {
    return this.type === 'group';
  }

  public get(obj: string) {
    return (this.attributes as any)[obj];
  }
}
