// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { Meta } from '@storybook/react';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import type { PropsType } from './InContactsIcon';
import { InContactsIcon } from './InContactsIcon';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/InContactsIcon',
} satisfies Meta<PropsType>;

export function Default(): JSX.Element {
  return <InContactsIcon i18n={i18n} />;
}
