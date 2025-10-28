// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import { useEscapeHandling } from '../../hooks/useEscapeHandling.dom.js';
import { getSuggestedFilename } from '../../util/Attachment.std.js';
import { IMAGE_PNG, type MIMEType } from '../../types/MIME.std.js';

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
    (event: React.DragEvent<HTMLDivElement>) => {
      event.stopPropagation();
      event.preventDefault();

      if (!event.dataTransfer) {
        return;
      }

      if (event.dataTransfer.types[0] !== 'Files') {
        return;
      }

      const { files } = event.dataTransfer;
      processAttachments({
        conversationId,
        files: Array.from(files),
        flags: null,
      });
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
