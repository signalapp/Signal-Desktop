import * as React from 'react';
import { createPortal } from 'react-dom';
import { createSelector } from 'reselect';
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
import {
  convertShortName,
  EmojiData,
  replaceColons,
  search,
} from './emoji/lib';
import { LocalizerType } from '../types/Util';

const colonsRegex = /(?:^|\s):[a-z0-9-_+]+:?/gi;

export type Props = {
  readonly i18n: LocalizerType;
  readonly disabled?: boolean;
  readonly editorRef?: React.RefObject<Editor>;
  readonly inputApi?: React.MutableRefObject<InputApi | undefined>;
  readonly skinTone?: EmojiPickDataType['skinTone'];
  onDirtyChange?(dirty: boolean): unknown;
  onEditorStateChange?(messageText: string, caretLocation: number): unknown;
  onEditorSizeChange?(rect: ContentRect): unknown;
  onPickEmoji(o: EmojiPickDataType): unknown;
  onSubmit(message: string): unknown;
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

  // tslint:disable-next-line no-conditional-assignment
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

function getWordAtIndex(str: string, index: number) {
  const start = str
    .slice(0, index + 1)
    .replace(/\s+$/, '')
    .search(/\S+$/);
  const end = str.slice(index).search(/(?:\s|$)/) + index;

  return {
    start,
    end,
    word: str.slice(start, end),
  };
}

const compositeDecorator = new CompositeDecorator([
  {
    strategy: (block, cb) => {
      const pat = emojiRegex();
      const text = block.getText();
      let match;
      let index;
      // tslint:disable-next-line no-conditional-assignment
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
          inline={true}
          size={20}
        >
          {children}
        </Emoji>
      ) : (
        children
      ),
  },
]);

type FunctionRef = (el: HTMLElement | null) => unknown;

// A selector which combines multiple react refs into a single, referentially-equal functional ref.
const combineRefs = createSelector(
  (r1: FunctionRef) => r1,
  (_r1: any, r2: FunctionRef) => r2,
  (_r1: any, _r2: any, r3: React.MutableRefObject<HTMLDivElement>) => r3,
  (r1, r2, r3) => (el: HTMLDivElement) => {
    r1(el);
    r2(el);
    r3.current = el;
  }
);

// tslint:disable-next-line max-func-body-length
export const CompositionInput = ({
  i18n,
  disabled,
  editorRef,
  inputApi,
  onDirtyChange,
  onEditorStateChange,
  onEditorSizeChange,
  onPickEmoji,
  onSubmit,
  skinTone,
}: Props) => {
  const [editorRenderState, setEditorRenderState] = React.useState(
    EditorState.createEmpty(compositeDecorator)
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
      const plainText = newState.getCurrentContent().getPlainText();
      const currentBlockKey = newState.getSelection().getStartKey();
      const currentBlockIndex = editorStateRef.current
        .getCurrentContent()
        .getBlockMap()
        .keySeq()
        .findIndex(key => key === currentBlockKey);
      const caretLocation = newState
        .getCurrentContent()
        .getBlockMap()
        .valueSeq()
        .toArray()
        .reduce((sum: number, block: ContentBlock, index: number) => {
          if (currentBlockIndex < index) {
            return sum + block.getText().length + 1; // +1 for newline
          }

          if (currentBlockIndex === index) {
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

  const resetEmojiResults = React.useCallback(
    () => {
      setEmojiResults([]);
      setEmojiResultsIndex(0);
      setSearchText('');
    },
    [setEmojiResults, setEmojiResultsIndex, setSearchText]
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
        } else {
          resetEmojiResults();
        }
      } else if (newSearchText.length >= 2 && focusRef.current) {
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
      resetEmojiResults,
      setAndTrackEditorState,
      setSearchText,
      setEmojiResults,
    ]
  );

  const resetEditorState = React.useCallback(
    () => {
      const newEmptyState = EditorState.createEmpty(compositeDecorator);
      setAndTrackEditorState(newEmptyState);
      resetEmojiResults();
    },
    [editorStateRef, resetEmojiResults, setAndTrackEditorState]
  );

  const submit = React.useCallback(
    () => {
      const { current: state } = editorStateRef;
      const text = state.getCurrentContent().getPlainText();
      const emojidText = replaceColons(text);
      onSubmit(emojidText);
    },
    [editorStateRef, onSubmit]
  );

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
    [emojiResultsIndex, emojiResults]
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
      }
    },
    [resetEmojiResults, emojiResults]
  );

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

  const insertEmoji = React.useCallback(
    (e: EmojiPickDataType, replaceWord: boolean = false) => {
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

      let newContent = replaceWord
        ? Modifier.replaceText(
            oldContent,
            selection.merge({
              anchorOffset: word.start,
              focusOffset: word.end,
            }) as SelectionState,
            emojiContent,
            undefined,
            emojiEntityKey
          )
        : Modifier.insertText(
            oldContent,
            selection,
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
    [editorStateRef, setAndTrackEditorState, resetEmojiResults]
  );

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
    [
      emojiResults,
      emojiResultsIndex,
      resetEmojiResults,
      selectEmojiResult,
      setAndTrackEditorState,
      skinTone,
      submit,
    ]
  );

  const onTab = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.shiftKey || emojiResults.length === 0) {
        return;
      }

      e.preventDefault();
      handleEditorCommand('enter-emoji', editorStateRef.current);
    },
    [emojiResults, editorStateRef, handleEditorCommand, resetEmojiResults]
  );

  const editorKeybindingFn = React.useCallback(
    (e: React.KeyboardEvent): CompositionInputEditorCommand | null => {
      if (e.key === 'Enter' && emojiResults.length > 0) {
        e.preventDefault();

        return 'enter-emoji';
      }

      if (e.key === 'Enter' && !e.shiftKey) {
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

      return getDefaultKeyBinding(e);
    },
    [emojiResults]
  );

  // Create popper root
  React.useEffect(
    () => {
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
    },
    [setPopperRoot, emojiResults]
  );

  const onFocus = React.useCallback(
    () => {
      focusRef.current = true;
    },
    [focusRef]
  );

  const onBlur = React.useCallback(
    () => {
      focusRef.current = false;
    },
    [focusRef]
  );

  // Manage focus
  // Chromium places the editor caret at the beginning of contenteditable divs on focus
  // Here, we force the last known selection on focusin (doing this with onFocus wasn't behaving properly)
  // This needs to be done in an effect because React doesn't support focus{In,Out}
  // https://github.com/facebook/react/issues/6410
  React.useLayoutEffect(
    () => {
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
    },
    [editorStateRef, rootElRef, setAndTrackEditorState]
  );

  if (inputApi) {
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
          <Measure bounds={true} onResize={handleEditorSizeChange}>
            {({ measureRef }) => (
              <div
                className="module-composition-input__input"
                ref={combineRefs(popperRef, measureRef, rootElRef)}
              >
                <div className="module-composition-input__input__scroller">
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
                    keyBindingFn={editorKeybindingFn}
                    spellCheck={true}
                    stripPastedStyles={true}
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
                  aria-expanded={true}
                  aria-activedescendant={`emoji-result--${
                    emojiResults[emojiResultsIndex].short_name
                  }`}
                >
                  {emojiResults.map((emoji, index) => (
                    <button
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
