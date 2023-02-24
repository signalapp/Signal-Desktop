// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useState } from 'react';
import { get, has } from 'lodash';

import type {
  AttachmentType,
  InMemoryAttachmentDraftType,
} from '../types/Attachment';
import type { LinkPreviewSourceType } from '../types/LinkPreview';
import type { LinkPreviewType } from '../types/message/LinkPreviews';
import type { LocalizerType } from '../types/Util';
import type { Props as StickerButtonProps } from './stickers/StickerButton';
import type { PropsType as SendStoryModalPropsType } from './SendStoryModal';
import type { UUIDStringType } from '../types/UUID';
import type { imageToBlurHash } from '../util/imageToBlurHash';
import type { PropsType as TextStoryCreatorPropsType } from './TextStoryCreator';

import { TEXT_ATTACHMENT } from '../types/MIME';
import { isVideoAttachment } from '../types/Attachment';
import { SendStoryModal } from './SendStoryModal';

import { MediaEditor } from './MediaEditor';
import { TextStoryCreator } from './TextStoryCreator';
import type { SmartCompositionTextAreaProps } from '../state/smart/CompositionTextArea';

export type PropsType = {
  debouncedMaybeGrabLinkPreview: (
    message: string,
    source: LinkPreviewSourceType
  ) => unknown;
  file?: File;
  i18n: LocalizerType;
  isSending: boolean;
  linkPreview?: LinkPreviewType;
  onClose: () => unknown;
  onSend: (
    listIds: Array<UUIDStringType>,
    conversationIds: Array<string>,
    attachment: AttachmentType
  ) => unknown;
  imageToBlurHash: typeof imageToBlurHash;
  processAttachment: (
    file: File
  ) => Promise<void | InMemoryAttachmentDraftType>;
  renderCompositionTextArea: (
    props: SmartCompositionTextAreaProps
  ) => JSX.Element;
  sendStoryModalOpenStateChanged: (isOpen: boolean) => unknown;
} & Pick<StickerButtonProps, 'installedPacks' | 'recentStickers'> &
  Pick<
    SendStoryModalPropsType,
    | 'candidateConversations'
    | 'distributionLists'
    | 'getPreferredBadge'
    | 'groupConversations'
    | 'groupStories'
    | 'hasFirstStoryPostExperience'
    | 'me'
    | 'ourConversationId'
    | 'onDeleteList'
    | 'onDistributionListCreated'
    | 'onHideMyStoriesFrom'
    | 'onRemoveMembers'
    | 'onRepliesNReactionsChanged'
    | 'onSelectedStoryList'
    | 'onViewersUpdated'
    | 'setMyStoriesToAllSignalConnections'
    | 'signalConnections'
    | 'toggleGroupsForStorySend'
    | 'mostRecentActiveStoryTimestampByGroupOrDistributionList'
    | 'toggleSignalConnectionsModal'
    | 'onMediaPlaybackStart'
  > &
  Pick<
    TextStoryCreatorPropsType,
    'onUseEmoji' | 'skinTone' | 'onSetSkinTone' | 'recentEmojis'
  >;

export function StoryCreator({
  candidateConversations,
  debouncedMaybeGrabLinkPreview,
  distributionLists,
  file,
  getPreferredBadge,
  groupConversations,
  groupStories,
  hasFirstStoryPostExperience,
  i18n,
  imageToBlurHash,
  installedPacks,
  isSending,
  linkPreview,
  me,
  mostRecentActiveStoryTimestampByGroupOrDistributionList,
  onClose,
  onDeleteList,
  onDistributionListCreated,
  onHideMyStoriesFrom,
  onRemoveMembers,
  onRepliesNReactionsChanged,
  onSelectedStoryList,
  onSend,
  onSetSkinTone,
  onUseEmoji,
  onViewersUpdated,
  onMediaPlaybackStart,
  ourConversationId,
  processAttachment,
  recentEmojis,
  recentStickers,
  renderCompositionTextArea,
  sendStoryModalOpenStateChanged,
  setMyStoriesToAllSignalConnections,
  signalConnections,
  skinTone,
  toggleGroupsForStorySend,
  toggleSignalConnectionsModal,
}: PropsType): JSX.Element {
  const [draftAttachment, setDraftAttachment] = useState<
    AttachmentType | undefined
  >();
  const [isReadyToSend, setIsReadyToSend] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | undefined>();

  useEffect(() => {
    let url: string | undefined;
    let unmounted = false;

    async function loadAttachment(): Promise<void> {
      if (!file || unmounted) {
        return;
      }

      const attachment = await processAttachment(file);
      if (!attachment || unmounted) {
        return;
      }

      setDraftAttachment(attachment);
      if (isVideoAttachment(attachment)) {
        setAttachmentUrl(undefined);
        setIsReadyToSend(true);
      } else if (attachment && has(attachment, 'data')) {
        url = URL.createObjectURL(new Blob([get(attachment, 'data')]));
        setAttachmentUrl(url);

        // Needs editing in MediaEditor
        setIsReadyToSend(false);
      }
    }

    void loadAttachment();

    return () => {
      unmounted = true;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [file, processAttachment]);

  useEffect(() => {
    if (draftAttachment === undefined) {
      sendStoryModalOpenStateChanged(false);
      setIsReadyToSend(false);
    } else {
      sendStoryModalOpenStateChanged(true);
    }
  }, [draftAttachment, sendStoryModalOpenStateChanged]);

  return (
    <>
      {draftAttachment && isReadyToSend && (
        <SendStoryModal
          draftAttachment={draftAttachment}
          candidateConversations={candidateConversations}
          distributionLists={distributionLists}
          getPreferredBadge={getPreferredBadge}
          groupConversations={groupConversations}
          groupStories={groupStories}
          hasFirstStoryPostExperience={hasFirstStoryPostExperience}
          ourConversationId={ourConversationId}
          i18n={i18n}
          me={me}
          onClose={() => setDraftAttachment(undefined)}
          onDeleteList={onDeleteList}
          onDistributionListCreated={onDistributionListCreated}
          onHideMyStoriesFrom={onHideMyStoriesFrom}
          onRemoveMembers={onRemoveMembers}
          onRepliesNReactionsChanged={onRepliesNReactionsChanged}
          onSelectedStoryList={onSelectedStoryList}
          onSend={(listIds, groupIds) => {
            onSend(listIds, groupIds, draftAttachment);
            setDraftAttachment(undefined);
          }}
          onViewersUpdated={onViewersUpdated}
          onMediaPlaybackStart={onMediaPlaybackStart}
          setMyStoriesToAllSignalConnections={
            setMyStoriesToAllSignalConnections
          }
          signalConnections={signalConnections}
          toggleGroupsForStorySend={toggleGroupsForStorySend}
          mostRecentActiveStoryTimestampByGroupOrDistributionList={
            mostRecentActiveStoryTimestampByGroupOrDistributionList
          }
          toggleSignalConnectionsModal={toggleSignalConnectionsModal}
        />
      )}
      {draftAttachment && !isReadyToSend && attachmentUrl && (
        <MediaEditor
          doneButtonLabel={i18n('next2')}
          i18n={i18n}
          imageSrc={attachmentUrl}
          installedPacks={installedPacks}
          isSending={isSending}
          onClose={onClose}
          supportsCaption
          renderCompositionTextArea={renderCompositionTextArea}
          imageToBlurHash={imageToBlurHash}
          onDone={({ contentType, data, blurHash, caption }) => {
            setDraftAttachment({
              ...draftAttachment,
              contentType,
              data,
              size: data.byteLength,
              blurHash,
              caption,
            });
            setIsReadyToSend(true);
          }}
          recentStickers={recentStickers}
        />
      )}
      {!file && (
        <TextStoryCreator
          debouncedMaybeGrabLinkPreview={debouncedMaybeGrabLinkPreview}
          i18n={i18n}
          isSending={isSending}
          linkPreview={linkPreview}
          onClose={onClose}
          onDone={textAttachment => {
            setDraftAttachment({
              contentType: TEXT_ATTACHMENT,
              textAttachment,
              size: textAttachment.text?.length || 0,
            });
            setIsReadyToSend(true);
          }}
          onUseEmoji={onUseEmoji}
          onSetSkinTone={onSetSkinTone}
          recentEmojis={recentEmojis}
          skinTone={skinTone}
        />
      )}
    </>
  );
}
