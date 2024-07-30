// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState } from 'react';

import type { ConversationType } from '../../../state/ducks/conversations';
import type { LocalizerType } from '../../../types/Util';

import { ConfirmationDialog } from '../../ConfirmationDialog';
import { ConversationDetailsIcon, IconType } from './ConversationDetailsIcon';
import { PanelRow } from './PanelRow';
import { PanelSection } from './PanelSection';
import { Select } from '../../Select';
import { SignalService as Proto } from '../../../protobuf';

import { copyGroupLink } from '../../../util/copyLinksWithToast';
import { useDelayedRestoreFocus } from '../../../hooks/useRestoreFocus';
import { useUniqueId } from '../../../hooks/useUniqueId';

const AccessControlEnum = Proto.AccessControl.AccessRequired;

export type PropsDataType = {
  conversation?: ConversationType;
  i18n: LocalizerType;
  isAdmin: boolean;
};

export type PropsType = PropsDataType & {
  changeHasGroupLink: (conversationId: string, value: boolean) => unknown;
  generateNewGroupLink: (conversationId: string) => unknown;
  setAccessControlAddFromInviteLinkSetting: (
    conversationId: string,
    value: boolean
  ) => unknown;
};

export function GroupLinkManagement({
  changeHasGroupLink,
  conversation,
  generateNewGroupLink,
  i18n,
  isAdmin,
  setAccessControlAddFromInviteLinkSetting,
}: PropsType): JSX.Element {
  const groupLinkSelectId = useUniqueId();
  const approveSelectId = useUniqueId();

  if (conversation === undefined) {
    throw new Error('GroupLinkManagement rendered without a conversation');
  }

  const [focusRef] = useDelayedRestoreFocus();

  const createEventHandler = (
    handleEvent: (id: string, x: boolean) => unknown
  ) => {
    return (value: string) => {
      handleEvent(conversation.id, value === 'true');
    };
  };

  const membersNeedAdminApproval =
    conversation.accessControlAddFromInviteLink ===
    AccessControlEnum.ADMINISTRATOR;

  const hasGroupLink =
    conversation.groupLink &&
    conversation.accessControlAddFromInviteLink !==
      AccessControlEnum.UNSATISFIABLE;
  const groupLinkInfo = hasGroupLink ? conversation.groupLink : '';

  const [hasGenerateNewLinkDialog, setHasGenerateNewLinkDialog] =
    useState(false);

  return (
    <>
      {hasGenerateNewLinkDialog && (
        <ConfirmationDialog
          dialogName="GroupLinkManagement.resetLink"
          actions={[
            {
              action: () => {
                generateNewGroupLink(conversation.id);
              },
              style: 'negative',
              text: i18n('icu:GroupLinkManagement--reset'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setHasGenerateNewLinkDialog(false);
          }}
          title={i18n('icu:GroupLinkManagement--confirm-reset')}
        />
      )}
      <PanelSection>
        <PanelRow
          info={groupLinkInfo}
          label={
            <label htmlFor={groupLinkSelectId}>
              {i18n('icu:ConversationDetails--group-link')}
            </label>
          }
          right={
            isAdmin ? (
              <Select
                id={groupLinkSelectId}
                onChange={createEventHandler(changeHasGroupLink)}
                options={[
                  {
                    text: i18n('icu:on'),
                    value: 'true',
                  },
                  {
                    text: i18n('icu:off'),
                    value: 'false',
                  },
                ]}
                ref={focusRef}
                value={String(Boolean(hasGroupLink))}
              />
            ) : null
          }
        />
      </PanelSection>

      {hasGroupLink ? (
        <>
          <PanelSection>
            <PanelRow
              icon={
                <ConversationDetailsIcon
                  ariaLabel={i18n('icu:GroupLinkManagement--share')}
                  icon={IconType.share}
                />
              }
              label={i18n('icu:GroupLinkManagement--share')}
              ref={!isAdmin ? focusRef : undefined}
              onClick={() => {
                if (conversation.groupLink) {
                  void copyGroupLink(conversation.groupLink);
                }
              }}
            />
            {isAdmin ? (
              <PanelRow
                icon={
                  <ConversationDetailsIcon
                    ariaLabel={i18n('icu:GroupLinkManagement--reset')}
                    icon={IconType.reset}
                  />
                }
                label={i18n('icu:GroupLinkManagement--reset')}
                onClick={() => setHasGenerateNewLinkDialog(true)}
              />
            ) : null}
          </PanelSection>

          {isAdmin ? (
            <PanelSection>
              <PanelRow
                info={i18n('icu:GroupLinkManagement--approve-info')}
                label={
                  <label htmlFor={approveSelectId}>
                    {i18n('icu:GroupLinkManagement--approve-label')}
                  </label>
                }
                right={
                  <Select
                    id={approveSelectId}
                    onChange={createEventHandler(
                      setAccessControlAddFromInviteLinkSetting
                    )}
                    options={[
                      {
                        text: i18n('icu:on'),
                        value: 'true',
                      },
                      {
                        text: i18n('icu:off'),
                        value: 'false',
                      },
                    ]}
                    value={String(membersNeedAdminApproval)}
                  />
                }
              />
            </PanelSection>
          ) : null}
        </>
      ) : null}
    </>
  );
}
