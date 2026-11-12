// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import Quill, { Delta } from '@signalapp/quill-cjs';
import Emitter from '@signalapp/quill-cjs/core/emitter.js';

import { Emoji } from '../../axo/emoji.std.ts';
import {
  CompositionInput,
  type Props,
} from '../../components/CompositionInput.dom.tsx';
import { ThemeType } from '../../types/Util.std.ts';

function waitForDeferredCallbacks(): Promise<void> {
  return new Promise(resolve => {
    window.setTimeout(resolve, 0);
  });
}

describe('CompositionInput', () => {
  it('uses the latest editor contents when a URL is edited in the middle', async () => {
    const originalUrl = 'https://en.wikipedia.org/';
    const updatedUrl = 'https://es.wikipedia.org/';
    const expectedCaretLocation = 'https://es'.length;

    const editorStateChanges: Array<
      Parameters<Props['onEditorStateChange']>[0]
    > = [];

    const onEditorStateChange: Props['onEditorStateChange'] = options => {
      editorStateChanges.push(options);
    };

    const container = document.createElement('div');
    document.body.appendChild(container);

    const root = createRoot(container);

    try {
      const props: Props = {
        conversationId: 'composition-input-test',
        i18n: window.SignalContext.i18n,
        disabled: false,
        draftEditMessage: null,
        getPreferredBadge: () => undefined,
        large: false,
        inputApi: null,
        isFormattingEnabled: false,
        isActive: true,
        sendCounter: 0,
        emojiSkinToneDefault: Emoji.SkinTone.None,
        draftText: originalUrl,
        draftBodyRanges: [],
        theme: ThemeType.light,
        sortedGroupMembers: [],
        onEditorStateChange,
        onTextTooLong: () => undefined,
        onSelectEmoji: () => undefined,
        onSubmit: () => false,
        ourConversationId: undefined,
        platform: 'win32',
        showRecoveryKeyPasteWarning: false,
        quotedMessageId: null,
        shouldHidePopovers: null,
        linkPreviewResult: null,
        onCloseLinkPreview: () => undefined,
        showViewOnceButton: false,
        isViewOnceActive: false,
        onToggleViewOnce: () => undefined,
      };

      // Mount the actual CompositionInput component.
      flushSync(() => {
        root.render(<CompositionInput {...props} />);
      });

      // Allow Quill's initial content and deferred callback to settle.
      await waitForDeferredCallbacks();

      const quillContainer =
        container.querySelector<HTMLElement>('.ql-container');

      assert.exists(quillContainer, 'Quill container should exist');

      const quill = Quill.find(quillContainer) as unknown as Quill;

      assert.instanceOf(quill, Quill);

      // Ignore initial editor initialization callbacks.
      editorStateChanges.length = 0;

      // Simulate the editor-change notification while the old contents
      // are still available.
      const emitter = (
        quill as unknown as {
          emitter: {
            emit: (event: string, ...args: Array<unknown>) => void;
          };
        }
      ).emitter;

      emitter.emit(
        Emitter.events.EDITOR_CHANGE,
        Emitter.events.TEXT_CHANGE,
        new Delta(),
        quill.getContents(),
        'user'
      );

      // Simulate Quill settling on the updated URL before the deferred
      // callback executes, without generating another editor-change event.
      quill.setContents(new Delta().insert(updatedUrl).insert('\n'), 'silent');

      quill.setSelection(expectedCaretLocation, 0, 'silent');

      // Let the setTimeout(0) callback execute.
      await waitForDeferredCallbacks();

      const updatedState = editorStateChanges.find(
        change => change.messageText === updatedUrl
      );

      assert.exists(
        updatedState,
        'onEditorStateChange should receive the updated URL'
      );

      assert.strictEqual(
        updatedState.messageText,
        updatedUrl,
        'The latest editor text should be passed to onEditorStateChange'
      );

      assert.strictEqual(
        updatedState.caretLocation,
        expectedCaretLocation,
        'The post-change caret position should be preserved'
      );

      assert.isBelow(
        updatedState.caretLocation ?? 0,
        updatedUrl.length,
        'The caret should remain inside the URL, not at its end'
      );
    } finally {
      flushSync(() => {
        root.unmount();
      });

      container.remove();
    }
  });
});
