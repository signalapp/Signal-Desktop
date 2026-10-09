// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

import type {
  BroadcastEventNameType,
  ErrorCodeType,
  EventTopicType,
  SendBlockReasonType,
  ServiceMethodType,
} from './protocol.std.ts';
import {
  ALL_EVENT_TOPICS,
  ErrorCode,
  EVENT_TOPICS,
  SendBlockReason,
  SERVICE_METHOD_CAPABILITIES,
} from './protocol.std.ts';

// The only IPC between the main-process bridge and the renderer service.
// Main sends a validated call for a method on a closed list; the renderer
// answers with a DTO or an error code. Client JSON is never forwarded.
//
// For live updates, main tells the renderer which topics any client is
// subscribed to, and the renderer sends batches of events (already DTOs)
// for those topics only. With no subscribers the renderer does no work.

export const CALL_CHANNEL = 'external-client:call';
export const RESULT_CHANNEL = 'external-client:result';
// renderer -> main, no payload: the renderer (re)started and wants topics.
export const EVENTS_READY_CHANNEL = 'external-client:events-ready';
// main -> renderer: RendererTopicsType
export const TOPICS_CHANNEL = 'external-client:topics';
// renderer -> main: RendererEventsType
export const EVENTS_CHANNEL = 'external-client:events';
// renderer -> main, no payload: the bridge's remote-config flag or the
// user's setting changed.
export const REFRESH_CHANNEL = 'external-client:refresh';
// Settings page (renderer invoke -> main): approved apps, and removing one.
export const LIST_APPS_CHANNEL = 'external-client:list-apps';
export const REMOVE_APP_CHANNEL = 'external-client:remove-app';

// What the settings page shows for an approved app. The key itself stays in
// main; `id` is its fingerprint.
export type ExternalClientAppType = Readonly<{
  id: string;
  displayName: string;
  capabilities: ReadonlyArray<string>;
  approvedAt: number;
  lastSeenAt: number | null;
}>;

export const removeAppSchema = z.string().min(1).max(64);

export const MAX_EVENTS_PER_BATCH = 200;

const eventTopicEnum = z.enum(
  ALL_EVENT_TOPICS as [EventTopicType, ...Array<EventTopicType>]
);

export const rendererTopicsSchema = z
  .object({
    topics: z.array(eventTopicEnum).max(ALL_EVENT_TOPICS.length),
    // A connected app with notifications.manage shows message
    // notifications, so Signal should not.
    notificationsHandled: z.boolean(),
  })
  .strict();
export type RendererTopicsType = z.infer<typeof rendererTopicsSchema>;

const broadcastEvents = Object.keys(EVENT_TOPICS) as [
  BroadcastEventNameType,
  ...Array<BroadcastEventNameType>,
];

export const rendererEventsSchema = z
  .object({
    events: z
      .array(
        z
          .object({
            event: z.enum(broadcastEvents),
            data: z.record(z.string(), z.unknown()),
          })
          .strict()
      )
      .max(MAX_EVENTS_PER_BATCH),
    // The renderer fell too far behind and discarded queued events. Every
    // subscribed client gets `events.dropped` and must resynchronize.
    overflow: z.boolean().optional(),
  })
  .strict();
export type RendererEventsType = z.infer<typeof rendererEventsSchema>;

const serviceMethods = Object.keys(SERVICE_METHOD_CAPABILITIES) as [
  ServiceMethodType,
  ...Array<ServiceMethodType>,
];

export const rendererCallSchema = z
  .object({
    seq: z.number().int().nonnegative(),
    method: z.enum(serviceMethods),
    params: z.unknown(),
  })
  .strict();
export type RendererCallType = z.infer<typeof rendererCallSchema>;

const errorCodes = Object.values(ErrorCode) as [
  ErrorCodeType,
  ...Array<ErrorCodeType>,
];

const sendBlockReasons = Object.values(SendBlockReason) as [
  SendBlockReasonType,
  ...Array<SendBlockReasonType>,
];

export const rendererResultSchema = z.discriminatedUnion('ok', [
  z
    .object({
      seq: z.number().int().nonnegative(),
      ok: z.literal(true),
      value: z.unknown(),
    })
    .strict(),
  z
    .object({
      seq: z.number().int().nonnegative(),
      ok: z.literal(false),
      code: z.enum(errorCodes),
      reason: z.enum(sendBlockReasons).optional(),
    })
    .strict(),
]);
export type RendererResultType = z.infer<typeof rendererResultSchema>;
