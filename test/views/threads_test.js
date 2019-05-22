/* global Whisper */

describe('Threads', () => {
  it('should be ordered newest to oldest', () => {
    // Timestamps
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    // Add threads
    Whisper.Threads.add({ timestamp: today });
    Whisper.Threads.add({ timestamp: tomorrow });

    const { models } = Whisper.Threads;
    const firstTimestamp = models[0].get('timestamp').getTime();
    const secondTimestamp = models[1].get('timestamp').getTime();

    // Compare timestamps
    assert(firstTimestamp > secondTimestamp);
  });
});
