// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { Delta } from '@signalapp/quill-cjs';
import Emitter from '@signalapp/quill-cjs/core/emitter.js';
import React from 'react';
import lodash from 'lodash';
import type Quill from '@signalapp/quill-cjs';
import { Popper } from 'react-popper';
import classNames from 'classnames';
import { createPortal } from 'react-dom';
import type { VirtualElement } from '@popperjs/core';
import { getBlotTextPartitions, matchBlotTextPartitions } from '../util.dom.js';
import { handleOutsideClick } from '../../util/handleOutsideClick.dom.js';
import { createLogger } from '../../logging/log.std.js';
import { FunStaticEmoji } from '../../components/fun/FunEmoji.dom.js';
import type { EmojiParentKey } from '../../components/fun/data/emojis.std.js';
import {
  EmojiSkinTone,
  getEmojiVariantByParentKeyAndSkinTone,
  normalizeShortNameCompletionDisplay,
} from '../../components/fun/data/emojis.std.js';
import type {
  FunEmojiSearchResult,
  FunEmojiSearch,
} from '../../components/fun/useFunEmojiSearch.dom.js';
import { type FunEmojiLocalizer } from '../../components/fun/useFunEmojiLocalizer.dom.js';
import type { FunEmojiSelection } from '../../components/fun/panels/FunPanelEmojis.dom.js';

const { isNumber, debounce } = lodash;

const log = createLogger('completion');

export type EmojiCompletionOptions = {
  onSelectEmoji: (emojiSelection: FunEmojiSelection) => void;
  setEmojiPickerElement: (element: JSX.Element | null) => void;
  emojiSkinToneDefault: EmojiSkinTone | null;
  emojiSearch: FunEmojiSearch;
  emojiLocalizer: FunEmojiLocalizer;
};

export type InsertEmojiOptionsType = Readonly<{
  emojiParentKey: EmojiParentKey;
  index: number;
  range: number;
  withTrailingSpace?: boolean;
  justPressedColon?: boolean;
}>;

export class EmojiCompletion {
  results: ReadonlyArray<FunEmojiSearchResult>;

  index: number;

  options: EmojiCompletionOptions;

  root: HTMLDivElement;

  quill: Quill;

  outsideClickDestructor?: () => void;

  constructor(quill: Quill, options: EmojiCompletionOptions) {
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

    this.quill.keyboard.addBinding({ key: 'ArrowUp' }, changeIndex(-1));
    this.quill.keyboard.addBinding({ key: 'ArrowRight' }, clearResults);
    this.quill.keyboard.addBinding({ key: 'ArrowDown' }, changeIndex(1));
    this.quill.keyboard.addBinding({ key: 'ArrowLeft' }, clearResults);
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

    const debouncedOnTextChange = debounce(() => this.onTextChange(), 100);

    this.quill.on(Emitter.events.TEXT_CHANGE, (_now, _before, source) => {
      if (source === 'user') {
        debouncedOnTextChange();
      }
    });
    this.quill.on(
      Emitter.events.SELECTION_CHANGE,
      this.onSelectionChange.bind(this)
    );
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
    const text = blot?.value();
    if (text && typeof text !== 'string') {
      throw new Error(
        'EmojiCompletion/getCurrentLeafTextPartitions: Blot value was not a string'
      );
    }

    return getBlotTextPartitions(text, index);
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
      /(?<=^|\s):([-+0-9\p{Alpha}_]*)(:?)$/iu,
      /^([-+0-9\p{Alpha}_]*):/iu
    );

    if (leftTokenTextMatch) {
      const [, leftTokenText, isSelfClosing] = leftTokenTextMatch;

      if (isSelfClosing || justPressedColon) {
        const parentKey =
          this.options.emojiLocalizer.getParentKeyForText(leftTokenText);
        if (parentKey != null) {
          const numberOfColons = isSelfClosing ? 2 : 1;

          this.insertEmoji({
            emojiParentKey: parentKey,
            index: range.index - leftTokenText.length - numberOfColons,
            range: leftTokenText.length + numberOfColons,
            justPressedColon,
          });
          return INTERCEPT;
        }
        this.reset();
        return PASS_THROUGH;
      }

      if (rightTokenTextMatch) {
        const [, rightTokenText] = rightTokenTextMatch;
        const tokenText = leftTokenText + rightTokenText;
        const parentKey =
          this.options.emojiLocalizer.getParentKeyForText(tokenText);

        if (parentKey != null) {
          this.insertEmoji({
            emojiParentKey: parentKey,
            index: range.index - leftTokenText.length - 1,
            range: tokenText.length + 2,
            justPressedColon,
          });
          return INTERCEPT;
        }
      }

      if (leftTokenText.length < 2) {
        this.reset();
        return PASS_THROUGH;
      }

      const showEmojiResults = this.options.emojiSearch(leftTokenText, 10);

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

    const result = this.results[this.index];
    const [leafText] = this.getCurrentLeafTextPartitions();

    const tokenTextMatch = /:([-+0-9\p{Alpha}_]*)(:?)$/iu.exec(leafText);

    if (tokenTextMatch == null) {
      return;
    }

    const [, tokenText] = tokenTextMatch;

    this.insertEmoji({
      emojiParentKey: result.parentKey,
      index: range.index - tokenText.length - 1,
      range: tokenText.length + 1,
      withTrailingSpace: true,
    });
  }

  insertEmoji({
    emojiParentKey,
    index,
    range,
    withTrailingSpace = false,
    justPressedColon = false,
  }: InsertEmojiOptionsType): void {
    const skinTone = this.options.emojiSkinToneDefault ?? EmojiSkinTone.None;
    const emojiVariant = getEmojiVariantByParentKeyAndSkinTone(
      emojiParentKey,
      skinTone
    );

    let source = this.quill.getText(index, range);
    if (justPressedColon) {
      source += ':';
    }

    const delta = new Delta()
      .retain(index)
      .delete(range)
      .insert({
        emoji: { value: emojiVariant.value, source },
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

    this.options.onSelectEmoji({
      variantKey: emojiVariant.key,
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
                ? emojiResults[emojiResultsIndex].parentKey
                : ''
            }`}
            tabIndex={0}
          >
            {emojiResults.map((result, index) => {
              const emojiVariant = getEmojiVariantByParentKeyAndSkinTone(
                result.parentKey,
                this.options.emojiSkinToneDefault ?? EmojiSkinTone.None
              );

              const localeShortName =
                this.options.emojiLocalizer.getLocaleShortName(
                  emojiVariant.key
                );

              const normalized =
                normalizeShortNameCompletionDisplay(localeShortName);

              return (
                <button
                  type="button"
                  key={result.parentKey}
                  id={`emoji-result--${result.parentKey}`}
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
                  <FunStaticEmoji
                    role="presentation"
                    emoji={emojiVariant}
                    size={16}
                  />
                  <div className="module-composition-input__suggestions__row__short-name">
                    :{normalized}:
                  </div>
                </button>
              );
            })}
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
