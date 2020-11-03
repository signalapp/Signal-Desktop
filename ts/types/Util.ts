// Copyright 2018-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

export interface BodyRangeType {
  start: number;
  length: number;
  mentionUuid: string;
  replacementText: string;
  conversationID?: string;
}

export type BodyRangesType = Array<BodyRangeType>;

export type RenderTextCallbackType = (options: {
  text: string;
  key: number;
}) => JSX.Element | string;

export type ReplacementValuesType = {
  [key: string]: string | undefined;
};

export type LocalizerType = (
  key: string,
  values?: Array<string | null> | ReplacementValuesType
) => string;
