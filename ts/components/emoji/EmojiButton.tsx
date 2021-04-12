// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import classNames from 'classnames';
import { get, noop } from 'lodash';
import { Manager, Popper, Reference } from 'react-popper';
import { createPortal } from 'react-dom';
import { EmojiPicker, Props as EmojiPickerProps } from './EmojiPicker';
import { LocalizerType } from '../../types/Util';

export type OwnProps = {
  readonly i18n: LocalizerType;
  readonly onClose?: () => unknown;
};

export type Props = OwnProps &
  Pick<
    EmojiPickerProps,
    'doSend' | 'onPickEmoji' | 'onSetSkinTone' | 'recentEmojis' | 'skinTone'
  >;

export const EmojiButton = React.memo(
  ({
    i18n,
    doSend,
    onClose,
    onPickEmoji,
    skinTone,
    onSetSkinTone,
    recentEmojis,
  }: Props) => {
    const [open, setOpen] = React.useState(false);
    const [popperRoot, setPopperRoot] = React.useState<HTMLElement | null>(
      null
    );

    const handleClickButton = React.useCallback(() => {
      if (popperRoot) {
        setOpen(false);
      } else {
        setOpen(true);
      }
    }, [popperRoot, setOpen]);

    const handleClose = React.useCallback(() => {
      setOpen(false);
      if (onClose) {
        onClose();
      }
    }, [setOpen, onClose]);

    // Create popper root and handle outside clicks
    React.useEffect(() => {
      if (open) {
        const root = document.createElement('div');
        setPopperRoot(root);
        document.body.appendChild(root);
        const handleOutsideClick = (event: MouseEvent) => {
          if (!root.contains(event.target as Node)) {
            handleClose();
            event.stopPropagation();
            event.preventDefault();
          }
        };
        document.addEventListener('click', handleOutsideClick);

        return () => {
          document.body.removeChild(root);
          document.removeEventListener('click', handleOutsideClick);
          setPopperRoot(null);
        };
      }

      return noop;
    }, [open, setOpen, setPopperRoot, handleClose]);

    // Install keyboard shortcut to open emoji picker
    React.useEffect(() => {
      const handleKeydown = (event: KeyboardEvent) => {
        const { ctrlKey, key, metaKey, shiftKey } = event;
        const commandKey = get(window, 'platform') === 'darwin' && metaKey;
        const controlKey = get(window, 'platform') !== 'darwin' && ctrlKey;
        const commandOrCtrl = commandKey || controlKey;

        // We don't want to open up if the conversation has any panels open
        const panels = document.querySelectorAll('.conversation .panel');
        if (panels && panels.length > 1) {
          return;
        }

        if (commandOrCtrl && shiftKey && (key === 'j' || key === 'J')) {
          event.stopPropagation();
          event.preventDefault();

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
              ref={ref}
              onClick={handleClickButton}
              className={classNames({
                'module-emoji-button__button': true,
                'module-emoji-button__button--active': open,
              })}
              aria-label={i18n('EmojiButton__label')}
            />
          )}
        </Reference>
        {open && popperRoot
          ? createPortal(
              <Popper placement="top-start" positionFixed>
                {({ ref, style }) => (
                  <EmojiPicker
                    ref={ref}
                    i18n={i18n}
                    style={style}
                    onPickEmoji={onPickEmoji}
                    doSend={doSend}
                    onClose={handleClose}
                    skinTone={skinTone}
                    onSetSkinTone={onSetSkinTone}
                    recentEmojis={recentEmojis}
                  />
                )}
              </Popper>,
              popperRoot
            )
          : null}
      </Manager>
    );
  }
);
