// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import z from 'zod';

export enum NotificationType {
  IncomingCall = 'IncomingCall',
  IncomingGroupCall = 'IncomingGroupCall',
  IsPresenting = 'IsPresenting',
  Message = 'Message',
  Reaction = 'Reaction',
  MinimizedToTray = 'MinimizedToTray',
}

export const WindowsNotificationDataSchema = z.object({
  avatarPath: z.string().optional(),
  body: z.string(),
  heading: z.string(),
  token: z.string(),
  type: z.nativeEnum(NotificationType),
});

export type WindowsNotificationData = z.infer<
  typeof WindowsNotificationDataSchema
>;

export const WindowsNotificationWorkerDataSchema = z.object({
  AUMID: z.string(),
});

export type WindowsNotificationWorkerDataType = z.infer<
  typeof WindowsNotificationWorkerDataSchema
>;

export const WindowsNotificationRequestSchema = z.union([
  z.object({
    command: z.literal('show'),
    notificationData: WindowsNotificationDataSchema,
  }),
  z.object({
    command: z.literal('clearAll'),
  }),
  z.object({
    command: z.literal('sendDummyKeystroke'),
  }),
]);

export type WindowsNotificationRequestType = z.infer<
  typeof WindowsNotificationRequestSchema
>;
