// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';

import * as log from '../../logging/log';
import type { NoopActionType } from './noop';
import type { StateType as RootStateType } from '../reducer';
import type { AttachmentType } from '../../types/Attachment';
import type { MessageAttributesType } from '../../model-types.d';
import type { LinkPreviewWithDomain } from '../../types/LinkPreview';
import { assignWithNoUnnecessaryAllocation } from '../../util/assignWithNoUnnecessaryAllocation';
import type { RemoveLinkPreviewActionType } from './linkPreviews';
import { REMOVE_PREVIEW as REMOVE_LINK_PREVIEW } from './linkPreviews';
import { writeDraftAttachment } from '../../util/writeDraftAttachment';
import { replaceIndex } from '../../util/replaceIndex';
import { resolveAttachmentOnDisk } from '../../util/resolveAttachmentOnDisk';
import type { HandleAttachmentsProcessingArgsType } from '../../util/handleAttachmentsProcessing';
import { handleAttachmentsProcessing } from '../../util/handleAttachmentsProcessing';

// State

export type ComposerStateType = {
  attachments: ReadonlyArray<AttachmentType>;
  linkPreviewLoading: boolean;
  linkPreviewResult?: LinkPreviewWithDomain;
  quotedMessage?: Pick<MessageAttributesType, 'conversationId' | 'quote'>;
  shouldSendHighQualityAttachments: boolean;
};

// Actions

const ADD_PENDING_ATTACHMENT = 'composer/ADD_PENDING_ATTACHMENT';
const REPLACE_ATTACHMENTS = 'composer/REPLACE_ATTACHMENTS';
const RESET_COMPOSER = 'composer/RESET_COMPOSER';
const SET_HIGH_QUALITY_SETTING = 'composer/SET_HIGH_QUALITY_SETTING';
const SET_LINK_PREVIEW_RESULT = 'composer/SET_LINK_PREVIEW_RESULT';
const SET_QUOTED_MESSAGE = 'composer/SET_QUOTED_MESSAGE';

type AddPendingAttachmentActionType = {
  type: typeof ADD_PENDING_ATTACHMENT;
  payload: AttachmentType;
};

type ReplaceAttachmentsActionType = {
  type: typeof REPLACE_ATTACHMENTS;
  payload: ReadonlyArray<AttachmentType>;
};

type ResetComposerActionType = {
  type: typeof RESET_COMPOSER;
};

type SetHighQualitySettingActionType = {
  type: typeof SET_HIGH_QUALITY_SETTING;
  payload: boolean;
};

type SetLinkPreviewResultActionType = {
  type: typeof SET_LINK_PREVIEW_RESULT;
  payload: {
    isLoading: boolean;
    linkPreview?: LinkPreviewWithDomain;
  };
};

type SetQuotedMessageActionType = {
  type: typeof SET_QUOTED_MESSAGE;
  payload?: Pick<MessageAttributesType, 'conversationId' | 'quote'>;
};

type ComposerActionType =
  | AddPendingAttachmentActionType
  | RemoveLinkPreviewActionType
  | ReplaceAttachmentsActionType
  | ResetComposerActionType
  | SetHighQualitySettingActionType
  | SetLinkPreviewResultActionType
  | SetQuotedMessageActionType;

// Action Creators

export const actions = {
  addAttachment,
  addPendingAttachment,
  processAttachments,
  removeAttachment,
  replaceAttachments,
  resetComposer,
  setLinkPreviewResult,
  setMediaQualitySetting,
  setQuotedMessage,
};

// Not cool that we have to pull from ConversationModel here
// but if the current selected conversation isn't the one that we're operating
// on then we won't be able to grab attachments from state so we resort to the
// next in-memory store.
function getAttachmentsFromConversationModel(
  conversationId: string
): Array<AttachmentType> {
  const conversation = window.ConversationController.get(conversationId);
  return conversation?.get('draftAttachments') || [];
}

function addAttachment(
  conversationId: string,
  attachment: AttachmentType
): ThunkAction<void, RootStateType, unknown, ReplaceAttachmentsActionType> {
  return async (dispatch, getState) => {
    const isSelectedConversation =
      getState().conversations.selectedConversationId === conversationId;

    const draftAttachments = isSelectedConversation
      ? getState().composer.attachments
      : getAttachmentsFromConversationModel(conversationId);

    const hasDraftAttachmentPending = draftAttachments.some(
      draftAttachment =>
        draftAttachment.pending && draftAttachment.path === attachment.path
    );

    // User has canceled the draft so we don't need to continue processing
    if (!hasDraftAttachmentPending) {
      return;
    }

    const onDisk = await writeDraftAttachment(attachment);

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
  pendingAttachment: AttachmentType
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

function processAttachments(
  options: HandleAttachmentsProcessingArgsType
): ThunkAction<void, RootStateType, unknown, NoopActionType> {
  return async dispatch => {
    await handleAttachmentsProcessing(options);
    dispatch({
      type: 'NOOP',
      payload: null,
    });
  };
}

function removeAttachment(
  conversationId: string,
  filePath: string
): ThunkAction<void, RootStateType, unknown, ReplaceAttachmentsActionType> {
  return (dispatch, getState) => {
    const { attachments } = getState().composer;

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
  };
}

function replaceAttachments(
  conversationId: string,
  attachments: ReadonlyArray<AttachmentType>
): ThunkAction<void, RootStateType, unknown, ReplaceAttachmentsActionType> {
  return (dispatch, getState) => {
    // If the call came from a conversation we are no longer in we do not
    // update the state.
    if (getState().conversations.selectedConversationId !== conversationId) {
      return;
    }

    dispatch({
      type: REPLACE_ATTACHMENTS,
      payload: attachments.map(resolveAttachmentOnDisk),
    });
  };
}

function resetComposer(): ResetComposerActionType {
  return {
    type: RESET_COMPOSER,
  };
}

function setLinkPreviewResult(
  isLoading: boolean,
  linkPreview?: LinkPreviewWithDomain
): SetLinkPreviewResultActionType {
  return {
    type: SET_LINK_PREVIEW_RESULT,
    payload: {
      isLoading,
      linkPreview,
    },
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
  payload?: Pick<MessageAttributesType, 'conversationId' | 'quote'>
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
    linkPreviewLoading: false,
    shouldSendHighQualityAttachments: false,
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
        : { shouldSendHighQualityAttachments: false }),
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

  if (action.type === SET_LINK_PREVIEW_RESULT) {
    return {
      ...state,
      linkPreviewLoading: action.payload.isLoading,
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

  return state;
}
