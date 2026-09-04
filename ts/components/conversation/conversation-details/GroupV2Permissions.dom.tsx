// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useMemo, useState, type JSX } from 'react';
import type { ConversationType } from '../../../state/ducks/conversations.preload.ts';
import type { LocalizerType } from '../../../types/Util.std.ts';
import { SignalService as Proto } from '../../../protobuf/index.std.ts';
import { AxoAlertDialog } from '../../../axo/AxoAlertDialog.dom.tsx';
import { AxoList } from '../../../axo/items/AxoList.dom.tsx';
import { AxoSelectItem } from '../../../axo/items/AxoSelectItem.dom.tsx';
import { AxoItem } from '../../../axo/items/AxoItem.dom.tsx';
import { AxoContainer } from '../../../axo/AxoContainer.dom.tsx';

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

const AccessControlEnum = Proto.AccessControl.AccessRequired;

export function GroupV2Permissions({
  conversation,
  i18n,
  setAccessControlAttributesSetting,
  setAccessControlMembersSetting,
  setAccessControlMemberLabelSetting,
  setAnnouncementsOnly,
}: PropsType): JSX.Element {
  const [isWarningAboutClearingLabels, setIsWarningAboutClearingLabels] =
    useState(false);

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

  const accessControlOptions = useMemo(() => {
    return [
      {
        label: i18n('icu:GroupV2--all-members'),
        value: String(AccessControlEnum.MEMBER),
      },
      {
        label: i18n('icu:GroupV2--only-admins'),
        value: String(AccessControlEnum.ADMINISTRATOR),
      },
    ];
  }, [i18n]);

  const announcementsOnlyValue = String(
    conversation.announcementsOnly
      ? AccessControlEnum.ADMINISTRATOR
      : AccessControlEnum.MEMBER
  );

  const showAnnouncementsOnlyPermission =
    conversation.areWeAdmin &&
    (conversation.announcementsOnly || conversation.announcementsOnlyReady);

  return (
    <AxoContainer.Root>
      <AxoList.Root>
        <AxoList.Body>
          <AxoItem.Group>
            <AxoSelectItem.Root
              label={i18n('icu:ConversationDetails--add-members-label')}
              description={i18n('icu:ConversationDetails--add-members-info')}
              placeholder=""
              value={String(
                conversation.accessControlMembers ?? AccessControlEnum.MEMBER
              )}
              onValueChange={updateAccessControlMembers}
              options={accessControlOptions}
            />

            <AxoSelectItem.Root
              label={i18n('icu:ConversationDetails--group-info-label')}
              description={i18n('icu:ConversationDetails--group-info-info-v2')}
              placeholder=""
              value={String(
                conversation.accessControlAttributes ?? AccessControlEnum.MEMBER
              )}
              onValueChange={updateAccessControlAttributes}
              options={accessControlOptions}
            />

            {showAnnouncementsOnlyPermission && (
              <AxoSelectItem.Root
                label={i18n('icu:ConversationDetails--announcement-label')}
                description={i18n('icu:ConversationDetails--announcement-info')}
                placeholder=""
                value={announcementsOnlyValue}
                onValueChange={updateAnnouncementsOnly}
                options={accessControlOptions}
              />
            )}

            <AxoSelectItem.Root
              label={i18n('icu:ConversationDetails--member-label--label')}
              description={i18n('icu:ConversationDetails--member-label--info')}
              placeholder=""
              value={String(
                conversation.accessControlMemberLabel ??
                  AccessControlEnum.MEMBER
              )}
              onValueChange={updateAccessControlMemberLabel}
              options={accessControlOptions}
            />
          </AxoItem.Group>
        </AxoList.Body>
      </AxoList.Root>

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
              variant="strong-secondary"
              onClick={() => {
                setIsWarningAboutClearingLabels(false);
              }}
            >
              {i18n('icu:cancel')}
            </AxoAlertDialog.Action>
            <AxoAlertDialog.Action
              variant="strong-primary"
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
    </AxoContainer.Root>
  );
}
