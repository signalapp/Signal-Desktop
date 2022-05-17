import React, { useEffect, useState } from 'react';
import { SessionIconButton } from '../icon';
import _ from 'lodash';
// tslint:disable-next-line: no-submodule-imports
import useInterval from 'react-use/lib/useInterval';
import { useDispatch, useSelector } from 'react-redux';
import {
  getMessagesWithFileAttachments,
  getMessagesWithVisualMediaAttachments,
} from '../../data/data';
import {
  deleteAllMessagesByConvoIdWithConfirmation,
  setDisappearingMessagesByConvoId,
  showAddModeratorsByConvoId,
  showInviteContactByConvoId,
  showLeaveGroupByConvoId,
  showRemoveModeratorsByConvoId,
  showUpdateGroupMembersByConvoId,
  showUpdateGroupNameByConvoId,
} from '../../interactions/conversationInteractions';
import { Constants } from '../../session';
import { closeRightPanel } from '../../state/ducks/conversations';
import { getSelectedConversation, isRightPanelShowing } from '../../state/selectors/conversations';
import { getTimerOptions } from '../../state/selectors/timerOptions';
import { AttachmentTypeWithPath } from '../../types/Attachment';
import { Avatar, AvatarSize } from '../avatar/Avatar';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../basic/SessionButton';
import { SessionDropdown } from '../basic/SessionDropdown';
import { SpacerLG } from '../basic/Text';
import { MediaItemType } from '../lightbox/LightboxGallery';
import { MediaGallery } from './media-gallery/MediaGallery';
import { getAbsoluteAttachmentPath } from '../../types/MessageAttachment';

async function getMediaGalleryProps(
  conversationId: string
): Promise<{
  documents: Array<MediaItemType>;
  media: Array<MediaItemType>;
}> {
  // We fetch more documents than media as they don’t require to be loaded
  // into memory right away. Revisit this once we have infinite scrolling:
  const rawMedia = await getMessagesWithVisualMediaAttachments(
    conversationId,
    Constants.CONVERSATION.DEFAULT_MEDIA_FETCH_COUNT
  );
  const rawDocuments = await getMessagesWithFileAttachments(
    conversationId,
    Constants.CONVERSATION.DEFAULT_DOCUMENTS_FETCH_COUNT
  );

  const media = _.flatten(
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
    documents: _.compact(documents), // remove null
  };
}

const HeaderItem = () => {
  const selectedConversation = useSelector(getSelectedConversation);
  const dispatch = useDispatch();

  if (!selectedConversation) {
    return null;
  }
  const { id, isGroup, isKickedFromGroup, isBlocked, left } = selectedConversation;

  const showInviteContacts = isGroup && !isKickedFromGroup && !isBlocked && !left;

  return (
    <div className="group-settings-header">
      <SessionIconButton
        iconType="chevron"
        iconSize="medium"
        iconRotation={270}
        onClick={() => {
          dispatch(closeRightPanel());
        }}
        dataTestId="back-button-conversation-options"
      />
      <Avatar size={AvatarSize.XL} pubkey={id} />
      <div className="invite-friends-container">
        {showInviteContacts && (
          <SessionIconButton
            iconType="addUser"
            iconSize="medium"
            onClick={() => {
              if (selectedConversation) {
                showInviteContactByConvoId(selectedConversation.id);
              }
            }}
            dataTestId="add-user-button"
          />
        )}
      </div>
    </div>
  );
};

// tslint:disable: cyclomatic-complexity
// tslint:disable: max-func-body-length
export const SessionRightPanelWithDetails = () => {
  const [documents, setDocuments] = useState<Array<MediaItemType>>([]);
  const [media, setMedia] = useState<Array<MediaItemType>>([]);

  const selectedConversation = useSelector(getSelectedConversation);
  const isShowing = useSelector(isRightPanelShowing);

  useEffect(() => {
    let isRunning = true;

    if (isShowing && selectedConversation) {
      void getMediaGalleryProps(selectedConversation.id).then(results => {
        if (isRunning) {
          if (!_.isEqual(documents, results.documents)) {
            setDocuments(results.documents);
          }

          if (!_.isEqual(media, results.media)) {
            setMedia(results.media);
          }
        }
      });
    }

    return () => {
      isRunning = false;
      return;
    };
  }, [isShowing, selectedConversation?.id]);

  useInterval(async () => {
    if (isShowing && selectedConversation) {
      const results = await getMediaGalleryProps(selectedConversation.id);
      if (results.documents.length !== documents.length || results.media.length !== media.length) {
        setDocuments(results.documents);
        setMedia(results.media);
      }
    }
  }, 10000);

  if (!selectedConversation) {
    return null;
  }

  const {
    id,
    subscriberCount,
    name,
    isKickedFromGroup,
    left,
    isPublic,
    weAreAdmin,
    isBlocked,
    isGroup,
  } = selectedConversation;
  const showMemberCount = !!(subscriberCount && subscriberCount > 0);
  const commonNoShow = isKickedFromGroup || left || isBlocked;
  const hasDisappearingMessages = !isPublic && !commonNoShow;
  const leaveGroupString = isPublic
    ? window.i18n('leaveGroup')
    : isKickedFromGroup
    ? window.i18n('youGotKickedFromGroup')
    : left
    ? window.i18n('youLeftTheGroup')
    : window.i18n('leaveGroup');

  const timerOptions = useSelector(getTimerOptions).timerOptions;

  const disappearingMessagesOptions = timerOptions.map(option => {
    return {
      content: option.name,
      onClick: () => {
        void setDisappearingMessagesByConvoId(id, option.value);
      },
    };
  });

  const showUpdateGroupNameButton =
    isGroup && (!isPublic || (isPublic && weAreAdmin)) && !commonNoShow;
  const showAddRemoveModeratorsButton = weAreAdmin && !commonNoShow && isPublic;
  const showUpdateGroupMembersButton = !isPublic && isGroup && !commonNoShow;

  const deleteConvoAction = isPublic
    ? () => {
        deleteAllMessagesByConvoIdWithConfirmation(id);
      }
    : () => {
        showLeaveGroupByConvoId(id);
      };
  return (
    <div className="group-settings">
      <HeaderItem />
      <h2 data-testid="right-panel-group-name">{name}</h2>
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
        <div
          className="group-settings-item"
          role="button"
          onClick={async () => {
            await showUpdateGroupNameByConvoId(id);
          }}
        >
          {isPublic ? window.i18n('editGroup') : window.i18n('editGroupName')}
        </div>
      )}
      {showAddRemoveModeratorsButton && (
        <>
          <div
            className="group-settings-item"
            role="button"
            onClick={() => {
              showAddModeratorsByConvoId(id);
            }}
          >
            {window.i18n('addModerators')}
          </div>
          <div
            className="group-settings-item"
            role="button"
            onClick={() => {
              showRemoveModeratorsByConvoId(id);
            }}
          >
            {window.i18n('removeModerators')}
          </div>
        </>
      )}

      {showUpdateGroupMembersButton && (
        <div
          className="group-settings-item"
          role="button"
          onClick={async () => {
            await showUpdateGroupMembersByConvoId(id);
          }}
        >
          {window.i18n('groupMembers')}
        </div>
      )}

      {hasDisappearingMessages && (
        <SessionDropdown
          label={window.i18n('disappearingMessages')}
          options={disappearingMessagesOptions}
        />
      )}

      <MediaGallery documents={documents} media={media} />
      {isGroup && (
        // tslint:disable-next-line: use-simple-attributes
        <SessionButton
          text={leaveGroupString}
          buttonColor={SessionButtonColor.Danger}
          disabled={isKickedFromGroup || left}
          buttonType={SessionButtonType.SquareOutline}
          onClick={deleteConvoAction}
        />
      )}
    </div>
  );
};
