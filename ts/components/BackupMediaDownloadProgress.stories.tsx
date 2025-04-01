// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { type ComponentProps } from 'react';
import type { Meta } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { BackupMediaDownloadProgress } from './BackupMediaDownloadProgress';
import { KIBIBYTE } from '../types/AttachmentSize';
import { WidthBreakpoint } from './_util';

const { i18n } = window.SignalContext;

type PropsType = ComponentProps<typeof BackupMediaDownloadProgress>;

function Template(args: PropsType): JSX.Element {
  return (
    <>
      <div style={{ width: 350 }}>
        <p>Wide</p>
        <BackupMediaDownloadProgress
          {...args}
          widthBreakpoint={WidthBreakpoint.Wide}
        />
      </div>
      <div style={{ width: 280 }}>
        <p>Medium</p>
        <BackupMediaDownloadProgress
          {...args}
          widthBreakpoint={WidthBreakpoint.Medium}
        />
      </div>
      <div style={{ width: 130 }}>
        <p>Narrow</p>
        <BackupMediaDownloadProgress
          {...args}
          widthBreakpoint={WidthBreakpoint.Narrow}
        />
      </div>
    </>
  );
}

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
  return <Template {...args} />;
}

export function Increasing(args: PropsType): JSX.Element {
  return <Template {...args} {...useIncreasingFractionComplete()} />;
}

export function Paused(args: PropsType): JSX.Element {
  return <Template {...args} isPaused />;
}

export function Idle(args: PropsType): JSX.Element {
  return <Template {...args} isIdle />;
}

export function PausedAndIdle(args: PropsType): JSX.Element {
  return <Template {...args} isPaused isIdle />;
}

export function Complete(args: PropsType): JSX.Element {
  return <Template {...args} downloadedBytes={args.totalBytes} />;
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
