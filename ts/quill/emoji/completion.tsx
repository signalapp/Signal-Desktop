// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Quill from 'quill';
import Delta from 'quill-delta';
import React from 'react';
import _ from 'lodash';

import { Popper } from 'react-popper';
import classNames from 'classnames';
import { createPortal } from 'react-dom';
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
import { sameWidthModifier } from '../../util/popperUtil';

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

    if (!range) return PASS_THROUGH;

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

      if (leftTokenText.length < 3) {
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

  completeEmoji(): void {
    const range = this.quill.getSelection();

    if (range === null) return;

    const emoji = this.results[this.index];
    const [leafText] = this.getCurrentLeafTextPartitions();

    const tokenTextMatch = /:([-+0-9a-z_]*)(:?)$/.exec(leafText);

    if (tokenTextMatch === null) return;

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

    const delta = new Delta().retain(index).delete(range).insert({ emoji });

    if (withTrailingSpace) {
      this.quill.updateContents(delta.insert(' '), 'user');
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
    document.body.removeChild(this.root);
  }

  render(): void {
    const { results: emojiResults, index: emojiResultsIndex } = this;

    if (emojiResults.length === 0) {
      this.options.setEmojiPickerElement(null);
      return;
    }

    const element = createPortal(
      <Popper placement="top-start" modifiers={[sameWidthModifier]}>
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

    this.options.setEmojiPickerElement(element);
  }
}
