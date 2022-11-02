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

import { IMAGE_JPEG, TEXT_ATTACHMENT } from '../types/MIME';
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
    | 'onDeleteList'
    | 'onDistributionListCreated'
    | 'onHideMyStoriesFrom'
    | 'onRemoveMember'
    | 'onRepliesNReactionsChanged'
    | 'onSelectedStoryList'
    | 'onViewersUpdated'
    | 'setMyStoriesToAllSignalConnections'
    | 'signalConnections'
    | 'toggleGroupsForStorySend'
    | 'toggleSignalConnectionsModal'
  >;

export const StoryCreator = ({
  candidateConversations,
  debouncedMaybeGrabLinkPreview,
  distributionLists,
  file,
  getPreferredBadge,
  groupConversations,
  groupStories,
  hasFirstStoryPostExperience,
  i18n,
  installedPacks,
  isSending,
  linkPreview,
  me,
  onClose,
  onDeleteList,
  onDistributionListCreated,
  onHideMyStoriesFrom,
  onRemoveMember,
  onRepliesNReactionsChanged,
  onSelectedStoryList,
  onSend,
  onViewersUpdated,
  processAttachment,
  recentStickers,
  renderCompositionTextArea,
  sendStoryModalOpenStateChanged,
  setMyStoriesToAllSignalConnections,
  signalConnections,
  toggleGroupsForStorySend,
  toggleSignalConnectionsModal,
}: PropsType): JSX.Element => {
  const [draftAttachment, setDraftAttachment] = useState<
    AttachmentType | undefined
  >();
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

      if (isVideoAttachment(attachment)) {
        setDraftAttachment(attachment);
      } else if (attachment && has(attachment, 'data')) {
        url = URL.createObjectURL(new Blob([get(attachment, 'data')]));
        setAttachmentUrl(url);
      }
    }

    loadAttachment();

    return () => {
      unmounted = true;
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [file, processAttachment]);

  useEffect(() => {
    sendStoryModalOpenStateChanged(Boolean(draftAttachment));
  }, [draftAttachment, sendStoryModalOpenStateChanged]);

  return (
    <>
      {draftAttachment && (
        <SendStoryModal
          draftAttachment={draftAttachment}
          candidateConversations={candidateConversations}
          distributionLists={distributionLists}
          getPreferredBadge={getPreferredBadge}
          groupConversations={groupConversations}
          groupStories={groupStories}
          hasFirstStoryPostExperience={hasFirstStoryPostExperience}
          i18n={i18n}
          me={me}
          onClose={() => setDraftAttachment(undefined)}
          onDeleteList={onDeleteList}
          onDistributionListCreated={onDistributionListCreated}
          onHideMyStoriesFrom={onHideMyStoriesFrom}
          onRemoveMember={onRemoveMember}
          onRepliesNReactionsChanged={onRepliesNReactionsChanged}
          onSelectedStoryList={onSelectedStoryList}
          onSend={(listIds, groupIds) => {
            onSend(listIds, groupIds, draftAttachment);
            setDraftAttachment(undefined);
          }}
          onViewersUpdated={onViewersUpdated}
          setMyStoriesToAllSignalConnections={
            setMyStoriesToAllSignalConnections
          }
          signalConnections={signalConnections}
          toggleGroupsForStorySend={toggleGroupsForStorySend}
          toggleSignalConnectionsModal={toggleSignalConnectionsModal}
        />
      )}
      {attachmentUrl && (
        <MediaEditor
          doneButtonLabel={i18n('next2')}
          i18n={i18n}
          imageSrc={attachmentUrl}
          installedPacks={installedPacks}
          isSending={isSending}
          onClose={onClose}
          supportsCaption
          renderCompositionTextArea={renderCompositionTextArea}
          onDone={(data, caption) => {
            setDraftAttachment({
              contentType: IMAGE_JPEG,
              data,
              size: data.byteLength,
              caption,
            });
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
          }}
        />
      )}
    </>
  );
};
