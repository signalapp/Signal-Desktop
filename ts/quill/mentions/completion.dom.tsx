// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createRef } from 'react';
import _ from 'lodash';
import { Delta } from '@signalapp/quill-cjs';
import Emitter from '@signalapp/quill-cjs/core/emitter.js';
import type Quill from '@signalapp/quill-cjs';
import type { RefObject, JSX } from 'react';
import { Popover } from 'radix-ui';
import classNames from 'classnames';

import { Avatar, AvatarSize } from '../../components/Avatar.dom.tsx';
import type { LocalizerType, ThemeType } from '../../types/Util.std.ts';
import type { MemberType, MemberRepository } from '../memberRepository.std.ts';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges.preload.ts';
import {
  clearActiveCompletionOption,
  matchBlotTextPartitions,
  setActiveCompletionOption,
} from '../util.dom.ts';
import type { MentionBlotValue } from '../util.dom.ts';
import { strictAssert } from '../../util/assert.std.ts';
import { UserText } from '../../components/UserText.dom.tsx';

export type MentionCompletionOptions = {
  /** Results sit above it at the same width. A getter since Quill clones options before mount */
  getAnchorElement: () => HTMLElement | null;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  memberRepositoryRef: RefObject<MemberRepository>;
  setMentionPickerElement: (element: JSX.Element | null) => void;
  ourConversationId: string | undefined;
  theme: ThemeType;
};

const MENTION_REGEX = /(?:^|\W)@([-+\p{L}\p{M}\p{N}]*)$/u;
type MentionRegexMatch = RegExpMatchArray & { 1: string };

// oxlint-disable-next-line react/prefer-function-component
export class MentionCompletion {
  results: ReadonlyArray<MemberType>;

  index: number;

  quill: Quill;

  options: MentionCompletionOptions;

  suggestionListRef: RefObject<HTMLDivElement | null>;

  readonly #listId = `mention-completion-${crypto.randomUUID()}`;

  constructor(quill: Quill, options: MentionCompletionOptions) {
    this.results = [];
    this.index = 0;
    this.options = options;
    this.quill = quill;
    this.suggestionListRef = createRef<HTMLDivElement>();

    const clearResults = () => {
      if (this.results.length) {
        this.clearResults();
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

    this.quill.on(
      Emitter.events.TEXT_CHANGE,
      _.debounce(this.onTextChange.bind(this), 0)
    );
    this.quill.on(
      Emitter.events.SELECTION_CHANGE,
      this.onSelectionChange.bind(this)
    );
  }

  readonly #handleOpenChange = (open: boolean): void => {
    if (!open) {
      this.clearResults();
    }
  };

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

  onSelectionChange(): void {
    // Selection should never change while we're editing a mention
    this.clearResults();
  }

  possiblyShowMemberResults(): ReadonlyArray<MemberType> {
    const range = this.quill.getSelection();

    if (range) {
      const [blot, index] = this.quill.getLeaf(range.index);

      const [leftTokenTextMatch] = matchBlotTextPartitions(
        blot,
        index,
        MENTION_REGEX
      );

      if (leftTokenTextMatch) {
        const [, leftTokenText] = leftTokenTextMatch as MentionRegexMatch;

        let results: ReadonlyArray<MemberType> = [];

        const memberRepository = this.options.memberRepositoryRef.current;

        if (memberRepository) {
          if (leftTokenText === '') {
            results = memberRepository.getMembers(
              this.options.ourConversationId
            );
          } else {
            const fullMentionText = leftTokenText;
            results = memberRepository.search(
              fullMentionText,
              this.options.ourConversationId
            );
          }
        }

        return results;
      }
    }

    return [];
  }

  onTextChange(): void {
    const showMemberResults = this.possiblyShowMemberResults();

    if (showMemberResults.length > 0) {
      this.results = showMemberResults;
      this.index = 0;
      this.render();
    } else if (this.results.length !== 0) {
      this.clearResults();
    }
  }

  completeMention(resultIndexArg?: number): void {
    const resultIndex = resultIndexArg || this.index;

    const range = this.quill.getSelection();

    if (range == null) {
      return;
    }

    const member = this.results[resultIndex];
    if (member == null) {
      return;
    }

    const [blot, index] = this.quill.getLeaf(range.index);

    const [leftTokenTextMatch] = matchBlotTextPartitions(
      blot,
      index,
      MENTION_REGEX
    );

    if (leftTokenTextMatch) {
      const [, leftTokenText] = leftTokenTextMatch as MentionRegexMatch;

      this.insertMention(
        member,
        range.index - leftTokenText.length - 1,
        leftTokenText.length + 1,
        true
      );
    }
  }

  getAttributesForInsert(index: number): Record<string, unknown> {
    const character = index > 0 ? index - 1 : 0;
    const contents = this.quill.getContents(character, 1);
    return contents.ops.reduce<Record<string, unknown>>(
      (acc, op) => ({ ...acc, ...op.attributes }),
      {}
    );
  }

  insertMention(
    member: MemberType,
    index: number,
    range: number,
    withTrailingSpace = false
  ): void {
    // The mention + space we add won't be formatted unless we manually provide attributes
    const attributes = this.getAttributesForInsert(range - 1);

    const mention: MentionBlotValue = {
      aci: member.aci,
      title: member.title,
    };

    const delta = new Delta()
      .retain(index)
      .delete(range)
      .insert({ mention }, attributes);

    if (withTrailingSpace) {
      this.quill.updateContents(delta.insert(' ', attributes), 'user');
      this.quill.setSelection(index + 2, 0, 'user');
    } else {
      this.quill.updateContents(delta, 'user');
      this.quill.setSelection(index + 1, 0, 'user');
    }

    this.clearResults();
  }

  clearResults(): void {
    this.results = [];
    this.index = 0;

    this.render();
  }

  onUnmount(): void {
    clearActiveCompletionOption(this.quill.root, this.#listId);
    this.options.setMentionPickerElement(null);
  }

  render(): void {
    const { results: memberResults, index: memberResultsIndex } = this;
    const { getPreferredBadge, theme } = this.options;

    if (memberResults.length === 0) {
      this.onUnmount();
      return;
    }

    const anchor = this.options.getAnchorElement();
    strictAssert(anchor, 'MentionCompletion: Missing anchor element');

    const element = (
      <Popover.Root open onOpenChange={this.#handleOpenChange} modal={false}>
        <Popover.Anchor virtualRef={{ current: anchor }} />
        <Popover.Portal>
          <Popover.Content
            asChild
            side="top"
            align="start"
            // Focus stays in the editor
            onOpenAutoFocus={event => event.preventDefault()}
            onCloseAutoFocus={event => event.preventDefault()}
            onFocusOutside={event => event.preventDefault()}
          >
            <div
              id={this.#listId}
              className="module-composition-input__suggestions"
              style={{ width: 'var(--radix-popper-anchor-width)' }}
              role="listbox"
            >
              <div
                ref={this.suggestionListRef}
                className="module-composition-input__suggestions--scroller"
              >
                {memberResults.map((member, index) => (
                  <button
                    type="button"
                    key={member.aci}
                    id={`${this.#listId}-${index}`}
                    role="option"
                    aria-selected={memberResultsIndex === index}
                    onClick={() => {
                      this.completeMention(index);
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
                      avatarPlaceholderGradient={
                        member.avatarPlaceholderGradient
                      }
                      avatarUrl={member.avatarUrl}
                      badge={getPreferredBadge(member.badges)}
                      conversationType="direct"
                      hasAvatar={member.hasAvatar}
                      i18n={this.options.i18n}
                      size={AvatarSize.TWENTY_EIGHT}
                      theme={theme}
                      title={member.title}
                    />
                    <div className="module-composition-input__suggestions__title">
                      <UserText text={member.title} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );

    setActiveCompletionOption(
      this.quill.root,
      this.#listId,
      `${this.#listId}-${memberResultsIndex}`
    );
    this.options.setMentionPickerElement(element);
  }
}
