/* global window */

// eslint-disable-next-line func-names
(function() {
  // Possible conversation friend states
  const friendRequestStatusEnum = Object.freeze({
    // New conversation, no messages sent or received
    none: 0,
    // This state is used to lock the input early while sending
    pendingSend: 1,
    // Friend request sent, awaiting response
    requestSent: 2,
    // Friend request received, awaiting user input
    requestReceived: 3,
    // We did it!
    friends: 4,
    // Friend Request sent but timed out
    requestExpired: 5,
  });

  window.friends = {
    friendRequestStatusEnum,
  };
})();
