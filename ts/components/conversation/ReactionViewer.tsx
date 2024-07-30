// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { groupBy, mapValues, orderBy } from 'lodash';
import classNames from 'classnames';
import { ContactName } from './ContactName';
import type { Props as AvatarProps } from '../Avatar';
import { Avatar } from '../Avatar';
import { Emoji } from '../emoji/Emoji';
import { useRestoreFocus } from '../../hooks/useRestoreFocus';
import type { ConversationType } from '../../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges';
import type { EmojiData } from '../emoji/lib';
import { emojiToData } from '../emoji/lib';
import { useEscapeHandling } from '../../hooks/useEscapeHandling';
import type { ThemeType } from '../../types/Util';

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
  'heart',
  '+1',
  '-1',
  'joy',
  'open_mouth',
  'cry',
  'rage',
];

type ReactionCategory = {
  count: number;
  emoji?: string;
  id: string;
  index: number;
};

type ReactionWithEmojiData = Reaction & EmojiData;

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
            const emojiData = emojiToData(reaction.emoji);

            if (!emojiData) {
              return undefined;
            }

            return {
              ...reaction,
              ...emojiData,
            };
          })
          .filter(
            (
              reactionWithEmojiData
            ): reactionWithEmojiData is ReactionWithEmojiData =>
              Boolean(reactionWithEmojiData)
          ),
      [reactions]
    );

    const groupedAndSortedReactions = React.useMemo(
      () =>
        mapValues(
          {
            all: reactionsWithEmojiData,
            ...groupBy(reactionsWithEmojiData, 'short_name'),
          },
          groupedReactions => orderBy(groupedReactions, ['timestamp'], ['desc'])
        ),
      [reactionsWithEmojiData]
    );

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
            .map(([, [{ short_name: id, emoji }, ...otherReactions]]) => {
              return {
                id,
                index: DEFAULT_EMOJI_ORDER.includes(id)
                  ? DEFAULT_EMOJI_ORDER.indexOf(id)
                  : Infinity,
                emoji,
                count: otherReactions.length + 1,
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
                    <Emoji size={18} emoji={emoji} />
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
                  acceptedMessageRequest={from.acceptedMessageRequest}
                  avatarUrl={from.avatarUrl}
                  badge={getPreferredBadge(from.badges)}
                  conversationType="direct"
                  sharedGroupNames={from.sharedGroupNames}
                  size={32}
                  isMe={from.isMe}
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
                <Emoji size={18} emoji={emoji} />
              </div>
            </div>
          ))}
        </main>
      </div>
    );
  }
);
