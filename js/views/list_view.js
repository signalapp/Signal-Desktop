/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    /*
    * Generic list view that watches a given collection, wraps its members in
    * a given child view and adds the child view elements to its own element.
    */
    Whisper.ListView = Backbone.View.extend({
        tagName: 'ul',
        itemView: Backbone.View,
        initialize: function(options) {
            this.listenTo(this.collection, 'add', this.addOne);
            this.listenTo(this.collection, 'reset', this.addAll);

            if (options.window) {
                var $window = this.$(options.window);
                $window.scroll(this.onScroll.bind(this));
                $window.resize(this.onResize.bind(this));
            }
        },

        onResize: function(e) {
            this.resizing = true;
            clearTimeout(this.resizeTimer);
            resizeTimer = setTimeout(function() {
                resizing = false;
            }, 500);
            this.$el.scrollTop(this.scrollPercent * this.$el.height());
        },

        onScroll: function(e) {
            if (!this.resizing) {
                this.scrollTop = this.$el.scrollTop();
                this.scrollPercent = this.scrollTop / this.$el.height();
            }
        },

        addOne: function(model) {
            if (this.itemView) {
                var view = new this.itemView({model: model});
                this.$el.append(view.render().el);
                this.$el.trigger('add');
            }
        },

        addAll: function() {
            this.$el.html('');
            this.collection.each(this.addOne, this);
        },

        render: function() {
            this.addAll();
            return this;
        }
    });
})();
