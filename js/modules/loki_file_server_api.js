/* global log, libloki, process, window */
/* global storage: false */
/* global Signal: false */
/* global log: false */

const LokiAppDotNetAPI = require('./loki_app_dot_net_api');

const DEVICE_MAPPING_USER_ANNOTATION_TYPE =
  'network.loki.messenger.devicemapping';

// const LOKIFOUNDATION_DEVFILESERVER_PUBKEY =
//  'BSZiMVxOco/b3sYfaeyiMWv/JnqokxGXkHoclEx8TmZ6';
const LOKIFOUNDATION_FILESERVER_PUBKEY =
  'BWJQnVm97sQE3Q1InB4Vuo+U/T1hmwHBv0ipkiv8tzEc';

// can have multiple of these instances as each user can have a
// different home server
class LokiFileServerInstance {
  constructor(ourKey) {
    this.ourKey = ourKey;

    // do we have their pubkey locally?
    /*
    // get remote pubKey
    this._server.serverRequest('loki/v1/public_key').then(keyRes => {
      // we don't need to delay to protect identity because the token request
      // should only be done over lokinet-lite
      this.delayToken = true;
      if (keyRes.err || !keyRes.response || !keyRes.response.data) {
        if (keyRes.err) {
          log.error(`Error ${keyRes.err}`);
        }
      } else {
        // store it
        this.pubKey = dcodeIO.ByteBuffer.wrap(
          keyRes.response.data,
          'base64'
        ).toArrayBuffer();
        // write it to a file
      }
    });
    */
    // Hard coded
    this.pubKey = window.Signal.Crypto.base64ToArrayBuffer(
      LOKIFOUNDATION_FILESERVER_PUBKEY
    );
    if (this.pubKey.byteLength && this.pubKey.byteLength !== 33) {
      log.error(
        'FILESERVER PUBKEY is invalid, length:',
        this.pubKey.byteLength
      );
      process.exit(1);
    }
  }

  // FIXME: this is not file-server specific
  // and is currently called by LokiAppDotNetAPI.
  // LokiAppDotNetAPI (base) should not know about LokiFileServer.
  async establishConnection(serverUrl, options) {
    // why don't we extend this?
    this._server = new LokiAppDotNetAPI(this.ourKey, serverUrl);

    // configure proxy
    this._server.pubKey = this.pubKey;

    if (options !== undefined && options.skipToken) {
      return;
    }

    // get a token for multidevice
    const gotToken = await this._server.getOrRefreshServerToken();
    // TODO: Handle this failure gracefully
    if (!gotToken) {
      log.error('You are blacklisted form this home server');
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
    if (!this._server.token) {
      log.warn('_setOurDeviceMapping no token yet');
    }
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

  // you only upload to your own home server
  // you can download from any server...
  uploadAvatar(data) {
    if (!this._server.token) {
      log.warn('uploadAvatar no token yet');
    }
    return this._server.uploadAvatar(data);
  }

  static uploadPrivateAttachment(data) {
    return window.tokenlessFileServerAdnAPI.uploadData(data);
  }

  clearOurDeviceMappingAnnotations() {
    return this._server.setSelfAnnotation(
      DEVICE_MAPPING_USER_ANNOTATION_TYPE,
      null
    );
  }
}

// this will be our instance factory
class LokiFileServerFactoryAPI {
  constructor(ourKey) {
    this.ourKey = ourKey;
    this.servers = [];
  }

  establishHomeConnection(serverUrl) {
    let thisServer = this.servers.find(
      server => server._server.baseServerUrl === serverUrl
    );
    if (!thisServer) {
      thisServer = new LokiHomeServerInstance(this.ourKey);
      log.info(`Registering HomeServer ${serverUrl}`);
      // not await, so a failure or slow connection doesn't hinder loading of the app
      thisServer.establishConnection(serverUrl);
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
      await thisServer.establishConnection(serverUrl, { skipToken: true });
      this.servers.push(thisServer);
    }
    return thisServer;
  }
}
// smuggle some data out of this joint (for expire.js/version upgrade check)
LokiFileServerFactoryAPI.secureRpcPubKey = LOKIFOUNDATION_FILESERVER_PUBKEY;

module.exports = LokiFileServerFactoryAPI;
