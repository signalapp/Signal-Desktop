// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useId } from 'react';
import type { ConversationType } from '../../../state/ducks/conversations.preload.js';
import type { LocalizerType } from '../../../types/Util.std.js';
import { getAccessControlOptions } from '../../../util/getAccessControlOptions.std.js';
import { SignalService as Proto } from '../../../protobuf/index.std.js';
import { PanelRow } from './PanelRow.dom.js';
import { PanelSection } from './PanelSection.dom.js';
import { Select } from '../../Select.dom.js';

export type PropsDataType = {
  conversation?: ConversationType;
  i18n: LocalizerType;
};

type PropsActionType = {
  setAccessControlAttributesSetting: (id: string, value: number) => void;
  setAccessControlMembersSetting: (id: string, value: number) => void;
  setAnnouncementsOnly: (id: string, value: boolean) => void;
};

export type PropsType = PropsDataType & PropsActionType;

export function GroupV2Permissions({
  conversation,
  i18n,
  setAccessControlAttributesSetting,
  setAccessControlMembersSetting,
  setAnnouncementsOnly,
}: PropsType): JSX.Element {
  const addMembersSelectId = useId();
  const groupInfoSelectId = useId();
  const announcementSelectId = useId();

  if (conversation === undefined) {
    throw new Error('GroupV2Permissions rendered without a conversation');
  }

  const updateAccessControlAttributes = (value: string) => {
    setAccessControlAttributesSetting(conversation.id, Number(value));
  };
  const updateAccessControlMembers = (value: string) => {
    setAccessControlMembersSetting(conversation.id, Number(value));
  };
  const AccessControlEnum = Proto.AccessControl.AccessRequired;
  const updateAnnouncementsOnly = (value: string) => {
    setAnnouncementsOnly(
      conversation.id,
      Number(value) === AccessControlEnum.ADMINISTRATOR
    );
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
            {i18n('icu:ConversationDetails--add-members-label')}
          </label>
        }
        info={i18n('icu:ConversationDetails--add-members-info')}
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
            {i18n('icu:ConversationDetails--group-info-label')}
          </label>
        }
        info={i18n('icu:ConversationDetails--group-info-info')}
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
              {i18n('icu:ConversationDetails--announcement-label')}
            </label>
          }
          info={i18n('icu:ConversationDetails--announcement-info')}
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
}
