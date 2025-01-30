// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useCallback, useEffect } from 'react';
import type { Meta, StoryFn } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { setupI18n } from '../../util/setupI18n';
import { sleep } from '../../util/sleep';
import {
  InstallScreenBackupStep,
  InstallScreenBackupError,
} from '../../types/InstallScreen';
import { DialogType } from '../../types/Dialogs';
import enMessages from '../../../_locales/en/messages.json';
import type { PropsType } from './InstallScreenBackupImportStep';
import { InstallScreenBackupImportStep } from './InstallScreenBackupImportStep';

const i18n = setupI18n('en', enMessages);

const DEFAULT_UPDATES = {
  dialogType: DialogType.None,
  didSnooze: false,
  isCheckingForUpdates: false,
  showEventsCount: 0,
  downloadSize: 42 * 1024 * 1024,
};

export default {
  title: 'Components/InstallScreenBackupImportStep',
} satisfies Meta<PropsType>;

// eslint-disable-next-line react/function-component-definition
const Template: StoryFn<PropsType> = (args: PropsType) => {
  const [updates, setUpdates] = useState(DEFAULT_UPDATES);
  const forceUpdate = useCallback(async () => {
    setUpdates(state => ({
      ...state,
      isCheckingForUpdates: true,
    }));
    await sleep(500);
    setUpdates(state => ({
      ...state,
      isCheckingForUpdates: false,
      dialogType: DialogType.Downloading,
      downloadSize: 100,
      downloadedSize: 0,
      version: 'v7.7.7',
    }));
    await sleep(500);
    setUpdates(state => ({
      ...state,
      downloadedSize: 50,
    }));
    await sleep(500);
    setUpdates(state => ({
      ...state,
      downloadedSize: 100,
    }));
  }, [setUpdates]);

  return (
    <InstallScreenBackupImportStep
      {...args}
      i18n={i18n}
      updates={updates}
      currentVersion="v6.0.0"
      OS="macOS"
      startUpdate={action('startUpdate')}
      forceUpdate={forceUpdate}
      onCancel={action('onCancel')}
      onRetry={action('onRetry')}
    />
  );
};

export function FullFlow(): JSX.Element {
  const [backupStep, setBackupStep] = useState<InstallScreenBackupStep>(
    InstallScreenBackupStep.WaitForBackup
  );
  const [currentBytes, setCurrentBytes] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const TOTAL_BYTES = 1024 * 1024;

  useEffect(() => {
    setTimeout(() => {
      setBackupStep(InstallScreenBackupStep.Download);
      setCurrentBytes(0);
      setTotalBytes(TOTAL_BYTES);
      for (let i = 0; i < 4; i += 1) {
        setTimeout(() => {
          setCurrentBytes(TOTAL_BYTES / (4 - i));
        }, i * 900);
      }
    }, 1000);
  }, [TOTAL_BYTES]);

  return (
    <InstallScreenBackupImportStep
      i18n={i18n}
      updates={DEFAULT_UPDATES}
      currentVersion="v6.0.0"
      OS="macOS"
      startUpdate={action('startUpdate')}
      forceUpdate={action('forceUpdate')}
      onCancel={action('onCancel')}
      onRetry={action('onRetry')}
      currentBytes={currentBytes}
      totalBytes={totalBytes}
      backupStep={backupStep}
      onRestartLink={action('onRestartLink')}
    />
  );
}

export const Waiting = Template.bind({});
Waiting.args = {
  backupStep: InstallScreenBackupStep.WaitForBackup,
};

export const Bytes = Template.bind({});
Bytes.args = {
  backupStep: InstallScreenBackupStep.Download,
  currentBytes: 500 * 1024,
  totalBytes: 1024 * 1024,
};

export const Full = Template.bind({});
Full.args = {
  backupStep: InstallScreenBackupStep.Download,
  currentBytes: 1024,
  totalBytes: 1024,
};

export const Error = Template.bind({});
Error.args = {
  backupStep: InstallScreenBackupStep.Download,
  currentBytes: 500 * 1024,
  totalBytes: 1024 * 1024,
  error: InstallScreenBackupError.Retriable,
};

export const FatalError = Template.bind({});
FatalError.args = {
  backupStep: InstallScreenBackupStep.Process,
  currentBytes: 500 * 1024,
  totalBytes: 1024 * 1024,
  error: InstallScreenBackupError.Fatal,
};

export const Canceled = Template.bind({});
Canceled.args = {
  backupStep: InstallScreenBackupStep.Process,
  currentBytes: 500 * 1024,
  totalBytes: 1024 * 1024,
  error: InstallScreenBackupError.Canceled,
};

export const UnsupportedVersion = Template.bind({});
UnsupportedVersion.args = {
  backupStep: InstallScreenBackupStep.Process,
  currentBytes: 1,
  totalBytes: 1024 * 1024,
  error: InstallScreenBackupError.UnsupportedVersion,
};

export const Processing = Template.bind({});
Processing.args = {
  backupStep: InstallScreenBackupStep.Process,
  currentBytes: 500 * 1024,
  totalBytes: 1024 * 1024,
};
