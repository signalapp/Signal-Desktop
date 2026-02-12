// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState } from 'react';
import type { ReactNode } from 'react';

import type { LocalizerType } from '../../../types/Util.std.js';
import { AxoContextMenu } from '../../../axo/AxoContextMenu.dom.js';
import { DeleteAttachmentConfirmationDialog } from '../../DeleteAttachmentConfirmationDialog.dom.js';

export type PropsType = Readonly<{
  i18n: LocalizerType;
  children: ReactNode;

  showMessage: () => void;

  removeAttachment?: () => void;
  saveAttachment?: () => void;
  forwardAttachment?: () => void;
  copyLink?: () => void;
  messageContact?: () => void;
}>;

export function MediaContextMenu(props: PropsType): React.JSX.Element {
  const {
    i18n,
    children,

    showMessage,
    saveAttachment,
    forwardAttachment,
    removeAttachment,
    copyLink,
    messageContact,
  } = props;

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const confirmDelete = useCallback(() => {
    setIsConfirmingDelete(true);
  }, []);

  return (
    <>
      {removeAttachment && (
        <DeleteAttachmentConfirmationDialog
          i18n={i18n}
          onDestroyAttachment={removeAttachment}
          open={isConfirmingDelete}
          onOpenChange={setIsConfirmingDelete}
        />
      )}
      <AxoContextMenu.Root>
        <AxoContextMenu.Trigger>{children}</AxoContextMenu.Trigger>
        <AxoContextMenu.Content>
          <AxoContextMenu.Item symbol="message-arrow" onSelect={showMessage}>
            {i18n('icu:MediaGallery__ContextMenu__ViewInChat')}
          </AxoContextMenu.Item>
          {forwardAttachment && (
            <AxoContextMenu.Item symbol="forward" onSelect={forwardAttachment}>
              {i18n('icu:MediaGallery__ContextMenu__Forward')}
            </AxoContextMenu.Item>
          )}
          {saveAttachment && (
            <AxoContextMenu.Item symbol="download" onSelect={saveAttachment}>
              {i18n('icu:MediaGallery__ContextMenu__Save')}
            </AxoContextMenu.Item>
          )}
          {messageContact && (
            <AxoContextMenu.Item symbol="message" onSelect={messageContact}>
              {i18n('icu:MediaGallery__ContextMenu__Send')}
            </AxoContextMenu.Item>
          )}
          {copyLink && (
            <AxoContextMenu.Item symbol="copy" onSelect={copyLink}>
              {i18n('icu:MediaGallery__ContextMenu__Copy')}
            </AxoContextMenu.Item>
          )}

          {removeAttachment && (
            <>
              <AxoContextMenu.Separator />

              <AxoContextMenu.Item symbol="trash" onSelect={confirmDelete}>
                {i18n('icu:MediaGallery__ContextMenu__Delete')}
              </AxoContextMenu.Item>
            </>
          )}
        </AxoContextMenu.Content>
      </AxoContextMenu.Root>
    </>
  );
}
