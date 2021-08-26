// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useState, useEffect } from 'react';
import classNames from 'classnames';
import Measure from 'react-measure';
import { noop } from 'lodash';

import { Button, ButtonSize, ButtonVariant } from '../Button';
import { Timestamp } from './Timestamp';
import { LocalizerType } from '../../types/Util';
import { CallMode } from '../../types/Calling';
import {
  CallingNotificationType,
  getCallingIcon,
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

  let hasButton = false;
  let timestamp: number;
  let wasMissed = false;
  switch (props.callMode) {
    case CallMode.Direct:
      timestamp = props.acceptedTime || props.endedTime;
      wasMissed =
        props.wasIncoming && !props.acceptedTime && !props.wasDeclined;
      break;
    case CallMode.Group:
      hasButton = !props.ended;
      timestamp = props.startedTime;
      break;
    default:
      window.log.error(
        `CallingNotification missing case: ${missingCaseError(props)}`
      );
      return null;
  }

  const icon = getCallingIcon(props);

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
          className={classNames('SystemMessage', 'SystemMessage--multiline', {
            'SystemMessage--error': wasMissed,
          })}
          ref={measureRef}
        >
          <div className="SystemMessage__line">
            <div
              className={`SystemMessage__icon SystemMessage__icon--${icon}`}
            />
            <div>
              {getCallingNotificationText(props, i18n)} &middot;{' '}
              <Timestamp
                direction="outgoing"
                extended
                i18n={i18n}
                timestamp={timestamp}
                withImageNoCaption={false}
                withSticker={false}
                withTapToViewExpired={false}
              />
            </div>
          </div>
          {hasButton ? (
            <div className="SystemMessage__line">
              <CallingNotificationButton {...props} />
            </div>
          ) : null}
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
  let onClick: () => void;
  if (activeCallConversationId) {
    if (activeCallConversationId === conversationId) {
      buttonText = i18n('calling__return');
      onClick = returnToActiveCall;
    } else {
      buttonText = i18n('calling__join');
      disabledTooltipText = i18n(
        'calling__call-notification__button__in-another-call-tooltip'
      );
      onClick = noop;
    }
  } else if (deviceCount >= maxDevices) {
    buttonText = i18n('calling__call-is-full');
    disabledTooltipText = i18n(
      'calling__call-notification__button__call-full-tooltip',
      [String(deviceCount)]
    );
    onClick = noop;
  } else {
    buttonText = i18n('calling__join');
    onClick = () => {
      startCallingLobby({ conversationId, isVideoCall: true });
    };
  }

  const button = (
    <Button
      disabled={Boolean(disabledTooltipText)}
      onClick={onClick}
      size={ButtonSize.Small}
      variant={ButtonVariant.SystemMessage}
    >
      {buttonText}
    </Button>
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
