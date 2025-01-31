// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import _ from 'lodash';
import { Delta } from '@signalapp/quill-cjs';
import Emitter from '@signalapp/quill-cjs/core/emitter';
import type Quill from '@signalapp/quill-cjs';
import type { RefObject } from 'react';
import { Popper } from 'react-popper';
import classNames from 'classnames';
import { createPortal } from 'react-dom';

import { Avatar, AvatarSize } from '../../components/Avatar';
import type { LocalizerType, ThemeType } from '../../types/Util';
import type { MemberType, MemberRepository } from '../memberRepository';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges';
import { matchBlotTextPartitions } from '../util';
import type { MentionBlotValue } from '../util';
import { handleOutsideClick } from '../../util/handleOutsideClick';
import { sameWidthModifier } from '../../util/popperUtil';
import { UserText } from '../../components/UserText';

export type MentionCompletionOptions = {
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  memberRepositoryRef: RefObject<MemberRepository>;
  setMentionPickerElement: (element: JSX.Element | null) => void;
  ourConversationId: string | undefined;
  theme: ThemeType;
};

const MENTION_REGEX = /(?:^|\W)@([-+\p{L}\p{M}\p{N}]*)$/u;

export class MentionCompletion {
  results: ReadonlyArray<MemberType>;

  index: number;

  root: HTMLDivElement;

  quill: Quill;

  options: MentionCompletionOptions;

  suggestionListRef: RefObject<HTMLDivElement>;

  outsideClickDestructor?: () => void;

  constructor(quill: Quill, options: MentionCompletionOptions) {
    this.results = [];
    this.index = 0;
    this.options = options;
    this.root = document.body.appendChild(document.createElement('div'));
    this.quill = quill;
    this.suggestionListRef = React.createRef<HTMLDivElement>();

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

  destroy(): void {
    this.outsideClickDestructor?.();
    this.outsideClickDestructor = undefined;

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
        const [, leftTokenText] = leftTokenTextMatch;

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

    const [blot, index] = this.quill.getLeaf(range.index);

    const [leftTokenTextMatch] = matchBlotTextPartitions(
      blot,
      index,
      MENTION_REGEX
    );

    if (leftTokenTextMatch) {
      const [, leftTokenText] = leftTokenTextMatch;

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
    return contents.ops.reduce(
      (acc, op) => ({ acc, ...op.attributes }),
      {} as Record<string, unknown>
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
    this.outsideClickDestructor?.();
    this.outsideClickDestructor = undefined;
    this.options.setMentionPickerElement(null);
  }

  render(): void {
    const { results: memberResults, index: memberResultsIndex } = this;
    const { getPreferredBadge, theme } = this.options;

    if (memberResults.length === 0) {
      this.onUnmount();
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
                  key={member.aci}
                  id={`mention-result--${member.name}`}
                  role="option button"
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
                    acceptedMessageRequest={member.acceptedMessageRequest}
                    avatarUrl={member.avatarUrl}
                    badge={getPreferredBadge(member.badges)}
                    conversationType="direct"
                    i18n={this.options.i18n}
                    isMe={member.isMe}
                    sharedGroupNames={member.sharedGroupNames}
                    size={AvatarSize.TWENTY_EIGHT}
                    theme={theme}
                    title={member.title}
                    unblurredAvatarUrl={member.unblurredAvatarUrl}
                  />
                  <div className="module-composition-input__suggestions__title">
                    <UserText text={member.title} />
                  </div>
                </button>
              ))}
            </div>
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
        name: 'quill.mentions.completion',
        containerElements: [this.root],
      }
    );

    this.options.setMentionPickerElement(element);
  }
}
