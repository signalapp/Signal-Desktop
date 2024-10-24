// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { type ComponentProps } from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { BackupMediaDownloadProgress } from './BackupMediaDownloadProgress';
import { KIBIBYTE } from '../types/AttachmentSize';

const i18n = setupI18n('en', enMessages);

type PropsType = ComponentProps<typeof BackupMediaDownloadProgress>;

export default {
  title: 'Components/BackupMediaDownloadProgress',
  args: {
    isPaused: false,
    downloadedBytes: 600 * KIBIBYTE,
    totalBytes: 1000 * KIBIBYTE,
    handleClose: action('handleClose'),
    handlePause: action('handlePause'),
    handleResume: action('handleResume'),
    handleCancel: action('handleCancel'),
    i18n,
  },
} satisfies Meta<PropsType>;

export function InProgress(args: PropsType): JSX.Element {
  return <BackupMediaDownloadProgress {...args} />;
}

export function Increasing(args: PropsType): JSX.Element {
  return (
    <BackupMediaDownloadProgress
      {...args}
      {...useIncreasingFractionComplete()}
    />
  );
}

export function Paused(args: PropsType): JSX.Element {
  return <BackupMediaDownloadProgress {...args} isPaused />;
}

export function Idle(args: PropsType): JSX.Element {
  return <BackupMediaDownloadProgress {...args} isIdle />;
}

export function PausedAndIdle(args: PropsType): JSX.Element {
  return <BackupMediaDownloadProgress {...args} isPaused isIdle />;
}

export function Complete(args: PropsType): JSX.Element {
  return (
    <BackupMediaDownloadProgress {...args} downloadedBytes={args.totalBytes} />
  );
}

function useIncreasingFractionComplete() {
  const [fractionComplete, setFractionComplete] = React.useState(0);
  React.useEffect(() => {
    if (fractionComplete >= 1) {
      return;
    }
    const timeout = setTimeout(() => {
      setFractionComplete(cur => Math.min(1, cur + 0.1));
    }, 300);
    return () => clearTimeout(timeout);
  }, [fractionComplete]);
  return { downloadedBytes: 1e10 * fractionComplete, totalBytes: 1e10 };
}
