# selectel-cloudstorage

## Usage

Create client object
```js
storage = new SelectelCloudStorage({
  user: <selectel_user_login>
  pass: <password>
});
```

Storage autentification
```js
storage.selfAuth(function(err){
  
});
```
Get storage info
```js
storage.getStorageInfo(function(err, info){
  info = {
    bytesUsed
    containersCount
    objectsCount
  }
});
```

Get storage containet list
```js
getContainerList(function(err, containers))
```
