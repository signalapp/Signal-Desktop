// Copyright 2020-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';

import { action } from '@storybook/addon-actions';
import { boolean, number, text } from '@storybook/addon-knobs';

import { pngUrl } from '../../storybook/Fixtures';
import type { Props } from './Image';
import { CurveType, Image } from './Image';
import { IMAGE_PNG } from '../../types/MIME';
import type { ThemeType } from '../../types/Util';
import { setupI18n } from '../../util/setupI18n';
import enMessages from '../../../_locales/en/messages.json';
import { StorybookThemeContext } from '../../../.storybook/StorybookThemeContext';

import { fakeAttachment } from '../../test-both/helpers/fakeAttachment';

const i18n = setupI18n('en', enMessages);

export default {
  title: 'Components/Conversation/Image',
};

const createProps = (overrideProps: Partial<Props> = {}): Props => ({
  alt: text('alt', overrideProps.alt || ''),
  attachment:
    overrideProps.attachment ||
    fakeAttachment({
      contentType: IMAGE_PNG,
      fileName: 'sax.png',
      url: pngUrl,
    }),
  blurHash: text('blurHash', overrideProps.blurHash || ''),
  bottomOverlay: boolean('bottomOverlay', overrideProps.bottomOverlay || false),
  closeButton: boolean('closeButton', overrideProps.closeButton || false),
  curveBottomLeft: number(
    'curveBottomLeft',
    overrideProps.curveBottomLeft || CurveType.None
  ),
  curveBottomRight: number(
    'curveBottomRight',
    overrideProps.curveBottomRight || CurveType.None
  ),
  curveTopLeft: number(
    'curveTopLeft',
    overrideProps.curveTopLeft || CurveType.None
  ),
  curveTopRight: number(
    'curveTopRight',
    overrideProps.curveTopRight || CurveType.None
  ),
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
  tabIndex: number('tabIndex', overrideProps.tabIndex || 0),
  theme: text('theme', overrideProps.theme || 'light') as ThemeType,
  url: text('url', 'url' in overrideProps ? overrideProps.url || '' : pngUrl),
  width: number('width', overrideProps.width || 100),
});

export const UrlWithHeightWidth = (): JSX.Element => {
  const props = createProps();

  return <Image {...props} />;
};

UrlWithHeightWidth.story = {
  name: 'URL with Height/Width',
};

export const Caption = (): JSX.Element => {
  const defaultProps = createProps();
  const props = {
    ...defaultProps,
    attachment: {
      ...defaultProps.attachment,
      caption: '<Saxophone Pun>',
    },
  };

  return <Image {...props} />;
};

export const PlayIcon = (): JSX.Element => {
  const props = createProps({
    playIconOverlay: true,
  });

  return <Image {...props} />;
};

export const CloseButton = (): JSX.Element => {
  const props = createProps({
    closeButton: true,
  });

  return <Image {...props} />;
};

export const NoBorderOrBackground = (): JSX.Element => {
  const props = createProps({
    attachment: fakeAttachment({
      contentType: IMAGE_PNG,
      fileName: 'sax.png',
      url: pngUrl,
    }),
    noBackground: true,
    noBorder: true,
    url: pngUrl,
  });

  return (
    <div style={{ backgroundColor: '#999' }}>
      <Image {...props} />
    </div>
  );
};

NoBorderOrBackground.story = {
  name: 'No Border or Background',
};

export const Pending = (): JSX.Element => {
  const props = createProps({
    attachment: fakeAttachment({
      contentType: IMAGE_PNG,
      fileName: 'sax.png',
      url: pngUrl,
      pending: true,
    }),
  });

  return <Image {...props} />;
};

export const PendingWBlurhash = (): JSX.Element => {
  const props = createProps({
    attachment: fakeAttachment({
      contentType: IMAGE_PNG,
      fileName: 'sax.png',
      url: pngUrl,
      pending: true,
    }),
  });

  return (
    <Image
      {...props}
      blurHash="LDA,FDBnm+I=p{tkIUI;~UkpELV]"
      width={300}
      height={400}
    />
  );
};

PendingWBlurhash.story = {
  name: 'Pending w/blurhash',
};

export const CurvedCorners = (): JSX.Element => {
  const props = createProps({
    curveBottomLeft: CurveType.Normal,
    curveBottomRight: CurveType.Normal,
    curveTopLeft: CurveType.Normal,
    curveTopRight: CurveType.Normal,
  });

  return <Image {...props} />;
};

export const SmallCurveTopLeft = (): JSX.Element => {
  const props = createProps({
    curveTopLeft: CurveType.Small,
  });

  return <Image {...props} />;
};

export const SoftCorners = (): JSX.Element => {
  const props = createProps({
    curveBottomLeft: CurveType.Tiny,
    curveBottomRight: CurveType.Tiny,
    curveTopLeft: CurveType.Tiny,
    curveTopRight: CurveType.Tiny,
  });

  return <Image {...props} />;
};

export const BottomOverlay = (): JSX.Element => {
  const props = createProps({
    bottomOverlay: true,
  });

  return <Image {...props} />;
};

export const FullOverlayWithText = (): JSX.Element => {
  const props = createProps({
    darkOverlay: true,
    overlayText: 'Honk!',
  });

  return <Image {...props} />;
};

FullOverlayWithText.story = {
  name: 'Full Overlay with Text',
};

export const Blurhash = (): JSX.Element => {
  const defaultProps = createProps();
  const props = {
    ...defaultProps,
    blurHash: 'thisisafakeblurhashthatwasmadeup',
  };

  return <Image {...props} />;
};

export const UndefinedBlurHash = (): JSX.Element => {
  const Wrapper = () => {
    const theme = React.useContext(StorybookThemeContext);
    const props = createProps({
      blurHash: undefined,
      theme,
      url: undefined,
    });

    return <Image {...props} />;
  };

  return <Wrapper />;
};

UndefinedBlurHash.story = {
  name: 'undefined blurHash',
};

export const MissingImage = (): JSX.Element => {
  const defaultProps = createProps();
  const props = {
    ...defaultProps,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    attachment: undefined as any,
  };

  return <Image {...props} />;
};
