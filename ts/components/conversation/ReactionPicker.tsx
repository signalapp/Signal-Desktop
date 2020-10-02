import * as React from 'react';
import classNames from 'classnames';
import { Emoji } from '../emoji/Emoji';
import { convertShortName } from '../emoji/lib';
import { Props as EmojiPickerProps } from '../emoji/EmojiPicker';
import { useRestoreFocus } from '../../util/hooks';
import { LocalizerType } from '../../types/Util';

export type RenderEmojiPickerProps = Pick<Props, 'onClose' | 'style'> &
  Pick<EmojiPickerProps, 'onPickEmoji'> & {
    ref: React.Ref<HTMLDivElement>;
  };

export type OwnProps = {
  i18n: LocalizerType;
  selected?: string;
  onClose?: () => unknown;
  onPick: (emoji: string) => unknown;
  renderEmojiPicker: (props: RenderEmojiPickerProps) => React.ReactElement;
  skinTone: number;
};

export type Props = OwnProps & Pick<React.HTMLProps<HTMLDivElement>, 'style'>;

const DEFAULT_EMOJI_LIST = [
  'heart',
  'thumbsup',
  'thumbsdown',
  'joy',
  'open_mouth',
  'cry',
];

export const ReactionPicker = React.forwardRef<HTMLDivElement, Props>(
  (
    { i18n, selected, onClose, skinTone, onPick, renderEmojiPicker, style },
    ref
  ) => {
    const [pickingOther, setPickingOther] = React.useState(false);
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

    // Handle EmojiPicker::onPickEmoji
    const onPickEmoji: EmojiPickerProps['onPickEmoji'] = React.useCallback(
      ({ shortName, skinTone: pickedSkinTone }) => {
        onPick(convertShortName(shortName, pickedSkinTone));
      },
      [onPick]
    );

    const emojis = DEFAULT_EMOJI_LIST.map(shortName =>
      convertShortName(shortName, skinTone)
    );

    // Focus first button and restore focus on unmount
    useRestoreFocus(focusRef);

    const otherSelected = selected && !emojis.includes(selected);

    return pickingOther ? (
      renderEmojiPicker({ onPickEmoji, onClose, style, ref })
    ) : (
      <div ref={ref} style={style} className="module-reaction-picker">
        {emojis.map((emoji, index) => {
          const maybeFocusRef = index === 0 ? focusRef : undefined;

          return (
            <button
              type="button"
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
              title={emoji}
            >
              <div className="module-reaction-picker__emoji-btn__emoji">
                <Emoji size={48} emoji={emoji} />
              </div>
            </button>
          );
        })}
        <button
          type="button"
          className={classNames(
            'module-reaction-picker__emoji-btn',
            otherSelected
              ? 'module-reaction-picker__emoji-btn--selected'
              : 'module-reaction-picker__emoji-btn--more'
          )}
          onClick={e => {
            e.stopPropagation();
            if (otherSelected && selected) {
              onPick(selected);
            } else {
              setPickingOther(true);
            }
          }}
          title={i18n('ReactionsViewer--more')}
        >
          {otherSelected ? (
            <div className="module-reaction-picker__emoji-btn__emoji">
              <Emoji size={48} emoji={selected} />
            </div>
          ) : null}
        </button>
      </div>
    );
  }
);
