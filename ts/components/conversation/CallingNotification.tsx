// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';
import { noop } from 'lodash';

import { SystemMessage } from './SystemMessage';
import { Button, ButtonSize, ButtonVariant } from '../Button';
import { MessageTimestamp } from './MessageTimestamp';
import type { LocalizerType } from '../../types/Util';
import { CallMode } from '../../types/Calling';
import type { CallingNotificationType } from '../../util/callingNotification';
import {
  getCallingIcon,
  getCallingNotificationText,
} from '../../util/callingNotification';
import { missingCaseError } from '../../util/missingCaseError';
import { Tooltip, TooltipPlacement } from '../Tooltip';
import * as log from '../../logging/log';

export type PropsActionsType = {
  returnToActiveCall: () => void;
  startCallingLobby: (_: {
    conversationId: string;
    isVideoCall: boolean;
  }) => void;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  conversationId: string;
  isNextItemCallingNotification: boolean;
};

type PropsType = CallingNotificationType & PropsActionsType & PropsHousekeeping;

export const CallingNotification: React.FC<PropsType> = React.memo(props => {
  const { i18n } = props;

  let timestamp: number;
  let wasMissed = false;
  switch (props.callMode) {
    case CallMode.Direct:
      timestamp = props.acceptedTime || props.endedTime;
      wasMissed =
        props.wasIncoming && !props.acceptedTime && !props.wasDeclined;
      break;
    case CallMode.Group:
      timestamp = props.startedTime;
      break;
    default:
      log.error(`CallingNotification missing case: ${missingCaseError(props)}`);
      return null;
  }

  const icon = getCallingIcon(props);

  return (
    <SystemMessage
      button={renderCallingNotificationButton(props)}
      contents={
        <>
          {getCallingNotificationText(props, i18n)} &middot;{' '}
          <MessageTimestamp
            direction="outgoing"
            i18n={i18n}
            timestamp={timestamp}
            withImageNoCaption={false}
            withSticker={false}
            withTapToViewExpired={false}
          />
        </>
      }
      icon={icon}
      isError={wasMissed}
    />
  );
});

function renderCallingNotificationButton(
  props: Readonly<PropsType>
): ReactNode {
  const {
    activeCallConversationId,
    conversationId,
    i18n,
    isNextItemCallingNotification,
    returnToActiveCall,
    startCallingLobby,
  } = props;

  if (isNextItemCallingNotification) {
    return null;
  }

  let buttonText: string;
  let disabledTooltipText: undefined | string;
  let onClick: () => void;

  switch (props.callMode) {
    case CallMode.Direct: {
      const { wasIncoming, wasVideoCall } = props;
      buttonText = wasIncoming
        ? i18n('calling__call-back')
        : i18n('calling__call-again');
      if (activeCallConversationId) {
        disabledTooltipText = i18n('calling__in-another-call-tooltip');
        onClick = noop;
      } else {
        onClick = () => {
          startCallingLobby({ conversationId, isVideoCall: wasVideoCall });
        };
      }
      break;
    }
    case CallMode.Group: {
      if (props.ended) {
        return null;
      }
      const { deviceCount, maxDevices } = props;
      if (activeCallConversationId) {
        if (activeCallConversationId === conversationId) {
          buttonText = i18n('calling__return');
          onClick = returnToActiveCall;
        } else {
          buttonText = i18n('calling__join');
          disabledTooltipText = i18n('calling__in-another-call-tooltip');
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
      break;
    }
    default:
      log.error(missingCaseError(props));
      return null;
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
