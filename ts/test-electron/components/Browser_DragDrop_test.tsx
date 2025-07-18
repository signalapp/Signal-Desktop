// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { assert } from 'chai';
import sinon from 'sinon';
import { ConversationView } from '../../components/conversation/ConversationView';

type IPCType = {
  downloadImageFromUrl: sinon.SinonStub;
};

// Helper to create a DataTransfer object for drag-and-drop
function createDataTransfer({
  uriList,
  plainText,
  html,
}: {
  uriList?: string;
  plainText?: string;
  html?: string;
}) {
  const data: Record<string, string> = {};
  if (uriList) {
    data['text/uri-list'] = uriList;
  }

  if (plainText) {
    data['text/plain'] = plainText;
  }

  if (html) {
    data['text/html'] = html;
  }

  return {
    files: [],
    items: [],
    getData: (type: string) => data[type] || '',
  } as unknown as DataTransfer;
}

describe('<ConversationView> drag-and-drop integration', () => {
  let sandbox: sinon.SinonSandbox;
  let processAttachmentsStub: sinon.SinonStub;
  let downloadImageFromUrlStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    processAttachmentsStub = sandbox.stub();
    downloadImageFromUrlStub = sandbox.stub();

    (window as unknown as { IPC: IPCType }).IPC = {
      downloadImageFromUrl: downloadImageFromUrlStub,
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('handles drag-and-drop of a Google Images redirect URL', async () => {
    const googleRedirectUrl =
      'https://www.google.com/imgres?imgurl=https%3A%2F%2Fexample.com%2Fcat.png&imgrefurl=https%3A%2F%2Fexample.com%2F';
    downloadImageFromUrlStub.resolves({
      buffer: new Uint8Array([1, 2, 3]),
      mimeType: 'image/png',
      filename: 'cat.png',
    });

    const { container } = render(
      <ConversationView
        conversationId="test-convo"
        hasOpenModal={false}
        hasOpenPanel={false}
        isSelectMode={false}
        onExitSelectMode={() => {
          // intentionally blank
        }}
        processAttachments={processAttachmentsStub}
        renderCompositionArea={() => <div>composition</div>}
        renderConversationHeader={() => <div>header</div>}
        renderTimeline={() => <div>timeline</div>}
        renderPanel={() => undefined}
      />
    );

    // Simulate drag-and-drop event
    const dropZone = container.querySelector(
      '.ConversationView'
    ) as HTMLDivElement;
    const event = new window.Event('drop', {
      bubbles: true,
      cancelable: true,
    }) as DragEvent;
    Object.defineProperty(event, 'dataTransfer', {
      value: createDataTransfer({ uriList: googleRedirectUrl }),
    });
    fireEvent(dropZone, event);

    await waitFor(() => {
      assert.isTrue(
        downloadImageFromUrlStub.called,
        'downloadImageFromUrl should be called'
      );
      assert.isTrue(
        processAttachmentsStub.called,
        'processAttachments should be called'
      );
      const call = processAttachmentsStub.getCall(0);
      assert.deepEqual(call.args[0].conversationId, 'test-convo');
      assert.isArray(call.args[0].files);
      assert.strictEqual(call.args[0].files[0].name, 'cat.png');
    });
  });

  it('handles drag-and-drop of a direct image URL', async () => {
    const directImageUrl = 'https://example.com/dog.jpg';
    downloadImageFromUrlStub.resolves({
      buffer: new Uint8Array([4, 5, 6]),
      mimeType: 'image/jpeg',
      filename: 'dog.jpg',
    });

    const { container } = render(
      <ConversationView
        conversationId="test-convo"
        hasOpenModal={false}
        hasOpenPanel={false}
        isSelectMode={false}
        onExitSelectMode={() => {
          // intentionally blank
        }}
        processAttachments={processAttachmentsStub}
        renderCompositionArea={() => <div>composition</div>}
        renderConversationHeader={() => <div>header</div>}
        renderTimeline={() => <div>timeline</div>}
        renderPanel={() => undefined}
      />
    );

    const dropZone = container.querySelector(
      '.ConversationView'
    ) as HTMLDivElement;
    const event = new window.Event('drop', {
      bubbles: true,
      cancelable: true,
    }) as DragEvent;
    Object.defineProperty(event, 'dataTransfer', {
      value: createDataTransfer({ uriList: directImageUrl }),
    });
    fireEvent(dropZone, event);

    await waitFor(() => {
      assert.isTrue(
        downloadImageFromUrlStub.calledWith(directImageUrl),
        'downloadImageFromUrl should be called with direct image URL'
      );
      assert.isTrue(
        processAttachmentsStub.called,
        'processAttachments should be called'
      );
      const call = processAttachmentsStub.getCall(0);
      assert.deepEqual(call.args[0].conversationId, 'test-convo');
      assert.isArray(call.args[0].files);
      assert.strictEqual(call.args[0].files[0].name, 'dog.jpg');
    });
  });
});
