var Queue = require('./queue');
var Worker = require('./worker');
var getModel = require('./model');

module.exports = function (connection) {
  return {
    models: [],
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
      options = options || {};
      var modelName = options.modelName || 'Job';
      if (!this.models[modelName]) {
        this.models[modelName] = getModel(connection, modelName);
      }
      return new Queue(this.models[modelName], name, options);
    }

  };
};
