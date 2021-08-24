// Copyright 2015-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global Whisper, loadImage, $ */

// eslint-disable-next-line func-names
(function () {
  window.Whisper = window.Whisper || {};

  /*
   * Render an avatar identicon to an svg for use in a notification.
   */
  Whisper.IdenticonSVGView = Whisper.View.extend({
    template: () => $('#identicon-svg').html(),
    initialize(options) {
      this.render_attributes = options;
      this.render_attributes.color = COLORS[this.render_attributes.color];
    },
    getSVGUrl() {
      const html = this.render().$el.html();
      const svg = new Blob([html], { type: 'image/svg+xml;charset=utf-8' });
      return URL.createObjectURL(svg);
    },
    getDataUrl() /* : Promise<string> */ {
      const svgurl = this.getSVGUrl();
      return new Promise(resolve => {
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = loadImage.scale(img, {
            canvas: true,
            maxWidth: 100,
            maxHeight: 100,
          });
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(svgurl);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
          URL.revokeObjectURL(svgurl);
          // If this fails for some reason, we'd rather continue on than reject.
          resolve(undefined);
        };

        img.src = svgurl;
      });
    },
  });

  const COLORS = {
    blue: '#0a69c7',
    burlap: '#866118',
    crimson: '#d00b2c',
    forest: '#067919',
    indigo: '#5151f6',
    plum: '#c70a88',
    steel: '#077288',
    taupe: '#cb0b6b',
    teal: '#077288',
    ultramarine: '#0d59f2',
    vermilion: '#c72a0a',
    violet: '#a20ced',
    wintergreen: '#067953',
  };
})();
