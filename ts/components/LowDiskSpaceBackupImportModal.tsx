// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import type { LocalizerType } from '../types/Util.std.js';
import { Modal } from './Modal.dom.js';
import { Button, ButtonVariant } from './Button.dom.js';
import { formatFileSize } from '../util/formatFileSize.std.js';

export type PropsType = Readonly<{
  bytesNeeded: number;
  i18n: LocalizerType;
  onClose: () => void;
}>;

export function LowDiskSpaceBackupImportModal(props: PropsType): JSX.Element {
  const { i18n, bytesNeeded, onClose } = props;

  return (
    <Modal
      modalName="LowDiskSpaceBackupImportModal"
      moduleClassName="LowDiskSpaceBackupImportModal"
      i18n={i18n}
      onClose={onClose}
    >
      <div className="LowDiskSpaceBackupImportModal__content">
        <div className="LowDiskSpaceBackupImportModal__icon" />

        <div className="LowDiskSpaceBackupImportModal__header">
          {i18n('icu:LowDiskSpaceBackupImportModal__title')}
        </div>

        <div className="LowDiskSpaceBackupImportModal__description">
          {i18n('icu:LowDiskSpaceBackupImportModal__description', {
            diskSpaceAmount: formatFileSize(bytesNeeded),
          })}
        </div>

        <div className="LowDiskSpaceBackupImportModal__button">
          <Button onClick={onClose} variant={ButtonVariant.Primary}>
            {i18n('icu:Confirmation--confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
