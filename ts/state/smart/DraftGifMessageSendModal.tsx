// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import React, { memo, useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { getIntl, getTheme } from '../selectors/user.js';
import type { DraftGifMessageSendModalProps } from '../../components/DraftGifMessageSendModal.js';
import { DraftGifMessageSendModal } from '../../components/DraftGifMessageSendModal.js';
import { strictAssert } from '../../util/assert.js';
import type { HydratedBodyRangesType } from '../../types/BodyRange.js';
import { SmartCompositionTextArea } from './CompositionTextArea.js';
import { getDraftGifMessageSendModalProps } from '../selectors/globalModals.js';
import { useGlobalModalActions } from '../ducks/globalModals.js';
import { useComposerActions } from '../ducks/composer.js';
import type { FunGifSelection } from '../../components/fun/panels/FunPanelGifs.js';
import { tenorDownload } from '../../components/fun/data/tenor.js';
import { drop } from '../../util/drop.js';
import { processAttachment } from '../../util/processAttachment.js';
import { SignalService as Proto } from '../../protobuf/index.js';
import { writeDraftAttachment } from '../../util/writeDraftAttachment.js';
import type { AttachmentDraftType } from '../../types/Attachment.js';
import { createLogger } from '../../logging/log.js';
import * as Errors from '../../types/errors.js';
import { type Loadable, LoadingState } from '../../util/loadable.js';
import { isAbortError } from '../../util/isAbortError.js';

const log = createLogger('DraftGifMessageSendModal');

type ReadyAttachmentDraftType = AttachmentDraftType & { pending: false };

export type GifDownloadState = Loadable<{
  file: File;
  attachment: ReadyAttachmentDraftType;
}>;

export type SmartDraftGifMessageSendModalProps = Readonly<{
  conversationId: string;
  previousComposerDraftText: string;
  previousComposerDraftBodyRanges: HydratedBodyRangesType;
  gifSelection: FunGifSelection;
}>;

export const SmartDraftGifMessageSendModal = memo(
  function SmartDraftGifMessageSendModal() {
    const props = useSelector(getDraftGifMessageSendModalProps);
    strictAssert(props != null, 'Missing props');
    const { conversationId, gifSelection } = props;

    const i18n = useSelector(getIntl);
    const theme = useSelector(getTheme);

    const { toggleDraftGifMessageSendModal } = useGlobalModalActions();
    const { sendMultiMediaMessage } = useComposerActions();

    const [draftText, setDraftText] = useState(props.previousComposerDraftText);
    const [draftBodyRanges, setDraftBodyRanges] = useState(
      props.previousComposerDraftBodyRanges
    );

    const [gifDownloadState, setGifDownloadState] = useState<GifDownloadState>({
      loadingState: LoadingState.Loading,
    });

    const handleChange: DraftGifMessageSendModalProps['onChange'] = useCallback(
      (updatedDraftText, updatedBodyRanges) => {
        setDraftText(updatedDraftText);
        setDraftBodyRanges(updatedBodyRanges);
      },
      []
    );

    const handleSubmit = useCallback(() => {
      strictAssert(
        gifDownloadState.loadingState === LoadingState.Loaded,
        'Gif must be already downloaded'
      );
      const draftAttachment = gifDownloadState.value.attachment;
      toggleDraftGifMessageSendModal(null);
      sendMultiMediaMessage(conversationId, {
        message: draftText,
        bodyRanges: draftBodyRanges,
        draftAttachments: [draftAttachment],
        timestamp: Date.now(),
      });
    }, [
      gifDownloadState,
      draftText,
      draftBodyRanges,
      conversationId,
      toggleDraftGifMessageSendModal,
      sendMultiMediaMessage,
    ]);

    const handleClose = useCallback(() => {
      toggleDraftGifMessageSendModal(null);
    }, [toggleDraftGifMessageSendModal]);

    const gifUrl = gifSelection.gif.attachmentMedia.url;

    useEffect(() => {
      const controller = new AbortController();
      async function download() {
        setGifDownloadState({ loadingState: LoadingState.Loading });
        try {
          const bytes = await tenorDownload(gifUrl, controller.signal);
          const file = new File([bytes], 'gif.mp4', {
            type: 'video/mp4',
          });
          const inMemoryAttachment = await processAttachment(file, {
            generateScreenshot: false,
            flags: Proto.AttachmentPointer.Flags.GIF,
          });
          strictAssert(
            inMemoryAttachment != null,
            'Attachment should not be null'
          );
          const attachment = await writeDraftAttachment(inMemoryAttachment);
          strictAssert(!attachment.pending, 'Attachment should not be pending');
          setGifDownloadState({
            loadingState: LoadingState.Loaded,
            value: { file, attachment },
          });
        } catch (error) {
          if (isAbortError(error)) {
            return;
          }
          log.error('Error while downloading gif', Errors.toLogFormat(error));
          setGifDownloadState({ loadingState: LoadingState.LoadFailed, error });
        }
      }
      drop(download());
      return () => {
        controller.abort();
      };
    }, [gifUrl]);

    return (
      <DraftGifMessageSendModal
        i18n={i18n}
        RenderCompositionTextArea={SmartCompositionTextArea}
        draftText={draftText ?? ''}
        draftBodyRanges={draftBodyRanges}
        gifSelection={gifSelection}
        gifDownloadState={gifDownloadState}
        theme={theme}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onClose={handleClose}
      />
    );
  }
);
