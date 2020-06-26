import {
  ChatMessage,
  ClosedGroupChatMessage,
  OpenGroupMessage,
} from '../../../session/messages/outgoing';
import { v4 as uuid } from 'uuid';
import { OpenGroup } from '../../../session/types';
import { generateFakePubKey } from './pubkey';
import { ConversationAttributes } from '../../../../js/models/conversation';

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

interface MockPrivateConversationParams {
  id?: string;
  isPrimary: boolean;
}

export class MockPrivateConversation {
  public id: string;
  public isPrimary: boolean;
  public attributes: ConversationAttributes;

  constructor(params: MockPrivateConversationParams) {
    const dayInSeconds = 86400;

    this.isPrimary = params.isPrimary;
    this.id = params.id ?? generateFakePubKey().key;

    this.attributes = {
      members: [],
      left: false,
      expireTimer: dayInSeconds,
      profileSharing: true,
      mentionedUs: false,
      unreadCount: 99,
      isArchived: false,
      active_at: Date.now(),
      timestamp: Date.now(),
      secondaryStatus: !this.isPrimary,
    };
  }

  public isPrivate() {
    return true;
  }

  public isOurLocalDevice() {
    return false;
  }

  public isBlocked() {
    return false;
  }

  public getPrimaryDevicePubKey() {
    return this.isPrimary ? this.id : generateFakePubKey().key;
  }
}
