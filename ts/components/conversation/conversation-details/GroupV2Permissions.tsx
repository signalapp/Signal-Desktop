// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import type { ConversationType } from '../../../state/ducks/conversations';
import type { LocalizerType } from '../../../types/Util';
import { getAccessControlOptions } from '../../../util/getAccessControlOptions';
import { SignalService as Proto } from '../../../protobuf';

import { PanelRow } from './PanelRow';
import { PanelSection } from './PanelSection';
import { Select } from '../../Select';
import { useUniqueId } from '../../../hooks/useUniqueId';

export type PropsType = {
  conversation?: ConversationType;
  i18n: LocalizerType;
  setAccessControlAttributesSetting: (value: number) => void;
  setAccessControlMembersSetting: (value: number) => void;
  setAnnouncementsOnly: (value: boolean) => void;
};

export const GroupV2Permissions = ({
  conversation,
  i18n,
  setAccessControlAttributesSetting,
  setAccessControlMembersSetting,
  setAnnouncementsOnly,
}: PropsType): JSX.Element => {
  const addMembersSelectId = useUniqueId();
  const groupInfoSelectId = useUniqueId();
  const announcementSelectId = useUniqueId();

  if (conversation === undefined) {
    throw new Error('GroupV2Permissions rendered without a conversation');
  }

  const updateAccessControlAttributes = (value: string) => {
    setAccessControlAttributesSetting(Number(value));
  };
  const updateAccessControlMembers = (value: string) => {
    setAccessControlMembersSetting(Number(value));
  };
  const AccessControlEnum = Proto.AccessControl.AccessRequired;
  const updateAnnouncementsOnly = (value: string) => {
    setAnnouncementsOnly(Number(value) === AccessControlEnum.ADMINISTRATOR);
  };
  const accessControlOptions = getAccessControlOptions(i18n);
  const announcementsOnlyValue = String(
    conversation.announcementsOnly
      ? AccessControlEnum.ADMINISTRATOR
      : AccessControlEnum.MEMBER
  );

  const showAnnouncementsOnlyPermission =
    conversation.areWeAdmin &&
    (conversation.announcementsOnly || conversation.announcementsOnlyReady);

  return (
    <PanelSection>
      <PanelRow
        label={
          <label htmlFor={addMembersSelectId}>
            {i18n('ConversationDetails--add-members-label')}
          </label>
        }
        info={i18n('ConversationDetails--add-members-info')}
        right={
          <Select
            id={addMembersSelectId}
            onChange={updateAccessControlMembers}
            options={accessControlOptions}
            value={String(conversation.accessControlMembers)}
          />
        }
      />
      <PanelRow
        label={
          <label htmlFor={groupInfoSelectId}>
            {i18n('ConversationDetails--group-info-label')}
          </label>
        }
        info={i18n('ConversationDetails--group-info-info')}
        right={
          <Select
            id={groupInfoSelectId}
            onChange={updateAccessControlAttributes}
            options={accessControlOptions}
            value={String(conversation.accessControlAttributes)}
          />
        }
      />
      {showAnnouncementsOnlyPermission && (
        <PanelRow
          label={
            <label htmlFor={announcementSelectId}>
              {i18n('ConversationDetails--announcement-label')}
            </label>
          }
          info={i18n('ConversationDetails--announcement-info')}
          right={
            <Select
              id={announcementSelectId}
              onChange={updateAnnouncementsOnly}
              options={accessControlOptions}
              value={announcementsOnlyValue}
            />
          }
        />
      )}
    </PanelSection>
  );
};
