// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ThunkAction } from 'redux-thunk';

import type { ReadonlyDeep } from 'type-fest';
import type { AttachmentType } from '../../types/Attachment';
import type { BoundActionCreatorsMapObject } from '../../hooks/useBoundActions';
import type { MediaItemType } from '../../types/MediaItem';
import type {
  MessageChangedActionType,
  MessageDeletedActionType,
  MessageExpiredActionType,
} from './conversations';
import type { ShowStickerPackPreviewActionType } from './globalModals';
import type { ShowToastActionType } from './toast';
import type { StateType as RootStateType } from '../reducer';

import * as log from '../../logging/log';
import { __DEPRECATED$getMessageById } from '../../messages/getMessageById';
import type { MessageAttributesType } from '../../model-types.d';
import { isGIF } from '../../types/Attachment';
import {
  isImageTypeSupported,
  isVideoTypeSupported,
} from '../../util/GoogleChrome';
import {
  getLocalAttachmentUrl,
  AttachmentDisposition,
} from '../../util/getLocalAttachmentUrl';
import { isTapToView } from '../selectors/message';
import { SHOW_TOAST } from './toast';
import { ToastType } from '../../types/Toast';
import {
  MESSAGE_CHANGED,
  MESSAGE_DELETED,
  MESSAGE_EXPIRED,
  saveAttachmentFromMessage,
} from './conversations';
import { showStickerPackPreview } from './globalModals';
import { useBoundActions } from '../../hooks/useBoundActions';
import dataInterface from '../../sql/Client';

// eslint-disable-next-line local-rules/type-alias-readonlydeep
export type LightboxStateType =
  | {
      isShowingLightbox: false;
    }
  | {
      isShowingLightbox: true;
      isViewOnce: boolean;
      media: ReadonlyArray<ReadonlyDeep<MediaItemType>>;
      hasPrevMessage: boolean;
      hasNextMessage: boolean;
      selectedIndex: number | undefined;
      playbackDisabled: boolean;
    };

const CLOSE_LIGHTBOX = 'lightbox/CLOSE';
const SHOW_LIGHTBOX = 'lightbox/SHOW';
const SET_SELECTED_LIGHTBOX_INDEX = 'lightbox/SET_SELECTED_LIGHTBOX_INDEX';
const SET_LIGHTBOX_PLAYBACK_DISABLED =
  'lightbox/SET_LIGHTBOX_PLAYBACK_DISABLED';

type CloseLightboxActionType = ReadonlyDeep<{
  type: typeof CLOSE_LIGHTBOX;
}>;

// eslint-disable-next-line local-rules/type-alias-readonlydeep
type ShowLightboxActionType = {
  type: typeof SHOW_LIGHTBOX;
  payload: {
    isViewOnce: boolean;
    media: ReadonlyArray<ReadonlyDeep<MediaItemType>>;
    hasPrevMessage: boolean;
    hasNextMessage: boolean;
    selectedIndex: number | undefined;
  };
};

type SetLightboxPlaybackDisabledActionType = ReadonlyDeep<{
  type: typeof SET_LIGHTBOX_PLAYBACK_DISABLED;
  payload: boolean;
}>;

type SetSelectedLightboxIndexActionType = ReadonlyDeep<{
  type: typeof SET_SELECTED_LIGHTBOX_INDEX;
  payload: number;
}>;

// eslint-disable-next-line local-rules/type-alias-readonlydeep
type LightboxActionType =
  | CloseLightboxActionType
  | MessageChangedActionType
  | MessageDeletedActionType
  | MessageExpiredActionType
  | ShowLightboxActionType
  | SetSelectedLightboxIndexActionType
  | SetLightboxPlaybackDisabledActionType;

function closeLightbox(): ThunkAction<
  void,
  RootStateType,
  unknown,
  CloseLightboxActionType
> {
  return (dispatch, getState) => {
    const { lightbox } = getState();

    if (!lightbox.isShowingLightbox) {
      return;
    }

    const { isViewOnce, media } = lightbox;

    if (isViewOnce) {
      media.forEach(item => {
        if (!item.attachment.path) {
          return;
        }
        void window.Signal.Migrations.deleteTempFile(item.attachment.path);
      });
    }

    dispatch({
      type: CLOSE_LIGHTBOX,
    });
  };
}

function setPlaybackDisabled(
  playbackDisabled: boolean
): ThunkAction<
  void,
  RootStateType,
  unknown,
  SetLightboxPlaybackDisabledActionType
> {
  return (dispatch, getState) => {
    const { lightbox } = getState();

    if (!lightbox.isShowingLightbox) {
      return;
    }

    dispatch({
      type: SET_LIGHTBOX_PLAYBACK_DISABLED,
      payload: playbackDisabled,
    });
  };
}

function showLightboxWithMedia(
  selectedIndex: number | undefined,
  media: ReadonlyArray<ReadonlyDeep<MediaItemType>>
): ShowLightboxActionType {
  return {
    type: SHOW_LIGHTBOX,
    payload: {
      isViewOnce: false,
      media,
      selectedIndex,
      hasPrevMessage: false,
      hasNextMessage: false,
    },
  };
}

function showLightboxForViewOnceMedia(
  messageId: string
): ThunkAction<void, RootStateType, unknown, ShowLightboxActionType> {
  return async dispatch => {
    log.info('showLightboxForViewOnceMedia: attempting to display message');

    const message = await __DEPRECATED$getMessageById(messageId);
    if (!message) {
      throw new Error(
        `showLightboxForViewOnceMedia: Message ${messageId} missing!`
      );
    }

    if (!isTapToView(message.attributes)) {
      throw new Error(
        `showLightboxForViewOnceMedia: Message ${message.idForLogging()} is not a tap to view message`
      );
    }

    if (message.isErased()) {
      throw new Error(
        `showLightboxForViewOnceMedia: Message ${message.idForLogging()} is already erased`
      );
    }

    const firstAttachment = (message.get('attachments') || [])[0];
    if (!firstAttachment || !firstAttachment.path) {
      throw new Error(
        `showLightboxForViewOnceMedia: Message ${message.idForLogging()} had no first attachment with path`
      );
    }

    const { copyIntoTempDirectory, getAbsoluteAttachmentPath } =
      window.Signal.Migrations;

    const absolutePath = getAbsoluteAttachmentPath(firstAttachment.path);
    const { path: tempPath } = await copyIntoTempDirectory(absolutePath);
    const tempAttachment = {
      ...firstAttachment,
      path: tempPath,
    };

    await message.markViewOnceMessageViewed();

    const { contentType } = tempAttachment;

    const media = [
      {
        attachment: tempAttachment,
        objectURL: getLocalAttachmentUrl(tempAttachment, {
          disposition: AttachmentDisposition.Temporary,
        }),
        contentType,
        index: 0,
        message: {
          attachments: message.get('attachments') || [],
          id: message.get('id'),
          conversationId: message.get('conversationId'),
          received_at: message.get('received_at'),
          received_at_ms: Number(message.get('received_at_ms')),
          sent_at: message.get('sent_at'),
        },
      },
    ];

    dispatch({
      type: SHOW_LIGHTBOX,
      payload: {
        isViewOnce: true,
        media,
        selectedIndex: undefined,
        hasPrevMessage: false,
        hasNextMessage: false,
      },
    });
  };
}

function filterValidAttachments(
  attributes: MessageAttributesType
): Array<AttachmentType> {
  return (attributes.attachments ?? []).filter(
    item => item.thumbnail && !item.pending && !item.error
  );
}

function showLightbox(opts: {
  attachment: AttachmentType;
  messageId: string;
}): ThunkAction<
  void,
  RootStateType,
  unknown,
  | ShowLightboxActionType
  | ShowStickerPackPreviewActionType
  | ShowToastActionType
> {
  return async (dispatch, getState) => {
    const { attachment, messageId } = opts;

    const message = await __DEPRECATED$getMessageById(messageId);
    if (!message) {
      throw new Error(`showLightbox: Message ${messageId} missing!`);
    }
    const sticker = message.get('sticker');
    if (sticker) {
      const { packId, packKey } = sticker;
      dispatch(showStickerPackPreview(packId, packKey));
      return;
    }

    const { contentType } = attachment;

    if (
      !isImageTypeSupported(contentType) &&
      !isVideoTypeSupported(contentType)
    ) {
      saveAttachmentFromMessage(messageId, attachment)(
        dispatch,
        getState,
        null
      );
      return;
    }

    const attachments = filterValidAttachments(message.attributes);
    const loop = isGIF(attachments);

    const authorId =
      window.ConversationController.lookupOrCreate({
        serviceId: message.get('sourceServiceId'),
        e164: message.get('source'),
        reason: 'conversation_view.showLightBox',
      })?.id || message.get('conversationId');
    const receivedAt = message.get('received_at');
    const sentAt = message.get('sent_at');

    const media = attachments.map((item, index) => ({
      objectURL: getLocalAttachmentUrl(item),
      path: item.path,
      contentType: item.contentType,
      loop,
      index,
      message: {
        attachments: message.get('attachments') || [],
        id: messageId,
        conversationId: authorId,
        received_at: receivedAt,
        received_at_ms: Number(message.get('received_at_ms')),
        sent_at: sentAt,
      },
      attachment: item,
      thumbnailObjectUrl:
        item.thumbnail?.objectUrl || item.thumbnail
          ? getLocalAttachmentUrl(item.thumbnail)
          : undefined,
    }));

    if (!media.length) {
      log.error(
        'showLightbox: unable to load attachment',
        sentAt,
        message.get('attachments')?.map(x => ({
          thumbnail: !!x.thumbnail,
          contentType: x.contentType,
          pending: x.pending,
          error: x.error,
          flags: x.flags,
          path: x.path,
          size: x.size,
        }))
      );

      dispatch({
        type: SHOW_TOAST,
        payload: {
          toastType: ToastType.UnableToLoadAttachment,
        },
      });
      return;
    }

    const { older, newer } =
      await dataInterface.getConversationRangeCenteredOnMessage({
        conversationId: message.get('conversationId'),
        messageId,
        receivedAt,
        sentAt,
        limit: 1,
        storyId: undefined,
        includeStoryReplies: false,

        // This is the critical option since we only want messages with visual
        // attachments.
        requireVisualMediaAttachments: true,
      });

    dispatch({
      type: SHOW_LIGHTBOX,
      payload: {
        isViewOnce: false,
        media,
        selectedIndex: media.findIndex(({ path }) => path === attachment.path),
        hasPrevMessage:
          older.length > 0 && filterValidAttachments(older[0]).length > 0,
        hasNextMessage:
          newer.length > 0 && filterValidAttachments(newer[0]).length > 0,
        playbackDisabled: false,
      },
    });
  };
}

enum AdjacentMessageDirection {
  Previous = 'Previous',
  Next = 'Next',
}

function showLightboxForAdjacentMessage(
  direction: AdjacentMessageDirection
): ThunkAction<
  void,
  RootStateType,
  unknown,
  ShowLightboxActionType | ShowToastActionType
> {
  return async (dispatch, getState) => {
    const { lightbox } = getState();

    if (!lightbox.isShowingLightbox || lightbox.media.length === 0) {
      log.warn('showLightboxForAdjacentMessage: empty lightbox');
      return;
    }

    const [media] = lightbox.media;
    const {
      id: messageId,
      received_at: receivedAt,
      sent_at: sentAt,
    } = media.message;

    const message = await __DEPRECATED$getMessageById(messageId);
    if (!message) {
      log.warn('showLightboxForAdjacentMessage: original message is gone');
      dispatch({
        type: SHOW_TOAST,
        payload: {
          toastType: ToastType.UnableToLoadAttachment,
        },
      });
      return;
    }
    const conversationId = message.get('conversationId');

    const options = {
      conversationId,
      messageId,
      receivedAt,
      sentAt,
      limit: 1,
      storyId: undefined,
      includeStoryReplies: false,

      // This is the critical option since we only want messages with visual
      // attachments.
      requireVisualMediaAttachments: true,
    };

    const [adjacent] =
      direction === AdjacentMessageDirection.Previous
        ? await dataInterface.getOlderMessagesByConversation(options)
        : await dataInterface.getNewerMessagesByConversation(options);

    if (!adjacent) {
      log.warn(
        `showLightboxForAdjacentMessage(${direction}, ${messageId}, ` +
          `${sentAt}): no ${direction} message found`
      );
      dispatch({
        type: SHOW_TOAST,
        payload: {
          toastType: ToastType.UnableToLoadAttachment,
        },
      });
      return;
    }

    const attachments = filterValidAttachments(adjacent);
    if (!attachments.length) {
      log.warn(
        `showLightboxForAdjacentMessage(${direction}, ${messageId}, ` +
          `${sentAt}): no valid attachments found`
      );
      dispatch({
        type: SHOW_TOAST,
        payload: {
          toastType: ToastType.UnableToLoadAttachment,
        },
      });
      return;
    }

    dispatch(
      showLightbox({
        attachment:
          direction === AdjacentMessageDirection.Previous
            ? attachments[attachments.length - 1]
            : attachments[0],
        messageId: adjacent.id,
      })
    );
  };
}

function showLightboxForNextMessage(): ThunkAction<
  void,
  RootStateType,
  unknown,
  ShowLightboxActionType
> {
  return showLightboxForAdjacentMessage(AdjacentMessageDirection.Next);
}

function showLightboxForPrevMessage(): ThunkAction<
  void,
  RootStateType,
  unknown,
  ShowLightboxActionType
> {
  return showLightboxForAdjacentMessage(AdjacentMessageDirection.Previous);
}

function setSelectedLightboxIndex(
  index: number
): SetSelectedLightboxIndexActionType {
  return {
    type: SET_SELECTED_LIGHTBOX_INDEX,
    payload: index,
  };
}

export const actions = {
  closeLightbox,
  showLightbox,
  showLightboxForViewOnceMedia,
  showLightboxWithMedia,
  showLightboxForPrevMessage,
  showLightboxForNextMessage,
  setSelectedLightboxIndex,
  setPlaybackDisabled,
};

export const useLightboxActions = (): BoundActionCreatorsMapObject<
  typeof actions
> => useBoundActions(actions);

export function getEmptyState(): LightboxStateType {
  return {
    isShowingLightbox: false,
  };
}

export function reducer(
  state: Readonly<LightboxStateType> = getEmptyState(),
  action: Readonly<LightboxActionType>
): LightboxStateType {
  if (action.type === CLOSE_LIGHTBOX) {
    return getEmptyState();
  }

  if (action.type === SHOW_LIGHTBOX) {
    return {
      ...action.payload,
      isShowingLightbox: true,
      playbackDisabled: false,
    };
  }

  if (action.type === SET_SELECTED_LIGHTBOX_INDEX) {
    if (!state.isShowingLightbox) {
      return state;
    }

    return {
      ...state,
      selectedIndex: Math.max(
        0,
        Math.min(state.media.length - 1, action.payload)
      ),
    };
  }

  if (action.type === SET_LIGHTBOX_PLAYBACK_DISABLED) {
    if (!state.isShowingLightbox) {
      return state;
    }

    return {
      ...state,
      playbackDisabled: action.payload,
    };
  }

  if (
    action.type === MESSAGE_CHANGED ||
    action.type === MESSAGE_DELETED ||
    action.type === MESSAGE_EXPIRED
  ) {
    if (!state.isShowingLightbox) {
      return state;
    }

    if (action.type === MESSAGE_EXPIRED && !state.isViewOnce) {
      return state;
    }

    if (
      action.type === MESSAGE_CHANGED &&
      !action.payload.data.deletedForEveryone
    ) {
      return state;
    }

    const nextMedia = state.media.filter(
      item => item.message.id !== action.payload.id
    );

    if (nextMedia.length === state.media.length) {
      return state;
    }

    if (!nextMedia.length) {
      return getEmptyState();
    }

    return {
      ...state,
      media: nextMedia,
    };
  }

  return state;
}
