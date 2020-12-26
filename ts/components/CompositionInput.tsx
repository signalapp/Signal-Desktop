// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import Delta from 'quill-delta';
import ReactQuill from 'react-quill';
import classNames from 'classnames';
import { Manager, Reference } from 'react-popper';
import Quill, { KeyboardStatic, RangeStatic } from 'quill';

import { MentionCompletion } from '../quill/mentions/completion';
import { EmojiBlot, EmojiCompletion } from '../quill/emoji';
import { EmojiPickDataType } from './emoji/EmojiPicker';
import { convertShortName } from './emoji/lib';
import { LocalizerType, BodyRangeType } from '../types/Util';
import { ConversationType } from '../state/ducks/conversations';
import { MentionBlot } from '../quill/mentions/blot';
import {
  matchEmojiImage,
  matchEmojiBlot,
  matchReactEmoji,
  matchEmojiText,
} from '../quill/emoji/matchers';
import { matchMention } from '../quill/mentions/matchers';
import { MemberRepository } from '../quill/memberRepository';
import {
  getDeltaToRemoveStaleMentions,
  getTextAndMentionsFromOps,
  isMentionBlot,
  getDeltaToRestartMention,
  insertMentionOps,
  insertEmojiOps,
} from '../quill/util';
import { SignalClipboard } from '../quill/signal-clipboard';
import { DirectionalBlot } from '../quill/block/blot';
import { AutoSubstituteAsciiEmojis } from '../quill/auto-substitute-ascii-emojis';

Quill.register('formats/emoji', EmojiBlot);
Quill.register('formats/mention', MentionBlot);
Quill.register('formats/block', DirectionalBlot);
Quill.register('modules/emojiCompletion', EmojiCompletion);
Quill.register('modules/autoSubstituteAsciiEmojis', AutoSubstituteAsciiEmojis);
Quill.register('modules/mentionCompletion', MentionCompletion);
Quill.register('modules/signalClipboard', SignalClipboard);

interface HistoryStatic {
  undo(): void;
  clear(): void;
}

export interface InputApi {
  focus: () => void;
  insertEmoji: (e: EmojiPickDataType) => void;
  reset: () => void;
  resetEmojiResults: () => void;
  submit: () => void;
}

export interface Props {
  readonly i18n: LocalizerType;
  readonly disabled?: boolean;
  readonly large?: boolean;
  readonly inputApi?: React.MutableRefObject<InputApi | undefined>;
  readonly skinTone?: EmojiPickDataType['skinTone'];
  readonly draftText?: string;
  readonly draftBodyRanges?: Array<BodyRangeType>;
  members?: Array<ConversationType>;
  onDirtyChange?(dirty: boolean): unknown;
  onEditorStateChange?(
    messageText: string,
    bodyRanges: Array<BodyRangeType>,
    caretLocation?: number
  ): unknown;
  onTextTooLong(): unknown;
  onPickEmoji(o: EmojiPickDataType): unknown;
  onSubmit(message: string, mentions: Array<BodyRangeType>): unknown;
  getQuotedMessage(): unknown;
  clearQuotedMessage(): unknown;
}

const MAX_LENGTH = 64 * 1024;

export const CompositionInput: React.ComponentType<Props> = props => {
  const {
    i18n,
    disabled,
    large,
    inputApi,
    onPickEmoji,
    onSubmit,
    skinTone,
    draftText,
    draftBodyRanges,
    getQuotedMessage,
    clearQuotedMessage,
    members,
  } = props;

  const [emojiCompletionElement, setEmojiCompletionElement] = React.useState<
    JSX.Element
  >();
  const [
    lastSelectionRange,
    setLastSelectionRange,
  ] = React.useState<RangeStatic | null>(null);
  const [
    mentionCompletionElement,
    setMentionCompletionElement,
  ] = React.useState<JSX.Element>();

  const emojiCompletionRef = React.useRef<EmojiCompletion>();
  const mentionCompletionRef = React.useRef<MentionCompletion>();
  const quillRef = React.useRef<Quill>();
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const propsRef = React.useRef<Props>(props);
  const memberRepositoryRef = React.useRef<MemberRepository>(
    new MemberRepository()
  );

  const generateDelta = (
    text: string,
    bodyRanges: Array<BodyRangeType>
  ): Delta => {
    const initialOps = [{ insert: text }];
    const opsWithMentions = insertMentionOps(initialOps, bodyRanges);
    const opsWithEmojis = insertEmojiOps(opsWithMentions);

    return new Delta(opsWithEmojis);
  };

  const getTextAndMentions = (): [string, Array<BodyRangeType>] => {
    const quill = quillRef.current;

    if (quill === undefined) {
      return ['', []];
    }

    const contents = quill.getContents();

    if (contents === undefined) {
      return ['', []];
    }

    const { ops } = contents;

    if (ops === undefined) {
      return ['', []];
    }

    return getTextAndMentionsFromOps(ops);
  };

  const focus = () => {
    const quill = quillRef.current;

    if (quill === undefined) {
      return;
    }

    quill.focus();
  };

  const insertEmoji = (e: EmojiPickDataType) => {
    const quill = quillRef.current;

    if (quill === undefined) {
      return;
    }

    const range = quill.getSelection();

    const insertionRange = range || lastSelectionRange;
    if (insertionRange === null) {
      return;
    }

    const emoji = convertShortName(e.shortName, e.skinTone);

    const delta = new Delta()
      .retain(insertionRange.index)
      .delete(insertionRange.length)
      .insert({ emoji });

    quill.updateContents(delta, 'user');
    quill.setSelection(insertionRange.index + 1, 0, 'user');
  };

  const reset = () => {
    const quill = quillRef.current;

    if (quill === undefined) {
      return;
    }

    quill.setText('');

    const historyModule = quill.getModule('history');

    if (historyModule === undefined) {
      return;
    }

    historyModule.clear();
  };

  const resetEmojiResults = () => {
    const emojiCompletion = emojiCompletionRef.current;

    if (emojiCompletion === undefined) {
      return;
    }

    emojiCompletion.reset();
  };

  const submit = () => {
    const quill = quillRef.current;

    if (quill === undefined) {
      return;
    }

    const [text, mentions] = getTextAndMentions();

    window.log.info(`Submitting a message with ${mentions.length} mentions`);
    onSubmit(text, mentions);
  };

  if (inputApi) {
    // eslint-disable-next-line no-param-reassign
    inputApi.current = {
      focus,
      insertEmoji,
      reset,
      resetEmojiResults,
      submit,
    };
  }

  React.useEffect(() => {
    propsRef.current = props;
  }, [props]);

  const onShortKeyEnter = () => {
    submit();
    return false;
  };

  const onEnter = () => {
    const quill = quillRef.current;
    const emojiCompletion = emojiCompletionRef.current;
    const mentionCompletion = mentionCompletionRef.current;

    if (quill === undefined) {
      return false;
    }

    if (emojiCompletion === undefined || mentionCompletion === undefined) {
      return false;
    }

    if (emojiCompletion.results.length) {
      emojiCompletion.completeEmoji();
      return false;
    }

    if (mentionCompletion.results.length) {
      mentionCompletion.completeMention();
      return false;
    }

    if (propsRef.current.large) {
      return true;
    }

    submit();

    return false;
  };

  const onTab = () => {
    const quill = quillRef.current;
    const emojiCompletion = emojiCompletionRef.current;
    const mentionCompletion = mentionCompletionRef.current;

    if (quill === undefined) {
      return false;
    }

    if (emojiCompletion === undefined || mentionCompletion === undefined) {
      return false;
    }

    if (emojiCompletion.results.length) {
      emojiCompletion.completeEmoji();
      return false;
    }

    if (mentionCompletion.results.length) {
      mentionCompletion.completeMention();
      return false;
    }

    return true;
  };

  const onEscape = () => {
    const quill = quillRef.current;

    if (quill === undefined) {
      return false;
    }

    const emojiCompletion = emojiCompletionRef.current;
    const mentionCompletion = mentionCompletionRef.current;

    if (emojiCompletion) {
      if (emojiCompletion.results.length) {
        emojiCompletion.reset();
        return false;
      }
    }

    if (mentionCompletion) {
      if (mentionCompletion.results.length) {
        mentionCompletion.clearResults();
        return false;
      }
    }

    if (getQuotedMessage()) {
      clearQuotedMessage();
      return false;
    }

    return true;
  };

  const onBackspace = () => {
    const quill = quillRef.current;

    if (quill === undefined) {
      return true;
    }

    const selection = quill.getSelection();
    if (!selection || selection.length > 0) {
      return true;
    }

    const [blotToDelete] = quill.getLeaf(selection.index);
    if (!isMentionBlot(blotToDelete)) {
      return true;
    }

    const contents = quill.getContents(0, selection.index - 1);
    const restartDelta = getDeltaToRestartMention(contents.ops);

    quill.updateContents(restartDelta);
    quill.setSelection(selection.index, 0);

    return false;
  };

  const onChange = () => {
    const quill = quillRef.current;

    const [text, mentions] = getTextAndMentions();

    if (quill !== undefined) {
      const historyModule: HistoryStatic = quill.getModule('history');

      if (text.length > MAX_LENGTH) {
        historyModule.undo();
        propsRef.current.onTextTooLong();
        return;
      }

      const { onEditorStateChange } = propsRef.current;

      if (onEditorStateChange) {
        // `getSelection` inside the `onChange` event handler will be the
        // selection value _before_ the change occurs. `setTimeout` 0 here will
        // let `getSelection` return the selection after the change takes place.
        // this is necessary for `maybeGrabLinkPreview` as it needs the correct
        // `caretLocation` from the post-change selection index value.
        setTimeout(() => {
          const selection = quill.getSelection();

          onEditorStateChange(
            text,
            mentions,
            selection ? selection.index : undefined
          );
        }, 0);
      }
    }

    if (propsRef.current.onDirtyChange) {
      propsRef.current.onDirtyChange(text.length > 0);
    }
  };

  React.useEffect(() => {
    const quill = quillRef.current;

    if (quill === undefined) {
      return;
    }

    quill.enable(!disabled);
    quill.focus();
  }, [disabled]);

  React.useEffect(() => {
    const emojiCompletion = emojiCompletionRef.current;

    if (emojiCompletion === undefined || skinTone === undefined) {
      return;
    }

    emojiCompletion.options.skinTone = skinTone;
  }, [skinTone]);

  React.useEffect(
    () => () => {
      const emojiCompletion = emojiCompletionRef.current;
      const mentionCompletion = mentionCompletionRef.current;

      if (emojiCompletion !== undefined) {
        emojiCompletion.destroy();
      }

      if (mentionCompletion !== undefined) {
        mentionCompletion.destroy();
      }
    },
    []
  );

  const removeStaleMentions = (currentMembers: Array<ConversationType>) => {
    const quill = quillRef.current;

    if (quill === undefined) {
      return;
    }

    const { ops } = quill.getContents();
    if (ops === undefined) {
      return;
    }

    const currentMemberUuids = currentMembers
      .map(m => m.uuid)
      .filter((uuid): uuid is string => uuid !== undefined);

    const newDelta = getDeltaToRemoveStaleMentions(ops, currentMemberUuids);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    quill.updateContents(newDelta as any);
  };

  const memberIds = members ? members.map(m => m.id) : [];

  React.useEffect(() => {
    memberRepositoryRef.current.updateMembers(members || []);
    removeStaleMentions(members || []);
    // We are still depending on members, but ESLint can't tell
    // Comparing the actual members list does not work for a couple reasons:
    //    * Arrays with the same objects are not "equal" to React
    //    * We only care about added/removed members, ignoring other attributes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(memberIds)]);

  const reactQuill = React.useMemo(
    () => {
      const delta = generateDelta(draftText || '', draftBodyRanges || []);

      return (
        <ReactQuill
          className="module-composition-input__quill"
          onChange={onChange}
          defaultValue={delta}
          modules={{
            toolbar: false,
            signalClipboard: true,
            clipboard: {
              matchers: [
                ['IMG', matchEmojiImage],
                ['IMG', matchEmojiBlot],
                ['SPAN', matchReactEmoji],
                [Node.TEXT_NODE, matchEmojiText],
                ['SPAN', matchMention(memberRepositoryRef)],
              ],
            },
            keyboard: {
              bindings: {
                onEnter: { key: 13, handler: onEnter }, // 13 = Enter
                onShortKeyEnter: {
                  key: 13, // 13 = Enter
                  shortKey: true,
                  handler: onShortKeyEnter,
                },
                onEscape: { key: 27, handler: onEscape }, // 27 = Escape
                onBackspace: { key: 8, handler: onBackspace }, // 8 = Backspace
              },
            },
            autoSubstituteAsciiEmojis: {
              skinTone,
            },
            emojiCompletion: {
              setEmojiPickerElement: setEmojiCompletionElement,
              onPickEmoji,
              skinTone,
            },
            mentionCompletion: {
              me: members ? members.find(foo => foo.isMe) : undefined,
              memberRepositoryRef,
              setMentionPickerElement: setMentionCompletionElement,
              i18n,
            },
          }}
          formats={['emoji', 'mention']}
          placeholder={i18n('sendMessage')}
          readOnly={disabled}
          ref={element => {
            if (element) {
              const quill = element.getEditor();
              const keyboard = quill.getModule('keyboard') as KeyboardStatic;

              // force the tab handler to be prepended, otherwise it won't be
              // executed: https://github.com/quilljs/quill/issues/1967
              keyboard.bindings[9].unshift({ key: 9, handler: onTab }); // 9 = Tab
              // also, remove the default \t insertion binding
              keyboard.bindings[9].pop();

              // When loading a multi-line message out of a draft, the cursor
              // position needs to be pushed to the end of the input manually.
              quill.once('editor-change', () => {
                const scroller = scrollerRef.current;

                if (scroller !== null) {
                  quill.scrollingContainer = scroller;
                }

                setTimeout(() => {
                  quill.setSelection(quill.getLength(), 0);
                  quill.root.classList.add('ql-editor--loaded');
                }, 0);
              });

              quill.on(
                'selection-change',
                (newRange: RangeStatic, oldRange: RangeStatic) => {
                  // If we lose focus, store the last edit point for emoji insertion
                  if (newRange === null) {
                    setLastSelectionRange(oldRange);
                  }
                }
              );
              quillRef.current = quill;
              emojiCompletionRef.current = quill.getModule('emojiCompletion');
              mentionCompletionRef.current = quill.getModule(
                'mentionCompletion'
              );
            }
          }}
        />
      );
    },
    // quill shouldn't re-render, all changes should take place exclusively
    // through mutating the quill state directly instead of through props
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // The onClick handler below is only to make it easier for mouse users to focus the
  //   message box. In 'large' mode, the actual Quill text box can be one line while the
  //   visual text box is much larger. Clicking that should allow you to start typing,
  //   hence the click handler.
  // eslint-disable-next-line max-len
  /* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */

  return (
    <Manager>
      <Reference>
        {({ ref }) => (
          <div className="module-composition-input__input" ref={ref}>
            <div
              ref={scrollerRef}
              onClick={focus}
              className={classNames(
                'module-composition-input__input__scroller',
                large
                  ? 'module-composition-input__input__scroller--large'
                  : null
              )}
            >
              {reactQuill}
              {emojiCompletionElement}
              {mentionCompletionElement}
            </div>
          </div>
        )}
      </Reference>
    </Manager>
  );
};
