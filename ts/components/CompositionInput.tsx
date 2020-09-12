import * as React from 'react';
import { createPortal } from 'react-dom';
import {
  CompositeDecorator,
  ContentBlock,
  ContentState,
  DraftEditorCommand,
  DraftHandleValue,
  Editor,
  EditorChangeType,
  EditorState,
  getDefaultKeyBinding,
  Modifier,
  SelectionState,
} from 'draft-js';
import Measure, { ContentRect } from 'react-measure';
import { Manager, Popper, Reference } from 'react-popper';
import { get, head, noop, trimEnd } from 'lodash';
import classNames from 'classnames';
import emojiRegex from 'emoji-regex';
import { Emoji } from './emoji/Emoji';
import { EmojiPickDataType } from './emoji/EmojiPicker';
import { convertShortName, EmojiData, search } from './emoji/lib';
import { LocalizerType } from '../types/Util';
import { createRefMerger } from './_util';

const MAX_LENGTH = 64 * 1024;
const colonsRegex = /(?:^|\s):[a-z0-9-_+]+:?/gi;
const triggerEmojiRegex = /^(?:[-+]\d|[a-z]{2})/i;

export type Props = {
  readonly i18n: LocalizerType;
  readonly disabled?: boolean;
  readonly large?: boolean;
  readonly editorRef?: React.RefObject<Editor>;
  readonly inputApi?: React.MutableRefObject<InputApi | undefined>;
  readonly skinTone?: EmojiPickDataType['skinTone'];
  readonly startingText?: string;
  onDirtyChange?(dirty: boolean): unknown;
  onEditorStateChange?(messageText: string, caretLocation: number): unknown;
  onEditorSizeChange?(rect: ContentRect): unknown;
  onTextTooLong(): unknown;
  onPickEmoji(o: EmojiPickDataType): unknown;
  onSubmit(message: string): unknown;
  getQuotedMessage(): unknown;
  clearQuotedMessage(): unknown;
};

export type InputApi = {
  insertEmoji: (e: EmojiPickDataType) => void;
  reset: () => void;
  resetEmojiResults: () => void;
  submit: () => void;
};

export type CompositionInputEditorCommand =
  | DraftEditorCommand
  | ('enter-emoji' | 'next-emoji' | 'prev-emoji' | 'submit');

function getTrimmedMatchAtIndex(str: string, index: number, pattern: RegExp) {
  let match;

  // Reset regex state
  pattern.exec('');

  // eslint-disable-next-line no-cond-assign
  while ((match = pattern.exec(str))) {
    const matchStr = match.toString();
    const start = match.index + (matchStr.length - matchStr.trimLeft().length);
    const end = match.index + matchStr.trimRight().length;

    if (index >= start && index <= end) {
      return match.toString();
    }
  }

  return null;
}

function getLengthOfSelectedText(state: EditorState): number {
  const currentSelection = state.getSelection();
  let length = 0;

  const currentContent = state.getCurrentContent();
  const startKey = currentSelection.getStartKey();
  const endKey = currentSelection.getEndKey();
  const startBlock = currentContent.getBlockForKey(startKey);
  const isStartAndEndBlockAreTheSame = startKey === endKey;
  const startBlockTextLength = startBlock.getLength();
  const startSelectedTextLength =
    startBlockTextLength - currentSelection.getStartOffset();
  const endSelectedTextLength = currentSelection.getEndOffset();
  const keyAfterEnd = currentContent.getKeyAfter(endKey);

  if (isStartAndEndBlockAreTheSame) {
    length +=
      currentSelection.getEndOffset() - currentSelection.getStartOffset();
  } else {
    let currentKey = startKey;

    while (currentKey && currentKey !== keyAfterEnd) {
      if (currentKey === startKey) {
        length += startSelectedTextLength + 1;
      } else if (currentKey === endKey) {
        length += endSelectedTextLength;
      } else {
        length += currentContent.getBlockForKey(currentKey).getLength() + 1;
      }

      currentKey = currentContent.getKeyAfter(currentKey);
    }
  }

  return length;
}

function getWordAtIndex(
  str: string,
  index: number
): { start: number; end: number; word: string } {
  const start = str
    .slice(0, index + 1)
    .replace(/\s+$/, '')
    .search(/\S+$/);

  let end =
    str
      .slice(index)
      .split('')
      .findIndex(c => /[^a-z0-9-_]/i.test(c) || c === ':') + index;

  const endChar = str[end];

  if (/\w|:/.test(endChar)) {
    end += 1;
  }

  const word = str.slice(start, end);

  if (word === ':' && index + 1 <= str.length) {
    return getWordAtIndex(str, index + 1);
  }

  return {
    start,
    end,
    word,
  };
}

const compositeDecorator = new CompositeDecorator([
  {
    strategy: (block, cb) => {
      const pat = emojiRegex();
      const text = block.getText();
      let match;
      let index;
      // eslint-disable-next-line no-cond-assign
      while ((match = pat.exec(text))) {
        index = match.index;
        cb(index, index + match[0].length);
      }
    },
    component: ({
      children,
      contentState,
      entityKey,
    }: {
      children: React.ReactNode;
      contentState: ContentState;
      entityKey: string;
    }) =>
      entityKey ? (
        <Emoji
          shortName={contentState.getEntity(entityKey).getData().shortName}
          skinTone={contentState.getEntity(entityKey).getData().skinTone}
          inline
          size={20}
        >
          {children}
        </Emoji>
      ) : (
        children
      ),
  },
]);

const getInitialEditorState = (startingText?: string) => {
  if (!startingText) {
    return EditorState.createEmpty(compositeDecorator);
  }

  const end = startingText.length;
  const state = EditorState.createWithContent(
    ContentState.createFromText(startingText),
    compositeDecorator
  );
  const selection = state.getSelection();
  const selectionAtEnd = selection.merge({
    anchorOffset: end,
    focusOffset: end,
  }) as SelectionState;

  return EditorState.forceSelection(state, selectionAtEnd);
};

export const CompositionInput = ({
  i18n,
  disabled,
  large,
  editorRef,
  inputApi,
  onDirtyChange,
  onEditorStateChange,
  onEditorSizeChange,
  onTextTooLong,
  onPickEmoji,
  onSubmit,
  skinTone,
  startingText,
  getQuotedMessage,
  clearQuotedMessage,
}: Props): JSX.Element => {
  const [editorRenderState, setEditorRenderState] = React.useState(
    getInitialEditorState(startingText)
  );
  const [searchText, setSearchText] = React.useState<string>('');
  const [emojiResults, setEmojiResults] = React.useState<Array<EmojiData>>([]);
  const [emojiResultsIndex, setEmojiResultsIndex] = React.useState<number>(0);
  const [editorWidth, setEditorWidth] = React.useState<number>(0);
  const [popperRoot, setPopperRoot] = React.useState<HTMLDivElement | null>(
    null
  );
  const dirtyRef = React.useRef(false);
  const focusRef = React.useRef(false);
  const editorStateRef = React.useRef<EditorState>(editorRenderState);
  const rootElRef = React.useRef<HTMLDivElement>();
  const rootElRefMerger = React.useMemo(createRefMerger, []);

  // This function sets editorState and also keeps a reference to the newly set
  // state so we can reference the state in effects and callbacks without
  // excessive cleanup
  const setAndTrackEditorState = React.useCallback(
    (newState: EditorState) => {
      setEditorRenderState(newState);
      editorStateRef.current = newState;
    },
    [setEditorRenderState, editorStateRef]
  );

  const updateExternalStateListeners = React.useCallback(
    (newState: EditorState) => {
      const plainText = newState
        .getCurrentContent()
        .getPlainText()
        .trim();
      const cursorBlockKey = newState.getSelection().getStartKey();
      const cursorBlockIndex = editorStateRef.current
        .getCurrentContent()
        .getBlockMap()
        .keySeq()
        .findIndex(key => key === cursorBlockKey);
      const caretLocation = newState
        .getCurrentContent()
        .getBlockMap()
        .valueSeq()
        .toArray()
        .reduce((sum: number, block: ContentBlock, currentIndex: number) => {
          if (currentIndex < cursorBlockIndex) {
            return sum + block.getText().length + 1; // +1 for newline
          }

          if (currentIndex === cursorBlockIndex) {
            return sum + newState.getSelection().getStartOffset();
          }

          return sum;
        }, 0);

      if (onDirtyChange) {
        const isDirty = !!plainText;
        if (dirtyRef.current !== isDirty) {
          dirtyRef.current = isDirty;
          onDirtyChange(isDirty);
        }
      }

      if (onEditorStateChange) {
        onEditorStateChange(plainText, caretLocation);
      }
    },
    [onDirtyChange, onEditorStateChange, editorStateRef]
  );

  const resetEmojiResults = React.useCallback(() => {
    setEmojiResults([]);
    setEmojiResultsIndex(0);
    setSearchText('');
  }, [setEmojiResults, setEmojiResultsIndex, setSearchText]);

  const getWordAtCaret = React.useCallback((state = editorStateRef.current) => {
    const selection = state.getSelection();
    const index = selection.getAnchorOffset();

    return getWordAtIndex(
      state
        .getCurrentContent()
        .getBlockForKey(selection.getAnchorKey())
        .getText(),
      index
    );
  }, []);

  const selectEmojiResult = React.useCallback(
    (dir: 'next' | 'prev', e?: React.KeyboardEvent) => {
      if (emojiResults.length > 0) {
        if (e) {
          e.preventDefault();
        }

        if (dir === 'next') {
          setEmojiResultsIndex(index => {
            const next = index + 1;

            if (next >= emojiResults.length) {
              return 0;
            }

            return next;
          });
        }

        if (dir === 'prev') {
          setEmojiResultsIndex(index => {
            const next = index - 1;

            if (next < 0) {
              return emojiResults.length - 1;
            }

            return next;
          });
        }
      }
    },
    [emojiResults]
  );

  const submit = React.useCallback(() => {
    const { current: state } = editorStateRef;
    const trimmedText = state
      .getCurrentContent()
      .getPlainText()
      .trim();
    onSubmit(trimmedText);
  }, [editorStateRef, onSubmit]);

  const handleEditorCommand = React.useCallback(
    (
      command: CompositionInputEditorCommand,
      state: EditorState,
      emojiOverride?: EmojiData
    ): DraftHandleValue => {
      if (command === 'enter-emoji') {
        const { short_name: shortName } =
          emojiOverride || emojiResults[emojiResultsIndex];

        const content = state.getCurrentContent();
        const selection = state.getSelection();
        const word = getWordAtCaret(state);
        const emojiContent = convertShortName(shortName, skinTone);
        const emojiEntityKey = content
          .createEntity('emoji', 'IMMUTABLE', {
            shortName,
            skinTone,
          })
          .getLastCreatedEntityKey();

        const replaceSelection = selection.merge({
          anchorOffset: word.start,
          focusOffset: word.end,
        });

        let newContent = Modifier.replaceText(
          content,
          replaceSelection as SelectionState,
          emojiContent,
          undefined,
          emojiEntityKey
        );

        const afterSelection = newContent.getSelectionAfter();

        if (
          afterSelection.getAnchorOffset() ===
          newContent.getBlockForKey(afterSelection.getAnchorKey()).getLength()
        ) {
          newContent = Modifier.insertText(newContent, afterSelection, ' ');
        }

        const newState = EditorState.push(
          state,
          newContent,
          'insert-emoji' as EditorChangeType
        );
        setAndTrackEditorState(newState);
        resetEmojiResults();
        onPickEmoji({ shortName });

        return 'handled';
      }

      if (command === 'submit') {
        submit();

        return 'handled';
      }

      if (command === 'next-emoji') {
        selectEmojiResult('next');
      }

      if (command === 'prev-emoji') {
        selectEmojiResult('prev');
      }

      return 'not-handled';
    },
    // Missing `onPickEmoji`, which is a prop, so not clearly memoized
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      emojiResults,
      emojiResultsIndex,
      getWordAtCaret,
      resetEmojiResults,
      selectEmojiResult,
      setAndTrackEditorState,
      skinTone,
      submit,
    ]
  );

  const handleEditorStateChange = React.useCallback(
    (newState: EditorState) => {
      // Does the current position have any emojiable text?
      const selection = newState.getSelection();
      const caretLocation = selection.getStartOffset();
      const content = newState
        .getCurrentContent()
        .getBlockForKey(selection.getAnchorKey())
        .getText();
      const match = getTrimmedMatchAtIndex(content, caretLocation, colonsRegex);

      // Update the state to indicate emojiable text at the current position.
      const newSearchText = match ? match.trim().substr(1) : '';
      if (newSearchText.endsWith(':')) {
        const bareText = trimEnd(newSearchText, ':');
        const emoji = head(search(bareText));
        if (emoji && bareText === emoji.short_name) {
          handleEditorCommand('enter-emoji', newState, emoji);

          // Prevent inserted colon from persisting to state
          return;
        }
        resetEmojiResults();
      } else if (triggerEmojiRegex.test(newSearchText) && focusRef.current) {
        setEmojiResults(search(newSearchText, 10));
        setSearchText(newSearchText);
        setEmojiResultsIndex(0);
      } else {
        resetEmojiResults();
      }

      // Finally, update the editor state
      setAndTrackEditorState(newState);
      updateExternalStateListeners(newState);
    },
    [
      focusRef,
      handleEditorCommand,
      resetEmojiResults,
      setAndTrackEditorState,
      setSearchText,
      setEmojiResults,
      updateExternalStateListeners,
    ]
  );

  const handleBeforeInput = React.useCallback((): DraftHandleValue => {
    if (!editorStateRef.current) {
      return 'not-handled';
    }

    const editorState = editorStateRef.current;
    const plainText = editorState.getCurrentContent().getPlainText();
    const selectedTextLength = getLengthOfSelectedText(editorState);

    if (plainText.length - selectedTextLength > MAX_LENGTH - 1) {
      onTextTooLong();

      return 'handled';
    }

    return 'not-handled';
  }, [onTextTooLong, editorStateRef]);

  const handlePastedText = React.useCallback(
    (pastedText: string): DraftHandleValue => {
      if (!editorStateRef.current) {
        return 'not-handled';
      }

      const editorState = editorStateRef.current;
      const plainText = editorState.getCurrentContent().getPlainText();
      const selectedTextLength = getLengthOfSelectedText(editorState);

      if (
        plainText.length + pastedText.length - selectedTextLength >
        MAX_LENGTH
      ) {
        onTextTooLong();

        return 'handled';
      }

      return 'not-handled';
    },
    [onTextTooLong, editorStateRef]
  );

  const resetEditorState = React.useCallback(() => {
    const newEmptyState = EditorState.createEmpty(compositeDecorator);
    setAndTrackEditorState(newEmptyState);
    resetEmojiResults();
  }, [resetEmojiResults, setAndTrackEditorState]);

  const handleEditorSizeChange = React.useCallback(
    (rect: ContentRect) => {
      if (rect.bounds) {
        setEditorWidth(rect.bounds.width);
        if (onEditorSizeChange) {
          onEditorSizeChange(rect);
        }
      }
    },
    [onEditorSizeChange, setEditorWidth]
  );

  const handleEditorArrowKey = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        selectEmojiResult('prev', e);
      }

      if (e.key === 'ArrowDown') {
        selectEmojiResult('next', e);
      }
    },
    [selectEmojiResult]
  );

  const handleEscapeKey = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (emojiResults.length > 0) {
        e.preventDefault();
        resetEmojiResults();
      } else if (getQuotedMessage()) {
        clearQuotedMessage();
      }
    },
    [clearQuotedMessage, emojiResults, getQuotedMessage, resetEmojiResults]
  );

  const insertEmoji = React.useCallback(
    (e: EmojiPickDataType, replaceWord = false) => {
      const { current: state } = editorStateRef;
      const selection = state.getSelection();
      const oldContent = state.getCurrentContent();
      const emojiContent = convertShortName(e.shortName, e.skinTone);
      const emojiEntityKey = oldContent
        .createEntity('emoji', 'IMMUTABLE', {
          shortName: e.shortName,
          skinTone: e.skinTone,
        })
        .getLastCreatedEntityKey();
      const word = getWordAtCaret();

      let newContent = Modifier.replaceText(
        oldContent,
        replaceWord
          ? (selection.merge({
              anchorOffset: word.start,
              focusOffset: word.end,
            }) as SelectionState)
          : selection,
        emojiContent,
        undefined,
        emojiEntityKey
      );

      const afterSelection = newContent.getSelectionAfter();

      if (
        afterSelection.getAnchorOffset() ===
        newContent.getBlockForKey(afterSelection.getAnchorKey()).getLength()
      ) {
        newContent = Modifier.insertText(newContent, afterSelection, ' ');
      }

      const newState = EditorState.push(
        state,
        newContent,
        'insert-emoji' as EditorChangeType
      );
      setAndTrackEditorState(newState);
      resetEmojiResults();
    },
    [editorStateRef, getWordAtCaret, setAndTrackEditorState, resetEmojiResults]
  );

  const onTab = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.shiftKey || emojiResults.length === 0) {
        return;
      }

      e.preventDefault();
      handleEditorCommand('enter-emoji', editorStateRef.current);
    },
    [emojiResults, editorStateRef, handleEditorCommand]
  );

  const editorKeybindingFn = React.useCallback(
    (e: React.KeyboardEvent): CompositionInputEditorCommand | null => {
      const commandKey = get(window, 'platform') === 'darwin' && e.metaKey;
      const controlKey = get(window, 'platform') !== 'darwin' && e.ctrlKey;

      if (e.key === 'Enter' && emojiResults.length > 0) {
        e.preventDefault();

        return 'enter-emoji';
      }

      if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
        if (large && !(controlKey || commandKey)) {
          return getDefaultKeyBinding(e);
        }

        e.preventDefault();

        return 'submit';
      }

      if (e.key === 'n' && e.ctrlKey) {
        e.preventDefault();

        return 'next-emoji';
      }

      if (e.key === 'p' && e.ctrlKey) {
        e.preventDefault();

        return 'prev-emoji';
      }

      // Get rid of default draft.js ctrl-m binding which interferes with Windows minimize
      if (e.key === 'm' && e.ctrlKey) {
        return null;
      }

      if (get(window, 'platform') === 'linux') {
        // Get rid of default draft.js shift-del binding which interferes with Linux cut
        if (e.key === 'Delete' && e.shiftKey) {
          return null;
        }
      }

      // Get rid of Ctrl-Shift-M, which by default adds a newline
      if ((e.key === 'm' || e.key === 'M') && e.shiftKey && e.ctrlKey) {
        e.preventDefault();

        return null;
      }

      // Get rid of Ctrl-/, which on GNOME is bound to 'select all'
      if (e.key === '/' && !e.shiftKey && e.ctrlKey) {
        e.preventDefault();

        return null;
      }

      return getDefaultKeyBinding(e);
    },
    [emojiResults, large]
  );

  // Create popper root
  React.useEffect(() => {
    if (emojiResults.length > 0) {
      const root = document.createElement('div');
      setPopperRoot(root);
      document.body.appendChild(root);

      return () => {
        document.body.removeChild(root);
        setPopperRoot(null);
      };
    }

    return noop;
  }, [setPopperRoot, emojiResults]);

  const onFocus = React.useCallback(() => {
    focusRef.current = true;
  }, [focusRef]);

  const onBlur = React.useCallback(() => {
    focusRef.current = false;
  }, [focusRef]);

  // Manage focus
  // Chromium places the editor caret at the beginning of contenteditable divs on focus
  // Here, we force the last known selection on focusin
  // (doing this with onFocus wasn't behaving properly)
  // This needs to be done in an effect because React doesn't support focus{In,Out}
  // https://github.com/facebook/react/issues/6410
  React.useLayoutEffect(() => {
    const { current: rootEl } = rootElRef;

    if (rootEl) {
      const onFocusIn = () => {
        const { current: oldState } = editorStateRef;
        // Force selection to be old selection
        setAndTrackEditorState(
          EditorState.forceSelection(oldState, oldState.getSelection())
        );
      };

      rootEl.addEventListener('focusin', onFocusIn);

      return () => {
        rootEl.removeEventListener('focusin', onFocusIn);
      };
    }

    return noop;
  }, [editorStateRef, rootElRef, setAndTrackEditorState]);

  if (inputApi) {
    // Using a React.MutableRefObject, so we need to reassign this prop.
    // eslint-disable-next-line no-param-reassign
    inputApi.current = {
      reset: resetEditorState,
      submit,
      insertEmoji,
      resetEmojiResults,
    };
  }

  return (
    <Manager>
      <Reference>
        {({ ref: popperRef }) => (
          <Measure bounds onResize={handleEditorSizeChange}>
            {({ measureRef }) => (
              <div
                className="module-composition-input__input"
                ref={rootElRefMerger(popperRef, measureRef, rootElRef)}
              >
                <div
                  className={classNames(
                    'module-composition-input__input__scroller',
                    large
                      ? 'module-composition-input__input__scroller--large'
                      : null
                  )}
                >
                  <Editor
                    ref={editorRef}
                    editorState={editorRenderState}
                    onChange={handleEditorStateChange}
                    placeholder={i18n('sendMessage')}
                    onUpArrow={handleEditorArrowKey}
                    onDownArrow={handleEditorArrowKey}
                    onEscape={handleEscapeKey}
                    onTab={onTab}
                    handleKeyCommand={handleEditorCommand}
                    handleBeforeInput={handleBeforeInput}
                    handlePastedText={handlePastedText}
                    keyBindingFn={editorKeybindingFn}
                    spellCheck
                    stripPastedStyles
                    readOnly={disabled}
                    onFocus={onFocus}
                    onBlur={onBlur}
                  />
                </div>
              </div>
            )}
          </Measure>
        )}
      </Reference>
      {emojiResults.length > 0 && popperRoot
        ? createPortal(
            <Popper placement="top" key={searchText}>
              {({ ref, style }) => (
                <div
                  ref={ref}
                  className="module-composition-input__emoji-suggestions"
                  style={{
                    ...style,
                    width: editorWidth,
                  }}
                  role="listbox"
                  aria-expanded
                  aria-activedescendant={`emoji-result--${emojiResults[emojiResultsIndex].short_name}`}
                  tabIndex={0}
                >
                  {emojiResults.map((emoji, index) => (
                    <button
                      type="button"
                      key={emoji.short_name}
                      id={`emoji-result--${emoji.short_name}`}
                      role="option button"
                      aria-selected={emojiResultsIndex === index}
                      onMouseDown={() => {
                        insertEmoji(
                          { shortName: emoji.short_name, skinTone },
                          true
                        );
                        onPickEmoji({ shortName: emoji.short_name });
                      }}
                      className={classNames(
                        'module-composition-input__emoji-suggestions__row',
                        emojiResultsIndex === index
                          ? 'module-composition-input__emoji-suggestions__row--selected'
                          : null
                      )}
                    >
                      <Emoji
                        shortName={emoji.short_name}
                        size={16}
                        skinTone={skinTone}
                      />
                      <div className="module-composition-input__emoji-suggestions__row__short-name">
                        :{emoji.short_name}:
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Popper>,
            popperRoot
          )
        : null}
    </Manager>
  );
};
