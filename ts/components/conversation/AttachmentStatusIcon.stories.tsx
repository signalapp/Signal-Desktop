// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useRef, useState } from 'react';
import type { Meta } from '@storybook/react';
import type { PropsType } from './AttachmentStatusIcon.dom.js';
import { AttachmentStatusIcon } from './AttachmentStatusIcon.dom.js';
import { fakeAttachment } from '../../test-helpers/fakeAttachment.std.js';

export default {
  title: 'Components/Conversation/AttachmentStatusIcon',
  argTypes: {
    isIncoming: { control: { type: 'select' }, options: [true, false] },
  },
  args: {
    attachment: fakeAttachment(),
    isIncoming: false,
  },
} satisfies Meta<PropsType>;

export function Default(args: PropsType): JSX.Element {
  return (
    <div style={{ backgroundColor: 'gray' }}>
      <AttachmentStatusIcon {...args}>🔥🔥</AttachmentStatusIcon>
    </div>
  );
}

export function NeedsDownload(args: PropsType): JSX.Element {
  return (
    <div style={{ backgroundColor: 'gray' }}>
      <AttachmentStatusIcon
        {...args}
        attachment={fakeAttachment({ path: undefined })}
      >
        🔥🔥
      </AttachmentStatusIcon>
    </div>
  );
}

export function Downloading(args: PropsType): JSX.Element {
  return (
    <div style={{ backgroundColor: 'gray' }}>
      <AttachmentStatusIcon
        {...args}
        attachment={fakeAttachment({
          path: undefined,
          pending: true,
          size: 1000000,
          totalDownloaded: 750000,
        })}
      >
        🔥🔥
      </AttachmentStatusIcon>
    </div>
  );
}

export function Interactive(args: PropsType): JSX.Element {
  const size = 10000000;
  const [attachment, setAttachment] = useState(
    fakeAttachment({ path: undefined, size })
  );
  const intervalRef = useRef<NodeJS.Timeout | undefined>();

  const cancelAttachmentDownload = useCallback(() => {
    const newAttachment = { ...attachment, pending: false };
    setAttachment(newAttachment);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, [attachment, setAttachment]);
  const kickOffAttachmentDownload = useCallback(() => {
    let { totalDownloaded } = attachment;
    totalDownloaded = (totalDownloaded ?? 0) + size / 20;

    const newAttachment = { ...attachment, totalDownloaded, pending: true };
    setAttachment(newAttachment);

    intervalRef.current = setInterval(() => {
      totalDownloaded = (totalDownloaded ?? 0) + size / 20;
      setAttachment({ ...newAttachment, totalDownloaded });

      if (totalDownloaded >= size && intervalRef.current) {
        setAttachment({ ...newAttachment, pending: false, path: 'something ' });
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
    }, 300);
  }, [attachment, setAttachment]);

  return (
    <div style={{ backgroundColor: 'gray' }}>
      <button type="button" onClick={kickOffAttachmentDownload}>
        start download
      </button>
      <button type="button" onClick={cancelAttachmentDownload}>
        stop download
      </button>
      <AttachmentStatusIcon {...args} attachment={attachment}>
        🔥🔥
      </AttachmentStatusIcon>
    </div>
  );
}
