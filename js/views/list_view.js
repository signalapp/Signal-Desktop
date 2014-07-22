var Whisper = Whisper || {};

(function () {
  'use strict';

  /*
   * Generic list view that watches a given collection, wraps its members in
   * a given child view and adds the child view elements to its own element.
   */
  Whisper.ListView = Backbone.View.extend({
    tagName: 'ul',
    initialize: function() {
      this.listenTo(this.collection, 'change', this.render); // auto update
      this.listenTo(this.collection, 'add', this.addOne);
      this.listenTo(this.collection, 'reset', this.addAll);
      this.listenTo(this.collection, 'all', this.render);
      this.collection.fetch({reset: true});
    },

    addOne: function(model) {
      if (this.itemView) {
        var view = new this.itemView({model: model});
        this.$el.append(view.render().el);
      }
    },

    addAll: function() {
      this.$el.html('');
      this.collection.each(this.addOne, this);
    },

    last: function() {
      this.collection.at(this.collection.length - 1);
    }
  });
})();
