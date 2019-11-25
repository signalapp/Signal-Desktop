/* global log, libloki */
/* global storage: false */
/* global Signal: false */
/* global log: false */

const LokiAppDotNetAPI = require('./loki_app_dot_net_api');

const DEVICE_MAPPING_USER_ANNOTATION_TYPE =
  'network.loki.messenger.devicemapping';

// can have multiple of these instances as each user can have a
// different home server
class LokiFileServerInstance {
  constructor(ourKey) {
    this.ourKey = ourKey;
    // why don't we extend this?
    this._adnApi = new LokiAppDotNetAPI(ourKey);
    this.avatarMap = {};
  }
  async establishConnection(serverUrl) {
    // FIXME: we don't always need a token...
    this._server = await this._adnApi.findOrCreateServer(serverUrl);
    // TODO: Handle this failure gracefully
    if (!this._server) {
      log.error('Failed to establish connection to file server');
    }
  }
  async getUserDeviceMapping(pubKey) {
    const annotations = await this._server.getUserAnnotations(pubKey);
    const deviceMapping = annotations.find(
      annotation => annotation.type === DEVICE_MAPPING_USER_ANNOTATION_TYPE
    );
    return deviceMapping ? deviceMapping.value : null;
  }

  async verifyUserObjectDeviceMap(pubKeys, isRequest, iterator) {
    const users = await this._server.getUsers(pubKeys);

    // go through each user and find deviceMap annotations
    const notFoundUsers = [];
    await Promise.all(
      users.map(async user => {
        let found = false;
        // if this user has an avatar set, copy it into the map
        this.avatarMap[user.username] = user.avatar_image
          ? user.avatar_image.url
          : false;
        if (!user.annotations || !user.annotations.length) {
          log.info(
            `verifyUserObjectDeviceMap no annotation for ${user.username}`
          );
          return;
        }
        const mappingNote = user.annotations.find(
          note => note.type === DEVICE_MAPPING_USER_ANNOTATION_TYPE
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
    const result = {
      verifiedPrimaryPKs: [],
      slaveMap: {},
    };

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
      // do we want to update slavePrimaryMap?
      return result;
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

    log.info(`Updated device mappings ${JSON.stringify(newSlavePrimaryMap)}`);

    result.verifiedPrimaryPKs = verifiedPrimaryPKs;
    result.slaveMap = newSlavePrimaryMap;
    return result;
  }
}

// extends LokiFileServerInstance with functions we'd only perform on our own home server
// so we don't accidentally send info to the wrong file server
class LokiHomeServerInstance extends LokiFileServerInstance {
  _setOurDeviceMapping(authorisations, isPrimary) {
    const content = {
      isPrimary: isPrimary ? '1' : '0',
      authorisations,
    };
    return this._server.setSelfAnnotation(
      DEVICE_MAPPING_USER_ANNOTATION_TYPE,
      content
    );
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

  uploadAvatar(data) {
    return this._server.uploadAvatar(data);
  }

  uploadPrivateAttachment(data) {
    return this._server.uploadData(data);
  }

  clearOurDeviceMappingAnnotations() {
    return this._server.setSelfAnnotation(DEVICE_MAPPING_USER_ANNOTATION_TYPE, null);
  }
}

// this will be our instance factory
class LokiFileServerFactoryAPI {
  constructor(ourKey) {
    this.ourKey = ourKey;
    this.servers = [];
  }

  async establishHomeConnection(serverUrl) {
    let thisServer = this.servers.find(
      server => server._server.baseServerUrl === serverUrl
    );
    if (!thisServer) {
      thisServer = new LokiHomeServerInstance(this.ourKey);
      log.info(`Registering HomeServer ${serverUrl}`);
      await thisServer.establishConnection(serverUrl);
      this.servers.push(thisServer);
    }
    return thisServer;
  }

  async establishConnection(serverUrl) {
    let thisServer = this.servers.find(
      server => server._server.baseServerUrl === serverUrl
    );
    if (!thisServer) {
      thisServer = new LokiFileServerInstance(this.ourKey);
      log.info(`Registering FileServer ${serverUrl}`);
      await thisServer.establishConnection(serverUrl);
      this.servers.push(thisServer);
    }
    return thisServer;
  }
}

module.exports = LokiFileServerFactoryAPI;
