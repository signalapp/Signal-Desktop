describe('GroupUpdateView', function() {
  it('should show new group members', function() {
    var view = new Whisper.GroupUpdateView({
      model: { joined: ['Alice', 'Bob'] },
    }).render();
    assert.match(view.$el.text(), /Alice.*Bob.*joined the group/);
  });

  it('should note updates to the title', function() {
    var view = new Whisper.GroupUpdateView({
      model: { name: 'New name' },
    }).render();
    assert.match(view.$el.text(), /Title is now 'New name'/);
  });

  it('should say "Updated the group"', function() {
    var view = new Whisper.GroupUpdateView({
      model: { avatar: 'New avatar' },
    }).render();
    assert.match(view.$el.text(), /Updated the group/);
  });
});
