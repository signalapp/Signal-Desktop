// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';
import type { Meta } from '@storybook/react';
import type { PropsType } from './DialogExpiredBuild.dom.tsx';
import { DialogClockSkew } from './DialogClockSkew.dom.tsx';
import { WidthBreakpoint } from './_util.std.ts';
import { FakeLeftPaneContainer } from '../test-helpers/FakeLeftPaneContainer.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/DialogClockSkew',
} satisfies Meta<PropsType>;

export function Default(): JSX.Element {
  const containerWidthBreakpoint = WidthBreakpoint.Wide;

  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={containerWidthBreakpoint}>
      <DialogClockSkew
        containerWidthBreakpoint={containerWidthBreakpoint}
        i18n={i18n}
      />
    </FakeLeftPaneContainer>
  );
}
