// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { boolean, number, text } from '@storybook/addon-knobs';
import { storiesOf } from '@storybook/react';

import { pngUrl } from '../../storybook/Fixtures';
import { Image, Props } from './Image';
import { IMAGE_PNG } from '../../types/MIME';
import { ThemeType } from '../../types/Util';
import { setup as setupI18n } from '../../../js/modules/i18n';
import enMessages from '../../../_locales/en/messages.json';

const i18n = setupI18n('en', enMessages);

const story = storiesOf('Components/Conversation/Image', module);

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  alt: text('alt', overrideProps.alt || ''),
  attachment: overrideProps.attachment || {
    contentType: IMAGE_PNG,
    fileName: 'sax.png',
    url: pngUrl,
  },
  blurHash: text('blurHash', overrideProps.blurHash || ''),
  bottomOverlay: boolean('bottomOverlay', overrideProps.bottomOverlay || false),
  closeButton: boolean('closeButton', overrideProps.closeButton || false),
  curveBottomLeft: boolean(
    'curveBottomLeft',
    overrideProps.curveBottomLeft || false
  ),
  curveBottomRight: boolean(
    'curveBottomRight',
    overrideProps.curveBottomRight || false
  ),
  curveTopLeft: boolean('curveTopLeft', overrideProps.curveTopLeft || false),
  curveTopRight: boolean('curveTopRight', overrideProps.curveTopRight || false),
  darkOverlay: boolean('darkOverlay', overrideProps.darkOverlay || false),
  height: number('height', overrideProps.height || 100),
  i18n,
  noBackground: boolean('noBackground', overrideProps.noBackground || false),
  noBorder: boolean('noBorder', overrideProps.noBorder || false),
  onClick: action('onClick'),
  onClickClose: action('onClickClose'),
  onError: action('onError'),
  overlayText: text('overlayText', overrideProps.overlayText || ''),
  playIconOverlay: boolean(
    'playIconOverlay',
    overrideProps.playIconOverlay || false
  ),
  smallCurveTopLeft: boolean(
    'smallCurveTopLeft',
    overrideProps.smallCurveTopLeft || false
  ),
  softCorners: boolean('softCorners', overrideProps.softCorners || false),
  tabIndex: number('tabIndex', overrideProps.tabIndex || 0),
  theme: text('theme', overrideProps.theme || 'light') as ThemeType,
  url: text('url', overrideProps.url || pngUrl),
  width: number('width', overrideProps.width || 100),
});

story.add('URL with Height/Width', () => {
  const props = createProps();

  return <Image {...props} />;
});

story.add('Caption', () => {
  const defaultProps = createProps();
  const props = {
    ...defaultProps,
    attachment: {
      ...defaultProps.attachment,
      caption: '<Saxophone Pun>',
    },
  };

  return <Image {...props} />;
});

story.add('Play Icon', () => {
  const props = createProps({
    playIconOverlay: true,
  });

  return <Image {...props} />;
});

story.add('Close Button', () => {
  const props = createProps({
    closeButton: true,
  });

  return <Image {...props} />;
});

story.add('No Border or Background', () => {
  const props = createProps({
    attachment: {
      contentType: IMAGE_PNG,
      fileName: 'sax.png',
      url: pngUrl,
    },
    noBackground: true,
    noBorder: true,
    url: pngUrl,
  });

  return (
    <div style={{ backgroundColor: '#999' }}>
      <Image {...props} />
    </div>
  );
});

story.add('Pending', () => {
  const props = createProps();
  props.attachment.pending = true;

  return <Image {...props} />;
});

story.add('Pending w/blurhash', () => {
  const props = createProps();
  props.attachment.pending = true;

  return (
    <Image
      {...props}
      blurHash="LDA,FDBnm+I=p{tkIUI;~UkpELV]"
      width={300}
      height={400}
    />
  );
});

story.add('Curved Corners', () => {
  const props = createProps({
    curveBottomLeft: true,
    curveBottomRight: true,
    curveTopLeft: true,
    curveTopRight: true,
  });

  return <Image {...props} />;
});

story.add('Small Curve Top Left', () => {
  const props = createProps({
    smallCurveTopLeft: true,
  });

  return <Image {...props} />;
});

story.add('Soft Corners', () => {
  const props = createProps({
    softCorners: true,
  });

  return <Image {...props} />;
});

story.add('Bottom Overlay', () => {
  const props = createProps({
    bottomOverlay: true,
  });

  return <Image {...props} />;
});

story.add('Full Overlay with Text', () => {
  const props = createProps({
    darkOverlay: true,
    overlayText: 'Honk!',
  });

  return <Image {...props} />;
});

story.add('Blurhash', () => {
  const defaultProps = createProps();
  const props = {
    ...defaultProps,
    blurHash: 'thisisafakeblurhashthatwasmadeup',
  };

  return <Image {...props} />;
});

story.add('undefined blurHash (light)', () => {
  const defaultProps = createProps();
  const props = {
    ...defaultProps,
    blurHash: undefined,
    theme: ThemeType.light,
  };

  return <Image {...props} />;
});

story.add('undefined blurHash (dark)', () => {
  const defaultProps = createProps();
  const props = {
    ...defaultProps,
    blurHash: undefined,
    theme: ThemeType.dark,
  };

  return <Image {...props} />;
});

story.add('Missing Image', () => {
  const defaultProps = createProps();
  const props = {
    ...defaultProps,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attachment: undefined as any,
  };

  return <Image {...props} />;
});
