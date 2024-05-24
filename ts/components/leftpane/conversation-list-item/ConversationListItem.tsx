import classNames from 'classnames';
import { isNil } from 'lodash';
import { MouseEvent, ReactNode, useCallback } from 'react';
import { contextMenu } from 'react-contexify';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';

import { CSSProperties } from 'styled-components';
import { Avatar, AvatarSize } from '../../avatar/Avatar';

import { openConversationWithMessages } from '../../../state/ducks/conversations';
import { updateUserDetailsModal } from '../../../state/ducks/modalDialog';

import {
  ContextConversationProvider,
  useConvoIdFromContext,
} from '../../../contexts/ConvoIdContext';
import {
  useAvatarPath,
  useConversationUsername,
  useHasUnread,
  useIsBlocked,
  useIsPrivate,
  useMentionedUs,
} from '../../../hooks/useParamSelector';
import { isSearching } from '../../../state/selectors/search';
import { useSelectedConversationKey } from '../../../state/selectors/selectedConversation';
import { SpacerXS } from '../../basic/Text';
import { MemoConversationListItemContextMenu } from '../../menu/ConversationListItemContextMenu';
import { ConversationListItemHeaderItem } from './HeaderItem';
import { MessageItem } from './MessageItem';

const Portal = ({ children }: { children: ReactNode }) => {
  return createPortal(children, document.querySelector('.inbox.index') as Element);
};

const AvatarItem = () => {
  const conversationId = useConvoIdFromContext();
  const userName = useConversationUsername(conversationId);
  const isPrivate = useIsPrivate(conversationId);
  const avatarPath = useAvatarPath(conversationId);
  const dispatch = useDispatch();

  function onPrivateAvatarClick() {
    dispatch(
      updateUserDetailsModal({
        conversationId,
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
type Props = { conversationId: string; style?: CSSProperties };

export const ConversationListItem = (props: Props) => {
  const { conversationId, style } = props;
  const key = `conversation-item-${conversationId}`;

  const hasUnread = useHasUnread(conversationId);

  let hasUnreadMentionedUs = useMentionedUs(conversationId);
  let isBlocked = useIsBlocked(conversationId);
  const isSearch = useSelector(isSearching);
  const selectedConvo = useSelectedConversationKey();

  const isSelectedConvo = conversationId === selectedConvo && !isNil(selectedConvo);

  if (isSearch) {
    // force isBlocked and hasUnreadMentionedUs to be false, we just want to display the row without any special style when showing search results
    hasUnreadMentionedUs = false;
    isBlocked = false;
  }

  const triggerId = `${key}-ctxmenu`;

  const openConvo = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      // mousedown is invoked sooner than onClick, but for both right and left click
      if (e.button === 0) {
        void openConversationWithMessages({ conversationKey: conversationId, messageId: null });
      }
    },
    [conversationId]
  );

  return (
    <ContextConversationProvider value={conversationId}>
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
            {!isSearch ? (
              <>
                <SpacerXS />
                <MessageItem />
              </>
            ) : null}
          </div>
        </div>
        <Portal>
          <MemoConversationListItemContextMenu triggerId={triggerId} />
        </Portal>
      </div>
    </ContextConversationProvider>
  );
};
