import * as React from 'react';
import classNames from 'classnames';
import { Emoji } from '../emoji/Emoji';
import { useRestoreFocus } from '../hooks';

export type OwnProps = {
  selected?: string;
  onClose?: () => unknown;
  onPick: (emoji: string) => unknown;
};

export type Props = OwnProps & Pick<React.HTMLProps<HTMLDivElement>, 'style'>;

const emojis = ['❤️', '👍', '👎', '😂', '😮', '😢', '😡'];

export const ReactionPicker = React.forwardRef<HTMLDivElement, Props>(
  ({ selected, onClose, onPick, ...rest }, ref) => {
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
      <div {...rest} ref={ref} className="module-reaction-picker">
        {emojis.map((emoji, index) => {
          const maybeFocusRef = index === 0 ? focusRef : undefined;

          return (
            <button
              key={emoji}
              ref={maybeFocusRef}
              tabIndex={0}
              className={classNames(
                'module-reaction-picker__emoji-btn',
                emoji === selected
                  ? 'module-reaction-picker__emoji-btn--selected'
                  : null
              )}
              onClick={e => {
                e.stopPropagation();
                onPick(emoji);
              }}
            >
              <div className="module-reaction-picker__emoji-btn__emoji">
                <Emoji size={48} emoji={emoji} />
              </div>
            </button>
          );
        })}
      </div>
    );
  }
);
