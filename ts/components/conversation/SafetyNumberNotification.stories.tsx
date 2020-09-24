import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { boolean, text } from '@storybook/addon-knobs';

import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
import {
  ContactType,
  Props,
  SafetyNumberNotification,
} from './SafetyNumberNotification';

const i18n = setupI18n('en', enMessages);

const createContact = (props: Partial<ContactType>): ContactType => ({
  id: '',
  title: text('contact title', props.title || ''),
});

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  contact: overrideProps.contact || ({} as ContactType),
  isGroup: boolean('isGroup', overrideProps.isGroup || false),
  showIdentity: action('showIdentity'),
});

const stories = storiesOf(
  'Components/Conversation/SafetyNumberNotification',
  module
);

stories.add('Group Conversation', () => {
  const props = createProps({
    isGroup: true,
    contact: createContact({
      title: 'Mr. Fire',
    }),
  });

  return <SafetyNumberNotification {...props} />;
});

stories.add('Direct Conversation', () => {
  const props = createProps({
    isGroup: false,
    contact: createContact({
      title: 'Mr. Fire',
    }),
  });

  return <SafetyNumberNotification {...props} />;
});
