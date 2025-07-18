// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import { useEscapeHandling } from '../../hooks/useEscapeHandling';
import { getSuggestedFilename } from '../../types/Attachment';
import { IMAGE_PNG, type MIMEType } from '../../types/MIME';
import { extractImageUrl } from '../../util/parseImageUrl';

type DownloadImageResponse = {
  buffer: Uint8Array;
  mimeType: string;
  filename: string;
};

export type PropsType = {
  conversationId: string;
  hasOpenModal: boolean;
  hasOpenPanel: boolean;
  isSelectMode: boolean;
  onExitSelectMode: () => void;
  processAttachments: (options: {
    conversationId: string;
    files: ReadonlyArray<File>;
    flags: number | null;
  }) => void;
  renderCompositionArea: (conversationId: string) => JSX.Element;
  renderConversationHeader: (conversationId: string) => JSX.Element;
  renderTimeline: (conversationId: string) => JSX.Element;
  renderPanel: (conversationId: string) => JSX.Element | undefined;
  shouldHideConversationView?: boolean;
};

// https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/core/clipboard/data_object_item.cc;l=184;drc=1d545578bf3756af94e89f274544c6017267f885
const DEFAULT_CHROMIUM_IMAGE_FILENAME = 'image.png';

function getAsFile(item: DataTransferItem): File | null {
  const file = item.getAsFile();
  if (!file) {
    return null;
  }

  if (
    file.type === IMAGE_PNG &&
    file.name === DEFAULT_CHROMIUM_IMAGE_FILENAME
  ) {
    return new File(
      [file.slice(0, file.size, file.type)],
      getSuggestedFilename({
        attachment: {
          contentType: file.type as MIMEType,
        },
        timestamp: Date.now(),
        scenario: 'sending',
      }),
      {
        type: file.type,
        lastModified: file.lastModified,
      }
    );
  }
  return file;
}

// Utility to extract <img src=...> from HTML
function extractImgSrcFromHtml(html: string): string | undefined {
  const match = html.match(/<img[^>]+src=["']([^"'>]+)["']/i);
  return match ? match[1] : undefined;
}

export function ConversationView({
  conversationId,
  hasOpenModal,
  hasOpenPanel,
  isSelectMode,
  onExitSelectMode,
  processAttachments,
  renderCompositionArea,
  renderConversationHeader,
  renderTimeline,
  renderPanel,
  shouldHideConversationView,
}: PropsType): JSX.Element {
  const onDrop = React.useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (!event.dataTransfer) {
        return;
      }

      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) {
        processAttachments({ conversationId, files, flags: null });
        return;
      }

      // Try to get an image file from dataTransfer.items
      let foundImage = false;
      if (event.dataTransfer?.items) {
        for (let i = 0; i < event.dataTransfer.items.length; i += 1) {
          const item = event.dataTransfer.items[i];
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              processAttachments({
                conversationId,
                files: [file],
                flags: null,
              });
              foundImage = true;
              break;
            }
          }
        }
      }
      if (foundImage) {
        return;
      }

      // Try using the extraction function
      let imageUrl =
        event.dataTransfer?.getData('text/uri-list') ||
        event.dataTransfer?.getData('text/plain');

      if (imageUrl && imageUrl.startsWith('http')) {
        const realImageUrl = extractImageUrl(imageUrl);

        if (/\.(jpe?g|png|gif|bmp|webp|svg)(\?|$)/i.test(realImageUrl)) {
          const response: DownloadImageResponse =
            await window.IPC.downloadImageFromUrl(realImageUrl);
          const array = new Uint8Array(response.buffer);
          const blob = new Blob([array], { type: response.mimeType });
          const file = new File([blob], response.filename, {
            type: response.mimeType,
          });
          processAttachments({
            conversationId,
            files: [file],
            flags: null,
          });
          return;
        }
        // If not a direct image URL, fall through to HTML parsing
        imageUrl = realImageUrl;
      }

      // Try to parse text/html for an <img src=...>
      const html = event.dataTransfer?.getData('text/html');
      if (html) {
        const imgSrc = extractImgSrcFromHtml(html);

        if (imgSrc && imgSrc.startsWith('http')) {
          const response: DownloadImageResponse =
            await window.IPC.downloadImageFromUrl(imgSrc);
          const array = new Uint8Array(response.buffer);
          const blob = new Blob([array], { type: response.mimeType });
          const file = new File([blob], response.filename, {
            type: response.mimeType,
          });
          processAttachments({
            conversationId,
            files: [file],
            flags: null,
          });
        }
      }
    },
    [conversationId, processAttachments]
  );

  const onPaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      if (hasOpenModal || hasOpenPanel) {
        return;
      }

      if (!event.clipboardData) {
        return;
      }
      const { items } = event.clipboardData;

      const fileItems = [...items].filter(item => item.kind === 'file');
      if (fileItems.length === 0) {
        return;
      }

      const allVisual = fileItems.every(item => {
        const type = item.type.split('/')[0];
        return type === 'image' || type === 'video';
      });
      if (allVisual) {
        const files: Array<File> = [];
        for (let i = 0; i < items.length; i += 1) {
          const file = getAsFile(items[i]);
          if (file) {
            files.push(file);
          }
        }

        processAttachments({
          conversationId,
          files,
          flags: null,
        });

        event.stopPropagation();
        event.preventDefault();

        return;
      }

      const firstAttachment = fileItems[0] ? getAsFile(fileItems[0]) : null;
      if (firstAttachment) {
        processAttachments({
          conversationId,
          files: [firstAttachment],
          flags: null,
        });

        event.stopPropagation();
        event.preventDefault();
      }
    },
    [conversationId, processAttachments, hasOpenModal, hasOpenPanel]
  );

  useEscapeHandling(
    isSelectMode && !hasOpenModal ? onExitSelectMode : undefined
  );

  return (
    <div
      className="ConversationView ConversationPanel"
      onDrop={onDrop}
      onPaste={onPaste}
    >
      <div
        className={classNames('ConversationPanel', {
          ConversationPanel__hidden: shouldHideConversationView,
        })}
      >
        <div className="ConversationView__header">
          {renderConversationHeader(conversationId)}
        </div>
        <div className="ConversationView__pane">
          <div className="ConversationView__timeline--container">
            <div aria-live="polite" className="ConversationView__timeline">
              {renderTimeline(conversationId)}
            </div>
          </div>
          <div className="ConversationView__composition-area">
            {renderCompositionArea(conversationId)}
          </div>
        </div>
      </div>
      {renderPanel(conversationId)}
    </div>
  );
}
