// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type Quill from 'quill';
import type { KeyboardContext } from 'quill';
import React from 'react';
import classNames from 'classnames';
import { Popper } from 'react-popper';
import { createPortal } from 'react-dom';
import type { VirtualElement } from '@popperjs/core';
import { pick } from 'lodash';

import * as log from '../../logging/log';
import * as Errors from '../../types/errors';
import type { LocalizerType } from '../../types/Util';
import { handleOutsideClick } from '../../util/handleOutsideClick';
import { SECOND } from '../../util/durations/constants';

const BUTTON_HOVER_TIMEOUT = 2 * SECOND;

// Note: Keyboard shortcuts are defined in the constructor below, and when using
//   <FormattingButton /> below. They're also referenced in ShortcutGuide.tsx.
const BOLD_CHAR = 'B';
const ITALIC_CHAR = 'I';
const MONOSPACE_CHAR = 'E';
const SPOILER_CHAR = 'B';
const STRIKETHROUGH_CHAR = 'X';

type FormattingPickerOptions = {
  i18n: LocalizerType;
  isMenuEnabled: boolean;
  isEnabled: boolean;
  isSpoilersEnabled: boolean;
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

function findMaximumRect(rects: DOMRectList):
  | {
      x: number;
      y: number;
      height: number;
      width: number;
    }
  | undefined {
  const first = rects[0];
  if (!first) {
    return undefined;
  }

  let result = pick(first, ['top', 'left', 'right', 'bottom']);

  for (let i = 1, max = rects.length; i < max; i += 1) {
    const rect = rects[i];

    result = {
      top: Math.min(rect.top, result.top),
      left: Math.min(rect.left, result.left),
      bottom: Math.max(rect.bottom, result.bottom),
      right: Math.max(rect.right, result.right),
    };
  }

  return {
    x: result.left,
    y: result.top,
    height: result.bottom - result.top,
    width: result.right - result.left,
  };
}

function getMetaKey(platform: string, i18n: LocalizerType) {
  const isMacOS = platform === 'darwin';

  if (isMacOS) {
    return '⌘';
  }
  return i18n('icu:Keyboard--Key--ctrl');
}

export class FormattingMenu {
  options: FormattingPickerOptions;

  outsideClickDestructor?: () => void;

  quill: Quill;

  referenceElement: VirtualElement | undefined;

  root: HTMLDivElement;

  constructor(quill: Quill, options: FormattingPickerOptions) {
    this.quill = quill;
    this.options = options;
    this.root = document.body.appendChild(document.createElement('div'));

    this.quill.on('editor-change', this.onEditorChange.bind(this));

    // We override these keybindings, which means that we need to move their priority
    //   above the built-in shortcuts, which don't exactly do what we want.

    const boldCharCode = BOLD_CHAR.charCodeAt(0);
    this.quill.keyboard.addBinding(
      { key: BOLD_CHAR, shortKey: true },
      (_range, context) =>
        this.toggleForStyle(QuillFormattingStyle.bold, context)
    );
    quill.keyboard.bindings[boldCharCode].unshift(
      quill.keyboard.bindings[boldCharCode].pop()
    );

    const italicCharCode = ITALIC_CHAR.charCodeAt(0);
    this.quill.keyboard.addBinding(
      { key: ITALIC_CHAR, shortKey: true },
      (_range, context) =>
        this.toggleForStyle(QuillFormattingStyle.italic, context)
    );
    quill.keyboard.bindings[italicCharCode].unshift(
      quill.keyboard.bindings[italicCharCode].pop()
    );

    // No need for changing priority for these new keybindings

    this.quill.keyboard.addBinding(
      { key: MONOSPACE_CHAR, shortKey: true },
      (_range, context) =>
        this.toggleForStyle(QuillFormattingStyle.monospace, context)
    );
    this.quill.keyboard.addBinding(
      { key: STRIKETHROUGH_CHAR, shortKey: true, shiftKey: true },
      (_range, context) =>
        this.toggleForStyle(QuillFormattingStyle.strike, context)
    );
    this.quill.keyboard.addBinding(
      { key: SPOILER_CHAR, shortKey: true, shiftKey: true },
      (_range, context) =>
        this.toggleForStyle(QuillFormattingStyle.spoiler, context)
    );
  }

  destroy(): void {
    this.root.remove();
  }

  updateOptions(options: Partial<FormattingPickerOptions>): void {
    this.options = { ...this.options, ...options };
    this.onEditorChange();
  }

  onEditorChange(): void {
    if (!this.options.isMenuEnabled) {
      this.referenceElement = undefined;
      this.render();

      return;
    }

    const isFocused = this.quill.hasFocus();
    if (!isFocused) {
      this.referenceElement = undefined;
      this.render();

      return;
    }

    const quillSelection = this.quill.getSelection();

    if (!quillSelection || quillSelection.length === 0) {
      this.referenceElement = undefined;
    } else {
      // a virtual reference to the text we are trying to format
      this.referenceElement = {
        getBoundingClientRect() {
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
              log.warn('No editor rect when showing formatting menu');
              return new DOMRect();
            }

            const rect = findMaximumRect(range.getClientRects());
            if (!rect) {
              log.warn('No maximum rect when showing formatting menu');
              return new DOMRect();
            }

            // If we've scrolled down and the top of the composer text is invisible, above
            //   where the editor ends, we fix the popover so it stays connected to the
            //   visible editor. Important for the 'Cmd-A' scenario when scrolled down.
            const updatedY = Math.max(
              (editorRect.y || 0) - 10,
              (rect.y || 0) - 10
            );
            const updatedHeight = rect.height + (rect.y - updatedY);

            return DOMRect.fromRect({
              x: rect.x,
              y: updatedY,
              height: updatedHeight,
              width: rect.width,
            });
          }

          log.warn('No selection range when showing formatting menu');
          return new DOMRect();
        },
      };
    }

    this.render();
  }

  isStyleEnabledInSelection(style: QuillFormattingStyle): boolean | undefined {
    const selection = this.quill.getSelection();
    if (!selection || !selection.length) {
      return;
    }
    const contents = this.quill.getContents(selection.index, selection.length);
    return contents.ops.every(op => op.attributes?.[style]);
  }

  toggleForStyle(style: QuillFormattingStyle, context?: KeyboardContext): void {
    if (!this.options.isEnabled) {
      return;
    }
    if (
      !this.options.isSpoilersEnabled &&
      style === QuillFormattingStyle.spoiler
    ) {
      return;
    }

    try {
      const isEnabled = context
        ? Boolean(context.format[style])
        : this.isStyleEnabledInSelection(style);
      if (isEnabled === undefined) {
        return;
      }
      this.quill.format(style, !isEnabled);
    } catch (error) {
      log.error('toggleForStyle error:', Errors.toLogFormat(error));
    }
  }

  render(): void {
    if (!this.referenceElement) {
      this.outsideClickDestructor?.();
      this.outsideClickDestructor = undefined;

      this.options.setFormattingChooserElement(null);

      return;
    }

    const { i18n, isSpoilersEnabled, platform } = this.options;
    const metaKey = getMetaKey(platform, i18n);
    const shiftKey = i18n('icu:Keyboard--Key--shift');

    // showing the popup format menu
    const isStyleEnabledInSelection = this.isStyleEnabledInSelection.bind(this);
    const toggleForStyle = this.toggleForStyle.bind(this);
    const element = createPortal(
      <Popper
        placement="top"
        referenceElement={this.referenceElement}
        modifiers={[
          {
            name: 'fadeIn',
            enabled: true,
            phase: 'write',
            fn({ state }) {
              // eslint-disable-next-line no-param-reassign
              state.elements.popper.style.opacity = '1';
            },
          },
        ]}
      >
        {({ ref, style }) => {
          const [hasLongHovered, setHasLongHovered] =
            React.useState<boolean>(false);
          const onLongHover = React.useCallback(
            (value: boolean) => {
              setHasLongHovered(value);
            },
            [setHasLongHovered]
          );

          return (
            <div
              ref={ref}
              className="module-composition-input__format-menu"
              style={style}
              role="menu"
              tabIndex={0}
              onMouseLeave={() => setHasLongHovered(false)}
            >
              <FormattingButton
                hasLongHovered={hasLongHovered}
                isStyleEnabledInSelection={isStyleEnabledInSelection}
                label={i18n('icu:Keyboard--composer--bold')}
                onLongHover={onLongHover}
                popupGuideShortcut={`${metaKey} + ${BOLD_CHAR}`}
                popupGuideText={i18n('icu:FormatMenu--guide--bold')}
                style={QuillFormattingStyle.bold}
                toggleForStyle={toggleForStyle}
              />
              <FormattingButton
                hasLongHovered={hasLongHovered}
                isStyleEnabledInSelection={isStyleEnabledInSelection}
                label={i18n('icu:Keyboard--composer--italic')}
                onLongHover={onLongHover}
                popupGuideShortcut={`${metaKey} + ${ITALIC_CHAR}`}
                popupGuideText={i18n('icu:FormatMenu--guide--italic')}
                style={QuillFormattingStyle.italic}
                toggleForStyle={toggleForStyle}
              />
              <FormattingButton
                hasLongHovered={hasLongHovered}
                isStyleEnabledInSelection={isStyleEnabledInSelection}
                label={i18n('icu:Keyboard--composer--strikethrough')}
                onLongHover={onLongHover}
                popupGuideShortcut={`${metaKey} + ${shiftKey} + ${STRIKETHROUGH_CHAR}`}
                popupGuideText={i18n('icu:FormatMenu--guide--strikethrough')}
                style={QuillFormattingStyle.strike}
                toggleForStyle={toggleForStyle}
              />
              <FormattingButton
                hasLongHovered={hasLongHovered}
                isStyleEnabledInSelection={isStyleEnabledInSelection}
                label={i18n('icu:Keyboard--composer--monospace')}
                onLongHover={onLongHover}
                popupGuideShortcut={`${metaKey} + ${MONOSPACE_CHAR}`}
                popupGuideText={i18n('icu:FormatMenu--guide--monospace')}
                style={QuillFormattingStyle.monospace}
                toggleForStyle={toggleForStyle}
              />
              {isSpoilersEnabled ? (
                <FormattingButton
                  hasLongHovered={hasLongHovered}
                  isStyleEnabledInSelection={isStyleEnabledInSelection}
                  onLongHover={onLongHover}
                  popupGuideShortcut={`${metaKey} + ${shiftKey} + ${SPOILER_CHAR}`}
                  popupGuideText={i18n('icu:FormatMenu--guide--spoiler')}
                  label={i18n('icu:Keyboard--composer--spoiler')}
                  style={QuillFormattingStyle.spoiler}
                  toggleForStyle={toggleForStyle}
                />
              ) : null}
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
  isStyleEnabledInSelection,
  label,
  onLongHover,
  popupGuideText,
  popupGuideShortcut,
  style,
  toggleForStyle,
}: {
  hasLongHovered: boolean;
  isStyleEnabledInSelection: (
    style: QuillFormattingStyle
  ) => boolean | undefined;
  label: string;
  onLongHover: (value: boolean) => unknown;
  popupGuideText: string;
  popupGuideShortcut: string;
  style: QuillFormattingStyle;
  toggleForStyle: (style: QuillFormattingStyle) => unknown;
}): JSX.Element {
  const buttonRef = React.useRef<HTMLButtonElement | null>(null);
  const timerRef = React.useRef<NodeJS.Timeout | undefined>();
  const [isHovered, setIsHovered] = React.useState<boolean>(false);

  return (
    <>
      {hasLongHovered && isHovered && buttonRef.current ? (
        <Popper placement="top" referenceElement={buttonRef.current}>
          {({ ref, style: popperStyles }) => (
            <div
              className="module-composition-input__format-menu__item__popover"
              ref={ref}
              style={popperStyles}
            >
              {popupGuideText}
              <div className="module-composition-input__format-menu__item__popover__shortcut">
                {popupGuideShortcut}
              </div>
            </div>
          )}
        </Popper>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        className="module-composition-input__format-menu__item"
        aria-label={label}
        onClick={event => {
          event.preventDefault();
          event.stopPropagation();
          onLongHover(false);
          toggleForStyle(style);
        }}
        onMouseEnter={() => {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = undefined;
          }

          timerRef.current = setTimeout(() => {
            onLongHover(true);
          }, BUTTON_HOVER_TIMEOUT);

          setIsHovered(true);
        }}
        onMouseLeave={() => {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = undefined;
          }

          setIsHovered(false);
        }}
      >
        <div
          className={classNames(
            'module-composition-input__format-menu__item__icon',
            `module-composition-input__format-menu__item__icon--${style}`,
            isStyleEnabledInSelection(style)
              ? 'module-composition-input__format-menu__item__icon--active'
              : null
          )}
        />
      </button>
    </>
  );
}
