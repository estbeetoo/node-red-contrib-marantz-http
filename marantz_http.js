/**
 * Created by aborovsky on 11.05.2015.
 */

var util = require('util');
var DEBUG = false;
var connectionFSM = require('./lib/connectionFSM.js');

module.exports = function(RED) {

  /**
   * ====== Marantz-controller ================
   * Holds configuration for marantzjs host+port,
   * initializes new marantzjs connections
   * ==========================================
   */
  function MarantzControllerNode(config) {
    RED.nodes.createNode(this, config);
    this.name = config.name;
    this.host = config.host;
    this.port = config.port;
    this.marantz = null;
    var node = this;

    /**
     * Initialize an marantz_telnet socket, calling the handler function
     * when successfully connected, passing it the marantz_telnet connection
     */
    this.initializeMarantzConnection = function(handler) {
      if (node.marantz) {
        DEBUG && RED.comms.publish("debug", {
          name: node.name,
          msg: 'already configured connection to Marantz at ' + config.host + ':' + config.port
        });
        if (handler && (typeof handler === 'function')) {
          if (node.marantz.connection && node.marantz.connected)
            handler(node.marantz);
          else {
            if (node.marantz.connection && !node.marantz.connected)
              node.marantz.connect();
            node.marantz.on('connected', function() {
              handler(node.marantz);
            });

          }
        }
        return node.marantz;
      }
      node.log('configuring connection to Marantz at ' + config.host + ':' + config.port);
      node.marantz = new connectionFSM({
        host: config.host,
        port: config.port,
        debug: DEBUG
      });
      node.marantz.connect();
      if (handler && (typeof handler === 'function')) {
        node.marantz.on('connected', function() {
          handler(node.marantz);
        });
      }
      DEBUG && RED.comms.publish("debug", {
        name: node.name,
        msg: 'Marantz: successfully connected to ' + config.host + ':' + config.port
      });

      return node.marantz;
    };
    this.on("close", function() {
      node.log('disconnecting from marantz device at ' + config.host + ':' + config.port);
      node.marantz && node.marantz.disconnect && node.marantz.disconnect();
      node.marantz = null;
    });
  }

  RED.nodes.registerType("marantz-http-controller", MarantzControllerNode);

  /**
   * ====== Marantz-out =======================
   * Sends outgoing Marantz from
   * messages received via node-red flows
   * =======================================
   */
  function MarantzOut(config) {
    RED.nodes.createNode(this, config);
    this.name = config.name;
    var controllerNode = RED.nodes.getNode(config.controller);
    this.unit_number = config.unit_number;
    this.marantzcommand = config.marantzcommand;
    var node = this;
    this.on("input", function(msg) {
      DEBUG && RED.comms.publish("debug", {
        name: node.name,
        msg: 'marantzout.onInput msg[' + util.inspect(msg) + ']'
      });
      if (!(msg && msg.hasOwnProperty('payload'))) return;
      var payload = msg.payload;
      if (typeof(msg.payload) === "object") {
        payload = msg.payload;
      } else if (typeof(msg.payload) === "string") {
        try {
          payload = JSON.parse(msg.payload);
          if (typeof (payload) === 'number')
            payload = {cmd: msg.payload.toString()};
        } catch (e) {
          payload = {cmd: msg.payload.toString()};
        }
      }
      else
        payload = {cmd: msg.payload.toString()};
      if (payload == null) {
        node.log('marantzout.onInput: illegal msg.payload!');
        return;
      }

      //If msg.topic is filled, than set it as cmd
      if (msg.topic) {
        if (payload.value === null || payload.value === undefined)
          payload.value = payload.cmd;
        payload = {cmd: msg.topic.toString(), value: payload.value};
      }

      if (node.marantzcommand && node.marantzcommand !== 'empty') {
        try {
          payload = JSON.parse(node.marantzcommand);
          if (typeof (payload) === 'number')
            payload.cmd = node.marantzcommand.toString();
        } catch (e) {
          payload.cmd = node.marantzcommand.toString();
        }
      }

      node.send(payload, function(err) {
        if (err) {
          node.error('send error: ' + err);
        }
        if (typeof(msg.cb) === 'function')
          msg.cb(err);
      });

    });
    this.on("close", function() {
      node.log('marantzOut.close');
    });

    node.status({fill: "yellow", shape: "dot", text: "inactive"});

    function nodeStatusConnected() {
      node.status({fill: "green", shape: "dot", text: "connected"});
    }

    function nodeStatusDisconnected() {
      node.status({fill: "red", shape: "dot", text: "disconnected"});
    }

    function nodeStatusReconnect() {
      node.status({fill: "yellow", shape: "ring", text: "reconnecting"});
    }

    function nodeStatusConnecting() {
      node.status({fill: "green", shape: "ring", text: "connecting"});
    }

    controllerNode.initializeMarantzConnection(function(fsm) {
      if (fsm.connected)
        nodeStatusConnected();
      else
        nodeStatusDisconnected();
      fsm.off('connecting', nodeStatusConnecting);
      fsm.on('connecting', nodeStatusConnecting);
      fsm.off('connected', nodeStatusConnected);
      fsm.on('connected', nodeStatusConnected);
      fsm.off('disconnected', nodeStatusDisconnected);
      fsm.on('disconnected', nodeStatusDisconnected);
      fsm.off('reconnect', nodeStatusReconnect);
      fsm.on('reconnect', nodeStatusReconnect);
    });

    this.send = function(data, callback) {
      DEBUG && RED.comms.publish("debug", {name: node.name, msg: 'send data[' + JSON.stringify(data) + ']'});
      controllerNode.initializeMarantzConnection(function(fsm) {
        try {
          DEBUG && RED.comms.publish("debug", {name: node.name, msg: "send:  " + JSON.stringify(data)});
          data.cmd = data.cmd || data.method;
          data.value = data.value || data.params;
          switch (data.cmd.toLowerCase()) {
            case 'power':
            case 'pw':
            case 'power state':
            case 'pwstate':
              data.value = '' + data.value;
              fsm.connection.setPowerState(data.value.toLowerCase() === 'on' || data.value === '1' || data.value === 'true' || data.value.toLowerCase() === 'pwon').then(function(response) {
                callback && callback(null, response);
              }, function(error) {
                callback && callback(error);
              });
              break;
            case 'si':
            case 'select_input':
            case 'select input':
            case 'input':
              fsm.connection.setInputSource('' + data.value).then(function(response) {
                callback && callback(null, response);
              }, function(error) {
                callback && callback(error);
              });
              break;
            case 'mute':
            case 'mute_state':
            case 'mute state':
              data.value = '' + data.value;
              fsm.connection.setMuteState(data.value.toLowerCase() === 'on' || data.value === '1' || data.value === 'true').then(function(response) {
                callback && callback(null, response);
              }, function(error) {
                callback && callback(error);
              });
              break;
            case 'volume_down':
            case 'volume down':
            case 'voldown':
            case 'vol_down':
            case 'volumedown':
              fsm.connection.volumeDown().then(function(response) {
                callback && callback(null, response);
              }, function(error) {
                callback && callback(error);
              });
              break;
            case 'volume_up':
            case 'volume up':
            case 'volup':
            case 'vol_up':
            case 'volumeup':
              fsm.connection.volumeUp().then(function(response) {
                callback && callback(null, response);
              }, function(error) {
                callback && callback(error);
              });
              break;
            case 'volume':
            case 'volume level':
            case 'volume_level':
            case 'vol_level':
            case 'vollevel':
              fsm.connection.setVolumePercent(parseInt(data.value)).then(function(response) {
                callback && callback(response);
              }, function(error) {
                callback && callback(error, response);
              });
              break;
            /*
             MOVIE
             MUSIC
             GAME
             DIRECT
             PURE DIRECT
             STEREO
             AUTO
             DOLBY DIGITAL
             DTS SURROUND
             AURO3D
             AURO2D SURR
             MCH STEREO
             VIRTUAL
             LEFT
             RIGHT
             */
            case 'surround':
            case 'surround mode':
            case 'surround_mode':
            case 'sm':
            case 'ms':
              fsm.connection.setSurroundMode(data.value ? data.value.toString() : '').then(function(response) {
                callback && callback(response);
              }, function(error) {
                callback && callback(error, response);
              });
              break;
            default:
              node.log('Cannot proceed unknown cmd[' + data.cmd + '] for msg[' + JSON.stringify(data) +']');

          }
        }
        catch (err) {
          node.error('error calling send: ' + err);
          callback && callback(err);
        }
      });
    }
  }

  RED.nodes.registerType("marantz-http-out", MarantzOut);

  /**
   * ====== Marantz-IN ========================
   * Handles incoming Global Cache, injecting
   * json into node-red flows
   * =======================================
   */
  function MarantzIn(config) {
    RED.nodes.createNode(this, config);
    this.name = config.name;
    this.connection = null;
    var node = this;
    var controllerNode = RED.nodes.getNode(config.controller);

    /* ===== Node-Red events ===== */
    function nodeStatusConnecting() {
      node.status({fill: "green", shape: "ring", text: "connecting"});
    }

    function nodeStatusConnected() {
      node.status({fill: "green", shape: "dot", text: "connected"});
    }

    function nodeStatusDisconnected() {
      node.status({fill: "red", shape: "dot", text: "disconnected"});
    }

    function nodeStatusReconnect() {
      node.status({fill: "yellow", shape: "ring", text: "reconnecting"});
    }

    node.receiveNotification = function(notification, data) {
      DEBUG && RED.comms.publish("debug", {
        name: node.name,
        msg: 'marantz event data[' + JSON.stringify(data) + ']'
      });
      node.send({
        topic: 'marantz',
        payload: {
          'notification': notification,
          'data': data
        }
      });
    };

    controllerNode.initializeMarantzConnection(function(fsm) {
      if (fsm.connected)
        nodeStatusConnected();
      else
        nodeStatusDisconnected();
      fsm.off('connecting', nodeStatusConnecting);
      fsm.on('connecting', nodeStatusConnecting);
      fsm.off('connected', nodeStatusConnected);
      fsm.on('connected', nodeStatusConnected);
      fsm.off('disconnected', nodeStatusDisconnected);
      fsm.on('disconnected', nodeStatusDisconnected);
      fsm.off('reconnect', nodeStatusReconnect);
      fsm.on('reconnect', nodeStatusReconnect);
    });
  }

  RED.nodes.registerType("marantz-http-in", MarantzIn);
}