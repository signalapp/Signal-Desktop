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
    red: '#EF5350',
    pink: '#EC407A',
    purple: '#AB47BC',
    deep_purple: '#7E57C2',
    indigo: '#5C6BC0',
    blue: '#2196F3',
    light_blue: '#03A9F4',
    cyan: '#00BCD4',
    teal: '#009688',
    green: '#4CAF50',
    light_green: '#7CB342',
    orange: '#FF9800',
    deep_orange: '#FF5722',
    amber: '#FFB300',
    blue_grey: '#607D8B',
  };
})();
