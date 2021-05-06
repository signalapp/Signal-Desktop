/* eslint-disable class-methods-use-this */
/* global window, Buffer, StringView, dcodeIO */

class LokiSnodeAPI {
  // ************** NOTE ***************
  // This is not used by anything yet,
  // but should be. Do not remove!!!
  // ***********************************
  async getLnsMapping(lnsName, timeout) {
    // Returns { pubkey, error }
    // pubkey is
    //      undefined when unconfirmed or no mapping found
    //      string    when found
    // timeout parameter optional (ms)

    // How many nodes to fetch data from?
    const numRequests = 5;

    // How many nodes must have the same response value?
    const numRequiredConfirms = 3;

    let ciphertextHex;
    let pubkey;
    let error;

    const _ = window.Lodash;

    const input = Buffer.from(lnsName);
    const output = await window.blake2b(input);
    const nameHash = dcodeIO.ByteBuffer.wrap(output).toString('base64');

    // Timeouts
    const maxTimeoutVal = 2 ** 31 - 1;
    const timeoutPromise = () =>
      new Promise((_resolve, reject) => setTimeout(() => reject(), timeout || maxTimeoutVal));

    // Get nodes capable of doing LNS
    const lnsNodes = await window.SnodePool.getNodesMinVersion(
      window.CONSTANTS.LNS_CAPABLE_NODES_VERSION
    );

    // Enough nodes?
    if (lnsNodes.length < numRequiredConfirms) {
      error = { lnsTooFewNodes: window.i18n('lnsTooFewNodes') };
      return { pubkey, error };
    }

    const confirmedNodes = [];

    // Promise is only resolved when a consensus is found
    let cipherResolve;
    const cipherPromise = () =>
      new Promise(resolve => {
        cipherResolve = resolve;
      });

    const decryptHex = async cipherHex => {
      const ciphertext = new Uint8Array(StringView.hexToArrayBuffer(cipherHex));

      const res = await window.decryptLnsEntry(lnsName, ciphertext);
      const publicKey = StringView.arrayBufferToHex(res);

      return publicKey;
    };

    const fetchFromNode = async node => {
      const res = await window.NewSnodeAPI._requestLnsMapping(node, nameHash);

      // Do validation
      if (res && res.result && res.result.status === 'OK') {
        const hasMapping = res.result.entries && res.result.entries.length > 0;

        const resValue = hasMapping ? res.result.entries[0].encrypted_value : null;

        confirmedNodes.push(resValue);

        if (confirmedNodes.length >= numRequiredConfirms) {
          if (ciphertextHex) {
            // Result already found, dont worry
            return;
          }

          const [winner, count] = _.maxBy(_.entries(_.countBy(confirmedNodes)), x => x[1]);

          if (count >= numRequiredConfirms) {
            ciphertextHex = winner === String(null) ? null : winner;

            // null represents no LNS mapping
            if (ciphertextHex === null) {
              error = { lnsMappingNotFound: window.i18n('lnsMappingNotFound') };
            }

            cipherResolve({ ciphertextHex });
          }
        }
      }
    };

    const nodes = lnsNodes.splice(0, numRequests);

    // Start fetching from nodes
    nodes.forEach(node => fetchFromNode(node));

    // Timeouts (optional parameter)
    // Wait for cipher to be found; race against timeout
    // eslint-disable-next-line more/no-then
    await Promise.race([cipherPromise, timeoutPromise].map(f => f()))
      .then(async () => {
        if (ciphertextHex !== null) {
          pubkey = await decryptHex(ciphertextHex);
        }
      })
      .catch(() => {
        error = { lnsLookupTimeout: window.i18n('lnsLookupTimeout') };
      });

    return { pubkey, error };
  }
}

module.exports = LokiSnodeAPI;
