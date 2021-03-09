// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { Avatar } from '../../Avatar';
import { LocalizerType } from '../../../types/Util';
import { ConversationType } from '../../../state/ducks/conversations';
import { bemGenerator } from './util';

export type Props = {
  canEdit: boolean;
  conversation: ConversationType;
  i18n: LocalizerType;
  startEditing: () => void;
};

const bem = bemGenerator('module-conversation-details-header');

export const ConversationDetailsHeader: React.ComponentType<Props> = ({
  canEdit,
  conversation,
  i18n,
  startEditing,
}) => {
  const memberships = conversation.memberships || [];

  const contents = (
    <>
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
    </>
  );

  if (canEdit) {
    return (
      <button
        type="button"
        onClick={startEditing}
        className={bem('root', 'editable')}
      >
        {contents}
      </button>
    );
  }

  return <div className={bem('root')}>{contents}</div>;
};
