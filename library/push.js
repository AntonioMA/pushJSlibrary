/**
 * This library implements the navigator.mozPush & navigator.push libraries
 * on a non natively supported browsers.
 * This can be used as a secure fallback since the native version is used if it
 * exists
 * 
 * Author: Fernando Rodríguez Sela, 2013
 * All rights reserverd. January 2013
 * 
 * License: GNU Affero V3 (see LICENSE file)
 */


'use strict';

/**
 * Implementation of navigator.push
 * W3C spec: http://www.w3.org/TR/push-api/
 */

function _Push() {
}
_Push.prototype = {
  /////////////////////////////////////////////////////////////////////////
  // Push methods
  /////////////////////////////////////////////////////////////////////////

  requestURL: function(watoken, pbk) {
    this.debug('[requestURL] Warning, DEPRECATED method. Use requestRemotePermission');
    return this.requestRemotePermission(watoken, pbk);
  },

  requestRemotePermission: function(watoken, pbk) {
    var cb = {};

    if(!watoken || !pbk) {
      this.debug('[requestRemotePermission] Error, no WAToken nor PBK provided');
      setTimeout(function() {
        if(cb.onerror) cb.onerror('Error, no WAToken nor PBK provided');
      });
      return cb;
    }

    this.registerUA(function () {
      this.registerWA(watoken, pbk, function(URL) {
        this.debug('[registerWA Callback] URL: ',URL);
        if(cb.onsuccess) {
          cb.onsuccess(URL);
        }
      }.bind(this));
    }.bind(this));

    window.addEventListener('pushmessage', function(event) {
      this.debug('[pushmessage Callback] Message: ',event);
      if(cb.onmessage) {
        cb.onmessage(event.detail.message);
      }
    });

    return cb;
  },

  /**
   * Setup PUSH interface
   * data is a JSON object with these attributes:
   * {
   *  "host": "PUSH_SERVER_HOSTNAME",
   *  "port": PUSH_SERVER_PORT,
   *  "ssl": [ true | false ],
   *
   *   ---> FOLLOWING attributes are only used in this fallback library <---
   *  "debug": [ true | false ],
   *  "keepalive": WEBSOCKET_KEEPALIVE_TIMER (in msecs),
   *
   *   ---> FOLLOWING attributes are only used for testing purpose in order
   *        to simulate UDP/TCP wakeup service in the client machine.
   *        use only if you know what are you doing <---
   *  "wakeup_enabled": [ true | false ],
   *  "wakeup_host": "WAKEUP_HOSTNAME",
   *  "wakeup_port: WAKEUP_PORT,
   *  "wakeup_protocol: [ 'tcp' | 'udp' ],
   *  "wakeup_mcc: 'MOBILE COUNTRY CODE',
   *  "wakeup_mnc: 'MOBILE NETWORK CODE'
   * }
   */
  setup: function(data) {
    if(!data)
      return;

    // Setupable parameters:
    //  id: [ 'DESCRIPTION', 'attribute to store in', Shall be reinit? ]
    var _params = {
      host: ['hostname', 'this.server.host', true],
      port: ['port', 'this.server.port', true],
      ssl: ['ssl', 'this.server.ssl', true],

      // Out of the W3C standard
      debug: ['DEBUG', 'this.DEBUG', false],
      keepalive: ['keepalive', 'this.server.keepalive', true],

      // WakeUp development parameters
      wakeup_enabled: ['WakeUp ENABLED', 'this.wakeup.enabled', true],
      wakeup_host: ['WakeUp host', 'this.wakeup.host', true],
      wakeup_port: ['WakeUp port', 'this.wakeup.port', true],
      wakeup_protocol: ['WakeUp protocol', 'this.wakeup.protocol', true],
      wakeup_mcc: ['WakeUp MCC', 'this.wakeup.mcc', true],
      wakeup_mnc: ['WakeUp MNC', 'this.wakeup.mnc', true]
    };
    var _setup = function(param, value) {
      if(param === undefined) {
        this.debug('[setup::_setup] No recognized param value');
        return;
      }
      if (value === undefined) {
        return;
      }

      this.debug('[setup::_setup] Changing ' + param[0] + ' to: ' + value);
      if(typeof(value) == 'string') {
        eval(param[1] += ' = "' + value + '"');
      } else {
        eval(param[1] += ' = ' + value);
      }
      if (param[2])
        this.initialized = false;
    }.bind(this);

    this.debug('[setup] Setup data received: ', data);
    _setup(_params.host, data.host);
    _setup(_params.port, data.port);
    _setup(_params.ssl, data.ssl);

    // Out of the W3C standard
    _setup(_params.debug, data.debug);
    _setup(_params.keepalive, data.keepalive);

    // WakeUp development parameters
    _setup(_params.wakeup_enabled, data.wakeup_enabled);
    _setup(_params.wakeup_host, data.wakeup_host);
    _setup(_params.wakeup_port, data.wakeup_port);
    _setup(_params.wakeup_protocol, data.wakeup_protocol);
    _setup(_params.wakeup_mcc, data.wakeup_mcc);
    _setup(_params.wakeup_mnc, data.wakeup_mnc);

    if (!this.initialized) {
      this.debug('[setup] Reinitializing . . .');
      this.init();
    }
    this.debug('[setup] Current status SERVER: ', this.server);
    this.debug('[setup] Current status WAKEUP: ', this.wakeup);
    this.debug('[setup] Current status DEBUG: ', (this.DEBUG ? 'ON' : 'OFF'));
  },

  /**
   * Current setup recovery
   */
  getSetup: function() {
    return {
      debug: this.DEBUG,
      host: this.server.host,
      port: this.server.port,
      ssl: this.server.ssl,
      keepalive: this.server.keepalive,
      wakeup_enabled: this.wakeup.enabled,
      wakeup_host: this.wakeup.host,
      wakeup_port: this.wakeup.port,
      wakeup_protocol: this.wakeup.protocol,
      wakeup_mcc: this.wakeup.mcc,
      wakeup_mnc: this.wakeup.mnc
    };
  },

  /////////////////////////////////////////////////////////////////////////
  // Auxiliar methods (out of the standard, only used on this fallback)
  /////////////////////////////////////////////////////////////////////////

  /**
   * Set to defaults
   */
  defaultconfig: function() {
    this.server = {};
    this.wakeup = {};
    this.setup({
      debug: true,
      host: 'localhost',
      port: 8080,
      ssl: true,
      keepalive: 5000,
      wakeup_enabled: false,
      wakeup_host: 'localhost',
      wakeup_port: 8080,
      wakeup_protocol: 'tcp',
      wakeup_mcc: '214',
      wakeup_mnc: '07'
    })
  },

  /**
   * Initialize
   */
  init: function() {
    if(this.initialized) {
      return;
    }

    this.debug('Initializing');

    this.server.ad_ws = 'ws'+(this.server.ssl ? 's' : '')+'://';
    this.server.ad_ws += this.server.host + ':' + this.server.port;
    this.server.ad_http = 'http'+(this.server.ssl ? 's' : '')+'://';
    this.server.ad_http += this.server.host+ ':' + this.server.port;

    this.server.ws = {
      connection: null,
      ready: false
    };

    this.server.registeredUA = false;

    this.token = null;
    this.publicURLs = [];

    this.initialized = true;
  },

  /**
   * Recover UAToken
   */

  getToken: function(cb) {
    if(this.token) {
      this.debug('[getToken] Returning cached UAToken: ' + this.token);
      if(cb) cb(this.token);
      return;
    }

    var xmlhttp = new XMLHttpRequest({ mozSystem: true });
    xmlhttp.onreadystatechange = (function() {
      if (xmlhttp.readyState == 4) {
        if (xmlhttp.status == 200) {
          this.token = xmlhttp.responseText;
          this.debug('[getToken] New UAToken recovered: ' + this.token);
          if(cb) cb(this.token);
        } else {
          this.debug('[getToken] The notification server is not working');
        }
      }
    }.bind(this));
    xmlhttp.open('GET', this.server.ad_http + '/token', true);
    xmlhttp.send(null);
  },

  /**
   * Register UA
   */
  registerUA: function(cb) {
    if(this.server.registeredUA) {
      if(cb) cb();
      return;
    }

    this.onRegisterUAMessage = function(msg) {
      this.debug('[onRegisterUAMessage] TODO: Manage WATokens re-registration',
        msg.WATokens)
      /*
      for(var i in msg.WATokens) {
        // TODO - Manage re-registrations
      }
      */
      if(cb) cb();
    }.bind(this);

    // We cann't continue without UAToken
    this.getToken(function(uatoken) {
      this.openWebsocket();
    }.bind(this));
  },

  /**
   * Register WA
   */
  registerWA: function(token, pbk, cb) {
    this.onRegisterWAMessage = function(msg) {
      this.debug('[onRegisterWAMessage] ', msg);

      this.publicUrl = msg.url;
      this.publicURLs.push(this.publicUrl);

      if(cb) cb(this.publicUrl);
    }.bind(this);

    this.debug('[registerWA] Going to register WA');
    this.sendWS({
      data: {
        watoken: token,
        pbkbase64: pbk                                                                              //utf8_to_b64(this.pbk)
      },
      messageType: 'registerWA'
    });
  },

  /**
   * Open Websocket connection
   */
  openWebsocket: function() {
    this.debug('[openWebsocket] Openning websocket to: ' + this.server.ad_ws);
    this.server.ws.connection =
      new WebSocket(this.server.ad_ws, 'push-notification');

    this.server.ws.connection.onopen = this.onOpenWebsocket.bind(this);
    this.server.ws.connection.onclose = this.onCloseWebsocket.bind(this);
    this.server.ws.connection.onerror = this.onErrorWebsocket.bind(this);
    this.server.ws.connection.onmessage = this.onMessageWebsocket.bind(this);
  },

  /**
   * Send a Websocket message (object)
   */
  sendWS: function(json) {
    var msg = JSON.stringify(json);
    this.debug('[sendWS] Preparing to send: ' + msg);
    this.server.ws.connection.send(msg);
  },

  /**
   * Websocket callbacks
   */
  onOpenWebsocket: function() {
    this.debug('[onOpenWebsocket] Opened connection to ' + this.server.host);
    this.server.ws.ready = true;

    // We shall registerUA each new connection
    this.debug('[onOpenWebsocket] Started registration to the notification server');
    if (this.wakeup.enabled) {
      this.sendWS({
        data: {
          uatoken: this.token,
          'interface': {
            ip: this.wakeup.host,
            port: this.wakeup.port
          },
          mobilenetwork: {
            mcc: this.wakeup.mcc,
            mnc: this.wakeup.mnc
          },
          protocol: this.wakeup.protocol
        },
        messageType: 'registerUA'
      });
    } else {
      this.sendWS({
        data: {
          uatoken: this.token,
        },
        messageType: 'registerUA'
      });
    }

    if(this.server.keepalive > 0) {
      this.keepalivetimer = setInterval(function() {
        this.debug('[Websocket Keepalive] Sending keepalive message. PING');
        this.server.ws.connection.send('PING');
      }.bind(this), this.server.keepalive);
    }
  },

  onCloseWebsocket: function(e) {
    this.debug('[onCloseWebsocket] Closed connection to ' + this.server.ad +
      ' with code ' + e.code + ' and reason ' + e.reason);
    this.server.ws.ready = false;
    clearInterval(this.keepalivetimer)
  },

  onErrorWebsocket: function(e) {
    this.debug('[onErrorWebsocket] Error in websocket in ' + this.server.ad +
      ' with error ' + e.error);
    this.server.ws.ready = false;
  },

  onMessageWebsocket: function(e) {
    this.debug('[onMessageWebsocket] Message received --- ' + e.data);
    if (e.data === 'PONG') {
      return;
    }
    var msg = JSON.parse(e.data);
    if(msg[0]) {
      for(var m in msg) {
        this.manageWebSocketResponse(msg[m]);
      }
    } else {
      this.manageWebSocketResponse(msg);
    }
  },

  manageWebSocketResponse: function(msg) {
    switch(msg.messageType) {
      case 'registerUA':
        this.server.registeredUA = true;
        this.onRegisterUAMessage(msg);
        break;

      case 'registerWA':
        this.debug('[manageWebSocketResponse registerWA] Registered WA');
        this.onRegisterWAMessage(msg);
        break;

      case 'notification':
        this.debug('[manageWebSocketResponse notification] Going to ack the message ' + msg.messageId);
        var event = new CustomEvent('pushmessage', {
          detail: { 'message': msg.message }
        });
        window.dispatchEvent(event);

        this.sendWS({
          messageType: 'ack',
          messageId: msg.messageId
        });
        break;
    }
  },

  /**
   * Debug logger method
   */
  debug: function(msg, obj) {
    if(this.DEBUG) {
      var message = msg;
      if(obj) {
        message += ': ' + JSON.stringify(obj);
      }
      console.log('[PUSH (LIBRARY) LIBRARY DEBUG] ' + message);
    }
  }
};

/**
 * Autoinitialization and redefinition of navigator.push if needed
 */

(function() {
  // Enable/Disable DEBUG traces
  var DEBUG = true;

  /**
   * Debug logger method
   */
  function debug(msg, obj) {
    if(DEBUG) {
      var message = msg;
      if(obj) {
        message += ': ' + JSON.stringify(obj);
      }
      console.log('[PUSH (INIT) LIBRARY DEBUG] ' + message)
    }
  }

  /**
   * Check navigator.[mozPush|push] support and fallback if not supported
   */
  function init() {
    debug('Checking navigator.push existance');
    if(navigator.push) {
      debug('navigator.push supported by your browser');
      return;
    }
    if(navigator.mozPush) {
      debug('navigator.mozPush supported by your browser');
      navigator.push = navigator.mozPush;
      debug('navigator.push = navigator.mozPush');
      return;
    }
    debug('No push supported by your browser. Falling back');
    navigator.push = new _Push();
    navigator.mozPush = navigator.push;
    navigator.push.defaultconfig();
    navigator.push.init();
  }

  init();
})();
