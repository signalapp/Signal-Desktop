// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { PropsType } from './DialogExpiredBuild.dom.tsx';
import { DialogExpiredBuild } from './DialogExpiredBuild.dom.tsx';
import { WidthBreakpoint } from './_util.std.ts';
import { FakeLeftPaneContainer } from '../test-helpers/FakeLeftPaneContainer.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/DialogExpiredBuild',
  argTypes: {},
  args: {},
} satisfies Meta<PropsType>;

export function Basic(): React.JSX.Element {
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
