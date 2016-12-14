var request = require('request'),
  async = require('async'),
  fs = require('fs'),
  CloudError = require('./selectel-clouderror.js');


// Storage constructor (set options and connect)
var SelectelCloudstorage = function(opts) {
  if (!opts) opts = {};
  this.user = opts.user || null;
  this.pass = opts.pass || null;
  this.authUrl = opts.authUrl || 'https://auth.selcdn.ru/';
  this.authToken = null;
  this.authExpire = null;
  this.storageUrl = null;
  return this;
};

// Get auth token
SelectelCloudstorage.prototype.selfAuth = function(next) {
  var _this = this;
  request({
    "method": "GET",
    "url": this.authUrl,
    "headers": {
      "X-Auth-User": this.user,
      "X-Auth-Key": this.pass
    }
  }, function(err, res, body) {
    if (err) return next(err);
    if (res.statusCode !== 204) return next(new CloudError(res.statusMessage, res.statusCode));
    _this.authToken = res.headers['x-auth-token'];
    _this.storageUrl = res.headers['x-storage-url'];
    _this.authExpire = res.headers['x-expire-auth-token'];
    return next(null);
  });
};

// Get storage info
SelectelCloudstorage.prototype.getStorageInfo = function(next) {
  request({
    "method": "HEAD",
    "url": this.storageUrl,
    "headers": {
      "X-Auth-Token": this.authToken
    }
  }, function(err, res, body) {
    if (err) return next(err);
    if (res.statusCode !== 204) return next(new CloudError(res.statusMessage, res.statusCode));
    var info = {
      bytesUsed: res.headers['x-account-bytes-used'] || null,
      containersCount: res.headers['x-account-container-count'] || null,
      objectsCount: res.headers['x-account-object-count'] || null
    };
    return next(null, info);
  });
};

// Get containers list 
SelectelCloudstorage.prototype.getContainerList = function(opts, next) {
  if (typeof opts == 'function') next = opts;
  if (typeof opts !== 'object') opts = {
    format: 'json'
  };
  var storageUrl = this.storageUrl;
  storageUrl += (Object.keys(opts).length) ? '?' : '';
  storageUrl += (opts.format) ? 'format=' + opts.format + '&' : '';
  storageUrl += (opts.limit) ? 'limit=' + opts.limit + '&' : '';
  storageUrl += (opts.marker) ? 'marker=' + opts.marker + '&' : '';
  request({
    "method": "GET",
    "url": storageUrl,
    "headers": {
      "X-Auth-Token": this.authToken
    }
  }, function(err, res, body) {
    if (err) return next(err);
    return next(null, body);
  });
};

// Create container
SelectelCloudstorage.prototype.createContainer = function(opts, next) {
  switch (typeof opts) {
    case 'string':
      opts = {
        name: opts
      };
      break;
    case 'function':
      next = opts;
    case 'object':
      if (opts.name && typeof opts.name == 'string') break;
    default:
      console.log(typeof opts);
      return next(new CloudError('Bad request. New container name error', 400));
  }

  var options = {
    "method": "PUT",
    "url": this.storageUrl + opts.name,
    "headers": {
      "X-Auth-Token": this.authToken
    }
  };
  if (opts.type) options.headers['X-Container-Meta-Type'] = opts.type;
  if (opts.headers && typeof opts.headers == 'object') {
    for (var name in opts.headers) {
      options.headers[name] = opts.headers[name];
    }
  }

  request(options, function(err, res, body) {
    if (err) return next(err);
    if (res.statusCode == 403) return next(new CloudError(res.statusMessage, res.statusCode));
    return next();
  });
};

// Get container info
SelectelCloudstorage.prototype.getContainerInfo = function(name, next) {
  if (typeof name == 'function') next = name;
  if (typeof name !== 'string') return next(new CloudError('Bad request. Not set container name'), 400);
  request({
    "method": "HEAD",
    "url": this.storageUrl + name,
    "headers": {
      "X-Auth-Token": this.authToken
    }
  }, function(err, res, body) {
    console.log('getContainerList', res.statusCode, res.statusMessage, res.headers, body);
    if (err) return next(err);
    if (res.statusCode == 403) return next(new CloudError(res.statusMessage, res.statusCode));
    var containerInfo = {};
    for (var header in res.headers) {
      if (!header.search(/^x-container-/)) containerInfo[header.replace('x-container-', '')] = res.headers[header];
    }
    return next(null, containerInfo);
  });
};

// Delete container
SelectelCloudstorage.prototype.deleteContainer = function(name, next) {
  if (typeof name == 'function') next = name;
  if (typeof name !== 'string') return next(new CloudError('Bad request. Not set container name'), 400);
  request({
    "method": "DELETE",
    "url": this.storageUrl + name,
    "headers": {
      "X-Auth-Token": this.authToken
    }
  }, function(err, res, body) {
    if (err) return next(err);
    switch (res.statusCode) {
      case 403:
      case 404:
      case 409:
        return next(new CloudError(res.statusMessage, res.statusCode));
    }
    return next();
  });
};

SelectelCloudstorage.prototype.getContainerFiles = function(opts, next) {
  switch (typeof opts) {
    case 'string':
      opts = {
        name: opts,
        format: 'json'
      };
      break;
    case 'function':
      next = opts;
    case 'object':
      if (opts.name && typeof opts.name == 'string') break;
    default:
      return next(new CloudError('Bad request. Not set container name', 400));
  }
  var storageUrl = this.storageUrl + opts.name;
  storageUrl += (Object.keys(opts).length > 1) ? '?' : '';
  storageUrl += (opts.format) ? 'format=' + opts.format + '&' : '';
  storageUrl += (opts.limit) ? 'limit=' + opts.limit + '&' : '';
  storageUrl += (opts.prefix) ? 'prefix=' + opts.prefix + '&' : '';
  storageUrl += (opts.path) ? 'path=' + opts.path + '&' : '';
  storageUrl += (opts.delimiter) ? 'delimiter=' + opts.delimiter + '&' : '';
  console.log(storageUrl);
  request({
    "method": "GET",
    "url": storageUrl,
    "headers": {
      "X-Auth-Token": this.authToken
    }
  }, function(err, res, body) {
    if (err) return next(err);
    body = (opts.format == 'json') ? JSON.parse(body) : body;
    switch (res.statusCode) {
      case 403:
      case 404:
        return next(new CloudError(res.statusMessage, res.statusCode));
    }
    return next(null, body);
  });
};


SelectelCloudstorage.prototype.downloadFile = function(pathToFile, cb) {
  if (typeof pathToFile == 'function') {
    cb = pathToFile;
    return cb(new Error('Not set or invalid container name'));
  }
  var options = {
    "method": "GET",
    "url": this.storageUrl + pathToFile,
    "headers": {
      "X-Auth-Token": this.authToken
    }
  };
  request(options, function(err, res, body) {
    //console.log('downloadFile', res.statusCode, res.statusMessage, res.headers, body);
    if (err) return cb(err);

    //console.log(res);
    return cb(null, res.body);
  });
};



SelectelCloudstorage.prototype.uploadFile = function(opts, next) {
  _this = this;
  if (typeof opts == 'function') {
    next = opts;
    return next(new Error('Not set or invalid container name'));
  }
  var file;
  async.series([
    function(cb) {
      fs.readFile(opts.file, function(err, _file) {
        if (err) return cb(err);
        file = _file;
        return cb();
      });
    },
  ], function(err) {
    var options = {
      "method": "PUT",
      "url": _this.storageUrl + opts.pathToFile,
      "headers": {
        "X-Auth-Token": _this.authToken,
        'Content-Length': fs.statSync(opts.file).size
      },
      body: file
    };
    request(options, function(err, res, body) {
      //console.log('uploadFile', options, res, body);
      if (err) return next(err);
      return next(null, body);
    });
  });
};

module.exports = SelectelCloudstorage;