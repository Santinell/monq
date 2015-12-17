var async = require('async');
var should = require('chai').should();
var mongoose = require('mongoose');
var client;
var monq = require('../lib/index');
var connection;
var jobModel;
var queue1;
var queue2;

before(function (done) {
  connection = mongoose.createConnection('mongodb://127.0.0.1/monq_test');
  client = monq(connection);
  connection.on('error', console.error.bind(console));
  connection.once('open', function () {
    queue1 = client.queue('queue1');
    queue2 = client.queue('queue2');
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

describe('Client', function () {

  it('should have model in models', function () {
    client.should.have.property('models');
    client.models.should.have.property('Job');
    jobModel = client.models.Job;
  });

});

describe('jobModel from client', function () {

  it('should have some props', function () {
    jobModel.should.have.property('collection');
    jobModel.should.have.property('schema');
    jobModel.should.have.property('db');
    jobModel.should.have.property('model');
    jobModel.should.have.property('modelName');
    jobModel.should.have.property('base');
  });

  it('should sucess create records', function (done) {
    var job1 = new jobModel({
      queue: 'queue1',
      name: 'test',
      status: 'queued',
      enqueued: new Date
    });
    job1.save(assert);

    function assert(err, result) {
      should.not.exist(err);
      result.should.have.property('queue', 'queue1');
      result.should.have.property('name', 'test');
      done();
    }
  });


});
