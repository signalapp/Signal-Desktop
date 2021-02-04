// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { Avatar } from '../../Avatar';
import { LocalizerType } from '../../../types/Util';
import { ConversationType } from '../../../state/ducks/conversations';
import { bemGenerator } from './util';

export type Props = {
  i18n: LocalizerType;
  conversation: ConversationType;
};

const bem = bemGenerator('module-conversation-details-header');

export const ConversationDetailsHeader: React.ComponentType<Props> = ({
  i18n,
  conversation,
}) => {
  const memberships = conversation.memberships || [];

  return (
    <div className={bem('root')}>
      <Avatar
        conversationType="group"
        i18n={i18n}
        size={80}
        {...conversation}
      />
      <div>
        <div className={bem('title')}>{conversation.title}</div>
        <div className={bem('subtitle')}>
          {i18n('ConversationDetailsHeader--members', [
            memberships.length.toString(),
          ])}
        </div>
      </div>
    </div>
  );
};
