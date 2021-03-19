// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useEffect } from 'react';
import Measure from 'react-measure';

import { Timestamp } from './Timestamp';
import { LocalizerType } from '../../types/Util';
import { CallMode } from '../../types/Calling';
import {
  CallingNotificationType,
  getCallingNotificationText,
} from '../../util/callingNotification';
import { usePrevious } from '../../util/hooks';
import { missingCaseError } from '../../util/missingCaseError';
import { Tooltip, TooltipPlacement } from '../Tooltip';

export type PropsActionsType = {
  messageSizeChanged: (messageId: string, conversationId: string) => void;
  returnToActiveCall: () => void;
  startCallingLobby: (_: {
    conversationId: string;
    isVideoCall: boolean;
  }) => void;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  conversationId: string;
  messageId: string;
};

type PropsType = CallingNotificationType & PropsActionsType & PropsHousekeeping;

export const CallingNotification: React.FC<PropsType> = React.memo(props => {
  const { conversationId, i18n, messageId, messageSizeChanged } = props;

  const [height, setHeight] = useState<null | number>(null);
  const previousHeight = usePrevious<null | number>(null, height);

  useEffect(() => {
    if (height === null) {
      return;
    }

    if (previousHeight !== null && height !== previousHeight) {
      messageSizeChanged(messageId, conversationId);
    }
  }, [height, previousHeight, conversationId, messageId, messageSizeChanged]);

  let timestamp: number;
  let callType: 'audio' | 'video';
  switch (props.callMode) {
    case CallMode.Direct:
      timestamp = props.acceptedTime || props.endedTime;
      callType = props.wasVideoCall ? 'video' : 'audio';
      break;
    case CallMode.Group:
      timestamp = props.startedTime;
      callType = 'video';
      break;
    default:
      window.log.error(missingCaseError(props));
      return null;
  }

  return (
    <Measure
      bounds
      onResize={({ bounds }) => {
        if (!bounds) {
          window.log.error('We should be measuring the bounds');
          return;
        }
        setHeight(bounds.height);
      }}
    >
      {({ measureRef }) => (
        <div
          className={`module-message-calling--notification module-message-calling--${callType}`}
          ref={measureRef}
        >
          <div className={`module-message-calling--${callType}__icon`} />
          {getCallingNotificationText(props, i18n)}
          <div>
            <Timestamp
              i18n={i18n}
              timestamp={timestamp}
              extended
              direction="outgoing"
              withImageNoCaption={false}
              withSticker={false}
              withTapToViewExpired={false}
              module="module-message__metadata__date"
            />
          </div>
          <CallingNotificationButton {...props} />
        </div>
      )}
    </Measure>
  );
});

function CallingNotificationButton(props: PropsType) {
  if (props.callMode !== CallMode.Group || props.ended) {
    return null;
  }

  const {
    activeCallConversationId,
    conversationId,
    deviceCount,
    i18n,
    maxDevices,
    returnToActiveCall,
    startCallingLobby,
  } = props;

  let buttonText: string;
  let disabledTooltipText: undefined | string;
  let onClick: undefined | (() => void);
  if (activeCallConversationId) {
    if (activeCallConversationId === conversationId) {
      buttonText = i18n('calling__return');
      onClick = returnToActiveCall;
    } else {
      buttonText = i18n('calling__join');
      disabledTooltipText = i18n(
        'calling__call-notification__button__in-another-call-tooltip'
      );
    }
  } else if (deviceCount >= maxDevices) {
    buttonText = i18n('calling__call-is-full');
    disabledTooltipText = i18n(
      'calling__call-notification__button__call-full-tooltip',
      [String(deviceCount)]
    );
  } else {
    buttonText = i18n('calling__join');
    onClick = () => {
      startCallingLobby({ conversationId, isVideoCall: true });
    };
  }

  const button = (
    <button
      className="module-message-calling--notification__button"
      disabled={Boolean(disabledTooltipText)}
      onClick={onClick}
      type="button"
    >
      {buttonText}
    </button>
  );

  if (disabledTooltipText) {
    return (
      <Tooltip content={disabledTooltipText} direction={TooltipPlacement.Top}>
        {button}
      </Tooltip>
    );
  }
  return button;
}
