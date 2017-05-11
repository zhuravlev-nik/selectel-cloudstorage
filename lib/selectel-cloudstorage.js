'use strict';

const request = require('request'),
  async = require('async'),
  fs = require('fs'),
  CloudError = require('./selectel-clouderror.js');


// Storage constructor (set options and connect)
let SelectelCloudStorage = function(opts) {
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
SelectelCloudStorage.prototype.selfAuth = function(next) {
  let _this = this;
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
SelectelCloudStorage.prototype.getStorageInfo = function(next) {
  request({
    "method": "HEAD",
    "url": this.storageUrl,
    "headers": {
      "X-Auth-Token": this.authToken
    }
  }, function(err, res, body) {
    if (err) return next(err);
    if (res.statusCode !== 204) return next(new CloudError(res.statusMessage, res.statusCode));
    let info = {
      bytesUsed: res.headers['x-account-bytes-used'] || null,
      containersCount: res.headers['x-account-container-count'] || null,
      objectsCount: res.headers['x-account-object-count'] || null
    };
    return next(null, info);
  });
};

// Get containers list 
SelectelCloudStorage.prototype.getContainerList = function(opts, next) {
  if (typeof opts == 'function') next = opts;
  if (typeof opts !== 'object') opts = {
    format: 'json'
  };
  let storageUrl = this.storageUrl;
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
SelectelCloudStorage.prototype.createContainer = function(opts, next) {
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
      return next(new CloudError('Bad request. New container name error', 400));
  }
  let options = {
    "method": "PUT",
    "url": this.storageUrl + opts.name,
    "headers": {
      "X-Auth-Token": this.authToken
    }
  };
  if (opts.type) options.headers['X-Container-Meta-Type'] = opts.type;
  if (opts.headers && typeof opts.headers == 'object') {
    for (let name in opts.headers) {
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
SelectelCloudStorage.prototype.getContainerInfo = function(name, next) {
  if (typeof name == 'function') next = name;
  if (typeof name !== 'string') return next(new CloudError('Bad request. Not set container name'), 400);
  request({
    "method": "HEAD",
    "url": this.storageUrl + name,
    "headers": {
      "X-Auth-Token": this.authToken
    }
  }, function(err, res, body) {
    if (err) return next(err);
    if (res.statusCode == 403) return next(new CloudError(res.statusMessage, res.statusCode));
    let containerInfo = {};
    for (let header in res.headers) {
      if (!header.search(/^x-container-/)) containerInfo[header.replace('x-container-', '')] = res.headers[header];
    }
    return next(null, containerInfo);
  });
};

// * TODO *
// Container settings update
SelectelCloudStorage.prototype.updateContainer = function(opts, next) {
  return next();
};

// * TODO *
// Convert into gallery
SelectelCloudStorage.prototype.convertIntoGallery = function(next) {
  // this.updateContainer({type:gallery}, function(err){
  //  if(err) return next(err);
  //  return next();
  // })
  return next();
};

// Delete container
SelectelCloudStorage.prototype.deleteContainer = function(name, next) {
  //let args = Array.from(arguments);
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

// * TODO *
// Force delete container
SelectelCloudStorage.prototype.deleteContainerForce = function(name, next) {
  let _this = this;
  async.series([
    function(cb) {
      _this.getContainerFiles(function(err, files) {
        if (err) return cb(err);
        return cb();
      });
    },
    function(cb) {
      _this.deleteFile(function(err) {
        if (err) return cb(err);
        return cb();
      });
    },
    function(cb) {
      _this.deleteContainer(name, function(err) {
        if (err) return cb(err);
        return cb();
      });
    }
  ], function(err) {
    if (err) return next(err);
    return next();
  });
};

// Get container files
SelectelCloudStorage.prototype.getContainerFiles = function(opts, next) {
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
  let storageUrl = this.storageUrl + opts.name;
  storageUrl += (Object.keys(opts).length > 1) ? '?' : '';
  storageUrl += (opts.format) ? 'format=' + opts.format + '&' : '';
  storageUrl += (opts.limit) ? 'limit=' + opts.limit + '&' : '';
  storageUrl += (opts.prefix) ? 'prefix=' + opts.prefix + '&' : '';
  storageUrl += (opts.path) ? 'path=' + opts.path + '&' : '';
  storageUrl += (opts.delimiter) ? 'delimiter=' + opts.delimiter + '&' : '';
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

// * TODO *
// Download file
SelectelCloudStorage.prototype.downloadFile = function(pathToFile, next) {
  if (typeof pathToFile == 'function') {
    next = pathToFile;
    return next(new Error('Not set or invalid container name'));
  }
  request({
    "method": "GET",
    "url": this.storageUrl + pathToFile,
    "headers": {
      "X-Auth-Token": this.authToken
    }
  }, function(err, res, body) {
    if (err) return next(err);
    return next(null, res.body);
  });
};

// * TODO *
// Upload file
SelectelCloudStorage.prototype.uploadFile = function(opts, next) {
  let _this = this;
  if (typeof opts == 'function') {
    next = opts;
    return next(new Error('Not set or invalid container name'));
  }
  let file;
  async.series([
    function(cb) {
      fs.readFile(opts.file, function(err, _file) {
        if (err) return cb(err);
        file = _file;
        return cb();
      });
    },
  ], function(err) {
    console.log(_this.storageUrl + opts.pathToFile, opts.file, fs.statSync(opts.file).size);
    request({
      "method": "PUT",
      "url": _this.storageUrl + opts.pathToFile,
      "headers": {
        "X-Auth-Token": _this.authToken,
        'Content-Length': fs.statSync(opts.file).size
      },
      body: file
    }, function(err, res, body) {
      if (err) return next(err);
      return next(null, body);
    });
  });
};

// * TODO * 
// Archive extracting
SelectelCloudStorage.prototype.extractArchive = function(next) {
  return next();
};

// * TODO * 
// Background archive extracting
SelectelCloudStorage.prototype.extractArchiveBg = function(next) {
  return next();
};

// * TODO *
// Update file meta
SelectelCloudStorage.prototype.updateFile = function(next) {
  return next();
};

// * TODO *
// Copy file
SelectelCloudStorage.prototype.copyFile = function(next) {
  return next();
};

// * TODO * 
// Delete file
SelectelCloudStorage.prototype.deleteFile = function(next) {
  return next();
};

module.exports = SelectelCloudStorage;