// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import type { LocalizerType } from '../types/Util';
import { Modal } from './Modal';
import { Button, ButtonVariant } from './Button';

export type PropsType = {
  i18n: LocalizerType;
  modalType: AttachmentNotAvailableModalType;
  onClose: () => void;
};

export enum AttachmentNotAvailableModalType {
  File = 'File',
  LongText = 'LongText',
  Sticker = 'Sticker',
  VisualMedia = 'VisualMedia',
  VoiceMessage = 'VoiceMessage',
}

function focusRef(el: HTMLElement | null) {
  if (el) {
    el.focus();
  }
}

function getTitle(
  i18n: LocalizerType,
  modalType: AttachmentNotAvailableModalType
): string {
  switch (modalType) {
    case AttachmentNotAvailableModalType.LongText:
      return i18n('icu:AttachmentNotAvailableModal__title--long-text');
    case AttachmentNotAvailableModalType.Sticker:
      return i18n('icu:AttachmentNotAvailableModal__title--sticker');
    case AttachmentNotAvailableModalType.VisualMedia:
      return i18n('icu:AttachmentNotAvailableModal__title--media');
    case AttachmentNotAvailableModalType.VoiceMessage:
      return i18n('icu:AttachmentNotAvailableModal__title--voice-message');
    case AttachmentNotAvailableModalType.File:
    default:
      return i18n('icu:AttachmentNotAvailableModal__title--file');
  }
}

function getBody(
  i18n: LocalizerType,
  modalType: AttachmentNotAvailableModalType
): string {
  switch (modalType) {
    case AttachmentNotAvailableModalType.LongText:
      return i18n('icu:AttachmentNotAvailableModal__body--long-text');
    case AttachmentNotAvailableModalType.Sticker:
      return i18n('icu:AttachmentNotAvailableModal__body--sticker');
    case AttachmentNotAvailableModalType.VisualMedia:
      return i18n('icu:AttachmentNotAvailableModal__body--media');
    case AttachmentNotAvailableModalType.VoiceMessage:
      return i18n('icu:AttachmentNotAvailableModal__body--voice-message');
    case AttachmentNotAvailableModalType.File:
    default:
      return i18n('icu:AttachmentNotAvailableModal__body--file');
  }
}

export function AttachmentNotAvailableModal(props: PropsType): JSX.Element {
  const { i18n, modalType, onClose } = props;

  const footer = (
    <Button onClick={onClose} ref={focusRef} variant={ButtonVariant.Primary}>
      {i18n('icu:Confirmation--confirm')}
    </Button>
  );

  return (
    <Modal
      modalName="AttachmentNotAvailableModal"
      moduleClassName="AttachmentNotAvailableModal"
      i18n={i18n}
      onClose={onClose}
      title={getTitle(i18n, modalType)}
      modalFooter={footer}
      padded={false}
    >
      <div className="module-error-modal__description">
        {getBody(i18n, modalType)}
      </div>
    </Modal>
  );
}
