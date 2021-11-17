// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import { storiesOf } from '@storybook/react';

import { SafetyNumberChangeDialog } from './SafetyNumberChangeDialog';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { StorybookThemeContext } from '../../.storybook/StorybookThemeContext';
import { getFakeBadge } from '../test-both/helpers/getFakeBadge';

const i18n = setupI18n('en', enMessages);

const contactWithAllData = getDefaultConversation({
  id: 'abc',
  avatarPath: undefined,
  profileName: '-*Smartest Dude*-',
  title: 'Rick Sanchez',
  name: 'Rick Sanchez',
  phoneNumber: '(305) 123-4567',
});

const contactWithJustProfile = getDefaultConversation({
  id: 'def',
  avatarPath: undefined,
  title: '-*Smartest Dude*-',
  profileName: '-*Smartest Dude*-',
  name: undefined,
  phoneNumber: '(305) 123-4567',
});

const contactWithJustNumber = getDefaultConversation({
  id: 'xyz',
  avatarPath: undefined,
  profileName: undefined,
  name: undefined,
  title: '(305) 123-4567',
  phoneNumber: '(305) 123-4567',
});

const contactWithNothing = getDefaultConversation({
  id: 'some-guid',
  avatarPath: undefined,
  profileName: undefined,
  name: undefined,
  phoneNumber: undefined,
  title: 'Unknown contact',
});

const useTheme = () => React.useContext(StorybookThemeContext);

storiesOf('Components/SafetyNumberChangeDialog', module)
  .add('Single Contact Dialog', () => {
    const theme = useTheme();
    return (
      <SafetyNumberChangeDialog
        contacts={[contactWithAllData]}
        getPreferredBadge={() => undefined}
        i18n={i18n}
        onCancel={action('cancel')}
        onConfirm={action('confirm')}
        renderSafetyNumber={() => {
          action('renderSafetyNumber');
          return <div>This is a mock Safety Number View</div>;
        }}
        theme={theme}
      />
    );
  })
  .add('Different Confirmation Text', () => {
    const theme = useTheme();
    return (
      <SafetyNumberChangeDialog
        confirmText="You are awesome"
        contacts={[contactWithAllData]}
        getPreferredBadge={() => undefined}
        i18n={i18n}
        onCancel={action('cancel')}
        onConfirm={action('confirm')}
        renderSafetyNumber={() => {
          action('renderSafetyNumber');
          return <div>This is a mock Safety Number View</div>;
        }}
        theme={theme}
      />
    );
  })
  .add('Multi Contact Dialog', () => {
    const theme = useTheme();
    return (
      <SafetyNumberChangeDialog
        contacts={[
          contactWithAllData,
          contactWithJustProfile,
          contactWithJustNumber,
          contactWithNothing,
        ]}
        getPreferredBadge={() => undefined}
        i18n={i18n}
        onCancel={action('cancel')}
        onConfirm={action('confirm')}
        renderSafetyNumber={() => {
          action('renderSafetyNumber');
          return <div>This is a mock Safety Number View</div>;
        }}
        theme={theme}
      />
    );
  })
  .add('Multiple contacts, all with badges', () => {
    const theme = useTheme();
    return (
      <SafetyNumberChangeDialog
        contacts={[
          contactWithAllData,
          contactWithJustProfile,
          contactWithJustNumber,
          contactWithNothing,
        ]}
        getPreferredBadge={() => getFakeBadge()}
        i18n={i18n}
        onCancel={action('cancel')}
        onConfirm={action('confirm')}
        renderSafetyNumber={() => {
          action('renderSafetyNumber');
          return <div>This is a mock Safety Number View</div>;
        }}
        theme={theme}
      />
    );
  })
  .add('Scroll Dialog', () => {
    const theme = useTheme();
    return (
      <SafetyNumberChangeDialog
        contacts={[
          contactWithAllData,
          contactWithJustProfile,
          contactWithJustNumber,
          contactWithNothing,
          contactWithAllData,
          contactWithAllData,
          contactWithAllData,
          contactWithAllData,
          contactWithAllData,
          contactWithAllData,
        ]}
        getPreferredBadge={() => undefined}
        i18n={i18n}
        onCancel={action('cancel')}
        onConfirm={action('confirm')}
        renderSafetyNumber={() => {
          action('renderSafetyNumber');
          return <div>This is a mock Safety Number View</div>;
        }}
        theme={theme}
      />
    );
  });
