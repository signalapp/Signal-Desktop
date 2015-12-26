/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    /*
    * Render an avatar identicon to an svg for use in a notification.
    */
    Whisper.IdenticonSVGView = Whisper.View.extend({
        templateName: 'identicon-svg',
        initialize: function(options) {
            this.render_attributes = options;
        },
        getSVGUrl: function() {
            var html = this.render().$el.html();
            var svg = new Blob([html], {type: 'image/svg+xml;charset=utf-8'});
            return URL.createObjectURL(svg);
        },
        getDataUrl: function() {
            var svgurl = this.getSVGUrl();
            return new Promise(function(resolve) {
                var img = document.createElement('img');
                img.onload = function () {
                    var canvas = loadImage.scale(img, {
                        canvas: true, maxWidth: 100, maxHeight: 100
                    });
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    URL.revokeObjectURL(svgurl);
                    resolve(canvas.toDataURL('image/png'));
                };

                img.src = svgurl;
            });
        }
    });
})();
