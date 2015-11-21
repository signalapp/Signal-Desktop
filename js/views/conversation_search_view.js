/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.ConversationSearchView = Whisper.View.extend({
        className: 'conversation-search',
        initialize: function(options) {
            this.$input = options.input;
            this.$new_contact = this.$('.new-contact');

            this.typeahead = new Whisper.ConversationCollection();
            // View to display the matched contacts from typeahead
            this.typeahead_view = new Whisper.ConversationListView({
                collection : new Whisper.ConversationCollection([], {
                    comparator: function(m) { return m.getTitle().toLowerCase(); }
                })
            });
            this.$el.append(this.typeahead_view.el);
            this.initNewContact();
            //this.listenTo(this.collection, 'reset', this.filterContacts);
            this.pending = Promise.resolve();
        },

        events: {
            'select .new-contact': 'createConversation',
            'select .contacts': 'open'
        },

        filterContacts: function(e) {
            var query = this.$input.val();
            if (query.length) {
                if (this.maybeNumber(query)) {
                    this.new_contact_view.model.set('id', query);
                    this.new_contact_view.render().$el.show();
                } else {
                    this.new_contact_view.$el.hide();
                }
                this.pending = this.pending.then(function() {
                    return this.typeahead.search(query).then(function() {
                        this.typeahead_view.collection.reset(this.typeahead.models);
                    }.bind(this));
                }.bind(this));
                this.trigger('show');
            } else {
                this.resetTypeahead();
            }
        },

        initNewContact: function() {
            if (this.new_contact_view) {
                this.new_contact_view.undelegateEvents();
                this.new_contact_view.$el.hide();
            }
            // Creates a view to display a new contact
            this.new_contact_view = new Whisper.ConversationListItemView({
                el: this.$new_contact,
                model: ConversationController.create({
                    type: 'private',
                    newContact: true
                })
            }).render();
        },

        createConversation: function() {
            this.$el.trigger('open', this.new_contact_view.model);
            this.initNewContact();
            this.resetTypeahead();
        },

        open: function(e, conversation) {
            this.$el.trigger('open', conversation);
        },

        reset: function() {
            this.delegateEvents();
            this.typeahead_view.delegateEvents();
            this.new_contact_view.delegateEvents();
            this.resetTypeahead();
        },

        resetTypeahead: function() {
            this.new_contact_view.$el.hide();
            this.$input.val('').focus();
            this.typeahead_view.collection.reset([]);
            this.trigger('hide');
        },

        maybeNumber: function(number) {
            return number.match(/^\+?[0-9]*$/);
        }
    });

})();
