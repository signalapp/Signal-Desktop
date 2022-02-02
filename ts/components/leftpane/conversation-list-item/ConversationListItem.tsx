import React, { useCallback, useContext } from 'react';
import classNames from 'classnames';
import { contextMenu } from 'react-contexify';

import { Avatar, AvatarSize } from '../../avatar/Avatar';

import { createPortal } from 'react-dom';
import {
  openConversationWithMessages,
  ReduxConversationType,
} from '../../../state/ducks/conversations';
import { useDispatch } from 'react-redux';
import { updateUserDetailsModal } from '../../../state/ducks/modalDialog';

import {
  useAvatarPath,
  useConversationUsername,
  useIsPrivate,
} from '../../../hooks/useParamSelector';
import { MemoConversationListItemContextMenu } from '../../menu/ConversationListItemContextMenu';
import { ConversationListItemHeaderItem } from './HeaderItem';
import { MessageItem } from './MessageItem';
import _ from 'lodash';

// tslint:disable-next-line: no-empty-interface
export type ConversationListItemProps = Pick<
  ReduxConversationType,
  'id' | 'isSelected' | 'isBlocked' | 'mentionedUs' | 'unreadCount' | 'profileName'
>;

/**
 * This React context is used to share deeply in the tree of the ConversationListItem what is the ID we are currently rendering.
 * This is to avoid passing the prop to all the subtree component
 */
export const ContextConversationId = React.createContext('');

type PropsHousekeeping = {
  style?: Object;
  isMessageRequest?: boolean;
};
// tslint:disable: use-simple-attributes

type Props = ConversationListItemProps & PropsHousekeeping;

const Portal = ({ children }: { children: any }) => {
  return createPortal(children, document.querySelector('.inbox.index') as Element);
};

const AvatarItem = () => {
  const conversationId = useContext(ContextConversationId);
  const userName = useConversationUsername(conversationId);
  const isPrivate = useIsPrivate(conversationId);
  const avatarPath = useAvatarPath(conversationId);
  const dispatch = useDispatch();

  function onPrivateAvatarClick() {
    dispatch(
      updateUserDetailsModal({
        conversationId: conversationId,
        userName: userName || '',
        authorAvatarPath: avatarPath,
      })
    );
  }

  return (
    <div className="module-conversation-list-item__avatar-container">
      <Avatar
        size={AvatarSize.S}
        pubkey={conversationId}
        onAvatarClick={isPrivate ? onPrivateAvatarClick : undefined}
      />
    </div>
  );
};

// tslint:disable: max-func-body-length
const ConversationListItem = (props: Props) => {
  const {
    unreadCount,
    id: conversationId,
    isSelected,
    isBlocked,
    style,
    mentionedUs,
    isMessageRequest,
  } = props;
  const key = `conversation-item-${conversationId}`;

  const triggerId = `${key}-ctxmenu`;

  const openConvo = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      // mousedown is invoked sooner than onClick, but for both right and left click
      if (e.button === 0) {
        await openConversationWithMessages({ conversationKey: conversationId, messageId: null });
      }
    },
    [conversationId]
  );

  return (
    <ContextConversationId.Provider value={conversationId}>
      <div key={key}>
        <div
          role="button"
          onMouseDown={openConvo}
          onMouseUp={e => {
            e.stopPropagation();
            e.preventDefault();
          }}
          onContextMenu={e => {
            contextMenu.show({
              id: triggerId,
              event: e,
            });
          }}
          style={style}
          className={classNames(
            'module-conversation-list-item',
            unreadCount && unreadCount > 0 ? 'module-conversation-list-item--has-unread' : null,
            unreadCount && unreadCount > 0 && mentionedUs
              ? 'module-conversation-list-item--mentioned-us'
              : null,
            isSelected ? 'module-conversation-list-item--is-selected' : null,
            isBlocked ? 'module-conversation-list-item--is-blocked' : null
          )}
        >
          <AvatarItem />
          <div className="module-conversation-list-item__content">
            <ConversationListItemHeaderItem />
            <MessageItem isMessageRequest={Boolean(isMessageRequest)} />
          </div>
        </div>
        <Portal>
          <MemoConversationListItemContextMenu triggerId={triggerId} />
        </Portal>
      </div>
    </ContextConversationId.Provider>
  );
};

export const MemoConversationListItemWithDetails = React.memo(ConversationListItem, _.isEqual);
