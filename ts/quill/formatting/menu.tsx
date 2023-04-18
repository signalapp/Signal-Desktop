// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type Quill from 'quill';
import React from 'react';
import classNames from 'classnames';
import { Popper } from 'react-popper';
import { createPortal } from 'react-dom';
import type { VirtualElement } from '@popperjs/core';

import * as log from '../../logging/log';
import * as Errors from '../../types/errors';
import type { LocalizerType } from '../../types/Util';
import { handleOutsideClick } from '../../util/handleOutsideClick';

type FormattingPickerOptions = {
  i18n: LocalizerType;
  isEnabled: boolean;
  isSpoilersEnabled: boolean;
  setFormattingChooserElement: (element: JSX.Element | null) => void;
};

export enum QuillFormattingStyle {
  bold = 'bold',
  italic = 'italic',
  monospace = 'monospace',
  strike = 'strike',
  spoiler = 'spoiler',
}

export class FormattingMenu {
  lastSelection: { start: number; end: number } | undefined;

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

    const boldChar = 'B';
    const boldCharCode = boldChar.charCodeAt(0);
    this.quill.keyboard.addBinding({ key: boldChar, shortKey: true }, () =>
      this.toggleForStyle(QuillFormattingStyle.bold)
    );
    quill.keyboard.bindings[boldCharCode].unshift(
      quill.keyboard.bindings[boldCharCode].pop()
    );

    const italicChar = 'I';
    const italicCharCode = italicChar.charCodeAt(0);
    this.quill.keyboard.addBinding({ key: italicChar, shortKey: true }, () =>
      this.toggleForStyle(QuillFormattingStyle.italic)
    );
    quill.keyboard.bindings[italicCharCode].unshift(
      quill.keyboard.bindings[italicCharCode].pop()
    );

    // No need for changing priority for these new keybindings

    this.quill.keyboard.addBinding({ key: 'E', shortKey: true }, () =>
      this.toggleForStyle(QuillFormattingStyle.monospace)
    );
    this.quill.keyboard.addBinding(
      { key: 'X', shortKey: true, shiftKey: true },
      () => this.toggleForStyle(QuillFormattingStyle.strike)
    );
    this.quill.keyboard.addBinding(
      { key: 'B', shortKey: true, shiftKey: true },
      () => this.toggleForStyle(QuillFormattingStyle.spoiler)
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
    if (!this.options.isEnabled) {
      this.lastSelection = undefined;
      this.referenceElement = undefined;
      this.render();

      return;
    }

    const isFocused = this.quill.hasFocus();
    if (!isFocused) {
      this.lastSelection = undefined;
      this.referenceElement = undefined;
      this.render();

      return;
    }

    const previousSelection = this.lastSelection;
    const quillSelection = this.quill.getSelection();
    this.lastSelection =
      quillSelection && quillSelection.length > 0
        ? {
            start: quillSelection.index,
            end: quillSelection.index + quillSelection.length,
          }
        : undefined;

    if (!this.lastSelection) {
      this.referenceElement = undefined;
    } else {
      const noOverlapWithNewSelection =
        previousSelection &&
        (this.lastSelection.end < previousSelection.start ||
          this.lastSelection.start > previousSelection.end);
      const newSelectionStartsEarlier =
        previousSelection && this.lastSelection.start < previousSelection.start;

      if (noOverlapWithNewSelection || newSelectionStartsEarlier) {
        this.referenceElement = undefined;
      }
      // a virtual reference to the text we are trying to format
      this.referenceElement = this.referenceElement || {
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

            const rect = range.getClientRects()[0];

            // If we've scrolled down and the top of the composer text is invisible, above
            //   where the editor ends, we fix the popover so it stays connected to the
            //   visible editor. Important for the 'Cmd-A' scenario when scrolled down.
            const updatedY = Math.max(
              (editorElement?.getClientRects()[0]?.y || 0) - 10,
              (rect?.y || 0) - 10
            );

            return DOMRect.fromRect({
              x: rect.x,
              y: updatedY,
              height: rect.height,
              width: rect.width,
            });
          }
          log.warn('No selection range when formatting text');
          return new DOMRect(); // don't crash just because we couldn't get a rectangle
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

  toggleForStyle(style: QuillFormattingStyle): void {
    try {
      const isEnabled = this.isStyleEnabledInSelection(style);
      if (isEnabled === undefined) {
        return;
      }
      this.quill.format(style, !isEnabled);
    } catch (error) {
      log.error('toggleForStyle error:', Errors.toLogFormat(error));
    }
  }

  render(): void {
    if (!this.lastSelection) {
      this.outsideClickDestructor?.();
      this.outsideClickDestructor = undefined;

      this.options.setFormattingChooserElement(null);

      return;
    }

    const { i18n, isSpoilersEnabled } = this.options;

    // showing the popup format menu
    const element = createPortal(
      <Popper placement="top-start" referenceElement={this.referenceElement}>
        {({ ref, style }) => (
          <div
            ref={ref}
            className="module-composition-input__format-menu"
            style={style}
            role="menu"
            tabIndex={0}
          >
            <button
              type="button"
              className="module-composition-input__format-menu__item"
              aria-label={i18n('icu:Keyboard--composer--bold')}
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                this.toggleForStyle(QuillFormattingStyle.bold);
              }}
            >
              <div
                className={classNames(
                  'module-composition-input__format-menu__item__icon',
                  'module-composition-input__format-menu__item__icon--bold',
                  this.isStyleEnabledInSelection(QuillFormattingStyle.bold)
                    ? 'module-composition-input__format-menu__item__icon--active'
                    : null
                )}
              />
            </button>
            <button
              type="button"
              className="module-composition-input__format-menu__item"
              aria-label={i18n('icu:Keyboard--composer--italic')}
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                this.toggleForStyle(QuillFormattingStyle.italic);
              }}
            >
              <div
                className={classNames(
                  'module-composition-input__format-menu__item__icon',
                  'module-composition-input__format-menu__item__icon--italic',
                  this.isStyleEnabledInSelection(QuillFormattingStyle.italic)
                    ? 'module-composition-input__format-menu__item__icon--active'
                    : null
                )}
              />
            </button>
            <button
              type="button"
              className="module-composition-input__format-menu__item"
              aria-label={i18n('icu:Keyboard--composer--strikethrough')}
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                this.toggleForStyle(QuillFormattingStyle.strike);
              }}
            >
              <div
                className={classNames(
                  'module-composition-input__format-menu__item__icon',
                  'module-composition-input__format-menu__item__icon--strikethrough',
                  this.isStyleEnabledInSelection(QuillFormattingStyle.strike)
                    ? 'module-composition-input__format-menu__item__icon--active'
                    : null
                )}
              />
            </button>
            <button
              type="button"
              className="module-composition-input__format-menu__item"
              aria-label={i18n('icu:Keyboard--composer--monospace')}
              onClick={event => {
                event.preventDefault();
                event.stopPropagation();
                this.toggleForStyle(QuillFormattingStyle.monospace);
              }}
            >
              <div
                className={classNames(
                  'module-composition-input__format-menu__item__icon',
                  'module-composition-input__format-menu__item__icon--monospace',
                  this.isStyleEnabledInSelection(QuillFormattingStyle.monospace)
                    ? 'module-composition-input__format-menu__item__icon--active'
                    : null
                )}
              />
            </button>
            {isSpoilersEnabled ? (
              <button
                type="button"
                className="module-composition-input__format-menu__item"
                aria-label={i18n('icu:Keyboard--composer--spoiler')}
                onClick={event => {
                  event.preventDefault();
                  event.stopPropagation();
                  this.toggleForStyle(QuillFormattingStyle.spoiler);
                }}
              >
                <div
                  className={classNames(
                    'module-composition-input__format-menu__item__icon',
                    'module-composition-input__format-menu__item__icon--spoiler',
                    this.isStyleEnabledInSelection(QuillFormattingStyle.spoiler)
                      ? 'module-composition-input__format-menu__item__icon--active'
                      : null
                  )}
                />
              </button>
            ) : null}
          </div>
        )}
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
