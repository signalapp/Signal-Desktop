import React, { useEffect, useState } from 'react';
import { SessionIconButton, SessionIconSize, SessionIconType } from '../icon';
import { Avatar, AvatarSize } from '../../Avatar';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../SessionButton';
import { SessionDropdown } from '../SessionDropdown';
import { MediaGallery } from '../../conversation/media-gallery/MediaGallery';
import _, { noop } from 'lodash';
import { TimerOption } from '../../conversation/ConversationHeader';
import { Constants } from '../../../session';
import {
  ConversationAvatar,
  usingClosedConversationDetails,
} from '../usingClosedConversationDetails';
import { AttachmentTypeWithPath, save } from '../../../types/Attachment';
import { DefaultTheme, useTheme, withTheme } from 'styled-components';
import {
  getMessagesWithFileAttachments,
  getMessagesWithVisualMediaAttachments,
} from '../../../data/data';
import { getDecryptedMediaUrl } from '../../../session/crypto/DecryptedAttachmentsManager';
import { LightBoxOptions } from './SessionConversation';
import { UserUtils } from '../../../session/utils';
import { sendDataExtractionNotification } from '../../../session/messages/outgoing/controlMessage/DataExtractionNotificationMessage';
import { SpacerLG } from '../../basic/Text';
import {
  deleteMessagesByConvoIdWithConfirmation,
  setDisappearingMessagesByConvoId,
  showAddModeratorsByConvoId,
  showInviteContactByConvoId,
  showLeaveGroupByConvoId,
  showRemoveModeratorsByConvoId,
  showUpdateGroupMembersByConvoId,
  showUpdateGroupNameByConvoId,
} from '../../../interactions/conversationInteractions';
import { ItemClickEvent } from '../../conversation/media-gallery/types/ItemClickEvent';
import { MediaItemType } from '../../LightboxGallery';
// tslint:disable-next-line: no-submodule-imports
import useInterval from 'react-use/lib/useInterval';
import { useSelector } from 'react-redux';
import { getTimerOptions } from '../../../state/selectors/timerOptions';

type Props = {
  id: string;
  name?: string;
  profileName?: string;
  phoneNumber: string;
  memberCount: number;
  avatarPath: string | null;
  isPublic: boolean;
  isAdmin: boolean;
  isKickedFromGroup: boolean;
  left: boolean;
  isBlocked: boolean;
  isShowing: boolean;
  isGroup: boolean;
  memberAvatars?: Array<ConversationAvatar>; // this is added by usingClosedConversationDetails

  onGoBack: () => void;
  onShowLightBox: (lightboxOptions?: LightBoxOptions) => void;
};

async function getMediaGalleryProps(
  conversationId: string,
  medias: Array<MediaItemType>,
  onShowLightBox: (lightboxOptions?: LightBoxOptions) => void
): Promise<{
  documents: Array<MediaItemType>;
  media: Array<MediaItemType>;
  onItemClick: any;
}> {
  // We fetch more documents than media as they don’t require to be loaded
  // into memory right away. Revisit this once we have infinite scrolling:
  const rawMedia = await getMessagesWithVisualMediaAttachments(conversationId, {
    limit: Constants.CONVERSATION.DEFAULT_MEDIA_FETCH_COUNT,
  });
  const rawDocuments = await getMessagesWithFileAttachments(conversationId, {
    limit: Constants.CONVERSATION.DEFAULT_DOCUMENTS_FETCH_COUNT,
  });

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
            objectURL: window.Signal.Migrations.getAbsoluteAttachmentPath(attachment.path),
            thumbnailObjectUrl: thumbnail
              ? window.Signal.Migrations.getAbsoluteAttachmentPath(thumbnail.path)
              : null,
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

  const saveAttachment = async ({
    attachment,
    messageTimestamp,
    messageSender,
  }: {
    attachment: AttachmentTypeWithPath;
    messageTimestamp: number;
    messageSender: string;
  }) => {
    const timestamp = messageTimestamp;
    attachment.url = await getDecryptedMediaUrl(attachment.url, attachment.contentType);
    save({
      attachment,
      document,
      getAbsolutePath: window.Signal.Migrations.getAbsoluteAttachmentPath,
      timestamp,
    });
    await sendDataExtractionNotification(conversationId, messageSender, timestamp);
  };

  const onItemClick = (event: ItemClickEvent) => {
    if (!event) {
      console.warn('no event');
      return;
    }
    const { mediaItem, type } = event;
    switch (type) {
      case 'documents': {
        void saveAttachment({
          messageSender: mediaItem.messageSender,
          messageTimestamp: mediaItem.messageTimestamp,
          attachment: mediaItem.attachment,
        });
        break;
      }

      case 'media': {
        const lightBoxOptions: LightBoxOptions = {
          media: medias,
          attachment: mediaItem.attachment,
        };

        onShowLightBox(lightBoxOptions);
        break;
      }

      default:
        throw new TypeError(`Unknown attachment type: '${type}'`);
    }
  };

  return {
    media,
    documents: _.compact(documents), // remove null
    onItemClick,
  };
}

// tslint:disable: cyclomatic-complexity
// tslint:disable: max-func-body-length
export const SessionRightPanelWithDetails = (props: Props) => {
  const [documents, setDocuments] = useState<Array<MediaItemType>>([]);
  const [media, setMedia] = useState<Array<MediaItemType>>([]);
  const [onItemClick, setOnItemClick] = useState<any>(undefined);
  const theme = useTheme();

  console.warn('props', props);

  useEffect(() => {
    let isRunning = true;

    if (props.isShowing) {
      void getMediaGalleryProps(props.id, media, props.onShowLightBox).then(results => {
        console.warn('results2', results);

        if (isRunning) {
          setDocuments(results.documents);
          setMedia(results.media);
          setOnItemClick(results.onItemClick);
        }
      });
    }

    return () => {
      isRunning = false;
      return;
    };
  }, [props.isShowing, props.id]);

  useInterval(async () => {
    if (props.isShowing) {
      const results = await getMediaGalleryProps(props.id, media, props.onShowLightBox);
      console.warn('results', results);
      if (results.documents.length !== documents.length || results.media.length !== media.length) {
        setDocuments(results.documents);
        setMedia(results.media);
        setOnItemClick(results.onItemClick);
      }
    }
  }, 10000);

  function renderHeader() {
    const { memberAvatars, onGoBack, avatarPath, profileName, phoneNumber } = props;

    const showInviteContacts = (isPublic || isAdmin) && !isKickedFromGroup && !isBlocked && !left;
    const userName = name || profileName || phoneNumber;

    return (
      <div className="group-settings-header">
        <SessionIconButton
          iconType={SessionIconType.Chevron}
          iconSize={SessionIconSize.Medium}
          iconRotation={270}
          onClick={onGoBack}
          theme={theme}
        />
        <Avatar
          avatarPath={avatarPath || ''}
          name={userName}
          size={AvatarSize.XL}
          memberAvatars={memberAvatars}
          pubkey={id}
        />
        <div className="invite-friends-container">
          {showInviteContacts && (
            <SessionIconButton
              iconType={SessionIconType.AddUser}
              iconSize={SessionIconSize.Medium}
              onClick={() => {
                showInviteContactByConvoId(props.id);
              }}
              theme={theme}
            />
          )}
        </div>
      </div>
    );
  }

  const {
    id,
    memberCount,
    name,
    isKickedFromGroup,
    left,
    isPublic,
    isAdmin,
    isBlocked,
    isGroup,
  } = props;
  const showMemberCount = !!(memberCount && memberCount > 0);
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
      onClick: async () => {
        await setDisappearingMessagesByConvoId(id, option.value);
      },
    };
  });

  const showUpdateGroupNameButton = isAdmin && !commonNoShow;
  const showAddRemoveModeratorsButton = isAdmin && !commonNoShow && isPublic;

  const showUpdateGroupMembersButton = !isPublic && isGroup && !commonNoShow;

  const deleteConvoAction = isPublic
    ? () => {
        deleteMessagesByConvoIdWithConfirmation(id);
      }
    : () => {
        showLeaveGroupByConvoId(id);
      };
  console.warn('onItemClick', onItemClick);
  return (
    <div className="group-settings">
      {renderHeader()}
      <h2>{name}</h2>
      {showMemberCount && (
        <>
          <SpacerLG />
          <div role="button" className="subtle">
            {window.i18n('members', memberCount)}
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

      <MediaGallery documents={documents} media={media} onItemClick={onItemClick} />
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
