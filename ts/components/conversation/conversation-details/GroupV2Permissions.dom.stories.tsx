// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PropsType } from './GroupV2Permissions.dom.js';
import { GroupV2Permissions } from './GroupV2Permissions.dom.js';
import type { ConversationType } from '../../../state/ducks/conversations.preload.js';
import { getDefaultConversation } from '../../../test-helpers/getDefaultConversation.std.js';
import { generateAci } from '../../../types/ServiceId.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/ConversationDetails/GroupV2Permissions',
} satisfies Meta<PropsType>;

const defaultConversation: ConversationType = getDefaultConversation({
  id: '',
  lastUpdated: 0,
  title: 'Some Conversation',
  type: 'group',
  announcementsOnlyReady: true,
  areWeAdmin: true,
});

const createProps = (): PropsType => ({
  conversation: defaultConversation,
  i18n,
  setAccessControlAttributesSetting: action(
    'setAccessControlAttributesSetting'
  ),
  setAccessControlMembersSetting: action('setAccessControlMembersSetting'),
  setAnnouncementsOnly: action('setAnnouncementsOnly'),
});

export function Basic(): React.JSX.Element {
  const props = createProps();

  return <GroupV2Permissions {...props} />;
}

export function BasicWithLabels(): React.JSX.Element {
  const props = createProps();
  const conversation = {
    ...defaultConversation,
    memberships: [
      {
        aci: generateAci(),
        isAdmin: true,
        labelString: undefined,
        labelEmoji: undefined,
      },
      {
        aci: generateAci(),
        isAdmin: true,
        labelString: 'First',
        labelEmoji: undefined,
      },
      {
        aci: generateAci(),
        isAdmin: false,
        labelString: 'Second',
        labelEmoji: undefined,
      },
    ],
  };

  return <GroupV2Permissions {...props} conversation={conversation} />;
}

export function BasicWithNonAdminLabels(): React.JSX.Element {
  const props = createProps();
  const conversation = {
    ...defaultConversation,
    memberships: [
      {
        aci: generateAci(),
        isAdmin: true,
        labelString: undefined,
        labelEmoji: undefined,
      },
      {
        aci: generateAci(),
        isAdmin: true,
        labelString: 'First',
        labelEmoji: undefined,
      },
      {
        aci: generateAci(),
        isAdmin: false,
        labelString: 'Second',
        labelEmoji: undefined,
      },
    ],
  };

  return <GroupV2Permissions {...props} conversation={conversation} />;
}

export function NotAdmin(): React.JSX.Element {
  return (
    <GroupV2Permissions
      {...createProps()}
      conversation={getDefaultConversation({
        announcementsOnly: true,
        areWeAdmin: false,
      })}
    />
  );
}

export function AdminButNotAnnouncementReady(): React.JSX.Element {
  return (
    <GroupV2Permissions
      {...createProps()}
      conversation={getDefaultConversation({
        announcementsOnlyReady: false,
        areWeAdmin: true,
      })}
    />
  );
}

export function AdminNotAnnouncementReadyButItWasOn(): React.JSX.Element {
  return (
    <GroupV2Permissions
      {...createProps()}
      conversation={getDefaultConversation({
        announcementsOnly: true,
        announcementsOnlyReady: false,
        areWeAdmin: true,
      })}
    />
  );
}
