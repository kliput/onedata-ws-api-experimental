import Ember from 'ember';
import _zipObject from 'lodash/zipObject';

const {
  RSVP: { defer },
  computed: { readOnly },
  Evented,
  String: { camelize },
} = Ember;

/**
 * Path where WS server is hosted
 */
const WS_ENDPOINT = '/ws/';

/**
 * Default value for ``responseTimeout`` in service
 * @type {number}
 */
const RESPONSE_TIMEOUT_MS = 1 * 60 * 1000;

const AVAIL_MESSAGE_HANDLERS = ['response', 'push'];

export default Ember.Service.extend(Evented, {
  /**
   * Max time in milliseconds for receiving a response for message
   *
   * If we don't receive reponse for sent message in this time, the message's
   * promise will be rejected.
   * @type {number}
   */
  responseTimeout: RESPONSE_TIMEOUT_MS,

  _initDefer: null,

  /**
   * Maps message id -> deferred
   * @type {Map}
   */
  _deferredMessages: new Map(),

  /**
   * A class for creating new WebSocket object
   *
   * Set this property to custom class for mocking websocket
   * @type {class}
   */
  _webSocketClass: WebSocket,

  /**
   * @type {WebSocket}
   */
  _webSocket: null,

  initPromise: readOnly('_initDefer.promise'),

  initWebsocket() {
    let {
      _webSocketClass: WebSocketClass,
    } = this.getProperties('_webSocketClass');

    let _initDefer = defer();
    this.set('_initDefer', _initDefer);
    let protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    let host = window.location.hostname;
    let port = window.location.port;

    let url = protocol + host + (port === '' ? '' : ':' + port) + WS_ENDPOINT;

    try {
      let socket = new WebSocketClass(url);
      this.set('socket', socket);
      socket.onopen = this._onOpen.bind(this);
      socket.onmessage = this._onMessage.bind(this);
      socket.onerror = this._onError.bind(this);
      socket.onclose = this._onClose.bind(this);
      this.set('_webSocket', socket);
    } catch (error) {
      console.error(`WebSocket initializtion error: ${error}`);
      _initDefer.reject(error);
    }

    return _initDefer.promise;
  },

  /**
   * The promise resolves with received message data.
   * The promise rejects on:
   * - uuid collision
   * - websocket adapter exception
   * @type {object} message
   * @return {Promise}
   */
  send(message) {
    let {
      socket,
      _deferredMessages,
      responseTimeout,
    } = this.getProperties(
      'socket',
      '_deferredMessages',
      'responseTimeout'
    );
    let uuid = this._generateUuid();
    // TODO message is modified - it's efficient but not safe
    message.uuid = uuid;
    let sendDeferred = defer();
    if (_deferredMessages.has(uuid)) {
      // TODO: reason - collision
      sendDeferred.reject({
        error: 'collision',
        details: {
          uuid
        },
      });
    }
    try {
      socket.send(message);
    } catch (error) {
      sendDeferred.reject({
        error: 'send-failed',
        details: {
          error
        }
      });
    }
    _deferredMessages.set(uuid, sendDeferred);
    // FIXME register timeout and clear it after message resolve
    // FIXME optimize - do not create whole function every time
    window.setTimeout(function () {
      if (_deferredMessages.has(uuid)) {
        sendDeferred.reject({
          error: 'timeout',
        });
      }
    }, responseTimeout);
    return sendDeferred.promise;
  },

  _onOpen( /*event*/ ) {
    this.get('_initDefer').resolve();
  },

  // TODO move unpacking into protocol level?
  // TODO currently supporting only batch messages
  _onMessage({ data }) {
    let batch = JSON.parse(data).batch;

    // FIXME a hack
    if (!Array.isArray(batch)) {
      batch = [batch];
    }
    // messages are considered to be batched
    batch.forEach(m => this._handleMessage(m));
  },

  _onError( /*event*/ ) {},

  _onClose( /*event*/ ) {},

  /** 
   * Generates a random uuid of message
   * @return {string}
   */
  _generateUuid() {
    let date = new Date().getTime();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,
      function (character) {
        let random = (date + Math.random() * 16) % 16 | 0;
        date = Math.floor(date / 16);
        return (character === 'x' ? random : (random & 0x7 | 0x8)).toString(16);
      });
  },

  _MESSAGE_HANDLERS: _zipObject(
    AVAIL_MESSAGE_HANDLERS,
    AVAIL_MESSAGE_HANDLERS.map(t => '_' + camelize(`handle-${t}-message`))
  ),

  /**
   * @param {object} message 
   */
  _handleMessage(message) {
    console.debug(`Hadling message: ${JSON.stringify(message)}`);
    let {
      type,
    } = message;

    let handler = this[this._MESSAGE_HANDLERS[type]];

    if (typeof handler === 'function') {
      handler.bind(this)(message);
    } else {
      throw `No handler for message type: ${type}`;
    }
  },

  _handlePushMessage(message) {
    this.trigger('push', message);
  },

  _handleResponseMessage(message) {
    let _deferredMessages = this.get('_deferredMessages');
    let {
      uuid,
    } = message;
    if (_deferredMessages.has(uuid)) {
      let deferred = _deferredMessages.get(uuid);
      // NOTE Map.delete will not work on IE 10 or lower
      _deferredMessages.delete(uuid);
      deferred.resolve(message);
    } else {
      throw `Tried to handle message with unknown UUID: ${uuid}`;
    }
  },
});
