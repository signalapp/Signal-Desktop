// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import type { ForwardMessagesPropsType } from '../ducks/globalModals.preload.ts';
import { createLogger } from '../../logging/log.std.ts';
import { ForwardMessagesModal } from '../../components/ForwardMessagesModal.dom.tsx';
import { LinkPreviewSourceType } from '../../types/LinkPreview.std.ts';
import * as Errors from '../../types/errors.std.ts';
import { getAllComposableConversations } from '../selectors/conversations.dom.ts';
import { getIntl, getTheme, getRegionCode } from '../selectors/user.std.ts';
import { getLinkPreview } from '../selectors/linkPreviews.std.ts';
import { isInFullScreenCall as getIsInFullScreenCall } from '../selectors/calling.std.ts';
import { getPreferredBadgeSelector } from '../selectors/badges.preload.ts';
import { maybeForwardMessages } from '../../util/maybeForwardMessages.preload.ts';
import {
  maybeGrabLinkPreview,
  resetLinkPreview,
} from '../../services/LinkPreview.preload.ts';
import { useGlobalModalActions } from '../ducks/globalModals.preload.ts';
import { useLinkPreviewActions } from '../ducks/linkPreviews.preload.ts';
import { SmartCompositionTextArea } from './CompositionTextArea.preload.tsx';
import { useToastActions } from '../ducks/toast.preload.ts';
import { isDownloaded } from '../../util/Attachment.std.ts';
import { getMessageById } from '../../messages/getMessageById.preload.ts';
import { strictAssert } from '../../util/assert.std.ts';
import type {
  ForwardMessageData,
  MessageForwardDraft,
} from '../../types/ForwardDraft.std.ts';
import { getForwardMessagesProps } from '../selectors/globalModals.std.ts';
import { applyRangesToText } from '../../types/BodyRange.std.ts';

const log = createLogger('ForwardMessagesModal');

export function SmartForwardMessagesModal(): React.JSX.Element | null {
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
}): React.JSX.Element | null {
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
      return forwardMessagesProps.messageDrafts.map(draft => {
        // We don't keep @mention bodyRanges when forwarding, so we turn them to text
        const result = applyRangesToText(
          {
            body: draft.messageBody ?? '',
            bodyRanges: draft.bodyRanges ?? [],
          },
          {
            replaceMentions: true,
            replaceSpoilers: false,
          }
        );

        return {
          ...draft,
          messageBody: result.body,
          bodyRanges: result.bodyRanges,
        };
      });
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
