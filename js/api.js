/************************************************
 *** Utilities to communicate with the server ***
 ************************************************/
var URL_BASE  = "http://textsecure-test.herokuapp.com";
//var URL_BASE  = "https://textsecure-service.whispersystems.org";
var URL_CALLS = {};
URL_CALLS['accounts'] = "/v1/accounts";
URL_CALLS['devices']  = "/v1/devices";
URL_CALLS['keys']     = "/v1/keys";
URL_CALLS['push']     = "/v1/messagesocket";
URL_CALLS['messages'] = "/v1/messages/";

var API  = new function() {

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
  this.doAjax = function doAjax(param) {
    if (param.urlParameters === undefined)
      param.urlParameters = "";

    if (param.do_auth) {
      param.user     = storage.getUnencrypted("number_id");
      param.password = storage.getEncrypted("password");
    }

    $.ajax(URL_BASE + URL_CALLS[param.call] + param.urlParameters, {
      type        : param.httpType,
      data        : param.jsonData && jsonThing(param.jsonData),
      contentType : 'application/json; charset=utf-8',
      dataType    : 'json',

      beforeSend  : function(xhr) {
                      if (param.user     !== undefined &&
                          param.password !== undefined) {
                        xhr.setRequestHeader("Authorization", "Basic " + btoa(getString(param.user) + ":" + getString(param.password)));
                      }
                    },

      success     : function(response, textStatus, jqXHR) {
                      if (param.success_callback !== undefined)
                        param.success_callback(response);
                    },

      error       : function(jqXHR, textStatus, errorThrown) {
                      var code = jqXHR.status;
                      if (code == 200) {
                        // happens sometimes when we get no response
                        // (TODO: Fix server to return 204? instead)
                        if (param.success_callback !== undefined)
                          param.success_callback(null);
                        return;
                      }
                      if (code > 999 || code < 100)
                        code = -1;
                      if (param.error_callback !== undefined)
                        param.error_callback(code);
                    }
    });
  };


  this.requestVerificationCode = function(number, success_callback, error_callback) {
    this.doAjax({
      call             : 'accounts',
      httpType         : 'GET',
      urlParameters    : '/sms/code/' + number,
      success_callback : success_callback,
      error_callback   : error_callback
    });
  };

  this.confirmCode = function(code, number, password,
                              signaling_key, single_device,
                              success_callback, error_callback) {
    var call = single_device ? 'accounts' : 'devices';
    var urlPrefix = single_device ? '/code/' : '/';

    API.doAjax({
      call             : call,
      httpType         : 'PUT',
      urlParameters    : urlPrefix + code,
      user             : number,
      password         : password,
      jsonData         : { signalingKey    : btoa(getString(signaling_key)),
                           supportsSms     : false,
                           fetchesMessages : true },
      success_callback : success_callback,
      error_callback   : error_callback
    });
  };

  this.registerKeys = function(keys, success_callback, error_callback) {
    this.doAjax({
      call             : 'keys',
      httpType         : 'PUT',
      do_auth          : true,
      jsonData         : keys,
      success_callback : success_callback,
      error_callback   : error_callback
    });
  };

  this.getKeysForNumber = function(number, success_callback, error_callback) {
    this.doAjax({
      call             : 'keys',
      httpType         : 'GET',
      do_auth          : true,
      urlParameters    : "/" + getNumberFromString(number) + "?multikeys",
      success_callback : success_callback,
      error_callback   : error_callback
    });
  };

  this.sendMessages = function(jsonData, success_callback, error_callback) {
    this.doAjax({
      call             : 'messages',
      httpType         : 'POST',
      do_auth          : true,
      jsonData         : jsonData,
      success_callback : success_callback,
      error_callback   : error_callback
    });
  };

  this.pushMessage = function(messageId) {
    this.doAjax({
      call             : 'push',
      httpType         : 'PUT',
      urlParameters    : '/' + message.id,
      do_auth          : true
    });
  };

}(); // API
