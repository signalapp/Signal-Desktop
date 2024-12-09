// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { partition } from 'lodash';
import type { ConversationType } from '../state/ducks/conversations';
import type { CallingConversationType } from '../types/Calling';
import type { LocalizerType } from '../types/Util';
import { Avatar, AvatarSize } from './Avatar';
import { getParticipantName } from '../util/callingGetParticipantName';
import { missingCaseError } from '../util/missingCaseError';
import { UserText } from './UserText';

export enum RingMode {
  WillNotRing,
  WillRing,
  IsRinging,
}

type PeekedParticipantType = Pick<
  ConversationType,
  | 'firstName'
  | 'systemGivenName'
  | 'systemNickname'
  | 'title'
  | 'serviceId'
  | 'titleNoDefault'
>;

export type PropsType = {
  conversation: Pick<
    CallingConversationType,
    | 'acceptedMessageRequest'
    | 'avatarUrl'
    | 'color'
    | 'isMe'
    | 'phoneNumber'
    | 'profileName'
    | 'sharedGroupNames'
    | 'systemGivenName'
    | 'systemNickname'
    | 'title'
    | 'type'
    | 'unblurredAvatarUrl'
  >;
  i18n: LocalizerType;
  me: Pick<ConversationType, 'id' | 'serviceId'>;
  ringMode: RingMode;

  // The following should only be set for group conversations.
  groupMembers?: Array<
    Pick<
      ConversationType,
      'id' | 'firstName' | 'systemGivenName' | 'systemNickname' | 'title'
    >
  >;
  isCallFull?: boolean;
  isConnecting?: boolean;
  peekedParticipants?: Array<PeekedParticipantType>;
};

export function CallingPreCallInfo({
  conversation,
  groupMembers = [],
  i18n,
  isCallFull = false,
  isConnecting = false,
  me,
  peekedParticipants = [],
  ringMode,
}: PropsType): JSX.Element {
  const [visibleParticipants, unknownParticipants] = React.useMemo<
    [Array<PeekedParticipantType>, Array<PeekedParticipantType>]
  >(
    () =>
      partition(peekedParticipants, (participant: PeekedParticipantType) =>
        Boolean(participant.titleNoDefault)
      ),
    [peekedParticipants]
  );

  let subtitle: string;
  if (ringMode === RingMode.IsRinging) {
    if (isConnecting) {
      subtitle = i18n('icu:outgoingCallConnecting');
    } else {
      subtitle = i18n('icu:outgoingCallRinging');
    }
  } else if (isCallFull) {
    subtitle = i18n('icu:calling__call-is-full');
  } else if (peekedParticipants.length) {
    if (unknownParticipants.length > 0) {
      subtitle = i18n(
        'icu:calling__pre-call-info--only-unknown-contacts-in-call',
        {
          count: peekedParticipants.length,
        }
      );
    } else {
      // It should be rare to see yourself in this list, but it's possible if (1) you
      // rejoin quickly, causing the server to return stale state (2) you have joined on
      // another device.
      let hasYou = false;
      const participantNames = visibleParticipants.map(participant => {
        if (participant.serviceId === me.serviceId) {
          hasYou = true;
          return i18n('icu:you');
        }
        return getParticipantName(participant);
      });
      switch (participantNames.length) {
        case 1:
          subtitle = hasYou
            ? i18n('icu:calling__pre-call-info--another-device-in-call')
            : i18n('icu:calling__pre-call-info--1-person-in-call', {
                first: participantNames[0],
              });
          break;
        case 2:
          subtitle = i18n('icu:calling__pre-call-info--2-people-in-call', {
            first: participantNames[0],
            second: participantNames[1],
          });
          break;
        case 3:
          subtitle = i18n('icu:calling__pre-call-info--3-people-in-call', {
            first: participantNames[0],
            second: participantNames[1],
            third: participantNames[2],
          });
          break;
        default:
          subtitle = i18n('icu:calling__pre-call-info--many-people-in-call', {
            first: participantNames[0],
            second: participantNames[1],
            others: participantNames.length - 2,
          });
          break;
      }
    }
  } else {
    let memberNames: Array<string>;
    switch (conversation.type) {
      case 'direct':
        memberNames = [getParticipantName(conversation)];
        break;
      case 'group':
      case 'callLink':
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
        subtitle = i18n('icu:calling__pre-call-info--empty-group');
        break;
      case 1: {
        subtitle = ring
          ? i18n('icu:calling__pre-call-info--will-ring-1', {
              person: memberNames[0],
            })
          : i18n('icu:calling__pre-call-info--will-notify-1', {
              person: memberNames[0],
            });
        break;
      }
      case 2: {
        subtitle = ring
          ? i18n('icu:calling__pre-call-info--will-ring-2', {
              first: memberNames[0],
              second: memberNames[1],
            })
          : i18n('icu:calling__pre-call-info--will-notify-2', {
              first: memberNames[0],
              second: memberNames[1],
            });
        break;
      }
      case 3: {
        subtitle = ring
          ? i18n('icu:calling__pre-call-info--will-ring-3', {
              first: memberNames[0],
              second: memberNames[1],
              third: memberNames[2],
            })
          : i18n('icu:calling__pre-call-info--will-notify-3', {
              first: memberNames[0],
              second: memberNames[1],
              third: memberNames[2],
            });
        break;
      }
      default: {
        subtitle = ring
          ? i18n('icu:calling__pre-call-info--will-ring-many', {
              first: memberNames[0],
              second: memberNames[1],
              others: memberNames.length - 2,
            })
          : i18n('icu:calling__pre-call-info--will-notify-many', {
              first: memberNames[0],
              second: memberNames[1],
              others: memberNames.length - 2,
            });
        break;
      }
    }
  }

  return (
    <div className="module-CallingPreCallInfo">
      <Avatar
        avatarUrl={conversation.avatarUrl}
        badge={undefined}
        color={conversation.color}
        acceptedMessageRequest={conversation.acceptedMessageRequest}
        conversationType={conversation.type}
        isMe={conversation.isMe}
        noteToSelf={false}
        phoneNumber={conversation.phoneNumber}
        profileName={conversation.profileName}
        sharedGroupNames={conversation.sharedGroupNames}
        size={AvatarSize.SIXTY_FOUR}
        title={conversation.title}
        unblurredAvatarUrl={conversation.unblurredAvatarUrl}
        i18n={i18n}
      />
      <div className="module-CallingPreCallInfo__title">
        <UserText text={conversation.title} />
      </div>
      <div className="module-CallingPreCallInfo__subtitle">{subtitle}</div>
    </div>
  );
}
