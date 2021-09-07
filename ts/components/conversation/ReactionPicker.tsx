// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import classNames from 'classnames';
import { Emoji } from '../emoji/Emoji';
import { convertShortName } from '../emoji/lib';
import { Props as EmojiPickerProps } from '../emoji/EmojiPicker';
import { useRestoreFocus } from '../../util/hooks/useRestoreFocus';
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

const EmojiButton = React.forwardRef<
  HTMLButtonElement,
  {
    emoji: string;
    onSelect: () => unknown;
    selected: boolean;
    title?: string;
  }
>(({ emoji, onSelect, selected, title }, ref) => (
  <button
    type="button"
    key={emoji}
    ref={ref}
    tabIndex={0}
    className={classNames(
      'module-ReactionPicker__button',
      'module-ReactionPicker__button--emoji',
      selected && 'module-ReactionPicker__button--selected'
    )}
    onClick={e => {
      e.stopPropagation();
      onSelect();
    }}
  >
    <Emoji size={48} emoji={emoji} title={title} />
  </button>
));

export const ReactionPicker = React.forwardRef<HTMLDivElement, Props>(
  (
    { i18n, selected, onClose, skinTone, onPick, renderEmojiPicker, style },
    ref
  ) => {
    const [pickingOther, setPickingOther] = React.useState(false);

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

    // Focus first button and restore focus on unmount
    const [focusRef] = useRestoreFocus();

    if (pickingOther) {
      return renderEmojiPicker({ onPickEmoji, onClose, style, ref });
    }

    const emojis = DEFAULT_EMOJI_LIST.map(shortName =>
      convertShortName(shortName, skinTone)
    );

    const otherSelected = selected && !emojis.includes(selected);

    let moreButton: React.ReactNode;
    if (otherSelected) {
      moreButton = (
        <EmojiButton
          emoji={selected}
          onSelect={() => {
            onPick(selected);
          }}
          selected
          title={i18n('Reactions--remove')}
        />
      );
    } else {
      moreButton = (
        <button
          aria-label={i18n('ReactionsViewer--more')}
          className="module-ReactionPicker__button module-ReactionPicker__button--more"
          onClick={event => {
            event.stopPropagation();
            setPickingOther(true);
          }}
          tabIndex={0}
          title={i18n('ReactionsViewer--more')}
          type="button"
        >
          <div className="module-ReactionPicker__button--more__dot" />
          <div className="module-ReactionPicker__button--more__dot" />
          <div className="module-ReactionPicker__button--more__dot" />
        </button>
      );
    }

    return (
      <div ref={ref} style={style} className="module-ReactionPicker">
        {emojis.map((emoji, index) => {
          const maybeFocusRef = index === 0 ? focusRef : undefined;

          return (
            <EmojiButton
              emoji={emoji}
              key={emoji}
              onSelect={() => {
                onPick(emoji);
              }}
              ref={maybeFocusRef}
              selected={emoji === selected}
            />
          );
        })}
        {moreButton}
      </div>
    );
  }
);
