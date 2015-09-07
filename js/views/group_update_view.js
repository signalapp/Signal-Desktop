/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';

    window.Whisper = window.Whisper || {};

    Whisper.GroupUpdateView = Backbone.View.extend({
        tagName:   "div",
        className: "group-update",
        render: function() {
            //TODO l10n
            if (this.model.left) {
                this.$el.text(this.model.left + ' left the group');
                return this;
            }

            var messages = ['Updated the group.'];
            if (this.model.name) {
                messages.push("Title is now '" + this.model.name + "'.");
            }
            if (this.model.joined) {
                messages.push(this.model.joined.join(', ') + ' joined the group');
            }

            this.$el.text(messages.join(' '));

            return this;
        }
    });

})();
