// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { Avatar } from './Avatar';
import { Tooltip } from './Tooltip';
import { Theme } from '../util/theme';
import { ContactName } from './conversation/ContactName';
import { LocalizerType } from '../types/Util';
import { ConversationType } from '../state/ducks/conversations';
import { AcceptCallType, DeclineCallType } from '../state/ducks/calling';

export type PropsType = {
  acceptCall: (_: AcceptCallType) => void;
  declineCall: (_: DeclineCallType) => void;
  i18n: LocalizerType;
  call: {
    isVideoCall: boolean;
  };
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
  >;
};

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
        className={`module-incoming-call__button module-incoming-call__button--${classSuffix}`}
        onClick={onClick}
        tabIndex={tabIndex}
        type="button"
      >
        <div />
      </button>
    </Tooltip>
  );
};

export const IncomingCallBar = ({
  acceptCall,
  declineCall,
  i18n,
  call,
  conversation,
}: PropsType): JSX.Element | null => {
  const { isVideoCall } = call;
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
  } = conversation;

  return (
    <div className="module-incoming-call">
      <div className="module-incoming-call__contact">
        <div className="module-incoming-call__contact--avatar">
          <Avatar
            acceptedMessageRequest={acceptedMessageRequest}
            avatarPath={avatarPath}
            color={color || 'ultramarine'}
            noteToSelf={false}
            conversationType="direct"
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
        <div className="module-incoming-call__contact--name">
          <div className="module-incoming-call__contact--name-header">
            <ContactName
              name={name}
              phoneNumber={phoneNumber}
              profileName={profileName}
              title={title}
              i18n={i18n}
            />
          </div>
          <div
            dir="auto"
            className="module-incoming-call__contact--message-text"
          >
            {i18n(isVideoCall ? 'incomingVideoCall' : 'incomingAudioCall')}
          </div>
        </div>
      </div>
      <div className="module-incoming-call__actions">
        {isVideoCall ? (
          <>
            <CallButton
              classSuffix="decline"
              onClick={() => {
                declineCall({ conversationId });
              }}
              tabIndex={0}
              tooltipContent={i18n('declineCall')}
            />
            <CallButton
              classSuffix="accept-video-as-audio"
              onClick={() => {
                acceptCall({ conversationId, asVideoCall: false });
              }}
              tabIndex={0}
              tooltipContent={i18n('acceptCallWithoutVideo')}
            />
            <CallButton
              classSuffix="accept-video"
              onClick={() => {
                acceptCall({ conversationId, asVideoCall: true });
              }}
              tabIndex={0}
              tooltipContent={i18n('acceptCall')}
            />
          </>
        ) : (
          <>
            <CallButton
              classSuffix="decline"
              onClick={() => {
                declineCall({ conversationId });
              }}
              tabIndex={0}
              tooltipContent={i18n('declineCall')}
            />
            <CallButton
              classSuffix="accept-audio"
              onClick={() => {
                acceptCall({ conversationId, asVideoCall: false });
              }}
              tabIndex={0}
              tooltipContent={i18n('acceptCall')}
            />
          </>
        )}
      </div>
    </div>
  );
};
