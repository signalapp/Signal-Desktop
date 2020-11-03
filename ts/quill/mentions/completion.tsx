// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import Quill from 'quill';
import Delta from 'quill-delta';
import React, { RefObject } from 'react';

import { Popper } from 'react-popper';
import classNames from 'classnames';
import { createPortal } from 'react-dom';
import { ConversationType } from '../../state/ducks/conversations';
import { Avatar } from '../../components/Avatar';
import { LocalizerType } from '../../types/Util';
import { MemberRepository } from '../util';

export interface MentionCompletionOptions {
  i18n: LocalizerType;
  memberRepositoryRef: RefObject<MemberRepository>;
  setMentionPickerElement: (element: JSX.Element | null) => void;
  me?: ConversationType;
}

declare global {
  interface HTMLElement {
    // Webkit-specific
    scrollIntoViewIfNeeded: (bringToCenter: boolean) => void;
  }
}

const MENTION_REGEX = /(?:^|\W)@([-+\w]*)$/;

export class MentionCompletion {
  results: Array<ConversationType>;

  index: number;

  root: HTMLDivElement;

  quill: Quill;

  options: MentionCompletionOptions;

  suggestionListRef: RefObject<HTMLDivElement>;

  constructor(quill: Quill, options: MentionCompletionOptions) {
    this.results = [];
    this.index = 0;
    this.options = options;
    this.root = document.body.appendChild(document.createElement('div'));
    this.quill = quill;
    this.suggestionListRef = React.createRef<HTMLDivElement>();

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

    this.quill.keyboard.addBinding({ key: 37 }, clearResults); // Left Arrow
    this.quill.keyboard.addBinding({ key: 38 }, changeIndex(-1)); // Up Arrow
    this.quill.keyboard.addBinding({ key: 39 }, clearResults); // Right Arrow
    this.quill.keyboard.addBinding({ key: 40 }, changeIndex(1)); // Down Arrow

    this.quill.on('text-change', this.onTextChange.bind(this));
    this.quill.on('selection-change', this.onSelectionChange.bind(this));
  }

  destroy(): void {
    this.root.remove();
  }

  changeIndex(by: number): void {
    this.index = (this.index + by + this.results.length) % this.results.length;
    this.render();
    const suggestionList = this.suggestionListRef.current;
    if (suggestionList) {
      const selectedElement = suggestionList.querySelector<HTMLElement>(
        '[aria-selected="true"]'
      );
      if (selectedElement) {
        selectedElement.scrollIntoViewIfNeeded(false);
      }
    }
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
    // Selection should never change while we're editing a mention
    this.reset();
  }

  onTextChange(): void {
    const range = this.quill.getSelection();

    if (!range) return;

    const [leftLeafText] = this.getCurrentLeafTextPartitions();

    const leftTokenTextMatch = MENTION_REGEX.exec(leftLeafText);

    if (!leftTokenTextMatch) {
      this.reset();
      return;
    }

    const [, leftTokenText] = leftTokenTextMatch;

    let results: Array<ConversationType> = [];

    const memberRepository = this.options.memberRepositoryRef.current;

    if (memberRepository) {
      if (leftTokenText === '') {
        results = memberRepository.getMembers(this.options.me);
      } else {
        const fullMentionText = leftTokenText;
        results = memberRepository.search(fullMentionText, this.options.me);
      }
    }

    if (!results.length) {
      this.reset();
      return;
    }

    this.results = results;
    this.index = 0;
    this.render();
  }

  completeMention(): void {
    const range = this.quill.getSelection();

    if (range === null) return;

    const member = this.results[this.index];
    const [leftLeafText] = this.getCurrentLeafTextPartitions();

    const leftTokenTextMatch = MENTION_REGEX.exec(leftLeafText);

    if (leftTokenTextMatch === null) return;

    const [, leftTokenText] = leftTokenTextMatch;

    this.insertMention(
      member,
      range.index - leftTokenText.length - 1,
      leftTokenText.length + 1,
      true
    );
  }

  insertMention(
    member: ConversationType,
    index: number,
    range: number,
    withTrailingSpace = false
  ): void {
    const mention = member;
    const delta = new Delta()
      .retain(index)
      .delete(range)
      .insert({ mention });

    if (withTrailingSpace) {
      this.quill.updateContents(delta.insert(' '), 'user');
      this.quill.setSelection(index + 2, 0, 'user');
    } else {
      this.quill.updateContents(delta, 'user');
      this.quill.setSelection(index + 1, 0, 'user');
    }

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
    const { results: memberResults, index: memberResultsIndex } = this;

    if (memberResults.length === 0) {
      this.options.setMentionPickerElement(null);
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
            aria-activedescendant={`mention-result--${
              memberResults.length ? memberResults[memberResultsIndex].name : ''
            }`}
            tabIndex={0}
          >
            <div
              ref={this.suggestionListRef}
              className="module-composition-input__suggestions--scroller"
            >
              {memberResults.map((member, index) => (
                <button
                  type="button"
                  key={member.uuid}
                  id={`mention-result--${member.name}`}
                  role="option button"
                  aria-selected={memberResultsIndex === index}
                  onClick={() => {
                    this.index = index;
                    this.completeMention();
                  }}
                  className={classNames(
                    'module-composition-input__suggestions__row',
                    'module-composition-input__suggestions__row--mention',
                    memberResultsIndex === index
                      ? 'module-composition-input__suggestions__row--selected'
                      : null
                  )}
                >
                  <Avatar
                    avatarPath={member.avatarPath}
                    conversationType="direct"
                    i18n={this.options.i18n}
                    size={28}
                    title={member.title}
                  />
                  <div className="module-composition-input__suggestions__title">
                    {member.title}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </Popper>,
      this.root
    );

    this.options.setMentionPickerElement(element);
  }
}
