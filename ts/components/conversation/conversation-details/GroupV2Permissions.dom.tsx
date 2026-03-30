// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { useId } from 'react';
import type { ConversationType } from '../../../state/ducks/conversations.preload.ts';
import type { LocalizerType } from '../../../types/Util.std.ts';
import { getAccessControlOptions } from '../../../util/getAccessControlOptions.std.ts';
import { SignalService as Proto } from '../../../protobuf/index.std.ts';
import { PanelRow } from './PanelRow.dom.tsx';
import { PanelSection } from './PanelSection.dom.tsx';
import { Select } from '../../Select.dom.tsx';
import { AxoAlertDialog } from '../../../axo/AxoAlertDialog.dom.tsx';

export type PropsDataType = {
  conversation?: ConversationType;
  i18n: LocalizerType;
};

type PropsActionType = {
  setAccessControlAttributesSetting: (id: string, value: number) => void;
  setAccessControlMembersSetting: (id: string, value: number) => void;
  setAccessControlMemberLabelSetting: (id: string, value: number) => void;
  setAnnouncementsOnly: (id: string, value: boolean) => void;
};

export type PropsType = PropsDataType & PropsActionType;

export function GroupV2Permissions({
  conversation,
  i18n,
  setAccessControlAttributesSetting,
  setAccessControlMembersSetting,
  setAccessControlMemberLabelSetting,
  setAnnouncementsOnly,
}: PropsType): React.JSX.Element {
  const AccessControlEnum = Proto.AccessControl.AccessRequired;

  const [isWarningAboutClearingLabels, setIsWarningAboutClearingLabels] =
    React.useState(false);
  const addMembersSelectId = useId();
  const groupInfoSelectId = useId();
  const announcementSelectId = useId();
  const memberLabelSelectId = useId();

  if (conversation === undefined) {
    throw new Error('GroupV2Permissions rendered without a conversation');
  }
  const nonAdminsHaveLabels = conversation.memberships?.some(
    membership => !membership.isAdmin && membership.labelString
  );

  const updateAccessControlMemberLabel = (value: string) => {
    const newValue = Number(value);
    if (newValue === AccessControlEnum.ADMINISTRATOR && nonAdminsHaveLabels) {
      setIsWarningAboutClearingLabels(true);
      return;
    }

    setAccessControlMemberLabelSetting(conversation.id, Number(value));
  };
  const updateAccessControlAttributes = (value: string) => {
    setAccessControlAttributesSetting(conversation.id, Number(value));
  };
  const updateAccessControlMembers = (value: string) => {
    setAccessControlMembersSetting(conversation.id, Number(value));
  };
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
        info={i18n('icu:ConversationDetails--group-info-info-v2')}
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
      <PanelRow
        label={
          <label htmlFor={memberLabelSelectId}>
            {i18n('icu:ConversationDetails--member-label--label')}
          </label>
        }
        info={i18n('icu:ConversationDetails--member-label--info')}
        right={
          <Select
            id={memberLabelSelectId}
            onChange={updateAccessControlMemberLabel}
            options={accessControlOptions}
            value={String(conversation.accessControlMemberLabel)}
          />
        }
      />

      <AxoAlertDialog.Root
        open={isWarningAboutClearingLabels}
        onOpenChange={value => {
          if (!value) {
            setIsWarningAboutClearingLabels(false);
          }
        }}
      >
        <AxoAlertDialog.Content escape="cancel-is-noop">
          <AxoAlertDialog.Body>
            <AxoAlertDialog.Title>
              {i18n('icu:ConversationDetails--label-clear-warning--title')}
            </AxoAlertDialog.Title>
            <AxoAlertDialog.Description>
              {i18n(
                'icu:ConversationDetails--label-clear-warning--description'
              )}
            </AxoAlertDialog.Description>
          </AxoAlertDialog.Body>
          <AxoAlertDialog.Footer>
            <AxoAlertDialog.Action
              variant="secondary"
              arrow={false}
              onClick={() => {
                setIsWarningAboutClearingLabels(false);
              }}
            >
              {i18n('icu:cancel')}
            </AxoAlertDialog.Action>
            <AxoAlertDialog.Action
              variant="primary"
              arrow={false}
              onClick={() => {
                setAccessControlMemberLabelSetting(
                  conversation.id,
                  AccessControlEnum.ADMINISTRATOR
                );
                setIsWarningAboutClearingLabels(false);
              }}
            >
              {i18n('icu:ConversationDetails--label-clear-warning--continue')}
            </AxoAlertDialog.Action>
          </AxoAlertDialog.Footer>
        </AxoAlertDialog.Content>
      </AxoAlertDialog.Root>
    </PanelSection>
  );
}
