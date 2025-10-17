// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useState } from 'react';
import lodash from 'lodash';

import { createPortal } from 'react-dom';
import type { AttachmentType } from '../types/Attachment.std.js';
import type { LinkPreviewSourceType } from '../types/LinkPreview.std.js';
import type { LinkPreviewForUIType } from '../types/message/LinkPreviews.std.js';
import type { LocalizerType, ThemeType } from '../types/Util.std.js';
import type { PropsType as SendStoryModalPropsType } from './SendStoryModal.dom.js';
import type { StoryDistributionIdString } from '../types/StoryDistributionId.std.js';
import type { imageToBlurHash } from '../util/imageToBlurHash.dom.js';
import type { PropsType as MediaEditorPropsType } from './MediaEditor.dom.js';

import { TEXT_ATTACHMENT } from '../types/MIME.std.js';
import { isVideoAttachment } from '../util/Attachment.std.js';
import { SendStoryModal } from './SendStoryModal.dom.js';

import { MediaEditor } from './MediaEditor.dom.js';
import { TextStoryCreator } from './TextStoryCreator.dom.js';
import type { DraftBodyRanges } from '../types/BodyRange.std.js';
import type { processAttachment } from '../util/processAttachment.preload.js';

const { get, has } = lodash;

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
  linkPreview?: LinkPreviewForUIType;
  onClose: () => unknown;
  onSend: (
    listIds: Array<StoryDistributionIdString>,
    conversationIds: Array<string>,
    attachment: AttachmentType,
    bodyRanges: DraftBodyRanges | undefined
  ) => unknown;
  imageToBlurHash: typeof imageToBlurHash;
  processAttachment: typeof processAttachment;
  sendStoryModalOpenStateChanged: (isOpen: boolean) => unknown;
  theme: ThemeType;
} & Pick<
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
    MediaEditorPropsType,
    | 'isFormattingEnabled'
    | 'emojiSkinToneDefault'
    | 'onSelectEmoji'
    | 'onTextTooLong'
    | 'platform'
    | 'sortedGroupMembers'
    | 'conversationSelector'
  >;

export function StoryCreator({
  candidateConversations,
  conversationSelector,
  debouncedMaybeGrabLinkPreview,
  distributionLists,
  file,
  getPreferredBadge,
  groupConversations,
  groupStories,
  hasFirstStoryPostExperience,
  i18n,
  imageToBlurHash,
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
  onSelectEmoji,
  onRemoveMembers,
  onRepliesNReactionsChanged,
  onSelectedStoryList,
  onSend,
  onTextTooLong,
  onViewersUpdated,
  ourConversationId,
  platform,
  processAttachment,
  sendStoryModalOpenStateChanged,
  setMyStoriesToAllSignalConnections,
  signalConnections,
  emojiSkinToneDefault,
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

      const draft = await processAttachment(file, {
        // Screenshot is used in `getStoryBackground`
        generateScreenshot: true,
        flags: null,
      });
      if (!draft || unmounted) {
        return;
      }

      let attachment: AttachmentType = draft;
      if (isVideoAttachment(draft)) {
        if (
          'screenshotData' in draft &&
          draft.screenshotData &&
          draft.screenshotContentType
        ) {
          url = URL.createObjectURL(
            new Blob([draft.screenshotData], {
              type: draft.screenshotContentType,
            })
          );
          attachment = {
            ...draft,
            screenshot: {
              contentType: draft.screenshotContentType,
              url,
            },
          };
        }
        setAttachmentUrl(undefined);
        setIsReadyToSend(true);
      } else if (draft && has(draft, 'data')) {
        url = URL.createObjectURL(new Blob([get(draft, 'data')]));
        setAttachmentUrl(url);

        // Needs editing in MediaEditor
        setIsReadyToSend(false);
      }
      setDraftAttachment(attachment);
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
              isCreatingStory
              isFormattingEnabled={isFormattingEnabled}
              isSending={isSending}
              conversationSelector={conversationSelector}
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
              onSelectEmoji={onSelectEmoji}
              onTextTooLong={onTextTooLong}
              ourConversationId={ourConversationId}
              platform={platform}
              emojiSkinToneDefault={emojiSkinToneDefault}
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
              onSelectEmoji={onSelectEmoji}
            />
          )}
        </>,
        portalElement
      )
    : null;
}
