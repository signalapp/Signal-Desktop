// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { render } from 'react-dom';
import type { PropsType } from '../components/Lightbox';
import { Lightbox } from '../components/Lightbox';

// NOTE: This file is temporarily here for convenicence of use by
// conversation_view while it is transitioning from Backbone into pure React.
// Please use <Lightbox /> directly and DO NOT USE THESE FUNCTIONS.

let lightboxMountNode: HTMLElement | undefined;

export function closeLightbox(): void {
  if (!lightboxMountNode) {
    return;
  }

  window.ReactDOM.unmountComponentAtNode(lightboxMountNode);
  document.body.removeChild(lightboxMountNode);
  lightboxMountNode = undefined;
}

export function showLightbox(props: PropsType): void {
  if (lightboxMountNode) {
    closeLightbox();
  }

  lightboxMountNode = document.createElement('div');
  lightboxMountNode.setAttribute('data-id', 'lightbox');
  document.body.appendChild(lightboxMountNode);

  render(<Lightbox {...props} />, lightboxMountNode);
}
