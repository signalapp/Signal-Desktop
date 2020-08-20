import * as React from 'react';

import { storiesOf } from '@storybook/react';
import { Props, StartNewConversation } from './StartNewConversation';

// @ts-ignore
import { setup as setupI18n } from '../../js/modules/i18n';

// @ts-ignore
import enMessages from '../../_locales/en/messages.json';
import { action } from '@storybook/addon-actions';
import { text } from '@storybook/addon-knobs';

const i18n = setupI18n('en', enMessages);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  onClick: action('onClick'),
  phoneNumber: text('phoneNumber', overrideProps.phoneNumber || ''),
});

const stories = storiesOf('Components/StartNewConversation', module);

stories.add('Full Phone Number', () => {
  const props = createProps({
    phoneNumber: '(202) 555-0011',
  });

  return <StartNewConversation {...props} />;
});

stories.add('Partial Phone Number', () => {
  const props = createProps({
    phoneNumber: '202',
  });

  return <StartNewConversation {...props} />;
});
