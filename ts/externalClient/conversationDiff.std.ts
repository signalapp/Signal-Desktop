// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ConversationSourceType } from './conversationDto.std.ts';
import {
  isListedConversation,
  toConversationDTO,
} from './conversationDto.std.ts';
import type { ConversationDTO } from './protocol.std.ts';

// Turns successive versions of Signal's conversation lookup into public
// events. Redux replaces a conversation object whenever it changes, so
// unchanged entries are skipped by reference; changed ones are compared by
// their DTO, so internal changes clients cannot see produce no event.

export type ConversationChangeType =
  | Readonly<{ type: 'updated'; conversation: ConversationDTO }>
  | Readonly<{ type: 'removed'; conversationId: string }>;

type LookupType = Readonly<Record<string, ConversationSourceType>>;

export class ConversationDiffer {
  #lookup: LookupType = {};
  // Serialized DTO of every conversation clients currently know as listed.
  #sent = new Map<string, string>();

  // Takes the current state as known to clients; produces no changes.
  reset(lookup: LookupType): void {
    this.#lookup = lookup;
    this.#sent = new Map();
    for (const conversation of Object.values(lookup)) {
      if (isListedConversation(conversation)) {
        this.#sent.set(
          conversation.id,
          JSON.stringify(toConversationDTO(conversation))
        );
      }
    }
  }

  diff(lookup: LookupType): Array<ConversationChangeType> {
    const previous = this.#lookup;
    if (lookup === previous) {
      return [];
    }
    this.#lookup = lookup;

    const changes = new Array<ConversationChangeType>();
    for (const [id, conversation] of Object.entries(lookup)) {
      if (previous[id] === conversation) {
        continue;
      }
      if (isListedConversation(conversation)) {
        const dto = toConversationDTO(conversation);
        const serialized = JSON.stringify(dto);
        if (this.#sent.get(id) !== serialized) {
          this.#sent.set(id, serialized);
          changes.push({ type: 'updated', conversation: dto });
        }
      } else if (this.#sent.delete(id)) {
        changes.push({ type: 'removed', conversationId: id });
      }
    }
    for (const id of this.#sent.keys()) {
      if (!Object.hasOwn(lookup, id)) {
        this.#sent.delete(id);
        changes.push({ type: 'removed', conversationId: id });
      }
    }
    return changes;
  }
}
