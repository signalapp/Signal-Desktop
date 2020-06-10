import * as React from 'react';
import { groupBy, mapValues, orderBy, sortBy } from 'lodash';
import classNames from 'classnames';
import { ContactName } from './ContactName';
import { Avatar, Props as AvatarProps } from '../Avatar';
import { Emoji } from '../emoji/Emoji';
import { useRestoreFocus } from '../../util/hooks';
import { ColorType } from '../../types/Util';

export type Reaction = {
  emoji: string;
  timestamp: number;
  from: {
    id: string;
    color?: ColorType;
    avatarPath?: string;
    name?: string;
    profileName?: string;
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

const emojisOrder = ['❤️', '👍', '👎', '😂', '😮', '😢', '😡'];

export const ReactionViewer = React.forwardRef<HTMLDivElement, Props>(
  // tslint:disable-next-line max-func-body-length
  ({ i18n, reactions, onClose, pickedReaction, ...rest }, ref) => {
    const grouped = mapValues(groupBy(reactions, 'emoji'), res =>
      orderBy(res, ['timestamp'], ['desc'])
    );
    const [selected, setSelected] = React.useState(pickedReaction || 'all');
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

    // Create sorted reaction categories, supporting reaction types we don't
    // explicitly know about yet
    const renderedEmojis = React.useMemo(() => {
      const emojiSet = new Set<string>();
      reactions.forEach(re => emojiSet.add(re.emoji));

      const arr = sortBy(Array.from(emojiSet), emoji => {
        const idx = emojisOrder.indexOf(emoji);
        if (idx > -1) {
          return idx;
        }

        return Infinity;
      });

      return ['all', ...arr];
    }, [reactions]);

    const allSorted = React.useMemo(() => {
      return orderBy(reactions, ['timestamp'], ['desc']);
    }, [reactions]);

    // If we have previously selected a reaction type that is no longer present
    // (removed on another device, for instance) we should select another
    // reaction type
    React.useEffect(() => {
      if (!grouped[selected]) {
        const toSelect = renderedEmojis[0];
        if (toSelect) {
          setSelected(toSelect);
        } else if (onClose) {
          // We have nothing to render!
          onClose();
        }
      }
    }, [grouped, onClose, renderedEmojis, selected, setSelected]);

    const selectedReactions = grouped[selected] || allSorted;

    return (
      <div {...rest} ref={ref} className="module-reaction-viewer">
        <header className="module-reaction-viewer__header">
          {renderedEmojis
            .filter(e => e === 'all' || Boolean(grouped[e]))
            .map((cat, index) => {
              const re = grouped[cat] || reactions;
              const maybeFocusRef = index === 0 ? focusRef : undefined;
              const isAll = cat === 'all';

              return (
                <button
                  key={cat}
                  ref={maybeFocusRef}
                  className={classNames(
                    'module-reaction-viewer__header__button',
                    selected === cat
                      ? 'module-reaction-viewer__header__button--selected'
                      : null
                  )}
                  onClick={event => {
                    event.stopPropagation();
                    setSelected(cat);
                  }}
                >
                  {isAll ? (
                    <span className="module-reaction-viewer__header__button__all">
                      {i18n('ReactionsViewer--all')}&thinsp;&middot;&thinsp;
                      {re.length}
                    </span>
                  ) : (
                    <>
                      <Emoji size={18} emoji={cat} />
                      <span className="module-reaction-viewer__header__button__count">
                        {re.length}
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
