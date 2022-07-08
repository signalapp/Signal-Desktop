// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement, ReactNode } from 'react';
import React, { useState } from 'react';
import { get } from 'lodash';

import * as log from '../../logging/log';
import type { ReplacementValuesType } from '../../types/I18N';
import type { FullJSXType } from '../Intl';
import { Intl } from '../Intl';
import type { LocalizerType } from '../../types/Util';
import type { UUIDStringType } from '../../types/UUID';
import { GroupDescriptionText } from '../GroupDescriptionText';
import { Button, ButtonSize, ButtonVariant } from '../Button';
import { SystemMessage } from './SystemMessage';

import type { GroupV2ChangeType, GroupV2ChangeDetailType } from '../../groups';

import type { SmartContactRendererType } from '../../groupChange';
import { renderChange } from '../../groupChange';
import { Modal } from '../Modal';
import { ConfirmationDialog } from '../ConfirmationDialog';

export type PropsDataType = {
  areWeAdmin: boolean;
  groupMemberships?: Array<{
    uuid: UUIDStringType;
    isAdmin: boolean;
  }>;
  groupBannedMemberships?: Array<UUIDStringType>;
  groupName?: string;
  ourACI?: UUIDStringType;
  ourPNI?: UUIDStringType;
  change: GroupV2ChangeType;
};

export type PropsActionsType = {
  blockGroupLinkRequests: (uuid: UUIDStringType) => unknown;
};

export type PropsHousekeepingType = {
  i18n: LocalizerType;
  renderContact: SmartContactRendererType<FullJSXType>;
};

export type PropsType = PropsDataType &
  PropsActionsType &
  PropsHousekeepingType;

function renderStringToIntl(
  id: string,
  i18n: LocalizerType,
  components?: Array<FullJSXType> | ReplacementValuesType<FullJSXType>
): FullJSXType {
  return <Intl id={id} i18n={i18n} components={components} />;
}

enum ModalState {
  None = 'None',
  ViewingGroupDescription = 'ViewingGroupDescription',
  ConfirmingblockGroupLinkRequests = 'ConfirmingblockGroupLinkRequests',
}

type GroupIconType =
  | 'group'
  | 'group-access'
  | 'group-add'
  | 'group-approved'
  | 'group-avatar'
  | 'group-decline'
  | 'group-edit'
  | 'group-leave'
  | 'group-remove';

const changeToIconMap = new Map<string, GroupIconType>([
  ['access-attributes', 'group-access'],
  ['access-invite-link', 'group-access'],
  ['access-members', 'group-access'],
  ['admin-approval-add-one', 'group-add'],
  ['admin-approval-remove-one', 'group-decline'],
  ['admin-approval-bounce', 'group-decline'],
  ['announcements-only', 'group-access'],
  ['avatar', 'group-avatar'],
  ['description', 'group-edit'],
  ['group-link-add', 'group-access'],
  ['group-link-remove', 'group-access'],
  ['group-link-reset', 'group-access'],
  ['member-add', 'group-add'],
  ['member-add-from-admin-approval', 'group-approved'],
  ['member-add-from-invite', 'group-add'],
  ['member-add-from-link', 'group-add'],
  ['member-privilege', 'group-access'],
  ['member-remove', 'group-remove'],
  ['pending-add-many', 'group-add'],
  ['pending-add-one', 'group-add'],
  ['pending-remove-many', 'group-decline'],
  ['pending-remove-one', 'group-decline'],
  ['title', 'group-edit'],
]);

function getIcon(
  detail: GroupV2ChangeDetailType,
  isLastText = true,
  fromId?: UUIDStringType
): GroupIconType {
  const changeType = detail.type;
  let possibleIcon = changeToIconMap.get(changeType);
  const isSameId = fromId === get(detail, 'uuid', null);
  if (isSameId) {
    if (changeType === 'member-remove') {
      possibleIcon = 'group-leave';
    }
    if (changeType === 'member-add-from-invite') {
      possibleIcon = 'group-approved';
    }
  }
  // Use default icon for "... requested to join via group link" added to
  // bounce notification.
  if (changeType === 'admin-approval-bounce' && isLastText) {
    possibleIcon = undefined;
  }
  return possibleIcon || 'group';
}

function GroupV2Detail({
  areWeAdmin,
  blockGroupLinkRequests,
  detail,
  isLastText,
  fromId,
  groupMemberships,
  groupBannedMemberships,
  groupName,
  i18n,
  ourACI,
  ourPNI,
  renderContact,
  text,
}: {
  areWeAdmin: boolean;
  blockGroupLinkRequests: (uuid: UUIDStringType) => unknown;
  detail: GroupV2ChangeDetailType;
  isLastText: boolean;
  groupMemberships?: Array<{
    uuid: UUIDStringType;
    isAdmin: boolean;
  }>;
  groupBannedMemberships?: Array<UUIDStringType>;
  groupName?: string;
  i18n: LocalizerType;
  fromId?: UUIDStringType;
  ourACI?: UUIDStringType;
  ourPNI?: UUIDStringType;
  renderContact: SmartContactRendererType<FullJSXType>;
  text: FullJSXType;
}): JSX.Element {
  const icon = getIcon(detail, isLastText, fromId);
  let buttonNode: ReactNode;

  const [modalState, setModalState] = useState<ModalState>(ModalState.None);
  let modalNode: ReactNode;

  switch (modalState) {
    case ModalState.None:
      modalNode = undefined;
      break;
    case ModalState.ViewingGroupDescription:
      if (detail.type !== 'description' || !detail.description) {
        log.warn(
          'GroupV2Detail: ViewingGroupDescription but missing description or wrong change type'
        );
        modalNode = undefined;
        break;
      }

      modalNode = (
        <Modal
          hasXButton
          i18n={i18n}
          title={groupName}
          onClose={() => setModalState(ModalState.None)}
        >
          <GroupDescriptionText text={detail.description} />
        </Modal>
      );
      break;
    case ModalState.ConfirmingblockGroupLinkRequests:
      if (
        !isLastText ||
        detail.type !== 'admin-approval-bounce' ||
        !detail.uuid
      ) {
        log.warn(
          'GroupV2Detail: ConfirmingblockGroupLinkRequests but missing uuid or wrong change type'
        );
        modalNode = undefined;
        break;
      }

      modalNode = (
        <ConfirmationDialog
          title={i18n('PendingRequests--block--title')}
          actions={[
            {
              action: () => blockGroupLinkRequests(detail.uuid),
              text: i18n('PendingRequests--block--confirm'),
              style: 'affirmative',
            },
          ]}
          i18n={i18n}
          onClose={() => setModalState(ModalState.None)}
        >
          <Intl
            id="PendingRequests--block--contents"
            i18n={i18n}
            components={{
              name: renderContact(detail.uuid),
            }}
          />
        </ConfirmationDialog>
      );
      break;
    default: {
      const state: never = modalState;
      log.warn(`GroupV2Detail: unexpected modal state ${state}`);
      modalNode = undefined;
      break;
    }
  }

  if (detail.type === 'description' && detail.description) {
    buttonNode = (
      <Button
        onClick={() => setModalState(ModalState.ViewingGroupDescription)}
        size={ButtonSize.Small}
        variant={ButtonVariant.SystemMessage}
      >
        {i18n('view')}
      </Button>
    );
  } else if (
    isLastText &&
    detail.type === 'admin-approval-bounce' &&
    areWeAdmin &&
    detail.uuid &&
    detail.uuid !== ourACI &&
    detail.uuid !== ourPNI &&
    (!fromId || fromId === detail.uuid) &&
    !groupMemberships?.some(item => item.uuid === detail.uuid) &&
    !groupBannedMemberships?.some(uuid => uuid === detail.uuid)
  ) {
    buttonNode = (
      <Button
        onClick={() =>
          setModalState(ModalState.ConfirmingblockGroupLinkRequests)
        }
        size={ButtonSize.Small}
        variant={ButtonVariant.SystemMessage}
      >
        {i18n('PendingRequests--block--button')}
      </Button>
    );
  }

  return (
    <>
      <SystemMessage icon={icon} contents={text} button={buttonNode} />
      {modalNode}
    </>
  );
}

export function GroupV2Change(props: PropsType): ReactElement {
  const {
    areWeAdmin,
    blockGroupLinkRequests,
    change,
    groupBannedMemberships,
    groupMemberships,
    groupName,
    i18n,
    ourACI,
    ourPNI,
    renderContact,
  } = props;

  return (
    <>
      {renderChange<FullJSXType>(change, {
        i18n,
        ourACI,
        ourPNI,
        renderContact,
        renderString: renderStringToIntl,
      }).map(({ detail, isLastText, text }, index) => {
        return (
          <GroupV2Detail
            areWeAdmin={areWeAdmin}
            blockGroupLinkRequests={blockGroupLinkRequests}
            detail={detail}
            isLastText={isLastText}
            fromId={change.from}
            groupBannedMemberships={groupBannedMemberships}
            groupMemberships={groupMemberships}
            groupName={groupName}
            i18n={i18n}
            // Difficult to find a unique key for this type
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            ourACI={ourACI}
            ourPNI={ourPNI}
            renderContact={renderContact}
            text={text}
          />
        );
      })}
    </>
  );
}
