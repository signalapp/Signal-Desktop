import React from 'react';
import classNames from 'classnames';
import { SessionIconButton, SessionIconType } from '../session/icon';
import { useTheme } from 'styled-components';
import { PropsForGroupInvitation } from '../../state/ducks/conversations';
import { acceptOpenGroupInvitation } from '../../interactions/messageInteractions';
import { ReadableMessage } from './ReadableMessage';

export const GroupInvitation = (props: PropsForGroupInvitation) => {
  const { messageId, receivedAt, isUnread } = props;
  const theme = useTheme();
  const classes = ['group-invitation'];

  if (props.direction === 'outgoing') {
    classes.push('invitation-outgoing');
  }
  const openGroupInvitation = window.i18n('openGroupInvitation');

  return (
    <ReadableMessage
      messageId={messageId}
      receivedAt={receivedAt}
      isUnread={isUnread}
      key={`readable-message-${messageId}`}
    >
      <div className="group-invitation-container" id={`msg-${props.messageId}`}>
        <div className={classNames(classes)}>
          <div className="contents">
            <SessionIconButton
              iconType={SessionIconType.Plus}
              iconColor={theme.colors.accent}
              theme={theme}
              iconSize={'large'}
              onClick={() => {
                acceptOpenGroupInvitation(props.acceptUrl, props.serverName);
              }}
            />
            <span className="group-details">
              <span className="group-name">{props.serverName}</span>
              <span className="group-type">{openGroupInvitation}</span>
              <span className="group-address">{props.url}</span>
            </span>
          </div>
        </div>
      </div>
    </ReadableMessage>
  );
};
