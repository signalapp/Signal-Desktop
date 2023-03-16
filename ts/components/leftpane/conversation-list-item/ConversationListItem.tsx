import classNames from 'classnames';
import React, { useCallback, useContext } from 'react';
import { contextMenu } from 'react-contexify';

import { Avatar, AvatarSize } from '../../avatar/Avatar';

import { createPortal } from 'react-dom';
import { useDispatch } from 'react-redux';
import {
  openConversationWithMessages,
  ReduxConversationType,
} from '../../../state/ducks/conversations';
import { updateUserDetailsModal } from '../../../state/ducks/modalDialog';

import _ from 'lodash';
import { useSelector } from 'react-redux';
import {
  useAvatarPath,
  useConversationUsername,
  useHasUnread,
  useIsBlocked,
  useIsPrivate,
  useIsSelectedConversation,
  useMentionedUs,
} from '../../../hooks/useParamSelector';
import { isSearching } from '../../../state/selectors/search';
import { MemoConversationListItemContextMenu } from '../../menu/ConversationListItemContextMenu';
import { ConversationListItemHeaderItem } from './HeaderItem';
import { MessageItem } from './MessageItem';

// tslint:disable-next-line: no-empty-interface
export type ConversationListItemProps = Pick<ReduxConversationType, 'id'>;

/**
 * This React context is used to share deeply in the tree of the ConversationListItem what is the ID we are currently rendering.
 * This is to avoid passing the prop to all the subtree component
 */
export const ContextConversationId = React.createContext('');

type PropsHousekeeping = {
  style?: Object;
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
    <div>
      <Avatar
        size={AvatarSize.S}
        pubkey={conversationId}
        onAvatarClick={isPrivate ? onPrivateAvatarClick : undefined}
      />
    </div>
  );
};

const ConversationListItem = (props: Props) => {
  const { id: conversationId, style } = props;
  const key = `conversation-item-${conversationId}`;

  const hasUnread = useHasUnread(conversationId);

  let hasUnreadMentionedUs = useMentionedUs(conversationId);
  let isBlocked = useIsBlocked(conversationId);
  const isSearch = useSelector(isSearching);
  const isSelectedConvo = useIsSelectedConversation(conversationId);

  if (isSearch) {
    // force isBlocked and hasUnreadMentionedUs to be false, we just want to display the row without any special style when showing search results
    hasUnreadMentionedUs = false;
    isBlocked = false;
  }

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
            hasUnread ? 'module-conversation-list-item--has-unread' : null,
            hasUnreadMentionedUs ? 'module-conversation-list-item--mentioned-us' : null,
            isSelectedConvo ? 'module-conversation-list-item--is-selected' : null,
            isBlocked ? 'module-conversation-list-item--is-blocked' : null
          )}
        >
          <AvatarItem />
          <div className="module-conversation-list-item__content">
            <ConversationListItemHeaderItem />
            <MessageItem />
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
