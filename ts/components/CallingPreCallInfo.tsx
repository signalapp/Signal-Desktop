// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { FunctionComponent } from 'react';
import React from 'react';
import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType } from '../types/Util';
import { Avatar, AvatarSize } from './Avatar';
import { Emojify } from './conversation/Emojify';
import { getParticipantName } from '../util/callingGetParticipantName';
import { missingCaseError } from '../util/missingCaseError';

export enum RingMode {
  WillNotRing,
  WillRing,
  IsRinging,
}

type PropsType = {
  conversation: Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarPath'
    | 'color'
    | 'isMe'
    | 'name'
    | 'phoneNumber'
    | 'profileName'
    | 'sharedGroupNames'
    | 'title'
    | 'type'
    | 'unblurredAvatarPath'
  >;
  i18n: LocalizerType;
  me: Pick<ConversationType, 'id' | 'uuid'>;
  ringMode: RingMode;

  // The following should only be set for group conversations.
  groupMembers?: Array<Pick<ConversationType, 'id' | 'firstName' | 'title'>>;
  isCallFull?: boolean;
  peekedParticipants?: Array<
    Pick<ConversationType, 'firstName' | 'title' | 'uuid'>
  >;
};

export const CallingPreCallInfo: FunctionComponent<PropsType> = ({
  conversation,
  groupMembers = [],
  i18n,
  isCallFull = false,
  me,
  peekedParticipants = [],
  ringMode,
}) => {
  let subtitle: string;
  if (ringMode === RingMode.IsRinging) {
    subtitle = i18n('outgoingCallRinging');
  } else if (isCallFull) {
    subtitle = i18n('calling__call-is-full');
  } else if (peekedParticipants.length) {
    // It should be rare to see yourself in this list, but it's possible if (1) you rejoin
    //   quickly, causing the server to return stale state (2) you have joined on another
    //   device.
    let hasYou = false;
    const participantNames = peekedParticipants.map(participant => {
      if (participant.uuid === me.uuid) {
        hasYou = true;
        return i18n('you');
      }
      return getParticipantName(participant);
    });

    switch (participantNames.length) {
      case 1:
        subtitle = hasYou
          ? i18n('calling__pre-call-info--another-device-in-call')
          : i18n('calling__pre-call-info--1-person-in-call', participantNames);
        break;
      case 2:
        subtitle = i18n('calling__pre-call-info--2-people-in-call', {
          first: participantNames[0],
          second: participantNames[1],
        });
        break;
      case 3:
        subtitle = i18n('calling__pre-call-info--3-people-in-call', {
          first: participantNames[0],
          second: participantNames[1],
          third: participantNames[2],
        });
        break;
      default:
        subtitle = i18n('calling__pre-call-info--many-people-in-call', {
          first: participantNames[0],
          second: participantNames[1],
          others: String(participantNames.length - 2),
        });
        break;
    }
  } else {
    let memberNames: Array<string>;
    switch (conversation.type) {
      case 'direct':
        memberNames = [getParticipantName(conversation)];
        break;
      case 'group':
        memberNames = groupMembers
          .filter(member => member.id !== me.id)
          .map(getParticipantName);
        break;
      default:
        throw missingCaseError(conversation.type);
    }

    const ring = ringMode === RingMode.WillRing;

    switch (memberNames.length) {
      case 0:
        subtitle = i18n('calling__pre-call-info--empty-group');
        break;
      case 1: {
        const i18nValues = [memberNames[0]];
        subtitle = ring
          ? i18n('calling__pre-call-info--will-ring-1', i18nValues)
          : i18n('calling__pre-call-info--will-notify-1', i18nValues);
        break;
      }
      case 2: {
        const i18nValues = {
          first: memberNames[0],
          second: memberNames[1],
        };
        subtitle = ring
          ? i18n('calling__pre-call-info--will-ring-2', i18nValues)
          : i18n('calling__pre-call-info--will-notify-2', i18nValues);
        break;
      }
      case 3: {
        const i18nValues = {
          first: memberNames[0],
          second: memberNames[1],
          third: memberNames[2],
        };
        subtitle = ring
          ? i18n('calling__pre-call-info--will-ring-3', i18nValues)
          : i18n('calling__pre-call-info--will-notify-3', i18nValues);
        break;
      }
      default: {
        const i18nValues = {
          first: memberNames[0],
          second: memberNames[1],
          others: String(memberNames.length - 2),
        };
        subtitle = ring
          ? i18n('calling__pre-call-info--will-ring-many', i18nValues)
          : i18n('calling__pre-call-info--will-notify-many', i18nValues);
        break;
      }
    }
  }

  return (
    <div className="module-CallingPreCallInfo">
      <Avatar
        avatarPath={conversation.avatarPath}
        badge={undefined}
        color={conversation.color}
        acceptedMessageRequest={conversation.acceptedMessageRequest}
        conversationType={conversation.type}
        isMe={conversation.isMe}
        name={conversation.name}
        noteToSelf={false}
        phoneNumber={conversation.phoneNumber}
        profileName={conversation.profileName}
        sharedGroupNames={conversation.sharedGroupNames}
        size={AvatarSize.ONE_HUNDRED_TWELVE}
        title={conversation.title}
        unblurredAvatarPath={conversation.unblurredAvatarPath}
        i18n={i18n}
      />
      <div className="module-CallingPreCallInfo__title">
        <Emojify text={conversation.title} />
      </div>
      <div className="module-CallingPreCallInfo__subtitle">{subtitle}</div>
    </div>
  );
};
