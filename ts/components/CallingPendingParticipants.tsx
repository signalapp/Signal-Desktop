// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* eslint-disable react/no-array-index-key */

import React from 'react';
import { Avatar, AvatarSize } from './Avatar';
import { ContactName } from './conversation/ContactName';
import { InContactsIcon } from './InContactsIcon';
import type { LocalizerType } from '../types/Util';
import type { ConversationType } from '../state/ducks/conversations';
import { isInSystemContacts } from '../util/isInSystemContacts';
import type { PendingUserActionPayloadType } from '../state/ducks/calling';
import type { ServiceIdString } from '../types/ServiceId';
import { Button, ButtonVariant } from './Button';

export type PropsType = {
  readonly i18n: LocalizerType;
  readonly ourServiceId: ServiceIdString | undefined;
  readonly participants: Array<ConversationType>;
  readonly approveUser: (payload: PendingUserActionPayloadType) => void;
  readonly denyUser: (payload: PendingUserActionPayloadType) => void;
};

export function CallingPendingParticipants({
  i18n,
  ourServiceId,
  participants,
  approveUser,
  denyUser,
}: PropsType): JSX.Element | null {
  return (
    <div className="CallingPendingParticipants module-calling-participants-list">
      <div className="module-calling-participants-list__header">
        <div className="module-calling-participants-list__title">
          {i18n('icu:CallingPendingParticipants__RequestsToJoin', {
            count: participants.length,
          })}
        </div>
      </div>
      <ul className="module-calling-participants-list__list">
        {participants.map((participant: ConversationType, index: number) => (
          <li className="module-calling-participants-list__contact" key={index}>
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
            <Button
              aria-label={i18n('icu:CallingPendingParticipants__DenyUser')}
              className="CallingPendingParticipants__PendingActionButton CallingButton__icon"
              onClick={() => denyUser({ serviceId: participant.serviceId })}
              variant={ButtonVariant.Destructive}
            >
              <span className="CallingPendingParticipants__PendingActionButtonIcon CallingPendingParticipants__PendingActionButtonIcon--Deny" />
            </Button>
            <Button
              aria-label={i18n('icu:CallingPendingParticipants__ApproveUser')}
              className="CallingPendingParticipants__PendingActionButton CallingButton__icon"
              onClick={() => approveUser({ serviceId: participant.serviceId })}
              variant={ButtonVariant.Calling}
            >
              <span className="CallingPendingParticipants__PendingActionButtonIcon CallingPendingParticipants__PendingActionButtonIcon--Approve" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
