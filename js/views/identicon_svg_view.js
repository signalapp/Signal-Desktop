/* global Whisper, loadImage */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  /*
    * Render an avatar identicon to an svg for use in a notification.
    */
  Whisper.IdenticonSVGView = Whisper.View.extend({
    templateName: 'identicon-svg',
    initialize(options) {
      this.render_attributes = options;
      this.render_attributes.color = COLORS[this.render_attributes.color];
    },
    getSVGUrl() {
      const html = this.render().$el.html();
      const svg = new Blob([html], { type: 'image/svg+xml;charset=utf-8' });
      return URL.createObjectURL(svg);
    },
    getDataUrl() {
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

        img.src = svgurl;
      });
    },
  });

  const COLORS = {
    red: '#cc163d',
    deep_orange: '#c73800',
    brown: '#746c53',
    pink: '#a23474',
    purple: '#862caf',
    indigo: '#5951c8',
    blue: '#336ba3',
    teal: '#067589',
    green: '#3b7845',
    light_green: '#895d66',
    blue_grey: '#607d8b',
    grey: '#6b6b78',
  };
})();
