// Copyright 2020-2022 Signal Messenger, LLC
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

import { copyGroupLink } from '../../../util/copyGroupLink';
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

export const GroupLinkManagement: React.ComponentType<PropsType> = ({
  changeHasGroupLink,
  conversation,
  generateNewGroupLink,
  i18n,
  isAdmin,
  setAccessControlAddFromInviteLinkSetting,
}) => {
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
          actions={[
            {
              action: () => {
                generateNewGroupLink(conversation.id);
              },
              style: 'negative',
              text: i18n('GroupLinkManagement--reset'),
            },
          ]}
          i18n={i18n}
          onClose={() => {
            setHasGenerateNewLinkDialog(false);
          }}
          title={i18n('GroupLinkManagement--confirm-reset')}
        />
      )}
      <PanelSection>
        <PanelRow
          info={groupLinkInfo}
          label={
            <label htmlFor={groupLinkSelectId}>
              {i18n('ConversationDetails--group-link')}
            </label>
          }
          right={
            isAdmin ? (
              <Select
                id={groupLinkSelectId}
                onChange={createEventHandler(changeHasGroupLink)}
                options={[
                  {
                    text: i18n('on'),
                    value: 'true',
                  },
                  {
                    text: i18n('off'),
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
                  ariaLabel={i18n('GroupLinkManagement--share')}
                  icon={IconType.share}
                />
              }
              label={i18n('GroupLinkManagement--share')}
              ref={!isAdmin ? focusRef : undefined}
              onClick={() => {
                if (conversation.groupLink) {
                  copyGroupLink(conversation.groupLink);
                }
              }}
            />
            {isAdmin ? (
              <PanelRow
                icon={
                  <ConversationDetailsIcon
                    ariaLabel={i18n('GroupLinkManagement--reset')}
                    icon={IconType.reset}
                  />
                }
                label={i18n('GroupLinkManagement--reset')}
                onClick={() => setHasGenerateNewLinkDialog(true)}
              />
            ) : null}
          </PanelSection>

          {isAdmin ? (
            <PanelSection>
              <PanelRow
                info={i18n('GroupLinkManagement--approve-info')}
                label={
                  <label htmlFor={approveSelectId}>
                    {i18n('GroupLinkManagement--approve-label')}
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
                        text: i18n('on'),
                        value: 'true',
                      },
                      {
                        text: i18n('off'),
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
};
