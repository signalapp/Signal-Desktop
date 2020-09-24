import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { boolean, select, text } from '@storybook/addon-knobs';

import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
import { Props, TimerNotification } from './TimerNotification';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Conversation/TimerNotification', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  i18n,
  type: select(
    'type',
    {
      fromOther: 'fromOther',
      fromMe: 'fromMe',
      fromSync: 'fromSync',
    },
    overrideProps.type || 'fromOther'
  ),
  phoneNumber:
    text('phoneNumber', overrideProps.phoneNumber || '') || undefined,
  profileName:
    text('profileName', overrideProps.profileName || '') || undefined,
  title: text('title', overrideProps.title || ''),
  name: text('name', overrideProps.name || '') || undefined,
  disabled: boolean('disabled', overrideProps.disabled || false),
  timespan: text('timespan', overrideProps.timespan || ''),
});

story.add('Set By Other', () => {
  const props = createProps({
    type: 'fromOther',
    phoneNumber: '(202) 555-1000',
    profileName: 'Mr. Fire',
    title: 'Mr. Fire',
    timespan: '1 hour',
  });

  return (
    <>
      <TimerNotification {...props} />
      <div style={{ padding: '1em' }} />
      <TimerNotification {...props} disabled timespan="Off" />
    </>
  );
});

story.add('Set By You', () => {
  const props = createProps({
    type: 'fromMe',
    phoneNumber: '(202) 555-1000',
    profileName: 'Mr. Fire',
    title: 'Mr. Fire',
    timespan: '1 hour',
  });

  return (
    <>
      <TimerNotification {...props} />
      <div style={{ padding: '1em' }} />
      <TimerNotification {...props} disabled timespan="Off" />
    </>
  );
});

story.add('Set By Sync', () => {
  const props = createProps({
    type: 'fromSync',
    phoneNumber: '(202) 555-1000',
    profileName: 'Mr. Fire',
    title: 'Mr. Fire',
    timespan: '1 hour',
  });

  return (
    <>
      <TimerNotification {...props} />
      <div style={{ padding: '1em' }} />
      <TimerNotification {...props} disabled timespan="Off" />
    </>
  );
});
