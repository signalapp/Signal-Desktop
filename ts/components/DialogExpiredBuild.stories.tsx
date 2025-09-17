// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { PropsType } from './DialogExpiredBuild.js';
import { DialogExpiredBuild } from './DialogExpiredBuild.js';
import { WidthBreakpoint } from './_util.js';
import { FakeLeftPaneContainer } from '../test-helpers/FakeLeftPaneContainer.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/DialogExpiredBuild',
  argTypes: {},
  args: {},
} satisfies Meta<PropsType>;

export function Basic(): JSX.Element {
  const containerWidthBreakpoint = WidthBreakpoint.Wide;

  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={containerWidthBreakpoint}>
      <DialogExpiredBuild
        containerWidthBreakpoint={containerWidthBreakpoint}
        i18n={i18n}
      />
    </FakeLeftPaneContainer>
  );
}
