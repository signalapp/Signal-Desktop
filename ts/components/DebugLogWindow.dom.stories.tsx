// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';

import type { Meta } from '@storybook/react';
import type { PropsType } from './DebugLogWindow.dom.js';
import { DebugLogWindow } from './DebugLogWindow.dom.js';
import { sleep } from '../util/sleep.std.js';

const { i18n } = window.SignalContext;

const createProps = (): PropsType => ({
  closeWindow: action('closeWindow'),
  downloadLog: action('downloadLog'),
  i18n,
  fetchLogs: () => {
    action('fetchLogs')();
    return Promise.resolve('Sample logs');
  },
  uploadLogs: async (logs: string) => {
    action('uploadLogs')(logs);
    await sleep(5000);
    return 'https://picsum.photos/1800/900';
  },
});

export default {
  title: 'Components/DebugLogWindow',
} satisfies Meta<PropsType>;

export function Basic(): JSX.Element {
  return <DebugLogWindow {...createProps()} />;
}
