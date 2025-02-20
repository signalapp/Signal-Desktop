// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';
import { useEscapeHandling } from '../../hooks/useEscapeHandling';

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
          const file = items[i].getAsFile();
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

      const firstAttachment = fileItems[0]?.getAsFile();
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
