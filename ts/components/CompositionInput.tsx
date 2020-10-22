import * as React from 'react';

import Delta from 'quill-delta';
import ReactQuill from 'react-quill';
import classNames from 'classnames';
import emojiRegex from 'emoji-regex';
import { Manager, Reference } from 'react-popper';
import Quill, { KeyboardStatic } from 'quill';
import Op from 'quill-delta/dist/Op';

import { EmojiBlot, EmojiCompletion } from '../quill/emoji';
import { LocalizerType } from '../types/Util';

import { EmojiPickDataType } from './emoji/EmojiPicker';
import { convertShortName } from './emoji/lib';
import { matchEmojiBlot, matchEmojiImage } from '../quill/matchImage';

Quill.register('formats/emoji', EmojiBlot);
Quill.register('modules/emojiCompletion', EmojiCompletion);

const Block = Quill.import('blots/block');
Block.tagName = 'DIV';
Quill.register(Block, true);

declare module 'quill' {
  interface Quill {
    // in-code reference missing in @types
    scrollingContainer: HTMLElement;
  }

  interface KeyboardStatic {
    // in-code reference missing in @types
    bindings: Record<string | number, Array<unknown>>;
  }
}

declare module 'react-quill' {
  // `react-quill` uses a different but compatible version of Delta
  // tell it to use the type definition from the `quill-delta` library
  type DeltaStatic = Delta;
}

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
  readonly startingText?: string;
  onDirtyChange?(dirty: boolean): unknown;
  onEditorStateChange?(messageText: string, caretLocation?: number): unknown;
  onTextTooLong(): unknown;
  onPickEmoji(o: EmojiPickDataType): unknown;
  onSubmit(message: string): unknown;
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
    startingText,
  } = props;

  const [emojiCompletionElement, setEmojiCompletionElement] = React.useState<
    JSX.Element
  >();

  const emojiCompletionRef = React.useRef<EmojiCompletion>();
  const quillRef = React.useRef<Quill>();
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const propsRef = React.useRef<Props>(props);

  const generateDelta = (text: string): Delta => {
    const re = emojiRegex();
    const ops: Array<Op> = [];

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

    return new Delta(ops);
  };

  const getText = (): string => {
    const quill = quillRef.current;

    if (quill === undefined) {
      return '';
    }

    const contents = quill.getContents();

    if (contents === undefined) {
      return '';
    }

    const { ops } = contents;

    if (ops === undefined) {
      return '';
    }

    const text = ops.reduce((acc, { insert }) => {
      if (typeof insert === 'string') {
        return acc + insert;
      }

      if (insert.emoji) {
        return acc + insert.emoji;
      }

      return acc;
    }, '');

    return text.trim();
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

    if (range === null) {
      return;
    }

    const emoji = convertShortName(e.shortName, e.skinTone);

    const delta = new Delta()
      .retain(range.index)
      .delete(range.length)
      .insert({ emoji });

    quill.updateContents(delta, 'user');
    quill.setSelection(range.index + 1, 0, 'user');
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

    const text = getText();
    if (text.length > 0) {
      onSubmit(text);
    }
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

    if (quill === undefined) {
      return false;
    }

    if (emojiCompletion === undefined) {
      return false;
    }

    if (emojiCompletion.results.length) {
      emojiCompletion.completeEmoji();
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

    if (quill === undefined) {
      return false;
    }

    if (emojiCompletion === undefined) {
      return false;
    }

    if (emojiCompletion.results.length) {
      emojiCompletion.completeEmoji();
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

    if (emojiCompletion) {
      if (emojiCompletion.results.length) {
        emojiCompletion.reset();
        return false;
      }
    }

    if (propsRef.current.getQuotedMessage()) {
      propsRef.current.clearQuotedMessage();
      return false;
    }

    return true;
  };

  const onChange = () => {
    const text = getText();
    const quill = quillRef.current;

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

      if (emojiCompletion === undefined) {
        return;
      }

      emojiCompletion.destroy();
    },
    []
  );

  const reactQuill = React.useMemo(
    () => {
      const delta = generateDelta(startingText || '');

      return (
        <ReactQuill
          className="module-composition-input__quill"
          onChange={onChange}
          defaultValue={delta}
          modules={{
            toolbar: false,
            clipboard: {
              matchers: [
                ['IMG', matchEmojiImage],
                ['SPAN', matchEmojiBlot],
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
              },
            },
            emojiCompletion: {
              setEmojiPickerElement: setEmojiCompletionElement,
              onPickEmoji,
              skinTone,
            },
          }}
          formats={['emoji']}
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

                quill.setSelection(quill.getLength(), 0);
              });

              quillRef.current = quill;
              emojiCompletionRef.current = quill.getModule('emojiCompletion');
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
            </div>
          </div>
        )}
      </Reference>
    </Manager>
  );
};
