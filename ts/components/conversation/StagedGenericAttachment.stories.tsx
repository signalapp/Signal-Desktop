// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { AttachmentType } from '../../types/Attachment';
import { stringToMIMEType } from '../../types/MIME';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './StagedGenericAttachment';
import { StagedGenericAttachment } from './StagedGenericAttachment';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/StagedGenericAttachment',
  argTypes: {},
  args: {
    attachment: {
      contentType: stringToMIMEType(''),
      fileName: '',
      url: '',
      size: 14243,
    },
    i18n,
    onClose: action('onClose'),
  },
} satisfies Meta<Props>;

const createAttachment = (
  props: Partial<AttachmentType> = {}
): AttachmentType => ({
  contentType: stringToMIMEType(props.contentType ?? ''),
  fileName: props.fileName ?? '',
  url: '',
  size: 14243,
});

export function TextFile(args: Props): JSX.Element {
  const attachment = createAttachment({
    contentType: stringToMIMEType('text/plain'),
    fileName: 'manifesto.txt',
  });

  return <StagedGenericAttachment {...args} attachment={attachment} />;
}

export function LongName(args: Props): JSX.Element {
  const attachment = createAttachment({
    contentType: stringToMIMEType('text/plain'),
    fileName: 'this-is-my-very-important-manifesto-you-must-read-it.txt',
  });

  return <StagedGenericAttachment {...args} attachment={attachment} />;
}

export function LongExtension(args: Props): JSX.Element {
  const attachment = createAttachment({
    contentType: stringToMIMEType('text/plain'),
    fileName: 'manifesto.reallylongtxt',
  });

  return <StagedGenericAttachment {...args} attachment={attachment} />;
}
