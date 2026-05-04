// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import { useMemo } from 'react';
// oxlint-disable-next-line signal-desktop/no-restricted-paths
import type { Reaction } from '../components/conversation/ReactionViewer.dom.tsx';
import { isNotNil } from './isNotNil.std.ts';
import { Emoji } from '../axo/emoji.std.ts';

const { groupBy, orderBy } = lodash;

type ReactionWithEmojiData = Reaction & {
  parent: Emoji.Parent;
  variant: Emoji.Variant;
};

export function useGroupedAndOrderedReactions(
  reactions: ReadonlyArray<Reaction> | undefined,
  groupByKey: 'variant' | 'parent'
): Array<Array<ReactionWithEmojiData>> {
  return useMemo(() => {
    if (!reactions || reactions.length === 0) {
      return [];
    }

    const reactionsWithEmojiData: Array<ReactionWithEmojiData> = reactions
      .map((reaction): ReactionWithEmojiData | undefined => {
        try {
          const variant = reaction.emoji;
          const parent = Emoji.getParent(variant);

          return {
            ...reaction,
            variant,
            parent,
          };
        } catch {
          return undefined;
        }
      })
      .filter(isNotNil);

    const groupedReactions = Object.values(
      groupBy(reactionsWithEmojiData, groupByKey)
    ).map(groupedReaction =>
      orderBy(
        groupedReaction,
        [reaction => reaction.from.isMe, 'timestamp'],
        ['desc', 'desc']
      )
    );

    return orderBy(
      groupedReactions,
      // oxlint-disable-next-line typescript/no-non-null-assertion
      ['length', ([first]) => first!.timestamp],
      ['desc', 'desc']
    );
  }, [reactions, groupByKey]);
}
