// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { MutableRefObject } from 'react';
import classNames from 'classnames';
import { get, noop } from 'lodash';
import { Manager, Popper, Reference } from 'react-popper';
import { Emoji } from './Emoji';
import type { Props as EmojiPickerProps } from './EmojiPicker';
import { EmojiPicker } from './EmojiPicker';
import type { LocalizerType } from '../../types/Util';
import { useRefMerger } from '../../hooks/useRefMerger';
import { handleOutsideClick } from '../../util/handleOutsideClick';
import * as KeyboardLayout from '../../services/keyboardLayout';

export enum EmojiButtonVariant {
  Normal,
  ProfileEditor,
}

export type OwnProps = Readonly<{
  className?: string;
  closeOnPick?: boolean;
  emoji?: string;
  i18n: LocalizerType;
  onClose?: () => unknown;
  onOpen?: () => unknown;
  emojiButtonApi?: MutableRefObject<EmojiButtonAPI | undefined>;
  variant?: EmojiButtonVariant;
}>;

export type Props = OwnProps &
  Pick<
    EmojiPickerProps,
    'onPickEmoji' | 'onSetSkinTone' | 'recentEmojis' | 'skinTone'
  >;

export type EmojiButtonAPI = Readonly<{
  close: () => void;
}>;

export const EmojiButton = React.memo(function EmojiButtonInner({
  className,
  closeOnPick,
  emoji,
  emojiButtonApi,
  i18n,
  onClose,
  onOpen,
  onPickEmoji,
  skinTone,
  onSetSkinTone,
  recentEmojis,
  variant = EmojiButtonVariant.Normal,
}: Props) {
  const isRTL = i18n.getLocaleDirection() === 'rtl';

  const [open, setOpen] = React.useState(false);
  const [wasInvokedFromKeyboard, setWasInvokedFromKeyboard] =
    React.useState(false);
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const popperRef = React.useRef<HTMLDivElement | null>(null);
  const refMerger = useRefMerger();

  React.useEffect(() => {
    if (!open) {
      return;
    }
    onOpen?.();
  }, [open, onOpen]);

  const handleClickButton = React.useCallback(() => {
    setWasInvokedFromKeyboard(false);
    if (open) {
      setOpen(false);
    } else {
      setOpen(true);
    }
  }, [open, setOpen, setWasInvokedFromKeyboard]);

  const handleClose = React.useCallback(() => {
    setOpen(false);
    setWasInvokedFromKeyboard(false);
    if (onClose) {
      onClose();
    }
  }, [setOpen, setWasInvokedFromKeyboard, onClose]);

  const api = React.useMemo(
    () => ({
      close: () => {
        setOpen(false);
        setWasInvokedFromKeyboard(false);
      },
    }),
    [setOpen, setWasInvokedFromKeyboard]
  );

  if (emojiButtonApi) {
    // Using a React.MutableRefObject, so we need to reassign this prop.
    // eslint-disable-next-line no-param-reassign
    emojiButtonApi.current = api;
  }

  React.useEffect(() => {
    if (!open) {
      return noop;
    }

    return handleOutsideClick(
      () => {
        handleClose();
        return true;
      },
      {
        containerElements: [popperRef, buttonRef],
        name: 'EmojiButton',
      }
    );
  }, [open, handleClose]);

  // Install keyboard shortcut to open emoji picker
  React.useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const { ctrlKey, metaKey, shiftKey } = event;
      const commandKey = get(window, 'platform') === 'darwin' && metaKey;
      const controlKey = get(window, 'platform') !== 'darwin' && ctrlKey;
      const commandOrCtrl = commandKey || controlKey;
      const key = KeyboardLayout.lookup(event);

      // We don't want to open up if the current conversation panel is hidden
      const parentPanel = buttonRef.current?.closest('.ConversationPanel');
      if (parentPanel?.classList.contains('ConversationPanel__hidden')) {
        return;
      }

      if (commandOrCtrl && shiftKey && (key === 'j' || key === 'J')) {
        event.stopPropagation();
        event.preventDefault();

        setWasInvokedFromKeyboard(true);
        setOpen(!open);
      }
    };
    document.addEventListener('keydown', handleKeydown);

    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [open, setOpen]);

  return (
    <Manager>
      <Reference>
        {({ ref }) => (
          <button
            type="button"
            ref={refMerger(buttonRef, ref)}
            onClick={handleClickButton}
            className={classNames(className, {
              'module-emoji-button__button': true,
              'module-emoji-button__button--active': open,
              'module-emoji-button__button--has-emoji': Boolean(emoji),
              'module-emoji-button__button--profile-editor':
                variant === EmojiButtonVariant.ProfileEditor,
            })}
            aria-label={i18n('icu:EmojiButton__label')}
          >
            {emoji && <Emoji emoji={emoji} size={24} />}
          </button>
        )}
      </Reference>
      {open ? (
        <div ref={popperRef}>
          <Popper placement={isRTL ? 'top-end' : 'top-start'} strategy="fixed">
            {({ ref, style }) => (
              <EmojiPicker
                ref={ref}
                i18n={i18n}
                style={style}
                onPickEmoji={ev => {
                  onPickEmoji(ev);
                  if (closeOnPick) {
                    handleClose();
                  }
                }}
                onClose={handleClose}
                skinTone={skinTone}
                onSetSkinTone={onSetSkinTone}
                wasInvokedFromKeyboard={wasInvokedFromKeyboard}
                recentEmojis={recentEmojis}
              />
            )}
          </Popper>
        </div>
      ) : null}
    </Manager>
  );
});
