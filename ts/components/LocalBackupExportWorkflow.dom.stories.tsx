// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import { LocalBackupExportWorkflow } from './LocalBackupExportWorkflow.dom.js';
import {
  LocalExportErrors,
  LocalBackupExportSteps,
} from '../types/LocalExport.std.js';

import type { PropsType } from './LocalBackupExportWorkflow.dom.js';
import type { ComponentMeta } from '../storybook/types.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/LocalBackupExportWorkflow',
  component: LocalBackupExportWorkflow,
  args: {
    cancelWorkflow: action('cancelWorkflow'),
    clearWorkflow: action('clearWorkflow'),
    i18n,
    openFileInFolder: action('openFileInFolder'),
    osName: undefined,
    workflow: {
      step: LocalBackupExportSteps.ExportingMessages,
      localBackupFolder: 'backups',
      abortController: new AbortController(),
    },
  },
} satisfies ComponentMeta<PropsType>;

export function ExportingMessages(args: PropsType): React.JSX.Element {
  return (
    <LocalBackupExportWorkflow
      {...args}
      workflow={{
        step: LocalBackupExportSteps.ExportingMessages,
        abortController: new AbortController(),
        localBackupFolder: '/somewhere',
      }}
    />
  );
}

export function ExportingAttachments(args: PropsType): React.JSX.Element {
  return (
    <LocalBackupExportWorkflow
      {...args}
      workflow={{
        step: LocalBackupExportSteps.ExportingAttachments,
        abortController: new AbortController(),
        localBackupFolder: '/somewhere',
        progress: {
          totalBytes: 1000000,
          currentBytes: 500000,
        },
      }}
    />
  );
}

export function CompleteMac(args: PropsType): React.JSX.Element {
  return (
    <LocalBackupExportWorkflow
      {...args}
      osName="macos"
      workflow={{
        step: LocalBackupExportSteps.Complete,
        localBackupFolder: '/somewhere',
      }}
    />
  );
}

export function CompleteLinux(args: PropsType): React.JSX.Element {
  return (
    <LocalBackupExportWorkflow
      {...args}
      osName="windows"
      workflow={{
        step: LocalBackupExportSteps.Complete,
        localBackupFolder: '/somewhere',
      }}
    />
  );
}

export function ErrorGeneric(args: PropsType): React.JSX.Element {
  return (
    <LocalBackupExportWorkflow
      {...args}
      workflow={{
        step: LocalBackupExportSteps.Error,
        errorDetails: {
          type: LocalExportErrors.General,
        },
      }}
    />
  );
}

export function ErrorNotEnoughStorage(args: PropsType): React.JSX.Element {
  return (
    <LocalBackupExportWorkflow
      {...args}
      workflow={{
        step: LocalBackupExportSteps.Error,
        errorDetails: {
          type: LocalExportErrors.NotEnoughStorage,
          bytesNeeded: 12000000,
        },
      }}
    />
  );
}

export function ErrorRanOutOfStorage(args: PropsType): React.JSX.Element {
  return (
    <LocalBackupExportWorkflow
      {...args}
      workflow={{
        step: LocalBackupExportSteps.Error,
        errorDetails: {
          type: LocalExportErrors.RanOutOfStorage,
          bytesNeeded: 12000000,
        },
      }}
    />
  );
}

export function ErrorStoragePermissions(args: PropsType): React.JSX.Element {
  return (
    <LocalBackupExportWorkflow
      {...args}
      workflow={{
        step: LocalBackupExportSteps.Error,
        errorDetails: {
          type: LocalExportErrors.StoragePermissions,
        },
      }}
    />
  );
}
