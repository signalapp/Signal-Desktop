// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/I18N';
import { Button, ButtonVariant } from './Button';
import { Modal } from './Modal';
import { Linkify } from './conversation/Linkify';
import type { RenderTextCallbackType } from '../types/Util';
import { Emojify } from './conversation/Emojify';

export type NotePreviewModalProps = Readonly<{
  conversation: ConversationType;
  i18n: LocalizerType;
  onClose: () => void;
  onEdit: () => void;
}>;

const renderNonLink: RenderTextCallbackType = ({ key, text }) => {
  return <Emojify key={key} text={text} />;
};

export function NotePreviewModal({
  conversation,
  i18n,
  onClose,
  onEdit,
}: NotePreviewModalProps): JSX.Element {
  return (
    <Modal
      modalName="NotePreviewModal"
      i18n={i18n}
      title={i18n('icu:NotePreviewModal__Title')}
      onClose={onClose}
      hasXButton
      modalFooter={
        <>
          <Button onClick={onEdit} variant={ButtonVariant.Secondary}>
            {i18n('icu:edit')}
          </Button>
          <Button onClick={onClose} variant={ButtonVariant.Primary}>
            {i18n('icu:done')}
          </Button>
        </>
      }
    >
      <div dir="auto">
        <Linkify text={conversation.note ?? ''} renderNonLink={renderNonLink} />
      </div>
    </Modal>
  );
}
