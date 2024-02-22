// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable react/no-array-index-key */

import React from 'react';
import classNames from 'classnames';

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

type ParticipantType = ConversationType & {
  hasRemoteAudio?: boolean;
  hasRemoteVideo?: boolean;
  isHandRaised?: boolean;
  presenting?: boolean;
};

export type PropsType = {
  readonly callLink: CallLinkType;
  readonly i18n: LocalizerType;
  readonly ourServiceId: ServiceIdString | undefined;
  readonly participants: Array<ParticipantType>;
  readonly onClose: () => void;
  readonly onCopyCallLink: () => void;
};

export function CallingAdhocCallInfo({
  i18n,
  ourServiceId,
  participants,
  onClose,
  onCopyCallLink,
}: PropsType): JSX.Element | null {
  const sortedParticipants = React.useMemo<Array<ParticipantType>>(
    () => sortByTitle(participants),
    [participants]
  );

  return (
    <ModalHost
      modalName="CallingAdhocCallInfo"
      moduleClassName="CallingAdhocCallInfo"
      onClose={onClose}
    >
      <div className="CallingAdhocCallInfo module-calling-participants-list">
        <div className="module-calling-participants-list__header">
          <div className="module-calling-participants-list__title">
            {!participants.length && i18n('icu:calling__in-this-call--zero')}
            {participants.length === 1 &&
              i18n('icu:calling__in-this-call--one')}
            {participants.length > 1 &&
              i18n('icu:calling__in-this-call--many', {
                people: String(participants.length),
              })}
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
          {sortedParticipants.map(
            (participant: ParticipantType, index: number) => (
              <li
                className="module-calling-participants-list__contact"
                // It's tempting to use `participant.serviceId` as the `key`
                //   here, but that can result in duplicate keys for
                //   participants who have joined on multiple devices.
                key={index}
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
                    size={AvatarSize.THIRTY_TWO}
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
              </li>
            )
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
        </div>
      </div>
    </ModalHost>
  );
}
