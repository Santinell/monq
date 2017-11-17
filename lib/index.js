const Queue = require('./queue');
const Worker = require('./worker');
const getModel = require('./model');

module.exports = (connection) => {
  return {
    models: [],
    worker(names, options) {
      names = names || [];

      if (!Array.isArray(names)) {
        names = [names];
      }

      const queues = {};
      for (let i = 0; i < names.length; i++) {
        queues[names[i]] = this.queue(names[i]);
      }

      return new Worker(queues, options);
    },

    queue(name, options) {
      options = options || {};
      const modelName = options.modelName || 'Job';
      if (!this.models[modelName]) {
        this.models[modelName] = getModel(connection, modelName);
      }
      return new Queue(this.models[modelName], name, options);
    }

  };
};
