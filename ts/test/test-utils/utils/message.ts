import {
  ChatMessage,
  OpenGroupMessage,
} from '../../../session/messages/outgoing';
import { v4 as uuid } from 'uuid';
import { OpenGroup } from '../../../session/types';
import { generateFakePubKey, generateFakePubKeys } from './pubkey';
import { ClosedGroupChatMessage } from '../../../session/messages/outgoing/content/data/group/ClosedGroupChatMessage';
import { ConversationAttributes } from '../../../models/conversation';

export function generateChatMessage(identifier?: string): ChatMessage {
  return new ChatMessage({
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

export function generateClosedGroupMessage(
  groupId?: string
): ClosedGroupChatMessage {
  return new ClosedGroupChatMessage({
    identifier: uuid(),
    groupId: groupId ?? generateFakePubKey().key,
    chatMessage: generateChatMessage(),
  });
}

interface MockConversationParams {
  id?: string;
  type: MockConversationType;
  members?: Array<string>;
}

export enum MockConversationType {
  Primary = 'primary',
  Secondary = 'secondary',
  Group = 'group',
}

export class MockConversation {
  public id: string;
  public type: MockConversationType;
  public attributes: ConversationAttributes;
  public isPrimary?: boolean;

  constructor(params: MockConversationParams) {
    const dayInSeconds = 86400;

    this.type = params.type;
    this.id = params.id ?? generateFakePubKey().key;
    this.isPrimary = this.type === MockConversationType.Primary;

    const members =
      this.type === MockConversationType.Group
        ? params.members ?? generateFakePubKeys(10).map(m => m.key)
        : [];

    this.attributes = {
      id: this.id,
      name: '',
      type: '',
      members,
      left: false,
      expireTimer: dayInSeconds,
      profileSharing: true,
      mentionedUs: false,
      unreadCount: 99,
      active_at: Date.now(),
      lastJoinedTimestamp: Date.now(),
      lastMessageStatus: null,
    };
  }

  public isPrivate() {
    return true;
  }

  public isBlocked() {
    return false;
  }

  public get(obj: string) {
    return (this.attributes as any)[obj];
  }
}
