import React from 'react';
import { SessionIconButton, SessionIconSize, SessionIconType } from './icon';
import { Avatar } from '../Avatar';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from './SessionButton';
import { MediaGallery } from '../conversation/media-gallery/MediaGallery';
import _ from 'lodash';

interface Props {
  id: string;
  name: string;
  memberCount: number;
  description: string;
  avatarPath: string;

  onGoBack: () => void;
  onInviteFriends: () => void;
  onLeaveGroup: () => void;
  onShowLightBox: (options: any) => void;
}

export class SessionChannelSettings extends React.Component<Props, any> {
  public constructor(props: Props) {
    super(props);

    this.state = {
      documents: Array<any>(),
      media: Array<any>(),
      onItemClick: undefined,
    };
  }

  public componentWillMount() {
    this.getMediaGalleryProps()
      .then(({ documents, media, onItemClick }) => {
        this.setState({
          documents,
          media,
          onItemClick,
        });
      })
      .ignore();
  }

  public async getMediaGalleryProps() {
    // We fetch more documents than media as they don’t require to be loaded
    // into memory right away. Revisit this once we have infinite scrolling:
    const DEFAULT_MEDIA_FETCH_COUNT = 50;
    const DEFAULT_DOCUMENTS_FETCH_COUNT = 150;
    const conversationId = this.props.id;
    const rawMedia = await window.Signal.Data.getMessagesWithVisualMediaAttachments(
      conversationId,
      {
        limit: DEFAULT_MEDIA_FETCH_COUNT,
        MessageCollection: window.Whisper.MessageCollection,
      }
    );
    const rawDocuments = await window.Signal.Data.getMessagesWithFileAttachments(
      conversationId,
      {
        limit: DEFAULT_DOCUMENTS_FETCH_COUNT,
        MessageCollection: window.Whisper.MessageCollection,
      }
    );

    // First we upgrade these messages to ensure that they have thumbnails
    const max = rawMedia.length;
    for (let i = 0; i < max; i += 1) {
      const message = rawMedia[i];
      const { schemaVersion } = message;

      if (schemaVersion < message.VERSION_NEEDED_FOR_DISPLAY) {
        // Yep, we really do want to wait for each of these
        // eslint-disable-next-line no-await-in-loop
        rawMedia[i] = await window.Signal.Migrations.upgradeMessageSchema(
          message
        );
        // eslint-disable-next-line no-await-in-loop
        await window.Signal.Data.saveMessage(rawMedia[i], {
          Message: window.Whisper.Message,
        });
      }
    }

    // tslint:disable-next-line: underscore-consistent-invocation
    const media = _.flatten(
      rawMedia.map((message: { attachments: any }) => {
        const { attachments } = message;

        return (attachments || [])
          .filter(
            (attachment: { thumbnail: any; pending: any; error: any }) =>
              attachment.thumbnail && !attachment.pending && !attachment.error
          )
          .map(
            (
              attachment: { path?: any; contentType?: any; thumbnail?: any },
              index: any
            ) => {
              const { thumbnail } = attachment;

              return {
                objectURL: window.Signal.Migrations.getAbsoluteAttachmentPath(
                  attachment.path
                ),
                thumbnailObjectUrl: thumbnail
                  ? window.Signal.Migrations.getAbsoluteAttachmentPath(
                      thumbnail.path
                    )
                  : null,
                contentType: attachment.contentType,
                index,
                attachment,
                message,
              };
            }
          );
      })
    );

    // Unlike visual media, only one non-image attachment is supported
    const documents = rawDocuments.map(
      (message: { attachments: Array<any> }) => {
        const attachments = message.attachments || [];
        const attachment = attachments[0];

        return {
          contentType: attachment.contentType,
          index: 0,
          attachment,
          message,
        };
      }
    );

    const saveAttachment = async ({ attachment, message }: any = {}) => {
      const timestamp = message.received_at;
      window.Signal.Types.Attachment.save({
        attachment,
        document,
        getAbsolutePath: window.Signal.Migrations.getAbsoluteAttachmentPath,
        timestamp,
      });
    };

    const onItemClick = async ({ message, attachment, type }: any) => {
      switch (type) {
        case 'documents': {
          saveAttachment({ message, attachment }).ignore();
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
      documents,
      onItemClick,
    };
  }

  public onShowLightBox(options: any) {
    this.props.onShowLightBox(options);
  }

  public render() {
    const { memberCount, name, onLeaveGroup } = this.props;
    const { documents, media, onItemClick } = this.state;

    return (
      <div className="group-settings">
        {this.renderHeader()}
        <h2>{name}</h2>
        {memberCount && (
          <div className="text-subtle">
            {window.i18n('members', memberCount)}
          </div>
        )}
        <input
          className="description"
          placeholder={window.i18n('description')}
        />

        <div className="group-settings-item">
          {window.i18n('notifications')}
        </div>
        <div className="group-settings-item">
          {window.i18n('disappearingMessages')}
        </div>
        <MediaGallery
          documents={documents}
          media={media}
          onItemClick={onItemClick}
        />
        <SessionButton
          text={window.i18n('leaveGroup')}
          buttonColor={SessionButtonColor.Danger}
          buttonType={SessionButtonType.SquareOutline}
          onClick={onLeaveGroup}
        />
      </div>
    );
  }

  private renderHeader() {
    const { id, onGoBack, onInviteFriends, avatarPath } = this.props;

    return (
      <div className="group-settings-header">
        <SessionIconButton
          iconType={SessionIconType.Chevron}
          iconSize={SessionIconSize.Medium}
          iconRotation={90}
          onClick={onGoBack}
        />
        <Avatar
          avatarPath={avatarPath}
          phoneNumber={id}
          conversationType="group"
          size={80}
        />
        <SessionIconButton
          iconType={SessionIconType.AddUser}
          iconSize={SessionIconSize.Medium}
          onClick={onInviteFriends}
        />
      </div>
    );
  }
}
