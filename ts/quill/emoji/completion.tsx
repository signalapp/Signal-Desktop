// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Quill from 'quill';
import Delta from 'quill-delta';
import React from 'react';
import _, { isNumber } from 'lodash';

import { Popper } from 'react-popper';
import classNames from 'classnames';
import { createPortal } from 'react-dom';
import type { VirtualElement } from '@popperjs/core';
import type { EmojiData } from '../../components/emoji/lib';
import {
  search,
  convertShortName,
  isShortName,
  convertShortNameToData,
} from '../../components/emoji/lib';
import { Emoji } from '../../components/emoji/Emoji';
import type { EmojiPickDataType } from '../../components/emoji/EmojiPicker';
import { getBlotTextPartitions, matchBlotTextPartitions } from '../util';
import { handleOutsideClick } from '../../util/handleOutsideClick';
import * as log from '../../logging/log';

const Keyboard = Quill.import('modules/keyboard');

type EmojiPickerOptions = {
  onPickEmoji: (emoji: EmojiPickDataType) => void;
  setEmojiPickerElement: (element: JSX.Element | null) => void;
  skinTone: number;
};

export class EmojiCompletion {
  results: Array<EmojiData>;

  index: number;

  options: EmojiPickerOptions;

  root: HTMLDivElement;

  quill: Quill;

  outsideClickDestructor?: () => void;

  constructor(quill: Quill, options: EmojiPickerOptions) {
    this.results = [];
    this.index = 0;
    this.options = options;
    this.root = document.body.appendChild(document.createElement('div'));
    this.quill = quill;

    const clearResults = () => {
      if (this.results.length) {
        this.reset();
      }

      return true;
    };

    const changeIndex = (by: number) => (): boolean => {
      if (this.results.length) {
        this.changeIndex(by);
        return false;
      }

      return true;
    };

    this.quill.keyboard.addBinding({ key: Keyboard.keys.UP }, changeIndex(-1));
    this.quill.keyboard.addBinding({ key: Keyboard.keys.RIGHT }, clearResults);
    this.quill.keyboard.addBinding({ key: Keyboard.keys.DOWN }, changeIndex(1));
    this.quill.keyboard.addBinding({ key: Keyboard.keys.LEFT }, clearResults);
    this.quill.keyboard.addBinding(
      {
        // 186 + Shift = Colon
        key: 186,
        shiftKey: true,
      },
      () => this.onTextChange(true)
    );
    this.quill.keyboard.addBinding(
      {
        // 58 = Also Colon
        key: 58,
      },
      () => this.onTextChange(true)
    );

    this.quill.on(
      'text-change',
      _.debounce(() => this.onTextChange(), 100)
    );
    this.quill.on('selection-change', this.onSelectionChange.bind(this));
  }

  destroy(): void {
    this.outsideClickDestructor?.();
    this.outsideClickDestructor = undefined;
    this.root.remove();
  }

  changeIndex(by: number): void {
    this.index = (this.index + by + this.results.length) % this.results.length;
    this.render();
  }

  getCurrentLeafTextPartitions(): [string, string] {
    const range = this.quill.getSelection();
    const [blot, index] = this.quill.getLeaf(range ? range.index : -1);

    return getBlotTextPartitions(blot.text, index);
  }

  onSelectionChange(): void {
    // Selection should never change while we're editing an emoji
    this.reset();
  }

  onTextChange(justPressedColon = false): boolean {
    const PASS_THROUGH = true;
    const INTERCEPT = false;

    const range = this.quill.getSelection();

    if (!range) {
      return PASS_THROUGH;
    }

    const [blot, index] = this.quill.getLeaf(range.index);
    const [leftTokenTextMatch, rightTokenTextMatch] = matchBlotTextPartitions(
      blot,
      index,
      /(?<=^|\s):([-+0-9a-zA-Z_]*)(:?)$/,
      /^([-+0-9a-zA-Z_]*):/
    );

    if (leftTokenTextMatch) {
      const [, leftTokenText, isSelfClosing] = leftTokenTextMatch;

      if (isSelfClosing || justPressedColon) {
        if (isShortName(leftTokenText)) {
          const emojiData = convertShortNameToData(
            leftTokenText,
            this.options.skinTone
          );

          const numberOfColons = isSelfClosing ? 2 : 1;

          if (emojiData) {
            this.insertEmoji(
              emojiData,
              range.index - leftTokenText.length - numberOfColons,
              leftTokenText.length + numberOfColons
            );
            return INTERCEPT;
          }
        } else {
          this.reset();
          return PASS_THROUGH;
        }
      }

      if (rightTokenTextMatch) {
        const [, rightTokenText] = rightTokenTextMatch;
        const tokenText = leftTokenText + rightTokenText;

        if (isShortName(tokenText)) {
          const emojiData = convertShortNameToData(
            tokenText,
            this.options.skinTone
          );

          if (emojiData) {
            this.insertEmoji(
              emojiData,
              range.index - leftTokenText.length - 1,
              tokenText.length + 2
            );
            return INTERCEPT;
          }
        }
      }

      if (leftTokenText.length < 2) {
        this.reset();
        return PASS_THROUGH;
      }

      const showEmojiResults = search(leftTokenText, 10);

      if (showEmojiResults.length > 0) {
        this.results = showEmojiResults;
        this.index = Math.min(this.results.length - 1, this.index);
        this.render();
      } else if (this.results.length !== 0) {
        this.reset();
      }
    } else if (this.results.length !== 0) {
      this.reset();
    }

    return PASS_THROUGH;
  }

  getAttributesForInsert(index: number): Record<string, unknown> {
    const character = index > 0 ? index - 1 : 0;
    const contents = this.quill.getContents(character, 1);
    return contents.ops.reduce(
      (acc, op) => ({ acc, ...op.attributes }),
      {} as Record<string, unknown>
    );
  }

  completeEmoji(): void {
    const range = this.quill.getSelection();

    if (range == null) {
      return;
    }

    const emoji = this.results[this.index];
    const [leafText] = this.getCurrentLeafTextPartitions();

    const tokenTextMatch = /:([-+0-9a-z_]*)(:?)$/.exec(leafText);

    if (tokenTextMatch == null) {
      return;
    }

    const [, tokenText] = tokenTextMatch;

    this.insertEmoji(
      emoji,
      range.index - tokenText.length - 1,
      tokenText.length + 1,
      true
    );
  }

  insertEmoji(
    emojiData: EmojiData,
    index: number,
    range: number,
    withTrailingSpace = false
  ): void {
    const emoji = convertShortName(emojiData.short_name, this.options.skinTone);

    const delta = new Delta()
      .retain(index)
      .delete(range)
      .insert({
        emoji: { value: emoji },
      });

    if (withTrailingSpace) {
      // The extra space we add won't be formatted unless we manually provide attributes
      const attributes = this.getAttributesForInsert(range - 1);
      this.quill.updateContents(delta.insert(' ', attributes), 'user');
      this.quill.setSelection(index + 2, 0, 'user');
    } else {
      this.quill.updateContents(delta, 'user');
      this.quill.setSelection(index + 1, 0, 'user');
    }

    this.options.onPickEmoji({
      shortName: emojiData.short_name,
      skinTone: this.options.skinTone,
    });

    this.reset();
  }

  reset(): void {
    if (this.results.length) {
      this.results = [];
      this.index = 0;

      this.render();
    }
  }

  onUnmount(): void {
    this.outsideClickDestructor?.();
    this.outsideClickDestructor = undefined;
    this.options.setEmojiPickerElement(null);
  }

  render(): void {
    const { results: emojiResults, index: emojiResultsIndex } = this;

    if (emojiResults.length === 0) {
      this.onUnmount();
      return;
    }

    // a virtual reference to the text we are trying to auto-complete
    const reference: VirtualElement = {
      getBoundingClientRect() {
        const selection = window.getSelection();
        // there's a selection and at least one range
        if (selection != null && selection.rangeCount !== 0) {
          // grab the first range, the one the user is actually on right now
          // clone it so we don't actually modify the user's selection/caret position
          const range = selection.getRangeAt(0).cloneRange();

          // if for any reason the range is a selection (not just a caret)
          // collapse it to just a caret, so we can walk it back to the :word
          range.collapse(true);

          // if we can, position the popper at the beginning of the emoji text (:word)
          const textBeforeCursor = range.endContainer.textContent?.slice(
            0,
            range.startOffset
          );
          const startOfEmojiText = textBeforeCursor?.lastIndexOf(':');

          if (
            textBeforeCursor &&
            isNumber(startOfEmojiText) &&
            startOfEmojiText !== -1
          ) {
            range.setStart(range.endContainer, startOfEmojiText);
          } else {
            log.warn(
              `Could not find the beginning of the emoji word to be completed. startOfEmojiText=${startOfEmojiText}, textBeforeCursor.length=${textBeforeCursor?.length}, range.offsets=${range.startOffset}-${range.endOffset}`
            );
          }
          return range.getClientRects()[0];
        }
        log.warn('No selection range when auto-completing emoji');
        return new DOMRect(); // don't crash just because we couldn't get a rectangle
      },
    };

    const element = createPortal(
      <Popper placement="top-start" referenceElement={reference}>
        {({ ref, style }) => (
          <div
            ref={ref}
            className="module-composition-input__suggestions"
            style={style}
            role="listbox"
            aria-expanded
            aria-activedescendant={`emoji-result--${
              emojiResults.length
                ? emojiResults[emojiResultsIndex].short_name
                : ''
            }`}
            tabIndex={0}
          >
            {emojiResults.map((emoji, index) => (
              <button
                type="button"
                key={emoji.short_name}
                id={`emoji-result--${emoji.short_name}`}
                role="option button"
                aria-selected={emojiResultsIndex === index}
                onClick={() => {
                  this.index = index;
                  this.completeEmoji();
                }}
                className={classNames(
                  'module-composition-input__suggestions__row',
                  emojiResultsIndex === index
                    ? 'module-composition-input__suggestions__row--selected'
                    : null
                )}
              >
                <Emoji
                  shortName={emoji.short_name}
                  size={16}
                  skinTone={this.options.skinTone}
                />
                <div className="module-composition-input__suggestions__row__short-name">
                  :{emoji.short_name}:
                </div>
              </button>
            ))}
          </div>
        )}
      </Popper>,
      this.root
    );

    // Just to make sure that we don't propagate outside clicks until this
    // is closed.
    this.outsideClickDestructor?.();
    this.outsideClickDestructor = handleOutsideClick(
      () => {
        this.onUnmount();
        return true;
      },
      {
        name: 'quill.emoji.completion',
        containerElements: [this.root],
      }
    );

    this.options.setEmojiPickerElement(element);
  }
}
