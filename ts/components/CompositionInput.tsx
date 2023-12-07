// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import Delta from 'quill-delta';
import ReactQuill from 'react-quill';
import classNames from 'classnames';
import { Manager, Reference } from 'react-popper';
import type { DeltaStatic, KeyboardStatic, RangeStatic } from 'quill';
import Quill from 'quill';

import { MentionCompletion } from '../quill/mentions/completion';
import { FormattingMenu, QuillFormattingStyle } from '../quill/formatting/menu';
import { MonospaceBlot } from '../quill/formatting/monospaceBlot';
import { SpoilerBlot } from '../quill/formatting/spoilerBlot';
import { EmojiBlot, EmojiCompletion } from '../quill/emoji';
import type { EmojiPickDataType } from './emoji/EmojiPicker';
import { convertShortName } from './emoji/lib';
import type {
  DraftBodyRanges,
  HydratedBodyRangesType,
  RangeNode,
} from '../types/BodyRange';
import { BodyRange, collapseRangeTree, insertRange } from '../types/BodyRange';
import type { LocalizerType, ThemeType } from '../types/Util';
import type { ConversationType } from '../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../state/selectors/badges';
import { isAciString } from '../util/isAciString';
import { MentionBlot } from '../quill/mentions/blot';
import {
  matchEmojiImage,
  matchEmojiBlot,
  matchEmojiText,
} from '../quill/emoji/matchers';
import { matchMention } from '../quill/mentions/matchers';
import { MemberRepository } from '../quill/memberRepository';
import {
  getDeltaToRemoveStaleMentions,
  getTextAndRangesFromOps,
  isMentionBlot,
  getDeltaToRestartMention,
  insertEmojiOps,
  insertFormattingAndMentionsOps,
} from '../quill/util';
import { SignalClipboard } from '../quill/signal-clipboard';
import { DirectionalBlot } from '../quill/block/blot';
import { getClassNamesFor } from '../util/getClassNamesFor';
import { isNotNil } from '../util/isNotNil';
import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { useRefMerger } from '../hooks/useRefMerger';
import type { LinkPreviewType } from '../types/message/LinkPreviews';
import { StagedLinkPreview } from './conversation/StagedLinkPreview';
import type { DraftEditMessageType } from '../model-types.d';
import { usePrevious } from '../hooks/usePrevious';
import {
  matchBold,
  matchItalic,
  matchMonospace,
  matchSpoiler,
  matchStrikethrough,
} from '../quill/formatting/matchers';
import { missingCaseError } from '../util/missingCaseError';

Quill.register('formats/emoji', EmojiBlot);
Quill.register('formats/mention', MentionBlot);
Quill.register('formats/block', DirectionalBlot);
Quill.register('formats/monospace', MonospaceBlot);
Quill.register('formats/spoiler', SpoilerBlot);
Quill.register('modules/emojiCompletion', EmojiCompletion);
Quill.register('modules/mentionCompletion', MentionCompletion);
Quill.register('modules/formattingMenu', FormattingMenu);
Quill.register('modules/signalClipboard', SignalClipboard);

type HistoryStatic = {
  undo(): void;
  clear(): void;
};

export type InputApi = {
  focus: () => void;
  insertEmoji: (e: EmojiPickDataType) => void;
  setContents: (
    text: string,
    draftBodyRanges?: HydratedBodyRangesType,
    cursorToEnd?: boolean
  ) => void;
  reset: () => void;
  submit: () => void;
};

export type Props = Readonly<{
  children?: React.ReactNode;
  conversationId?: string;
  i18n: LocalizerType;
  disabled?: boolean;
  draftEditMessage?: DraftEditMessageType;
  getPreferredBadge: PreferredBadgeSelectorType;
  large?: boolean;
  inputApi?: React.MutableRefObject<InputApi | undefined>;
  isFormattingEnabled: boolean;
  sendCounter: number;
  skinTone?: EmojiPickDataType['skinTone'];
  draftText?: string;
  draftBodyRanges?: HydratedBodyRangesType;
  moduleClassName?: string;
  theme: ThemeType;
  placeholder?: string;
  sortedGroupMembers?: ReadonlyArray<ConversationType>;
  scrollerRef?: React.RefObject<HTMLDivElement>;
  onDirtyChange?(dirty: boolean): unknown;
  onEditorStateChange?(options: {
    bodyRanges: DraftBodyRanges;
    caretLocation?: number;
    conversationId: string | undefined;
    messageText: string;
    sendCounter: number;
  }): unknown;
  onTextTooLong(): unknown;
  onPickEmoji(o: EmojiPickDataType): unknown;
  onBlur?: () => unknown;
  onFocus?: () => unknown;
  onSubmit(
    message: string,
    bodyRanges: DraftBodyRanges,
    timestamp: number
  ): unknown;
  onScroll?: (ev: React.UIEvent<HTMLElement>) => void;
  platform: string;
  shouldHidePopovers?: boolean;
  getQuotedMessage?(): unknown;
  clearQuotedMessage?(): unknown;
  linkPreviewLoading?: boolean;
  linkPreviewResult?: LinkPreviewType;
  onCloseLinkPreview?(conversationId: string): unknown;
}>;

const MAX_LENGTH = 64 * 1024;
const BASE_CLASS_NAME = 'module-composition-input';

export function CompositionInput(props: Props): React.ReactElement {
  const {
    children,
    clearQuotedMessage,
    conversationId,
    disabled,
    draftBodyRanges,
    draftEditMessage,
    draftText,
    getPreferredBadge,
    getQuotedMessage,
    i18n,
    inputApi,
    isFormattingEnabled,
    large,
    linkPreviewLoading,
    linkPreviewResult,
    moduleClassName,
    onCloseLinkPreview,
    onBlur,
    onFocus,
    onPickEmoji,
    onScroll,
    onSubmit,
    placeholder,
    platform,
    shouldHidePopovers,
    skinTone,
    sendCounter,
    sortedGroupMembers,
    theme,
  } = props;

  const refMerger = useRefMerger();

  const [emojiCompletionElement, setEmojiCompletionElement] =
    React.useState<JSX.Element>();
  const [formattingChooserElement, setFormattingChooserElement] =
    React.useState<JSX.Element>();
  const [lastSelectionRange, setLastSelectionRange] =
    React.useState<RangeStatic | null>(null);
  const [mentionCompletionElement, setMentionCompletionElement] =
    React.useState<JSX.Element>();

  const emojiCompletionRef = React.useRef<EmojiCompletion>();
  const mentionCompletionRef = React.useRef<MentionCompletion>();
  const quillRef = React.useRef<Quill>();

  const scrollerRefInner = React.useRef<HTMLDivElement>(null);

  const propsRef = React.useRef<Props>(props);
  const canSendRef = React.useRef<boolean>(false);
  const memberRepositoryRef = React.useRef<MemberRepository>(
    new MemberRepository()
  );

  const [isMouseDown, setIsMouseDown] = React.useState<boolean>(false);

  const generateDelta = (
    text: string,
    bodyRanges: HydratedBodyRangesType
  ): Delta => {
    const textLength = text.length;
    const tree = bodyRanges.reduce<ReadonlyArray<RangeNode>>((acc, range) => {
      if (range.start < textLength) {
        return insertRange(range, acc);
      }
      return acc;
    }, []);
    const nodes = collapseRangeTree({ tree, text });
    const opsWithFormattingAndMentions = insertFormattingAndMentionsOps(nodes);
    const opsWithEmojis = insertEmojiOps(opsWithFormattingAndMentions, {});

    return new Delta(opsWithEmojis);
  };

  const getTextAndRanges = (): {
    text: string;
    bodyRanges: DraftBodyRanges;
  } => {
    const quill = quillRef.current;

    if (quill === undefined) {
      return { text: '', bodyRanges: [] };
    }

    const contents = quill.getContents();

    if (contents === undefined) {
      return { text: '', bodyRanges: [] };
    }

    const { ops } = contents;

    if (ops === undefined) {
      return { text: '', bodyRanges: [] };
    }

    const { text, bodyRanges } = getTextAndRangesFromOps(ops);

    return {
      text,
      bodyRanges: bodyRanges.filter(range => {
        if (BodyRange.isMention(range)) {
          return true;
        }
        if (BodyRange.isFormatting(range)) {
          return true;
        }
        throw missingCaseError(range);
      }),
    };
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
    if (insertionRange == null) {
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

    canSendRef.current = true;
    quill.setText('');

    const historyModule = quill.getModule('history');

    if (historyModule === undefined) {
      return;
    }

    historyModule.clear();
  };

  const setContents = (
    text: string,
    bodyRanges?: HydratedBodyRangesType,
    cursorToEnd?: boolean
  ) => {
    const quill = quillRef.current;

    if (quill === undefined) {
      return;
    }

    const delta = generateDelta(text || '', bodyRanges || []);

    canSendRef.current = true;
    // We need to cast here because we use @types/quill@1.3.10 which has types
    // for quill-delta even though quill-delta is written in TS and has its own
    // types. @types/quill@2.0.0 fixes the issue but react-quill has a peer-dep
    // on the older quill types.
    quill.setContents(delta as unknown as DeltaStatic);
    if (cursorToEnd) {
      quill.setSelection(quill.getLength(), 0);
    }
  };

  const submit = () => {
    const timestamp = Date.now();
    const quill = quillRef.current;

    if (quill === undefined) {
      return;
    }

    if (!canSendRef.current) {
      log.warn(
        'CompositionInput: Not submitting message - cannot send right now'
      );
      return;
    }

    const { text, bodyRanges } = getTextAndRanges();

    log.info(
      `CompositionInput: Submitting message ${timestamp} with ${bodyRanges.length} ranges`
    );
    canSendRef.current = false;
    onSubmit(text, bodyRanges, timestamp);
  };

  if (inputApi) {
    inputApi.current = {
      focus,
      insertEmoji,
      setContents,
      reset,
      submit,
    };
  }

  React.useEffect(() => {
    propsRef.current = props;
  }, [props]);

  React.useEffect(() => {
    canSendRef.current = !disabled;
  }, [disabled]);

  const onShortKeyEnter = (): boolean => {
    submit();
    return false;
  };

  const previousFormattingEnabled = usePrevious(
    isFormattingEnabled,
    isFormattingEnabled
  );
  const previousIsMouseDown = usePrevious(isMouseDown, isMouseDown);

  React.useEffect(() => {
    const formattingChanged =
      typeof previousFormattingEnabled === 'boolean' &&
      previousFormattingEnabled !== isFormattingEnabled;
    const mouseDownChanged = previousIsMouseDown !== isMouseDown;

    const quill = quillRef.current;
    const changed = formattingChanged || mouseDownChanged;
    if (quill && changed) {
      quill.getModule('formattingMenu').updateOptions({
        isMenuEnabled: isFormattingEnabled,
        isMouseDown,
      });
      quill.options.formats = getQuillFormats();
    }
  }, [
    isFormattingEnabled,
    isMouseDown,
    previousFormattingEnabled,
    previousIsMouseDown,
    quillRef,
  ]);

  const onEnter = (): boolean => {
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

  const onTab = (): boolean => {
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

  const onEscape = (): boolean => {
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

    if (getQuotedMessage?.()) {
      clearQuotedMessage?.();
      return false;
    }

    return true;
  };

  const onBackspace = (): boolean => {
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

  const onChange = (): void => {
    const quill = quillRef.current;

    const { text, bodyRanges } = getTextAndRanges();

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

          onEditorStateChange({
            bodyRanges,
            caretLocation: selection ? selection.index : undefined,
            conversationId,
            messageText: text,
            sendCounter,
          });
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
    const quill = quillRef.current;

    if (quill === undefined) {
      return;
    }

    function handleFocus() {
      onFocus?.();
    }
    function handleBlur() {
      onBlur?.();
    }

    quill.root.addEventListener('focus', handleFocus);
    quill.root.addEventListener('blur', handleBlur);

    return () => {
      quill.root.removeEventListener('focus', handleFocus);
      quill.root.removeEventListener('blur', handleBlur);
    };
  }, [onFocus, onBlur]);

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

  const removeStaleMentions = (
    currentMembers: ReadonlyArray<ConversationType>
  ) => {
    const quill = quillRef.current;

    if (quill === undefined) {
      return;
    }

    const { ops } = quill.getContents();
    if (ops === undefined) {
      return;
    }

    const currentMemberAcis = currentMembers
      .map(m => m.serviceId)
      .filter(isNotNil)
      .filter(isAciString);

    const newDelta = getDeltaToRemoveStaleMentions(ops, currentMemberAcis);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    quill.updateContents(newDelta as any);
  };

  const memberIds = sortedGroupMembers ? sortedGroupMembers.map(m => m.id) : [];

  React.useEffect(() => {
    memberRepositoryRef.current.updateMembers(sortedGroupMembers || []);
    removeStaleMentions(sortedGroupMembers || []);
    // We are still depending on members, but ESLint can't tell
    // Comparing the actual members list does not work for a couple reasons:
    //    * Arrays with the same objects are not "equal" to React
    //    * We only care about added/removed members, ignoring other attributes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(memberIds)]);

  // Placing all of these callbacks inside of a ref since Quill is not able
  // to re-render. We want to make sure that all these callbacks are fresh
  // so that the consumers of this component won't deal with stale props or
  // stale state as the result of calling them.
  const unstaleCallbacks = {
    onBackspace,
    onChange,
    onEnter,
    onEscape,
    onPickEmoji,
    onShortKeyEnter,
    onTab,
  };
  const callbacksRef = React.useRef(unstaleCallbacks);
  callbacksRef.current = unstaleCallbacks;

  const reactQuill = React.useMemo(
    () => {
      const delta = generateDelta(draftText || '', draftBodyRanges || []);

      return (
        <ReactQuill
          className={`${BASE_CLASS_NAME}__quill`}
          onChange={() => callbacksRef.current.onChange()}
          defaultValue={delta}
          modules={{
            toolbar: false,
            signalClipboard: true,
            clipboard: {
              matchers: [
                ['IMG', matchEmojiImage],
                ['IMG', matchEmojiBlot],
                ['STRONG', matchBold],
                ['EM', matchItalic],
                ['SPAN', matchMonospace],
                ['S', matchStrikethrough],
                ['SPAN', matchSpoiler],
                [Node.TEXT_NODE, matchEmojiText],
                ['SPAN', matchMention(memberRepositoryRef)],
              ],
            },
            keyboard: {
              bindings: {
                onEnter: {
                  key: 13,
                  handler: () => callbacksRef.current.onEnter(),
                }, // 13 = Enter
                onShortKeyEnter: {
                  key: 13, // 13 = Enter
                  shortKey: true,
                  handler: () => callbacksRef.current.onShortKeyEnter(),
                },
                onEscape: {
                  key: 27,
                  handler: () => callbacksRef.current.onEscape(),
                }, // 27 = Escape
                onBackspace: {
                  key: 8,
                  handler: () => callbacksRef.current.onBackspace(),
                }, // 8 = Backspace
              },
            },
            emojiCompletion: {
              setEmojiPickerElement: setEmojiCompletionElement,
              onPickEmoji: (emoji: EmojiPickDataType) =>
                callbacksRef.current.onPickEmoji(emoji),
              skinTone,
            },
            formattingMenu: {
              i18n,
              isMenuEnabled: isFormattingEnabled,
              platform,
              setFormattingChooserElement,
            },
            mentionCompletion: {
              getPreferredBadge,
              me: sortedGroupMembers
                ? sortedGroupMembers.find(foo => foo.isMe)
                : undefined,
              memberRepositoryRef,
              setMentionPickerElement: setMentionCompletionElement,
              i18n,
              theme,
            },
          }}
          formats={getQuillFormats()}
          placeholder={placeholder || i18n('icu:sendMessage')}
          readOnly={disabled}
          ref={element => {
            if (element) {
              const quill = element.getEditor();
              const keyboard = quill.getModule('keyboard') as KeyboardStatic;

              // force the tab handler to be prepended, otherwise it won't be
              // executed: https://github.com/quilljs/quill/issues/1967
              keyboard.bindings[9].unshift({
                key: 9,
                handler: () => callbacksRef.current.onTab(),
              }); // 9 = Tab
              // also, remove the default \t insertion binding
              keyboard.bindings[9].pop();

              // When loading a multi-line message out of a draft, the cursor
              // position needs to be pushed to the end of the input manually.
              quill.once('editor-change', () => {
                const scroller = scrollerRefInner.current;

                if (scroller != null) {
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
                  if (newRange == null) {
                    setLastSelectionRange(oldRange);
                  }
                }
              );
              quillRef.current = quill;
              emojiCompletionRef.current = quill.getModule('emojiCompletion');
              mentionCompletionRef.current =
                quill.getModule('mentionCompletion');
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

  const getClassName = getClassNamesFor(BASE_CLASS_NAME, moduleClassName);

  const onMouseDown = React.useCallback(
    event => {
      const target = event.target as HTMLElement;
      try {
        // If the user is actually clicking the format menu, we drop this event
        if (target.closest('.module-composition-input__format-menu')) {
          return;
        }
        setIsMouseDown(true);

        const onMouseUp = () => {
          setIsMouseDown(false);
          window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mouseup', onMouseUp);
      } catch (error) {
        log.error(
          'CompositionInput.onMouseDown: Failed to check event target',
          Errors.toLogFormat(error)
        );
      }
      setIsMouseDown(true);
    },
    [setIsMouseDown]
  );

  return (
    <Manager>
      <Reference>
        {({ ref }) => (
          <div
            className={getClassName('__input')}
            data-supertab
            ref={ref}
            data-testid="CompositionInput"
            data-enabled={disabled ? 'false' : 'true'}
            onMouseDown={onMouseDown}
          >
            {draftEditMessage && (
              <div className={getClassName('__editing-message')}>
                {i18n('icu:CompositionInput__editing-message')}
              </div>
            )}
            {draftEditMessage?.attachmentThumbnail && (
              <div className={getClassName('__editing-message__attachment')}>
                <img
                  alt={i18n('icu:stagedImageAttachment', {
                    path: draftEditMessage.attachmentThumbnail,
                  })}
                  src={draftEditMessage.attachmentThumbnail}
                />
              </div>
            )}
            {conversationId && linkPreviewLoading && linkPreviewResult && (
              <StagedLinkPreview
                {...linkPreviewResult}
                moduleClassName="CompositionInput__link-preview"
                i18n={i18n}
                onClose={() => onCloseLinkPreview?.(conversationId)}
              />
            )}
            {children}
            <div
              ref={
                props.scrollerRef
                  ? refMerger(scrollerRefInner, props.scrollerRef)
                  : scrollerRefInner
              }
              onClick={focus}
              onScroll={onScroll}
              className={classNames(
                getClassName('__input__scroller'),
                !large && linkPreviewResult
                  ? getClassName('__input__scroller--link-preview')
                  : null,
                large ? getClassName('__input__scroller--large') : null,
                children ? getClassName('__input--with-children') : null
              )}
            >
              {reactQuill}
              {shouldHidePopovers ? null : (
                <>
                  {emojiCompletionElement}
                  {mentionCompletionElement}
                  {formattingChooserElement}
                </>
              )}
            </div>
          </div>
        )}
      </Reference>
    </Manager>
  );
}

function getQuillFormats(): Array<string> {
  return [
    // For image replacement (local-only)
    'emoji',
    // @mentions
    'mention',
    QuillFormattingStyle.spoiler,
    QuillFormattingStyle.monospace,
    // Built-in
    QuillFormattingStyle.bold,
    QuillFormattingStyle.italic,
    QuillFormattingStyle.strike,
  ];
}
