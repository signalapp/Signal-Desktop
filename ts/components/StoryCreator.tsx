// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useState } from 'react';
import { get, has } from 'lodash';

import { createPortal } from 'react-dom';
import type {
  AttachmentType,
  InMemoryAttachmentDraftType,
} from '../types/Attachment';
import type { LinkPreviewSourceType } from '../types/LinkPreview';
import type { LinkPreviewType } from '../types/message/LinkPreviews';
import type { LocalizerType, ThemeType } from '../types/Util';
import type { Props as StickerButtonProps } from './stickers/StickerButton';
import type { PropsType as SendStoryModalPropsType } from './SendStoryModal';
import type { StoryDistributionIdString } from '../types/StoryDistributionId';
import type { imageToBlurHash } from '../util/imageToBlurHash';
import type { PropsType as TextStoryCreatorPropsType } from './TextStoryCreator';
import type { PropsType as MediaEditorPropsType } from './MediaEditor';

import { TEXT_ATTACHMENT } from '../types/MIME';
import { isVideoAttachment } from '../types/Attachment';
import { SendStoryModal } from './SendStoryModal';

import { MediaEditor } from './MediaEditor';
import { TextStoryCreator } from './TextStoryCreator';
import type { DraftBodyRanges } from '../types/BodyRange';

function usePortalElement(testid: string): HTMLDivElement | null {
  const [element, setElement] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const div = document.createElement('div');
    div.dataset.testid = testid;
    document.body.appendChild(div);
    setElement(div);
    return () => {
      document.body.removeChild(div);
    };
  }, [testid]);

  return element;
}

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
    listIds: Array<StoryDistributionIdString>,
    conversationIds: Array<string>,
    attachment: AttachmentType,
    bodyRanges: DraftBodyRanges | undefined
  ) => unknown;
  imageToBlurHash: typeof imageToBlurHash;
  processAttachment: (
    file: File
  ) => Promise<void | InMemoryAttachmentDraftType>;
  sendStoryModalOpenStateChanged: (isOpen: boolean) => unknown;
  theme: ThemeType;
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
  > &
  Pick<
    MediaEditorPropsType,
    | 'isFormattingEnabled'
    | 'onPickEmoji'
    | 'onTextTooLong'
    | 'platform'
    | 'sortedGroupMembers'
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
  isFormattingEnabled,
  isSending,
  linkPreview,
  me,
  mostRecentActiveStoryTimestampByGroupOrDistributionList,
  onClose,
  onDeleteList,
  onDistributionListCreated,
  onHideMyStoriesFrom,
  onMediaPlaybackStart,
  onPickEmoji,
  onRemoveMembers,
  onRepliesNReactionsChanged,
  onSelectedStoryList,
  onSend,
  onSetSkinTone,
  onTextTooLong,
  onUseEmoji,
  onViewersUpdated,
  ourConversationId,
  platform,
  processAttachment,
  recentEmojis,
  recentStickers,
  sendStoryModalOpenStateChanged,
  setMyStoriesToAllSignalConnections,
  signalConnections,
  skinTone,
  sortedGroupMembers,
  theme,
  toggleGroupsForStorySend,
  toggleSignalConnectionsModal,
}: PropsType): JSX.Element | null {
  const portalElement = usePortalElement('StoryCreatorPortal');

  const [draftAttachment, setDraftAttachment] = useState<
    AttachmentType | undefined
  >();
  const [isReadyToSend, setIsReadyToSend] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | undefined>();
  const [bodyRanges, setBodyRanges] = useState<DraftBodyRanges | undefined>();

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

  return portalElement != null
    ? createPortal(
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
              onClose={() => setIsReadyToSend(false)}
              onDeleteList={onDeleteList}
              onDistributionListCreated={onDistributionListCreated}
              onHideMyStoriesFrom={onHideMyStoriesFrom}
              onRemoveMembers={onRemoveMembers}
              onRepliesNReactionsChanged={onRepliesNReactionsChanged}
              onSelectedStoryList={onSelectedStoryList}
              onSend={(listIds, groupIds) => {
                onSend(listIds, groupIds, draftAttachment, bodyRanges);
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
              theme={theme}
              toggleSignalConnectionsModal={toggleSignalConnectionsModal}
            />
          )}
          {draftAttachment && attachmentUrl && (
            <MediaEditor
              doneButtonLabel={i18n('icu:next2')}
              getPreferredBadge={getPreferredBadge}
              i18n={i18n}
              imageSrc={attachmentUrl}
              imageToBlurHash={imageToBlurHash}
              installedPacks={installedPacks}
              isFormattingEnabled={isFormattingEnabled}
              isSending={isSending}
              onClose={onClose}
              onDone={({
                contentType,
                data,
                blurHash,
                caption,
                captionBodyRanges,
              }) => {
                setDraftAttachment({
                  ...draftAttachment,
                  contentType,
                  data,
                  size: data.byteLength,
                  blurHash,
                  caption,
                });
                setBodyRanges(captionBodyRanges);
                setIsReadyToSend(true);
              }}
              onPickEmoji={onPickEmoji}
              onTextTooLong={onTextTooLong}
              ourConversationId={ourConversationId}
              platform={platform}
              recentStickers={recentStickers}
              skinTone={skinTone}
              sortedGroupMembers={sortedGroupMembers}
              draftText={null}
              draftBodyRanges={null}
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
        </>,
        portalElement
      )
    : null;
}
