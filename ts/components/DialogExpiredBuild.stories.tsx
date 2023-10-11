// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import type { PropsType } from './DialogExpiredBuild';
import { DialogExpiredBuild } from './DialogExpiredBuild';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { WidthBreakpoint } from './_util';
import { FakeLeftPaneContainer } from '../test-both/helpers/FakeLeftPaneContainer';

const i18n = setupI18n('en', enMessages);

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
