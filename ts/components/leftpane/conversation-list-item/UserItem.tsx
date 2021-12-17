import React, { useContext } from 'react';
import { useConversationUsername, useIsMe } from '../../../hooks/useParamSelector';
import { PubKey } from '../../../session/types';
import { ContactName } from '../../conversation/ContactName';
import { ContextConversationId } from './ConversationListItem';

export const UserItem = () => {
  const conversationId = useContext(ContextConversationId);

  const shortenedPubkey = PubKey.shorten(conversationId);
  const isMe = useIsMe(conversationId);
  const username = useConversationUsername(conversationId);

  const displayedPubkey = username ? shortenedPubkey : conversationId;
  const displayName = isMe ? window.i18n('noteToSelf') : username;

  let shouldShowPubkey = false;
  if ((!username || username.length === 0) && (!displayName || displayName.length === 0)) {
    shouldShowPubkey = true;
  }

  return (
    <div className="module-conversation__user">
      <ContactName
        pubkey={displayedPubkey}
        name={username}
        profileName={displayName}
        module="module-conversation__user"
        boldProfileName={true}
        shouldShowPubkey={shouldShowPubkey}
      />
    </div>
  );
};
