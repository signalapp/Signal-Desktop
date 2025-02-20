// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import path from 'path';
import { debounce, isEqual } from 'lodash';
import type { ThunkAction, ThunkDispatch } from 'redux-thunk';
import { v4 as generateUuid } from 'uuid';
import { webUtils } from 'electron';

import type { ReadonlyDeep } from 'type-fest';
import type {
  AddLinkPreviewActionType,
  RemoveLinkPreviewActionType,
} from './linkPreviews';
import {
  type AttachmentType,
  type AttachmentDraftType,
  type InMemoryAttachmentDraftType,
  isVideoAttachment,
  isImageAttachment,
} from '../../types/Attachment';
import { DataReader, DataWriter } from '../../sql/Client';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import type { DraftBodyRanges } from '../../types/BodyRange';
import type { LinkPreviewType } from '../../types/message/LinkPreviews';
import type { ReadonlyMessageAttributesType } from '../../model-types.d';
import type { NoopActionType } from './noop';
import type { ShowToastActionType } from './toast';
import type { StateType as RootStateType } from '../reducer';
import * as log from '../../logging/log';
import * as Errors from '../../types/errors';
import {
  ADD_PREVIEW as ADD_LINK_PREVIEW,
  REMOVE_PREVIEW as REMOVE_LINK_PREVIEW,
} from './linkPreviews';
import { LinkPreviewSourceType } from '../../types/LinkPreview';
import type { AciString } from '../../types/ServiceId';
import { completeRecording, getIsRecording } from './audioRecorder';
import { SHOW_TOAST } from './toast';
import type { AnyToast } from '../../types/Toast';
import { ToastType } from '../../types/Toast';
import { SafetyNumberChangeSource } from '../../components/SafetyNumberChangeDialog';
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
import {
  getMaximumOutgoingAttachmentSizeInKb,
  getRenderDetailsForLimit,
  KIBIBYTE,
} from '../../types/AttachmentSize';
import { getValue as getRemoteConfigValue } from '../../RemoteConfig';
import { getRecipientsByConversation } from '../../util/getRecipientsByConversation';
import { processAttachment } from '../../util/processAttachment';
import { hasDraftAttachments } from '../../util/hasDraftAttachments';
import { isFileDangerous } from '../../util/isFileDangerous';
import { stringToMIMEType } from '../../types/MIME';
import { isNotNil } from '../../util/isNotNil';
import { replaceIndex } from '../../util/replaceIndex';
import { resolveAttachmentDraftData } from '../../util/resolveAttachmentDraftData';
import { resolveDraftAttachmentOnDisk } from '../../util/resolveDraftAttachmentOnDisk';
import { shouldShowInvalidMessageToast } from '../../util/shouldShowInvalidMessageToast';
import { writeDraftAttachment } from '../../util/writeDraftAttachment';
import { getMessageById } from '../../messages/getMessageById';
import { canReply, isNormalBubble } from '../selectors/message';
import { getAuthorId } from '../../messages/helpers';
import { getConversationSelector } from '../selectors/conversations';
import { enqueueReactionForSend } from '../../reactions/enqueueReactionForSend';
import { useBoundActions } from '../../hooks/useBoundActions';
import {
  CONVERSATION_UNLOADED,
  TARGETED_CONVERSATION_CHANGED,
  scrollToMessage,
} from './conversations';
import type {
  ConversationUnloadedActionType,
  TargetedConversationChangedActionType,
  ScrollToMessageActionType,
} from './conversations';
import { longRunningTaskWrapper } from '../../util/longRunningTaskWrapper';
import { drop } from '../../util/drop';
import { strictAssert } from '../../util/assert';
import { makeQuote } from '../../util/makeQuote';
import { sendEditedMessage as doSendEditedMessage } from '../../util/sendEditedMessage';
import { Sound, SoundType } from '../../util/Sound';
import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from '../../util/GoogleChrome';

// State
// eslint-disable-next-line local-rules/type-alias-readonlydeep
type ComposerStateByConversationType = {
  attachments: ReadonlyArray<AttachmentDraftType>;
  focusCounter: number;
  isDisabled: boolean;
  linkPreviewLoading: boolean;
  linkPreviewResult?: LinkPreviewType;
  messageCompositionId: string;
  quotedMessage?: QuotedMessageForComposerType;
  sendCounter: number;
  shouldSendHighQualityAttachments?: boolean;
};

export type QuotedMessageForComposerType = ReadonlyDeep<{
  conversationId: ReadonlyMessageAttributesType['conversationId'];
  quote: ReadonlyMessageAttributesType['quote'] & {
    messageId?: string;
  };
}>;

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type ComposerStateType = {
  conversations: Record<string, ComposerStateByConversationType>;
};

function getEmptyComposerState(): ComposerStateByConversationType {
  return {
    attachments: [],
    focusCounter: 0,
    isDisabled: false,
    linkPreviewLoading: false,
    messageCompositionId: generateUuid(),
    sendCounter: 0,
  };
}

export function getComposerStateForConversation(
  composer: ComposerStateType,
  conversationId: string
): ComposerStateByConversationType {
  return composer.conversations[conversationId] ?? getEmptyComposerState();
}

// Actions

const ADD_PENDING_ATTACHMENT = 'composer/ADD_PENDING_ATTACHMENT';
const INCREMENT_SEND_COUNTER = 'composer/INCREMENT_SEND_COUNTER';
const REPLACE_ATTACHMENTS = 'composer/REPLACE_ATTACHMENTS';
const RESET_COMPOSER = 'composer/RESET_COMPOSER';
export const SET_FOCUS = 'composer/SET_FOCUS';
const SET_HIGH_QUALITY_SETTING = 'composer/SET_HIGH_QUALITY_SETTING';
const SET_QUOTED_MESSAGE = 'composer/SET_QUOTED_MESSAGE';
const SET_COMPOSER_DISABLED = 'composer/SET_COMPOSER_DISABLED';

type AddPendingAttachmentActionType = ReadonlyDeep<{
  type: typeof ADD_PENDING_ATTACHMENT;
  payload: {
    conversationId: string;
    attachment: AttachmentDraftType;
  };
}>;

export type IncrementSendActionType = ReadonlyDeep<{
  type: typeof INCREMENT_SEND_COUNTER;
  payload: {
    conversationId: string;
  };
}>;

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type ReplaceAttachmentsActionType = {
  type: typeof REPLACE_ATTACHMENTS;
  payload: {
    conversationId: string;
    attachments: ReadonlyArray<AttachmentDraftType>;
  };
};

export type ResetComposerActionType = ReadonlyDeep<{
  type: typeof RESET_COMPOSER;
  payload: {
    conversationId: string;
  };
}>;

type SetComposerDisabledStateActionType = ReadonlyDeep<{
  type: typeof SET_COMPOSER_DISABLED;
  payload: {
    conversationId: string;
    value: boolean;
  };
}>;

export type SetFocusActionType = ReadonlyDeep<{
  type: typeof SET_FOCUS;
  payload: {
    conversationId: string;
  };
}>;

type SetHighQualitySettingActionType = ReadonlyDeep<{
  type: typeof SET_HIGH_QUALITY_SETTING;
  payload: {
    conversationId: string;
    value: boolean;
  };
}>;

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type SetQuotedMessageActionType = {
  type: typeof SET_QUOTED_MESSAGE;
  payload: {
    conversationId: string;
    quotedMessage?: QuotedMessageForComposerType;
  };
};

// eslint-disable-next-line local-rules/type-alias-readonlydeep
type ComposerActionType =
  | AddLinkPreviewActionType
  | AddPendingAttachmentActionType
  | ConversationUnloadedActionType
  | IncrementSendActionType
  | RemoveLinkPreviewActionType
  | ReplaceAttachmentsActionType
  | ResetComposerActionType
  | TargetedConversationChangedActionType
  | SetComposerDisabledStateActionType
  | SetFocusActionType
  | SetHighQualitySettingActionType
  | SetQuotedMessageActionType;

// Action Creators

export const actions = {
  addAttachment,
  addPendingAttachment,
  cancelJoinRequest,
  incrementSendCounter,
  onClearAttachments,
  onCloseLinkPreview,
  onEditorStateChange,
  onTextTooLong,
  processAttachments,
  reactToMessage,
  removeAttachment,
  replaceAttachments,
  resetComposer,
  saveDraftRecordingIfNeeded,
  scrollToQuotedMessage,
  sendEditedMessage,
  sendMultiMediaMessage,
  sendStickerMessage,
  setComposerDisabledState,
  setComposerFocus,
  setMediaQualitySetting,
  setQuoteByMessageId,
  setQuotedMessage,
};

function incrementSendCounter(conversationId: string): IncrementSendActionType {
  return {
    type: INCREMENT_SEND_COUNTER,
    payload: {
      conversationId,
    },
  };
}

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

function onCloseLinkPreview(conversationId: string): NoopActionType {
  suspendLinkPreviews();
  removeLinkPreview(conversationId);

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
    const messages = await DataReader.getMessagesBySentAt(sentAt);
    const message = messages.find(item =>
      Boolean(
        item.conversationId === conversationId &&
          authorId &&
          getAuthorId(item) === authorId
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

    if (getState().conversations.selectedConversationId !== conversationId) {
      return;
    }

    scrollToMessage(conversationId, message.id)(dispatch, getState, undefined);
  };
}

export function saveDraftRecordingIfNeeded(): ThunkAction<
  void,
  RootStateType,
  unknown,
  never
> {
  return (dispatch, getState) => {
    const { conversations, audioRecorder } = getState();
    const { selectedConversationId: conversationId } = conversations;

    if (!getIsRecording(audioRecorder) || !conversationId) {
      return;
    }

    dispatch(
      completeRecording(conversationId, attachment => {
        dispatch(
          addPendingAttachment(conversationId, { ...attachment, pending: true })
        );
        dispatch(addAttachment(conversationId, attachment));

        const conversation = window.ConversationController.get(conversationId);
        if (!conversation) {
          throw new Error('saveDraftRecordingIfNeeded: No conversation found');
        }

        drop(conversation.updateLastMessage());
      })
    );
  };
}

// eslint-disable-next-line local-rules/type-alias-readonlydeep
type WithPreSendChecksOptions = Readonly<{
  message?: string;
  voiceNoteAttachment?: InMemoryAttachmentDraftType;
}>;

async function withPreSendChecks(
  conversationId: string,
  options: WithPreSendChecksOptions,
  dispatch: ThunkDispatch<
    RootStateType,
    unknown,
    SetComposerDisabledStateActionType | ShowToastActionType
  >,
  body: () => Promise<void>
): Promise<void> {
  const conversation = window.ConversationController.get(conversationId);
  if (!conversation) {
    throw new Error('sendMultiMediaMessage: No conversation found');
  }

  const sendStart = Date.now();
  const recipientsByConversation = getRecipientsByConversation([
    conversation.attributes,
  ]);

  const { message, voiceNoteAttachment } = options;

  try {
    dispatch(setComposerDisabledState(conversationId, true));

    try {
      const sendAnyway = await blockSendUntilConversationsAreVerified(
        recipientsByConversation,
        SafetyNumberChangeSource.MessageSend
      );
      if (!sendAnyway) {
        dispatch(setComposerDisabledState(conversationId, false));
        return;
      }
    } catch (error) {
      log.error(
        'withPreSendChecks block until verified error:',
        Errors.toLogFormat(error)
      );
      return;
    }

    const toast = shouldShowInvalidMessageToast(conversation.attributes);
    if (toast != null) {
      dispatch({
        type: SHOW_TOAST,
        payload: toast,
      });
      return;
    }

    if (
      !message?.length &&
      !hasDraftAttachments(conversation.attributes.draftAttachments, {
        includePending: false,
      }) &&
      !voiceNoteAttachment
    ) {
      return;
    }

    const sendDelta = Date.now() - sendStart;
    log.info(`withPreSendChecks: Send pre-checks took ${sendDelta}ms`);

    await body();
  } finally {
    dispatch(setComposerDisabledState(conversationId, false));
  }

  conversation.clearTypingTimers();
}

function sendEditedMessage(
  conversationId: string,
  options: WithPreSendChecksOptions & {
    bodyRanges?: DraftBodyRanges;
    targetMessageId: string;
    quoteAuthorAci?: AciString;
    quoteSentAt?: number;
  }
): ThunkAction<
  void,
  RootStateType,
  unknown,
  SetComposerDisabledStateActionType | ShowToastActionType
> {
  return async dispatch => {
    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      throw new Error('sendEditedMessage: No conversation found');
    }

    const {
      message = '',
      bodyRanges,
      quoteSentAt,
      quoteAuthorAci,
      targetMessageId,
    } = options;

    await withPreSendChecks(conversationId, options, dispatch, async () => {
      try {
        await doSendEditedMessage(conversationId, {
          body: message,
          bodyRanges,
          preview: getLinkPreviewForSend(message),
          quoteAuthorAci,
          quoteSentAt,
          targetMessageId,
        });
      } catch (error) {
        log.error('sendEditedMessage', Errors.toLogFormat(error));
        if (error.toastType) {
          dispatch({
            type: SHOW_TOAST,
            payload: {
              toastType: error.toastType,
            },
          });
        }
      }
    });
  };
}

function sendMultiMediaMessage(
  conversationId: string,
  options: WithPreSendChecksOptions & {
    bodyRanges?: DraftBodyRanges;
    draftAttachments?: ReadonlyArray<AttachmentDraftType>;
    timestamp?: number;
  }
): ThunkAction<
  void,
  RootStateType,
  unknown,
  | IncrementSendActionType
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
      bodyRanges,
      message = '',
      timestamp = Date.now(),
      voiceNoteAttachment,
    } = options;

    const state = getState();

    await withPreSendChecks(conversationId, options, dispatch, async () => {
      let attachments: Array<AttachmentType> = [];
      if (voiceNoteAttachment) {
        attachments = [voiceNoteAttachment];
      } else if (draftAttachments) {
        attachments = (
          await Promise.all(draftAttachments.map(resolveAttachmentDraftData))
        ).filter(isNotNil);
      }

      const conversationComposerState = getComposerStateForConversation(
        state.composer,
        conversationId
      );

      const quote = conversationComposerState.quotedMessage?.quote;

      const shouldSendHighQualityAttachments = window.reduxStore
        ? conversationComposerState.shouldSendHighQualityAttachments
        : undefined;

      const sendHQImages =
        shouldSendHighQualityAttachments !== undefined
          ? shouldSendHighQualityAttachments
          : state.items['sent-media-quality'] === 'high';

      try {
        await conversation.enqueueMessageForSend(
          {
            body: message,
            attachments,
            quote,
            preview: getLinkPreviewForSend(message),
            bodyRanges,
          },
          {
            sendHQImages,
            timestamp,
            // We rely on enqueueMessageForSend to call these within redux's batch
            extraReduxActions: () => {
              conversation.setMarkedUnread(false);
              resetLinkPreview(conversationId);
              drop(
                clearConversationDraftAttachments(
                  conversationId,
                  draftAttachments
                )
              );
              setQuoteByMessageId(conversationId, undefined)(
                dispatch,
                getState,
                undefined
              );
              dispatch(incrementSendCounter(conversationId));
              dispatch(setComposerDisabledState(conversationId, false));

              if (state.items.audioMessage) {
                drop(new Sound({ soundType: SoundType.Whoosh }).play());
              }
            },
          }
        );
      } catch (error) {
        log.error(
          'Error pulling attached files before send',
          Errors.toLogFormat(error)
        );
      }
    });
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

      const toast = shouldShowInvalidMessageToast(conversation.attributes);
      if (toast != null) {
        dispatch({
          type: SHOW_TOAST,
          payload: toast,
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
): ReadonlyArray<AttachmentDraftType> {
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
      throw new Error('setQuoteByMessageId: No conversation found');
    }

    const draftEditMessage = conversation.get('draftEditMessage');
    // We can remove quotes, but we can't add them
    if (draftEditMessage && messageId) {
      return;
    }
    if (draftEditMessage && draftEditMessage.quote) {
      conversation.set({
        draftEditMessage: {
          ...draftEditMessage,
          quote: undefined,
        },
      });
      dispatch(setComposerFocus(conversation.id));
      return;
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

    if (message && !isNormalBubble(message.attributes)) {
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

      await DataWriter.updateConversation(conversation.attributes);
    }

    if (message) {
      const quote = await makeQuote(message.attributes);

      // In case the conversation changed while we were about to set the quote
      if (getState().conversations.selectedConversationId !== conversationId) {
        return;
      }

      dispatch(
        setQuotedMessage(conversationId, {
          conversationId,
          quote,
        })
      );

      dispatch(setComposerFocus(conversation.id));
      dispatch(setComposerDisabledState(conversationId, false));
    } else {
      dispatch(setQuotedMessage(conversationId, undefined));
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
    const toAdd = { ...onDisk, clientUuid: generateUuid() };

    const state = getState();

    const isSelectedConversation =
      state.conversations.selectedConversationId === conversationId;

    const conversationComposerState = getComposerStateForConversation(
      state.composer,
      conversationId
    );

    const draftAttachments = isSelectedConversation
      ? conversationComposerState.attachments
      : getAttachmentsFromConversationModel(conversationId);

    // We expect there to either be a pending draft attachment or an existing
    // attachment that we'll be replacing.
    const hasDraftAttachmentPending = draftAttachments.some(
      draftAttachment => draftAttachment.path === attachment.path
    );

    // User has canceled the draft so we don't need to continue processing
    if (!hasDraftAttachmentPending) {
      await deleteDraftAttachment(toAdd);
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
      nextAttachments = [...draftAttachments, toAdd];
    } else {
      nextAttachments = replaceIndex(draftAttachments, index, toAdd);
    }

    replaceAttachments(conversationId, nextAttachments)(
      dispatch,
      getState,
      null
    );

    const conversation = window.ConversationController.get(conversationId);
    if (conversation) {
      conversation.set({
        draftAttachments: nextAttachments,
        draftChanged: true,
      });

      // if the conversation has already unloaded
      if (!isSelectedConversation) {
        const now = Date.now();
        const activeAt = conversation.get('active_at') || now;
        conversation.set({
          active_at: activeAt,
          draftChanged: false,
          draftTimestamp: now,
          timestamp: now,
        });
      }

      await DataWriter.updateConversation(conversation.attributes);
    }
  };
}

function addPendingAttachment(
  conversationId: string,
  pendingAttachment: AttachmentDraftType
): ThunkAction<void, RootStateType, unknown, ReplaceAttachmentsActionType> {
  return (dispatch, getState) => {
    const state = getState();

    const isSelectedConversation =
      state.conversations.selectedConversationId === conversationId;

    const conversationComposerState = getComposerStateForConversation(
      state.composer,
      conversationId
    );

    const draftAttachments = isSelectedConversation
      ? conversationComposerState.attachments
      : getAttachmentsFromConversationModel(conversationId);

    const nextAttachments = [...draftAttachments, pendingAttachment];

    dispatch({
      type: REPLACE_ATTACHMENTS,
      payload: {
        conversationId,
        attachments: nextAttachments,
      },
    });

    const conversation = window.ConversationController.get(conversationId);
    if (conversation) {
      conversation.attributes.draftAttachments = nextAttachments;
      conversation.attributes.draftChanged = true;
      drop(DataWriter.updateConversation(conversation.attributes));
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
      payload: {
        conversationId,
      },
    });
  };
}

function onEditorStateChange({
  bodyRanges,
  caretLocation,
  conversationId,
  messageText,
  sendCounter,
}: {
  bodyRanges: DraftBodyRanges;
  caretLocation?: number;
  conversationId: string | undefined;
  messageText: string;
  sendCounter: number;
}): ThunkAction<void, RootStateType, unknown, NoopActionType> {
  return (dispatch, getState) => {
    if (!conversationId) {
      throw new Error(
        'onEditorStateChange: Got falsey conversationId, needs local override'
      );
    }

    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      throw new Error('processAttachments: Unable to find conversation');
    }

    const state = getState().composer.conversations[conversationId];
    if (!state) {
      return;
    }

    if (state.sendCounter !== sendCounter) {
      log.warn(
        `onEditorStateChange: Got update for conversation ${conversation.idForLogging()}`,
        `but sendCounter doesnt match (old: ${state.sendCounter}, new: ${sendCounter})`
      );
      return;
    }

    debouncedSaveDraft(conversationId, messageText, bodyRanges);

    // If we have attachments, don't add link preview
    if (
      hasDraftAttachments(conversation.attributes.draftAttachments, {
        includePending: true,
      }) ||
      Boolean(conversation.attributes.draftEditMessage?.attachmentThumbnail)
    ) {
      return;
    }

    maybeGrabLinkPreview(messageText, LinkPreviewSourceType.Composer, {
      caretLocation,
      conversationId,
    });

    dispatch({
      type: 'NOOP',
      payload: null,
    });
  };
}

function processAttachments({
  conversationId,
  files,
  flags,
}: {
  conversationId: string;
  files: ReadonlyArray<File>;
  flags: number | null;
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

    const draftEditMessage = conversation.get('draftEditMessage');
    if (draftEditMessage) {
      return;
    }

    const { audioRecorder } = getState();

    if (hasLinkPreviewLoaded() || getIsRecording(audioRecorder)) {
      return;
    }

    let toastToShow: AnyToast | undefined;

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
          const attachment = await processAttachment(file, {
            generateScreenshot: true,
            flags,
          });
          if (!attachment) {
            removeAttachment(conversationId, webUtils.getPathForFile(file))(
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
          removeAttachment(conversationId, webUtils.getPathForFile(file))(
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
): AnyToast | undefined {
  if (!file) {
    return;
  }

  if (isFileDangerous(file.name)) {
    return { toastType: ToastType.DangerousFileType };
  }

  if (draftAttachments.length >= 32) {
    return { toastType: ToastType.MaxAttachments };
  }

  const haveNonImageOrVideo = draftAttachments.some(
    (attachment: AttachmentDraftType) => {
      return !isImageAttachment(attachment) && !isVideoAttachment(attachment);
    }
  );
  // You can't add another attachment if you already have a non-image staged
  if (haveNonImageOrVideo) {
    return { toastType: ToastType.UnsupportedMultiAttachment };
  }

  const fileType = stringToMIMEType(file.type);
  const imageOrVideo =
    isImageTypeSupported(fileType) || isVideoTypeSupported(fileType);

  // You can't add a non-image attachment if you already have attachments staged
  if (!imageOrVideo && draftAttachments.length > 0) {
    return { toastType: ToastType.CannotMixMultiAndNonMultiAttachments };
  }

  // Putting this after everything else because the other checks are more
  // important to show to the user.
  const limitKb = getMaximumOutgoingAttachmentSizeInKb(getRemoteConfigValue);
  if (file.size / KIBIBYTE > limitKb) {
    return {
      toastType: ToastType.FileSize,
      parameters: getRenderDetailsForLimit(limitKb),
    };
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
    clientUuid: generateUuid(),
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
    const state = getState();

    const { attachments } = getComposerStateForConversation(
      state.composer,
      conversationId
    );

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
      await DataWriter.updateConversation(conversation.attributes);
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
      removeLinkPreview(conversationId);
    }

    dispatch({
      type: REPLACE_ATTACHMENTS,
      payload: {
        conversationId,
        attachments: attachments.map(resolveDraftAttachmentOnDisk),
      },
    });
    dispatch(setComposerFocus(conversationId));
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

export function resetComposer(conversationId: string): ResetComposerActionType {
  return {
    type: RESET_COMPOSER,
    payload: {
      conversationId,
    },
  };
}
const debouncedSaveDraft = debounce(saveDraft, 100);

function saveDraft(
  conversationId: string,
  messageText: string,
  bodyRanges: DraftBodyRanges
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
    drop(DataWriter.updateConversation(conversation.attributes));
    return;
  }

  if (
    messageText !== conversation.get('draft') ||
    !isEqual(bodyRanges, conversation.get('draftBodyRanges'))
  ) {
    const now = Date.now();
    let activeAt = conversation.get('active_at');
    let timestamp = conversation.get('timestamp');

    if (!activeAt) {
      activeAt = now;
      timestamp = now;
    }

    if (messageText.length && conversation.throttledBumpTyping) {
      conversation.throttledBumpTyping();
    }

    conversation.set({
      active_at: activeAt,
      draft: messageText,
      draftBodyRanges: bodyRanges,
      draftChanged: true,
      timestamp,
    });
    drop(DataWriter.updateConversation(conversation.attributes));
  }
}

function setComposerDisabledState(
  conversationId: string,
  value: boolean
): SetComposerDisabledStateActionType {
  return {
    type: SET_COMPOSER_DISABLED,
    payload: {
      conversationId,
      value,
    },
  };
}

function setMediaQualitySetting(
  conversationId: string,
  value: boolean
): SetHighQualitySettingActionType {
  return {
    type: SET_HIGH_QUALITY_SETTING,
    payload: {
      conversationId,
      value,
    },
  };
}

function setQuotedMessage(
  conversationId: string,
  quotedMessage?: QuotedMessageForComposerType
): SetQuotedMessageActionType {
  return {
    type: SET_QUOTED_MESSAGE,
    payload: {
      conversationId,
      quotedMessage,
    },
  };
}

// Reducer

export function getEmptyState(): ComposerStateType {
  return {
    conversations: {},
  };
}

function updateComposerState(
  state: Readonly<ComposerStateType>,
  action: Readonly<ComposerActionType>,
  getNextComposerState: (
    prevState: ComposerStateByConversationType
  ) => Partial<ComposerStateByConversationType>
): ComposerStateType {
  const { conversationId } = action.payload;

  strictAssert(
    conversationId,
    'updateComposerState: no conversationId provided'
  );

  const prevComposerState = getComposerStateForConversation(
    state,
    conversationId
  );

  const nextComposerStateForConversation = assignWithNoUnnecessaryAllocation(
    prevComposerState,
    getNextComposerState(prevComposerState)
  );

  return assignWithNoUnnecessaryAllocation(state, {
    conversations: assignWithNoUnnecessaryAllocation(state.conversations, {
      [conversationId]: nextComposerStateForConversation,
    }),
  });
}

export function reducer(
  state: Readonly<ComposerStateType> = getEmptyState(),
  action: Readonly<ComposerActionType>
): ComposerStateType {
  if (action.type === CONVERSATION_UNLOADED) {
    const nextConversations: Record<string, ComposerStateByConversationType> =
      {};
    Object.keys(state.conversations).forEach(conversationId => {
      if (conversationId === action.payload.conversationId) {
        return;
      }

      nextConversations[conversationId] = state.conversations[conversationId];
    });

    return {
      ...state,
      conversations: nextConversations,
    };
  }

  if (action.type === TARGETED_CONVERSATION_CHANGED) {
    if (action.payload.conversationId) {
      return {
        ...state,
        conversations: {
          [action.payload.conversationId]: getEmptyComposerState(),
        },
      };
    }

    return getEmptyState();
  }

  if (action.type === RESET_COMPOSER) {
    return updateComposerState(state, action, () => ({}));
  }

  if (action.type === REPLACE_ATTACHMENTS) {
    const { attachments } = action.payload;

    return updateComposerState(state, action, () => ({
      attachments,
      ...(attachments.length
        ? {}
        : { shouldSendHighQualityAttachments: undefined }),
    }));
  }

  if (action.type === INCREMENT_SEND_COUNTER) {
    return updateComposerState(state, action, prevState => ({
      sendCounter: prevState.sendCounter + 1,
    }));
  }

  if (action.type === SET_FOCUS) {
    return updateComposerState(state, action, prevState => ({
      focusCounter: prevState.focusCounter + 1,
    }));
  }

  if (action.type === SET_HIGH_QUALITY_SETTING) {
    return updateComposerState(state, action, () => ({
      shouldSendHighQualityAttachments: action.payload.value,
    }));
  }

  if (action.type === SET_QUOTED_MESSAGE) {
    const { quotedMessage } = action.payload;
    return updateComposerState(state, action, () => ({
      quotedMessage,
    }));
  }

  if (action.type === ADD_LINK_PREVIEW) {
    if (action.payload.source !== LinkPreviewSourceType.Composer) {
      return state;
    }

    return updateComposerState(state, action, () => ({
      linkPreviewLoading: true,
      linkPreviewResult: action.payload.linkPreview,
    }));
  }

  if (action.type === REMOVE_LINK_PREVIEW && action.payload.conversationId) {
    return updateComposerState(state, action, () => ({
      linkPreviewLoading: false,
      linkPreviewResult: undefined,
    }));
  }

  if (action.type === ADD_PENDING_ATTACHMENT) {
    return updateComposerState(state, action, prevState => ({
      attachments: [...prevState.attachments, action.payload.attachment],
    }));
  }

  if (action.type === SET_COMPOSER_DISABLED) {
    return updateComposerState(state, action, () => ({
      isDisabled: action.payload.value,
    }));
  }

  return state;
}
