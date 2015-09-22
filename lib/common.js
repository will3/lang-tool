var program = require('commander');
var Q = require('q');

module.exports = {
    exitWithError: function(error, hideHelp) {
        if (!hideHelp) {
            program.outputHelp();
        }
        if (error.Message) {
            console.error('\n  Error:', error.Message,'\n');
        } else {
            console.error('\n  Error:', error,'\n');
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
            //console.log(' request complete', request.url.path)
            if (!response) {
                deferred.reject('no response');
            } else if (response.statusCode == 200) {
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
