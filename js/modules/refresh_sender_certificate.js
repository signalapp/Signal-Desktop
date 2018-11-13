/* global window, setTimeout, clearTimeout, textsecure, WebAPI, ConversationController */

module.exports = {
  initialize,
};

const ONE_DAY = 24 * 60 * 60 * 1000; // one day
const MINIMUM_TIME_LEFT = 2 * 60 * 60 * 1000; // two hours

let initialized = false;
let timeout = null;
let scheduledTime = null;

// We need to refresh our own profile regularly to account for newly-added devices which
//   do not support unidentified delivery.
function refreshOurProfile() {
  const ourNumber = textsecure.storage.user.getNumber();
  const conversation = ConversationController.getOrCreate(ourNumber, 'private');
  conversation.getProfiles();
}

function initialize({ events, storage, navigator, logger }) {
  if (initialized) {
    logger.warn('refreshSenderCertificate: already initialized!');
    return;
  }
  initialized = true;

  runWhenOnline();

  events.on('timetravel', () => {
    if (initialized) {
      scheduleNextRotation();
    }
  });

  function scheduleNextRotation() {
    const now = Date.now();
    const certificate = storage.get('senderCertificate');
    if (!certificate) {
      setTimeoutForNextRun(now);

      return;
    }

    // The useful information in a SenderCertificate is all serialized, so we
    //   need to do another layer of decoding.
    const decoded = textsecure.protobuf.SenderCertificate.Certificate.decode(
      certificate.certificate
    );
    const expires = decoded.expires.toNumber();

    const time = Math.min(now + ONE_DAY, expires - MINIMUM_TIME_LEFT);

    setTimeoutForNextRun(time);
  }

  async function run() {
    logger.info('refreshSenderCertificate: Getting new certificate...');
    try {
      const username = storage.get('number_id');
      const password = storage.get('password');
      const server = WebAPI.connect({ username, password });

      const { certificate } = await server.getSenderCertificate();
      const arrayBuffer = window.Signal.Crypto.base64ToArrayBuffer(certificate);
      const decoded = textsecure.protobuf.SenderCertificate.decode(arrayBuffer);

      decoded.certificate = decoded.certificate.toArrayBuffer();
      decoded.signature = decoded.signature.toArrayBuffer();
      decoded.serialized = arrayBuffer;

      storage.put('senderCertificate', decoded);
      scheduleNextRotation();
    } catch (error) {
      logger.error(
        'refreshSenderCertificate: Get failed. Trying again in two minutes...',
        error && error.stack ? error.stack : error
      );
      setTimeout(runWhenOnline, 2 * 60 * 1000);
    }

    refreshOurProfile();
  }

  function runWhenOnline() {
    if (navigator.onLine) {
      run();
    } else {
      logger.info(
        'refreshSenderCertificate: Offline. Will update certificate when online...'
      );
      const listener = () => {
        logger.info(
          'refreshSenderCertificate: Online. Now updating certificate...'
        );
        window.removeEventListener('online', listener);
        run();
      };
      window.addEventListener('online', listener);
    }
  }

  function setTimeoutForNextRun(time = Date.now()) {
    const now = Date.now();

    if (scheduledTime !== time || !timeout) {
      logger.info(
        'Next sender certificate refresh scheduled for',
        new Date(time).toISOString()
      );
    }

    scheduledTime = time;
    const waitTime = Math.max(0, time - now);

    clearTimeout(timeout);
    timeout = setTimeout(runWhenOnline, waitTime);
  }
}
