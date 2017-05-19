import { expect } from 'chai';
import { describe, it } from 'mocha';
import { setupTest } from 'ember-mocha';
import wait from 'ember-test-helpers/wait';

describe('Unit | Service | onedata websocket', function () {
  setupTest('service:onedata-websocket', {
    // Specify the other units that are required for this test.
    // needs: ['service:foo']
  });

  // Replace this with your real tests.
  it('resolves initWebsocket promise by opening ws connection', function (done) {
    let promiseResolved = false;
    let service = this.subject();
    let promise = service.initWebsocket();
    promise.then(() => {
      promiseResolved = true;
    });
    wait().then(() => {
      expect(promiseResolved).to.be.true;
      done();
    });
  });
});
