// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  type HTMLProps,
  type JSX,
  forwardRef,
  useMemo,
  useState,
  useEffect,
} from 'react';
import lodash from 'lodash';
import classNames from 'classnames';
import { ContactName } from './ContactName.dom.tsx';
import type { Props as AvatarProps } from '../Avatar.dom.tsx';
import { Avatar } from '../Avatar.dom.tsx';
import { useRestoreFocus } from '../../hooks/useRestoreFocus.dom.ts';
import type { ConversationType } from '../../state/ducks/conversations.preload.ts';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges.preload.ts';
import { useEscapeHandling } from '../../hooks/useEscapeHandling.dom.ts';
import type { ThemeType } from '../../types/Util.std.ts';
import { strictAssert } from '../../util/assert.std.ts';
import { FunStaticEmoji } from '../fun/FunEmoji.dom.tsx';
import { Emoji } from '../../axo/emoji.std.ts';

const { mapValues, orderBy } = lodash;

export type Reaction = {
  emoji: Emoji.Variant;
  timestamp: number;
  from: Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarUrl'
    | 'badges'
    | 'color'
    | 'id'
    | 'isMe'
    | 'phoneNumber'
    | 'profileName'
    | 'title'
  >;
};

export type OwnProps = {
  getPreferredBadge: PreferredBadgeSelectorType;
  reactions: Array<Reaction>;
  pickedReaction?: Emoji.Variant;
  onClose?: () => unknown;
  theme: ThemeType;
};

export type Props = OwnProps &
  Pick<HTMLProps<HTMLDivElement>, 'style'> &
  Pick<AvatarProps, 'i18n'>;

const DEFAULT_EMOJI_ORDER = [
  Emoji.HEART,
  Emoji.THUMBS_UP,
  Emoji.THUMBS_DOWN,
  Emoji.JOY,
  Emoji.OPEN_MOUTH,
  Emoji.CRY,
  Emoji.RAGE,
];

type ReactionCategory = {
  count: number;
  emoji?: Emoji.Variant;
  id: string;
  index: number;
};

type ReactionWithEmojiData = Reaction &
  Readonly<{
    parent: Emoji.Parent;
    variant: Emoji.Variant;
  }>;

function ReactionViewerEmoji(props: {
  emoji: Emoji.Variant | null;
}): JSX.Element | null {
  strictAssert(props.emoji != null, 'Missing emoji');
  return (
    <FunStaticEmoji
      role="img"
      aria-label={Emoji.getDisplayLabel(props.emoji)}
      size={18}
      emoji={props.emoji}
    />
  );
}

export const ReactionViewer = forwardRef<HTMLDivElement, Props>(
  function ReactionViewerInner(
    {
      getPreferredBadge,
      i18n,
      onClose,
      pickedReaction,
      reactions,
      theme,
      ...rest
    },
    ref
  ) {
    const reactionsWithEmojiData = useMemo(
      () =>
        reactions
          .map((reaction): ReactionWithEmojiData | null => {
            const variant = reaction.emoji;
            const parent = Emoji.getParent(reaction.emoji);
            return { ...reaction, parent, variant };
          })
          .filter((data): data is ReactionWithEmojiData => {
            return data != null;
          }),
      [reactions]
    );

    const groupedAndSortedReactions = useMemo(() => {
      const groups = Object.groupBy(reactionsWithEmojiData, data => {
        return data.parent;
      });

      return mapValues(
        {
          all: reactionsWithEmojiData,
          ...groups,
        },
        groupedReactions => orderBy(groupedReactions, ['timestamp'], ['desc'])
      );
    }, [reactionsWithEmojiData]);

    const reactionCategories: Array<ReactionCategory> = useMemo(
      () =>
        [
          {
            id: 'all',
            index: 0,
            count: reactionsWithEmojiData.length,
          },
          ...Object.entries(groupedAndSortedReactions)
            .filter(([key]) => key !== 'all')
            .map(([, groupedReactions]) => {
              // Find the local user's reaction first, then fall back to most recent
              const localUserReaction = groupedReactions.find(r => r.from.isMe);
              const firstReaction = localUserReaction || groupedReactions[0];
              strictAssert(firstReaction, 'Missing firstReaction');
              return {
                id: firstReaction.parent,
                index: DEFAULT_EMOJI_ORDER.includes(firstReaction.parent)
                  ? DEFAULT_EMOJI_ORDER.indexOf(firstReaction.parent)
                  : Infinity,
                emoji: firstReaction.emoji,
                count: groupedReactions.length,
              };
            }),
        ].sort((a, b) => a.index - b.index),
      [reactionsWithEmojiData, groupedAndSortedReactions]
    );

    const [selectedReactionCategory, setSelectedReactionCategory] = useState(
      pickedReaction || 'all'
    );

    // Handle escape key
    useEscapeHandling(onClose);

    // Focus first button and restore focus on unmount
    const [focusRef] = useRestoreFocus();

    // If we have previously selected a reaction type that is no longer present
    // (removed on another device, for instance) we should select another
    // reaction type
    useEffect(() => {
      if (
        !reactionCategories.find(({ id }) => id === selectedReactionCategory)
      ) {
        if (reactionsWithEmojiData.length > 0) {
          setSelectedReactionCategory('all');
        } else if (onClose) {
          onClose();
        }
      }
    }, [
      reactionCategories,
      onClose,
      reactionsWithEmojiData,
      selectedReactionCategory,
    ]);

    const selectedReactions =
      groupedAndSortedReactions[selectedReactionCategory] || [];

    return (
      <div {...rest} ref={ref} className="module-reaction-viewer">
        <header className="module-reaction-viewer__header">
          {reactionCategories.map(({ id, emoji, count }, index) => {
            const isAll = index === 0;
            const maybeFocusRef = isAll ? focusRef : undefined;

            return (
              <button
                type="button"
                key={id}
                ref={maybeFocusRef}
                className={classNames(
                  'module-reaction-viewer__header__button',
                  selectedReactionCategory === id
                    ? 'module-reaction-viewer__header__button--selected'
                    : null
                )}
                onClick={event => {
                  event.stopPropagation();
                  setSelectedReactionCategory(id);
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === 'Space') {
                    event.stopPropagation();
                    event.preventDefault();
                    setSelectedReactionCategory(id);
                  }
                }}
              >
                {isAll ? (
                  <span className="module-reaction-viewer__header__button__all">
                    {i18n('icu:ReactionsViewer--all')}&thinsp;&middot;&thinsp;
                    {count}
                  </span>
                ) : (
                  <>
                    <ReactionViewerEmoji emoji={emoji ?? null} />
                    <span className="module-reaction-viewer__header__button__count">
                      {count}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </header>
        <main className="module-reaction-viewer__body">
          {selectedReactions.map(({ from, emoji }) => (
            <div
              key={`${from.id}-${emoji}`}
              className="module-reaction-viewer__body__row"
            >
              <div className="module-reaction-viewer__body__row__avatar">
                <Avatar
                  avatarUrl={from.avatarUrl}
                  badge={getPreferredBadge(from.badges)}
                  conversationType="direct"
                  size={32}
                  color={from.color}
                  profileName={from.profileName}
                  phoneNumber={from.phoneNumber}
                  theme={theme}
                  title={from.title}
                  i18n={i18n}
                />
              </div>
              <div className="module-reaction-viewer__body__row__name">
                {from.isMe ? (
                  i18n('icu:you')
                ) : (
                  <ContactName
                    module="module-reaction-viewer__body__row__name__contact-name"
                    title={from.title}
                  />
                )}
              </div>
              <div className="module-reaction-viewer__body__row__emoji">
                <ReactionViewerEmoji emoji={emoji} />
              </div>
            </div>
          ))}
        </main>
      </div>
    );
  }
);
