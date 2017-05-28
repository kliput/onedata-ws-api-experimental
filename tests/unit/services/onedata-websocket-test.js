import { expect } from 'chai';
import { describe, it } from 'mocha';
import { setupTest } from 'ember-mocha';
import wait from 'ember-test-helpers/wait';
import Ember from 'ember';

const {
  Evented
} = Ember;

class WebSocketMock {
  constructor() {
    setTimeout(() => this.onopen({}), 0);
  }
}

describe('Unit | Service | onedata websocket', function () {
  setupTest('service:onedata-websocket', {
    // Specify the other units that are required for this test.
    // needs: ['service:foo']
  });

  it('resolves initWebsocket promise by opening ws connection', function (done) {
    let promiseResolved = false;
    let service = this.subject();

    service.set('_webSocketClass', WebSocketMock);

    let promise = service.initWebsocket();
    promise.then(() => {
      promiseResolved = true;
    });
    wait().then(() => {
      expect(promiseResolved).to.be.true;
      done();
    });
  });

  it('sends event with message content when push message is sent', function (done) {
    let service = this.subject();
    service.set('_webSocketClass', WebSocketMock);
    let pushHandlerDone = false;
    let pushHandler = function (m) {
      expect(m.payload).to.equal('hello');
      pushHandlerDone = true;
    };

    Ember.Object.extend(Evented).create({
      init() {
        service.on('push', (m) => {
          pushHandler(m);
        });
      }
    });

    service.initWebsocket().then(() => {
      let _webSocket = service.get('_webSocket');
      _webSocket.onmessage({
        data: JSON.stringify({ batch: [{ type: 'push', payload: 'hello' }] })
      });
      wait().then(() => {
        expect(pushHandlerDone).to.be.true;
        done();
      });
    });
  });
});
