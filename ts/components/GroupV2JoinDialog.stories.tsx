// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { boolean, number, text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import type { PropsType } from './GroupV2JoinDialog';
import { GroupV2JoinDialog } from './GroupV2JoinDialog';
import { setupI18n } from '../util/setupI18n';
import enMessages from '../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const createProps = (overrideProps: Partial<PropsType> = {}): PropsType => ({
  memberCount: number('memberCount', overrideProps.memberCount || 12),
  avatar: overrideProps.avatar,
  title: text('title', overrideProps.title || 'Random Group!'),
  approvalRequired: boolean(
    'approvalRequired',
    overrideProps.approvalRequired || false
  ),
  groupDescription: overrideProps.groupDescription,
  join: action('join'),
  onClose: action('onClose'),
  i18n,
});

const stories = storiesOf('Components/GroupV2JoinDialog', module);

stories.add('Basic', () => {
  return <GroupV2JoinDialog {...createProps()} />;
});

stories.add('Approval required', () => {
  return (
    <GroupV2JoinDialog
      {...createProps({
        approvalRequired: true,
        title: 'Approval required!',
      })}
    />
  );
});

stories.add('With avatar', () => {
  return (
    <GroupV2JoinDialog
      {...createProps({
        avatar: {
          url: '/fixtures/giphy-GVNvOUpeYmI7e.gif',
        },
        title: 'Has an avatar!',
      })}
    />
  );
});

stories.add('With one member', () => {
  return (
    <GroupV2JoinDialog
      {...createProps({
        memberCount: 1,
        title: 'Just one member!',
      })}
    />
  );
});

stories.add('Avatar loading state', () => {
  return (
    <GroupV2JoinDialog
      {...createProps({
        avatar: {
          loading: true,
        },
        title: 'Avatar loading!',
      })}
    />
  );
});

stories.add('Full', () => {
  return (
    <GroupV2JoinDialog
      {...createProps({
        avatar: {
          url: '/fixtures/giphy-GVNvOUpeYmI7e.gif',
        },
        memberCount: 16,
        groupDescription: 'Discuss meets, events, training, and recruiting.',
        title: 'Underwater basket weavers (LA)',
      })}
    />
  );
});
