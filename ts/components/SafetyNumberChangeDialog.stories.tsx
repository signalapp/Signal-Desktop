import * as React from 'react';
import { SafetyNumberChangeDialog } from './SafetyNumberChangeDialog';
import { ConversationType } from '../state/ducks/conversations';

// @ts-ignore
import { setup as setupI18n } from '../../js/modules/i18n';
// @ts-ignore
import enMessages from '../../_locales/en/messages.json';

import { action } from '@storybook/addon-actions';
import { storiesOf } from '@storybook/react';

const i18n = setupI18n('en', enMessages);

const contact = {
  avatarPath: undefined,
  color: 'signal-blue',
  profileName: undefined,
  name: 'Rick Sanchez',
  phoneNumber: '3051234567',
} as ConversationType;

storiesOf('Components/SafetyNumberChangeDialog', module)
  .add('Single Contact Dialog', () => {
    return (
      <SafetyNumberChangeDialog
        contacts={[contact]}
        i18n={i18n}
        onCancel={action('cancel')}
        onConfirm={action('confirm')}
        renderSafetyNumber={() => {
          action('renderSafetyNumber');
          return <div>This is a mock Safety Number View</div>;
        }}
      />
    );
  })
  .add('Multi Contact Dialog', () => {
    return (
      <SafetyNumberChangeDialog
        contacts={[contact, contact, contact, contact]}
        i18n={i18n}
        onCancel={action('cancel')}
        onConfirm={action('confirm')}
        renderSafetyNumber={() => {
          action('renderSafetyNumber');
          return <div>This is a mock Safety Number View</div>;
        }}
      />
    );
  })
  .add('Scroll Dialog', () => {
    return (
      <SafetyNumberChangeDialog
        contacts={[
          contact,
          contact,
          contact,
          contact,
          contact,
          contact,
          contact,
          contact,
          contact,
          contact,
        ]}
        i18n={i18n}
        onCancel={action('cancel')}
        onConfirm={action('confirm')}
        renderSafetyNumber={() => {
          action('renderSafetyNumber');
          return <div>This is a mock Safety Number View</div>;
        }}
      />
    );
  });
