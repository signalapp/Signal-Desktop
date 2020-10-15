import * as React from 'react';
import { groupBy, mapValues, orderBy } from 'lodash';
import classNames from 'classnames';
import { ContactName } from './ContactName';
import { Avatar, Props as AvatarProps } from '../Avatar';
import { Emoji } from '../emoji/Emoji';
import { useRestoreFocus } from '../../util/hooks';
import { ColorType } from '../../types/Colors';
import { emojiToData, EmojiData } from '../emoji/lib';

export type Reaction = {
  emoji: string;
  timestamp: number;
  from: {
    id: string;
    color?: ColorType;
    avatarPath?: string;
    name?: string;
    profileName?: string;
    title: string;
    isMe?: boolean;
    phoneNumber?: string;
  };
};

export type OwnProps = {
  reactions: Array<Reaction>;
  pickedReaction?: string;
  onClose?: () => unknown;
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

interface ReactionCategory {
  count: number;
  emoji?: string;
  id: string;
  index: number;
}

type ReactionWithEmojiData = Reaction & EmojiData;

export const ReactionViewer = React.forwardRef<HTMLDivElement, Props>(
  ({ i18n, reactions, onClose, pickedReaction, ...rest }, ref) => {
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

    const [
      selectedReactionCategory,
      setSelectedReactionCategory,
    ] = React.useState(pickedReaction || 'all');
    const focusRef = React.useRef<HTMLButtonElement>(null);

    // Handle escape key
    React.useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (onClose && e.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('keydown', handler);

      return () => {
        document.removeEventListener('keydown', handler);
      };
    }, [onClose]);

    // Focus first button and restore focus on unmount
    useRestoreFocus(focusRef);

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
              >
                {isAll ? (
                  <span className="module-reaction-viewer__header__button__all">
                    {i18n('ReactionsViewer--all')}&thinsp;&middot;&thinsp;
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
                  avatarPath={from.avatarPath}
                  conversationType="direct"
                  size={32}
                  color={from.color}
                  name={from.name}
                  profileName={from.profileName}
                  phoneNumber={from.phoneNumber}
                  title={from.title}
                  i18n={i18n}
                />
              </div>
              <div className="module-reaction-viewer__body__row__name">
                {from.isMe ? (
                  i18n('you')
                ) : (
                  <ContactName
                    module="module-reaction-viewer__body__row__name__contact-name"
                    name={from.name}
                    profileName={from.profileName}
                    phoneNumber={from.phoneNumber}
                    title={from.title}
                    i18n={i18n}
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
