/* global Whisper: false */
/* global i18n: false */
/* global textsecure: false */
/* global _: false */
/* global emoji_util: false */
/* global Mustache: false */
/* global ConversationController: false */

// eslint-disable-next-line func-names
(function () {
  'use strict';

  const { HTML } = window.Signal;
  const { loadAttachmentData } = window.Signal.Migrations;

  window.Whisper = window.Whisper || {};

  const ErrorIconView = Whisper.View.extend({
    templateName: 'error-icon',
    className: 'error-icon-container',
    initialize() {
      if (this.model.name === 'UnregisteredUserError') {
        this.$el.addClass('unregistered-user-error');
      }
    },
  });
  const NetworkErrorView = Whisper.View.extend({
    tagName: 'span',
    className: 'hasRetry',
    templateName: 'hasRetry',
    render_attributes() {
      let messageNotSent;

      if (!this.model.someRecipientsFailed()) {
        messageNotSent = i18n('messageNotSent');
      }

      return {
        messageNotSent,
        resend: i18n('resend'),
      };
    },
  });
  const SomeFailedView = Whisper.View.extend({
    tagName: 'span',
    className: 'some-failed',
    templateName: 'some-failed',
    render_attributes: {
      someFailed: i18n('someRecipientsFailed'),
    },
  });
  const TimerView = Whisper.View.extend({
    templateName: 'hourglass',
    initialize() {
      this.listenTo(this.model, 'unload', this.remove);
    },
    update() {
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }
      if (this.model.isExpired()) {
        return this;
      }
      if (this.model.isExpiring()) {
        this.render();
        const totalTime = this.model.get('expireTimer') * 1000;
        const remainingTime = this.model.msTilExpire();
        const elapsed = (totalTime - remainingTime) / totalTime;
        this.$('.sand').css('transform', `translateY(${elapsed * 100}%)`);
        this.$el.css('display', 'inline-block');
        this.timeout = setTimeout(this.update.bind(this), Math.max(totalTime / 100, 500));
      }
      return this;
    },
  });

  Whisper.ExpirationTimerUpdateView = Whisper.View.extend({
    tagName: 'li',
    className: 'expirationTimerUpdate advisory',
    templateName: 'expirationTimerUpdate',
    id() {
      return this.model.id;
    },
    initialize() {
      this.conversation = this.model.getExpirationTimerUpdateSource();
      this.listenTo(this.conversation, 'change', this.render);
      this.listenTo(this.model, 'unload', this.remove);
    },
    render_attributes() {
      const seconds = this.model.get('expirationTimerUpdate').expireTimer;
      let timerMessage;

      const timerUpdate = this.model.get('expirationTimerUpdate');
      const prettySeconds = Whisper.ExpirationTimerOptions.getName(seconds);

      if (timerUpdate && timerUpdate.fromSync) {
        timerMessage = i18n('timerSetOnSync', prettySeconds);
      } else if (this.conversation.id === textsecure.storage.user.getNumber()) {
        timerMessage = i18n('youChangedTheTimer', prettySeconds);
      } else {
        timerMessage = i18n('theyChangedTheTimer', [
          this.conversation.getTitle(),
          prettySeconds,
        ]);
      }
      return { content: timerMessage };
    },
  });

  Whisper.KeyChangeView = Whisper.View.extend({
    tagName: 'li',
    className: 'keychange advisory',
    templateName: 'keychange',
    id() {
      return this.model.id;
    },
    initialize() {
      this.conversation = this.model.getModelForKeyChange();
      this.listenTo(this.conversation, 'change', this.render);
      this.listenTo(this.model, 'unload', this.remove);
    },
    events: {
      'click .content': 'showIdentity',
    },
    render_attributes() {
      return {
        content: this.model.getNotificationText(),
      };
    },
    showIdentity() {
      this.$el.trigger('show-identity', this.conversation);
    },
  });

  Whisper.VerifiedChangeView = Whisper.View.extend({
    tagName: 'li',
    className: 'verified-change advisory',
    templateName: 'verified-change',
    id() {
      return this.model.id;
    },
    initialize() {
      this.conversation = this.model.getModelForVerifiedChange();
      this.listenTo(this.conversation, 'change', this.render);
      this.listenTo(this.model, 'unload', this.remove);
    },
    events: {
      'click .content': 'showIdentity',
    },
    render_attributes() {
      let key;

      if (this.model.get('verified')) {
        if (this.model.get('local')) {
          key = 'youMarkedAsVerified';
        } else {
          key = 'youMarkedAsVerifiedOtherDevice';
        }
        return {
          icon: 'verified',
          content: i18n(key, this.conversation.getTitle()),
        };
      }

      if (this.model.get('local')) {
        key = 'youMarkedAsNotVerified';
      } else {
        key = 'youMarkedAsNotVerifiedOtherDevice';
      }

      return {
        icon: 'shield',
        content: i18n(key, this.conversation.getTitle()),
      };
    },
    showIdentity() {
      this.$el.trigger('show-identity', this.conversation);
    },
  });

  Whisper.MessageView = Whisper.View.extend({
    tagName: 'li',
    templateName: 'message',
    id() {
      return this.model.id;
    },
    initialize() {
      //   loadedAttachmentViews :: Promise (Array AttachmentView) | null
      this.loadedAttachmentViews = null;

      this.listenTo(this.model, 'change:errors', this.onErrorsChanged);
      this.listenTo(this.model, 'change:body', this.render);
      this.listenTo(this.model, 'change:delivered', this.renderDelivered);
      this.listenTo(this.model, 'change:read_by', this.renderRead);
      this.listenTo(this.model, 'change:expirationStartTimestamp', this.renderExpiring);
      this.listenTo(this.model, 'change', this.renderSent);
      this.listenTo(this.model, 'change:flags change:group_update', this.renderControl);
      this.listenTo(this.model, 'destroy', this.onDestroy);
      this.listenTo(this.model, 'unload', this.onUnload);
      this.listenTo(this.model, 'expired', this.onExpired);
      this.listenTo(this.model, 'pending', this.renderPending);
      this.listenTo(this.model, 'done', this.renderDone);
      this.timeStampView = new Whisper.ExtendedTimestampView();

      this.contact = this.model.isIncoming() ? this.model.getContact() : null;
      if (this.contact) {
        this.listenTo(this.contact, 'change:color', this.updateColor);
      }
    },
    events: {
      'click .retry': 'retryMessage',
      'click .error-icon': 'select',
      'click .timestamp': 'select',
      'click .status': 'select',
      'click .some-failed': 'select',
      'click .error-message': 'select',
    },
    retryMessage() {
      const retrys = _.filter(
        this.model.get('errors'),
        this.model.isReplayableError.bind(this.model)
      );
      _.map(retrys, 'number').forEach((number) => {
        this.model.resend(number);
      });
    },
    onExpired() {
      this.$el.addClass('expired');
      this.$el.find('.bubble').one('webkitAnimationEnd animationend', (e) => {
        if (e.target === this.$('.bubble')[0]) {
          this.remove();
        }
      });

      // Failsafe: if in the background, animation events don't fire
      setTimeout(this.remove.bind(this), 1000);
    },
    onUnload() {
      if (this.avatarView) {
        this.avatarView.remove();
      }
      if (this.errorIconView) {
        this.errorIconView.remove();
      }
      if (this.networkErrorView) {
        this.networkErrorView.remove();
      }
      if (this.someFailedView) {
        this.someFailedView.remove();
      }
      if (this.timeStampView) {
        this.timeStampView.remove();
      }
      if (this.replyView) {
        this.replyView.remove();
      }

      // NOTE: We have to do this in the background (`then` instead of `await`)
      // as our tests rely on `onUnload` synchronously removing the view from
      // the DOM.
      // eslint-disable-next-line more/no-then
      this.loadAttachmentViews()
        .then(views => views.forEach(view => view.unload()));

      // No need to handle this one, since it listens to 'unload' itself:
      //   this.timerView

      this.remove();
    },
    onDestroy() {
      if (this.$el.hasClass('expired')) {
        return;
      }
      this.onUnload();
    },
    select(e) {
      this.$el.trigger('select', { message: this.model });
      e.stopPropagation();
    },
    className() {
      return ['entry', this.model.get('type')].join(' ');
    },
    renderPending() {
      this.$el.addClass('pending');
    },
    renderDone() {
      this.$el.removeClass('pending');
    },
    renderSent() {
      if (this.model.isOutgoing()) {
        this.$el.toggleClass('sent', !!this.model.get('sent'));
      }
    },
    renderDelivered() {
      if (this.model.get('delivered')) { this.$el.addClass('delivered'); }
    },
    renderRead() {
      if (!_.isEmpty(this.model.get('read_by'))) {
        this.$el.addClass('read');
      }
    },
    onErrorsChanged() {
      if (this.model.isIncoming()) {
        this.render();
      } else {
        this.renderErrors();
      }
    },
    renderErrors() {
      const errors = this.model.get('errors');


      this.$('.error-icon-container').remove();
      if (this.errorIconView) {
        this.errorIconView.remove();
        this.errorIconView = null;
      }
      if (_.size(errors) > 0) {
        if (this.model.isIncoming()) {
          this.$('.content').text(this.model.getDescription()).addClass('error-message');
        }
        this.errorIconView = new ErrorIconView({ model: errors[0] });
        this.errorIconView.render().$el.appendTo(this.$('.bubble'));
      }

      this.$('.meta .hasRetry').remove();
      if (this.networkErrorView) {
        this.networkErrorView.remove();
        this.networkErrorView = null;
      }
      if (this.model.hasNetworkError()) {
        this.networkErrorView = new NetworkErrorView({ model: this.model });
        this.$('.meta').prepend(this.networkErrorView.render().el);
      }

      this.$('.meta .some-failed').remove();
      if (this.someFailedView) {
        this.someFailedView.remove();
        this.someFailedView = null;
      }
      if (this.model.someRecipientsFailed()) {
        this.someFailedView = new SomeFailedView();
        this.$('.meta').prepend(this.someFailedView.render().el);
      }
    },
    renderControl() {
      if (this.model.isEndSession() || this.model.isGroupUpdate()) {
        this.$el.addClass('control');
        const content = this.$('.content');
        content.text(this.model.getDescription());
        emoji_util.parse(content);
      } else {
        this.$el.removeClass('control');
      }
    },
    renderExpiring() {
      if (!this.timerView) {
        this.timerView = new TimerView({ model: this.model });
      }
      this.timerView.setElement(this.$('.timer'));
      this.timerView.update();
    },
    getQuoteObjectUrl() {
      // Potential sources of objectUrl, as provided in Conversation.processQuotes
      //   1. model.quotedMessage.imageUrl
      //   2. model.quoteThumbnail.objectUrl

      if (this.model.quotedMessageFromDatabase) {
        return this.model.quotedMessageFromDatabase.imageUrl;
      }
      if (this.model.quotedMessage) {
        return this.model.quotedMessage.imageUrl;
      }
      if (this.model.quoteThumbnail) {
        return this.model.quoteThumbnail.objectUrl;
      }

      return null;
    },
    renderReply() {
      const VOICE_FLAG = textsecure.protobuf.AttachmentPointer.Flags.VOICE_MESSAGE;
      const objectUrl = this.getQuoteObjectUrl();
      const quote = this.model.get('quote');
      if (!quote) {
        return;
      }

      function processAttachment(attachment) {
        const thumbnail = !attachment.thumbnail
          ? null
          : Object.assign({}, attachment.thumbnail, {
            objectUrl,
          });

        return Object.assign({}, attachment, {
          // eslint-disable-next-line no-bitwise
          isVoiceMessage: attachment.flags & VOICE_FLAG,
          thumbnail,
        });
      }

      const OUR_NUMBER = textsecure.storage.user.getNumber();
      const { author } = quote;
      const contact = ConversationController.get(author);

      const authorTitle = contact ? contact.getTitle() : author;
      const authorProfileName = contact ? contact.getProfileName() : null;
      const authorColor = contact ? contact.getColor() : 'grey';
      const isFromMe = contact ? contact.id === OUR_NUMBER : false;
      const isIncoming = this.model.isIncoming();

      const props = {
        attachments: quote.attachments && quote.attachments.map(processAttachment),
        authorColor,
        authorProfileName,
        authorTitle,
        isFromMe,
        isIncoming,
        onClick: () => {
          const { quotedMessage } = this.model;
          if (quotedMessage) {
            this.trigger('scroll-to-message', { id: quotedMessage.id });
          }
        },
        text: quote.text,
      };

      if (!this.replyView) {
        if (contact) {
          this.listenTo(contact, 'change:color', this.renderReply);
        }
        this.replyView = new Whisper.ReactWrapperView({
          el: this.$('.quote-wrapper'),
          Component: window.Signal.Components.Quote,
          props,
        });
      } else {
        this.replyView.update(props);
      }
    },
    isImageWithoutCaption() {
      const attachments = this.model.get('attachments');
      const body = this.model.get('body');
      if (!attachments || attachments.length === 0) {
        return false;
      }

      if (body && body.trim()) {
        return false;
      }

      const first = attachments[0];
      if (first.contentType.startsWith('image/') && first.contentType !== 'image/tiff') {
        return true;
      }

      return false;
    },
    render() {
      const contact = this.model.isIncoming() ? this.model.getContact() : null;
      this.$el.html(Mustache.render(_.result(this, 'template', ''), {
        message: this.model.get('body'),
        timestamp: this.model.get('sent_at'),
        sender: (contact && contact.getTitle()) || '',
        avatar: (contact && contact.getAvatar()),
        profileName: (contact && contact.getProfileName()),
        innerBubbleClasses: this.isImageWithoutCaption() ? '' : 'with-tail',
      }, this.render_partials()));
      this.timeStampView.setElement(this.$('.timestamp'));
      this.timeStampView.update();

      this.renderControl();

      const body = this.$('.body');

      emoji_util.parse(body);

      if (body.length > 0) {
        const escapedBody = body.html();
        body.html(HTML.render(escapedBody));
      }

      this.renderSent();
      this.renderDelivered();
      this.renderRead();
      this.renderErrors();
      this.renderExpiring();
      this.renderReply();


      // NOTE: We have to do this in the background (`then` instead of `await`)
      // as our code / Backbone seems to rely on `render` synchronously returning
      // `this` instead of `Promise MessageView` (this):
      // eslint-disable-next-line more/no-then
      this.loadAttachmentViews().then(views => this.renderAttachmentViews(views));

      return this;
    },
    updateColor() {
      const bubble = this.$('.bubble');

      // this.contact is known to be non-null if we're registered for color changes
      const color = this.contact.getColor();
      if (color) {
        bubble.removeClass(Whisper.Conversation.COLORS);
        bubble.addClass(color);
      }
      this.avatarView = new (Whisper.View.extend({
        templateName: 'avatar',
        render_attributes: { avatar: this.contact.getAvatar() },
      }))();
      this.$('.avatar').replaceWith(this.avatarView.render().$('.avatar'));
    },
    loadAttachmentViews() {
      if (this.loadedAttachmentViews !== null) {
        return this.loadedAttachmentViews;
      }

      const attachments = this.model.get('attachments') || [];
      const loadedAttachmentViews = Promise.all(attachments.map(attachment =>
        new Promise(async (resolve) => {
          const attachmentWithData = await loadAttachmentData(attachment);
          const view = new Whisper.AttachmentView({
            model: attachmentWithData,
            timestamp: this.model.get('sent_at'),
          });

          this.listenTo(view, 'update', () => {
            // NOTE: Can we do without `updated` flag now that we use promises?
            view.updated = true;
            resolve(view);
          });

          view.render();
        })));

      // Memoize attachment views to avoid double loading:
      this.loadedAttachmentViews = loadedAttachmentViews;

      return loadedAttachmentViews;
    },
    renderAttachmentViews(views) {
      views.forEach(view => this.renderAttachmentView(view));
    },
    renderAttachmentView(view) {
      if (!view.updated) {
        throw new Error('Invariant violation:' +
          ' Cannot render an attachment view that isn’t ready');
      }

      const parent = this.$('.attachments')[0];
      const isViewAlreadyChild = parent === view.el.parentNode;
      if (isViewAlreadyChild) {
        return;
      }

      if (view.el.parentNode) {
        view.el.parentNode.removeChild(view.el);
      }

      this.trigger('beforeChangeHeight');
      this.$('.attachments').append(view.el);
      view.setElement(view.el);
      this.trigger('afterChangeHeight');
    },
  });
}());
