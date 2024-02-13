import { useDispatch, useSelector } from 'react-redux';
import { isMessageSelectionMode } from '../../../state/selectors/conversations';

import { openRightPanel } from '../../../state/ducks/conversations';

import { useSelectedConversationKey } from '../../../state/selectors/selectedConversation';
import { Flex } from '../../basic/Flex';
import { AvatarHeader, CallButton } from './ConversationHeaderItems';
import { SelectionOverlay } from './ConversationHeaderSelectionOverlay';
import { ConversationHeaderTitle } from './ConversationHeaderTitle';

export const ConversationHeaderWithDetails = () => {
  const isSelectionMode = useSelector(isMessageSelectionMode);
  const selectedConvoKey = useSelectedConversationKey();
  const dispatch = useDispatch();

  if (!selectedConvoKey) {
    return null;
  }

  return (
    <div className="module-conversation-header">
      <Flex
        container={true}
        justifyContent={'flex-end'}
        alignItems="center"
        width="100%"
        flexGrow={1}
      >
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
            />
          </Flex>
        )}
      </Flex>

      {isSelectionMode && <SelectionOverlay />}
    </div>
  );
};
