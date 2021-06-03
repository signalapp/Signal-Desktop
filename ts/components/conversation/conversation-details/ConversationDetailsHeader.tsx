// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { ReactNode } from 'react';

import { Avatar } from '../../Avatar';
import { Emojify } from '../Emojify';
import { LocalizerType } from '../../../types/Util';
import { ConversationType } from '../../../state/ducks/conversations';
import { GroupDescription } from '../GroupDescription';
import { GroupV2Membership } from './ConversationDetailsMembershipList';
import { bemGenerator } from './util';

export type Props = {
  canEdit: boolean;
  conversation: ConversationType;
  i18n: LocalizerType;
  memberships: Array<GroupV2Membership>;
  startEditing: (isGroupTitle: boolean) => void;
};

const bem = bemGenerator('module-conversation-details-header');

export const ConversationDetailsHeader: React.ComponentType<Props> = ({
  canEdit,
  conversation,
  i18n,
  memberships,
  startEditing,
}) => {
  let subtitle: ReactNode;
  if (conversation.groupDescription) {
    subtitle = (
      <GroupDescription
        i18n={i18n}
        text={conversation.groupDescription}
        title={conversation.title}
      />
    );
  } else if (canEdit) {
    subtitle = i18n('ConversationDetailsHeader--add-group-description');
  } else {
    subtitle = i18n('ConversationDetailsHeader--members', [
      memberships.length.toString(),
    ]);
  }

  const contents = (
    <>
      <Avatar
        conversationType="group"
        i18n={i18n}
        size={80}
        {...conversation}
        sharedGroupNames={[]}
      />
      <div>
        <div className={bem('title')}>
          <Emojify text={conversation.title} />
        </div>
      </div>
    </>
  );

  if (canEdit) {
    return (
      <div className={bem('root')}>
        <button
          type="button"
          onClick={ev => {
            ev.preventDefault();
            ev.stopPropagation();
            startEditing(true);
          }}
          className={bem('root', 'editable')}
        >
          {contents}
        </button>
        <button
          type="button"
          onClick={ev => {
            ev.preventDefault();
            ev.stopPropagation();
            startEditing(false);
          }}
          className={bem('root', 'editable')}
        >
          <div className={bem('subtitle')}>{subtitle}</div>
        </button>
      </div>
    );
  }

  return <div className={bem('root')}>{contents}</div>;
};
