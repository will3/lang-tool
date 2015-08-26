var program = require('commander');
var Q = require('q');

module.exports = {
	exitWithError: function(error) {
	  program.outputHelp();
	  if (error.Message) {
	    console.error('Error:', error.Message);
	  } else {
	    console.error('Error:', error);
	  }
	  process.exit(1);  
	},

	list: function(val) {
	  return val.split(',');
	},
	 
	collect: function(val, memo) {
	  memo.push(val);
	  return memo;
	},

	promiseRequest: function(request) {
	  //console.log('promiseRequest', request.url.href);
	  var deferred = Q.defer();

	  request.on('complete', function(data, response) {
	    //console.log(' request complete', request.url.path);
	    if (response.statusCode == 200) {
	      deferred.resolve(data);
	    } else {
	      deferred.reject(data);
	    }
	  }).on('error', function(err) {
	    //console.error(' error');
	    deferred.reject(err);
	  });

	  return deferred.promise;
	}
}