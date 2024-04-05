import _ from 'lodash';
import React from 'react';

import autoBind from 'auto-bind';
import { blobToArrayBuffer } from 'blob-util';
import loadImage from 'blueimp-load-image';
import classNames from 'classnames';
import styled from 'styled-components';
import {
  CompositionBox,
  SendMessageType,
  StagedAttachmentType,
} from './composition/CompositionBox';

import { perfEnd, perfStart } from '../../session/utils/Performance';

import { SessionMessagesListContainer } from './SessionMessagesListContainer';

import { SessionFileDropzone } from './SessionFileDropzone';

import { Data } from '../../data/data';
import { markAllReadByConvoId } from '../../interactions/conversationInteractions';
import { MAX_ATTACHMENT_FILESIZE_BYTES } from '../../session/constants';
import { getConversationController } from '../../session/conversations';
import { ToastUtils } from '../../session/utils';
import {
  ReduxConversationType,
  SortedMessageModelProps,
  openConversationToSpecificMessage,
  quoteMessage,
  resetSelectedMessageIds,
  updateMentionsMembers,
} from '../../state/ducks/conversations';
import { updateConfirmModal } from '../../state/ducks/modalDialog';
import { addStagedAttachmentsInConversation } from '../../state/ducks/stagedAttachments';
import { SessionTheme } from '../../themes/SessionTheme';
import { MIME } from '../../types';
import { AttachmentTypeWithPath } from '../../types/Attachment';
import {
  THUMBNAIL_CONTENT_TYPE,
  getAudioDuration,
  getVideoDuration,
  makeImageThumbnailBuffer,
  makeVideoScreenshot,
} from '../../types/attachments/VisualAttachment';
import { AttachmentUtil, GoogleChrome, arrayBufferToObjectURL } from '../../util';
import { getCurrentRecoveryPhrase } from '../../util/storage';
import { MessageView } from '../MainViewController';
import { SplitViewContainer } from '../SplitViewContainer';
import { SessionButtonColor } from '../basic/SessionButton';
import { InConversationCallContainer } from '../calling/InConversationCallContainer';
import { LightboxGallery, MediaItemType } from '../lightbox/LightboxGallery';
import { NoMessageInConversation } from './SubtleNotification';
import { ConversationHeaderWithDetails } from './header/ConversationHeader';

import { isAudio } from '../../types/MIME';
import { HTMLDirection } from '../../util/i18n';
import { NoticeBanner } from '../NoticeBanner';
import { SessionSpinner } from '../basic/SessionSpinner';
import { RightPanel, StyledRightPanelContainer } from './right-panel/RightPanel';

const DEFAULT_JPEG_QUALITY = 0.85;
interface State {
  isDraggingFile: boolean;
}
export interface LightBoxOptions {
  media: Array<MediaItemType>;
  attachment: AttachmentTypeWithPath;
}

interface Props {
  ourDisplayNameInProfile: string;
  ourNumber: string;
  selectedConversationKey: string;
  selectedConversation?: ReduxConversationType;
  messagesProps: Array<SortedMessageModelProps>;
  selectedMessages: Array<string>;
  isRightPanelShowing: boolean;
  hasOngoingCallWithFocusedConvo: boolean;
  htmlDirection: HTMLDirection;

  // lightbox options
  lightBoxOptions?: LightBoxOptions;

  stagedAttachments: Array<StagedAttachmentType>;
  isSelectedConvoInitialLoadingInProgress: boolean;
}

const StyledSpinnerContainer = styled.div`
  display: flex;
  justify-content: center;
  width: 100%;
  height: 100%;
  align-items: center;
`;

const ConvoLoadingSpinner = () => {
  return (
    <StyledSpinnerContainer>
      <SessionSpinner loading={true} />
    </StyledSpinnerContainer>
  );
};

export class SessionConversation extends React.Component<Props, State> {
  private readonly messageContainerRef: React.RefObject<HTMLDivElement>;
  private dragCounter: number;
  private publicMembersRefreshTimeout?: NodeJS.Timeout;
  private readonly updateMemberList: () => any;

  constructor(props: any) {
    super(props);

    this.state = {
      isDraggingFile: false,
    };
    this.messageContainerRef = React.createRef();
    this.dragCounter = 0;
    this.updateMemberList = _.debounce(this.updateMemberListBouncy.bind(this), 10000);

    autoBind(this);
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~ LIFECYCLES ~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

  public componentDidUpdate(prevProps: Props, _prevState: State) {
    const { selectedConversationKey: newConversationKey, selectedConversation: newConversation } =
      this.props;
    const { selectedConversationKey: oldConversationKey } = prevProps;

    // if the convo is valid, and it changed, register for drag events
    if (newConversationKey && newConversation && newConversationKey !== oldConversationKey) {
      // Pause thread to wait for rendering to complete
      setTimeout(() => {
        const div = this.messageContainerRef.current;
        div?.addEventListener('dragenter', this.handleDragIn);
        div?.addEventListener('dragleave', this.handleDragOut);
        div?.addEventListener('dragover', this.handleDrag);
        div?.addEventListener('drop', this.handleDrop);
      }, 100);

      // if the conversation changed, we have to stop our refresh of member list
      if (this.publicMembersRefreshTimeout) {
        global.clearInterval(this.publicMembersRefreshTimeout);
        this.publicMembersRefreshTimeout = undefined;
      }
      // if the newConversation changed, and is public, start our refresh members list
      if (newConversation.isPublic) {
        // this is a debounced call.
        void this.updateMemberListBouncy();
        // run this only once every minute if we don't change the visible conversation.
        // this is a heavy operation (like a few thousands members can be here)
        this.publicMembersRefreshTimeout = global.setInterval(this.updateMemberList, 60000);
      }
    }
    // if we do not have a model, unregister for events
    if (!newConversation) {
      const div = this.messageContainerRef.current;
      div?.removeEventListener('dragenter', this.handleDragIn);
      div?.removeEventListener('dragleave', this.handleDragOut);
      div?.removeEventListener('dragover', this.handleDrag);
      div?.removeEventListener('drop', this.handleDrop);
      if (this.publicMembersRefreshTimeout) {
        global.clearInterval(this.publicMembersRefreshTimeout);
        this.publicMembersRefreshTimeout = undefined;
      }
    }
    if (newConversationKey !== oldConversationKey) {
      this.setState({
        isDraggingFile: false,
      });
    }
  }

  public componentWillUnmount() {
    const div = this.messageContainerRef.current;
    div?.removeEventListener('dragenter', this.handleDragIn);
    div?.removeEventListener('dragleave', this.handleDragOut);
    div?.removeEventListener('dragover', this.handleDrag);
    div?.removeEventListener('drop', this.handleDrop);

    if (this.publicMembersRefreshTimeout) {
      global.clearInterval(this.publicMembersRefreshTimeout);
      this.publicMembersRefreshTimeout = undefined;
    }
  }

  public sendMessageFn(msg: SendMessageType) {
    const { selectedConversationKey } = this.props;
    const conversationModel = getConversationController().get(selectedConversationKey);

    if (!conversationModel) {
      return;
    }

    const sendAndScroll = async () => {
      // this needs to be awaited otherwise, the scrollToNow won't find the new message in the db.
      // and this make the showScrollButton to be visible (even if we just scrolled to now)
      await conversationModel.sendMessage(msg);
      await this.scrollToNow();
    };

    const recoveryPhrase = getCurrentRecoveryPhrase();

    // string replace to fix case where pasted text contains invis characters causing false negatives
    if (msg.body.replace(/\s/g, '').includes(recoveryPhrase.replace(/\s/g, ''))) {
      window.inboxStore?.dispatch(
        updateConfirmModal({
          title: window.i18n('sendRecoveryPhraseTitle'),
          message: window.i18n('sendRecoveryPhraseMessage'),
          okTheme: SessionButtonColor.Danger,
          onClickOk: () => {
            void sendAndScroll();
          },
          onClickClose: () => {
            window.inboxStore?.dispatch(updateConfirmModal(null));
          },
        })
      );
    } else {
      void sendAndScroll();
    }

    window.inboxStore?.dispatch(quoteMessage(undefined));
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~ RENDER METHODS ~~~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  public render() {
    const { isDraggingFile } = this.state;

    const {
      ourDisplayNameInProfile,
      selectedConversation,
      messagesProps,
      selectedMessages,
      isRightPanelShowing,
      lightBoxOptions,
      isSelectedConvoInitialLoadingInProgress,
    } = this.props;

    if (!selectedConversation || !messagesProps) {
      // return an empty message view
      return <MessageView />;
    }
    // TODOLATER break selectionMode into it's own container component so we can use hooks to fetch relevant state from the store
    const selectionMode = selectedMessages.length > 0;

    const bannerText =
      selectedConversation.hasOutdatedClient &&
      selectedConversation.hasOutdatedClient !== ourDisplayNameInProfile
        ? window.i18n('disappearingMessagesModeOutdated', [selectedConversation.hasOutdatedClient])
        : window.i18n('someOfYourDeviceUseOutdatedVersion');

    return (
      <SessionTheme>
        <div className="conversation-header">
          <ConversationHeaderWithDetails />
          {selectedConversation?.hasOutdatedClient?.length ? (
            <NoticeBanner
              text={bannerText}
              dismissCallback={() => {
                const conversation = getConversationController().get(selectedConversation.id);
                conversation.set({ hasOutdatedClient: undefined });
                void conversation.commit();
              }}
            />
          ) : null}
        </div>
        {isSelectedConvoInitialLoadingInProgress ? (
          <ConvoLoadingSpinner />
        ) : (
          <>
            <div
              // if you change the classname, also update it on onKeyDown
              className={classNames('conversation-content', selectionMode && 'selection-mode')}
              tabIndex={0}
              onKeyDown={this.onKeyDown}
              role="navigation"
            >
              {lightBoxOptions?.media && this.renderLightBox(lightBoxOptions)}

              <div className="conversation-messages">
                <NoMessageInConversation />

                <SplitViewContainer
                  top={<InConversationCallContainer />}
                  bottom={
                    <SessionMessagesListContainer
                      messageContainerRef={this.messageContainerRef}
                      scrollToNow={this.scrollToNow}
                    />
                  }
                  disableTop={!this.props.hasOngoingCallWithFocusedConvo}
                />
                {isDraggingFile && <SessionFileDropzone />}
              </div>

              <CompositionBox
                sendMessage={this.sendMessageFn}
                stagedAttachments={this.props.stagedAttachments}
                // eslint-disable-next-line @typescript-eslint/no-misused-promises
                onChoseAttachments={this.onChoseAttachments}
                htmlDirection={this.props.htmlDirection}
              />
            </div>
            <StyledRightPanelContainer className={classNames(isRightPanelShowing && 'show')}>
              <RightPanel />
            </StyledRightPanelContainer>
          </>
        )}
      </SessionTheme>
    );
  }

  private async scrollToNow() {
    const conversationKey = this.props.selectedConversationKey;
    if (!conversationKey) {
      return;
    }

    await markAllReadByConvoId(conversationKey);
    const mostRecentMessage = await Data.getLastMessageInConversation(conversationKey);

    if (mostRecentMessage) {
      await openConversationToSpecificMessage({
        conversationKey,
        messageIdToNavigateTo: mostRecentMessage.id,
        shouldHighlightMessage: false,
      });
      const messageContainer = this.messageContainerRef.current;
      if (!messageContainer) {
        return;
      }
      messageContainer.scrollTop = messageContainer.scrollHeight - messageContainer.clientHeight;
    }
  }

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  // ~~~~~~~~~~~ KEYBOARD NAVIGATION ~~~~~~~~~~~~
  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  private onKeyDown(event: any) {
    const selectionMode = !!this.props.selectedMessages.length;

    if (event.target.classList.contains('conversation-content')) {
      switch (event.key) {
        case 'Escape':
          if (selectionMode) {
            window.inboxStore?.dispatch(resetSelectedMessageIds());
          }
          break;
        default:
          break;
      }
    }
  }

  private renderLightBox({ media, attachment }: LightBoxOptions) {
    const selectedIndex =
      media.length > 1
        ? media.findIndex(mediaMessage => mediaMessage.attachment.path === attachment.path)
        : 0;
    return <LightboxGallery media={media} selectedIndex={selectedIndex} />;
  }

  private async onChoseAttachments(attachmentsFileList: Array<File>) {
    if (!attachmentsFileList || attachmentsFileList.length === 0) {
      return;
    }

    for (let i = 0; i < attachmentsFileList.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      await this.maybeAddAttachment(attachmentsFileList[i]);
    }
  }

  private async maybeAddAttachment(file: any) {
    if (!file) {
      return;
    }

    const fileName = file.name;
    const contentType = file.type;

    const { stagedAttachments } = this.props;

    if (stagedAttachments.length >= 32) {
      ToastUtils.pushMaximumAttachmentsError();
      return;
    }

    const haveNonImage = _.some(
      stagedAttachments,
      attachment => !MIME.isImage(attachment.contentType)
    );
    // You can't add another attachment if you already have a non-image staged
    if (haveNonImage) {
      ToastUtils.pushMultipleNonImageError();
      return;
    }

    // You can't add a non-image attachment if you already have attachments staged
    if (!MIME.isImage(contentType) && stagedAttachments.length > 0) {
      ToastUtils.pushCannotMixError();
      return;
    }

    let blob = null;

    try {
      blob = await AttachmentUtil.autoScale({
        contentType,
        blob: file,
      });

      if (blob.blob.size > MAX_ATTACHMENT_FILESIZE_BYTES) {
        ToastUtils.pushFileSizeErrorAsByte(MAX_ATTACHMENT_FILESIZE_BYTES);
        return;
      }
    } catch (error) {
      window?.log?.error(
        'Error ensuring that image is properly sized:',
        error && error.stack ? error.stack : error
      );

      ToastUtils.pushLoadAttachmentFailure(error?.message);
      return;
    }

    try {
      if (GoogleChrome.isImageTypeSupported(contentType)) {
        // this does not add the preview to the message outgoing
        // this is just for us, for the list of attachments we are sending
        // the files are scaled down under getFiles()

        const attachmentWithPreview = await renderImagePreview(contentType, file, fileName);
        this.addAttachments([attachmentWithPreview]);
      } else if (GoogleChrome.isVideoTypeSupported(contentType)) {
        const attachmentWithVideoPreview = await renderVideoPreview(contentType, file, fileName);
        this.addAttachments([attachmentWithVideoPreview]);
      } else {
        const attachment: StagedAttachmentType = {
          file,
          size: file.size,
          contentType,
          fileName,
          url: '',
          isVoiceMessage: false,
          fileSize: null,
          screenshot: null,
          thumbnail: null,
        };

        if (isAudio(contentType)) {
          const objectUrl = URL.createObjectURL(file);

          try {
            const duration = await getAudioDuration({ objectUrl, contentType });
            attachment.duration = duration;
          } finally {
            URL.revokeObjectURL(objectUrl);
          }
        }

        this.addAttachments([attachment]);
      }
    } catch (e) {
      window?.log?.error(
        `Was unable to generate thumbnail for file type ${contentType}`,
        e && e.stack ? e.stack : e
      );
      this.addAttachments([
        {
          file,
          size: file.size,
          contentType,
          fileName,
          isVoiceMessage: false,
          url: '',
          fileSize: null,
          screenshot: null,
          thumbnail: null,
        },
      ]);
    }
  }

  private addAttachments(newAttachments: Array<StagedAttachmentType>) {
    window.inboxStore?.dispatch(
      addStagedAttachmentsInConversation({
        conversationKey: this.props.selectedConversationKey,
        newAttachments,
      })
    );
  }

  private handleDrag(e: any) {
    e.preventDefault();
    e.stopPropagation();
  }

  private handleDragIn(e: any) {
    e.preventDefault();
    e.stopPropagation();
    this.dragCounter++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      this.setState({ isDraggingFile: true });
    }
  }

  private handleDragOut(e: any) {
    e.preventDefault();
    e.stopPropagation();
    this.dragCounter--;

    if (this.dragCounter === 0) {
      this.setState({ isDraggingFile: false });
    }
  }

  private handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (e?.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      void this.onChoseAttachments(Array.from(e.dataTransfer.files));
      e.dataTransfer.clearData();
      this.dragCounter = 0;
      this.setState({ isDraggingFile: false });
    }
  }

  private async updateMemberListBouncy() {
    const start = Date.now();
    const allPubKeys = await Data.getPubkeysInPublicConversation(
      this.props.selectedConversationKey
    );

    window?.log?.debug(
      `[perf] getPubkeysInPublicConversation returned '${
        allPubKeys?.length
      }' members in ${Date.now() - start}ms`
    );

    const allMembers = allPubKeys.map((pubKey: string) => {
      const conv = getConversationController().get(pubKey);
      const profileName = conv?.getNicknameOrRealUsernameOrPlaceholder();

      return {
        id: pubKey,
        authorProfileName: profileName,
      };
    });

    window.inboxStore?.dispatch(updateMentionsMembers(allMembers));
  }
}

const renderVideoPreview = async (contentType: string, file: File, fileName: string) => {
  const objectUrl = URL.createObjectURL(file);
  try {
    const type = THUMBNAIL_CONTENT_TYPE;

    const thumbnail = await makeVideoScreenshot({
      objectUrl,
      contentType: type,
    });
    const duration = await getVideoDuration({
      objectUrl,
      contentType: type,
    });
    const data = await blobToArrayBuffer(thumbnail);
    const url = arrayBufferToObjectURL({
      data,
      type,
    });
    return {
      file,
      size: file.size,
      fileName,
      contentType,
      duration,
      videoUrl: objectUrl,
      url,
      isVoiceMessage: false,
      fileSize: null,
      screenshot: null,
      thumbnail: null,
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
};

const autoOrientJpegImage = async (fileOrBlobOrURL: File): Promise<string> => {
  perfStart('autoOrientJpegImage');
  const loadedImage = await loadImage(fileOrBlobOrURL, { orientation: true, canvas: true });
  perfEnd('autoOrientJpegImage', 'autoOrientJpegImage');
  const dataURL = (loadedImage.image as HTMLCanvasElement).toDataURL(
    MIME.IMAGE_JPEG,
    DEFAULT_JPEG_QUALITY
  );

  return dataURL;
};

const renderImagePreview = async (contentType: string, file: File, fileName: string) => {
  if (!MIME.isJPEG(contentType)) {
    const urlImage = URL.createObjectURL(file);
    if (!urlImage) {
      throw new Error('Failed to create object url for image!');
    }
    return {
      file,
      size: file.size,
      fileName,
      contentType,
      url: urlImage,
      isVoiceMessage: false,
      fileSize: null,
      screenshot: null,
      thumbnail: null,
    };
  }

  // orient the image correctly based on the EXIF data, if needed
  const orientedImageUrl = await autoOrientJpegImage(file);

  const thumbnailBuffer = await makeImageThumbnailBuffer({
    objectUrl: orientedImageUrl,
    contentType,
  });
  const url = arrayBufferToObjectURL({
    data: thumbnailBuffer,
    type: THUMBNAIL_CONTENT_TYPE,
  });

  return {
    file,
    size: file.size,
    fileName,
    contentType,
    url,
    isVoiceMessage: false,
    fileSize: null,
    screenshot: null,
    thumbnail: null,
  };
};
