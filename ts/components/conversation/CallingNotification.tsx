// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React from 'react';
import { noop } from 'lodash';
import { ContextMenuTrigger } from 'react-contextmenu';

import { SystemMessage, SystemMessageKind } from './SystemMessage';
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
import {
  CallDirection,
  CallType,
  DirectCallStatus,
  GroupCallStatus,
} from '../../types/CallDisposition';
import {
  type ContextMenuTriggerType,
  MessageContextMenu,
  useHandleMessageContextMenu,
} from './MessageContextMenu';
import type { DeleteMessagesPropsType } from '../../state/ducks/globalModals';
import {
  useKeyboardShortcutsConditionally,
  useOpenContextMenu,
} from '../../hooks/useKeyboardShortcuts';

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
    const menuTriggerRef = React.useRef<ContextMenuTriggerType | null>(null);
    const handleContextMenu = useHandleMessageContextMenu(menuTriggerRef);
    const openContextMenuKeyboard = useOpenContextMenu(handleContextMenu);
    useKeyboardShortcutsConditionally(
      !props.isSelectMode && props.isTargeted,
      openContextMenuKeyboard
    );
    const { i18n } = props;
    if (props.callHistory == null) {
      return null;
    }

    const { type, direction, status, timestamp } = props.callHistory;
    const icon = getCallingIcon(type, direction, status);
    return (
      <>
        <div
          onContextMenu={handleContextMenu}
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
              status === GroupCallStatus.Missed
                ? SystemMessageKind.Danger
                : SystemMessageKind.Normal
            }
          />
        </div>
        <ContextMenuTrigger
          id={props.id}
          ref={ref => {
            // react-contextmenu's typings are incorrect here
            menuTriggerRef.current = ref as unknown as ContextMenuTriggerType;
          }}
        />
        <MessageContextMenu
          i18n={i18n}
          triggerId={props.id}
          onDeleteMessage={() => {
            props.toggleDeleteMessagesModal({
              conversationId: props.conversationId,
              messageIds: [props.id],
            });
          }}
          shouldShowAdditional={false}
          onDownload={undefined}
          onEdit={undefined}
          onReplyToMessage={undefined}
          onReact={undefined}
          onRetryMessageSend={undefined}
          onRetryDeleteForEveryone={undefined}
          onCopy={undefined}
          onSelect={undefined}
          onForward={undefined}
          onMoreInfo={undefined}
        />
      </>
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

  if (props.callHistory == null) {
    return null;
  }

  switch (props.callHistory.mode) {
    case CallMode.Direct: {
      const { direction, type } = props.callHistory;
      if (props.callHistory.status === DirectCallStatus.Pending) {
        return null;
      }
      buttonText =
        direction === CallDirection.Incoming
          ? i18n('icu:calling__call-back')
          : i18n('icu:calling__call-again');
      if (props.activeConversationId != null) {
        disabledTooltipText = i18n('icu:calling__in-another-call-tooltip');
        onClick = noop;
      } else {
        onClick = () => {
          if (type === CallType.Video) {
            onOutgoingVideoCallInConversation(conversationId);
          } else {
            onOutgoingAudioCallInConversation(conversationId);
          }
        };
      }
      break;
    }
    case CallMode.Group: {
      if (props.groupCallEnded) {
        return null;
      }
      if (props.activeConversationId != null) {
        if (props.activeConversationId === conversationId) {
          buttonText = i18n('icu:calling__return');
          onClick = returnToActiveCall;
        } else {
          buttonText = i18n('icu:calling__join');
          disabledTooltipText = i18n('icu:calling__in-another-call-tooltip');
          onClick = noop;
        }
      } else if (props.deviceCount > props.maxDevices) {
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
    default:
      log.error(missingCaseError(props.callHistory.mode));
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
