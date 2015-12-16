var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = function (connection, options) {
  var schema = new Schema({
    name: {
      type: String,
      required: true
    },
    params: {},
    queue: {
      type: String,
      required: true
    },
    attempts: Number,
    timeout: Number,
    delay: Date,
    priority: Number,
    status: {
      type: String,
      required: true
    },
    enqueued: {
      type: Date,
      required: true
    },
    dequeued: Date,
    ended: Date,
    error: String,
    stack: String,
    result: {
      code: Number,
      output: String
    }
  });

  schema.index({
    status: 1,
    queue: 1,
    priority: 1,
    _id: 1,
    delay: 1
  });

  var modelName = options.modelName || 'Job';
  return connection.model(modelName, schema);
};
