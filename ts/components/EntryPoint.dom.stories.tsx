// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useContext } from 'react';
import { action } from '@storybook/addon-actions';

import type { JSX } from 'react';
import type { Meta } from '@storybook/react';

import { setupI18n } from '../util/setupI18n.dom.tsx';
import messages from '../../_locales/en/messages.json';
import { StorybookThemeContext } from '../../.storybook/StorybookThemeContext.std.ts';

import { EntryPoint } from './EntryPoint.dom.tsx';

const i18n = setupI18n('en', messages);

export default {
  component: EntryPoint,
  title: 'Components/EntryPoint',
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    Story => {
      return (
        <div style={{ width: '100vw', height: '100vh' }}>
          <Story />
        </div>
      );
    },
  ],
} satisfies Meta<typeof EntryPoint>;

export function Default(): JSX.Element {
  const theme = useContext(StorybookThemeContext);
  return (
    <EntryPoint
      i18n={i18n}
      theme={theme}
      startStandaloneRegistration={action('startStandaloneRegistration')}
      startLinkProcess={action('startLinkProcess')}
    />
  );
}
