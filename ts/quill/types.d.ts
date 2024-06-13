// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type UpdatedDelta from 'quill-delta';
import type { MentionCompletion } from './mentions/completion';
import type { EmojiCompletion } from './emoji/completion';
import type { FormattingMenu } from './formatting/menu';
import type { SignalClipboard } from './signal-clipboard';

declare module 'react-quill' {
  // `react-quill` uses a different but compatible version of Delta
  // tell it to use the type definition from the `quill-delta` library
  type DeltaStatic = UpdatedDelta;
}

// We want to extend some existing interfaces.
/* eslint-disable no-restricted-syntax */
declare module 'quill' {
  // this type is fixed in @types/quill, but our version of react-quill cannot
  // use the version of quill that has this fix in its typings
  // doing this manually allows us to use the correct type
  // https://github.com/DefinitelyTyped/DefinitelyTyped/commit/6090a81c7dbd02b6b917f903a28c6c010b8432ea#diff-bff5e435d15f8f99f733c837e76945bced86bb85e93a75467015cc9b33b48212
  interface UpdatedKey {
    key: string | number;
    shiftKey?: boolean;
    shortKey?: boolean;
  }

  export type AttributeMap = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
  export type Matcher = (
    node: HTMLElement,
    delta: UpdatedDelta,
    attributes: AttributeMap
  ) => UpdatedDelta;

  export type UpdatedTextChangeHandler = (
    delta: UpdatedDelta,
    oldContents: UpdatedDelta,
    source: Sources
  ) => void;

  export type UpdatedEditorChangeHandler = (
    eventName: 'text-change' | 'selection-change'
  ) => void;

  interface LeafBlot {
    text?: string;
    // Quill doesn't make it easy to type this result.
    // (It's probably doable, but not worth our time.)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value(): any;
  }

  interface HistoryStatic {
    undo(): void;
    clear(): void;
  }

  interface ClipboardStatic {
    convert(html: string): UpdatedDelta;
    matchers: Array<unknown>;
  }

  interface SelectionStatic {
    update(source: string): void;
  }

  interface Quill {
    updateContents(delta: UpdatedDelta, source?: Sources): UpdatedDelta;
    getContents(index?: number, length?: number): UpdatedDelta;
    getLeaf(index: number): [LeafBlot, number];
    // in-code reference missing in @types
    scrollingContainer: HTMLElement;

    on(
      eventName: 'text-change',
      handler: UpdatedTextChangeHandler
    ): EventEmitter;
    on(
      eventName: 'editor-change',
      handler: UpdatedEditorChangeHandler
    ): EventEmitter;

    getModule(module: 'clipboard'): ClipboardStatic;
    getModule(module: 'emojiCompletion'): EmojiCompletion;
    getModule(module: 'formattingMenu'): FormattingMenu;
    getModule(module: 'history'): HistoryStatic;
    getModule(module: 'mentionCompletion'): MentionCompletion;
    getModule(module: 'signalClipboard'): SignalClipboard;
    getModule(module: string): unknown;

    selection: SelectionStatic;
    options: Record<string, unknown>;
  }

  export type KeyboardContext = {
    format: Record<string, unknown>;
  };

  interface KeyboardStatic {
    addBinding(
      key: UpdatedKey,
      callback: (range: RangeStatic, context: KeyboardContext) => void
    ): void;
    // in-code reference missing in @types
    bindings: Record<string | number, Array<unknown>>;
  }
}
/* eslint-enable no-restricted-syntax */
