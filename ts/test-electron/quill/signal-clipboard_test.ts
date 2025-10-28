// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { Delta } from '@signalapp/quill-cjs';
import type Quill from '@signalapp/quill-cjs';

import { SignalClipboard } from '../../quill/signal-clipboard/index.dom.js';
import { QuillFormattingStyle } from '../../quill/formatting/menu.dom.js';

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

function createMockQuillWithContent(
  content: string,
  hasStrike: boolean = false
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
