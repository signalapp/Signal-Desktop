// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import lodash from 'lodash';
import { Avatar, AvatarSize } from './Avatar.dom.tsx';
import type { CallLinkType } from '../types/CallLink.std.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import { sortByTitle } from '../util/sortByTitle.std.ts';
import { ModalHost } from './ModalHost.dom.tsx';
import { AVATAR_COLOR_COUNT, AvatarColors } from '../types/Colors.std.ts';
import { Button } from './Button.dom.tsx';
import { Modal } from './Modal.dom.tsx';
import { Theme } from '../util/theme.std.ts';
import { CallingParticipantListItem } from './CallingParticipantListItem.dom.tsx';
import type {
  CallingParticipantType,
  PropsType as CallingParticipantsListPropsType,
} from './CallingParticipantsList.dom.tsx';

const { partition } = lodash;

const MAX_UNKNOWN_AVATARS_COUNT = 3;

export type PropsType = CallingParticipantsListPropsType & {
  readonly callLink: CallLinkType;
  readonly isUnknownContactDiscrete: boolean;
  readonly onCopyCallLink: () => void;
  readonly onShareCallLinkViaSignal: () => void;
};

type UnknownContactsPropsType = {
  readonly i18n: LocalizerType;
  readonly isInAdditionToKnownContacts: boolean;
  readonly participants: Array<CallingParticipantType>;
  readonly showUnknownContactDialog: () => void;
};

function UnknownContacts({
  i18n,
  isInAdditionToKnownContacts,
  participants,
  showUnknownContactDialog,
}: UnknownContactsPropsType): React.JSX.Element {
  const renderUnknownAvatar = React.useCallback(
    ({
      participant,
      key,
      size,
    }: {
      participant: CallingParticipantType;
      key: React.Key;
      size: AvatarSize;
    }) => {
      const colorIndex = participant.serviceId
        ? (parseInt(participant.serviceId.slice(-4), 16) || 0) %
          AVATAR_COLOR_COUNT
        : 0;
      return (
        <Avatar
          avatarPlaceholderGradient={participant.avatarPlaceholderGradient}
          avatarUrl={participant.avatarUrl}
          badge={undefined}
          className="CallingAdhocCallInfo__UnknownContactAvatar"
          color={AvatarColors[colorIndex]}
          conversationType="direct"
          key={key}
          i18n={i18n}
          profileName={participant.profileName}
          title={participant.title}
          size={size}
        />
      );
    },
    [i18n]
  );

  const visibleParticipants = participants.slice(0, MAX_UNKNOWN_AVATARS_COUNT);
  let avatarSize: AvatarSize;
  if (visibleParticipants.length === 1) {
    avatarSize = AvatarSize.THIRTY_SIX;
  } else if (visibleParticipants.length === 2) {
    avatarSize = AvatarSize.THIRTY;
  } else {
    avatarSize = AvatarSize.TWENTY_EIGHT;
  }

  return (
    <li
      className="module-calling-participants-list__contact"
      key="unknown-contacts"
    >
      <div className="module-calling-participants-list__avatar-and-name">
        <div
          className={classNames(
            'CallingAdhocCallInfo__UnknownContactAvatarSet',
            'module-calling-participants-list__avatar-and-name'
          )}
        >
          {visibleParticipants.map((participant, key) =>
            renderUnknownAvatar({ participant, key, size: avatarSize })
          )}
          <div className="module-contact-name module-calling-participants-list__name">
            {i18n(
              isInAdditionToKnownContacts
                ? 'icu:CallingAdhocCallInfo__UnknownContactLabel--in-addition'
                : 'icu:CallingAdhocCallInfo__UnknownContactLabel',
              { count: participants.length }
            )}
          </div>
        </div>
      </div>
      <button
        aria-label="icu:CallingAdhocCallInfo__UnknownContactInfoButton"
        className="CallingAdhocCallInfo__UnknownContactInfoButton module-calling-participants-list__status-icon module-calling-participants-list__unknown-contact"
        onClick={showUnknownContactDialog}
        type="button"
      />
    </li>
  );
}

export function CallingAdhocCallInfo({
  i18n,
  isUnknownContactDiscrete,
  ourServiceId,
  participants,
  participantMenuDisabled,
  onClose,
  onCopyCallLink,
  onShareCallLinkViaSignal,
  showContactModal,
  renderCallingParticipantMenu,
}: PropsType): React.JSX.Element | null {
  const [isUnknownContactDialogVisible, setIsUnknownContactDialogVisible] =
    React.useState(false);

  const hideUnknownContactDialog = React.useCallback(
    () => setIsUnknownContactDialogVisible(false),
    [setIsUnknownContactDialogVisible]
  );
  const onClickShareCallLinkViaSignal = React.useCallback(() => {
    onClose();
    onShareCallLinkViaSignal();
  }, [onClose, onShareCallLinkViaSignal]);

  const [visibleParticipants, unknownParticipants] = React.useMemo<
    [Array<CallingParticipantType>, Array<CallingParticipantType>]
  >(
    () =>
      partition(
        participants,
        (participant: CallingParticipantType) =>
          isUnknownContactDiscrete || Boolean(participant.titleNoDefault)
      ),
    [isUnknownContactDiscrete, participants]
  );
  const sortedParticipants = React.useMemo<Array<CallingParticipantType>>(
    () => sortByTitle(visibleParticipants),
    [visibleParticipants]
  );

  const renderParticipant = React.useCallback(
    (participant: CallingParticipantType, key: React.Key) => (
      <CallingParticipantListItem
        callConversationId={undefined}
        i18n={i18n}
        key={key}
        ourServiceId={ourServiceId}
        participant={participant}
        participantMenuDisabled={participantMenuDisabled}
        showContactModal={showContactModal}
        renderCallingParticipantMenu={renderCallingParticipantMenu}
      />
    ),
    [
      i18n,
      ourServiceId,
      renderCallingParticipantMenu,
      participantMenuDisabled,
      showContactModal,
    ]
  );

  return (
    <>
      {isUnknownContactDialogVisible ? (
        <Modal
          modalName="CallingAdhocCallInfo.UnknownContactInfo"
          moduleClassName="CallingAdhocCallInfo__UnknownContactInfoDialog"
          i18n={i18n}
          modalFooter={
            <Button onClick={hideUnknownContactDialog}>
              {i18n('icu:CallingAdhocCallInfo__UnknownContactInfoDialogOk')}
            </Button>
          }
          onClose={hideUnknownContactDialog}
          theme={Theme.Dark}
        >
          {i18n('icu:CallingAdhocCallInfo__UnknownContactInfoDialogBody')}
        </Modal>
      ) : null}
      <ModalHost
        modalName="CallingAdhocCallInfo"
        moduleClassName="CallingAdhocCallInfo"
        onClose={onClose}
      >
        <div className="CallingAdhocCallInfo module-calling-participants-list">
          <div className="module-calling-participants-list__header">
            <div className="module-calling-participants-list__title">
              {participants.length
                ? i18n('icu:calling__in-this-call', {
                    people: participants.length,
                  })
                : i18n('icu:calling__in-this-call--zero')}
            </div>
            <button
              type="button"
              className="module-calling-participants-list__close"
              onClick={onClose}
              tabIndex={0}
              aria-label={i18n('icu:close')}
            />
          </div>
          <ul className="module-calling-participants-list__list">
            {sortedParticipants.map(renderParticipant)}
            {unknownParticipants.length > 0 && (
              <UnknownContacts
                i18n={i18n}
                isInAdditionToKnownContacts={Boolean(
                  visibleParticipants.length
                )}
                participants={unknownParticipants}
                showUnknownContactDialog={() =>
                  setIsUnknownContactDialogVisible(true)
                }
              />
            )}
          </ul>
          <div className="CallingAdhocCallInfo__Divider" />
          <div className="CallingAdhocCallInfo__CallLinkInfo">
            <button
              className="CallingAdhocCallInfo__MenuItem"
              onClick={onCopyCallLink}
              type="button"
            >
              <span className="CallingAdhocCallInfo__MenuItemIcon CallingAdhocCallInfo__MenuItemIcon--copy-link" />
              <span className="CallingAdhocCallInfo__MenuItemText">
                {i18n('icu:CallingAdhocCallInfo__CopyLink')}
              </span>
            </button>
            <button
              className="CallingAdhocCallInfo__MenuItem"
              onClick={onClickShareCallLinkViaSignal}
              type="button"
            >
              <span className="CallingAdhocCallInfo__MenuItemIcon CallingAdhocCallInfo__MenuItemIcon--share-via-signal" />
              <span className="CallingAdhocCallInfo__MenuItemText">
                {i18n('icu:CallingAdhocCallInfo__ShareViaSignal')}
              </span>
            </button>
          </div>
        </div>
      </ModalHost>
    </>
  );
}
