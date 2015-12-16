var Queue = require('./queue');
var Worker = require('./worker');

module.exports = function (connect) {
  return {
    worker(names, options) {
      names = names || [];

      if (!Array.isArray(names)) {
        names = [names];
      }

      var queues = {};
      for (var i = 0; i < names.length; i++) {
        queues[names[i]] = this.queue(names[i]);
      }

      return new Worker(queues, options);
    },

    queue(name, options) {
      return new Queue(connect, name, options);
    }

  };
};
