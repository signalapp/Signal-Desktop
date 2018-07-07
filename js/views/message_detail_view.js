/* global Whisper, i18n, _, ConversationController, Mustache, moment */

/* eslint-disable more/no-then */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  const ContactView = Whisper.View.extend({
    className: 'contact-detail',
    templateName: 'contact-detail',
    initialize(options) {
      this.listenBack = options.listenBack;
      this.resetPanel = options.resetPanel;
      this.message = options.message;

      const newIdentity = i18n('newIdentity');
      this.errors = _.map(options.errors, error => {
        if (error.name === 'OutgoingIdentityKeyError') {
          // eslint-disable-next-line no-param-reassign
          error.message = newIdentity;
        }
        return error;
      });
      this.outgoingKeyError = _.find(
        this.errors,
        error => error.name === 'OutgoingIdentityKeyError'
      );
    },
    events: {
      click: 'onClick',
    },
    onClick() {
      if (this.outgoingKeyError) {
        const view = new Whisper.IdentityKeySendErrorPanelView({
          model: this.model,
          listenBack: this.listenBack,
          resetPanel: this.resetPanel,
        });

        this.listenTo(view, 'send-anyway', this.onSendAnyway);

        view.render();

        this.listenBack(view);
        view.$('.cancel').focus();
      }
    },
    forceSend() {
      this.model
        .updateVerified()
        .then(() => {
          if (this.model.isUnverified()) {
            return this.model.setVerifiedDefault();
          }
          return null;
        })
        .then(() => this.model.isUntrusted())
        .then(untrusted => {
          if (untrusted) {
            return this.model.setApproved();
          }
          return null;
        })
        .then(() => {
          this.message.resend(this.outgoingKeyError.number);
        });
    },
    onSendAnyway() {
      if (this.outgoingKeyError) {
        this.forceSend();
      }
    },
    render_attributes() {
      const showButton = Boolean(this.outgoingKeyError);

      return {
        status: this.message.getStatus(this.model.id),
        name: this.model.getTitle(),
        avatar: this.model.getAvatar(),
        errors: this.errors,
        showErrorButton: showButton,
        errorButtonLabel: i18n('view'),
      };
    },
  });

  Whisper.MessageDetailView = Whisper.View.extend({
    className: 'message-detail panel',
    templateName: 'message-detail',
    initialize(options) {
      this.listenBack = options.listenBack;
      this.resetPanel = options.resetPanel;

      this.view = new Whisper.MessageView({ model: this.model });
      this.view.render();
      this.conversation = options.conversation;

      this.listenTo(this.model, 'change', this.render);
    },
    events: {
      'click button.delete': 'onDelete',
    },
    onDelete() {
      const dialog = new Whisper.ConfirmationDialogView({
        message: i18n('deleteWarning'),
        okText: i18n('delete'),
        resolve: () => {
          this.model.destroy();
          this.resetPanel();
        },
      });

      this.$el.prepend(dialog.el);
      dialog.focusCancel();
    },
    getContacts() {
      // Return the set of models to be rendered in this view
      let ids;
      if (this.model.isIncoming()) {
        ids = [this.model.get('source')];
      } else if (this.model.isOutgoing()) {
        ids = this.model.get('recipients');
        if (!ids) {
          // older messages have no recipients field
          // use the current set of recipients
          ids = this.conversation.getRecipients();
        }
      }
      return Promise.all(
        ids.map(number =>
          ConversationController.getOrCreateAndWait(number, 'private')
        )
      );
    },
    renderContact(contact) {
      const view = new ContactView({
        model: contact,
        errors: this.grouped[contact.id],
        listenBack: this.listenBack,
        resetPanel: this.resetPanel,
        message: this.model,
      }).render();
      this.$('.contacts').append(view.el);
    },
    render() {
      const errorsWithoutNumber = _.reject(this.model.get('errors'), error =>
        Boolean(error.number)
      );

      this.$el.html(
        Mustache.render(_.result(this, 'template', ''), {
          sent_at: moment(this.model.get('sent_at')).format('LLLL'),
          received_at: this.model.isIncoming()
            ? moment(this.model.get('received_at')).format('LLLL')
            : null,
          tofrom: this.model.isIncoming() ? i18n('from') : i18n('to'),
          errors: errorsWithoutNumber,
          title: i18n('messageDetail'),
          sent: i18n('sent'),
          received: i18n('received'),
          errorLabel: i18n('error'),
          deleteLabel: i18n('deleteMessage'),
        })
      );
      this.view.$el.prependTo(this.$('.message-container'));

      this.grouped = _.groupBy(this.model.get('errors'), 'number');

      this.getContacts().then(contacts => {
        _.sortBy(contacts, c => {
          const prefix = this.grouped[c.id] ? '0' : '1';
          // this prefix ensures that contacts with errors are listed first;
          //   otherwise it's alphabetical
          return prefix + c.getTitle();
        }).forEach(this.renderContact.bind(this));
      });
    },
  });
})();
