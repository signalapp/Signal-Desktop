import * as React from 'react';
import { groupBy, mapValues, orderBy } from 'lodash';
import classNames from 'classnames';
import { Avatar, Props as AvatarProps } from '../Avatar';
import { Emoji } from '../emoji/Emoji';
import { useRestoreFocus } from '../hooks';

export type Reaction = {
  emoji: string;
  timestamp: number;
  from: {
    id: string;
    color?: string;
    profileName?: string;
    name?: string;
    isMe?: boolean;
    avatarPath?: string;
  };
};

export type OwnProps = {
  reactions: Array<Reaction>;
  onClose?: () => unknown;
};

export type Props = OwnProps &
  Pick<React.HTMLProps<HTMLDivElement>, 'style'> &
  Pick<AvatarProps, 'i18n'>;

const emojis = ['❤️', '👍', '👎', '😂', '😮', '😢', '😡'];

export const ReactionViewer = React.forwardRef<HTMLDivElement, Props>(
  ({ i18n, reactions, onClose, ...rest }, ref) => {
    const grouped = mapValues(groupBy(reactions, 'emoji'), res =>
      orderBy(res, ['timestamp'], ['desc'])
    );
    const filtered = emojis.filter(e => Boolean(grouped[e]));
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

    return (
      <div {...rest} ref={ref} className="module-reaction-viewer">
        <header className="module-reaction-viewer__header">
          {emojis
            .filter(e => Boolean(grouped[e]))
            .map((e, index) => {
              const re = grouped[e];
              const maybeFocusRef = index === 0 ? focusRef : undefined;

              return (
                <button
                  key={e}
                  ref={maybeFocusRef}
                  className={classNames(
                    'module-reaction-viewer__header__button',
                    selected === e
                      ? 'module-reaction-viewer__header__button--selected'
                      : null
                  )}
                  onClick={() => {
                    setSelected(e);
                  }}
                >
                  <Emoji size={18} emoji={e} />
                  <span className="module-reaction-viewer__header__button__count">
                    {re.length}
                  </span>
                </button>
              );
            })}
        </header>
        <main className="module-reaction-viewer__body">
          {grouped[selected].map(re => (
            <div
              key={`${re.from.id}-${re.emoji}`}
              className="module-reaction-viewer__body__row"
            >
              <div className="module-reaction-viewer__body__row__avatar">
                <Avatar
                  avatarPath={re.from.avatarPath}
                  conversationType="direct"
                  size={32}
                  i18n={i18n}
                />
              </div>
              <span className="module-reaction-viewer__body__row__name">
                {re.from.name || re.from.profileName}
              </span>
            </div>
          ))}
        </main>
      </div>
    );
  }
);
