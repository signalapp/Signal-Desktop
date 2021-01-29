// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { ConversationType } from '../../../state/ducks/conversations';
import { LocalizerType } from '../../../types/Util';
import { getAccessControlOptions } from '../../../util/getAccessControlOptions';
import { AccessControlClass } from '../../../textsecure.d';

import { PanelRow } from './PanelRow';
import { PanelSection } from './PanelSection';

export type PropsType = {
  accessEnum: typeof AccessControlClass.AccessRequired;
  conversation?: ConversationType;
  i18n: LocalizerType;
  setAccessControlAttributesSetting: (value: number) => void;
  setAccessControlMembersSetting: (value: number) => void;
};

export const GroupV2Permissions: React.ComponentType<PropsType> = ({
  accessEnum,
  conversation,
  i18n,
  setAccessControlAttributesSetting,
  setAccessControlMembersSetting,
}) => {
  if (conversation === undefined) {
    throw new Error('GroupV2Permissions rendered without a conversation');
  }

  const updateAccessControlAttributes = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setAccessControlAttributesSetting(Number(event.target.value));
  };
  const updateAccessControlMembers = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setAccessControlMembersSetting(Number(event.target.value));
  };
  const accessControlOptions = getAccessControlOptions(accessEnum, i18n);

  return (
    <PanelSection>
      <PanelRow
        label={i18n('ConversationDetails--group-info-label')}
        info={i18n('ConversationDetails--group-info-info')}
        right={
          <div className="module-conversation-details-select">
            <select
              onChange={updateAccessControlAttributes}
              value={conversation.accessControlAttributes}
            >
              {accessControlOptions.map(({ name, value }) => (
                <option aria-label={name} key={name} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        }
      />
      <PanelRow
        label={i18n('ConversationDetails--add-members-label')}
        info={i18n('ConversationDetails--add-members-info')}
        right={
          <div className="module-conversation-details-select">
            <select
              onChange={updateAccessControlMembers}
              value={conversation.accessControlMembers}
            >
              {accessControlOptions.map(({ name, value }) => (
                <option aria-label={name} key={name} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        }
      />
    </PanelSection>
  );
};
