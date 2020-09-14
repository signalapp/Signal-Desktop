import * as React from 'react';

import { storiesOf } from '@storybook/react';

import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
import { ProfileChangeNotification } from './ProfileChangeNotification';

const i18n = setupI18n('en', enMessages);

storiesOf('Components/Conversation/ProfileChangeNotification', module)
  .add('From contact', () => {
    return (
      <ProfileChangeNotification
        i18n={i18n}
        changedContact={{
          id: 'some-guid',
          type: 'direct',
          title: 'Mr. Fire 🔥',
          name: 'Mr. Fire 🔥',
          lastUpdated: Date.now(),
        }}
        change={{
          type: 'name',
          oldName: 'Mr. Fire 🔥 Old',
          newName: 'Mr. Fire 🔥 New',
        }}
      />
    );
  })
  .add('From non-contact', () => {
    return (
      <ProfileChangeNotification
        i18n={i18n}
        changedContact={{
          id: 'some-guid',
          type: 'direct',
          title: 'Mr. Fire 🔥',
          lastUpdated: Date.now(),
        }}
        change={{
          type: 'name',
          oldName: 'Mr. Fire 🔥 Old',
          newName: 'Mr. Fire 🔥 New',
        }}
      />
    );
  });
