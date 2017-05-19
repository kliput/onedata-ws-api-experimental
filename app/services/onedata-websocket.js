import Ember from 'ember';

const {
  RSVP: { defer }
} = Ember;

/**
 * Path where WS server is hosted
 */
const WS_ENDPOINT = '/ws/';

export default Ember.Service.extend({
  openDefer: null,

  /**
   * Maps message id -> deferred
   * @type {Map}
   */
  deferredMessages: new Map(),

  initWebsocket() {
    let openDefer = defer();
    this.set('openDefer', openDefer);
    let protocol = window.location.protocol === 'https:' ? 'wss://' : 'ws://';
    let host = window.location.hostname;
    let port = window.location.port;

    let url = protocol + host + (port === '' ? '' : ':' + port) + WS_ENDPOINT;

    try {
      let socket = new WebSocket(url);
      this.set('socket', socket);
      socket.onopen = this.onOpen.bind(this);
      socket.onmessage = this.onMessage.bind(this);
      socket.onerror = this.onError.bind(this);
      socket.onclose = this.onClose.bind(this);
    } catch (error) {
      console.error(`WebSocket initializtion error: ${error}`);
      openDefer.reject(error);
    }

    return openDefer.promise;
  },

  onOpen( /*event*/ ) {
    this.get('openDefer').resolve();
  },

  onMessage({ data }) {
    this.handleMessage(data);
  },

  onError( /*event*/ ) {},

  onClose( /*event*/ ) {},

  /** 
   * Generates a random uuid of message
   * @return {string}
   */
  generateUuid() {
    let date = new Date().getTime();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,
      function (character) {
        let random = (date + Math.random() * 16) % 16 | 0;
        date = Math.floor(date / 16);
        return (character === 'x' ? random : (random & 0x7 | 0x8)).toString(16);
      });
  },

  /**
   * Sends a payload (JSON) via WebSocket, previously adding a randomly
   * generated UUID to it and registers a promise
   * (which can later be retrieved by the UUID).
   *
   * TODO: document type of "payload" (Message without uuid?)
   */
  sendAndRegisterPromise(operation, type, payload) {
    // Add UUID to payload so we can later connect the response with a promise
    // (the server will include this uuid in the response)
    let uuid = this.generateUuid();
    payload.uuid = uuid;
    let adapter = this;
    return new Ember.RSVP.Promise(function (resolve, reject) {
      let success = function (json) {
        Ember.run(null, resolve, json);
      };
      let error = function (json) {
        Ember.run(null, reject, json);
      };
      adapter.promises.set(uuid, {
        success: success,
        error: error,
        type: type,
        operation: operation
      });
      console.debug('registerPromise: ' + JSON.stringify(payload));
      adapter.send(payload);

    });
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
      deferredMessages,
    } = this.getProperties('socket', 'deferredMessages');
    let uuid = this.generateUuid();
    // TODO message is modified - it's efficient but not safe
    message.uuid = uuid;
    let sendDeferred = defer();
    if (deferredMessages.has(uuid)) {
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
    deferredMessages.set(uuid, sendDeferred);
    return sendDeferred.promise;
  },

  handleMessage(data) {
    // TODO array/batch messages?
    data = JSON.parse(data);
    console.debug(`Hadling message: ${JSON.stringify(data)}`);
    let uuid = data.uuid;

    let deferredMessages = this.get('deferredMessages');
    if (deferredMessages.has(uuid)) {
      let deferred = deferredMessages.get(uuid);
      deferred.resolve(data);
    } else {
      console.error(`Tried to handle message with unknown UUID: ${uuid}`);
    }

  }
});
