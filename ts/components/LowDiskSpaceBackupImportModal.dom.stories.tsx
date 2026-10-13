// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { LowDiskSpaceBackupImportModal } from './LowDiskSpaceBackupImportModal.dom.tsx';
import { MEBIBYTE } from '../types/AttachmentSize.std.ts';
import type { ReactNode } from 'react';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/LowDiskSpaceBackupImportModal',
} satisfies Meta;

export function Default(): ReactNode {
  return (
    <LowDiskSpaceBackupImportModal
      i18n={i18n}
      onClose={action('close')}
      bytesNeeded={1540 * MEBIBYTE}
    />
  );
}
