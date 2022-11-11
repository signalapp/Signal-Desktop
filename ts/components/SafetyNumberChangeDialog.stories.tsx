// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';

import { SafetyNumberChangeDialog } from './SafetyNumberChangeDialog';
import { getDefaultConversation } from '../test-both/helpers/getDefaultConversation';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';
import { StorybookThemeContext } from '../../.storybook/StorybookThemeContext';
import { getFakeBadge } from '../test-both/helpers/getFakeBadge';
import { MY_STORY_ID } from '../types/Stories';

const i18n = setupI18n('en', enMessages);

const contactWithAllData = getDefaultConversation({
  id: 'abc',
  avatarPath: undefined,
  profileName: '-*Smartest Dude*-',
  title: 'Rick Sanchez',
  name: 'Rick Sanchez',
  phoneNumber: '(305) 123-4567',
});

const contactWithJustProfileVerified = getDefaultConversation({
  id: 'def',
  avatarPath: undefined,
  title: '-*Smartest Dude*-',
  profileName: '-*Smartest Dude*-',
  name: undefined,
  phoneNumber: '(305) 123-4567',
  isVerified: true,
});

const contactWithJustNumberVerified = getDefaultConversation({
  id: 'xyz',
  avatarPath: undefined,
  profileName: undefined,
  name: undefined,
  title: '(305) 123-4567',
  phoneNumber: '(305) 123-4567',
  isVerified: true,
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

export default {
  title: 'Components/SafetyNumberChangeDialog',
};

export const SingleContactDialog = (): JSX.Element => {
  const theme = useTheme();
  return (
    <SafetyNumberChangeDialog
      contacts={[
        {
          story: undefined,
          contacts: [contactWithAllData],
        },
      ]}
      getPreferredBadge={() => undefined}
      i18n={i18n}
      onCancel={action('cancel')}
      onConfirm={action('confirm')}
      removeFromStory={action('removeFromStory')}
      renderSafetyNumber={() => {
        action('renderSafetyNumber');
        return <div>This is a mock Safety Number View</div>;
      }}
      theme={theme}
    />
  );
};

export const DifferentConfirmationText = (): JSX.Element => {
  const theme = useTheme();
  return (
    <SafetyNumberChangeDialog
      confirmText="You are awesome"
      contacts={[
        {
          story: undefined,
          contacts: [contactWithAllData],
        },
      ]}
      getPreferredBadge={() => undefined}
      i18n={i18n}
      onCancel={action('cancel')}
      onConfirm={action('confirm')}
      removeFromStory={action('removeFromStory')}
      renderSafetyNumber={() => {
        action('renderSafetyNumber');
        return <div>This is a mock Safety Number View</div>;
      }}
      theme={theme}
    />
  );
};

export const MultiContactDialog = (): JSX.Element => {
  const theme = useTheme();
  return (
    <SafetyNumberChangeDialog
      contacts={[
        {
          story: undefined,
          contacts: [contactWithAllData, contactWithJustProfileVerified],
        },
        {
          story: undefined,
          contacts: [contactWithJustNumberVerified, contactWithNothing],
        },
      ]}
      getPreferredBadge={() => undefined}
      i18n={i18n}
      onCancel={action('cancel')}
      onConfirm={action('confirm')}
      removeFromStory={action('removeFromStory')}
      renderSafetyNumber={() => {
        action('renderSafetyNumber');
        return <div>This is a mock Safety Number View</div>;
      }}
      theme={theme}
    />
  );
};

export const AllVerified = (): JSX.Element => {
  const theme = useTheme();
  return (
    <SafetyNumberChangeDialog
      contacts={[
        {
          story: undefined,
          contacts: [
            contactWithJustProfileVerified,
            contactWithJustNumberVerified,
          ],
        },
      ]}
      getPreferredBadge={() => undefined}
      i18n={i18n}
      onCancel={action('cancel')}
      onConfirm={action('confirm')}
      removeFromStory={action('removeFromStory')}
      renderSafetyNumber={() => {
        action('renderSafetyNumber');
        return <div>This is a mock Safety Number View</div>;
      }}
      theme={theme}
    />
  );
};
AllVerified.story = {
  name: 'All verified; Send button instead',
};

export const MultipleContactsAllWithBadges = (): JSX.Element => {
  const theme = useTheme();
  return (
    <SafetyNumberChangeDialog
      contacts={[
        {
          story: undefined,
          contacts: [
            contactWithAllData,
            contactWithJustProfileVerified,
            contactWithJustNumberVerified,
            contactWithNothing,
          ],
        },
      ]}
      getPreferredBadge={() => getFakeBadge()}
      i18n={i18n}
      onCancel={action('cancel')}
      onConfirm={action('confirm')}
      removeFromStory={action('removeFromStory')}
      renderSafetyNumber={() => {
        action('renderSafetyNumber');
        return <div>This is a mock Safety Number View</div>;
      }}
      theme={theme}
    />
  );
};

MultipleContactsAllWithBadges.story = {
  name: 'Multiple contacts, all with badges',
};

export const TenContacts = (): JSX.Element => {
  const theme = useTheme();
  return (
    <SafetyNumberChangeDialog
      contacts={[
        {
          story: undefined,
          contacts: [
            contactWithAllData,
            contactWithJustProfileVerified,
            contactWithJustNumberVerified,
            contactWithNothing,
            contactWithAllData,
            contactWithAllData,
            contactWithAllData,
            contactWithAllData,
            contactWithAllData,
            contactWithAllData,
          ],
        },
      ]}
      getPreferredBadge={() => undefined}
      i18n={i18n}
      onCancel={action('cancel')}
      onConfirm={action('confirm')}
      removeFromStory={action('removeFromStory')}
      renderSafetyNumber={() => {
        action('renderSafetyNumber');
        return <div>This is a mock Safety Number View</div>;
      }}
      theme={theme}
    />
  );
};

TenContacts.story = {
  name: 'Ten contacts; first isReviewing = false, then scrolling dialog',
};

export const NoContacts = (): JSX.Element => {
  const theme = useTheme();
  return (
    <SafetyNumberChangeDialog
      contacts={[
        {
          story: {
            name: 'My Story',
            conversationId: 'our-conversation-id',
            distributionId: MY_STORY_ID,
          },
          contacts: [],
        },
        {
          story: {
            name: 'Custom List A',
            conversationId: 'our-conversation-id',
            distributionId: 'some-other-distribution-id',
          },
          contacts: [],
        },
      ]}
      getPreferredBadge={() => undefined}
      i18n={i18n}
      onCancel={action('cancel')}
      onConfirm={action('confirm')}
      removeFromStory={action('removeFromStory')}
      renderSafetyNumber={() => {
        action('renderSafetyNumber');
        return <div>This is a mock Safety Number View</div>;
      }}
      theme={theme}
    />
  );
};

export const InMultipleStories = (): JSX.Element => {
  const theme = useTheme();
  return (
    <SafetyNumberChangeDialog
      contacts={[
        {
          story: {
            name: 'Not to be trusted',
            conversationId: 'our-conversation-id',
            distributionId: MY_STORY_ID,
          },
          contacts: [contactWithAllData, contactWithJustProfileVerified],
        },
        {
          story: {
            name: 'Custom List A',
            conversationId: 'our-conversation-id',
            distributionId: 'some-other-distribution-id',
          },
          contacts: [
            contactWithAllData,
            contactWithAllData,
            contactWithAllData,
          ],
        },
        {
          story: {
            name: 'Hiking Buds',
            conversationId: 'hiking-group-id',
          },
          contacts: [
            contactWithJustNumberVerified,
            contactWithAllData,
            contactWithAllData,
          ],
        },
      ]}
      getPreferredBadge={() => undefined}
      i18n={i18n}
      onCancel={action('cancel')}
      onConfirm={action('confirm')}
      removeFromStory={action('removeFromStory')}
      renderSafetyNumber={() => {
        action('renderSafetyNumber');
        return <div>This is a mock Safety Number View</div>;
      }}
      theme={theme}
    />
  );
};
