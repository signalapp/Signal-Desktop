// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, useCallback, useRef, useEffect, type JSX } from 'react';
import classNames from 'classnames';
import { Popper } from 'react-popper';
import { createPortal } from 'react-dom';
import lodash from 'lodash';
import Emitter from '@signalapp/quill-cjs/core/emitter.js';
import type Quill from '@signalapp/quill-cjs';
import type { Op } from '@signalapp/quill-cjs';
import type { VirtualElement } from '@popperjs/core';
import { createLogger } from '../../logging/log.std.ts';
import type { LocalizerType } from '../../types/Util.std.ts';
import { handleOutsideClick } from '../../util/handleOutsideClick.dom.ts';
import { createKeybindingsHandler } from 'tinykeys';

const { isString } = lodash;

const log = createLogger('menu');

const MENU_FADE_OUT_MS = 200;
const POPUP_GUIDE_FADE_MS = 120;
const BUTTON_HOVER_TIMEOUT_MS = 900;
const MENU_TEXT_BUFFER = 12; // pixels

type FormattingPickerOptions = {
  i18n: LocalizerType;
  isMenuEnabled: boolean;
  isMouseDown?: boolean;
  platform: string;
  setFormattingChooserElement: (element: JSX.Element | null) => void;
};

export enum QuillFormattingStyle {
  bold = 'bold',
  italic = 'italic',
  monospace = 'monospace',
  strike = 'strike',
  spoiler = 'spoiler',
}

function getMetaKey(platform: string, i18n: LocalizerType) {
  const isMacOS = platform === 'darwin';

  if (isMacOS) {
    return '⌘';
  }
  return i18n('icu:Keyboard--Key--ctrl');
}

function isAllNewlines(ops: Array<Op>): boolean {
  return ops.every(isNewlineOnlyOp);
}

export function isNewlineOnlyOp(op: Op): boolean {
  return isString(op.insert) && /^\n+$/g.test(op.insert);
}

// oxlint-disable-next-line react/prefer-function-component
export class FormattingMenu {
  // Cache the results of our virtual elements's last rect calculation
  lastRect: DOMRect | undefined;

  // Keep a references to our originally passed (or updated) options
  options: FormattingPickerOptions;

  // Used to dismiss our menu if we click outside it
  outsideClickDestructor?: () => void;

  readonly #handleKeyDown: (event: KeyboardEvent) => void;

  // Maintaining a direct reference to quill
  quill: Quill;

  // The element we hand to Popper to position the menu
  referenceElement: VirtualElement | undefined;

  // The host for our portal
  root: HTMLDivElement;

  // Timer to track an animated fade-out, then DOM removal
  fadingOutTimeout?: NodeJS.Timeout;

  constructor(quill: Quill, options: FormattingPickerOptions) {
    this.quill = quill;
    this.options = options;
    this.root = document.body.appendChild(document.createElement('div'));

    this.quill.on(Emitter.events.EDITOR_CHANGE, this.onEditorChange.bind(this));

    // We override these keybindings, so we need to remove them from the defaults
    this.quill.keyboard.bindings.b = [];
    this.quill.keyboard.bindings.i = [];

    const onBold = () => {
      this.toggleForStyle(QuillFormattingStyle.bold);
    };
    const onItalic = () => {
      this.toggleForStyle(QuillFormattingStyle.italic);
    };
    const onMonospace = () => {
      this.toggleForStyle(QuillFormattingStyle.monospace);
    };
    const onStrike = () => {
      this.toggleForStyle(QuillFormattingStyle.strike);
    };
    const onSpoiler = () => {
      this.toggleForStyle(QuillFormattingStyle.spoiler);
    };

    this.#handleKeyDown = createKeybindingsHandler({
      '$mod+B': onBold,
      '$mod+I': onItalic,
      '$mod+E': onMonospace,
      '$mod+Shift+X': onStrike,
      '$mod+Shift+B': onSpoiler,
    });

    this.quill.root.addEventListener('keydown', this.#handleKeyDown);
  }

  destroy(): void {
    this.quill.root.removeEventListener('keydown', this.#handleKeyDown);
    this.root.remove();
  }

  updateOptions(options: Partial<FormattingPickerOptions>): void {
    this.options = { ...this.options, ...options };
    this.onEditorChange();
  }

  scheduleRemoval(): void {
    // Nothing to do
    if (!this.referenceElement) {
      return;
    }

    // Already scheduled
    if (this.fadingOutTimeout) {
      return;
    }

    this.fadingOutTimeout = setTimeout(() => {
      this.referenceElement = undefined;
      this.lastRect = undefined;
      this.fadingOutTimeout = undefined;
      this.render();
    }, MENU_FADE_OUT_MS);

    this.render();
  }

  cancelRemoval(): void {
    if (this.fadingOutTimeout) {
      clearTimeout(this.fadingOutTimeout);
      this.fadingOutTimeout = undefined;
    }
  }

  onEditorChange(): void {
    if (!this.options.isMenuEnabled) {
      this.scheduleRemoval();
      return;
    }

    const isFocused = this.quill.hasFocus();
    if (!isFocused) {
      this.scheduleRemoval();
      return;
    }

    const quillSelection = this.quill.getSelection();

    if (!quillSelection || quillSelection.length === 0) {
      this.scheduleRemoval();
      return;
    }

    // Note: we special-case all-newline ops because Quill doesn't apply styles to them
    const contents = this.quill.getContents(
      quillSelection.index,
      quillSelection.length
    );
    if (isAllNewlines(contents.ops)) {
      this.scheduleRemoval();
      return;
    }

    // a virtual reference to the text we are trying to format
    this.cancelRemoval();
    this.referenceElement = {
      getBoundingClientRect: () => {
        const selection = window.getSelection();

        // there's a selection and at least one range
        if (selection != null && selection.rangeCount !== 0) {
          // grab the first range, the one the user is actually on right now
          const range = selection.getRangeAt(0);

          const { activeElement } = document;
          const editorElement = activeElement?.closest(
            '.module-composition-input__input'
          );
          const editorRect = editorElement?.getClientRects()[0];
          if (!editorRect) {
            // Note: this will happen when a user dismisses a panel; and if we don't
            //   cache here, the formatting menu will show in the very top-left
            if (this.lastRect) {
              return this.lastRect;
            }
            log.warn('No editor rect when showing formatting menu');
            return new DOMRect();
          }

          const rect = range.getBoundingClientRect();
          if (!rect) {
            if (this.lastRect) {
              return this.lastRect;
            }
            log.warn('No maximum rect when showing formatting menu');
            return new DOMRect();
          }

          // If we've scrolled down and the top of the composer text is invisible, above
          //   where the editor ends, we fix the popover so it stays connected to the
          //   visible editor. Important for the 'Cmd-A' scenario when scrolled down.
          const updatedY = Math.max(
            (editorRect.y || 0) - MENU_TEXT_BUFFER,
            (rect.y || 0) - MENU_TEXT_BUFFER
          );
          const updatedHeight = rect.height + (rect.y - updatedY);

          this.lastRect = DOMRect.fromRect({
            x: rect.x,
            y: updatedY,
            height: updatedHeight,
            width: rect.width,
          });

          return this.lastRect;
        }

        log.warn('No selection range when showing formatting menu');
        return new DOMRect();
      },
    };

    this.render();
  }

  static isStyleEnabledForOps(
    ops: Array<Op>,
    style: QuillFormattingStyle
  ): boolean {
    // Note: we special-case single \n ops because Quill doesn't apply formatting to them
    if (isAllNewlines(ops)) {
      return false;
    }

    return ops.every(op => op.attributes?.[style] || isNewlineOnlyOp(op));
  }

  isStyleEnabledInSelection(style: QuillFormattingStyle): boolean {
    const selection = this.quill.getSelection();
    if (selection == null) {
      return false;
    }
    return this.quill.getFormat(selection)[style] != null;
  }

  toggleForStyle(style: QuillFormattingStyle): void {
    this.quill.format(style, !this.isStyleEnabledInSelection(style));
  }

  render(): void {
    if (!this.referenceElement) {
      this.outsideClickDestructor?.();
      this.outsideClickDestructor = undefined;

      this.options.setFormattingChooserElement(null);

      return;
    }

    const { i18n, platform } = this.options;
    const metaKey = getMetaKey(platform, i18n);
    const shiftKey = i18n('icu:Keyboard--Key--shift');

    // showing the popup format menu
    const isStyleEnabledInSelection = this.isStyleEnabledInSelection.bind(this);
    const toggleForStyle = this.toggleForStyle.bind(this);
    const element = createPortal(
      <Popper placement="top" referenceElement={this.referenceElement}>
        {({ ref, style }) => {
          const opacity =
            style.transform &&
            !this.options.isMouseDown &&
            !this.fadingOutTimeout
              ? 1
              : 0;

          const [hasLongHovered, setHasLongHovered] = useState<boolean>(false);
          const onLongHover = useCallback(
            (value: boolean) => {
              setHasLongHovered(value);
            },
            [setHasLongHovered]
          );

          return (
            <div
              ref={ref}
              className="module-composition-input__format-menu"
              style={{ ...style, opacity }}
              role="menu"
              tabIndex={0}
              onMouseLeave={() => setHasLongHovered(false)}
            >
              <FormattingButton
                hasLongHovered={hasLongHovered}
                isActive={isStyleEnabledInSelection(QuillFormattingStyle.bold)}
                label={i18n('icu:Keyboard--composer--bold')}
                onLongHover={onLongHover}
                popupGuideShortcut={`${metaKey} + B`}
                popupGuideText={i18n('icu:FormatMenu--guide--bold')}
                style={QuillFormattingStyle.bold}
                toggleForStyle={toggleForStyle}
              />
              <FormattingButton
                hasLongHovered={hasLongHovered}
                isActive={isStyleEnabledInSelection(
                  QuillFormattingStyle.italic
                )}
                label={i18n('icu:Keyboard--composer--italic')}
                onLongHover={onLongHover}
                popupGuideShortcut={`${metaKey} + I`}
                popupGuideText={i18n('icu:FormatMenu--guide--italic')}
                style={QuillFormattingStyle.italic}
                toggleForStyle={toggleForStyle}
              />
              <FormattingButton
                hasLongHovered={hasLongHovered}
                isActive={isStyleEnabledInSelection(
                  QuillFormattingStyle.strike
                )}
                label={i18n('icu:Keyboard--composer--strikethrough')}
                onLongHover={onLongHover}
                popupGuideShortcut={`${metaKey} + ${shiftKey} + X`}
                popupGuideText={i18n('icu:FormatMenu--guide--strikethrough')}
                style={QuillFormattingStyle.strike}
                toggleForStyle={toggleForStyle}
              />
              <FormattingButton
                hasLongHovered={hasLongHovered}
                isActive={isStyleEnabledInSelection(
                  QuillFormattingStyle.monospace
                )}
                label={i18n('icu:Keyboard--composer--monospace')}
                onLongHover={onLongHover}
                popupGuideShortcut={`${metaKey} + E`}
                popupGuideText={i18n('icu:FormatMenu--guide--monospace')}
                style={QuillFormattingStyle.monospace}
                toggleForStyle={toggleForStyle}
              />
              <FormattingButton
                hasLongHovered={hasLongHovered}
                isActive={isStyleEnabledInSelection(
                  QuillFormattingStyle.spoiler
                )}
                onLongHover={onLongHover}
                popupGuideShortcut={`${metaKey} + ${shiftKey} + B`}
                popupGuideText={i18n('icu:FormatMenu--guide--spoiler')}
                label={i18n('icu:Keyboard--composer--spoiler')}
                style={QuillFormattingStyle.spoiler}
                toggleForStyle={toggleForStyle}
              />
            </div>
          );
        }}
      </Popper>,
      this.root
    );

    // Just to make sure that we don't propagate outside clicks until this is closed.
    this.outsideClickDestructor?.();
    this.outsideClickDestructor = handleOutsideClick(
      () => {
        return true;
      },
      {
        name: 'quill.emoji.completion',
        containerElements: [this.root],
      }
    );

    this.options.setFormattingChooserElement(element);
  }
}

function FormattingButton({
  hasLongHovered,
  isActive,
  label,
  onLongHover,
  popupGuideText,
  popupGuideShortcut,
  style,
  toggleForStyle,
}: {
  hasLongHovered: boolean;
  isActive: boolean | undefined;
  label: string;
  onLongHover: (value: boolean) => unknown;
  popupGuideText: string;
  popupGuideShortcut: string;
  style: QuillFormattingStyle;
  toggleForStyle: (style: QuillFormattingStyle) => unknown;
}): JSX.Element {
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const [isHovered, setIsHovered] = useState<boolean>(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const fadeOutTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }

      if (fadeOutTimerRef.current) {
        clearTimeout(fadeOutTimerRef.current);
        fadeOutTimerRef.current = null;
      }
    };
  }, []);

  return (
    <>
      {(isFadingOut || (hasLongHovered && isHovered)) && buttonRef.current ? (
        <Popper placement="top" referenceElement={buttonRef.current}>
          {({ ref, style: popperStyles }) => {
            const opacity = !popperStyles.transform || isFadingOut ? 0 : 1;

            return (
              <div
                className="module-composition-input__format-menu__item__popover"
                ref={ref}
                style={{ ...popperStyles, opacity }}
              >
                {popupGuideText}
                <div className="module-composition-input__format-menu__item__popover__shortcut">
                  {popupGuideShortcut}
                </div>
              </div>
            );
          }}
        </Popper>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        className={classNames(
          'module-composition-input__format-menu__item',
          isActive
            ? 'module-composition-input__format-menu__item--active'
            : null
        )}
        aria-label={label}
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();
          onLongHover(false);
          toggleForStyle(style);
        }}
        onMouseEnter={() => {
          if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
          }

          hoverTimerRef.current = setTimeout(() => {
            onLongHover(true);
          }, BUTTON_HOVER_TIMEOUT_MS);

          setIsHovered(true);
        }}
        onMouseLeave={() => {
          if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
          }

          if (hasLongHovered && isHovered) {
            fadeOutTimerRef.current = setTimeout(() => {
              setIsFadingOut(false);
              fadeOutTimerRef.current = null;
            }, POPUP_GUIDE_FADE_MS);
            setIsFadingOut(true);
          }

          setIsHovered(false);
        }}
      >
        <div
          className={classNames(
            'module-composition-input__format-menu__item__icon',
            `module-composition-input__format-menu__item__icon--${style}`,
            isActive
              ? 'module-composition-input__format-menu__item__icon--active'
              : null
          )}
        />
      </button>
    </>
  );
}
