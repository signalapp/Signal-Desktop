// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import type { Props as MessageRequestActionsProps } from './MessageRequestActions';
import { MessageRequestActions } from './MessageRequestActions';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const getBaseProps = (isGroup = false): MessageRequestActionsProps => ({
  i18n,
  conversationType: isGroup ? 'group' : 'direct',
  firstName: text('firstName', 'Cayce'),
  title: isGroup
    ? text('title', 'NYC Rock Climbers')
    : text('title', 'Cayce Bollard'),
  onBlock: action('block'),
  onDelete: action('delete'),
  onBlockAndReportSpam: action('blockAndReportSpam'),
  onUnblock: action('unblock'),
  onAccept: action('accept'),
});

export default {
  title: 'Components/Conversation/MessageRequestActions',
};

export const Direct = (): JSX.Element => {
  return (
    <div style={{ width: '480px' }}>
      <MessageRequestActions {...getBaseProps()} />
    </div>
  );
};

export const DirectBlocked = (): JSX.Element => {
  return (
    <div style={{ width: '480px' }}>
      <MessageRequestActions {...getBaseProps()} isBlocked />
    </div>
  );
};

DirectBlocked.story = {
  name: 'Direct (Blocked)',
};

export const Group = (): JSX.Element => {
  return (
    <div style={{ width: '480px' }}>
      <MessageRequestActions {...getBaseProps(true)} />
    </div>
  );
};

export const GroupBlocked = (): JSX.Element => {
  return (
    <div style={{ width: '480px' }}>
      <MessageRequestActions {...getBaseProps(true)} isBlocked />
    </div>
  );
};

GroupBlocked.story = {
  name: 'Group (Blocked)',
};
