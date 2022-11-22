// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { useSelector } from 'react-redux';
import type { DraftBodyRangesType } from '../../types/Util';
import type { ForwardMessagePropsType } from '../ducks/globalModals';
import type { StateType } from '../reducer';
import * as log from '../../logging/log';
import { ForwardMessageModal } from '../../components/ForwardMessageModal';
import { LinkPreviewSourceType } from '../../types/LinkPreview';
import * as Errors from '../../types/errors';
import type { GetConversationByIdType } from '../selectors/conversations';
import {
  getAllComposableConversations,
  getConversationSelector,
} from '../selectors/conversations';
import { getIntl, getTheme, getRegionCode } from '../selectors/user';
import { getLinkPreview } from '../selectors/linkPreviews';
import { getMessageById } from '../../messages/getMessageById';
import { getPreferredBadgeSelector } from '../selectors/badges';
import { maybeForwardMessage } from '../../util/maybeForwardMessage';
import {
  maybeGrabLinkPreview,
  resetLinkPreview,
} from '../../services/LinkPreview';
import { useGlobalModalActions } from '../ducks/globalModals';
import { useLinkPreviewActions } from '../ducks/linkPreviews';
import { processBodyRanges } from '../selectors/message';
import { getTextWithMentions } from '../../util/getTextWithMentions';
import { SmartCompositionTextArea } from './CompositionTextArea';

function renderMentions(
  message: ForwardMessagePropsType,
  conversationSelector: GetConversationByIdType
): string | undefined {
  const { text } = message;

  if (!text) {
    return text;
  }

  const bodyRanges = processBodyRanges(message, {
    conversationSelector,
  });

  if (bodyRanges && bodyRanges.length) {
    return getTextWithMentions(bodyRanges, text);
  }

  return text;
}

export function SmartForwardMessageModal(): JSX.Element | null {
  const forwardMessageProps = useSelector<
    StateType,
    ForwardMessagePropsType | undefined
  >(state => state.globalModals.forwardMessageProps);
  const candidateConversations = useSelector(getAllComposableConversations);
  const getPreferredBadge = useSelector(getPreferredBadgeSelector);
  const getConversation = useSelector(getConversationSelector);
  const i18n = useSelector(getIntl);
  const linkPreviewForSource = useSelector(getLinkPreview);
  const regionCode = useSelector(getRegionCode);
  const theme = useSelector(getTheme);

  const { removeLinkPreview } = useLinkPreviewActions();
  const { toggleForwardMessageModal } = useGlobalModalActions();

  if (!forwardMessageProps) {
    return null;
  }

  const { attachments = [] } = forwardMessageProps;

  function closeModal() {
    resetLinkPreview();
    toggleForwardMessageModal();
  }

  const cleanedBody = renderMentions(forwardMessageProps, getConversation);

  return (
    <ForwardMessageModal
      attachments={attachments}
      candidateConversations={candidateConversations}
      doForwardMessage={async (
        conversationIds,
        messageBody,
        includedAttachments,
        linkPreview
      ) => {
        try {
          const message = await getMessageById(forwardMessageProps.id);
          if (!message) {
            throw new Error('No message found');
          }

          const didForwardSuccessfully = await maybeForwardMessage(
            message.attributes,
            conversationIds,
            messageBody,
            includedAttachments,
            linkPreview
          );

          if (didForwardSuccessfully) {
            closeModal();
          }
        } catch (err) {
          log.warn('doForwardMessage', Errors.toLogFormat(err));
        }
      }}
      getPreferredBadge={getPreferredBadge}
      hasContact={Boolean(forwardMessageProps.contact)}
      i18n={i18n}
      isSticker={Boolean(forwardMessageProps.isSticker)}
      linkPreview={linkPreviewForSource(
        LinkPreviewSourceType.ForwardMessageModal
      )}
      messageBody={cleanedBody}
      onClose={closeModal}
      onEditorStateChange={(
        messageText: string,
        _: DraftBodyRangesType,
        caretLocation?: number
      ) => {
        if (!attachments.length) {
          maybeGrabLinkPreview(
            messageText,
            LinkPreviewSourceType.ForwardMessageModal,
            { caretLocation }
          );
        }
      }}
      regionCode={regionCode}
      RenderCompositionTextArea={SmartCompositionTextArea}
      removeLinkPreview={removeLinkPreview}
      theme={theme}
    />
  );
}
