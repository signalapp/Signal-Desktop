import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { boolean, text, withKnobs } from '@storybook/addon-knobs';
import { action } from '@storybook/addon-actions';

import { AttachmentType } from '../../types/Attachment';
import { MIMEType } from '../../types/MIME';

// @ts-ignore
import { setup as setupI18n } from '../../../js/modules/i18n';

// @ts-ignore
import enMessages from '../../../_locales/en/messages.json';

import { Props, StagedLinkPreview } from './StagedLinkPreview';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Conversation/StagedLinkPreview', module);

story.addDecorator((withKnobs as any)({ escapeHTML: false }));

const createAttachment = (
  props: Partial<AttachmentType> = {}
): AttachmentType => ({
  contentType: text(
    'attachment contentType',
    props.contentType || ''
  ) as MIMEType,
  fileName: text('attachment fileName', props.fileName || ''),
  url: text('attachment url', props.url || ''),
});

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  isLoaded: boolean('isLoaded', overrideProps.isLoaded !== false),
  title: text('title', overrideProps.title || ''),
  domain: text('domain', overrideProps.domain || ''),
  image: overrideProps.image,
  i18n,
  onClose: action('onClose'),
});

story.add('Loading', () => {
  const props = createProps({
    isLoaded: false,
  });

  return <StagedLinkPreview {...props} />;
});

story.add('No Image', () => {
  const props = createProps({
    title: 'This is a super-sweet site',
    domain: 'instagram.com',
  });

  return <StagedLinkPreview {...props} />;
});

story.add('Image', () => {
  const props = createProps({
    title: 'This is a super-sweet site',
    domain: 'instagram.com',
    image: createAttachment({
      url: '/fixtures/kitten-4-112-112.jpg',
      contentType: 'image/jpeg' as MIMEType,
    }),
  });

  return <StagedLinkPreview {...props} />;
});

story.add('Image, No Title', () => {
  const props = createProps({
    domain: 'instagram.com',
    image: createAttachment({
      url: '/fixtures/kitten-4-112-112.jpg',
      contentType: 'image/jpeg' as MIMEType,
    }),
  });

  return <StagedLinkPreview {...props} />;
});

story.add('No Image, Long Title', () => {
  const props = createProps({
    title:
      "This is a super-sweet site. And it's got some really amazing content in store for you if you just click that link. Can you click that link for me?",
    domain: 'instagram.com',
  });

  return <StagedLinkPreview {...props} />;
});

story.add('Image, Long Title', () => {
  const props = createProps({
    title:
      "This is a super-sweet site. And it's got some really amazing content in store for you if you just click that link. Can you click that link for me?",
    domain: 'instagram.com',
    image: createAttachment({
      url: '/fixtures/kitten-4-112-112.jpg',
      contentType: 'image/jpeg' as MIMEType,
    }),
  });

  return <StagedLinkPreview {...props} />;
});
