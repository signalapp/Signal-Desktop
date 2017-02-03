/*
 * vim: ts=4:sw=4:expandtab
 */
(function () {
    'use strict';
    window.Whisper = window.Whisper || {};

    Whisper.NewContactView = Whisper.View.extend({
        templateName: 'new-contact',
        className: 'conversation-list-item contact',
        events: {
            'click': 'validate'
        },
        initialize: function() {
            this.listenTo(this.model, 'change', this.render); // auto update
        },
        render_attributes: function() {
            return {
                    number: i18n('newContact'),
                    title: this.model.getNumber(),
                    avatar: this.model.getAvatar(),
            };
        },
        validate: function() {
            if (this.model.isValid()) {
                this.$el.addClass('valid');
            } else {
                this.$el.removeClass('valid');
            }
        },
    });

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
            'click .new-contact': 'createConversation',
        },

        filterContacts: function() {
            var query = this.$input.val().trim();
            if (query.length) {
                if (this.maybeNumber(query)) {
                    this.new_contact_view.model.set('id', query);
                    this.new_contact_view.render().$el.show();
                    this.new_contact_view.validate();
                    this.hideHints();

                } else {
                    this.new_contact_view.$el.hide();
                }
                this.pending = this.pending.then(function() {
                    return this.typeahead.search(query).then(function() {
                        this.typeahead_view.collection.reset(
                            this.typeahead.filter(function(m) {
                                return m.isSearchable();
                            })
                        );
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
            this.new_contact_view = new Whisper.NewContactView({
                el: this.$new_contact,
                model: ConversationController.create({
                    type: 'private'
                })
            }).render();
        },

        createConversation: function() {
            var conversation = this.new_contact_view.model;
            if (this.new_contact_view.model.isValid()) {
                ConversationController.findOrCreatePrivateById(
                    this.new_contact_view.model.id
                ).then(function(conversation) {
                    this.trigger('open', conversation);
                    this.initNewContact();
                    this.resetTypeahead();
                }.bind(this));
            } else {
                this.new_contact_view.$('.number').text(i18n('invalidNumberError'));
                this.$input.focus();
            }
        },

        reset: function() {
            this.delegateEvents();
            this.typeahead_view.delegateEvents();
            this.new_contact_view.delegateEvents();
            this.resetTypeahead();
        },

        resetTypeahead: function() {
            this.hideHints();
            this.new_contact_view.$el.hide();
            this.$input.val('').focus();
            if (this.showAllContacts) {
                this.typeahead.fetchAlphabetical().then(function() {
                    if (this.typeahead.length > 0) {
                        this.typeahead_view.collection.reset(
                            this.typeahead.filter(function(m) {
                                return m.isSearchable();
                            })
                        );
                    } else {
                        this.showHints();
                    }
                }.bind(this));
                this.trigger('show');
            } else {
                this.typeahead_view.collection.reset([]);
                this.trigger('hide');
            }
        },

        showHints: function() {
            if (!this.hintView) {
                this.hintView = new Whisper.HintView({
                    className: 'contact placeholder',
                    content: i18n('newPhoneNumber')
                }).render();
                this.hintView.$el.insertAfter(this.$input);
            }
            this.hintView.$el.show();
        },

        hideHints: function() {
            if (this.hintView) {
                this.hintView.remove();
                this.hintView = null;
            }
        },

        maybeNumber: function(number) {
            return number.replace(/[\s-.\(\)]*/g,'').match(/^\+?[0-9]*$/);
        }
    });

})();
