// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactChild } from 'react';
import React, { useCallback, useEffect, useRef } from 'react';
import { Avatar, AvatarSize } from './Avatar';
import { Tooltip } from './Tooltip';
import { I18n } from './I18n';
import { Theme } from '../util/theme';
import { getParticipantName } from '../util/callingGetParticipantName';
import { ContactName } from './conversation/ContactName';
import type { LocalizerType } from '../types/Util';
import { AvatarColors } from '../types/Colors';
import { CallMode } from '../types/CallDisposition';
import type { ConversationType } from '../state/ducks/conversations';
import type { AcceptCallType, DeclineCallType } from '../state/ducks/calling';
import { missingCaseError } from '../util/missingCaseError';
import {
  useIncomingCallShortcuts,
  useKeyboardShortcuts,
} from '../hooks/useKeyboardShortcuts';
import { UserText } from './UserText';

export type PropsType = {
  acceptCall: (_: AcceptCallType) => void;
  declineCall: (_: DeclineCallType) => void;
  i18n: LocalizerType;
  conversation: Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarUrl'
    | 'color'
    | 'id'
    | 'isMe'
    | 'name'
    | 'phoneNumber'
    | 'profileName'
    | 'sharedGroupNames'
    | 'title'
    | 'type'
  >;
  bounceAppIconStart(): unknown;
  bounceAppIconStop(): unknown;
  notifyForCall(
    conversationId: string,
    conversationTitle: string,
    isVideoCall: boolean
  ): unknown;
} & (
  | {
      callMode: CallMode.Direct;
      isVideoCall: boolean;
    }
  | {
      callMode: CallMode.Group;
      otherMembersRung: Array<
        Pick<
          ConversationType,
          'firstName' | 'systemGivenName' | 'systemNickname' | 'title'
        >
      >;
      ringer: Pick<
        ConversationType,
        'firstName' | 'systemGivenName' | 'systemNickname' | 'title'
      >;
    }
);

type CallButtonProps = {
  classSuffix: string;
  tabIndex: number;
  tooltipContent: string;
  onClick: () => void;
};

function CallButton({
  classSuffix,
  onClick,
  tabIndex,
  tooltipContent,
}: CallButtonProps): JSX.Element {
  return (
    <Tooltip
      content={tooltipContent}
      theme={Theme.Dark}
      wrapperClassName="IncomingCallBar__button__container"
    >
      <button
        aria-label={tooltipContent}
        className={`IncomingCallBar__button IncomingCallBar__button--${classSuffix}`}
        onClick={onClick}
        tabIndex={tabIndex}
        type="button"
      >
        <div />
      </button>
    </Tooltip>
  );
}

function GroupCallMessage({
  i18n,
  otherMembersRung,
  ringer,
}: Readonly<{
  i18n: LocalizerType;
  otherMembersRung: Array<
    Pick<
      ConversationType,
      'firstName' | 'systemGivenName' | 'systemNickname' | 'title'
    >
  >;
  ringer: Pick<
    ConversationType,
    'firstName' | 'systemGivenName' | 'systemNickname' | 'title'
  >;
}>): JSX.Element {
  // As an optimization, we only process the first two names.
  const [first, second] = otherMembersRung
    .slice(0, 2)
    .map(member => <UserText text={getParticipantName(member)} />);
  const ringerNode = <UserText text={getParticipantName(ringer)} />;

  switch (otherMembersRung.length) {
    case 0:
      return (
        <I18n
          id="icu:incomingGroupCall__ringing-you"
          i18n={i18n}
          components={{ ringer: ringerNode }}
        />
      );
    case 1:
      return (
        <I18n
          id="icu:incomingGroupCall__ringing-1-other"
          i18n={i18n}
          components={{
            ringer: ringerNode,
            otherMember: first,
          }}
        />
      );
    case 2:
      return (
        <I18n
          id="icu:incomingGroupCall__ringing-2-others"
          i18n={i18n}
          components={{
            ringer: ringerNode,
            first,
            second,
          }}
        />
      );
    case 3:
      return (
        <I18n
          id="icu:incomingGroupCall__ringing-3-others"
          i18n={i18n}
          components={{
            ringer: ringerNode,
            first,
            second,
          }}
        />
      );
    default:
      return (
        <I18n
          id="icu:incomingGroupCall__ringing-many"
          i18n={i18n}
          components={{
            ringer: ringerNode,
            first,
            second,
            remaining: otherMembersRung.length - 2,
          }}
        />
      );
  }
}

export function IncomingCallBar(props: PropsType): JSX.Element | null {
  const {
    acceptCall,
    bounceAppIconStart,
    bounceAppIconStop,
    conversation,
    declineCall,
    i18n,
    notifyForCall,
  } = props;
  const {
    id: conversationId,
    acceptedMessageRequest,
    avatarUrl,
    color,
    isMe,
    phoneNumber,
    profileName,
    sharedGroupNames,
    title,
    type: conversationType,
  } = conversation;

  let isVideoCall: boolean;
  let headerNode: ReactChild;
  let messageNode: ReactChild;

  switch (props.callMode) {
    case CallMode.Direct:
      ({ isVideoCall } = props);
      headerNode = <ContactName title={title} />;
      messageNode = isVideoCall
        ? i18n('icu:incomingVideoCall')
        : i18n('icu:incomingAudioCall');
      break;
    case CallMode.Group: {
      const { otherMembersRung, ringer } = props;
      isVideoCall = true;
      headerNode = <UserText text={title} />;
      messageNode = (
        <GroupCallMessage
          i18n={i18n}
          otherMembersRung={otherMembersRung}
          ringer={ringer}
        />
      );
      break;
    }
    default:
      throw missingCaseError(props);
  }

  // We don't want to re-notify if the title changes.
  const initialTitleRef = useRef<string>(title);
  useEffect(() => {
    const initialTitle = initialTitleRef.current;
    notifyForCall(conversationId, initialTitle, isVideoCall);
  }, [conversationId, isVideoCall, notifyForCall]);

  useEffect(() => {
    bounceAppIconStart();
    return () => {
      bounceAppIconStop();
    };
  }, [bounceAppIconStart, bounceAppIconStop]);

  const acceptVideoCall = useCallback(() => {
    if (isVideoCall) {
      acceptCall({ conversationId, asVideoCall: true });
    }
  }, [isVideoCall, acceptCall, conversationId]);

  const acceptAudioCall = useCallback(() => {
    acceptCall({ conversationId, asVideoCall: false });
  }, [acceptCall, conversationId]);

  const declineIncomingCall = useCallback(() => {
    declineCall({ conversationId });
  }, [conversationId, declineCall]);

  const incomingCallShortcuts = useIncomingCallShortcuts(
    acceptAudioCall,
    acceptVideoCall,
    declineIncomingCall
  );
  useKeyboardShortcuts(incomingCallShortcuts);

  return (
    <div className="IncomingCallBar__container">
      <div className="IncomingCallBar__bar">
        <div className="IncomingCallBar__conversation">
          <div className="IncomingCallBar__conversation--avatar">
            <Avatar
              acceptedMessageRequest={acceptedMessageRequest}
              avatarUrl={avatarUrl}
              badge={undefined}
              color={color || AvatarColors[0]}
              noteToSelf={false}
              conversationType={conversationType}
              i18n={i18n}
              isMe={isMe}
              phoneNumber={phoneNumber}
              profileName={profileName}
              title={title}
              sharedGroupNames={sharedGroupNames}
              size={AvatarSize.FORTY_EIGHT}
            />
          </div>
          <div className="IncomingCallBar__conversation--name">
            <div className="IncomingCallBar__conversation--name-header">
              {headerNode}
            </div>
            <div
              dir="auto"
              className="IncomingCallBar__conversation--message-text"
            >
              {messageNode}
            </div>
          </div>
        </div>
        <div className="IncomingCallBar__actions">
          <CallButton
            classSuffix="decline"
            onClick={declineIncomingCall}
            tabIndex={0}
            tooltipContent={i18n('icu:declineCall')}
          />
          {isVideoCall ? (
            <>
              <CallButton
                classSuffix="accept-video-as-audio"
                onClick={acceptAudioCall}
                tabIndex={0}
                tooltipContent={i18n('icu:acceptCallWithoutVideo')}
              />
              <CallButton
                classSuffix="accept-video"
                onClick={acceptVideoCall}
                tabIndex={0}
                tooltipContent={i18n('icu:acceptCall')}
              />
            </>
          ) : (
            <CallButton
              classSuffix="accept-audio"
              onClick={acceptAudioCall}
              tabIndex={0}
              tooltipContent={i18n('icu:acceptCall')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
