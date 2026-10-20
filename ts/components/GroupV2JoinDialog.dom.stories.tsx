// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import { GroupV2JoinDialog } from './GroupV2JoinDialog.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/GroupV2JoinDialog',
} satisfies Meta;

export function Basic(): ReactNode {
  return (
    <GroupV2JoinDialog
      i18n={i18n}
      title="Random Group!"
      avatarUrl={null}
      avatarLoading={false}
      memberCount={12}
      groupDescription={null}
      approvalRequired={false}
      onJoin={action('onJoin')}
      onClose={action('onClose')}
    />
  );
}

export function ApprovalRequired(): ReactNode {
  return (
    <GroupV2JoinDialog
      i18n={i18n}
      title="Approval required!"
      avatarUrl={null}
      avatarLoading={false}
      memberCount={12}
      groupDescription={null}
      approvalRequired
      onJoin={action('onJoin')}
      onClose={action('onClose')}
    />
  );
}

export function WithAvatar(): ReactNode {
  return (
    <GroupV2JoinDialog
      i18n={i18n}
      title="Has an avatar!"
      avatarUrl="/fixtures/giphy-GVNvOUpeYmI7e.gif"
      avatarLoading={false}
      memberCount={12}
      groupDescription={null}
      approvalRequired={false}
      onJoin={action('onJoin')}
      onClose={action('onClose')}
    />
  );
}

export function WithOneMember(): ReactNode {
  return (
    <GroupV2JoinDialog
      i18n={i18n}
      title="Just one member!"
      avatarUrl={null}
      avatarLoading={false}
      memberCount={1}
      groupDescription={null}
      approvalRequired={false}
      onJoin={action('onJoin')}
      onClose={action('onClose')}
    />
  );
}

export function AvatarLoadingState(): ReactNode {
  return (
    <GroupV2JoinDialog
      i18n={i18n}
      title="Avatar loading!"
      avatarUrl={null}
      avatarLoading
      memberCount={12}
      groupDescription={null}
      approvalRequired={false}
      onJoin={action('onJoin')}
      onClose={action('onClose')}
    />
  );
}

export function Full(): ReactNode {
  return (
    <GroupV2JoinDialog
      i18n={i18n}
      title="Underwater basket weavers (LA)"
      avatarUrl="/fixtures/giphy-GVNvOUpeYmI7e.gif"
      avatarLoading={false}
      memberCount={16}
      groupDescription="Discuss meets, events, training, and recruiting."
      approvalRequired={false}
      onJoin={action('onJoin')}
      onClose={action('onClose')}
    />
  );
}
