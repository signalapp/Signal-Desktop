export function messageSelector({ model, view }: { model: any; view: any }) {
  // tslint:disable-next-line
  console.log({ model, view });

  return null;
  // const avatar = this.model.getAvatar();
  // const avatarPath = avatar && avatar.url;
  // const color = avatar && avatar.color;
  // const isMe = this.ourNumber === this.model.id;

  // const attachments = this.model.get('attachments') || [];
  // const loadedAttachmentViews = Promise.all(
  //   attachments.map(
  //     attachment =>
  //       new Promise(async resolve => {
  //         const attachmentWithData = await loadAttachmentData(attachment);
  //         const view = new Whisper.AttachmentView({
  //           model: attachmentWithData,
  //           timestamp: this.model.get('sent_at'),
  //         });

  //         this.listenTo(view, 'update', () => {
  //           // NOTE: Can we do without `updated` flag now that we use promises?
  //           view.updated = true;
  //           resolve(view);
  //         });

  //         view.render();
  //       })
  //   )
  // );

  // Wiring up TimerNotification

  // this.conversation = this.model.getExpirationTimerUpdateSource();
  // this.listenTo(this.conversation, 'change', this.render);
  // this.listenTo(this.model, 'unload', this.remove);
  // this.listenTo(this.model, 'change', this.onChange);

  // Wiring up SafetyNumberNotification

  // this.conversation = this.model.getModelForKeyChange();
  // this.listenTo(this.conversation, 'change', this.render);
  // this.listenTo(this.model, 'unload', this.remove);

  // Wiring up VerificationNotification

  // this.conversation = this.model.getModelForVerifiedChange();
  // this.listenTo(this.conversation, 'change', this.render);
  // this.listenTo(this.model, 'unload', this.remove);

  // this.contactView = new Whisper.ReactWrapperView({
  //   className: 'contact-wrapper',
  //   Component: window.Signal.Components.ContactListItem,
  //   props: {
  //     isMe,
  //     color,
  //     avatarPath,
  //     phoneNumber: model.getNumber(),
  //     name: model.getName(),
  //     profileName: model.getProfileName(),
  //     verified: model.isVerified(),
  //     onClick: showIdentity,
  //   },
  // });

  // this.$el.append(this.contactView.el);
}

// We actually don't listen to the model telling us that it's gone if it's disappearing
// onDestroy() {
//   if (this.$el.hasClass('expired')) {
//     return;
//   }
//   this.onUnload();
// },

// The backflips required to maintain scroll position when loading images
// Key is only adding the img to the DOM when the image has loaded.
//
// How might we get similar behavior with React?
//
// this.trigger('beforeChangeHeight');
// this.$('.attachments').append(view.el);
// view.setElement(view.el);
// this.trigger('afterChangeHeight');

// Timer code

// if (this.model.isExpired()) {
//   return this;
// }
// if (this.model.isExpiring()) {
//   this.render();
//   const totalTime = this.model.get('expireTimer') * 1000;
//   const remainingTime = this.model.msTilExpire();
//   const elapsed = (totalTime - remainingTime) / totalTime;
//   this.$('.sand').css('transform', `translateY(${elapsed * 100}%)`);
//   this.$el.css('display', 'inline-block');
//   this.timeout = setTimeout(
//     this.update.bind(this),
//     Math.max(totalTime / 100, 500)
//   );
// }

// Expiring message

// this.$el.addClass('expired');
// this.$el.find('.bubble').one('webkitAnimationEnd animationend', e => {
//   if (e.target === this.$('.bubble')[0]) {
//     this.remove();
//   }
// });

// // Failsafe: if in the background, animation events don't fire
// setTimeout(this.remove.bind(this), 1000);

// Retrying a message
// retryMessage() {
//   const retrys = _.filter(
//     this.model.get('errors'),
//     this.model.isReplayableError.bind(this.model)
//   );
//   _.map(retrys, 'number').forEach(number => {
//     this.model.resend(number);
//   });
// },
