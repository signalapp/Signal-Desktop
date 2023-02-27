// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod';

import { themeSettingSchema } from './StorageUIKeys';
import { environmentSchema } from '../environment';

const configRequiredStringSchema = z.string().nonempty();
export type ConfigRequiredStringType = z.infer<
  typeof configRequiredStringSchema
>;

const configOptionalStringSchema = configRequiredStringSchema.or(z.undefined());
export type configOptionalStringType = z.infer<
  typeof configOptionalStringSchema
>;

export const directoryConfigSchema = z.object({
  directoryUrl: configRequiredStringSchema,
  directoryMRENCLAVE: configRequiredStringSchema,
});

export type DirectoryConfigType = z.infer<typeof directoryConfigSchema>;

export const rendererConfigSchema = z.object({
  appInstance: configOptionalStringSchema,
  appStartInitialSpellcheckSetting: z.boolean(),
  artCreatorUrl: configRequiredStringSchema,
  buildCreation: z.number(),
  buildExpiration: z.number(),
  cdnUrl0: configRequiredStringSchema,
  cdnUrl2: configRequiredStringSchema,
  certificateAuthority: configRequiredStringSchema,
  contentProxyUrl: configRequiredStringSchema,
  crashDumpsPath: configRequiredStringSchema,
  enableCI: z.boolean(),
  environment: environmentSchema,
  homePath: configRequiredStringSchema,
  hostname: configRequiredStringSchema,
  resolvedTranslationsLocale: configRequiredStringSchema,
  preferredSystemLocales: z.array(configRequiredStringSchema),
  name: configRequiredStringSchema,
  nodeVersion: configRequiredStringSchema,
  proxyUrl: configOptionalStringSchema,
  reducedMotionSetting: z.boolean(),
  serverPublicParams: configRequiredStringSchema,
  serverTrustRoot: configRequiredStringSchema,
  serverUrl: configRequiredStringSchema,
  sfuUrl: configRequiredStringSchema,
  storageUrl: configRequiredStringSchema,
  theme: themeSettingSchema,
  updatesUrl: configRequiredStringSchema,
  resourcesUrl: configRequiredStringSchema,
  userDataPath: configRequiredStringSchema,
  version: configRequiredStringSchema,
  directoryConfig: directoryConfigSchema,

  // Only used by main window
  isMainWindowFullScreen: z.boolean(),
  isMainWindowMaximized: z.boolean(),

  // Only for tests
  argv: configOptionalStringSchema,

  // Only for permission popup window
  forCalling: z.boolean(),
  forCamera: z.boolean(),
});

export type RendererConfigType = z.infer<typeof rendererConfigSchema>;
