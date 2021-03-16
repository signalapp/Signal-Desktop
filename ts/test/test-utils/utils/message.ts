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
  members?: Array<string>;
  type: 'private' | 'group' | 'public';
  isMediumGroup?: boolean;
}

export class MockConversation {
  public id: string;
  public type: 'private' | 'group' | 'public';
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
      type: params.type === 'public' ? 'group' : params.type,
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
    return this.type === 'private';
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
