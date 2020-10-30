// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';

import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
import { Props, TypingAnimation } from './TypingAnimation';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Conversation/TypingAnimation', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  color: overrideProps.color || '',
});

story.add('Default', () => {
  const props = createProps();

  return <TypingAnimation {...props} />;
});

story.add('Light', () => {
  const props = createProps({
    color: 'light',
  });

  return (
    <div style={{ padding: '2em', backgroundColor: 'grey' }}>
      <TypingAnimation {...props} />
    </div>
  );
});
