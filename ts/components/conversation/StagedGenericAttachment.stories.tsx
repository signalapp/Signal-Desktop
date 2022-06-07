// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import { text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import type { AttachmentType } from '../../types/Attachment';
import { stringToMIMEType } from '../../types/MIME';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import type { Props } from './StagedGenericAttachment';
import { StagedGenericAttachment } from './StagedGenericAttachment';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/StagedGenericAttachment',
};

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  attachment: overrideProps.attachment || ({} as AttachmentType),
  i18n,
  onClose: action('onClose'),
});

const createAttachment = (
  props: Partial<AttachmentType> = {}
): AttachmentType => ({
  contentType: stringToMIMEType(
    text('attachment contentType', props.contentType || '')
  ),
  fileName: text('attachment fileName', props.fileName || ''),
  url: '',
  size: 14243,
});

export const TextFile = (): JSX.Element => {
  const attachment = createAttachment({
    contentType: stringToMIMEType('text/plain'),
    fileName: 'manifesto.txt',
  });
  const props = createProps({ attachment });

  return <StagedGenericAttachment {...props} />;
};

export const LongName = (): JSX.Element => {
  const attachment = createAttachment({
    contentType: stringToMIMEType('text/plain'),
    fileName: 'this-is-my-very-important-manifesto-you-must-read-it.txt',
  });
  const props = createProps({ attachment });

  return <StagedGenericAttachment {...props} />;
};

export const LongExtension = (): JSX.Element => {
  const attachment = createAttachment({
    contentType: stringToMIMEType('text/plain'),
    fileName: 'manifesto.reallylongtxt',
  });
  const props = createProps({ attachment });

  return <StagedGenericAttachment {...props} />;
};
