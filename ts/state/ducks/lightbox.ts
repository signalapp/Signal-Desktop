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
import { getMessageById } from '../../messages/getMessageById';
import type { ReadonlyMessageAttributesType } from '../../model-types.d';
import { isGIF, isIncremental } from '../../types/Attachment';
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
import { DataReader } from '../../sql/Client';
import { deleteDownloadsJobQueue } from '../../jobs/deleteDownloadsJobQueue';
import { AttachmentDownloadUrgency } from '../../jobs/AttachmentDownloadManager';
import { queueAttachmentDownloads } from '../../util/queueAttachmentDownloads';
import { getMessageIdForLogging } from '../../util/idForLogging';
import { markViewOnceMessageViewed } from '../../services/MessageUpdater';

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

    deleteDownloadsJobQueue.resume();

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

function showLightboxForViewOnceMedia(
  messageId: string
): ThunkAction<void, RootStateType, unknown, ShowLightboxActionType> {
  return async dispatch => {
    log.info('showLightboxForViewOnceMedia: attempting to display message');

    const message = await getMessageById(messageId);
    if (!message) {
      throw new Error(
        `showLightboxForViewOnceMedia: Message ${messageId} missing!`
      );
    }

    if (!isTapToView(message.attributes)) {
      throw new Error(
        `showLightboxForViewOnceMedia: Message ${getMessageIdForLogging(message.attributes)} is not a tap to view message`
      );
    }

    if (message.get('isErased')) {
      throw new Error(
        `showLightboxForViewOnceMedia: Message ${getMessageIdForLogging(message.attributes)} is already erased`
      );
    }

    const firstAttachment = (message.get('attachments') || [])[0];
    if (!firstAttachment || !firstAttachment.path) {
      throw new Error(
        `showLightboxForViewOnceMedia: Message ${getMessageIdForLogging(message.attributes)} had no first attachment with path`
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

    await markViewOnceMessageViewed(message);

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
          receivedAt: message.get('received_at'),
          receivedAtMs: Number(message.get('received_at_ms')),
          sentAt: message.get('sent_at'),
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
  attributes: ReadonlyMessageAttributesType
): Array<AttachmentType> {
  return (attributes.attachments ?? []).filter(
    item => (!item.pending || isIncremental(item)) && !item.error
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

    const message = await getMessageById(messageId);
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

    if (isIncremental(attachment)) {
      // Queue all attachments, but this target attachment should be IMMEDIATE
      const wasUpdated = await queueAttachmentDownloads(message, {
        urgency: AttachmentDownloadUrgency.STANDARD,
        attachmentDigestForImmediate: attachment.digest,
      });
      if (wasUpdated) {
        await window.MessageCache.saveMessage(message);
      }
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

    const media = attachments
      .map((item, index) => ({
        objectURL: item.path ? getLocalAttachmentUrl(item) : undefined,
        incrementalObjectUrl:
          isIncremental(item) && item.downloadPath
            ? getLocalAttachmentUrl(item, {
                disposition: AttachmentDisposition.Download,
              })
            : undefined,
        path: item.path,
        contentType: item.contentType,
        loop,
        index,
        message: {
          attachments: message.get('attachments') || [],
          id: messageId,
          conversationId: authorId,
          receivedAt,
          receivedAtMs: Number(message.get('received_at_ms')),
          sentAt,
        },
        attachment: item,
        thumbnailObjectUrl:
          item.thumbnail?.objectUrl || item.thumbnail?.path
            ? getLocalAttachmentUrl(item.thumbnail)
            : undefined,
        size: item.size,
        totalDownloaded: item.totalDownloaded,
      }))
      .filter(item => item.objectURL || item.incrementalObjectUrl);

    if (!media.length) {
      log.error(
        'showLightbox: unable to load attachment',
        sentAt,
        message.get('attachments')?.map(x => ({
          contentType: x.contentType,
          downloadPath: x.downloadPath,
          error: x.error,
          flags: x.flags,
          isIncremental: isIncremental(x),
          path: x.path,
          pending: x.pending,
          size: x.size,
          thumbnail: !!x.thumbnail,
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
      await DataReader.getConversationRangeCenteredOnMessage({
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

    const index = media.findIndex(({ path }) => path === attachment.path);
    dispatch({
      type: SHOW_LIGHTBOX,
      payload: {
        isViewOnce: false,
        media,
        selectedIndex: index === -1 ? 0 : index,
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
    const { id: messageId, receivedAt, sentAt } = media.message;

    const message = await getMessageById(messageId);
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
        ? await DataReader.getOlderMessagesByConversation(options)
        : await DataReader.getNewerMessagesByConversation(options);

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
      const message = action.payload.data;
      const attachmentsByDigest = new Map<string, AttachmentType>();
      if (!message.attachments || !message.attachments.length) {
        return state;
      }

      message.attachments.forEach(attachment => {
        const { digest } = attachment;
        if (!digest) {
          return;
        }

        attachmentsByDigest.set(digest, attachment);
      });

      let changed = false;
      const media = state.media.map(item => {
        if (item.message.id !== message.id) {
          return item;
        }

        const { digest } = item.attachment;
        if (!digest) {
          return item;
        }

        const attachment = attachmentsByDigest.get(digest);
        if (
          !attachment ||
          !isIncremental(attachment) ||
          (!item.attachment.pending && !attachment.pending)
        ) {
          return item;
        }

        const { totalDownloaded, pending } = attachment;
        if (totalDownloaded !== item.attachment.totalDownloaded) {
          changed = true;
          return {
            ...item,
            attachment: {
              ...item.attachment,
              totalDownloaded,
              pending,
            },
          };
        }

        return item;
      });

      if (changed) {
        return {
          ...state,
          media,
        };
      }

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
