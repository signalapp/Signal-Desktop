import { compact, flatten, isEqual } from 'lodash';
import React, { useEffect, useState } from 'react';

import { useDispatch } from 'react-redux';
import useInterval from 'react-use/lib/useInterval';
import styled from 'styled-components';
import { Data } from '../../../../data/data';
import { SessionIconButton } from '../../../icon';

import {
  useConversationUsername,
  useDisappearingMessageSettingText,
} from '../../../../hooks/useParamSelector';
import { useIsRightPanelShowing } from '../../../../hooks/useUI';
import {
  ConversationInteractionStatus,
  ConversationInteractionType,
  showAddModeratorsByConvoId,
  showInviteContactByConvoId,
  showLeaveGroupByConvoId,
  showRemoveModeratorsByConvoId,
  showUpdateGroupMembersByConvoId,
  showUpdateGroupNameByConvoId,
} from '../../../../interactions/conversationInteractions';
import { Constants } from '../../../../session';
import { closeRightPanel } from '../../../../state/ducks/conversations';
import { resetRightOverlayMode, setRightOverlayMode } from '../../../../state/ducks/section';
import {
  useSelectedConversationKey,
  useSelectedDisplayNameInProfile,
  useSelectedIsActive,
  useSelectedIsBlocked,
  useSelectedIsGroupOrCommunity,
  useSelectedIsKickedFromGroup,
  useSelectedIsLeft,
  useSelectedIsPublic,
  useSelectedLastMessage,
  useSelectedSubscriberCount,
  useSelectedWeAreAdmin,
} from '../../../../state/selectors/selectedConversation';
import { AttachmentTypeWithPath } from '../../../../types/Attachment';
import { getAbsoluteAttachmentPath } from '../../../../types/MessageAttachment';
import { Avatar, AvatarSize } from '../../../avatar/Avatar';
import { Flex } from '../../../basic/Flex';
import { SpacerLG, SpacerMD, SpacerXL } from '../../../basic/Text';
import { PanelButtonGroup, PanelIconButton } from '../../../buttons';
import { MediaItemType } from '../../../lightbox/LightboxGallery';
import { MediaGallery } from '../../media-gallery/MediaGallery';
import { Header, StyledScrollContainer } from './components';

async function getMediaGalleryProps(conversationId: string): Promise<{
  documents: Array<MediaItemType>;
  media: Array<MediaItemType>;
}> {
  // We fetch more documents than media as they don’t require to be loaded
  // into memory right away. Revisit this once we have infinite scrolling:
  const rawMedia = await Data.getMessagesWithVisualMediaAttachments(
    conversationId,
    Constants.CONVERSATION.DEFAULT_MEDIA_FETCH_COUNT
  );
  const rawDocuments = await Data.getMessagesWithFileAttachments(
    conversationId,
    Constants.CONVERSATION.DEFAULT_DOCUMENTS_FETCH_COUNT
  );

  const media = flatten(
    rawMedia.map(attributes => {
      const { attachments, source, id, timestamp, serverTimestamp, received_at } = attributes;

      return (attachments || [])
        .filter(
          (attachment: AttachmentTypeWithPath) =>
            attachment.thumbnail && !attachment.pending && !attachment.error
        )
        .map((attachment: AttachmentTypeWithPath, index: number) => {
          const { thumbnail } = attachment;

          const mediaItem: MediaItemType = {
            objectURL: getAbsoluteAttachmentPath(attachment.path),
            thumbnailObjectUrl: thumbnail ? getAbsoluteAttachmentPath(thumbnail.path) : undefined,
            contentType: attachment.contentType || '',
            index,
            messageTimestamp: timestamp || serverTimestamp || received_at || 0,
            messageSender: source,
            messageId: id,
            attachment,
          };

          return mediaItem;
        });
    })
  );

  // Unlike visual media, only one non-image attachment is supported
  const documents = rawDocuments.map(attributes => {
    // this is to not fail if the attachment is invalid (could be a Long Attachment type which is not supported)
    if (!attributes.attachments?.length) {
      // window?.log?.info(
      //   'Got a message with an empty list of attachment. Skipping...'
      // );
      return null;
    }
    const attachment = attributes.attachments[0];
    const { source, id, timestamp, serverTimestamp, received_at } = attributes;

    return {
      contentType: attachment.contentType,
      index: 0,
      attachment,
      messageTimestamp: timestamp || serverTimestamp || received_at || 0,
      messageSender: source,
      messageId: id,
    };
  });

  return {
    media,
    documents: compact(documents), // remove null
  };
}

const HeaderItem = () => {
  const selectedConvoKey = useSelectedConversationKey();
  const displayNameInProfile = useSelectedDisplayNameInProfile();
  const dispatch = useDispatch();
  const isBlocked = useSelectedIsBlocked();
  const isKickedFromGroup = useSelectedIsKickedFromGroup();
  const left = useSelectedIsLeft();
  const isGroup = useSelectedIsGroupOrCommunity();
  const subscriberCount = useSelectedSubscriberCount();

  if (!selectedConvoKey) {
    return null;
  }

  const showInviteContacts = isGroup && !isKickedFromGroup && !isBlocked && !left;
  const showMemberCount = !!(subscriberCount && subscriberCount > 0);

  return (
    <Header
      backButtonDirection="right"
      backButtonOnClick={() => {
        dispatch(closeRightPanel());
        dispatch(resetRightOverlayMode());
      }}
      hideCloseButton={true}
    >
      <Flex
        container={true}
        justifyContent={'center'}
        alignItems={'center'}
        width={'100%'}
        style={{ position: 'relative' }}
      >
        <Avatar size={AvatarSize.XL} pubkey={selectedConvoKey} />
        {showInviteContacts && (
          <SessionIconButton
            iconType="addUser"
            iconSize="medium"
            onClick={() => {
              if (selectedConvoKey) {
                showInviteContactByConvoId(selectedConvoKey);
              }
            }}
            style={{ position: 'absolute', right: '0px', top: '4px' }}
            dataTestId="add-user-button"
          />
        )}
      </Flex>
      <StyledName data-testid="right-panel-group-name">{displayNameInProfile}</StyledName>
      {showMemberCount && (
        <Flex container={true} flexDirection={'column'}>
          <div role="button" className="subtle">
            {window.i18n('members', [`${subscriberCount}`])}
          </div>
          <SpacerMD />
        </Flex>
      )}
    </Header>
  );
};

const StyledName = styled.h4`
  padding-inline: var(--margins-md);
  font-size: var(--font-size-md);
`;

export const OverlayRightPanelSettings = () => {
  const [documents, setDocuments] = useState<Array<MediaItemType>>([]);
  const [media, setMedia] = useState<Array<MediaItemType>>([]);

  const selectedConvoKey = useSelectedConversationKey();
  const selectedUsername = useConversationUsername(selectedConvoKey) || selectedConvoKey;
  const isShowing = useIsRightPanelShowing();

  const dispatch = useDispatch();

  const isActive = useSelectedIsActive();
  const isBlocked = useSelectedIsBlocked();
  const isKickedFromGroup = useSelectedIsKickedFromGroup();
  const left = useSelectedIsLeft();
  const isGroup = useSelectedIsGroupOrCommunity();
  const isPublic = useSelectedIsPublic();
  const weAreAdmin = useSelectedWeAreAdmin();
  const disappearingMessagesSubtitle = useDisappearingMessageSettingText({
    convoId: selectedConvoKey,
    separator: ': ',
  });
  const lastMessage = useSelectedLastMessage();

  useEffect(() => {
    let isCancelled = false;

    const loadDocumentsOrMedia = async () => {
      try {
        if (isShowing && selectedConvoKey) {
          const results = await getMediaGalleryProps(selectedConvoKey);

          if (!isCancelled) {
            if (!isEqual(documents, results.documents)) {
              setDocuments(results.documents);
            }

            if (!isEqual(media, results.media)) {
              setMedia(results.media);
            }
          }
        }
      } catch (error) {
        if (!isCancelled) {
          window.log.debug(`OverlayRightPanelSettings loadDocumentsOrMedia: ${error}`);
        }
      }
    };

    void loadDocumentsOrMedia();

    return () => {
      isCancelled = true;
    };
  }, [documents, isShowing, media, selectedConvoKey]);

  useInterval(async () => {
    if (isShowing && selectedConvoKey) {
      const results = await getMediaGalleryProps(selectedConvoKey);
      if (results.documents.length !== documents.length || results.media.length !== media.length) {
        setDocuments(results.documents);
        setMedia(results.media);
      }
    }
  }, 10000);

  if (!selectedConvoKey) {
    return null;
  }

  const commonNoShow = isKickedFromGroup || left || isBlocked || !isActive;
  const hasDisappearingMessages = !isPublic && !commonNoShow;
  const leaveGroupString = isPublic
    ? window.i18n('leaveCommunity')
    : lastMessage?.interactionType === ConversationInteractionType.Leave &&
        lastMessage?.interactionStatus === ConversationInteractionStatus.Error
      ? window.i18n('deleteConversation')
      : isKickedFromGroup
        ? window.i18n('youGotKickedFromGroup')
        : left
          ? window.i18n('youLeftTheGroup')
          : window.i18n('leaveGroup');

  const showUpdateGroupNameButton = isGroup && weAreAdmin && !commonNoShow; // legacy groups non-admin cannot change groupname anymore
  const showAddRemoveModeratorsButton = weAreAdmin && !commonNoShow && isPublic;
  const showUpdateGroupMembersButton = !isPublic && isGroup && !commonNoShow;

  const deleteConvoAction = async () => {
    await showLeaveGroupByConvoId(selectedConvoKey, selectedUsername);
  };

  return (
    <StyledScrollContainer>
      <Flex container={true} flexDirection={'column'} alignItems={'center'}>
        <HeaderItem />
        <PanelButtonGroup style={{ margin: '0 var(--margins-lg)' }}>
          {showUpdateGroupNameButton && (
            <PanelIconButton
              iconType={'group'}
              text={isPublic ? window.i18n('editGroup') : window.i18n('editGroupName')}
              onClick={() => {
                void showUpdateGroupNameByConvoId(selectedConvoKey);
              }}
              dataTestId="edit-group-name"
            />
          )}

          {showAddRemoveModeratorsButton && (
            <>
              <PanelIconButton
                iconType={'addModerator'}
                text={window.i18n('addModerators')}
                onClick={() => {
                  showAddModeratorsByConvoId(selectedConvoKey);
                }}
                dataTestId="add-moderators"
              />

              <PanelIconButton
                iconType={'deleteModerator'}
                text={window.i18n('removeModerators')}
                onClick={() => {
                  showRemoveModeratorsByConvoId(selectedConvoKey);
                }}
                dataTestId="remove-moderators"
              />
            </>
          )}

          {showUpdateGroupMembersButton && (
            <PanelIconButton
              iconType={'group'}
              text={window.i18n('groupMembers')}
              onClick={() => {
                void showUpdateGroupMembersByConvoId(selectedConvoKey);
              }}
              dataTestId="group-members"
            />
          )}

          {hasDisappearingMessages && (
            <PanelIconButton
              iconType={'timer50'}
              text={window.i18n('disappearingMessages')}
              subtitle={disappearingMessagesSubtitle}
              dataTestId="disappearing-messages"
              onClick={() => {
                dispatch(setRightOverlayMode({ type: 'disappearing_messages', params: null }));
              }}
            />
          )}

          <MediaGallery documents={documents} media={media} />
          {isGroup && (
            <PanelIconButton
              text={leaveGroupString}
              dataTestId="leave-group-button"
              disabled={isKickedFromGroup || left}
              onClick={() => void deleteConvoAction()}
              color={'var(--danger-color)'}
              iconType={'delete'}
            />
          )}
        </PanelButtonGroup>
        <SpacerLG />
        <SpacerXL />
      </Flex>
    </StyledScrollContainer>
  );
};
