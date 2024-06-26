// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import { partition } from 'lodash';
import { Avatar, AvatarSize } from './Avatar';
import { ContactName } from './conversation/ContactName';
import { InContactsIcon } from './InContactsIcon';
import type { CallLinkType } from '../types/CallLink';
import type { LocalizerType } from '../types/Util';
import type { ServiceIdString } from '../types/ServiceId';
import { sortByTitle } from '../util/sortByTitle';
import type { ConversationType } from '../state/ducks/conversations';
import { ModalHost } from './ModalHost';
import { isInSystemContacts } from '../util/isInSystemContacts';
import type { RemoveClientType } from '../state/ducks/calling';
import { AVATAR_COLOR_COUNT, AvatarColors } from '../types/Colors';
import { Button } from './Button';
import { Modal } from './Modal';
import { Theme } from '../util/theme';

const MAX_UNKNOWN_AVATARS_COUNT = 3;

type ParticipantType = ConversationType & {
  hasRemoteAudio?: boolean;
  hasRemoteVideo?: boolean;
  isHandRaised?: boolean;
  presenting?: boolean;
  demuxId?: number;
};

export type PropsType = {
  readonly callLink: CallLinkType;
  readonly i18n: LocalizerType;
  readonly isCallLinkAdmin: boolean;
  readonly ourServiceId: ServiceIdString | undefined;
  readonly participants: Array<ParticipantType>;
  readonly onClose: () => void;
  readonly onCopyCallLink: () => void;
  readonly onShareCallLinkViaSignal: () => void;
  readonly removeClient: ((payload: RemoveClientType) => void) | null;
  readonly showContactModal: (
    contactId: string,
    conversationId?: string
  ) => void;
};

type UnknownContactsPropsType = {
  readonly i18n: LocalizerType;
  readonly isInAdditionToKnownContacts: boolean;
  readonly participants: Array<ParticipantType>;
  readonly showUnknownContactDialog: () => void;
};

function UnknownContacts({
  i18n,
  isInAdditionToKnownContacts,
  participants,
  showUnknownContactDialog,
}: UnknownContactsPropsType): JSX.Element {
  const renderUnknownAvatar = React.useCallback(
    ({
      participant,
      key,
      size,
    }: {
      participant: ParticipantType;
      key: React.Key;
      size: AvatarSize;
    }) => {
      const colorIndex = participant.serviceId
        ? (parseInt(participant.serviceId.slice(-4), 16) || 0) %
          AVATAR_COLOR_COUNT
        : 0;
      return (
        <Avatar
          acceptedMessageRequest={participant.acceptedMessageRequest}
          avatarPath={participant.avatarPath}
          badge={undefined}
          className="CallingAdhocCallInfo__UnknownContactAvatar"
          color={AvatarColors[colorIndex]}
          conversationType="direct"
          key={key}
          i18n={i18n}
          isMe={participant.isMe}
          profileName={participant.profileName}
          title={participant.title}
          sharedGroupNames={participant.sharedGroupNames}
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
  isCallLinkAdmin,
  ourServiceId,
  participants,
  onClose,
  onCopyCallLink,
  onShareCallLinkViaSignal,
  removeClient,
  showContactModal,
}: PropsType): JSX.Element | null {
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

  const [knownParticipants, unknownParticipants] = React.useMemo<
    [Array<ParticipantType>, Array<ParticipantType>]
  >(
    () =>
      partition(participants, (participant: ParticipantType) =>
        Boolean(participant.titleNoDefault)
      ),
    [participants]
  );
  const sortedParticipants = React.useMemo<Array<ParticipantType>>(
    () => sortByTitle(knownParticipants),
    [knownParticipants]
  );

  const renderParticipant = React.useCallback(
    (participant: ParticipantType, key: React.Key) => (
      <button
        aria-label={i18n('icu:calling__ParticipantInfoButton')}
        className="module-calling-participants-list__contact"
        disabled={participant.isMe}
        // It's tempting to use `participant.serviceId` as the `key`
        //   here, but that can result in duplicate keys for
        //   participants who have joined on multiple devices.
        key={key}
        onClick={() => {
          if (participant.isMe) {
            return;
          }

          onClose();
          showContactModal(participant.id);
        }}
        type="button"
      >
        <div className="module-calling-participants-list__avatar-and-name">
          <Avatar
            acceptedMessageRequest={participant.acceptedMessageRequest}
            avatarPath={participant.avatarPath}
            badge={undefined}
            color={participant.color}
            conversationType="direct"
            i18n={i18n}
            isMe={participant.isMe}
            profileName={participant.profileName}
            title={participant.title}
            sharedGroupNames={participant.sharedGroupNames}
            size={AvatarSize.THIRTY_SIX}
          />
          {ourServiceId && participant.serviceId === ourServiceId ? (
            <span className="module-calling-participants-list__name">
              {i18n('icu:you')}
            </span>
          ) : (
            <>
              <ContactName
                module="module-calling-participants-list__name"
                title={participant.title}
              />
              {isInSystemContacts(participant) ? (
                <span>
                  {' '}
                  <InContactsIcon
                    className="module-calling-participants-list__contact-icon"
                    i18n={i18n}
                  />
                </span>
              ) : null}
            </>
          )}
        </div>
        <span
          className={classNames(
            'module-calling-participants-list__status-icon',
            participant.isHandRaised &&
              'module-calling-participants-list__hand-raised'
          )}
        />
        <span
          className={classNames(
            'module-calling-participants-list__status-icon',
            participant.presenting &&
              'module-calling-participants-list__presenting',
            !participant.hasRemoteVideo &&
              'module-calling-participants-list__muted--video'
          )}
        />
        <span
          className={classNames(
            'module-calling-participants-list__status-icon',
            !participant.hasRemoteAudio &&
              'module-calling-participants-list__muted--audio'
          )}
        />
        {isCallLinkAdmin &&
        removeClient &&
        participant.demuxId &&
        !(ourServiceId && participant.serviceId === ourServiceId) ? (
          <button
            aria-label={i18n('icu:CallingAdhocCallInfo__RemoveClient')}
            className={classNames(
              'CallingAdhocCallInfo__RemoveClient',
              'module-calling-participants-list__status-icon',
              'module-calling-participants-list__remove'
            )}
            onClick={event => {
              if (!participant.demuxId) {
                return;
              }

              event.stopPropagation();
              event.preventDefault();
              removeClient({ demuxId: participant.demuxId });
            }}
            type="button"
          />
        ) : null}
      </button>
    ),
    [
      i18n,
      isCallLinkAdmin,
      onClose,
      ourServiceId,
      removeClient,
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
                isInAdditionToKnownContacts={Boolean(knownParticipants.length)}
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
