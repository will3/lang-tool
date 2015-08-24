var rest = require('restler');

module.exports = rest.service(function(apiToken) {
  this.defaults.headers = { 
  	'Accept': 'application/json', 
  	'User-Agent': 'Restler for node.js',
  	'API-Token': apiToken
  };
}, {
  baseURL: 'http://localhost:60632/api/v1/'
}, {
  applications: function() {
    return this.get('applications');
  },
  sections: function(apps) {
    var url = 'sections?take=1000';
    if (apps) {
      for (var i = 0; i < apps.length; i++) {
        url += '&app='+apps[i];
      }
    }
    console.log('GET',url);
    return this.get(url);
  },
  languages: function() {
    return this.get('languages');
  },
  entries: function(apps,sections,keys,version) {
  	var url = 'entries?take=1000';
  	if (apps) {
  		for (var i = 0; i < apps.length; i++) {
  		  url += '&app='+apps[i];
  		}
  	}
    if (sections) {
      for (var i = 0; i < sections.length; i++) {
        url += '&section='+sections[i];
      }
    }
    if (keys) {
      for (var i = 0; i < keys.length; i++) {
        url += '&key='+keys[i];
      }
    }
    if (version) {
      url += '&version='+version;
    }
    console.log('GET',url);
    return this.get(url);
  },
  translations: function(language,apps,sections,keys,version) {
    var url = 'translations/'+language+'/?take=1000';
    if (apps) {
      for (var i = 0; i < apps.length; i++) {
        url += '&app='+apps[i];
      }
    }
    if (sections) {
      for (var i = 0; i < sections.length; i++) {
        url += '&section='+sections[i];
      }
    }
    if (keys) {
      for (var i = 0; i < keys.length; i++) {
        url += '&key='+keys[i];
      }
    }
    if (version) {
      url += '&version='+version;
    }
    console.log('GET',url);
    return this.get(url);
  }
});


