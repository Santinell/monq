var mongo = require('mongoskin');
var job = require('./job');
var Queue = require('./queue');
var Worker = require('./worker');

module.exports = Connection;

function Connection(uri, options) {
  this.db = mongo.db(uri, options);
}

Connection.prototype.worker = function(names, options) {
  names || (names = []);

  if (!Array.isArray(names)) {
    names = [names];
  }

  var queues = {};
  for (var i = 0; i < names.length; i++) {
    queues[names[i]] = this.queue(names[i]);
  }

  return new Worker(queues, options);
};

Connection.prototype.queue = function(name, options) {
  return new Queue(this, name, options);
};

Connection.prototype.close = function() {
  this.db.close();
};
