// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { ConversationDetailsIcon } from './ConversationDetailsIcon';
import { ConversationType } from '../../../state/ducks/conversations';
import { LocalizerType } from '../../../types/Util';
import { PanelRow } from './PanelRow';
import { PanelSection } from './PanelSection';
import { AccessControlClass } from '../../../textsecure.d';
import { Select } from '../../Select';

export type PropsType = {
  accessEnum: typeof AccessControlClass.AccessRequired;
  changeHasGroupLink: (value: boolean) => void;
  conversation?: ConversationType;
  copyGroupLink: (groupLink: string) => void;
  generateNewGroupLink: () => void;
  i18n: LocalizerType;
  isAdmin: boolean;
  setAccessControlAddFromInviteLinkSetting: (value: boolean) => void;
};

export const GroupLinkManagement: React.ComponentType<PropsType> = ({
  accessEnum,
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

  const createEventHandler = (handleEvent: (x: boolean) => void) => {
    return (value: string) => {
      handleEvent(value === 'true');
    };
  };

  const membersNeedAdminApproval =
    conversation.accessControlAddFromInviteLink === accessEnum.ADMINISTRATOR;

  const hasGroupLink =
    conversation.groupLink &&
    conversation.accessControlAddFromInviteLink !== accessEnum.UNSATISFIABLE;
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
                  icon="share"
                />
              }
              label={i18n('GroupLinkManagement--share')}
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
                    icon="reset"
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
