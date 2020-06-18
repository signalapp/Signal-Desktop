import {
  ChatMessage,
  ClosedGroupChatMessage,
  OpenGroupMessage,
} from '../../../session/messages/outgoing';
import { v4 as uuid } from 'uuid';
import { OpenGroup } from '../../../session/types';
import { generateFakePubKey } from './pubkey';

export function generateChatMessage(): ChatMessage {
  return new ChatMessage({
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit',
    identifier: uuid(),
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
