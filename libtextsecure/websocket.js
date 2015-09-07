/*
 * vim: ts=4:sw=4:expandtab
 *
 * var socket = TextSecureWebSocket(url);
 *
 * Returns an adamantium-reinforced super socket, capable of
 * automatically reconnecting.
 *
 */

TextSecureWebSocket = function (url, opts) {
    'use strict';
    opts = opts || {};
    var reconnectTimeout = 1000;
    if (opts && opts.reconnectTimeout !== undefined) {
        reconnectTimeout = opts.reconnectTimeout;
    }
    var reconnectSemaphore = 0;
    var socket;
    var calledClose = false;
    var socketWrapper = {
        onmessage : function() {},
        onclose   : function() {},
        onerror   : function() {},
        getStatus : function() { return socket.readyState; },
        close     : function(code, reason) {
            calledClose = true;
            socket.close(code, reason);
        }
    };
    var error;

    function onclose(e) {
        if (!error && !calledClose && reconnectTimeout) {
            reconnectSemaphore--;
            setTimeout(connect, reconnectTimeout);
        }
        if (e !== 1000 ) { // CLOSE_NORMAL
            console.log('websocket closed', e.code);
        }
        socketWrapper.onclose(e);
    };

    function onerror(e) {
        error = e;
        console.log('websocket error');
        socketWrapper.onerror(e);
    };

    function onmessage(response) {
        socketWrapper.onmessage(response);
    };

    function send(msg) {
        socket.send(msg);
    };

    function connect() {
        if (++reconnectSemaphore <= 0) { return; }

        if (socket) { socket.close(); }
        socket = new WebSocket(url);

        socket.onerror     = onerror
        socket.onclose     = onclose;
        socket.onmessage   = onmessage;
        socketWrapper.send = send;
    };

    connect();
    return socketWrapper;
};
