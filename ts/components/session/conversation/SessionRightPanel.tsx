import React from 'react';
import { SessionIconButton, SessionIconSize, SessionIconType } from '../icon';
import { Avatar, AvatarSize } from '../../Avatar';
import { SessionButton, SessionButtonColor, SessionButtonType } from '../SessionButton';
import { SessionDropdown } from '../SessionDropdown';
import { MediaGallery } from '../../conversation/media-gallery/MediaGallery';
import _ from 'lodash';
import { TimerOption } from '../../conversation/ConversationHeader';
import { Constants } from '../../../session';
import {
  ConversationAvatar,
  usingClosedConversationDetails,
} from '../usingClosedConversationDetails';
import { save } from '../../../types/Attachment';
import { DefaultTheme, withTheme } from 'styled-components';
import {
  getMessagesWithFileAttachments,
  getMessagesWithVisualMediaAttachments,
} from '../../../data/data';
import { getDecryptedMediaUrl } from '../../../session/crypto/DecryptedAttachmentsManager';

interface Props {
  id: string;
  name?: string;
  profileName?: string;
  phoneNumber: string;
  memberCount: number;
  description: string;
  avatarPath: string;
  timerOptions: Array<TimerOption>;
  isPublic: boolean;
  isAdmin: boolean;
  isKickedFromGroup: boolean;
  left: boolean;
  isBlocked: boolean;
  isGroup: boolean;
  memberAvatars?: Array<ConversationAvatar>; // this is added by usingClosedConversationDetails

  onGoBack: () => void;
  onInviteContacts: () => void;
  onLeaveGroup: () => void;
  onUpdateGroupName: () => void;
  onAddModerators: () => void;
  onRemoveModerators: () => void;
  onUpdateGroupMembers: () => void;
  onShowLightBox: (options: any) => void;
  onSetDisappearingMessages: (seconds: number) => void;
  theme: DefaultTheme;
}

interface State {
  documents: Array<any>;
  media: Array<any>;
  onItemClick: any;
}

class SessionRightPanel extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);

    this.state = {
      documents: Array<any>(),
      media: Array<any>(),
      onItemClick: undefined,
    };
  }

  public componentWillMount() {
    void this.getMediaGalleryProps().then(({ documents, media, onItemClick }) => {
      this.setState({
        documents,
        media,
        onItemClick,
      });
    });
  }

  public componentDidUpdate() {
    const mediaScanInterval = 1000;

    setTimeout(() => {
      void this.getMediaGalleryProps().then(({ documents, media, onItemClick }) => {
        const { documents: oldDocs, media: oldMedias } = this.state;
        if (oldDocs.length !== documents.length || oldMedias.length !== media.length) {
          this.setState({
            documents,
            media,
            onItemClick,
          });
        }
      });
    }, mediaScanInterval);
  }

  public async getMediaGalleryProps(): Promise<{
    documents: Array<any>;
    media: Array<any>;
    onItemClick: any;
  }> {
    // We fetch more documents than media as they don’t require to be loaded
    // into memory right away. Revisit this once we have infinite scrolling:
    const conversationId = this.props.id;
    const rawMedia = await getMessagesWithVisualMediaAttachments(conversationId, {
      limit: Constants.CONVERSATION.DEFAULT_MEDIA_FETCH_COUNT,
    });
    const rawDocuments = await getMessagesWithFileAttachments(conversationId, {
      limit: Constants.CONVERSATION.DEFAULT_DOCUMENTS_FETCH_COUNT,
    });

    // First we upgrade these messages to ensure that they have thumbnails
    const max = rawMedia.length;
    for (let i = 0; i < max; i += 1) {
      const message = rawMedia[i];
      const { schemaVersion } = message;

      if (schemaVersion < message.VERSION_NEEDED_FOR_DISPLAY) {
        // Yep, we really do want to wait for each of these
        // eslint-disable-next-line no-await-in-loop
        rawMedia[i] = await window.Signal.Migrations.upgradeMessageSchema(message);
        // eslint-disable-next-line no-await-in-loop
        await rawMedia[i].commit();
      }
    }

    const media = _.flatten(
      rawMedia.map((message: { attachments: any }) => {
        const { attachments } = message;

        return (attachments || [])
          .filter(
            (attachment: { thumbnail: any; pending: any; error: any }) =>
              attachment.thumbnail && !attachment.pending && !attachment.error
          )
          .map((attachment: { path?: any; contentType?: any; thumbnail?: any }, index: any) => {
            const { thumbnail } = attachment;

            return {
              objectURL: window.Signal.Migrations.getAbsoluteAttachmentPath(attachment.path),
              thumbnailObjectUrl: thumbnail
                ? window.Signal.Migrations.getAbsoluteAttachmentPath(thumbnail.path)
                : null,
              contentType: attachment.contentType,
              index,
              attachment,
              message,
            };
          });
      })
    );

    // Unlike visual media, only one non-image attachment is supported
    const documents = rawDocuments.map((message: { attachments: Array<any> }) => {
      // this is to not fail if the attachment is invalid (could be a Long Attachment type which is not supported)
      if (!message.attachments?.length) {
        // window.log.info(
        //   'Got a message with an empty list of attachment. Skipping...'
        // );
        return null;
      }
      const attachment = message.attachments[0];

      return {
        contentType: attachment.contentType,
        index: 0,
        attachment,
        message,
      };
    });

    const saveAttachment = async ({ attachment, message }: any = {}) => {
      const timestamp = message.received_at;
      attachment.url = await getDecryptedMediaUrl(attachment.url, attachment.contentType);
      save({
        attachment,
        document,
        getAbsolutePath: window.Signal.Migrations.getAbsoluteAttachmentPath,
        timestamp,
      });
    };

    const onItemClick = ({ message, attachment, type }: any) => {
      switch (type) {
        case 'documents': {
          void saveAttachment({ message, attachment });
          break;
        }

        case 'media': {
          const lightBoxOptions = {
            media,
            attachment,
            message,
          };
          this.onShowLightBox(lightBoxOptions);
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

  public onShowLightBox(options: any) {
    this.props.onShowLightBox(options);
  }

  // tslint:disable-next-line: cyclomatic-complexity
  public render() {
    const {
      memberCount,
      name,
      timerOptions,
      onLeaveGroup,
      isKickedFromGroup,
      left,
      isPublic,
      isAdmin,
      isBlocked,
      isGroup,
    } = this.props;
    const { documents, media, onItemClick } = this.state;
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

    const disappearingMessagesOptions = timerOptions.map(option => {
      return {
        content: option.name,
        onClick: () => {
          this.props.onSetDisappearingMessages(option.value);
        },
      };
    });

    const showUpdateGroupNameButton = isAdmin && !commonNoShow;
    const showAddRemoveModeratorsButton = isAdmin && !commonNoShow && isPublic;

    const showUpdateGroupMembersButton = !isPublic && !commonNoShow && isAdmin;

    return (
      <div className="group-settings">
        {this.renderHeader()}
        <h2>{name}</h2>
        {showMemberCount && (
          <>
            <div className="spacer-lg" />
            <div role="button" className="subtle">
              {window.i18n('members', memberCount)}
            </div>
            <div className="spacer-lg" />
          </>
        )}
        <input className="description" placeholder={window.i18n('description')} />
        {showUpdateGroupNameButton && (
          <div className="group-settings-item" role="button" onClick={this.props.onUpdateGroupName}>
            {isPublic ? window.i18n('editGroup') : window.i18n('editGroupName')}
          </div>
        )}
        {showAddRemoveModeratorsButton && (
          <>
            <div className="group-settings-item" role="button" onClick={this.props.onAddModerators}>
              {window.i18n('addModerators')}
            </div>
            <div
              className="group-settings-item"
              role="button"
              onClick={this.props.onRemoveModerators}
            >
              {window.i18n('removeModerators')}
            </div>
          </>
        )}

        {showUpdateGroupMembersButton && (
          <div
            className="group-settings-item"
            role="button"
            onClick={this.props.onUpdateGroupMembers}
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
          <SessionButton
            text={leaveGroupString}
            buttonColor={SessionButtonColor.Danger}
            disabled={isKickedFromGroup || left}
            buttonType={SessionButtonType.SquareOutline}
            onClick={onLeaveGroup}
          />
        )}
      </div>
    );
  }

  private renderHeader() {
    const {
      memberAvatars,
      id,
      onGoBack,
      onInviteContacts,
      avatarPath,
      isAdmin,
      isPublic,
      isKickedFromGroup,
      isBlocked,
      name,
      profileName,
      phoneNumber,
      left,
    } = this.props;

    const showInviteContacts = (isPublic || isAdmin) && !isKickedFromGroup && !isBlocked && !left;
    const userName = name || profileName || phoneNumber;

    return (
      <div className="group-settings-header">
        <SessionIconButton
          iconType={SessionIconType.Chevron}
          iconSize={SessionIconSize.Medium}
          iconRotation={270}
          onClick={onGoBack}
          theme={this.props.theme}
        />
        <Avatar
          avatarPath={avatarPath}
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
              onClick={onInviteContacts}
              theme={this.props.theme}
            />
          )}
        </div>
      </div>
    );
  }
}

export const SessionRightPanelWithDetails = usingClosedConversationDetails(
  withTheme(SessionRightPanel)
);
