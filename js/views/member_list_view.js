/* global _, Whisper, */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.MemberListView = Whisper.View.extend({
    initialize(options) {
      this.member_list = [];
      this.memberMapping = {};
      this.selected_idx = 0;
      this.onClicked = options.onClicked;
      this.render();
    },
    render() {
      if (this.memberView) {
        this.memberView.remove();
        this.memberView = null;
      }

      this.memberView = new Whisper.ReactWrapperView({
        className: 'member-list',
        Component: window.Signal.Components.MemberList,
        props: {
          members: this.member_list,
          selected: this.selectedMember(),
          onMemberClicked: this.handleMemberClicked.bind(this),
        },
      });

      this.$el.append(this.memberView.el);
      return this;
    },
    handleMemberClicked(member) {
      this.onClicked(member);
    },
    updateMembers(members) {
      if (!_.isEqual(this.member_list, members)) {
        // Whenever the list is updated, we reset the selection
        this.selected_idx = 0;
        this.member_list = members;
        this.render();
      }
    },
    replaceMentions(message) {
      let result = message;

      // Sort keys from long to short, so we don't have to
      // worry about one key being a substring of another
      const keys = _.sortBy(_.keys(this.memberMapping), d => -d.length);

      keys.forEach(key => {
        const pubkey = this.memberMapping[key];
        result = result.split(key).join(`@${pubkey}`);
      });

      return result;
    },
    pendingMentions() {
      return this.memberMapping;
    },
    deleteMention(mention) {
      if (mention) {
        delete this.memberMapping[mention];
      } else {
        // Delete all mentions if no argument is passed
        this.memberMapping = {};
      }
    },
    membersShown() {
      return this.member_list.length !== 0;
    },
    selectUp() {
      this.selected_idx = Math.max(this.selected_idx - 1, 0);
      this.render();
    },
    selectDown() {
      this.selected_idx = Math.min(
        this.selected_idx + 1,
        this.member_list.length - 1
      );
      this.render();
    },
    selectedMember() {
      return this.member_list[this.selected_idx];
    },
    addPubkeyMapping(name, pubkey) {
      let handle = `@${name}`;
      let chars = 4;

      while (
        _.has(this.memberMapping, handle) &&
        this.memberMapping[handle] !== pubkey
      ) {
        const shortenedPubkey = pubkey.substr(pubkey.length - chars);
        handle = `@${name}(..${shortenedPubkey})`;
        chars += 1;
      }

      this.memberMapping[handle] = pubkey;
      return handle;
    },
  });
})();
