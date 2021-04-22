import { v4 as uuid } from 'uuid';
import { generateFakePubKey, generateFakePubKeys } from './pubkey';
import { ClosedGroupVisibleMessage } from '../../../session/messages/outgoing/visibleMessage/ClosedGroupVisibleMessage';
import { ConversationAttributes, ConversationType } from '../../../models/conversation';
import { OpenGroupMessage } from '../../../session/messages/outgoing';
import { VisibleMessage } from '../../../session/messages/outgoing/visibleMessage/VisibleMessage';
import { OpenGroup } from '../../../opengroup/opengroupV1/OpenGroup';

export function generateVisibleMessage(identifier?: string): VisibleMessage {
  return new VisibleMessage({
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit',
    identifier: identifier ?? uuid(),
    timestamp: Date.now(),
    attachments: undefined,
    quote: undefined,
    expireTimer: undefined,
    lokiProfile: undefined,
    preview: undefined,
  });
}

export function generateOpenGroupMessage(): OpenGroupMessage {
  const group = new OpenGroup({
    server: 'chat.example.server',
    channel: 0,
    conversationId: '0',
  });

  return new OpenGroupMessage({
    timestamp: Date.now(),
    group,
    attachments: undefined,
    preview: undefined,
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit',
    quote: undefined,
  });
}

export function generateClosedGroupMessage(groupId?: string): ClosedGroupVisibleMessage {
  return new ClosedGroupVisibleMessage({
    identifier: uuid(),
    groupId: groupId ?? generateFakePubKey().key,
    chatMessage: generateVisibleMessage(),
  });
}

interface MockConversationParams {
  id?: string;
  members?: Array<string>;
  type: ConversationType;
  isMediumGroup?: boolean;
}

export class MockConversation {
  public id: string;
  public type: ConversationType;
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
      type: params.type === ConversationType.OPEN_GROUP ? 'group' : params.type,
      members,
      left: false,
      expireTimer: 0,
      mentionedUs: false,
      unreadCount: 5,
      isKickedFromGroup: false,
      active_at: Date.now(),
      lastJoinedTimestamp: Date.now(),
      lastMessageStatus: null,
      lastMessage: null,
    };
  }

  public isPrivate() {
    return this.type === ConversationType.PRIVATE;
  }

  public isBlocked() {
    return false;
  }

  public isPublic() {
    return this.id.match(/^publicChat:/);
  }

  public isMediumGroup() {
    return this.type === 'group';
  }

  public get(obj: string) {
    return (this.attributes as any)[obj];
  }
}
