import React from 'react';

import { useDispatch, useSelector } from 'react-redux';
import {
  isMessageDetailView,
  isMessageSelectionMode,
} from '../../../state/selectors/conversations';

import { closeMessageDetailsView, openRightPanel } from '../../../state/ducks/conversations';

import { useSelectedConversationKey } from '../../../state/selectors/selectedConversation';
import { Flex } from '../../basic/Flex';
import { ConversationHeaderMenu } from '../../menu/ConversationHeaderMenu';
import { AvatarHeader, BackButton, CallButton, TripleDotsMenu } from './ConversationHeaderItems';
import { SelectionOverlay } from './ConversationHeaderSelectionOverlay';
import { ConversationHeaderTitle } from './ConversationHeaderTitle';

export const ConversationHeaderWithDetails = () => {
  const isSelectionMode = useSelector(isMessageSelectionMode);
  const isMessageDetailOpened = useSelector(isMessageDetailView);
  const selectedConvoKey = useSelectedConversationKey();
  const dispatch = useDispatch();

  if (!selectedConvoKey) {
    return null;
  }

  const triggerId = 'conversation-header';

  return (
    <div className="module-conversation-header">
      <div className="conversation-header--items-wrapper">
        <BackButton
          onGoBack={() => {
            dispatch(closeMessageDetailsView());
          }}
          showBackButton={isMessageDetailOpened}
        />
        <TripleDotsMenu triggerId={triggerId} showBackButton={isMessageDetailOpened} />
        <ConversationHeaderTitle />

        {!isSelectionMode && (
          <Flex
            container={true}
            flexDirection="row"
            alignItems="center"
            flexGrow={0}
            flexShrink={0}
          >
            <CallButton />
            <AvatarHeader
              onAvatarClick={() => {
                dispatch(openRightPanel());
              }}
              pubkey={selectedConvoKey}
              showBackButton={isMessageDetailOpened}
            />
          </Flex>
        )}

        <ConversationHeaderMenu triggerId={triggerId} />
      </div>

      {isSelectionMode && <SelectionOverlay />}
    </div>
  );
};
