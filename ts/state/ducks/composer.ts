// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';

import * as log from '../../logging/log';
import type { NoopActionType } from './noop';
import type { StateType as RootStateType } from '../reducer';
import type {
  AttachmentDraftType,
  InMemoryAttachmentDraftType,
} from '../../types/Attachment';
import type { MessageAttributesType } from '../../model-types.d';
import type { LinkPreviewType } from '../../types/message/LinkPreviews';
import { assignWithNoUnnecessaryAllocation } from '../../util/assignWithNoUnnecessaryAllocation';
import type {
  AddLinkPreviewActionType,
  RemoveLinkPreviewActionType,
} from './linkPreviews';
import {
  ADD_PREVIEW as ADD_LINK_PREVIEW,
  REMOVE_PREVIEW as REMOVE_LINK_PREVIEW,
} from './linkPreviews';
import { writeDraftAttachment } from '../../util/writeDraftAttachment';
import { deleteDraftAttachment } from '../../util/deleteDraftAttachment';
import { replaceIndex } from '../../util/replaceIndex';
import { resolveDraftAttachmentOnDisk } from '../../util/resolveDraftAttachmentOnDisk';
import type { HandleAttachmentsProcessingArgsType } from '../../util/handleAttachmentsProcessing';
import { handleAttachmentsProcessing } from '../../util/handleAttachmentsProcessing';
import { LinkPreviewSourceType } from '../../types/LinkPreview';

// State

export type ComposerStateType = {
  attachments: ReadonlyArray<AttachmentDraftType>;
  linkPreviewLoading: boolean;
  linkPreviewResult?: LinkPreviewType;
  quotedMessage?: Pick<MessageAttributesType, 'conversationId' | 'quote'>;
  shouldSendHighQualityAttachments: boolean;
};

// Actions

const ADD_PENDING_ATTACHMENT = 'composer/ADD_PENDING_ATTACHMENT';
const REPLACE_ATTACHMENTS = 'composer/REPLACE_ATTACHMENTS';
const RESET_COMPOSER = 'composer/RESET_COMPOSER';
const SET_HIGH_QUALITY_SETTING = 'composer/SET_HIGH_QUALITY_SETTING';
const SET_QUOTED_MESSAGE = 'composer/SET_QUOTED_MESSAGE';

type AddPendingAttachmentActionType = {
  type: typeof ADD_PENDING_ATTACHMENT;
  payload: AttachmentDraftType;
};

type ReplaceAttachmentsActionType = {
  type: typeof REPLACE_ATTACHMENTS;
  payload: ReadonlyArray<AttachmentDraftType>;
};

type ResetComposerActionType = {
  type: typeof RESET_COMPOSER;
};

type SetHighQualitySettingActionType = {
  type: typeof SET_HIGH_QUALITY_SETTING;
  payload: boolean;
};

type SetQuotedMessageActionType = {
  type: typeof SET_QUOTED_MESSAGE;
  payload?: Pick<MessageAttributesType, 'conversationId' | 'quote'>;
};

type ComposerActionType =
  | AddLinkPreviewActionType
  | AddPendingAttachmentActionType
  | RemoveLinkPreviewActionType
  | ReplaceAttachmentsActionType
  | ResetComposerActionType
  | SetHighQualitySettingActionType
  | SetQuotedMessageActionType;

// Action Creators

export const actions = {
  addAttachment,
  addPendingAttachment,
  processAttachments,
  removeAttachment,
  replaceAttachments,
  resetComposer,
  setMediaQualitySetting,
  setQuotedMessage,
};

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

function replaceAttachments(
  conversationId: string,
  attachments: ReadonlyArray<AttachmentDraftType>
): ThunkAction<void, RootStateType, unknown, ReplaceAttachmentsActionType> {
  return (dispatch, getState) => {
    // If the call came from a conversation we are no longer in we do not
    // update the state.
    if (getState().conversations.selectedConversationId !== conversationId) {
      return;
    }

    dispatch({
      type: REPLACE_ATTACHMENTS,
      payload: attachments.map(resolveDraftAttachmentOnDisk),
    });
  };
}

function resetComposer(): ResetComposerActionType {
  return {
    type: RESET_COMPOSER,
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

  return state;
}
