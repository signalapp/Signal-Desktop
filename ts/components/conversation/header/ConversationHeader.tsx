import React from 'react';

import { ConversationNotificationSettingType } from '../../../models/conversationAttributes';
import {
  getSelectedConversationKey,
  isMessageDetailView,
  isMessageSelectionMode,
} from '../../../state/selectors/conversations';
import { useDispatch, useSelector } from 'react-redux';

import { closeMessageDetailsView, openRightPanel } from '../../../state/ducks/conversations';

import { ConversationHeaderMenu } from '../../menu/ConversationHeaderMenu';
import { Flex } from '../../basic/Flex';
import { ConversationHeaderTitle } from './ConversationHeaderTitle';
import { AvatarHeader, BackButton, CallButton, TripleDotsMenu } from './ConversationHeaderItems';
import { SelectionOverlay } from './ConversationHeaderSelectionOverlay';

export interface TimerOption {
  name: string;
  value: number;
}

export type ConversationHeaderProps = {
  conversationKey: string;
  name?: string;

  profileName?: string;
  avatarPath: string | null;

  isMe: boolean;
  isGroup: boolean;
  isPrivate: boolean;
  isPublic: boolean;
  weAreAdmin: boolean;

  // We might not always have the full list of members,
  // e.g. for open groups where we could have thousands
  // of members. We'll keep this for now (for closed chats)
  members: Array<any>;

  // not equal members.length (see above)
  subscriberCount?: number;

  expirationSettingName?: string;
  currentNotificationSetting: ConversationNotificationSettingType;
  hasNickname: boolean;

  isBlocked: boolean;

  isKickedFromGroup: boolean;
  left: boolean;
};

export const ConversationHeaderWithDetails = () => {
  const isSelectionMode = useSelector(isMessageSelectionMode);
  const isMessageDetailOpened = useSelector(isMessageDetailView);
  const selectedConvoKey = useSelector(getSelectedConversationKey);
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
