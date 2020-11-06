// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import Tooltip from 'react-tooltip-lite';
import { Avatar } from './Avatar';
import { ContactName } from './conversation/ContactName';
import { LocalizerType } from '../types/Util';
import { ColorType } from '../types/Colors';
import { AcceptCallType, DeclineCallType } from '../state/ducks/calling';

export type PropsType = {
  acceptCall: (_: AcceptCallType) => void;
  declineCall: (_: DeclineCallType) => void;
  i18n: LocalizerType;
  call: {
    isVideoCall: boolean;
  };
  conversation: {
    id: string;
    avatarPath?: string;
    color?: ColorType;
    title: string;
    name?: string;
    phoneNumber?: string;
    profileName?: string;
  };
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
    <button
      className={`module-incoming-call__button module-incoming-call__button--${classSuffix}`}
      onClick={onClick}
      tabIndex={tabIndex}
      type="button"
    >
      <Tooltip
        arrowSize={6}
        content={tooltipContent}
        direction="bottom"
        distance={16}
        hoverDelay={0}
      >
        <div />
      </Tooltip>
    </button>
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
    avatarPath,
    color,
    title,
    name,
    phoneNumber,
    profileName,
  } = conversation;

  return (
    <div className="module-incoming-call">
      <div className="module-incoming-call__contact">
        <div className="module-incoming-call__contact--avatar">
          <Avatar
            avatarPath={avatarPath}
            color={color || 'ultramarine'}
            noteToSelf={false}
            conversationType="direct"
            i18n={i18n}
            name={name}
            phoneNumber={phoneNumber}
            profileName={profileName}
            title={title}
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
