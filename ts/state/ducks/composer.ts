// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import path from 'path';

import { debounce } from 'lodash';
import type { ThunkAction } from 'redux-thunk';

import type {
  AddLinkPreviewActionType,
  RemoveLinkPreviewActionType,
} from './linkPreviews';
import type {
  AttachmentType,
  AttachmentDraftType,
  InMemoryAttachmentDraftType,
} from '../../types/Attachment';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import type {
  DraftBodyRangesType,
  ReplacementValuesType,
} from '../../types/Util';
import type { LinkPreviewType } from '../../types/message/LinkPreviews';
import type { MessageAttributesType } from '../../model-types.d';
import type { NoopActionType } from './noop';
import type { ShowToastActionType } from './toast';
import type { StateType as RootStateType } from '../reducer';
import type { UUIDStringType } from '../../types/UUID';
import * as log from '../../logging/log';
import * as Errors from '../../types/errors';
import {
  ADD_PREVIEW as ADD_LINK_PREVIEW,
  REMOVE_PREVIEW as REMOVE_LINK_PREVIEW,
} from './linkPreviews';
import { LinkPreviewSourceType } from '../../types/LinkPreview';
import { RecordingState } from './audioRecorder';
import { SHOW_TOAST } from './toast';
import { ToastType } from '../../types/Toast';
import { SafetyNumberChangeSource } from '../../components/SafetyNumberChangeDialog';
import { UUID } from '../../types/UUID';
import { assignWithNoUnnecessaryAllocation } from '../../util/assignWithNoUnnecessaryAllocation';
import { blockSendUntilConversationsAreVerified } from '../../util/blockSendUntilConversationsAreVerified';
import { clearConversationDraftAttachments } from '../../util/clearConversationDraftAttachments';
import { deleteDraftAttachment } from '../../util/deleteDraftAttachment';
import {
  getLinkPreviewForSend,
  hasLinkPreviewLoaded,
  maybeGrabLinkPreview,
  removeLinkPreview,
  resetLinkPreview,
  suspendLinkPreviews,
} from '../../services/LinkPreview';
import { getMaximumAttachmentSize } from '../../util/attachments';
import { getRecipientsByConversation } from '../../util/getRecipientsByConversation';
import {
  getRenderDetailsForLimit,
  processAttachment,
} from '../../util/processAttachment';
import { hasDraftAttachments } from '../../util/hasDraftAttachments';
import { isFileDangerous } from '../../util/isFileDangerous';
import { isImage, isVideo, stringToMIMEType } from '../../types/MIME';
import { isNotNil } from '../../util/isNotNil';
import { replaceIndex } from '../../util/replaceIndex';
import { resolveAttachmentDraftData } from '../../util/resolveAttachmentDraftData';
import { resolveDraftAttachmentOnDisk } from '../../util/resolveDraftAttachmentOnDisk';
import { shouldShowInvalidMessageToast } from '../../util/shouldShowInvalidMessageToast';
import { writeDraftAttachment } from '../../util/writeDraftAttachment';
import { getMessageById } from '../../messages/getMessageById';
import { canReply } from '../selectors/message';
import { getContactId } from '../../messages/helpers';
import { getConversationSelector } from '../selectors/conversations';
import { enqueueReactionForSend } from '../../reactions/enqueueReactionForSend';
import { useBoundActions } from '../../hooks/useBoundActions';
import { scrollToMessage } from './conversations';
import type { ScrollToMessageActionType } from './conversations';
import { longRunningTaskWrapper } from '../../util/longRunningTaskWrapper';

// State

export type ComposerStateType = {
  attachments: ReadonlyArray<AttachmentDraftType>;
  focusCounter: number;
  isDisabled: boolean;
  linkPreviewLoading: boolean;
  linkPreviewResult?: LinkPreviewType;
  messageCompositionId: UUIDStringType;
  quotedMessage?: Pick<MessageAttributesType, 'conversationId' | 'quote'>;
  shouldSendHighQualityAttachments?: boolean;
};

// Actions

const ADD_PENDING_ATTACHMENT = 'composer/ADD_PENDING_ATTACHMENT';
const REPLACE_ATTACHMENTS = 'composer/REPLACE_ATTACHMENTS';
const RESET_COMPOSER = 'composer/RESET_COMPOSER';
const SET_FOCUS = 'composer/SET_FOCUS';
const SET_HIGH_QUALITY_SETTING = 'composer/SET_HIGH_QUALITY_SETTING';
const SET_QUOTED_MESSAGE = 'composer/SET_QUOTED_MESSAGE';
const SET_COMPOSER_DISABLED = 'composer/SET_COMPOSER_DISABLED';

type AddPendingAttachmentActionType = {
  type: typeof ADD_PENDING_ATTACHMENT;
  payload: AttachmentDraftType;
};

export type ReplaceAttachmentsActionType = {
  type: typeof REPLACE_ATTACHMENTS;
  payload: ReadonlyArray<AttachmentDraftType>;
};

export type ResetComposerActionType = {
  type: typeof RESET_COMPOSER;
};

type SetComposerDisabledStateActionType = {
  type: typeof SET_COMPOSER_DISABLED;
  payload: boolean;
};

export type SetFocusActionType = {
  type: typeof SET_FOCUS;
};

type SetHighQualitySettingActionType = {
  type: typeof SET_HIGH_QUALITY_SETTING;
  payload: boolean;
};

export type SetQuotedMessageActionType = {
  type: typeof SET_QUOTED_MESSAGE;
  payload?: Pick<MessageAttributesType, 'conversationId' | 'quote'>;
};

type ComposerActionType =
  | AddLinkPreviewActionType
  | AddPendingAttachmentActionType
  | RemoveLinkPreviewActionType
  | ReplaceAttachmentsActionType
  | ResetComposerActionType
  | SetComposerDisabledStateActionType
  | SetFocusActionType
  | SetHighQualitySettingActionType
  | SetQuotedMessageActionType;

// Action Creators

export const actions = {
  addAttachment,
  addPendingAttachment,
  cancelJoinRequest,
  onClearAttachments,
  onCloseLinkPreview,
  onEditorStateChange,
  onTextTooLong,
  processAttachments,
  reactToMessage,
  removeAttachment,
  replaceAttachments,
  resetComposer,
  scrollToQuotedMessage,
  sendMultiMediaMessage,
  sendStickerMessage,
  setComposerDisabledState,
  setComposerFocus,
  setMediaQualitySetting,
  setQuoteByMessageId,
  setQuotedMessage,
};

export const useComposerActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

function onClearAttachments(conversationId: string): NoopActionType {
  const conversation = window.ConversationController.get(conversationId);
  if (!conversation) {
    throw new Error('onClearAttachments: No conversation found');
  }

  void clearConversationDraftAttachments(
    conversation.id,
    conversation.get('draftAttachments')
  );

  return {
    type: 'NOOP',
    payload: null,
  };
}

function cancelJoinRequest(conversationId: string): NoopActionType {
  const conversation = window.ConversationController.get(conversationId);
  if (!conversation) {
    throw new Error('cancelJoinRequest: No conversation found');
  }

  void longRunningTaskWrapper({
    idForLogging: conversation.idForLogging(),
    name: 'cancelJoinRequest',
    task: async () => conversation.cancelJoinRequest(),
  });

  return {
    type: 'NOOP',
    payload: null,
  };
}

function onCloseLinkPreview(): NoopActionType {
  suspendLinkPreviews();
  removeLinkPreview();

  return {
    type: 'NOOP',
    payload: null,
  };
}
function onTextTooLong(): ShowToastActionType {
  return {
    type: SHOW_TOAST,
    payload: {
      toastType: ToastType.MessageBodyTooLong,
    },
  };
}

function scrollToQuotedMessage({
  authorId,
  conversationId,
  sentAt,
}: Readonly<{
  authorId: string;
  conversationId: string;
  sentAt: number;
}>): ThunkAction<
  void,
  RootStateType,
  unknown,
  ShowToastActionType | ScrollToMessageActionType
> {
  return async (dispatch, getState) => {
    const messages = await window.Signal.Data.getMessagesBySentAt(sentAt);
    const message = messages.find(item =>
      Boolean(
        item.conversationId === conversationId &&
          authorId &&
          getContactId(item) === authorId
      )
    );

    if (!message) {
      dispatch({
        type: SHOW_TOAST,
        payload: {
          toastType: ToastType.OriginalMessageNotFound,
        },
      });
      return;
    }

    scrollToMessage(conversationId, message.id)(dispatch, getState, undefined);
  };
}

function sendMultiMediaMessage(
  conversationId: string,
  options: {
    draftAttachments?: ReadonlyArray<AttachmentDraftType>;
    mentions?: DraftBodyRangesType;
    message?: string;
    timestamp?: number;
    voiceNoteAttachment?: InMemoryAttachmentDraftType;
  }
): ThunkAction<
  void,
  RootStateType,
  unknown,
  | NoopActionType
  | ResetComposerActionType
  | SetComposerDisabledStateActionType
  | SetQuotedMessageActionType
  | ShowToastActionType
> {
  return async (dispatch, getState) => {
    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      throw new Error('sendMultiMediaMessage: No conversation found');
    }

    const {
      draftAttachments,
      message = '',
      mentions,
      timestamp = Date.now(),
      voiceNoteAttachment,
    } = options;

    const state = getState();

    const sendStart = Date.now();
    const recipientsByConversation = getRecipientsByConversation([
      conversation.attributes,
    ]);

    try {
      dispatch(setComposerDisabledState(true));

      const sendAnyway = await blockSendUntilConversationsAreVerified(
        recipientsByConversation,
        SafetyNumberChangeSource.MessageSend
      );
      if (!sendAnyway) {
        dispatch(setComposerDisabledState(false));
        return;
      }
    } catch (error) {
      dispatch(setComposerDisabledState(false));
      log.error('sendMessage error:', Errors.toLogFormat(error));
      return;
    }

    conversation.clearTypingTimers();

    const toastType = shouldShowInvalidMessageToast(conversation.attributes);
    if (toastType) {
      dispatch({
        type: SHOW_TOAST,
        payload: {
          toastType,
        },
      });
      dispatch(setComposerDisabledState(false));
      return;
    }

    if (
      !message.length &&
      !hasDraftAttachments(conversation.attributes.draftAttachments, {
        includePending: false,
      }) &&
      !voiceNoteAttachment
    ) {
      dispatch(setComposerDisabledState(false));
      return;
    }

    try {
      let attachments: Array<AttachmentType> = [];
      if (voiceNoteAttachment) {
        attachments = [voiceNoteAttachment];
      } else if (draftAttachments) {
        attachments = (
          await Promise.all(draftAttachments.map(resolveAttachmentDraftData))
        ).filter(isNotNil);
      }

      const quote = state.composer.quotedMessage?.quote;

      const shouldSendHighQualityAttachments = window.reduxStore
        ? state.composer.shouldSendHighQualityAttachments
        : undefined;

      const sendHQImages =
        shouldSendHighQualityAttachments !== undefined
          ? shouldSendHighQualityAttachments
          : state.items['sent-media-quality'] === 'high';

      const sendDelta = Date.now() - sendStart;

      log.info('Send pre-checks took', sendDelta, 'milliseconds');

      await conversation.enqueueMessageForSend(
        {
          body: message,
          attachments,
          quote,
          preview: getLinkPreviewForSend(message),
          mentions,
        },
        {
          sendHQImages,
          timestamp,
          extraReduxActions: () => {
            conversation.setMarkedUnread(false);
            resetLinkPreview();
            void clearConversationDraftAttachments(
              conversationId,
              draftAttachments
            );
            setQuoteByMessageId(conversationId, undefined)(
              dispatch,
              getState,
              undefined
            );
            dispatch(resetComposer());
            dispatch(setComposerDisabledState(false));
          },
        }
      );
    } catch (error) {
      log.error(
        'Error pulling attached files before send',
        Errors.toLogFormat(error)
      );
      dispatch(setComposerDisabledState(false));
    }
  };
}

function sendStickerMessage(
  conversationId: string,
  options: {
    packId: string;
    stickerId: number;
  }
): ThunkAction<
  void,
  RootStateType,
  unknown,
  NoopActionType | ShowToastActionType
> {
  return async dispatch => {
    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      throw new Error('sendStickerMessage: No conversation found');
    }

    const recipientsByConversation = getRecipientsByConversation([
      conversation.attributes,
    ]);

    try {
      const sendAnyway = await blockSendUntilConversationsAreVerified(
        recipientsByConversation,
        SafetyNumberChangeSource.MessageSend
      );
      if (!sendAnyway) {
        return;
      }

      const toastType = shouldShowInvalidMessageToast(conversation.attributes);
      if (toastType) {
        dispatch({
          type: SHOW_TOAST,
          payload: {
            toastType,
          },
        });
        return;
      }

      const { packId, stickerId } = options;
      void conversation.sendStickerMessage(packId, stickerId);
    } catch (error) {
      log.error('clickSend error:', Errors.toLogFormat(error));
    }

    dispatch({
      type: 'NOOP',
      payload: null,
    });
  };
}

// Not cool that we have to pull from ConversationModel here
// but if the current selected conversation isn't the one that we're operating
// on then we won't be able to grab attachments from state so we resort to the
// next in-memory store.
function getAttachmentsFromConversationModel(
  conversationId: string
): Array<AttachmentDraftType> {
  const conversation = window.ConversationController.get(conversationId);
  return conversation?.get('draftAttachments') || [];
}

export function setQuoteByMessageId(
  conversationId: string,
  messageId: string | undefined
): ThunkAction<
  void,
  RootStateType,
  unknown,
  SetComposerDisabledStateActionType | SetQuotedMessageActionType
> {
  return async (dispatch, getState) => {
    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      throw new Error('sendStickerMessage: No conversation found');
    }

    const message = messageId ? await getMessageById(messageId) : undefined;
    const state = getState();

    if (
      message &&
      !canReply(
        message.attributes,
        window.ConversationController.getOurConversationIdOrThrow(),
        getConversationSelector(state)
      )
    ) {
      return;
    }

    if (message && !message.isNormalBubble()) {
      return;
    }

    const existing = conversation.get('quotedMessageId');
    if (existing !== messageId) {
      const now = Date.now();
      let activeAt = conversation.get('active_at');
      let timestamp = conversation.get('timestamp');

      if (!activeAt && messageId) {
        activeAt = now;
        timestamp = now;
      }

      conversation.set({
        active_at: activeAt,
        draftChanged: true,
        quotedMessageId: messageId,
        timestamp,
      });

      window.Signal.Data.updateConversation(conversation.attributes);
    }

    if (message) {
      const quote = await conversation.makeQuote(message);
      dispatch(
        setQuotedMessage({
          conversationId,
          quote,
        })
      );

      dispatch(setComposerFocus(conversation.id));
      dispatch(setComposerDisabledState(false));
    } else {
      dispatch(setQuotedMessage(undefined));
    }
  };
}

function addAttachment(
  conversationId: string,
  attachment: InMemoryAttachmentDraftType
): ThunkAction<void, RootStateType, unknown, ReplaceAttachmentsActionType> {
  return async (dispatch, getState) => {
    // We do async operations first so multiple in-process addAttachments don't stomp on
    //   each other.
    const onDisk = await writeDraftAttachment(attachment);

    const isSelectedConversation =
      getState().conversations.selectedConversationId === conversationId;

    const draftAttachments = isSelectedConversation
      ? getState().composer.attachments
      : getAttachmentsFromConversationModel(conversationId);

    // We expect there to either be a pending draft attachment or an existing
    // attachment that we'll be replacing.
    const hasDraftAttachmentPending = draftAttachments.some(
      draftAttachment => draftAttachment.path === attachment.path
    );

    // User has canceled the draft so we don't need to continue processing
    if (!hasDraftAttachmentPending) {
      await deleteDraftAttachment(onDisk);
      return;
    }

    // Remove any pending attachments that were transcoding
    const index = draftAttachments.findIndex(
      draftAttachment => draftAttachment.path === attachment.path
    );
    let nextAttachments = draftAttachments;
    if (index < 0) {
      log.warn(
        `addAttachment: Failed to find pending attachment with path ${attachment.path}`
      );
      nextAttachments = [...draftAttachments, onDisk];
    } else {
      nextAttachments = replaceIndex(draftAttachments, index, onDisk);
    }

    replaceAttachments(conversationId, nextAttachments)(
      dispatch,
      getState,
      null
    );

    const conversation = window.ConversationController.get(conversationId);
    if (conversation) {
      conversation.attributes.draftAttachments = nextAttachments;
      window.Signal.Data.updateConversation(conversation.attributes);
    }
  };
}

function addPendingAttachment(
  conversationId: string,
  pendingAttachment: AttachmentDraftType
): ThunkAction<void, RootStateType, unknown, ReplaceAttachmentsActionType> {
  return (dispatch, getState) => {
    const isSelectedConversation =
      getState().conversations.selectedConversationId === conversationId;

    const draftAttachments = isSelectedConversation
      ? getState().composer.attachments
      : getAttachmentsFromConversationModel(conversationId);

    const nextAttachments = [...draftAttachments, pendingAttachment];

    dispatch({
      type: REPLACE_ATTACHMENTS,
      payload: nextAttachments,
    });

    const conversation = window.ConversationController.get(conversationId);
    if (conversation) {
      conversation.attributes.draftAttachments = nextAttachments;
      window.Signal.Data.updateConversation(conversation.attributes);
    }
  };
}

export function setComposerFocus(
  conversationId: string
): ThunkAction<void, RootStateType, unknown, SetFocusActionType> {
  return async (dispatch, getState) => {
    if (getState().conversations.selectedConversationId !== conversationId) {
      return;
    }

    dispatch({
      type: SET_FOCUS,
    });
  };
}

function onEditorStateChange(
  conversationId: string | undefined,
  messageText: string,
  bodyRanges: DraftBodyRangesType,
  caretLocation?: number
): NoopActionType {
  if (!conversationId) {
    throw new Error(
      'onEditorStateChange: Got falsey conversationId, needs local override'
    );
  }

  const conversation = window.ConversationController.get(conversationId);
  if (!conversation) {
    throw new Error('processAttachments: Unable to find conversation');
  }

  if (messageText.length && conversation.throttledBumpTyping) {
    conversation.throttledBumpTyping();
  }

  debouncedSaveDraft(conversationId, messageText, bodyRanges);

  // If we have attachments, don't add link preview
  if (!hasDraftAttachments(conversation.attributes, { includePending: true })) {
    maybeGrabLinkPreview(messageText, LinkPreviewSourceType.Composer, {
      caretLocation,
    });
  }

  return {
    type: 'NOOP',
    payload: null,
  };
}

function processAttachments({
  conversationId,
  files,
}: {
  conversationId: string;
  files: ReadonlyArray<File>;
}): ThunkAction<
  void,
  RootStateType,
  unknown,
  NoopActionType | ShowToastActionType
> {
  return async (dispatch, getState) => {
    if (!files.length) {
      return;
    }

    // If the call came from a conversation we are no longer in we do not
    // update the state.
    if (getState().conversations.selectedConversationId !== conversationId) {
      return;
    }

    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      throw new Error('processAttachments: Unable to find conv');
    }

    const state = getState();
    const isRecording =
      state.audioRecorder.recordingState === RecordingState.Recording;

    if (hasLinkPreviewLoaded() || isRecording) {
      return;
    }

    let toastToShow:
      | { toastType: ToastType; parameters?: ReplacementValuesType }
      | undefined;

    const nextDraftAttachments = (
      conversation.get('draftAttachments') || []
    ).slice();
    const filesToProcess: Array<File> = [];
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const processingResult = preProcessAttachment(file, nextDraftAttachments);
      if (processingResult != null) {
        toastToShow = processingResult;
      } else {
        const pendingAttachment = getPendingAttachment(file);
        if (pendingAttachment) {
          addPendingAttachment(conversationId, pendingAttachment)(
            dispatch,
            getState,
            undefined
          );
          filesToProcess.push(file);
          // we keep a running count of the draft attachments so we can show a
          // toast in case we add too many attachments at once
          nextDraftAttachments.push(pendingAttachment);
        }
      }
    }

    await Promise.all(
      filesToProcess.map(async file => {
        try {
          const attachment = await processAttachment(file);
          if (!attachment) {
            removeAttachment(conversationId, file.path)(
              dispatch,
              getState,
              undefined
            );
            return;
          }
          addAttachment(conversationId, attachment)(
            dispatch,
            getState,
            undefined
          );
        } catch (err) {
          log.error(
            'handleAttachmentsProcessing: failed to process attachment:',
            err.stack
          );
          removeAttachment(conversationId, file.path)(
            dispatch,
            getState,
            undefined
          );
          toastToShow = { toastType: ToastType.UnableToLoadAttachment };
        }
      })
    );

    if (toastToShow) {
      dispatch({
        type: SHOW_TOAST,
        payload: toastToShow,
      });

      return;
    }

    dispatch({
      type: 'NOOP',
      payload: null,
    });
  };
}

function preProcessAttachment(
  file: File,
  draftAttachments: Array<AttachmentDraftType>
): { toastType: ToastType; parameters?: ReplacementValuesType } | undefined {
  if (!file) {
    return;
  }

  const limitKb = getMaximumAttachmentSize();
  if (file.size > limitKb) {
    return {
      toastType: ToastType.FileSize,
      parameters: getRenderDetailsForLimit(limitKb),
    };
  }

  if (isFileDangerous(file.name)) {
    return { toastType: ToastType.DangerousFileType };
  }

  if (draftAttachments.length >= 32) {
    return { toastType: ToastType.MaxAttachments };
  }

  const haveNonImageOrVideo = draftAttachments.some(
    (attachment: AttachmentDraftType) => {
      return (
        !isImage(attachment.contentType) && !isVideo(attachment.contentType)
      );
    }
  );
  // You can't add another attachment if you already have a non-image staged
  if (haveNonImageOrVideo) {
    return { toastType: ToastType.UnsupportedMultiAttachment };
  }

  const fileType = stringToMIMEType(file.type);
  const imageOrVideo = isImage(fileType) || isVideo(fileType);

  // You can't add a non-image attachment if you already have attachments staged
  if (!imageOrVideo && draftAttachments.length > 0) {
    return { toastType: ToastType.CannotMixMultiAndNonMultiAttachments };
  }

  return undefined;
}

function getPendingAttachment(file: File): AttachmentDraftType | undefined {
  if (!file) {
    return;
  }

  const fileType = stringToMIMEType(file.type);
  const { name: fileName } = path.parse(file.name);

  return {
    contentType: fileType,
    fileName,
    size: file.size,
    path: file.name,
    pending: true,
  };
}

function removeAttachment(
  conversationId: string,
  filePath: string
): ThunkAction<void, RootStateType, unknown, ReplaceAttachmentsActionType> {
  return async (dispatch, getState) => {
    const { attachments } = getState().composer;

    const [targetAttachment] = attachments.filter(
      attachment => attachment.path === filePath
    );
    if (!targetAttachment) {
      return;
    }

    const nextAttachments = attachments.filter(
      attachment => attachment.path !== filePath
    );

    const conversation = window.ConversationController.get(conversationId);
    if (conversation) {
      conversation.attributes.draftAttachments = nextAttachments;
      conversation.attributes.draftChanged = true;
      window.Signal.Data.updateConversation(conversation.attributes);
    }

    replaceAttachments(conversationId, nextAttachments)(
      dispatch,
      getState,
      null
    );

    if (
      targetAttachment.path &&
      targetAttachment.fileName !== targetAttachment.path
    ) {
      await deleteDraftAttachment(targetAttachment);
    }
  };
}

export function replaceAttachments(
  conversationId: string,
  attachments: ReadonlyArray<AttachmentDraftType>
): ThunkAction<void, RootStateType, unknown, ReplaceAttachmentsActionType> {
  return (dispatch, getState) => {
    // If the call came from a conversation we are no longer in we do not
    // update the state.
    if (getState().conversations.selectedConversationId !== conversationId) {
      return;
    }

    if (hasDraftAttachments(attachments, { includePending: true })) {
      removeLinkPreview();
    }

    dispatch({
      type: REPLACE_ATTACHMENTS,
      payload: attachments.map(resolveDraftAttachmentOnDisk),
    });
  };
}

function reactToMessage(
  messageId: string,
  reaction: { emoji: string; remove: boolean }
): ThunkAction<
  void,
  RootStateType,
  unknown,
  NoopActionType | ShowToastActionType
> {
  return async dispatch => {
    const { emoji, remove } = reaction;
    try {
      await enqueueReactionForSend({
        messageId,
        emoji,
        remove,
      });
      dispatch({
        type: 'NOOP',
        payload: null,
      });
    } catch (error) {
      log.error(
        'reactToMessage: Error sending reaction',
        error,
        messageId,
        reaction
      );
      dispatch({
        type: SHOW_TOAST,
        payload: {
          toastType: ToastType.ReactionFailed,
        },
      });
    }
  };
}

export function resetComposer(): ResetComposerActionType {
  return {
    type: RESET_COMPOSER,
  };
}
const debouncedSaveDraft = debounce(saveDraft);

function saveDraft(
  conversationId: string,
  messageText: string,
  bodyRanges: DraftBodyRangesType
) {
  const conversation = window.ConversationController.get(conversationId);
  if (!conversation) {
    throw new Error('saveDraft: Unable to find conversation');
  }

  const trimmed =
    messageText && messageText.length > 0 ? messageText.trim() : '';

  if (conversation.get('draft') && (!messageText || trimmed.length === 0)) {
    conversation.set({
      draft: null,
      draftChanged: true,
      draftBodyRanges: [],
    });
    window.Signal.Data.updateConversation(conversation.attributes);
    return;
  }

  if (messageText !== conversation.get('draft')) {
    const now = Date.now();
    let activeAt = conversation.get('active_at');
    let timestamp = conversation.get('timestamp');

    if (!activeAt) {
      activeAt = now;
      timestamp = now;
    }

    conversation.set({
      active_at: activeAt,
      draft: messageText,
      draftBodyRanges: bodyRanges,
      draftChanged: true,
      timestamp,
    });
    window.Signal.Data.updateConversation(conversation.attributes);
  }
}

function setComposerDisabledState(
  value: boolean
): SetComposerDisabledStateActionType {
  return {
    type: SET_COMPOSER_DISABLED,
    payload: value,
  };
}

function setMediaQualitySetting(
  payload: boolean
): SetHighQualitySettingActionType {
  return {
    type: SET_HIGH_QUALITY_SETTING,
    payload,
  };
}

function setQuotedMessage(
  payload?: Pick<MessageAttributesType, 'conversationId' | 'quote' | 'payment'>
): SetQuotedMessageActionType {
  return {
    type: SET_QUOTED_MESSAGE,
    payload,
  };
}

// Reducer

export function getEmptyState(): ComposerStateType {
  return {
    attachments: [],
    focusCounter: 0,
    isDisabled: false,
    linkPreviewLoading: false,
    messageCompositionId: UUID.generate().toString(),
  };
}

export function reducer(
  state: Readonly<ComposerStateType> = getEmptyState(),
  action: Readonly<ComposerActionType>
): ComposerStateType {
  if (action.type === RESET_COMPOSER) {
    return getEmptyState();
  }

  if (action.type === REPLACE_ATTACHMENTS) {
    const { payload: attachments } = action;
    return {
      ...state,
      attachments,
      ...(attachments.length
        ? {}
        : { shouldSendHighQualityAttachments: undefined }),
    };
  }

  if (action.type === SET_FOCUS) {
    return {
      ...state,
      focusCounter: state.focusCounter + 1,
    };
  }

  if (action.type === SET_HIGH_QUALITY_SETTING) {
    return {
      ...state,
      shouldSendHighQualityAttachments: action.payload,
    };
  }

  if (action.type === SET_QUOTED_MESSAGE) {
    return {
      ...state,
      quotedMessage: action.payload,
    };
  }

  if (action.type === ADD_LINK_PREVIEW) {
    if (action.payload.source !== LinkPreviewSourceType.Composer) {
      return state;
    }

    return {
      ...state,
      linkPreviewLoading: true,
      linkPreviewResult: action.payload.linkPreview,
    };
  }

  if (action.type === REMOVE_LINK_PREVIEW) {
    return assignWithNoUnnecessaryAllocation(state, {
      linkPreviewLoading: false,
      linkPreviewResult: undefined,
    });
  }

  if (action.type === ADD_PENDING_ATTACHMENT) {
    return {
      ...state,
      attachments: [...state.attachments, action.payload],
    };
  }

  if (action.type === SET_COMPOSER_DISABLED) {
    return {
      ...state,
      isDisabled: action.payload,
    };
  }

  return state;
}
