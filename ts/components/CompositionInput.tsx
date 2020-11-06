// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import Delta from 'quill-delta';
import ReactQuill from 'react-quill';
import classNames from 'classnames';
import emojiRegex from 'emoji-regex';
import { Manager, Reference } from 'react-popper';
import Quill, { KeyboardStatic, RangeStatic } from 'quill';
import Op from 'quill-delta/dist/Op';

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
} from '../quill/emoji/matchers';
import { matchMention } from '../quill/mentions/matchers';
import { MemberRepository } from '../quill/memberRepository';
import {
  getDeltaToRemoveStaleMentions,
  getTextAndMentionsFromOps,
  isMentionBlot,
  getDeltaToRestartMention,
} from '../quill/util';
import { SignalClipboard } from '../quill/signal-clipboard';

Quill.register('formats/emoji', EmojiBlot);
Quill.register('formats/mention', MentionBlot);
Quill.register('modules/emojiCompletion', EmojiCompletion);
Quill.register('modules/mentionCompletion', MentionCompletion);
Quill.register('modules/signalClipboard', SignalClipboard);

const Block = Quill.import('blots/block');
Block.tagName = 'DIV';
Quill.register(Block, true);

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

  const insertMentionOps = (
    incomingOps: Array<Op>,
    bodyRanges: Array<BodyRangeType>
  ) => {
    const ops = [...incomingOps];

    // Working backwards through bodyRanges (to avoid offsetting later mentions),
    // Shift off the op with the text to the left of the last mention,
    // Insert a mention based on the current bodyRange,
    // Unshift the mention and surrounding text to leave the ops ready for the next range
    bodyRanges
      .sort((a, b) => b.start - a.start)
      .forEach(({ start, length, mentionUuid, replacementText }) => {
        const op = ops.shift();

        if (op) {
          const { insert } = op;

          if (typeof insert === 'string') {
            const left = insert.slice(0, start);
            const right = insert.slice(start + length);

            const mention = {
              uuid: mentionUuid,
              title: replacementText,
            };

            ops.unshift({ insert: right });
            ops.unshift({ insert: { mention } });
            ops.unshift({ insert: left });
          } else {
            ops.unshift(op);
          }
        }
      });

    return ops;
  };

  const insertEmojiOps = (incomingOps: Array<Op>): Array<Op> => {
    return incomingOps.reduce((ops, op) => {
      if (typeof op.insert === 'string') {
        const text = op.insert;
        const re = emojiRegex();
        let index = 0;
        let match: RegExpExecArray | null;

        // eslint-disable-next-line no-cond-assign
        while ((match = re.exec(text))) {
          const [emoji] = match;
          ops.push({ insert: text.slice(index, match.index) });
          ops.push({ insert: { emoji } });
          index = match.index + emoji.length;
        }

        ops.push({ insert: text.slice(index, text.length) });
      } else {
        ops.push(op);
      }

      return ops;
    }, [] as Array<Op>);
  };

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

    const historyModule: HistoryStatic = quill.getModule('history');

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

  const onCtrlA = () => {
    const quill = quillRef.current;

    if (quill === undefined) {
      return;
    }

    quill.setSelection(0, 0);
  };

  const onCtrlE = () => {
    const quill = quillRef.current;

    if (quill === undefined) {
      return;
    }

    quill.setSelection(quill.getLength(), 0);
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

      if (propsRef.current.onEditorStateChange) {
        const selection = quill.getSelection();

        propsRef.current.onEditorStateChange(
          text,
          mentions,
          selection ? selection.index : undefined
        );
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
                onCtrlA: { key: 65, ctrlKey: true, handler: onCtrlA }, // 65 = a
                onCtrlE: { key: 69, ctrlKey: true, handler: onCtrlE }, // 69 = e
                onBackspace: { key: 8, handler: onBackspace }, // 8 = Backspace
              },
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

  return (
    <Manager>
      <Reference>
        {({ ref }) => (
          <div className="module-composition-input__input" ref={ref}>
            <div
              ref={scrollerRef}
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
