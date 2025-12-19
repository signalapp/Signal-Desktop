// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';
import lodash from 'lodash';

import { SystemMessage, SystemMessageKind } from './SystemMessage.dom.js';
import { Button, ButtonSize, ButtonVariant } from '../Button.dom.js';
import { MessageTimestamp } from './MessageTimestamp.dom.js';
import type { LocalizerType } from '../../types/Util.std.js';
import {
  CallMode,
  CallDirection,
  CallType,
  DirectCallStatus,
  GroupCallStatus,
} from '../../types/CallDisposition.std.js';
import type { CallingNotificationType } from '../../util/callingNotification.std.js';
import {
  getCallingIcon,
  getCallingNotificationText,
} from '../../util/callingNotification.std.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import { Tooltip, TooltipPlacement } from '../Tooltip.dom.js';
import { createLogger } from '../../logging/log.std.js';
import { MessageContextMenu } from './MessageContextMenu.dom.js';
import type { DeleteMessagesPropsType } from '../../state/ducks/globalModals.preload.js';
import { MINUTE } from '../../util/durations/index.std.js';
import { isMoreRecentThan } from '../../util/timestamp.std.js';
import { InAnotherCallTooltip } from './InAnotherCallTooltip.dom.js';

const { noop } = lodash;

const log = createLogger('CallingNotification');

export type PropsActionsType = {
  onOutgoingAudioCallInConversation: (conversationId: string) => void;
  onOutgoingVideoCallInConversation: (conversationId: string) => void;
  returnToActiveCall: () => void;
  toggleDeleteMessagesModal: (props: DeleteMessagesPropsType) => void;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
  id: string;
  conversationId: string;
  isNextItemCallingNotification: boolean;
};

export type PropsType = CallingNotificationType &
  PropsActionsType &
  PropsHousekeeping;

export const CallingNotification: React.FC<PropsType> = React.memo(
  function CallingNotificationInner(props) {
    const { i18n } = props;
    if (props.callHistory == null) {
      return null;
    }

    const { type, direction, status, timestamp } = props.callHistory;
    const icon = getCallingIcon(type, direction, status);
    return (
      <MessageContextMenu
        renderer="AxoContextMenu"
        disabled={props.isSelectMode}
        i18n={i18n}
        onDeleteMessage={() => {
          props.toggleDeleteMessagesModal({
            conversationId: props.conversationId,
            messageIds: [props.id],
          });
        }}
        shouldShowAdditional={false}
        onDownload={null}
        onEdit={null}
        onReplyToMessage={null}
        onReact={null}
        onEndPoll={null}
        onRetryMessageSend={null}
        onRetryDeleteForEveryone={null}
        onCopy={null}
        onSelect={null}
        onForward={null}
        onMoreInfo={null}
        onPinMessage={null}
        onUnpinMessage={null}
      >
        <div
          // @ts-expect-error -- React/TS doesn't know about inert
          // eslint-disable-next-line react/no-unknown-property
          inert={props.isSelectMode ? '' : undefined}
        >
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
            kind={
              status === DirectCallStatus.Missed ||
              status === GroupCallStatus.Missed ||
              status === DirectCallStatus.Declined ||
              status === GroupCallStatus.Declined
                ? SystemMessageKind.Danger
                : SystemMessageKind.Normal
            }
          />
        </div>
      </MessageContextMenu>
    );
  }
);

function renderCallingNotificationButton(
  props: Readonly<PropsType>
): ReactNode {
  const {
    conversationId,
    i18n,
    isNextItemCallingNotification,
    onOutgoingAudioCallInConversation,
    onOutgoingVideoCallInConversation,
    returnToActiveCall,
  } = props;

  if (isNextItemCallingNotification) {
    return null;
  }

  let buttonText: string;
  let disabledTooltipText: undefined | string;
  let onClick: () => void;

  const inThisCall = Boolean(
    props.activeConversationId &&
    props.activeConversationId === props.conversationId
  );

  if (props.callHistory == null) {
    return null;
  }

  switch (props.callHistory.mode) {
    case CallMode.Direct: {
      const { direction, type } = props.callHistory;
      if (props.callHistory.status === DirectCallStatus.Pending || inThisCall) {
        return null;
      }
      buttonText =
        direction === CallDirection.Incoming
          ? i18n('icu:calling__call-back')
          : i18n('icu:calling__call-again');
      onClick = () => {
        if (type === CallType.Video) {
          onOutgoingVideoCallInConversation(conversationId);
        } else {
          onOutgoingAudioCallInConversation(conversationId);
        }
      };
      break;
    }
    case CallMode.Group: {
      if (props.groupCallEnded) {
        const { direction, status, timestamp } = props.callHistory;
        if (
          (direction === CallDirection.Incoming &&
            (status === GroupCallStatus.Declined ||
              status === GroupCallStatus.Missed)) ||
          isMoreRecentThan(timestamp, 5 * MINUTE)
        ) {
          buttonText = i18n('icu:calling__call-back');
          onClick = () => {
            onOutgoingVideoCallInConversation(conversationId);
          };
        } else {
          return null;
        }
      } else if (props.activeConversationId != null) {
        if (inThisCall) {
          buttonText = i18n('icu:calling__return');
          onClick = returnToActiveCall;
        } else {
          buttonText = i18n('icu:calling__join');
          onClick = () => {
            onOutgoingVideoCallInConversation(conversationId);
          };
        }
      } else if (props.deviceCount >= props.maxDevices) {
        buttonText = i18n('icu:calling__call-is-full');
        disabledTooltipText = i18n(
          'icu:calling__call-notification__button__call-full-tooltip',
          {
            max: props.maxDevices,
          }
        );
        onClick = noop;
      } else {
        buttonText = i18n('icu:calling__join');
        onClick = () => {
          onOutgoingVideoCallInConversation(conversationId);
        };
      }
      break;
    }
    case CallMode.Adhoc:
      log.warn('for adhoc call, should never happen');
      return null;
    default:
      throw missingCaseError(props.callHistory.mode);
  }

  const disabled = Boolean(disabledTooltipText);
  const inAnotherCall = Boolean(
    !disabled &&
    props.activeConversationId &&
    props.activeConversationId !== props.conversationId
  );
  const button = (
    <Button
      disabled={disabled}
      discouraged={inAnotherCall}
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
  if (inAnotherCall) {
    return <InAnotherCallTooltip i18n={i18n}>{button}</InAnotherCallTooltip>;
  }

  return button;
}
