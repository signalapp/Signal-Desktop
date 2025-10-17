// Copyright 2024 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { action } from '@storybook/addon-actions';
import {
  type PropsType,
  AttachmentDetailPill,
} from './AttachmentDetailPill.dom.js';
import { type ComponentMeta } from '../../storybook/types.std.js';
import { fakeAttachment } from '../../test-helpers/fakeAttachment.std.js';

const { i18n } = window.SignalContext;

export default {
  title: 'Components/Conversation/AttachmentDetailPill',
  component: AttachmentDetailPill,
  argTypes: {
    isGif: { control: { type: 'boolean' } },
  },
  args: {
    i18n,
    attachments: [],
    isGif: false,
    startDownload: action('startDownload'),
    cancelDownload: action('cancelDownload'),
  },
} satisfies ComponentMeta<PropsType>;

export function NoneDefaultsBlank(args: PropsType): JSX.Element {
  return <AttachmentDetailPill {...args} />;
}

export function OneDownloadedBlank(args: PropsType): JSX.Element {
  return <AttachmentDetailPill {...args} attachments={[fakeAttachment()]} />;
}

export function OneNotPendingNotDownloaded(args: PropsType): JSX.Element {
  return (
    <AttachmentDetailPill
      {...args}
      attachments={[
        fakeAttachment({
          path: undefined,
        }),
      ]}
    />
  );
}

export function OnePendingNotDownloading(args: PropsType): JSX.Element {
  return (
    <AttachmentDetailPill
      {...args}
      attachments={[
        fakeAttachment({
          pending: true,
          path: undefined,
        }),
      ]}
    />
  );
}

export function OneDownloading(args: PropsType): JSX.Element {
  return (
    <AttachmentDetailPill
      {...args}
      attachments={[
        fakeAttachment({
          pending: true,
          path: undefined,
          totalDownloaded: 5000,
        }),
      ]}
    />
  );
}

export function OneNotPendingSomeDownloaded(args: PropsType): JSX.Element {
  return (
    <AttachmentDetailPill
      {...args}
      attachments={[
        fakeAttachment({
          path: undefined,
          totalDownloaded: 5000,
        }),
      ]}
    />
  );
}

export function OneIncrementalDownloadedBlank(args: PropsType): JSX.Element {
  return (
    <AttachmentDetailPill
      {...args}
      attachments={[
        fakeAttachment({
          incrementalMac: 'something',
          chunkSize: 10,
        }),
      ]}
    />
  );
}

export function OneIncrementalNotPendingNotDownloaded(
  args: PropsType
): JSX.Element {
  return (
    <AttachmentDetailPill
      {...args}
      attachments={[
        fakeAttachment({
          incrementalMac: 'something',
          chunkSize: 10,
          path: undefined,
        }),
      ]}
    />
  );
}

export function OneIncrementalPendingNotDownloading(
  args: PropsType
): JSX.Element {
  return (
    <AttachmentDetailPill
      {...args}
      attachments={[
        fakeAttachment({
          incrementalMac: 'something',
          chunkSize: 10,
          pending: true,
          path: undefined,
        }),
      ]}
    />
  );
}

export function OneIncrementalDownloading(args: PropsType): JSX.Element {
  return (
    <AttachmentDetailPill
      {...args}
      attachments={[
        fakeAttachment({
          incrementalMac: 'something',
          chunkSize: 10,
          pending: true,
          path: undefined,
          totalDownloaded: 5000,
        }),
      ]}
    />
  );
}

export function OneIncrementalNotPendingSomeDownloaded(
  args: PropsType
): JSX.Element {
  return (
    <AttachmentDetailPill
      {...args}
      attachments={[
        fakeAttachment({
          incrementalMac: 'something',
          chunkSize: 10,
          path: undefined,
          totalDownloaded: 5000,
        }),
      ]}
    />
  );
}
