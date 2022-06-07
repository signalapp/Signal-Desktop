// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { boolean, select } from '@storybook/addon-knobs';

import { DialogExpiredBuild } from './DialogExpiredBuild';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { WidthBreakpoint } from './_util';
import { FakeLeftPaneContainer } from '../test-both/helpers/FakeLeftPaneContainer';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/DialogExpiredBuild',
};

export const _DialogExpiredBuild = (): JSX.Element => {
  const containerWidthBreakpoint = select(
    'containerWidthBreakpoint',
    WidthBreakpoint,
    WidthBreakpoint.Wide
  );
  const hasExpired = boolean('hasExpired', true);

  return (
    <FakeLeftPaneContainer containerWidthBreakpoint={containerWidthBreakpoint}>
      <DialogExpiredBuild
        containerWidthBreakpoint={containerWidthBreakpoint}
        hasExpired={hasExpired}
        i18n={i18n}
      />
    </FakeLeftPaneContainer>
  );
};

_DialogExpiredBuild.story = {
  name: 'DialogExpiredBuild',
};
