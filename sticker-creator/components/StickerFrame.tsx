// Copyright 2019-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { createPortal } from 'react-dom';
import { SortableHandle } from 'react-sortable-hoc';
import { noop } from 'lodash';
import {
  Manager as PopperManager,
  Popper,
  Reference as PopperReference,
} from 'react-popper';
import { AddEmoji } from '../elements/icons';
import type { Props as DropZoneProps } from '../elements/DropZone';
import { DropZone } from '../elements/DropZone';
import { StickerPreview } from '../elements/StickerPreview';
import * as styles from './StickerFrame.scss';
import type {
  EmojiPickDataType,
  Props as EmojiPickerProps,
} from '../../ts/components/emoji/EmojiPicker';
import { EmojiPicker } from '../../ts/components/emoji/EmojiPicker';
import { Emoji } from '../../ts/components/emoji/Emoji';
import { PopperRootContext } from '../../ts/components/PopperRootContext';
import { useI18n } from '../util/i18n';

export type Mode = 'removable' | 'pick-emoji' | 'add';

export type Props = Partial<
  Pick<EmojiPickerProps, 'skinTone' | 'onSetSkinTone'>
> &
  Partial<Pick<DropZoneProps, 'onDrop'>> & {
    readonly id?: string;
    readonly emojiData?: EmojiPickDataType;
    readonly image?: string;
    readonly mode?: Mode;
    readonly showGuide?: boolean;
    onPickEmoji?({
      id,
      emoji,
    }: {
      id: string;
      emoji: EmojiPickDataType;
    }): unknown;
    onRemove?(id: string): unknown;
  };

const spinnerSvg = (
  <svg width={56} height={56}>
    <path d="M52.36 14.185A27.872 27.872 0 0156 28c0 15.464-12.536 28-28 28v-2c14.36 0 26-11.64 26-26 0-4.66-1.226-9.033-3.372-12.815l1.732-1z" />
  </svg>
);

const closeSvg = (
  <svg
    viewBox="0 0 16 16"
    width="16px"
    height="16px"
    className={styles.closeButtonIcon}
  >
    <path d="M13.4 3.3l-.8-.6L8 7.3 3.3 2.7l-.6.6L7.3 8l-4.6 4.6.6.8L8 8.7l4.6 4.7.8-.8L8.7 8z" />
  </svg>
);

const ImageHandle = SortableHandle((props: { src: string }) => (
  <img className={styles.image} {...props} alt="Sticker" />
));

export const StickerFrame = React.memo(
  ({
    id,
    emojiData,
    image,
    showGuide,
    mode,
    onRemove,
    onPickEmoji,
    skinTone,
    onSetSkinTone,
    onDrop,
  }: Props) => {
    const i18n = useI18n();
    const [emojiPickerOpen, setEmojiPickerOpen] = React.useState(false);
    const [emojiPopperRoot, setEmojiPopperRoot] =
      React.useState<HTMLElement | null>(null);
    const [previewActive, setPreviewActive] = React.useState(false);
    const [previewPopperRoot, setPreviewPopperRoot] =
      React.useState<HTMLElement | null>(null);
    const timerRef = React.useRef<number>();

    const handleToggleEmojiPicker = React.useCallback(() => {
      setEmojiPickerOpen(open => !open);
    }, [setEmojiPickerOpen]);

    const handlePickEmoji = React.useCallback(
      (emoji: EmojiPickDataType) => {
        if (!id) {
          return;
        }
        if (!onPickEmoji) {
          throw new Error(
            'StickerFrame/handlePickEmoji: onPickEmoji was not provided!'
          );
        }
        onPickEmoji({ id, emoji });
        setEmojiPickerOpen(false);
      },
      [id, onPickEmoji, setEmojiPickerOpen]
    );

    const handleRemove = React.useCallback(() => {
      if (!id) {
        return;
      }
      if (!onRemove) {
        throw new Error(
          'StickerFrame/handleRemove: onRemove was not provided!'
        );
      }
      onRemove(id);
    }, [onRemove, id]);

    const handleMouseEnter = React.useCallback(() => {
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        setPreviewActive(true);
      }, 500);
    }, [timerRef, setPreviewActive]);

    const handleMouseLeave = React.useCallback(() => {
      clearTimeout(timerRef.current);
      setPreviewActive(false);
    }, [timerRef, setPreviewActive]);

    React.useEffect(
      () => () => {
        clearTimeout(timerRef.current);
      },
      [timerRef]
    );

    const { createRoot, removeRoot } = React.useContext(PopperRootContext);

    // Create popper root and handle outside clicks
    React.useEffect(() => {
      if (emojiPickerOpen) {
        const root = createRoot();
        setEmojiPopperRoot(root);
        const handleOutsideClick = ({ target }: MouseEvent) => {
          if (!root.contains(target as Node)) {
            setEmojiPickerOpen(false);
          }
        };
        document.addEventListener('click', handleOutsideClick);

        return () => {
          removeRoot(root);
          setEmojiPopperRoot(null);
          document.removeEventListener('click', handleOutsideClick);
        };
      }

      return noop;
    }, [
      createRoot,
      emojiPickerOpen,
      removeRoot,
      setEmojiPickerOpen,
      setEmojiPopperRoot,
    ]);

    React.useEffect(() => {
      if (mode !== 'pick-emoji' && image && previewActive) {
        const root = createRoot();
        setPreviewPopperRoot(root);

        return () => {
          removeRoot(root);
        };
      }

      return noop;
    }, [
      createRoot,
      image,
      mode,
      previewActive,
      removeRoot,
      setPreviewPopperRoot,
    ]);

    const [dragActive, setDragActive] = React.useState<boolean>(false);
    const containerClass = dragActive ? styles.dragActive : styles.container;

    return (
      <PopperManager>
        <PopperReference>
          {({ ref: rootRef }) => (
            <div
              className={containerClass}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              ref={rootRef}
            >
              {
                // eslint-disable-next-line no-nested-ternary
                mode !== 'add' ? (
                  image ? (
                    <ImageHandle src={image} />
                  ) : (
                    <div className={styles.spinner}>{spinnerSvg}</div>
                  )
                ) : null
              }
              {showGuide && mode !== 'add' ? (
                <div className={styles.guide} />
              ) : null}
              {mode === 'add' && onDrop ? (
                <DropZone
                  label={i18n('StickerCreator--DropStage--dragDrop')}
                  onDrop={onDrop}
                  inner
                  onDragActive={setDragActive}
                />
              ) : null}
              {mode === 'removable' ? (
                <button
                  type="button"
                  aria-label={i18n('StickerCreator--DropStage--removeSticker')}
                  className={styles.closeButton}
                  onClick={handleRemove}
                  // Reverse the mouseenter/leave logic for the remove button so
                  // we don't accidentally cover the remove button
                  onMouseEnter={handleMouseLeave}
                  onMouseLeave={handleMouseEnter}
                >
                  {closeSvg}
                </button>
              ) : null}
              {mode === 'pick-emoji' ? (
                <PopperManager>
                  <PopperReference>
                    {({ ref }) => (
                      <button
                        type="button"
                        ref={ref}
                        className={styles.emojiButton}
                        onClick={handleToggleEmojiPicker}
                      >
                        {emojiData ? (
                          <Emoji {...emojiData} size={24} />
                        ) : (
                          <AddEmoji />
                        )}
                      </button>
                    )}
                  </PopperReference>
                  {emojiPickerOpen && emojiPopperRoot
                    ? createPortal(
                        <Popper placement="bottom-start">
                          {({ ref, style }) => (
                            <EmojiPicker
                              ref={ref}
                              style={{ ...style, marginTop: '8px' }}
                              i18n={i18n}
                              onPickEmoji={handlePickEmoji}
                              skinTone={skinTone}
                              onSetSkinTone={onSetSkinTone}
                              onClose={handleToggleEmojiPicker}
                            />
                          )}
                        </Popper>,
                        emojiPopperRoot
                      )
                    : null}
                </PopperManager>
              ) : null}
              {mode !== 'pick-emoji' &&
              image &&
              previewActive &&
              previewPopperRoot
                ? createPortal(
                    <Popper
                      placement="bottom"
                      modifiers={[
                        { name: 'offset', options: { offset: [undefined, 8] } },
                      ]}
                    >
                      {({ ref, style, arrowProps, placement }) => (
                        <StickerPreview
                          ref={ref}
                          style={style}
                          image={image}
                          arrowProps={arrowProps}
                          placement={placement}
                        />
                      )}
                    </Popper>,
                    previewPopperRoot
                  )
                : null}
            </div>
          )}
        </PopperReference>
      </PopperManager>
    );
  }
);
