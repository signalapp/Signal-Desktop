// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import lodash from 'lodash';
import classNames from 'classnames';
import { ContactName } from './ContactName.dom.js';
import type { Props as AvatarProps } from '../Avatar.dom.js';
import { Avatar } from '../Avatar.dom.js';
import { useRestoreFocus } from '../../hooks/useRestoreFocus.dom.js';
import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges.preload.js';
import { useEscapeHandling } from '../../hooks/useEscapeHandling.dom.js';
import type { ThemeType } from '../../types/Util.std.js';
import type {
  EmojiParentKey,
  EmojiVariantKey,
} from '../fun/data/emojis.std.js';
import {
  EMOJI_PARENT_KEY_CONSTANTS,
  getEmojiParentKeyByVariantKey,
  getEmojiVariantByKey,
  getEmojiVariantKeyByValue,
  isEmojiVariantValue,
} from '../fun/data/emojis.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { FunStaticEmoji } from '../fun/FunEmoji.dom.js';
import { useFunEmojiLocalizer } from '../fun/useFunEmojiLocalizer.dom.js';

const { mapValues, orderBy } = lodash;

export type Reaction = {
  emoji: string;
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
    | 'sharedGroupNames'
    | 'title'
  >;
};

export type OwnProps = {
  getPreferredBadge: PreferredBadgeSelectorType;
  reactions: Array<Reaction>;
  pickedReaction?: string;
  onClose?: () => unknown;
  theme: ThemeType;
};

export type Props = OwnProps &
  Pick<React.HTMLProps<HTMLDivElement>, 'style'> &
  Pick<AvatarProps, 'i18n'>;

const DEFAULT_EMOJI_ORDER = [
  EMOJI_PARENT_KEY_CONSTANTS.RED_HEART,
  EMOJI_PARENT_KEY_CONSTANTS.THUMBS_UP,
  EMOJI_PARENT_KEY_CONSTANTS.THUMBS_DOWN,
  EMOJI_PARENT_KEY_CONSTANTS.FACE_WITH_TEARS_OF_JOY,
  EMOJI_PARENT_KEY_CONSTANTS.FACE_WITH_OPEN_MOUTH,
  EMOJI_PARENT_KEY_CONSTANTS.CRYING_FACE,
  EMOJI_PARENT_KEY_CONSTANTS.ENRAGED_FACE,
];

type ReactionCategory = {
  count: number;
  emoji?: string;
  id: string;
  index: number;
};

type ReactionWithEmojiData = Reaction &
  Readonly<{
    parentKey: EmojiParentKey;
    variantKey: EmojiVariantKey;
  }>;

function ReactionViewerEmoji(props: {
  emojiVariantValue: string | undefined;
}): JSX.Element {
  const emojiLocalizer = useFunEmojiLocalizer();
  strictAssert(props.emojiVariantValue != null, 'Expected an emoji');
  strictAssert(
    isEmojiVariantValue(props.emojiVariantValue),
    'Must be valid emoji variant value'
  );
  const emojiVariantKey = getEmojiVariantKeyByValue(props.emojiVariantValue);
  const emojiVariant = getEmojiVariantByKey(emojiVariantKey);
  return (
    <FunStaticEmoji
      role="img"
      aria-label={emojiLocalizer.getLocaleShortName(emojiVariantKey)}
      size={18}
      emoji={emojiVariant}
    />
  );
}

export const ReactionViewer = React.forwardRef<HTMLDivElement, Props>(
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
    const reactionsWithEmojiData = React.useMemo(
      () =>
        reactions
          .map(reaction => {
            if (!isEmojiVariantValue(reaction.emoji)) {
              return null;
            }
            const variantKey = getEmojiVariantKeyByValue(reaction.emoji);
            const parentKey = getEmojiParentKeyByVariantKey(variantKey);
            return { ...reaction, parentKey, variantKey };
          })
          .filter((data): data is ReactionWithEmojiData => {
            return data != null;
          }),
      [reactions]
    );

    const groupedAndSortedReactions = React.useMemo(() => {
      const groups = Object.groupBy(reactionsWithEmojiData, data => {
        return data.parentKey;
      });

      return mapValues(
        {
          all: reactionsWithEmojiData,
          ...groups,
        },
        groupedReactions => orderBy(groupedReactions, ['timestamp'], ['desc'])
      );
    }, [reactionsWithEmojiData]);

    const reactionCategories: Array<ReactionCategory> = React.useMemo(
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
              return {
                id: firstReaction.parentKey,
                index: DEFAULT_EMOJI_ORDER.includes(firstReaction.parentKey)
                  ? DEFAULT_EMOJI_ORDER.indexOf(firstReaction.parentKey)
                  : Infinity,
                emoji: firstReaction.emoji,
                count: groupedReactions.length,
              };
            }),
        ].sort((a, b) => a.index - b.index),
      [reactionsWithEmojiData, groupedAndSortedReactions]
    );

    const [selectedReactionCategory, setSelectedReactionCategory] =
      React.useState(pickedReaction || 'all');

    // Handle escape key
    useEscapeHandling(onClose);

    // Focus first button and restore focus on unmount
    const [focusRef] = useRestoreFocus();

    // If we have previously selected a reaction type that is no longer present
    // (removed on another device, for instance) we should select another
    // reaction type
    React.useEffect(() => {
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
                    <ReactionViewerEmoji emojiVariantValue={emoji} />
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
                  sharedGroupNames={from.sharedGroupNames}
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
                <ReactionViewerEmoji emojiVariantValue={emoji} />
              </div>
            </div>
          ))}
        </main>
      </div>
    );
  }
);
