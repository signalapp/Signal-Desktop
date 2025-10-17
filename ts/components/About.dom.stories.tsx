// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import type { ComponentMeta } from '../storybook/types.std.js';
import type { AboutProps } from './About.dom.js';
import { About } from './About.dom.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/About',
  component: About,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    i18n,
    closeAbout: action('showWhatsNewModal'),
    appEnv: 'production',
    platform: 'darwin',
    arch: 'arm64',
    version: '1.2.3',
  },
} satisfies ComponentMeta<AboutProps>;

export function Basic(args: AboutProps): JSX.Element {
  return (
    <div style={{ height: '100vh' }}>
      <About {...args} />
    </div>
  );
}
