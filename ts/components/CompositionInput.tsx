// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import Quill, { Delta } from '@signalapp/quill-cjs';
import {
  matchText,
  matchNewline,
  matchBreak,
} from '@signalapp/quill-cjs/modules/clipboard';
import Emitter from '@signalapp/quill-cjs/core/emitter';
import classNames from 'classnames';
import { Manager, Reference } from 'react-popper';
import type { Range as RangeStatic } from '@signalapp/quill-cjs';

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
import {
  BodyRange,
  areBodyRangesEqual,
  collapseRangeTree,
  insertRange,
} from '../types/BodyRange';
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
  isEmojiBlot,
  getDeltaToRestartMention,
  getDeltaToRestartEmoji,
  insertEmojiOps,
  insertFormattingAndMentionsOps,
} from '../quill/util';
import { SignalClipboard } from '../quill/signal-clipboard';
import { DirectionalBlot } from '../quill/block/blot';
import { getClassNamesFor } from '../util/getClassNamesFor';
import { isNotNil } from '../util/isNotNil';
import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { useEmojiSearch } from '../hooks/useEmojiSearch';
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
import { AutoSubstituteAsciiEmojis } from '../quill/auto-substitute-ascii-emojis';
import { dropNull } from '../util/dropNull';
import { SimpleQuillWrapper } from './SimpleQuillWrapper';

Quill.register(
  {
    'formats/emoji': EmojiBlot,
    'formats/mention': MentionBlot,
    'formats/block': DirectionalBlot,
    'formats/monospace': MonospaceBlot,
    'formats/spoiler': SpoilerBlot,
    'modules/autoSubstituteAsciiEmojis': AutoSubstituteAsciiEmojis,
    'modules/emojiCompletion': EmojiCompletion,
    'modules/mentionCompletion': MentionCompletion,
    'modules/formattingMenu': FormattingMenu,
    'modules/signalClipboard': SignalClipboard,
  },
  true
);

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
  conversationId: string | null;
  i18n: LocalizerType;
  disabled?: boolean;
  draftEditMessage: DraftEditMessageType | null;
  getPreferredBadge: PreferredBadgeSelectorType;
  large: boolean | null;
  inputApi: React.MutableRefObject<InputApi | undefined> | null;
  isFormattingEnabled: boolean;
  isActive: boolean;
  sendCounter: number;
  skinTone: NonNullable<EmojiPickDataType['skinTone']> | null;
  draftText: string | null;
  draftBodyRanges: HydratedBodyRangesType | null;
  moduleClassName?: string;
  theme: ThemeType;
  placeholder?: string;
  sortedGroupMembers: ReadonlyArray<ConversationType> | null;
  onDirtyChange?(dirty: boolean): unknown;
  onEditorStateChange(options: {
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
  ourConversationId: string | undefined;
  platform: string;
  quotedMessageId: string | null;
  shouldHidePopovers: boolean | null;
  linkPreviewLoading?: boolean;
  linkPreviewResult: LinkPreviewType | null;
  onCloseLinkPreview?(conversationId: string): unknown;
}>;

const MAX_LENGTH = 64 * 1024;
const BASE_CLASS_NAME = 'module-composition-input';

export function CompositionInput(props: Props): React.ReactElement {
  const {
    children,
    conversationId,
    disabled,
    draftBodyRanges,
    draftEditMessage,
    draftText,
    getPreferredBadge,
    i18n,
    inputApi,
    isFormattingEnabled,
    isActive,
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
    ourConversationId,
    placeholder,
    platform,
    quotedMessageId,
    shouldHidePopovers,
    skinTone,
    sendCounter,
    sortedGroupMembers,
    theme,
  } = props;

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
      .insert({ emoji: { value: emoji } });

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

    quill.history.clear();
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
    quill.setContents(delta);
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
    const didSend = onSubmit(text, bodyRanges, timestamp);

    if (!didSend) {
      canSendRef.current = true;
    }
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
      const formattingMenu = quill.getModule('formattingMenu');
      if (!(formattingMenu instanceof FormattingMenu)) {
        throw new Error(
          'CompositionInput: formattingMenu module not properly initialized'
        );
      }

      formattingMenu.updateOptions({
        isMenuEnabled: isFormattingEnabled,
        isMouseDown,
      });
    }
  }, [
    isFormattingEnabled,
    isMouseDown,
    previousFormattingEnabled,
    previousIsMouseDown,
  ]);

  React.useEffect(() => {
    const signalClipboard = quillRef.current?.getModule('signalClipboard');
    if (!signalClipboard) {
      return;
    }
    if (!(signalClipboard instanceof SignalClipboard)) {
      throw new Error(
        'CompositionInput: signalClipboard module not properly initialized'
      );
    }

    signalClipboard.updateOptions({
      isDisabled: !isActive,
    });
  }, [isActive]);

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
    if (!blotToDelete) {
      return true;
    }

    if (isMentionBlot(blotToDelete)) {
      const contents = quill.getContents(0, selection.index - 1);
      const restartDelta = getDeltaToRestartMention(contents.ops);

      quill.updateContents(restartDelta);
      quill.setSelection(selection.index, 0);
      return false;
    }

    if (isEmojiBlot(blotToDelete)) {
      const contents = quill.getContents(0, selection.index);
      const restartDelta = getDeltaToRestartEmoji(contents.ops);

      quill.updateContents(restartDelta);
      return false;
    }

    return true;
  };

  const onChange = (): void => {
    const quill = quillRef.current;

    const { text, bodyRanges } = getTextAndRanges();

    if (quill !== undefined) {
      // This is pretty ugly, but it seems that Chromium tries to replicate the computed
      // style of removed DOM elements. 100% reproducible by selecting formatted lines and
      // typing new text. This code removes the style tags that we don't want there, and
      // quill doesn't know about. It can result formatting on the resultant message that
      // doesn't match the composer.
      const withStyles = quill.container.querySelectorAll('[style]');
      for (const node of withStyles) {
        node.attributes.removeNamedItem('style');
      }

      if (text.length > MAX_LENGTH) {
        quill.history.undo();
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
            conversationId: conversationId ?? undefined,
            messageText: text,
            sendCounter,
          });
        }, 0);
      }
    }

    if (propsRef.current.onDirtyChange) {
      let isDirty: boolean = false;

      if (!draftEditMessage) {
        isDirty = text.length > 0;
      } else if (text.trimEnd() !== draftEditMessage.body.trimEnd()) {
        isDirty = true;
      } else if (bodyRanges.length !== draftEditMessage.bodyRanges?.length) {
        isDirty = true;
      } else if (!areBodyRangesEqual(bodyRanges, draftEditMessage.bodyRanges)) {
        isDirty = true;
      } else if (dropNull(quotedMessageId) !== draftEditMessage.quote?.id) {
        isDirty = true;
      }

      propsRef.current.onDirtyChange(isDirty);
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

    if (emojiCompletion == null || skinTone == null) {
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

  const search = useEmojiSearch(i18n.getLocale());

  const reactQuill = React.useMemo(
    () => {
      const delta = generateDelta(draftText || '', draftBodyRanges || []);

      return (
        <SimpleQuillWrapper
          className={`${BASE_CLASS_NAME}__quill`}
          onChange={() => callbacksRef.current.onChange()}
          defaultValue={delta}
          modules={{
            toolbar: false,
            signalClipboard: {
              isDisabled: !isActive,
            },
            clipboard: {
              defaultMatchersOverride: [],
              disableDefaultListeners: true,
              matchers: [
                [Node.TEXT_NODE, matchText],
                [Node.TEXT_NODE, matchNewline],
                ['br', matchBreak],
                [Node.ELEMENT_NODE, matchNewline],
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
                ShortEnter: {
                  key: 'Enter',
                  shortKey: true,
                  handler: () => callbacksRef.current.onShortKeyEnter(),
                },
                Enter: {
                  key: 'Enter',
                  handler: () => callbacksRef.current.onEnter(),
                },
                Escape: {
                  key: 'Escape',
                  handler: () => callbacksRef.current.onEscape(),
                },
                Backspace: {
                  key: 'Backspace',
                  handler: () => callbacksRef.current.onBackspace(),
                },
              },
            },
            emojiCompletion: {
              setEmojiPickerElement: setEmojiCompletionElement,
              onPickEmoji: (emoji: EmojiPickDataType) =>
                callbacksRef.current.onPickEmoji(emoji),
              skinTone,
              search,
            },
            autoSubstituteAsciiEmojis: {
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
              memberRepositoryRef,
              setMentionPickerElement: setMentionCompletionElement,
              ourConversationId,
              i18n,
              theme,
            },
          }}
          formats={getQuillFormats()}
          placeholder={placeholder || i18n('icu:sendMessage')}
          readOnly={disabled}
          ref={element => {
            if (!element) {
              return;
            }
            const quill = element.getQuill();
            if (!quill) {
              throw new Error(
                'CompositionInput: wrapper did not return quill!'
              );
            }

            quillRef.current = quill;

            quill.on(Emitter.events.COMPOSITION_START, () => {
              quill.root.classList.toggle('ql-blank', false);
            });
            quill.on(Emitter.events.COMPOSITION_END, () => {
              quill.root.classList.toggle('ql-blank', quill.editor.isBlank());
            });

            // When loading a multi-line message out of a draft, the cursor
            // position needs to be pushed to the end of the input manually.
            quill.once(Emitter.events.EDITOR_CHANGE, () => {
              setTimeout(() => {
                quill.setSelection(quill.getLength(), 0);
                quill.root.classList.add('ql-editor--loaded');
              }, 0);
            });

            quill.on(
              Emitter.events.SELECTION_CHANGE,
              (newRange: RangeStatic, oldRange: RangeStatic) => {
                // If we lose focus, store the last edit point for emoji insertion
                if (newRange == null) {
                  setLastSelectionRange(oldRange);
                }
              }
            );

            const tabKey = 'Tab';
            quill.keyboard.addBinding({
              key: tabKey,
              handler: () => callbacksRef.current.onTab(),
            });
            const ourHandler = quill.keyboard.bindings[tabKey].pop();
            if (ourHandler) {
              quill.keyboard.bindings[tabKey].unshift(ourHandler);
            }

            const emojiCompletion = quill.getModule('emojiCompletion');
            if (!(emojiCompletion instanceof EmojiCompletion)) {
              throw new Error(
                'CompositionInput: emojiCompletion module not properly initialized'
              );
            }
            emojiCompletionRef.current = emojiCompletion;

            const mentionCompletion = quill.getModule('mentionCompletion');
            if (!(mentionCompletion instanceof MentionCompletion)) {
              throw new Error(
                'CompositionInput: mentionCompletion module not properly initialized'
              );
            }
            mentionCompletionRef.current = mentionCompletion;
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
