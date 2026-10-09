// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { MuteExpiration } from '@signalapp/types';

import type { ConversationSourceType } from '../../externalClient/conversationDto.std.ts';
import {
  isListedConversation,
  toConversationDTO,
} from '../../externalClient/conversationDto.std.ts';

const base: ConversationSourceType = {
  id: 'conversation-1',
  type: 'direct',
  title: 'Alice',
  activeAt: 100,
  isMe: false,
  acceptedMessageRequest: true,
};

describe('externalClient/conversationDto', () => {
  it('lists active or pinned conversations, like the left pane', () => {
    assert.isTrue(isListedConversation(base));
    assert.isFalse(isListedConversation({ ...base, activeAt: undefined }));
    assert.isFalse(isListedConversation({ ...base, activeAt: 0 }));
    assert.isTrue(
      isListedConversation({ ...base, activeAt: 0, isPinned: true })
    );
  });

  it('maps only allow-listed fields with safe defaults', () => {
    const extra = {
      ...base,
      e164: '+15555550100',
      profileKey: 'secret',
      serviceId: 'aci',
    } as ConversationSourceType;
    assert.deepEqual(toConversationDTO(extra), {
      id: 'conversation-1',
      type: 'direct',
      title: 'Alice',
      unreadCount: 0,
      unreadMentionsCount: 0,
      markedUnread: false,
      lastActivityAt: null,
      muted: false,
      archived: false,
      pinned: false,
      blocked: false,
      noteToSelf: false,
      messageRequestPending: false,
      memberCount: null,
    });
  });

  it('maps group and state fields', () => {
    const dto = toConversationDTO({
      ...base,
      type: 'group',
      membersCount: 5,
      unreadCount: 3,
      timestamp: 50,
      lastMessageReceivedAtMs: 60,
      muteExpiresAt: MuteExpiration.ALWAYS,
      isArchived: true,
      acceptedMessageRequest: false,
    });
    assert.strictEqual(dto.memberCount, 5);
    assert.strictEqual(dto.unreadCount, 3);
    assert.strictEqual(dto.lastActivityAt, 60);
    assert.isTrue(dto.muted);
    assert.isTrue(dto.archived);
    assert.isTrue(dto.messageRequestPending);
  });
});
