// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import { PlaintextExportWorkflow } from './PlaintextExportWorkflow.dom.js';
import {
  PlaintextExportErrors,
  PlaintextExportSteps,
} from '../types/Backups.std.js';

import type { PropsType } from './PlaintextExportWorkflow.dom.js';
import type { ComponentMeta } from '../storybook/types.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/PlaintextExportWorkflow',
  component: PlaintextExportWorkflow,
  args: {
    cancelWorkflow: action('cancelWorkflow'),
    clearWorkflow: action('clearWorkflow'),
    i18n,
    openFileInFolder: action('openFileInFolder'),
    osName: undefined,
    verifyWithOSForExport: action('verifyWithOSForExport'),
    workflow: {
      step: PlaintextExportSteps.ConfirmingExport,
    },
  },
} satisfies ComponentMeta<PropsType>;

export function ConfirmingExport(args: PropsType): JSX.Element {
  return <PlaintextExportWorkflow {...args} />;
}

export function ConfirmingWithOS(args: PropsType): JSX.Element {
  return (
    <PlaintextExportWorkflow
      {...args}
      workflow={{
        step: PlaintextExportSteps.ConfirmingWithOS,
        includeMedia: true,
      }}
    />
  );
}

export function ChoosingLocation(args: PropsType): JSX.Element {
  return (
    <PlaintextExportWorkflow
      {...args}
      workflow={{
        step: PlaintextExportSteps.ChoosingLocation,
        includeMedia: true,
      }}
    />
  );
}

export function ExportingMessages(args: PropsType): JSX.Element {
  return (
    <PlaintextExportWorkflow
      {...args}
      workflow={{
        step: PlaintextExportSteps.ExportingMessages,
        abortController: new AbortController(),
        exportInBackground: false,
        exportPath: '/somewhere',
      }}
    />
  );
}

export function ExportingAttachments(args: PropsType): JSX.Element {
  return (
    <PlaintextExportWorkflow
      {...args}
      workflow={{
        step: PlaintextExportSteps.ExportingAttachments,
        abortController: new AbortController(),
        exportInBackground: false,
        exportPath: '/somewhere',
        progress: {
          totalBytes: 1000000,
          currentBytes: 500000,
        },
      }}
    />
  );
}

export function CompleteMac(args: PropsType): JSX.Element {
  return (
    <PlaintextExportWorkflow
      {...args}
      osName="macos"
      workflow={{
        step: PlaintextExportSteps.Complete,
        exportPath: '/somewhere',
      }}
    />
  );
}

export function CompleteLinux(args: PropsType): JSX.Element {
  return (
    <PlaintextExportWorkflow
      {...args}
      osName="windows"
      workflow={{
        step: PlaintextExportSteps.Complete,
        exportPath: '/somewhere',
      }}
    />
  );
}

export function ErrorGeneric(args: PropsType): JSX.Element {
  return (
    <PlaintextExportWorkflow
      {...args}
      workflow={{
        step: PlaintextExportSteps.Error,
        errorDetails: {
          type: PlaintextExportErrors.General,
        },
      }}
    />
  );
}

export function ErrorNotEnoughStorage(args: PropsType): JSX.Element {
  return (
    <PlaintextExportWorkflow
      {...args}
      workflow={{
        step: PlaintextExportSteps.Error,
        errorDetails: {
          type: PlaintextExportErrors.NotEnoughStorage,
          bytesNeeded: 12000000,
        },
      }}
    />
  );
}

export function ErrorRanOutOfStorage(args: PropsType): JSX.Element {
  return (
    <PlaintextExportWorkflow
      {...args}
      workflow={{
        step: PlaintextExportSteps.Error,
        errorDetails: {
          type: PlaintextExportErrors.RanOutOfStorage,
          bytesNeeded: 12000000,
        },
      }}
    />
  );
}

export function ErrorStoragePermissions(args: PropsType): JSX.Element {
  return (
    <PlaintextExportWorkflow
      {...args}
      workflow={{
        step: PlaintextExportSteps.Error,
        errorDetails: {
          type: PlaintextExportErrors.StoragePermissions,
        },
      }}
    />
  );
}
