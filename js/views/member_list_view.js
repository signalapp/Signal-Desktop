/* global _, Whisper, */

// eslint-disable-next-line func-names
(function() {
  'use strict';

  window.Whisper = window.Whisper || {};

  Whisper.MemberListView = Whisper.View.extend({
    initialize(options) {
      this.member_list = [];
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
  });
})();
