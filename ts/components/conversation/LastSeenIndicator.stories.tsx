// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { number } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import type { Props } from './LastSeenIndicator';
import { LastSeenIndicator } from './LastSeenIndicator';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Conversation/LastSeenIndicator', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  count: number('count', overrideProps.count || 1),
  i18n,
});

story.add('One', () => {
  const props = createProps();
  return <LastSeenIndicator {...props} />;
});

story.add('More than One', () => {
  const props = createProps({
    count: 5,
  });

  return <LastSeenIndicator {...props} />;
});
