import React from 'react';

import { useDispatch, useSelector } from 'react-redux';
import {
  isMessageDetailView,
  isMessageSelectionMode,
} from '../../../state/selectors/conversations';

import { closeMessageDetailsView, openRightPanel } from '../../../state/ducks/conversations';

import { useSelectedConversationKey } from '../../../state/selectors/selectedConversation';
import { Flex } from '../../basic/Flex';
import { AvatarHeader, BackButton, CallButton } from './ConversationHeaderItems';
import { SelectionOverlay } from './ConversationHeaderSelectionOverlay';
import { ConversationHeaderTitle } from './ConversationHeaderTitle';

export const ConversationHeaderWithDetails = () => {
  const isSelectionMode = useSelector(isMessageSelectionMode);
  // TODO remove I think?
  const isMessageDetailOpened = useSelector(isMessageDetailView);
  const selectedConvoKey = useSelectedConversationKey();
  const dispatch = useDispatch();

  if (!selectedConvoKey) {
    return null;
  }

  return (
    <div className="module-conversation-header">
      <Flex
        container={true}
        justifyContent={isMessageDetailOpened ? 'space-between' : 'flex-end'}
        alignItems="center"
        width="100%"
        flexGrow={1}
      >
        {/* TODO do we remove */}
        <BackButton
          onGoBack={() => {
            dispatch(closeMessageDetailsView());
          }}
          showBackButton={isMessageDetailOpened}
        />
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
      </Flex>

      {isSelectionMode && <SelectionOverlay />}
    </div>
  );
};
