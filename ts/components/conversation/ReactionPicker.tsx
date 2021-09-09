// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import classNames from 'classnames';
import * as log from '../../logging/log';
import { Emoji } from '../emoji/Emoji';
import { convertShortName } from '../emoji/lib';
import { Props as EmojiPickerProps } from '../emoji/EmojiPicker';
import { missingCaseError } from '../../util/missingCaseError';
import { useRestoreFocus } from '../../util/hooks/useRestoreFocus';
import { LocalizerType } from '../../types/Util';

export enum ReactionPickerSelectionStyle {
  Picker,
  Menu,
}

export type RenderEmojiPickerProps = Pick<Props, 'onClose' | 'style'> &
  Pick<EmojiPickerProps, 'onClickSettings' | 'onPickEmoji'> & {
    ref: React.Ref<HTMLDivElement>;
  };

export type OwnProps = {
  hasMoreButton?: boolean;
  i18n: LocalizerType;
  selected?: string;
  selectionStyle: ReactionPickerSelectionStyle;
  onClose?: () => unknown;
  onPick: (emoji: string) => unknown;
  openCustomizePreferredReactionsModal?: () => unknown;
  preferredReactionEmoji: Array<string>;
  renderEmojiPicker: (props: RenderEmojiPickerProps) => React.ReactElement;
  skinTone: number;
};

export type Props = OwnProps & Pick<React.HTMLProps<HTMLDivElement>, 'style'>;

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
    {
      hasMoreButton = true,
      i18n,
      onClose,
      onPick,
      openCustomizePreferredReactionsModal,
      preferredReactionEmoji,
      renderEmojiPicker,
      selected,
      selectionStyle,
      skinTone,
      style,
    },
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
      return renderEmojiPicker({
        onClickSettings: openCustomizePreferredReactionsModal,
        onClose,
        onPickEmoji,
        ref,
        style,
      });
    }

    const emojis = preferredReactionEmoji.map(shortName =>
      convertShortName(shortName, skinTone)
    );

    const otherSelected = selected && !emojis.includes(selected);

    let moreButton: React.ReactNode;
    if (!hasMoreButton) {
      moreButton = undefined;
    } else if (otherSelected) {
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
          aria-label={i18n('Reactions--more')}
          className="module-ReactionPicker__button module-ReactionPicker__button--more"
          onClick={event => {
            event.stopPropagation();
            setPickingOther(true);
          }}
          tabIndex={0}
          title={i18n('Reactions--more')}
          type="button"
        >
          <div className="module-ReactionPicker__button--more__dot" />
          <div className="module-ReactionPicker__button--more__dot" />
          <div className="module-ReactionPicker__button--more__dot" />
        </button>
      );
    }

    let selectionStyleClassName: string;
    switch (selectionStyle) {
      case ReactionPickerSelectionStyle.Picker:
        selectionStyleClassName = 'module-ReactionPicker--picker-style';
        break;
      case ReactionPickerSelectionStyle.Menu:
        selectionStyleClassName = 'module-ReactionPicker--menu-style';
        break;
      default:
        log.error(missingCaseError(selectionStyle));
        selectionStyleClassName = 'module-ReactionPicker--picker-style';
        break;
    }

    return (
      <div
        ref={ref}
        style={style}
        className={classNames(
          'module-ReactionPicker',
          selectionStyleClassName,
          selected ? 'module-ReactionPicker--something-selected' : undefined
        )}
      >
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
