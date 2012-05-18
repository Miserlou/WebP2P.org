// Copyright (C) 2012 Google. All rights reserved.
/**
 * @fileoverview A mock JSEP implementation, for use in testing.
 * Not filled out yet.
 * Conforms to the interface in draft-ietf-rtcweb-jsep-00.
 * @author hta@google.com (Harald Alvestrand)
 */

/** Keeps track of number of created connections. */
MockJsepPeerConnection.connectionCount = 0;
/** Keeps track of currently existing connections, so that they can connect. */
MockJsepPeerConnection.existingConnections = [];

/**
 * @constructor
 * @param {string} configuration Ignored.
 * @param {function} iceCb Callback for handling new ICE candidates.
 */
function MockJsepPeerConnection(configuration, iceCb) {
  this.id = ++MockJsepPeerConnection.connectionCount;
  MockJsepPeerConnection.existingConnections[this.id] = this;
  this.trace('Constructed MockJsepPeerConnection ' + this.id);
  this.iceCallback = iceCb;
  this.localStreams = [];
  this.remoteStreams = [];
}

/**
 * Creates an offer SDP object.
 * @param {string} hints Ignored.
 * @return {SessionDescription} SDP object.
 */
MockJsepPeerConnection.prototype.createOffer = function(hints) {
  this.trace('CreateOffer');
  return new MockSessionDescription('offer from ' + this.id +
                                    ' with ' + this.localStreams.length +
                                    ' streams');
};

/**
 * Creates an answer SDP object.
 * @param {SessionDescription} offer Ignored.
 * @param {string} hints Ignored.
 * @return {SessionDescription} SDP object.
 */
MockJsepPeerConnection.prototype.createAnswer = function(offer, hints) {
  this.trace('createAnswer');
  return new MockSessionDescription('answer from ' + this.id +
                                    ' with ' + this.localStreams.length +
                                    ' streams');
};

/**
 * Sets the local description to a particular SDP object.
 * @param {string} action What action this is (offer, answer or pr-answer).
 * @param {SessionDescription} desc SDP object.
 */
MockJsepPeerConnection.prototype.setLocalDescription = function(action, desc) {
  this.trace('setLocalDescription');
  this.localDescription = desc;
};

/**
 * Sets the remote description to a particular SDP object.
 * Will trigger callbacks for added and removed streams.
 * @param {string} action What action this is (offer, answer or pr-answer).
 * @param {SessionDescription} desc SDP object.
 */
MockJsepPeerConnection.prototype.setRemoteDescription = function(action, desc) {
  this.trace('setRemoteDescription');
  this.remoteDescription = desc;
  if (desc.toSdp().match(/ from (\d+)/)) {
    if (!this.remote) {
      this.trace(this.id + ' has ' + RegExp.$1 + ' as remote');
      this.remote = MockJsepPeerConnection.existingConnections[RegExp.$1];
      this.doLater(this.onopen);
    }
    // Signal new streams (after this finishes).
    this.trace('Remote has ' + this.remote.localStreams.length + ' streams');
    for (var i = 0; i < this.remote.localStreams.length; i++) {
      if (this.remoteStreams[i] !== this.remote.localStreams[i]) {
        if (this.remoteStreams[i]) {
          this.trace('Removing stream ' + i);
          this.streamRemoved(this.remoteStreams[i]);
          this.remoteStreams[i] = null;
        }
        if (this.remote.localStreams[i]) {
          this.trace('Adding stream ' + i);
          this.remoteStreams[i] = this.remote.localStreams[i];
          this.streamAdded(this.remoteStreams[i]);
        }
      }
    }
  } else {
    this.error('Failed to connect with peer');
  }
};

/**
 * Internal function for adding a stream coming from the remote.
 * @param {MediaStream} stream The stream.
 */
MockJsepPeerConnection.prototype.streamAdded = function(stream) {
  var that = this;
  this.doLater(function() {
      that.trace('Signalling remote stream added');
      var e = {};
      e.stream = stream;
      that.onaddstream(e);
    });
};

/**
 * Internal function for removing a stream coming from the remote.
 * @param {MediaStream} stream The stream.
 */
MockJsepPeerConnection.prototype.streamRemoved = function(stream) {
  var that = this;
  this.doLater(function() {
      that.trace('Signalling remote stream removed');
      that.onremovestream(stream);
    });
};

/**
 * Adding a stream locally.
 * @param {MediaStream} stream The stream.
 * @param {string} hints Ignored.
 */
MockJsepPeerConnection.prototype.addStream = function(stream, hints) {
  this.trace('addStream');
  this.localStreams.push(stream);
};

/**
 * Starts ICE processing, which generates candidates.
 * @param {string} options - ignored.
 */
MockJsepPeerConnection.prototype.startIce = function(options) {
  var that = this;
  this.trace('startIce');
  this.iceState = 'gathering';
  this.doLater(function() {
      that.trace('Providing candidate');
      that.iceState = 'completed';
      that.iceCallback(new MockIceCandidate(), false);
    });
};

/**
 * Processes an ICE candidate from remote.
 * @param {IceMessage} candidate Ignored.
 */
MockJsepPeerConnection.prototype.processIceMessage = function(candidate) {
  this.trace('processIceMessage');
  // Nothing happens.
};

/**
 * Closes the PeerConnection.
 */
MockJsepPeerConnection.prototype.close = function() {
  var i;
  for (i = 0; i < this.localStreams.length; ++i) {
    this.localStreams[i].stop();
  }
};

/**
 * Internal function: Trace what happens. This version: Console write.
 * @param {string} text What happened.
 */
MockJsepPeerConnection.prototype.trace = function(text) {
  console.log('MockJsep ' + this.id + ': ' + text);
};

/**
 * Internal function: Log an error and throw an exception.
 * @param {string} text What happened.
 */
MockJsepPeerConnection.prototype.error = function(text) {
  console.log('MockJsep ' + this.id + ' ERROR: ' + text);
  throw ('MockJsep error: ' + text);
};

/**
 * Internal function, available for override: Do something
 * slightly later, and not on the same call stack.
 * @param {function} what Callback to be called later.
 */
MockJsepPeerConnection.prototype.doLater = function(what) {
  if (what) {
    window.setTimeout(what, 1);
  }
};

/**
 * @constructor for Mock SessionDescription implementation.
 * @param {string} type Part of the generated description.
 */
function MockSessionDescription(type) {
  this.sdp = 'Fake session description of ' + type;
}

/**
 * Accessor for the contained SDP.
 * @return {string} SDP-formatted description.
 */
MockSessionDescription.prototype.toSdp = function() {
  return this.sdp;
};

/**
 * Adds an ICE candidate to the session description.
 * @param {IceCandidate} candidate The candidate to add.
 */
MockSessionDescription.prototype.addCandidate = function(candidate) {
  this.sdp += candidate.toSdp();
};

/**
 * @constructor for Mock IceCandidate implementation.
 */
function MockIceCandidate() {
  this.sdp = 'a=candidate:Fake candidate';
  this.label = 'first';
}

/**
 * Accessor for the text description of an ICE candidate.
 * @return {string} SDP-form description of the candidate.
 */
MockIceCandidate.prototype.toSdp = function() {
  return this.sdp;
};
