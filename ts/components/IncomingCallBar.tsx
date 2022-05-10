// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactChild } from 'react';
import React, { useCallback, useEffect, useRef } from 'react';
import { Avatar } from './Avatar';
import { Tooltip } from './Tooltip';
import { Intl } from './Intl';
import { Theme } from '../util/theme';
import { getParticipantName } from '../util/callingGetParticipantName';
import { ContactName } from './conversation/ContactName';
import { Emojify } from './conversation/Emojify';
import type { LocalizerType } from '../types/Util';
import { AvatarColors } from '../types/Colors';
import { CallMode } from '../types/Calling';
import type { ConversationType } from '../state/ducks/conversations';
import type { AcceptCallType, DeclineCallType } from '../state/ducks/calling';
import { missingCaseError } from '../util/missingCaseError';
import {
  useIncomingCallShortcuts,
  useKeyboardShortcuts,
} from '../hooks/useKeyboardShortcuts';

export type PropsType = {
  acceptCall: (_: AcceptCallType) => void;
  declineCall: (_: DeclineCallType) => void;
  i18n: LocalizerType;
  conversation: Pick<
    ConversationType,
    | 'acceptedMessageRequest'
    | 'avatarPath'
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
  notifyForCall(conversationTitle: string, isVideoCall: boolean): unknown;
} & (
  | {
      callMode: CallMode.Direct;
      isVideoCall: boolean;
    }
  | {
      callMode: CallMode.Group;
      otherMembersRung: Array<Pick<ConversationType, 'firstName' | 'title'>>;
      ringer: Pick<ConversationType, 'firstName' | 'title'>;
    }
);

type CallButtonProps = {
  classSuffix: string;
  tabIndex: number;
  tooltipContent: string;
  onClick: () => void;
};

const CallButton = ({
  classSuffix,
  onClick,
  tabIndex,
  tooltipContent,
}: CallButtonProps): JSX.Element => {
  return (
    <Tooltip content={tooltipContent} theme={Theme.Dark}>
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
};

const GroupCallMessage = ({
  i18n,
  otherMembersRung,
  ringer,
}: Readonly<{
  i18n: LocalizerType;
  otherMembersRung: Array<Pick<ConversationType, 'firstName' | 'title'>>;
  ringer: Pick<ConversationType, 'firstName' | 'title'>;
}>): JSX.Element => {
  // As an optimization, we only process the first two names.
  const [first, second] = otherMembersRung
    .slice(0, 2)
    .map(member => <Emojify text={getParticipantName(member)} />);
  const ringerNode = <Emojify text={getParticipantName(ringer)} />;

  switch (otherMembersRung.length) {
    case 0:
      return (
        <Intl
          id="incomingGroupCall__ringing-you"
          i18n={i18n}
          components={{ ringer: ringerNode }}
        />
      );
    case 1:
      return (
        <Intl
          id="incomingGroupCall__ringing-1-other"
          i18n={i18n}
          components={{
            ringer: ringerNode,
            otherMember: first,
          }}
        />
      );
    case 2:
      return (
        <Intl
          id="incomingGroupCall__ringing-2-others"
          i18n={i18n}
          components={{
            ringer: ringerNode,
            first,
            second,
          }}
        />
      );
      break;
    case 3:
      return (
        <Intl
          id="incomingGroupCall__ringing-3-others"
          i18n={i18n}
          components={{
            ringer: ringerNode,
            first,
            second,
          }}
        />
      );
      break;
    default:
      return (
        <Intl
          id="incomingGroupCall__ringing-many"
          i18n={i18n}
          components={{
            ringer: ringerNode,
            first,
            second,
            remaining: String(otherMembersRung.length - 2),
          }}
        />
      );
  }
};

export const IncomingCallBar = (props: PropsType): JSX.Element | null => {
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
    avatarPath,
    color,
    isMe,
    name,
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
      messageNode = i18n(
        isVideoCall ? 'incomingVideoCall' : 'incomingAudioCall'
      );
      break;
    case CallMode.Group: {
      const { otherMembersRung, ringer } = props;
      isVideoCall = true;
      headerNode = <Emojify text={title} />;
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
    notifyForCall(initialTitle, isVideoCall);
  }, [isVideoCall, notifyForCall]);

  useEffect(() => {
    bounceAppIconStart();
    return () => {
      bounceAppIconStop();
    };
  }, [bounceAppIconStart, bounceAppIconStop]);

  const acceptVideoCall = useCallback(() => {
    acceptCall({ conversationId, asVideoCall: true });
  }, [acceptCall, conversationId]);

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
              avatarPath={avatarPath}
              badge={undefined}
              color={color || AvatarColors[0]}
              noteToSelf={false}
              conversationType={conversationType}
              i18n={i18n}
              isMe={isMe}
              name={name}
              phoneNumber={phoneNumber}
              profileName={profileName}
              title={title}
              sharedGroupNames={sharedGroupNames}
              size={52}
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
            tooltipContent={i18n('declineCall')}
          />
          {isVideoCall ? (
            <>
              <CallButton
                classSuffix="accept-video-as-audio"
                onClick={acceptAudioCall}
                tabIndex={0}
                tooltipContent={i18n('acceptCallWithoutVideo')}
              />
              <CallButton
                classSuffix="accept-video"
                onClick={acceptVideoCall}
                tabIndex={0}
                tooltipContent={i18n('acceptCall')}
              />
            </>
          ) : (
            <CallButton
              classSuffix="accept-audio"
              onClick={acceptAudioCall}
              tabIndex={0}
              tooltipContent={i18n('acceptCall')}
            />
          )}
        </div>
      </div>
    </div>
  );
};
