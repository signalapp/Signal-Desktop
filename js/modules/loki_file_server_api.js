/* global window, log, libloki */
/* global storage: false */
/* global Signal: false */
/* global log: false */

const LokiAppDotNetAPI = require('./loki_app_dot_net_api');

const DEVICE_MAPPING_ANNOTATION_KEY = 'network.loki.messenger.devicemapping';

// can have multiple of these objects instances as each user can have a
// different home server
class LokiFileServerAPI {
  constructor(ourKey) {
    this.ourKey = ourKey;
    this._adnApi = new LokiAppDotNetAPI(ourKey);
  }

  async establishConnection(serverUrl) {
    this._server = await this._adnApi.findOrCreateServer(serverUrl);
    // TODO: Handle this failure gracefully
    if (!this._server) {
      log.error('Failed to establish connection to file server');
    }
  }

  async getUserDeviceMapping(pubKey) {
    const annotations = await this._server.getUserAnnotations(pubKey);
    const deviceMapping = annotations.find(
      annotation => annotation.type === DEVICE_MAPPING_ANNOTATION_KEY
    );
    return deviceMapping ? deviceMapping.value : null;
  }

  async updateOurDeviceMapping() {
    const isPrimary = !storage.get('isSecondaryDevice');
    let authorisations;
    if (isPrimary) {
      authorisations = await Signal.Data.getGrantAuthorisationsForPrimaryPubKey(
        this.ourKey
      );
    } else {
      authorisations = [
        await Signal.Data.getGrantAuthorisationForSecondaryPubKey(this.ourKey),
      ];
    }
    return this._setOurDeviceMapping(authorisations, isPrimary);
  }

  async getDeviceMappingForUsers(pubKeys) {
    const users = await this._server.getUsers(pubKeys);
    return users;
  }

  async verifyUserObjectDeviceMap(pubKeys, isRequest, iterator) {
    const users = await this.getDeviceMappingForUsers(pubKeys);

    // go through each user and find deviceMap annotations
    const notFoundUsers = [];
    await Promise.all(
      users.map(async user => {
        let found = false;
        if (!user.annotations || !user.annotations.length) {
          log.info(
            `verifyUserObjectDeviceMap no annotation for ${user.username}`
          );
          return;
        }
        const mappingNote = user.annotations.find(
          note => note.type === DEVICE_MAPPING_ANNOTATION_KEY
        );
        const { authorisations } = mappingNote.value;
        if (!Array.isArray(authorisations)) {
          return;
        }
        await Promise.all(
          authorisations.map(async auth => {
            // only skip, if in secondary search mode
            if (isRequest && auth.secondaryDevicePubKey !== user.username) {
              // this is not the authorization we're looking for
              log.info(
                `Request and ${auth.secondaryDevicePubKey} != ${user.username}`
              );
              return;
            }
            const valid = await libloki.crypto.validateAuthorisation(auth);
            if (valid && iterator(user.username, auth)) {
              found = true;
            }
          })
        ); // end map authorisations

        if (!found) {
          notFoundUsers.push(user.username);
        }
      })
    ); // end map users
    // log.info('done with users', users.length);
    return notFoundUsers;
  }

  // verifies list of pubKeys for any deviceMappings
  // returns the relevant primary pubKeys
  async verifyPrimaryPubKeys(pubKeys) {
    const newSlavePrimaryMap = {}; // new slave to primary map
    // checkSig disabled for now
    // const checkSigs = {}; // cache for authorisation
    const primaryPubKeys = [];

    // go through multiDeviceResults and get primary Pubkey
    await this.verifyUserObjectDeviceMap(pubKeys, true, (slaveKey, auth) => {
      // if we already have this key for a different device
      if (
        newSlavePrimaryMap[slaveKey] &&
        newSlavePrimaryMap[slaveKey] !== auth.primaryDevicePubKey
      ) {
        log.warn(
          `file server user annotation primaryKey mismatch, had ${
            newSlavePrimaryMap[slaveKey]
          } now ${auth.primaryDevicePubKey} for ${slaveKey}`
        );
        return;
      }
      // at this point it's valid

      // add to primaryPubKeys
      if (primaryPubKeys.indexOf(`@${auth.primaryDevicePubKey}`) === -1) {
        primaryPubKeys.push(`@${auth.primaryDevicePubKey}`);
      }

      // add authorisation cache
      /*
      if (checkSigs[`${auth.primaryDevicePubKey}_${slaveKey}`] !== undefined) {
        log.warn(
          `file server ${auth.primaryDevicePubKey} to ${slaveKey} double signed`
        );
      }
      checkSigs[`${auth.primaryDevicePubKey}_${slaveKey}`] = auth;
      */

      // add map to newSlavePrimaryMap
      newSlavePrimaryMap[slaveKey] = auth.primaryDevicePubKey;
    }); // end verifyUserObjectDeviceMap

    // no valid primary pubkeys to check
    if (!primaryPubKeys.length) {
      // log.warn(`no valid primary pubkeys to check ${pubKeys}`);
      return [];
    }

    const verifiedPrimaryPKs = [];

    // get a list of all of primary pubKeys to verify the secondaryDevice assertion
    const notFoundUsers = await this.verifyUserObjectDeviceMap(
      primaryPubKeys,
      false,
      primaryKey => {
        // add to verified list if we don't already have it
        if (verifiedPrimaryPKs.indexOf(`@${primaryKey}`) === -1) {
          verifiedPrimaryPKs.push(`@${primaryKey}`);
        }

        // assuming both are ordered the same way
        // make sure our secondary and primary authorization match
        /*
        if (
          JSON.stringify(checkSigs[
            `${auth.primaryDevicePubKey}_${auth.secondaryDevicePubKey}`
          ]) !== JSON.stringify(auth)
        ) {
          // should hopefully never happen
          // it did, old pairing data, I think...
          log.warn(
            `Valid authorizations from ${
              auth.secondaryDevicePubKey
            } does not match ${primaryKey}`
          );
          return false;
        }
        */
        return true;
      }
    ); // end verifyUserObjectDeviceMap

    // remove from newSlavePrimaryMap if no valid mapping is found
    notFoundUsers.forEach(primaryPubKey => {
      Object.keys(newSlavePrimaryMap).forEach(slaveKey => {
        if (newSlavePrimaryMap[slaveKey] === primaryPubKey) {
          log.warn(
            `removing unverifible ${slaveKey} to ${primaryPubKey} mapping`
          );
          delete newSlavePrimaryMap[slaveKey];
        }
      });
    });

    // FIXME: move to a return value since we're only scoped to pubkeys given
    // make new map final
    window.lokiPublicChatAPI.slavePrimaryMap = newSlavePrimaryMap;

    log.info(
      `Updated device mappings ${JSON.stringify(
        window.lokiPublicChatAPI.slavePrimaryMap
      )}`
    );

    return verifiedPrimaryPKs;
  }

  _setOurDeviceMapping(authorisations, isPrimary) {
    const content = {
      isPrimary: isPrimary ? '1' : '0',
      authorisations,
    };
    return this._server.setSelfAnnotation(
      DEVICE_MAPPING_ANNOTATION_KEY,
      content
    );
  }

  uploadPrivateAttachment(data) {
    return this._server.uploadData(data);
  }
}

module.exports = LokiFileServerAPI;
