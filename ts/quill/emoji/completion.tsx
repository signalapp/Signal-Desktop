// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Quill from 'quill';
import Delta from 'quill-delta';
import React from 'react';
import _ from 'lodash';

import { Popper } from 'react-popper';
import classNames from 'classnames';
import { createPortal } from 'react-dom';
import {
  EmojiData,
  search,
  convertShortName,
  isShortName,
  convertShortNameToData,
} from '../../components/emoji/lib';
import { Emoji } from '../../components/emoji/Emoji';
import { EmojiPickDataType } from '../../components/emoji/EmojiPicker';

type UpdatedDelta = Delta;

declare module 'quill' {
  // this type is fixed in @types/quill, but our version of react-quill cannot
  // use the version of quill that has this fix in its typings
  // doing this manually allows us to use the correct type
  // https://github.com/DefinitelyTyped/DefinitelyTyped/commit/6090a81c7dbd02b6b917f903a28c6c010b8432ea#diff-bff5e435d15f8f99f733c837e76945bced86bb85e93a75467015cc9b33b48212
  interface UpdatedKey {
    key: string | number;
    shiftKey?: boolean;
  }

  interface Blot {
    text?: string;
  }

  interface Quill {
    updateContents(delta: UpdatedDelta, source?: Sources): UpdatedDelta;
    getLeaf(index: number): [Blot, number];
  }

  interface KeyboardStatic {
    addBinding(
      key: UpdatedKey,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callback: (range: RangeStatic, context: any) => void
    ): void;
  }
}

interface EmojiPickerOptions {
  onPickEmoji: (emoji: EmojiPickDataType) => void;
  setEmojiPickerElement: (element: JSX.Element | null) => void;
  skinTone: number;
}

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

    this.quill.keyboard.addBinding({ key: 37 }, clearResults); // 37 = Left
    this.quill.keyboard.addBinding({ key: 38 }, changeIndex(-1)); // 38 = Up
    this.quill.keyboard.addBinding({ key: 39 }, clearResults); // 39 = Right
    this.quill.keyboard.addBinding({ key: 40 }, changeIndex(1)); // 40 = Down

    this.quill.on('text-change', _.debounce(this.onTextChange.bind(this), 100));
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

    if (range) {
      const [blot, blotIndex] = this.quill.getLeaf(range.index);

      if (blot !== undefined && blot.text !== undefined) {
        const leftLeafText = blot.text.substr(0, blotIndex);
        const rightLeafText = blot.text.substr(blotIndex);

        return [leftLeafText, rightLeafText];
      }
    }

    return ['', ''];
  }

  onSelectionChange(): void {
    // Selection should never change while we're editing an emoji
    this.reset();
  }

  onTextChange(): void {
    const range = this.quill.getSelection();

    if (!range) return;

    const [leftLeafText, rightLeafText] = this.getCurrentLeafTextPartitions();

    const leftTokenTextMatch = /(?<=^|\s):([-+0-9a-z_]*)(:?)$/.exec(
      leftLeafText
    );
    const rightTokenTextMatch = /^([-+0-9a-z_]*):/.exec(rightLeafText);

    if (!leftTokenTextMatch) {
      this.reset();
      return;
    }

    const [, leftTokenText, isSelfClosing] = leftTokenTextMatch;

    if (isSelfClosing) {
      if (isShortName(leftTokenText)) {
        const emojiData = convertShortNameToData(
          leftTokenText,
          this.options.skinTone
        );

        if (emojiData) {
          this.insertEmoji(
            emojiData,
            range.index - leftTokenText.length - 2,
            leftTokenText.length + 2
          );
          return;
        }
      } else {
        this.reset();
        return;
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
          return;
        }
      }
    }

    if (leftTokenText.length < 2) {
      this.reset();
      return;
    }

    const results = search(leftTokenText, 10);

    if (!results.length) {
      this.reset();
      return;
    }

    this.results = results;
    this.render();
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

    const delta = new Delta()
      .retain(index)
      .delete(range)
      .insert({ emoji });

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
      <Popper
        placement="top"
        modifiers={{
          width: {
            enabled: true,
            fn: oldData => {
              const data = oldData;
              const { width, left } = data.offsets.reference;

              data.styles.width = `${width}px`;
              data.offsets.popper.width = width;
              data.offsets.popper.left = left;

              return data;
            },
            order: 840,
          },
        }}
      >
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
