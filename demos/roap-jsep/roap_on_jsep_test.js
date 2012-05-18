/**
 * @fileoverview
 * Tests for the RoapOnJsep library, written for use with the google JS test
 * framework.
 *
 * @author hta@google.com (Harald Alvestrand)
 */

// We have to fake up some functions before the library loads.
// These two are constructors for Webkit objects if running under Chrome,
// but are undefined if running in the test harness.
if (typeof(webkitPeerConnection00) === 'undefined') {
  webkitPeerConnection00 = function() {
  };
  SessionDescription = function() {
  };
}

/** A simulated "do later" mechanism. */
var eventsToFire = [];

/** Execute all scheduled events. */
var fireAllEvents = function() {
  while (eventsToFire.length > 0) {
    var event = eventsToFire.shift();
    if (event) {
      event();
    }
  }
};

/** Debugging the debugging: Catch the console.log function. */
if (!console) {
  var console = {
    'log' : function(message) {
      // Uncomment this line for debugging the tests.
      //log(message);
    }
  };
}

/**
 * @constructor for the RoapOnJsepTest class.
 */
function RoapOnJsepTest() {
  if (typeof(testsShouldUseRealJsep) === 'undefined') {
    // We tell the implementation under test to use our mock functions.
    RoapConnection.JsepPeerConnectionConstructor = MockJsepPeerConnection;
    RoapConnection.SessionDescriptionConstructor = MockSessionDescription;
    // Override the timeout function used to simulate events in the
    // libraries.
    MockJsepPeerConnection.prototype.doLater = function(what) {
      eventsToFire.push(what);
    };
  }
  RoapConnection.prototype.doLater = function(what) {
    eventsToFire.push(what);
  };
  // Empty the global events array at test start (remove hangover
  // from previous tests).
  eventsToFire = [];
  var that = this;
  this.pc1 = null;
  this.pc2 = null;

  this.pc1Callback = function(msg) {
    // Since pc2 auto-fires when created, we can't create it until
    // we have a message for it.
    if (that.pc2 === null) {
      that.pc2 = new RoapConnection('dummy arg', that.pc2Callback);
      // Add the staged "onaddstream" callback, if any.
      that.pc2.onaddstream = that.onaddstreamCallbackForPc2;
    }
    that.pc2.processSignalingMessage(msg);
  }
  this.pc2Callback = function(msg) {
    that.pc1.processSignalingMessage(msg);
  }

  this.onaddstreamCallbackForPc2 = null;
  // Create two PeerConnection objects that embrace each other.
  this.setupPeerConnections = function(onOpenCallback) {
    that.pc1 = new RoapConnection('dummy arg', that.pc1Callback);
    that.pc1.onopen = onOpenCallback;
  };
}

registerTestSuite(RoapOnJsepTest);

/**
 * Constructs a RoapConnection object.
 */
RoapOnJsepTest.prototype.ConstructorTest = function() {
  pc = new RoapConnection('dummy arg', function(msg) {});
};

/**
 * Runs the setup function, and verifies that it does not crash.
 */
RoapOnJsepTest.prototype.SetupDoesNotCrashTest = function() {
  this.setupPeerConnections();
  expectThat(this.pc1.state, equals('new'));
  expectThat(this.pc2, equals(null));
};

/**
 * Connects two RoapConnections together.
 * Verifies that the onopen callback is called.
 */
RoapOnJsepTest.prototype.ConnectTest = function() {
  var that = this;
  var checkEstablished = function() {
    expectThat(that.pc1.state, equals('established'));
    expectThat(that.pc2.state, equals('established'));
  };
  var onopen = createMockFunction();
  expectCall(onopen)().willOnce(checkEstablished);
  this.setupPeerConnections(onopen);
  fireAllEvents();
};

/**
 * Adds a stream to one RoapConnection, and then connects them.
 */
RoapOnJsepTest.prototype.StreamPassedBeforeConnectTest = function() {
  this.setupPeerConnections();
  // Since PC2 doesn't exist before setup, we have to stage it
  // in a temporary variable accessible to the function that constructs pc2.
  this.onaddstreamCallbackForPc2 = createMockFunction();
  expectCall(this.onaddstreamCallbackForPc2)(_);
  this.pc1.addStream('dummy stream');
  fireAllEvents();
  expectThat(this.pc2.peerConnection.remoteStreams.length, equals(1));
};

/**
 * Connects two RoapConnections together, and then adds a stream to one.
 */
RoapOnJsepTest.prototype.StreamPassedAfterConnectTest = function() {
  this.setupPeerConnections();
  fireAllEvents();
  this.pc2.onaddstream = createMockFunction();
  expectCall(this.pc2.onaddstream)(_);
  this.pc1.addStream('dummy stream');
  fireAllEvents();
  expectThat(this.pc2.peerConnection.remoteStreams.length, equals(1));
};
