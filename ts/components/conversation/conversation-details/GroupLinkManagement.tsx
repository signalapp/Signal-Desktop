// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { ConversationDetailsIcon, IconType } from './ConversationDetailsIcon';
import { SignalService as Proto } from '../../../protobuf';
import type { ConversationType } from '../../../state/ducks/conversations';
import type { LocalizerType } from '../../../types/Util';
import { PanelRow } from './PanelRow';
import { PanelSection } from './PanelSection';
import { Select } from '../../Select';

import { useDelayedRestoreFocus } from '../../../hooks/useRestoreFocus';

const AccessControlEnum = Proto.AccessControl.AccessRequired;

export type PropsType = {
  changeHasGroupLink: (value: boolean) => void;
  conversation?: ConversationType;
  copyGroupLink: (groupLink: string) => void;
  generateNewGroupLink: () => void;
  i18n: LocalizerType;
  isAdmin: boolean;
  setAccessControlAddFromInviteLinkSetting: (value: boolean) => void;
};

export const GroupLinkManagement: React.ComponentType<PropsType> = ({
  changeHasGroupLink,
  conversation,
  copyGroupLink,
  generateNewGroupLink,
  i18n,
  isAdmin,
  setAccessControlAddFromInviteLinkSetting,
}) => {
  if (conversation === undefined) {
    throw new Error('GroupLinkManagement rendered without a conversation');
  }

  const [focusRef] = useDelayedRestoreFocus();

  const createEventHandler = (handleEvent: (x: boolean) => void) => {
    return (value: string) => {
      handleEvent(value === 'true');
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

  return (
    <>
      <PanelSection>
        <PanelRow
          info={groupLinkInfo}
          label={i18n('ConversationDetails--group-link')}
          right={
            isAdmin ? (
              <Select
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
                onClick={generateNewGroupLink}
              />
            ) : null}
          </PanelSection>

          {isAdmin ? (
            <PanelSection>
              <PanelRow
                info={i18n('GroupLinkManagement--approve-info')}
                label={i18n('GroupLinkManagement--approve-label')}
                right={
                  <Select
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
