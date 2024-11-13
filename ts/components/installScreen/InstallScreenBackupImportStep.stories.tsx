// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useCallback } from 'react';
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

export const NoBytes = Template.bind({});
NoBytes.args = {
  backupStep: InstallScreenBackupStep.Download,
  currentBytes: undefined,
  totalBytes: undefined,
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
  error: InstallScreenBackupError.Unknown,
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
