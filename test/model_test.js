var async = require('async');
var should = require('chai').should();
var mongoose = require('mongoose');
var getModel = require('../lib/model');
var connection;
var jobModel;

before(function (done) {
  connection = mongoose.createConnection('mongodb://127.0.0.1/monq_test');
  connection.on('error', console.error.bind(console));
  connection.once('open', function () {
    jobModel = getModel(connection, 'Job');
    done();
  });
});

after(function (done) {
  connection.db.dropDatabase(function (err) {
    if (err) {
      return done(err);
    }
    connection.close(done);
  });
});

afterEach(function (done) {
  jobModel.collection.drop(function () {
    delete connection.models.Job;
    done();
  });
});

describe('jobModel', function () {

  it('should have some props', function () {
    jobModel.should.have.property('collection');
    jobModel.should.have.property('schema');
    jobModel.should.have.property('db');
    jobModel.should.have.property('model');
    jobModel.should.have.property('modelName');
    jobModel.should.have.property('base');
  });

  it('should sucess create record', function (done) {
    var job = new jobModel({
      queue: 'queue',
      name: 'test',
      status: 'queued',
      enqueued: new Date
    });

    job.save(assert);

    function assert(err, result) {
      should.not.exist(err);
      result.should.have.property('queue', 'queue');
      result.should.have.property('name', 'test');
      done();
    }
  });
});
