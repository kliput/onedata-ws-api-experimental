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
    sendMessage() {
      this.get('onedataWebsocket').send({
        message: this.get('messageValue')
      });
    },
  },
});
