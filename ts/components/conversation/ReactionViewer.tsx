import * as React from 'react';
import { groupBy, mapValues, orderBy, sortBy } from 'lodash';
import classNames from 'classnames';
import { ContactName } from './ContactName';
import { Avatar, Props as AvatarProps } from '../Avatar';
import { Emoji } from '../emoji/Emoji';
import { useRestoreFocus } from '../hooks';

export type Reaction = {
  emoji: string;
  timestamp: number;
  from: {
    id: string;
    color?: string;
    avatarPath?: string;
    name?: string;
    profileName?: string;
    isMe?: boolean;
    phoneNumber?: string;
  };
};

export type OwnProps = {
  reactions: Array<Reaction>;
  onClose?: () => unknown;
};

export type Props = OwnProps &
  Pick<React.HTMLProps<HTMLDivElement>, 'style'> &
  Pick<AvatarProps, 'i18n'>;

const emojisOrder = ['❤️', '👍', '👎', '😂', '😮', '😢', '😡'];

export const ReactionViewer = React.forwardRef<HTMLDivElement, Props>(
  // tslint:disable-next-line max-func-body-length
  ({ i18n, reactions, onClose, ...rest }, ref) => {
    const grouped = mapValues(groupBy(reactions, 'emoji'), res =>
      orderBy(res, ['timestamp'], ['desc'])
    );
    const filtered = emojisOrder.filter(e => Boolean(grouped[e]));
    const [selected, setSelected] = React.useState(filtered[0]);
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

      return sortBy(Array.from(emojiSet), emoji => {
        const idx = emojisOrder.indexOf(emoji);
        if (idx > -1) {
          return idx;
        }

        return Infinity;
      });
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

    const selectedReactions = grouped[selected] || [];

    return (
      <div {...rest} ref={ref} className="module-reaction-viewer">
        <header className="module-reaction-viewer__header">
          {renderedEmojis
            .filter(e => Boolean(grouped[e]))
            .map((emoji, index) => {
              const re = grouped[emoji];
              const maybeFocusRef = index === 0 ? focusRef : undefined;

              return (
                <button
                  key={emoji}
                  ref={maybeFocusRef}
                  className={classNames(
                    'module-reaction-viewer__header__button',
                    selected === emoji
                      ? 'module-reaction-viewer__header__button--selected'
                      : null
                  )}
                  onClick={event => {
                    event.stopPropagation();
                    setSelected(emoji);
                  }}
                >
                  <Emoji size={18} emoji={emoji} />
                  <span className="module-reaction-viewer__header__button__count">
                    {re.length}
                  </span>
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
                  name={from.name}
                  profileName={from.profileName}
                  phoneNumber={from.phoneNumber}
                  i18n={i18n}
                />
              </div>
              <ContactName
                module="module-reaction-viewer__body__row__name"
                i18n={i18n}
                name={from.name}
                profileName={from.profileName}
                phoneNumber={from.phoneNumber}
                isMe={from.isMe}
              />
            </div>
          ))}
        </main>
      </div>
    );
  }
);
