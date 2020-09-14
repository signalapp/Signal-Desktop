import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import {
  MessageRequestActions,
  Props as MessageRequestActionsProps,
} from './MessageRequestActions';
import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const getBaseProps = (isGroup = false): MessageRequestActionsProps => ({
  i18n,
  conversationType: isGroup ? 'group' : 'direct',
  firstName: text('firstName', 'Cayce'),
  title: isGroup
    ? text('title', 'NYC Rock Climbers')
    : text('title', 'Cayce Bollard'),
  name: isGroup
    ? text('name', 'NYC Rock Climbers')
    : text('name', 'Cayce Bollard'),
  onBlock: action('block'),
  onDelete: action('delete'),
  onBlockAndDelete: action('blockAndDelete'),
  onUnblock: action('unblock'),
  onAccept: action('accept'),
});

storiesOf('Components/Conversation/MessageRequestActions', module)
  .add('Direct', () => {
    return (
      <div style={{ width: '480px' }}>
        <MessageRequestActions {...getBaseProps()} />
      </div>
    );
  })
  .add('Direct (Blocked)', () => {
    return (
      <div style={{ width: '480px' }}>
        <MessageRequestActions {...getBaseProps()} isBlocked />
      </div>
    );
  })
  .add('Group', () => {
    return (
      <div style={{ width: '480px' }}>
        <MessageRequestActions {...getBaseProps(true)} />
      </div>
    );
  })
  .add('Group (Blocked)', () => {
    return (
      <div style={{ width: '480px' }}>
        <MessageRequestActions {...getBaseProps(true)} isBlocked />
      </div>
    );
  });
