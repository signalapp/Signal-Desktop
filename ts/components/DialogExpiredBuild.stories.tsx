// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { boolean } from '@storybook/addon-knobs';

import { DialogExpiredBuild } from './DialogExpiredBuild';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

storiesOf('Components/DialogExpiredBuild', module).add(
  'DialogExpiredBuild',
  () => {
    const hasExpired = boolean('hasExpired', true);

    return <DialogExpiredBuild hasExpired={hasExpired} i18n={i18n} />;
  }
);
