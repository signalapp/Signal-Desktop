// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer as ipc } from 'electron';

import { createLogger } from '../../logging/log.std.ts';
import type { MessageAttributesType } from '../../model-types.d.ts';
import { DataReader } from '../../sql/Client.preload.ts';
import * as RemoteConfig from '../../RemoteConfig.dom.ts';
import { _getConversationComparator } from '../../state/selectors/conversations.dom.ts';
import * as Errors from '../../types/errors.std.ts';
import { drop } from '../../util/drop.std.ts';
import { safeParseUnknown } from '../../util/schemas.std.ts';
import { isGroup } from '../../util/whatTypeOfConversation.dom.ts';
import {
  isListedConversation,
  toConversationDTO,
} from '../conversationDto.std.ts';
import { markRead, sendText } from './ExternalClientSend.preload.ts';
import {
  getDtoContext,
  getListedConversation,
  loadMessage,
  preferCached,
} from './serviceHelpers.preload.ts';
import type { ServiceResultType } from '../hostTypes.std.ts';
import { toMessageDTO } from '../messageDto.std.ts';
import type {
  ConversationsGetParamsType,
  ConversationsListParamsType,
  ConversationsListResultType,
  MessageDTO,
  MessagesGetParamsType,
  MessagesListParamsType,
  MessagesListResultType,
  ServiceMethodType,
} from '../protocol.std.ts';
import {
  ErrorCode,
  LIMITS,
  Method,
  SERVICE_PARAM_SCHEMAS,
} from '../protocol.std.ts';
import type { RendererResultType } from '../rendererChannel.std.ts';
import {
  CALL_CHANNEL,
  REFRESH_CHANNEL,
  RESULT_CHANNEL,
  rendererCallSchema,
} from '../rendererChannel.std.ts';

// Renderer half of the external-client bridge. Answers calls from the main
// process by reading Signal's own models and returning public DTOs. It holds
// no authorization logic: main has already authenticated the client and
// checked its capabilities before a call arrives here.

const log = createLogger('ExternalClientService');

const notReady: ServiceResultType = { ok: false, code: ErrorCode.NotReady };
const notFound: ServiceResultType = { ok: false, code: ErrorCode.NotFound };

function listConversations({
  limit = LIMITS.defaultConversationPage,
  cursor,
}: ConversationsListParamsType): ServiceResultType {
  const controller = window.ConversationController;
  if (!controller.isInitialFetchComplete()) {
    return notReady;
  }

  const listed = controller
    .getAll()
    .map(model => model.format())
    .filter(isListedConversation)
    .sort(_getConversationComparator());

  const offset = cursor === undefined ? 0 : Number(cursor);
  const end = offset + limit;
  const value: ConversationsListResultType = {
    conversations: listed.slice(offset, end).map(toConversationDTO),
    nextCursor: end < listed.length ? String(end) : null,
  };
  return { ok: true, value };
}

function getConversation({
  conversationId,
}: ConversationsGetParamsType): ServiceResultType {
  if (!window.ConversationController.isInitialFetchComplete()) {
    return notReady;
  }
  const model = getListedConversation(conversationId);
  if (!model) {
    return notFound;
  }
  return {
    ok: true,
    value: { conversation: toConversationDTO(model.format()) },
  };
}

async function listMessages({
  conversationId,
  limit = LIMITS.defaultMessagePage,
  cursor,
}: MessagesListParamsType): Promise<ServiceResultType> {
  if (!window.ConversationController.isInitialFetchComplete()) {
    return notReady;
  }
  const model = getListedConversation(conversationId);
  if (!model) {
    return notFound;
  }

  let anchor: MessageAttributesType | undefined;
  if (cursor !== undefined) {
    anchor = await loadMessage(cursor);
    if (!anchor || anchor.conversationId !== conversationId) {
      return { ok: false, code: ErrorCode.InvalidArgument };
    }
  }

  // Same query the timeline uses to load older messages. Results are
  // oldest first.
  const page = await DataReader.getOlderMessagesByConversation({
    conversationId,
    includeStoryReplies: !isGroup(model.attributes),
    limit,
    messageId: anchor?.id,
    receivedAt: anchor?.received_at,
    sentAt: anchor?.sent_at,
    storyId: undefined,
  });

  const context = getDtoContext();
  const messages = new Array<MessageDTO>();
  for (const message of page) {
    const dto = toMessageDTO(preferCached(message), context);
    if (dto) {
      messages.push(dto);
    }
  }

  // The cursor is the oldest row read, even if it was filtered out, so the
  // next page continues where this one stopped.
  const oldest = page.at(0);
  const value: MessagesListResultType = {
    messages,
    nextCursor: page.length === limit && oldest ? oldest.id : null,
  };
  return { ok: true, value };
}

async function getMessage({
  messageId,
}: MessagesGetParamsType): Promise<ServiceResultType> {
  if (!window.ConversationController.isInitialFetchComplete()) {
    return notReady;
  }
  const message = await loadMessage(messageId);
  if (!message || !getListedConversation(message.conversationId)) {
    return notFound;
  }
  const dto = toMessageDTO(message, getDtoContext());
  if (!dto) {
    return notFound;
  }
  return { ok: true, value: { message: dto } };
}

async function dispatch(
  method: ServiceMethodType,
  rawParams: unknown
): Promise<ServiceResultType> {
  const invalid: ServiceResultType = {
    ok: false,
    code: ErrorCode.InvalidArgument,
  };
  // Main validated these already; validate again rather than trust IPC.
  switch (method) {
    case Method.ConversationsList: {
      const params = safeParseUnknown(SERVICE_PARAM_SCHEMAS[method], rawParams);
      return params.success ? listConversations(params.data) : invalid;
    }
    case Method.ConversationsGet: {
      const params = safeParseUnknown(SERVICE_PARAM_SCHEMAS[method], rawParams);
      return params.success ? getConversation(params.data) : invalid;
    }
    case Method.MessagesList: {
      const params = safeParseUnknown(SERVICE_PARAM_SCHEMAS[method], rawParams);
      return params.success ? listMessages(params.data) : invalid;
    }
    case Method.MessagesGet: {
      const params = safeParseUnknown(SERVICE_PARAM_SCHEMAS[method], rawParams);
      return params.success ? getMessage(params.data) : invalid;
    }
    case Method.MessagesSendText: {
      if (!window.ConversationController.isInitialFetchComplete()) {
        return notReady;
      }
      const params = safeParseUnknown(SERVICE_PARAM_SCHEMAS[method], rawParams);
      return params.success ? sendText(params.data) : invalid;
    }
    case Method.MessagesMarkRead: {
      if (!window.ConversationController.isInitialFetchComplete()) {
        return notReady;
      }
      const params = safeParseUnknown(SERVICE_PARAM_SCHEMAS[method], rawParams);
      return params.success ? markRead(params.data) : invalid;
    }
    default:
      throw new Error(`Unhandled external client method ${method}`);
  }
}

async function answer(
  seq: number,
  method: ServiceMethodType,
  params: unknown
): Promise<void> {
  let result: ServiceResultType;
  try {
    result = await dispatch(method, params);
  } catch (error) {
    log.error(`${method} failed`, Errors.toLogFormat(error));
    result = { ok: false, code: ErrorCode.InternalError };
  }
  ipc.send(RESULT_CHANNEL, { seq, ...result } satisfies RendererResultType);
}

export function installExternalClientService(): void {
  // Main decides whether the bridge runs; it only needs to know when
  // Signal's flag for it changes.
  RemoteConfig.onChange(
    ['desktop.externalClients.beta', 'desktop.externalClients.prod'],
    () => ipc.send(REFRESH_CHANNEL)
  );

  ipc.on(CALL_CHANNEL, (_event, message: unknown) => {
    const call = safeParseUnknown(rendererCallSchema, message);
    if (!call.success) {
      log.warn('dropping malformed call');
      return;
    }

    const { seq, method, params } = call.data;
    drop(answer(seq, method, params));
  });
}
