// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import type { ForwardMessagesPropsType } from '../ducks/globalModals.js';
import { createLogger } from '../../logging/log.js';
import { ForwardMessagesModal } from '../../components/ForwardMessagesModal.js';
import { LinkPreviewSourceType } from '../../types/LinkPreview.js';
import * as Errors from '../../types/errors.js';
import { getAllComposableConversations } from '../selectors/conversations.js';
import { getIntl, getTheme, getRegionCode } from '../selectors/user.js';
import { getLinkPreview } from '../selectors/linkPreviews.js';
import { isInFullScreenCall as getIsInFullScreenCall } from '../selectors/calling.js';
import { getPreferredBadgeSelector } from '../selectors/badges.js';
import { maybeForwardMessages } from '../../util/maybeForwardMessages.js';
import {
  maybeGrabLinkPreview,
  resetLinkPreview,
} from '../../services/LinkPreview.js';
import { useGlobalModalActions } from '../ducks/globalModals.js';
import { useLinkPreviewActions } from '../ducks/linkPreviews.js';
import { SmartCompositionTextArea } from './CompositionTextArea.js';
import { useToastActions } from '../ducks/toast.js';
import { isDownloaded } from '../../types/Attachment.js';
import { getMessageById } from '../../messages/getMessageById.js';
import { strictAssert } from '../../util/assert.js';
import type {
  ForwardMessageData,
  MessageForwardDraft,
} from '../../types/ForwardDraft.js';
import { getForwardMessagesProps } from '../selectors/globalModals.js';

const log = createLogger('ForwardMessagesModal');

export function SmartForwardMessagesModal(): JSX.Element | null {
  const forwardMessagesProps = useSelector(getForwardMessagesProps);

  if (forwardMessagesProps == null) {
    return null;
  }

  if (
    !forwardMessagesProps.messageDrafts.every(messageDraft => {
      return messageDraft.attachments?.every(isDownloaded) ?? true;
    })
  ) {
    return null;
  }

  return (
    <SmartForwardMessagesModalInner
      forwardMessagesProps={forwardMessagesProps}
    />
  );
}

function SmartForwardMessagesModalInner({
  forwardMessagesProps,
}: {
  forwardMessagesProps: ForwardMessagesPropsType;
}): JSX.Element | null {
  const { type } = forwardMessagesProps;

  const candidateConversations = useSelector(getAllComposableConversations);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const i18n = useSelector(getIntl);
  const linkPreviewForSource = useSelector(getLinkPreview);
  const regionCode = useSelector(getRegionCode);
  const theme = useSelector(getTheme);
  const isInFullScreenCall = useSelector(getIsInFullScreenCall);

  const { removeLinkPreview } = useLinkPreviewActions();
  const { toggleForwardMessagesModal } = useGlobalModalActions();
  const { showToast } = useToastActions();

  const [drafts, setDrafts] = useState<ReadonlyArray<MessageForwardDraft>>(
    () => {
      return forwardMessagesProps.messageDrafts;
    }
  );

  const handleChange = useCallback(
    (
      updatedDrafts: ReadonlyArray<MessageForwardDraft>,
      caretLocation?: number
    ) => {
      setDrafts(updatedDrafts);
      const isLonelyDraft = updatedDrafts.length === 1;
      const lonelyDraft = isLonelyDraft ? updatedDrafts[0] : null;
      if (lonelyDraft == null) {
        return;
      }
      const attachmentsLength = lonelyDraft.attachments?.length ?? 0;
      if (attachmentsLength === 0) {
        maybeGrabLinkPreview(
          lonelyDraft.messageBody ?? '',
          LinkPreviewSourceType.ForwardMessageModal,
          { caretLocation }
        );
      }
    },
    []
  );

  const closeModal = useCallback(() => {
    resetLinkPreview();
    toggleForwardMessagesModal(null);
  }, [toggleForwardMessagesModal]);

  const doForwardMessages = useCallback(
    async (
      conversationIds: ReadonlyArray<string>,
      finalDrafts: ReadonlyArray<MessageForwardDraft>
    ) => {
      try {
        const messages = await Promise.all(
          finalDrafts.map(async (draft): Promise<ForwardMessageData> => {
            if (draft.originalMessageId == null) {
              return { draft, originalMessage: null };
            }
            const message = await getMessageById(draft.originalMessageId);
            strictAssert(message, 'no message found');
            return {
              draft,
              originalMessage: message.attributes,
            };
          })
        );

        const didForwardSuccessfully = await maybeForwardMessages(
          messages,
          conversationIds
        );

        if (didForwardSuccessfully) {
          closeModal();
          forwardMessagesProps?.onForward?.();
        }
      } catch (err) {
        log.warn('doForwardMessage', Errors.toLogFormat(err));
      }
    },
    [forwardMessagesProps, closeModal]
  );

  if (!drafts.length) {
    return null;
  }

  return (
    <ForwardMessagesModal
      drafts={drafts}
      candidateConversations={candidateConversations}
      doForwardMessages={doForwardMessages}
      linkPreviewForSource={linkPreviewForSource}
      getPreferredBadge={getPreferredBadge}
      i18n={i18n}
      isInFullScreenCall={isInFullScreenCall}
      onClose={closeModal}
      onChange={handleChange}
      regionCode={regionCode}
      RenderCompositionTextArea={SmartCompositionTextArea}
      removeLinkPreview={removeLinkPreview}
      type={type}
      showToast={showToast}
      theme={theme}
    />
  );
}
