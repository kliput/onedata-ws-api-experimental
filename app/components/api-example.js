import Ember from 'ember';

const {
  inject: { service },
} = Ember;

export default Ember.Component.extend({
  onedataWebsocket: service(),

  messageValue: null,

  init() {
    this._super(...arguments);
    let onedataWebsocket = this.get('onedataWebsocket');
    onedataWebsocket.initWebsocket().then(
      () => this.set('websocketInitialized', true),
      () => this.set('websocketInitialized', false)
    );
  },

  actions: {
    handshake() {
      this.get('onedataWebsocket').send('handshake', {
        supportedVersions: [1],
        sessionId: null,
      });
    },
    sendMessage() {
      this.get('onedataWebsocket').send('rpc', {
        function: this.get('messageValue'),
        args: {},
      }).then(resp => this.set('messageResponse', JSON.stringify(resp)));
    },
  },
});
