describe('Threads', function() {
  it('should be ordered newest to oldest', function() {
    // Timestamps
    var today = new Date();
    var tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    // Add threads
    Whisper.Threads.add({ timestamp: today });
    Whisper.Threads.add({ timestamp: tomorrow });

    var models = Whisper.Threads.models;
    var firstTimestamp = models[0].get('timestamp').getTime();
    var secondTimestamp = models[1].get('timestamp').getTime();

    // Compare timestamps
    assert(firstTimestamp > secondTimestamp);
  });
});
