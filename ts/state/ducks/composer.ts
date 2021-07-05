// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { AttachmentType } from '../../types/Attachment';
import { MessageAttributesType } from '../../model-types.d';
import { LinkPreviewWithDomain } from '../../types/LinkPreview';

// State

export type ComposerStateType = {
  attachments: ReadonlyArray<AttachmentType>;
  linkPreviewLoading: boolean;
  linkPreviewResult?: LinkPreviewWithDomain;
  quotedMessage?: Pick<MessageAttributesType, 'conversationId' | 'quote'>;
  shouldSendHighQualityAttachments: boolean;
};

// Actions

const REPLACE_ATTACHMENTS = 'composer/REPLACE_ATTACHMENTS';
const RESET_COMPOSER = 'composer/RESET_COMPOSER';
const SET_HIGH_QUALITY_SETTING = 'composer/SET_HIGH_QUALITY_SETTING';
const SET_LINK_PREVIEW_RESULT = 'composer/SET_LINK_PREVIEW_RESULT';
const SET_QUOTED_MESSAGE = 'composer/SET_QUOTED_MESSAGE';

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
  | ReplaceAttachmentsActionType
  | ResetComposerActionType
  | SetHighQualitySettingActionType
  | SetLinkPreviewResultActionType
  | SetQuotedMessageActionType;

// Action Creators

export const actions = {
  replaceAttachments,
  resetComposer,
  setLinkPreviewResult,
  setMediaQualitySetting,
  setQuotedMessage,
};

function replaceAttachments(
  payload: ReadonlyArray<AttachmentType>
): ReplaceAttachmentsActionType {
  return {
    type: REPLACE_ATTACHMENTS,
    payload,
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

  return state;
}
