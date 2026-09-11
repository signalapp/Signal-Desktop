// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { _shouldBlockInteractionBehindLightbox } from '../../components/Lightbox.dom.tsx';

describe('<Lightbox>', () => {
  describe('_shouldBlockInteractionBehindLightbox', () => {
    let container: HTMLDivElement;
    let child: HTMLButtonElement;
    let outside: HTMLTextAreaElement;

    beforeEach(() => {
      container = document.createElement('div');
      child = document.createElement('button');
      outside = document.createElement('textarea');

      container.appendChild(child);
      document.body.append(container, outside);
    });

    afterEach(() => {
      container.remove();
      outside.remove();
    });

    it('blocks key events from elements behind the lightbox', () => {
      assert.isTrue(_shouldBlockInteractionBehindLightbox(outside, container));
    });

    it('allows key events from elements inside the lightbox', () => {
      assert.isFalse(_shouldBlockInteractionBehindLightbox(child, container));
    });

    it('allows key events before the lightbox container is ready', () => {
      assert.isFalse(_shouldBlockInteractionBehindLightbox(outside, null));
    });
  });
});
