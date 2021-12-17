import React from 'react';
import classNames from 'classnames';
import { PropsForGroupInvitation } from '../../../../state/ducks/conversations';
import { acceptOpenGroupInvitation } from '../../../../interactions/messageInteractions';
import { SessionIconButton } from '../../../icon';
import { ReadableMessage } from './ReadableMessage';

export const GroupInvitation = (props: PropsForGroupInvitation) => {
  const { messageId, receivedAt, isUnread } = props;
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
              iconType="plus"
              iconColor={'var(--color-accent)'}
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
