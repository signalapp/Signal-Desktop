// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { Delta } from '@signalapp/quill-cjs';
import type Quill from '@signalapp/quill-cjs';

import { SignalClipboard } from '../../quill/signal-clipboard/index.dom.ts';
import { createEventHandler } from '../../quill/signal-clipboard/util.dom.ts';
import { QuillFormattingStyle } from '../../quill/formatting/menu.dom.tsx';

class MockQuill {
  public root: HTMLElement;
  public clipboard: {
    convert: (data: unknown, formats: Record<string, unknown>) => Delta;
  };
  public selection: {
    getRange: () => Array<unknown> | [null];
    update: (mode: string) => void;
  };
  public getContents: (
    index: number,
    length: number
  ) => { ops: Array<unknown> };
  public getSelection: () => { index: number; length: number } | null;
  public getLength: () => number;
  public getFormat: (index: number) => Record<string, unknown>;
  public updateContents: (delta: Delta, source: string) => void;
  public setSelection: (index: number, length: number, mode: string) => void;
  public scrollSelectionIntoView: () => void;
  public focus: () => void;

  constructor() {
    this.root = document.createElement('div');
    this.clipboard = {
      convert: (_data: unknown, formats: Record<string, unknown>) => {
        // Mock clipboard conversion - returns delta
        const text = 'test';
        return new Delta([{ insert: text, attributes: formats }]);
      },
    };
    this.selection = {
      getRange: () => [null],
      update: () => {
        // Placeholder for linter
      },
    };
    this.getContents = (_index: number, _length: number) => ({ ops: [] });
    this.getSelection = () => ({ index: 0, length: 0 });
    this.getLength = () => 1;
    this.getFormat = () => ({});
    this.updateContents = () => {
      // Placeholder for linter
    };
    this.setSelection = () => {
      // Placeholder for linter
    };
    this.scrollSelectionIntoView = () => {
      // Placeholder for linter
    };
    this.focus = () => {
      // Placeholder for linter
    };
  }
}

function createMockClipboardEvent(
  textData: string | null = null,
  signalData: string | null = null
): ClipboardEvent {
  const event = new Event('paste') as ClipboardEvent;
  Object.defineProperty(event, 'clipboardData', {
    value: {
      getData: (format: string) => {
        if (format === 'text/plain') {
          return textData || '';
        }
        if (format === 'text/signal') {
          return signalData || '';
        }
        return '';
      },
      files: null,
    } as unknown as DataTransfer,
    writable: false,
  });
  return event;
}

function createMockCopyEvent(): {
  clipboardData: Map<string, string>;
  event: ClipboardEvent;
} {
  const clipboardData = new Map<string, string>();
  const event = new Event('copy', {
    bubbles: true,
    cancelable: true,
  }) as ClipboardEvent;

  Object.defineProperty(event, 'clipboardData', {
    value: {
      setData: (format: string, value: string) => {
        clipboardData.set(format, value);
      },
    } as unknown as DataTransfer,
    writable: false,
  });

  return { clipboardData, event };
}

function createMockQuillWithContent(
  content: string,
  hasStrike = false
): MockQuill {
  const mockQuill = new MockQuill();

  mockQuill.getContents = () => ({
    ops: [
      {
        insert: content,
        attributes: hasStrike ? { [QuillFormattingStyle.strike]: true } : {},
      },
    ],
  });

  mockQuill.getLength = () => content.length + 1;

  return mockQuill;
}

function selectNodeContents(node: Node): void {
  const selection = window.getSelection();
  assert.exists(selection);

  const range = document.createRange();
  range.selectNodeContents(node);
  selection.removeAllRanges();
  selection.addRange(range);
}

function selectTextRange(node: Text, start: number, end: number): void {
  const selection = window.getSelection();
  assert.exists(selection);

  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  selection.removeAllRanges();
  selection.addRange(range);
}

describe('createEventHandler', () => {
  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    document.body.replaceChildren();
  });

  it('does not copy non-content selections', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <button type="button">Record audio</button>
      <script>window.startApp();</script>
    `;
    document.body.append(container);
    selectNodeContents(container);

    const { clipboardData, event } = createMockCopyEvent();
    createEventHandler({ deleteSelection: false })(event);

    assert.isTrue(event.defaultPrevented);
    assert.isFalse(clipboardData.has('text/plain'));
    assert.isFalse(clipboardData.has('text/signal'));
  });

  it('does not copy text selected directly inside buttons', () => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Record audio';
    document.body.append(button);
    selectNodeContents(button);

    const { clipboardData, event } = createMockCopyEvent();
    createEventHandler({ deleteSelection: false })(event);

    assert.isTrue(event.defaultPrevented);
    assert.isFalse(clipboardData.has('text/plain'));
    assert.isFalse(clipboardData.has('text/signal'));
  });

  it('does not copy empty selections', () => {
    window.getSelection()?.removeAllRanges();

    const { clipboardData, event } = createMockCopyEvent();
    createEventHandler({ deleteSelection: false })(event);

    assert.isTrue(event.defaultPrevented);
    assert.isFalse(clipboardData.has('text/plain'));
    assert.isFalse(clipboardData.has('text/signal'));
  });

  it('omits non-content elements from copied text and html', () => {
    const container = document.createElement('div');
    container.innerHTML =
      '<span>Hello </span>' +
      '<script>window.startApp();</script>' +
      '<style>.hidden { display: none; }</style>' +
      '<span hidden>hidden text</span>' +
      '<button type="button">Record audio</button>' +
      '<span>world</span>';
    document.body.append(container);
    selectNodeContents(container);

    const { clipboardData, event } = createMockCopyEvent();
    createEventHandler({ deleteSelection: false })(event);

    assert.strictEqual(clipboardData.get('text/plain'), 'Hello world');
    assert.notInclude(clipboardData.get('text/signal'), 'window.startApp');
    assert.notInclude(clipboardData.get('text/signal'), 'hidden text');
    assert.notInclude(clipboardData.get('text/signal'), 'Record audio');
  });

  it('copies aria-hidden text from Signal message content', () => {
    const container = document.createElement('div');
    container.innerHTML =
      '<div class="module-message__text">' +
      '<span aria-hidden="true">spoiler text</span>' +
      '</div>';
    document.body.append(container);
    selectNodeContents(container);

    const { clipboardData, event } = createMockCopyEvent();
    createEventHandler({ deleteSelection: false })(event);

    assert.strictEqual(clipboardData.get('text/plain'), 'spoiler text\n');
    assert.include(clipboardData.get('text/signal'), 'spoiler text');
  });

  it('copies selected text from inputs', () => {
    const input = document.createElement('input');
    input.value = 'hello world';
    document.body.append(input);

    input.focus();
    input.setSelectionRange(0, 5);

    const { clipboardData, event } = createMockCopyEvent();
    createEventHandler({ deleteSelection: false })(event);

    assert.strictEqual(clipboardData.get('text/plain'), 'hello');
  });

  it('copies selected whitespace from inputs', () => {
    const input = document.createElement('input');
    input.value = 'hello   world';
    document.body.append(input);

    input.focus();
    input.setSelectionRange(5, 8);

    const { clipboardData, event } = createMockCopyEvent();
    createEventHandler({ deleteSelection: false })(event);

    assert.strictEqual(clipboardData.get('text/plain'), '   ');
  });

  it('copies selected whitespace from Signal text containers', () => {
    const editor = document.createElement('div');
    editor.className = 'ql-editor';
    const line = document.createElement('div');
    const text = document.createTextNode('hello   world');
    line.append(text);
    editor.append(line);
    document.body.append(editor);

    selectTextRange(text, 5, 8);

    const { clipboardData, event } = createMockCopyEvent();
    createEventHandler({ deleteSelection: false })(event);

    assert.strictEqual(clipboardData.get('text/plain'), '   ');
  });
});

describe('SignalClipboard', () => {
  let mockQuill: MockQuill;
  let clipboard: SignalClipboard;

  beforeEach(() => {
    mockQuill = new MockQuill();
    clipboard = new SignalClipboard(mockQuill as unknown as Quill, {
      isDisabled: false,
    });
  });

  describe('onCapturePaste', () => {
    describe('when pasting plain text', () => {
      it('should not inherit strikethrough formatting from selected text', () => {
        const content = 'Hello world';
        mockQuill = createMockQuillWithContent(content, true);
        clipboard = new SignalClipboard(mockQuill as unknown as Quill, {
          isDisabled: false,
        });

        // Select all
        mockQuill.getSelection = () => ({ index: 0, length: content.length });

        // Conversion to delta
        let capturedFormats: Record<string, unknown> | null = null;
        mockQuill.clipboard.convert = (
          _data: unknown,
          formats: Record<string, unknown>
        ) => {
          capturedFormats = formats;
          return new Delta([{ insert: 'test', attributes: formats }]);
        };

        // Paste
        const pasteEvent = createMockClipboardEvent('New text', null);
        clipboard.onCapturePaste(pasteEvent);

        // Assert no formatting
        assert.deepEqual(capturedFormats, {});
      });

      it('should not inherit any formatting from selected text', () => {
        const content = 'Hello world';
        mockQuill = createMockQuillWithContent(content, false);
        mockQuill.getContents = () => ({
          ops: [
            {
              insert: content,
              attributes: {
                [QuillFormattingStyle.bold]: true,
                [QuillFormattingStyle.italic]: true,
              },
            },
          ],
        });
        clipboard = new SignalClipboard(mockQuill as unknown as Quill, {
          isDisabled: false,
        });

        // Select all content
        mockQuill.getSelection = () => ({ index: 0, length: content.length });

        // Conversion to delta
        let capturedFormats: Record<string, unknown> | null = null;
        mockQuill.clipboard.convert = (
          _data: unknown,
          formats: Record<string, unknown>
        ) => {
          capturedFormats = formats;
          return new Delta([{ insert: 'test', attributes: formats }]);
        };

        // Paste
        const pasteEvent = createMockClipboardEvent('New text', null);
        clipboard.onCapturePaste(pasteEvent);

        // Assert no formatting
        assert.deepEqual(capturedFormats, {});
      });
    });
  });
});
