// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement, ReactNode } from 'react';
import React, { useState } from 'react';
import { get } from 'lodash';
import type { ReadonlyDeep } from 'type-fest';

import * as log from '../../logging/log';
import { I18n } from '../I18n';
import type {
  LocalizerType,
  ICUJSXMessageParamsByKeyType,
} from '../../types/Util';
import type {
  AciString,
  PniString,
  ServiceIdString,
} from '../../types/ServiceId';
import { GroupDescriptionText } from '../GroupDescriptionText';
import { Button, ButtonSize, ButtonVariant } from '../Button';
import { SystemMessage } from './SystemMessage';

import type { GroupV2ChangeType, GroupV2ChangeDetailType } from '../../groups';

import type { SmartContactRendererType } from '../../groupChange';
import { renderChange } from '../../groupChange';
import { Modal } from '../Modal';
import { ConfirmationDialog } from '../ConfirmationDialog';

export type PropsDataType = ReadonlyDeep<{
  areWeAdmin: boolean;
  change: GroupV2ChangeType;
  conversationId: string;
  groupBannedMemberships?: ReadonlyArray<ServiceIdString>;
  groupMemberships?: ReadonlyArray<{
    aci: AciString;
    isAdmin: boolean;
  }>;
  groupName?: string;
  ourAci: AciString | undefined;
  ourPni: PniString | undefined;
}>;

export type PropsActionsType = {
  blockGroupLinkRequests: (
    conversationId: string,
    serviceId: ServiceIdString
  ) => unknown;
};

export type PropsHousekeepingType = {
  i18n: LocalizerType;
  renderContact: SmartContactRendererType<JSX.Element>;
};

export type PropsType = PropsDataType &
  PropsActionsType &
  PropsHousekeepingType;

function renderStringToIntl<Key extends keyof ICUJSXMessageParamsByKeyType>(
  id: Key,
  i18n: LocalizerType,
  components: ICUJSXMessageParamsByKeyType[Key]
): JSX.Element {
  return <I18n id={id} i18n={i18n} components={components} />;
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
  | 'group-summary'
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
  fromId?: ServiceIdString
): GroupIconType {
  const changeType = detail.type;
  let possibleIcon = changeToIconMap.get(changeType);
  const isSameId = fromId === get(detail, 'aci', null);
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
  if (changeType === 'summary') {
    possibleIcon = 'group-summary';
  }
  return possibleIcon || 'group';
}

function GroupV2Detail({
  areWeAdmin,
  blockGroupLinkRequests,
  conversationId,
  detail,
  isLastText,
  fromId,
  groupMemberships,
  groupBannedMemberships,
  groupName,
  i18n,
  ourAci,
  renderContact,
  text,
}: {
  areWeAdmin: boolean;
  blockGroupLinkRequests: (
    conversationId: string,
    serviceId: ServiceIdString
  ) => unknown;
  conversationId: string;
  detail: GroupV2ChangeDetailType;
  isLastText: boolean;
  groupMemberships?: ReadonlyArray<{
    aci: AciString;
    isAdmin: boolean;
  }>;
  groupBannedMemberships?: ReadonlyArray<ServiceIdString>;
  groupName?: string;
  i18n: LocalizerType;
  fromId?: ServiceIdString;
  ourAci: AciString | undefined;
  renderContact: SmartContactRendererType<JSX.Element>;
  text: ReactNode;
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
          modalName="GroupV2Change.ViewingGroupDescription"
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
        !detail.aci
      ) {
        log.warn(
          'GroupV2Detail: ConfirmingblockGroupLinkRequests but missing aci or wrong change type'
        );
        modalNode = undefined;
        break;
      }

      modalNode = (
        <ConfirmationDialog
          dialogName="GroupV2Change.confirmBlockLinkRequests"
          title={i18n('icu:PendingRequests--block--title')}
          actions={[
            {
              action: () => blockGroupLinkRequests(conversationId, detail.aci),
              text: i18n('icu:PendingRequests--block--confirm'),
              style: 'affirmative',
            },
          ]}
          i18n={i18n}
          onClose={() => setModalState(ModalState.None)}
        >
          <I18n
            id="icu:PendingRequests--block--contents"
            i18n={i18n}
            components={{
              name: renderContact(detail.aci),
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
        {i18n('icu:view')}
      </Button>
    );
  } else if (
    isLastText &&
    detail.type === 'admin-approval-bounce' &&
    areWeAdmin &&
    detail.aci &&
    detail.aci !== ourAci &&
    (!fromId || fromId === detail.aci) &&
    !groupMemberships?.some(item => item.aci === detail.aci) &&
    !groupBannedMemberships?.some(serviceId => serviceId === detail.aci)
  ) {
    buttonNode = (
      <Button
        onClick={() =>
          setModalState(ModalState.ConfirmingblockGroupLinkRequests)
        }
        size={ButtonSize.Small}
        variant={ButtonVariant.SystemMessage}
      >
        {i18n('icu:PendingRequests--block--button')}
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
    conversationId,
    groupBannedMemberships,
    groupMemberships,
    groupName,
    i18n,
    ourAci,
    ourPni,
    renderContact,
  } = props;

  return (
    <>
      {renderChange<JSX.Element>(change, {
        i18n,
        ourAci,
        ourPni,
        renderContact,
        renderIntl: renderStringToIntl,
      }).map(({ detail, isLastText, text }, index) => {
        return (
          <GroupV2Detail
            areWeAdmin={areWeAdmin}
            blockGroupLinkRequests={blockGroupLinkRequests}
            conversationId={conversationId}
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
            ourAci={ourAci}
            renderContact={renderContact}
            text={text}
          />
        );
      })}
    </>
  );
}
