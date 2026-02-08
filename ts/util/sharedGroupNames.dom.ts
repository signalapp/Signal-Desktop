// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from 'react';
import { useStore } from 'react-redux';
import type { StateType } from '../state/reducer.preload.js';
import type { ConversationType } from '../state/ducks/conversations.preload.js';
import {
  getConversationLookup,
  getAllComposableConversations,
} from '../state/selectors/conversations.dom.js';

const EMPTY_ARRAY: ReadonlyArray<string> = [];

function getServiceIdForConversation(
  state: StateType,
  conversationId: string
): string | null {
  const conversation = getConversationLookup(state)[conversationId];
  if (!conversation || conversation.type !== 'direct') {
    return null;
  }
  return conversation.serviceId ?? null;
}

function findSharedGroups(
  allConversations: ReadonlyArray<ConversationType>,
  serviceId: string
): ReadonlyArray<ConversationType> {
  return allConversations.filter(
    conv =>
      conv.type === 'group' && conv.memberships?.some(m => m.aci === serviceId)
  );
}

/**
 * Returns shared group names sorted by recency.
 */
export function getSharedGroupNames(
  state: StateType,
  conversationId: string
): ReadonlyArray<string> {
  const serviceId = getServiceIdForConversation(state, conversationId);
  if (!serviceId) {
    return EMPTY_ARRAY;
  }

  const groups = findSharedGroups(
    getAllComposableConversations(state),
    serviceId
  );
  if (groups.length === 0) {
    return EMPTY_ARRAY;
  }

  return [...groups]
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    .map(g => g.title ?? '');
}

/**
 * Type for the selector function. Exported so smart components can pass
 * the selector down to presentational components that need shared group
 * names but don't have direct Redux access.
 */
export type GetSharedGroupNamesType = typeof getSharedGroupNames;

/**
 * React hook that fetches shared group names ONCE on mount.
 * Does not subscribe to Redux - value is stale after mount.
 * Use for performance when live updates aren't needed.
 *
 * @param conversationId - The conversation to get shared groups for
 * @param getSharedGroupNamesFn - Passed from smart components via props;
 *   allows presentational components to use this selector without Redux access
 */
export function useSharedGroupNamesOnMount(
  conversationId: string,
  getSharedGroupNamesFn?: GetSharedGroupNamesType
): ReadonlyArray<string> {
  const store = useStore<StateType>();
  const [names] = useState(() => {
    const selector = getSharedGroupNamesFn ?? getSharedGroupNames;
    return selector(store.getState(), conversationId);
  });
  return names;
}
