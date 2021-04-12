// Copyright 2015-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

/* global Whisper, i18n, $ */

// eslint-disable-next-line func-names
(function () {
  window.Whisper = window.Whisper || {};

  Whisper.GroupMemberList = Whisper.View.extend({
    className: 'group-member-list panel',
    template: () => $('#group-member-list').html(),
    initialize(options) {
      this.needVerify = options.needVerify;

      this.render();

      this.member_list_view = new Whisper.ContactListView({
        collection: this.model,
        className: 'members',
        toInclude: {
          listenBack: options.listenBack,
          conversation: options.conversation,
        },
      });
      this.member_list_view.render();

      this.$('.container').append(this.member_list_view.el);
    },
    render_attributes() {
      let summary;
      if (this.needVerify) {
        summary = i18n('membersNeedingVerification');
      }

      return {
        members: i18n('groupMembers'),
        summary,
      };
    },
  });
})();
