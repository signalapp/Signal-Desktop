/* vim: ts=4:sw=4
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/************************************************
 *** Utilities to communicate with the server ***
 ************************************************/
// WARNING: THIS SERVER LOGS KEY MATERIAL FOR TESTING
var URL_BASE	= "http://sushiforeveryone.bluematt.me";

// This is the real server
//var URL_BASE	= "https://textsecure-service.whispersystems.org";

var URL_CALLS = {};
URL_CALLS['accounts']	= "/v1/accounts";
URL_CALLS['devices']	= "/v1/devices";
URL_CALLS['keys']		= "/v1/keys";
URL_CALLS['push']		= "/v1/websocket";
URL_CALLS['messages']	= "/v1/messages";

var API	= new function() {

	/**
		* REQUIRED PARAMS:
		* 	call:				URL_CALLS entry
		* 	httpType:			POST/GET/PUT/etc
		* OPTIONAL PARAMS:
		* 	success_callback:	function(response object) called on success
		* 	error_callback: 	function(http status code = -1 or != 200) called on failure
		* 	urlParameters:		crap appended to the url (probably including a leading /)
		* 	user:				user name to be sent in a basic auth header
		* 	password:			password to be sent in a basic auth headerA
		* 	do_auth:			alternative to user/password where user/password are figured out automagically
		* 	jsonData:			JSON data sent in the request body
		*/
	var doAjax = function(param) {
		if (param.urlParameters === undefined)
			param.urlParameters = "";

		if (param.do_auth) {
			param.user		= storage.getUnencrypted("number_id");
			param.password	= storage.getEncrypted("password");
		}

		return new Promise(function(resolve, reject) {
			$.ajax(URL_BASE + URL_CALLS[param.call] + param.urlParameters, {
				type		: param.httpType,
				data		: param.jsonData && jsonThing(param.jsonData),
				contentType : 'application/json; charset=utf-8',
				dataType	: 'json',

				beforeSend	: function(xhr) {
								if (param.user		 !== undefined &&
									param.password !== undefined)
										xhr.setRequestHeader("Authorization", "Basic " + btoa(getString(param.user) + ":" + getString(param.password)));
								},

				success		: function(response, textStatus, jqXHR) {
									resolve(response);
								},

				error		: function(jqXHR, textStatus, errorThrown) {
									var code = jqXHR.status;
									if (code == 200) {
										// happens sometimes when we get no response
										// (TODO: Fix server to return 204? instead)
										resolve(null);
										return;
									}
									if (code > 999 || code < 100)
										code = -1;
									var e = new Error(code);
									e.name = "HTTPError";
									reject(e);
								}
			});
		});
	};

	this.requestVerificationCode = function(number, success_callback, error_callback) {
		doAjax({
			call				: 'accounts',
			httpType			: 'GET',
			urlParameters		: '/sms/code/' + number,
		}).then(function(response) {
			if (success_callback !== undefined)
				success_callback(response);
		}).catch(function(code) {
			if (error_callback !== undefined)
				error_callback(code);
		});
	};

	this.confirmCode = function(code, number, password,
								signaling_key, registrationId, single_device,
								success_callback, error_callback) {
		var call = single_device ? 'accounts' : 'devices';
		var urlPrefix = single_device ? '/code/' : '/';

		doAjax({
			call				: call,
			httpType			: 'PUT',
			urlParameters		: urlPrefix + code,
			user				: number,
			password			: password,
			jsonData			: { signalingKey		: btoa(getString(signaling_key)),
												supportsSms		: false,
												fetchesMessages	: true,
												registrationId: registrationId},
		}).then(function(response) {
			if (success_callback !== undefined)
				success_callback(response);
		}).catch(function(code) {
			if (error_callback !== undefined)
				error_callback(code);
		});
	};

	this.registerKeys = function(keys, success_callback, error_callback) {
		//TODO: Do this conversion somewhere else?
		var identityKey = btoa(getString(keys.keys[0].identityKey));
		for (var i = 0; i < keys.keys.length; i++)
			keys.keys[i] = {keyId: i, publicKey: btoa(getString(keys.keys[i].publicKey)), identityKey: identityKey};
		keys.lastResortKey = {keyId: keys.lastResortKey.keyId, publicKey: btoa(getString(keys.lastResortKey.publicKey)), identityKey: identityKey};
		doAjax({
			call				: 'keys',
			httpType			: 'PUT',
			do_auth				: true,
			jsonData			: keys,
		}).then(function(response) {
			if (success_callback !== undefined)
				success_callback(response);
		}).catch(function(code) {
			if (error_callback !== undefined)
				error_callback(code);
		});
	};

	this.getKeysForNumber = function(number) {
		return doAjax({
			call				: 'keys',
			httpType			: 'GET',
			do_auth				: true,
			urlParameters		: "/" + getNumberFromString(number) + "/*",
		}).then(function(response) {
			//TODO: Do this conversion somewhere else?
			var res = response.keys;
			for (var i = 0; i < res.length; i++) {
				res[i].identityKey = base64DecToArr(res[i].identityKey);
				res[i].publicKey = base64DecToArr(res[i].publicKey);
				if (res[i].keyId === undefined)
					res[i].keyId = 0;
			}
			return res;
		});
	};

	this.sendMessages = function(destination, messageArray) {
		//TODO: Do this conversion somewhere else?
		for (var i = 0; i < messageArray.length; i++)
			messageArray[i].body = btoa(messageArray[i].body);
		var jsonData = { messages: messageArray };
		if (messageArray[0].relay !== undefined)
			jsonData.relay = messageArray[0].relay;
		
		return doAjax({
			call				: 'messages',
			httpType			: 'PUT',
			urlParameters		: '/' + destination,
			do_auth				: true,
			jsonData			: jsonData,
		});
	}
}(); // API
