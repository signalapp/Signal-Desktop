import { compact, flatten, isEqual } from 'lodash';
import React, { useEffect, useState } from 'react';

import { useDispatch } from 'react-redux';
import useInterval from 'react-use/lib/useInterval';
import styled from 'styled-components';
import { Data } from '../../../../data/data';
import { SessionIconButton } from '../../../icon';

import { useIsRightPanelShowing } from '../../../../hooks/useUI';
import {
  deleteAllMessagesByConvoIdWithConfirmation,
  showAddModeratorsByConvoId,
  showInviteContactByConvoId,
  showLeaveGroupByConvoId,
  showRemoveModeratorsByConvoId,
  showUpdateGroupMembersByConvoId,
  showUpdateGroupNameByConvoId,
} from '../../../../interactions/conversationInteractions';
import { Constants } from '../../../../session';
import { closeRightPanel } from '../../../../state/ducks/conversations';
import { setRightOverlayMode } from '../../../../state/ducks/section';
import {
  useSelectedConversationKey,
  useSelectedDisplayNameInProfile,
  useSelectedIsActive,
  useSelectedIsBlocked,
  useSelectedIsGroup,
  useSelectedIsKickedFromGroup,
  useSelectedIsLeft,
  useSelectedIsPublic,
  useSelectedSubscriberCount,
  useSelectedWeAreAdmin,
} from '../../../../state/selectors/selectedConversation';
import { AttachmentTypeWithPath } from '../../../../types/Attachment';
import { getAbsoluteAttachmentPath } from '../../../../types/MessageAttachment';
import { Avatar, AvatarSize } from '../../../avatar/Avatar';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../../../basic/SessionButton';
import { SpacerLG } from '../../../basic/Text';
import { PanelButtonGroup, PanelIconButton } from '../../../buttons';
import { MediaItemType } from '../../../lightbox/LightboxGallery';
import { MediaGallery } from '../../media-gallery/MediaGallery';

async function getMediaGalleryProps(
  conversationId: string
): Promise<{
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
  const dispatch = useDispatch();
  const isBlocked = useSelectedIsBlocked();
  const isKickedFromGroup = useSelectedIsKickedFromGroup();
  const left = useSelectedIsLeft();
  const isGroup = useSelectedIsGroup();

  if (!selectedConvoKey) {
    return null;
  }

  const showInviteContacts = isGroup && !isKickedFromGroup && !isBlocked && !left;

  return (
    <div className="right-panel-header">
      <SessionIconButton
        iconType="chevron"
        iconSize="medium"
        iconRotation={270}
        onClick={() => {
          dispatch(closeRightPanel());
        }}
        style={{ position: 'absolute' }}
        dataTestId="back-button-conversation-options"
      />
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
          dataTestId="add-user-button"
        />
      )}
    </div>
  );
};

const StyledLeaveButton = styled.div`
  width: 100%;
  .session-button {
    margin-top: auto;
    width: 100%;
    min-height: calc(var(--composition-container-height) + 1px); // include border in height
    flex-shrink: 0;
    align-items: center;
    border-top: 1px solid var(--border-color);
    border-radius: 0px;

    &:not(.disabled) {
      &:hover {
        background-color: var(--button-solid-background-hover-color);
      }
    }
  }
`;

const StyledGroupSettingsItem = styled.div`
  display: flex;
  align-items: center;
  min-height: 3rem;
  font-size: var(--font-size-md);
  color: var(--right-panel-item-text-color);
  background-color: var(--right-panel-item-background-color);
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);

  width: -webkit-fill-available;
  padding: 0 var(--margins-md);
  transition: var(--default-duration);
  cursor: pointer;

  &:hover {
    background-color: var(--right-panel-item-background-hover-color);
  }
`;

const StyledName = styled.h4`
  padding-inline: var(--margins-md);
  font-size: var(--font-size-md);
`;

export const OverlayRightPanelSettings = () => {
  const [documents, setDocuments] = useState<Array<MediaItemType>>([]);
  const [media, setMedia] = useState<Array<MediaItemType>>([]);

  const selectedConvoKey = useSelectedConversationKey();
  const dispatch = useDispatch();
  const isShowing = useIsRightPanelShowing();
  const subscriberCount = useSelectedSubscriberCount();

  const isActive = useSelectedIsActive();
  const displayNameInProfile = useSelectedDisplayNameInProfile();
  const isBlocked = useSelectedIsBlocked();
  const isKickedFromGroup = useSelectedIsKickedFromGroup();
  const left = useSelectedIsLeft();
  const isGroup = useSelectedIsGroup();
  const isPublic = useSelectedIsPublic();
  const weAreAdmin = useSelectedWeAreAdmin();

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

  const showMemberCount = !!(subscriberCount && subscriberCount > 0);
  const commonNoShow = isKickedFromGroup || left || isBlocked || !isActive;
  const hasDisappearingMessages = !isPublic && !commonNoShow;
  const leaveGroupString = isPublic
    ? window.i18n('leaveGroup')
    : isKickedFromGroup
    ? window.i18n('youGotKickedFromGroup')
    : left
    ? window.i18n('youLeftTheGroup')
    : window.i18n('leaveGroup');

  const showUpdateGroupNameButton = isGroup && weAreAdmin && !commonNoShow; // legacy groups non-admin cannot change groupname anymore
  const showAddRemoveModeratorsButton = weAreAdmin && !commonNoShow && isPublic;
  const showUpdateGroupMembersButton = !isPublic && isGroup && !commonNoShow;

  const deleteConvoAction = isPublic
    ? () => {
        deleteAllMessagesByConvoIdWithConfirmation(selectedConvoKey); // TODOLATER this does not delete the public group and showLeaveGroupByConvoId is not only working for closed groups
      }
    : () => {
        showLeaveGroupByConvoId(selectedConvoKey);
      };

  return (
    <>
      <HeaderItem />
      <StyledName data-testid="right-panel-group-name">{displayNameInProfile}</StyledName>
      {showMemberCount && (
        <>
          <SpacerLG />
          <div role="button" className="subtle">
            {window.i18n('members', [`${subscriberCount}`])}
          </div>
          <SpacerLG />
        </>
      )}

      {showUpdateGroupNameButton && (
        <StyledGroupSettingsItem
          className="right-panel-item"
          role="button"
          onClick={() => {
            void showUpdateGroupNameByConvoId(selectedConvoKey);
          }}
        >
          {isPublic ? window.i18n('editGroup') : window.i18n('editGroupName')}
        </StyledGroupSettingsItem>
      )}
      {showAddRemoveModeratorsButton && (
        <>
          <StyledGroupSettingsItem
            className="right-panel-item"
            role="button"
            onClick={() => {
              showAddModeratorsByConvoId(selectedConvoKey);
            }}
          >
            {window.i18n('addModerators')}
          </StyledGroupSettingsItem>
          <StyledGroupSettingsItem
            className="right-panel-item"
            role="button"
            onClick={() => {
              showRemoveModeratorsByConvoId(selectedConvoKey);
            }}
          >
            {window.i18n('removeModerators')}
          </StyledGroupSettingsItem>
        </>
      )}

      {showUpdateGroupMembersButton && (
        <StyledGroupSettingsItem
          className="right-panel-item"
          role="button"
          onClick={() => {
            void showUpdateGroupMembersByConvoId(selectedConvoKey);
          }}
        >
          {window.i18n('groupMembers')}
        </StyledGroupSettingsItem>
      )}
      <SpacerLG />
      <SpacerLG />

      {hasDisappearingMessages && (
        /* TODO Move ButtonGroup around all settings items */
        <PanelButtonGroup>
          <PanelIconButton
            iconType={'timer50'}
            text={window.i18n('disappearingMessages')}
            dataTestId="disappearing-messages"
            onClick={() => {
              dispatch(setRightOverlayMode('disappearing-messages'));
            }}
          />
        </PanelButtonGroup>
      )}

      <MediaGallery documents={documents} media={media} />
      {isGroup && (
        <StyledLeaveButton>
          <SessionButton
            text={leaveGroupString}
            buttonColor={SessionButtonColor.Danger}
            buttonType={SessionButtonType.Simple}
            disabled={isKickedFromGroup || left}
            onClick={deleteConvoAction}
          />
        </StyledLeaveButton>
      )}
    </>
  );
};
