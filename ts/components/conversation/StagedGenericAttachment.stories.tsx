import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { text } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { AttachmentType } from '../../types/Attachment';
import { MIMEType } from '../../types/MIME';
import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';
import { Props, StagedGenericAttachment } from './StagedGenericAttachment';

const i18n = setupI18n('en', enMessages);

const story = storiesOf(
  'Components/Conversation/StagedGenericAttachment',
  module
);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  attachment: overrideProps.attachment || ({} as AttachmentType),
  i18n,
  onClose: action('onClose'),
});

const createAttachment = (
  props: Partial<AttachmentType> = {}
): AttachmentType => ({
  contentType: text(
    'attachment contentType',
    props.contentType || ''
  ) as MIMEType,
  fileName: text('attachment fileName', props.fileName || ''),
  url: '',
});

story.add('Text File', () => {
  const attachment = createAttachment({
    contentType: 'text/plain' as MIMEType,
    fileName: 'manifesto.txt',
  });
  const props = createProps({ attachment });

  return <StagedGenericAttachment {...props} />;
});

story.add('Long Name', () => {
  const attachment = createAttachment({
    contentType: 'text/plain' as MIMEType,
    fileName: 'this-is-my-very-important-manifesto-you-must-read-it.txt',
  });
  const props = createProps({ attachment });

  return <StagedGenericAttachment {...props} />;
});

story.add('Long Extension', () => {
  const attachment = createAttachment({
    contentType: 'text/plain' as MIMEType,
    fileName: 'manifesto.reallylongtxt',
  });
  const props = createProps({ attachment });

  return <StagedGenericAttachment {...props} />;
});
