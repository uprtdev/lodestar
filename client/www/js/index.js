window.onerror = function (msg, url, lineNo, columnNo, errorObj) {
  var file = url.substring(url.lastIndexOf('/') + 1)
  var message = '[' + file + '] ' + lineNo + '.' + columnNo + ' : ' + msg.toString()
  this.alert(message)
}

function onDeviceReady () {
  var updater = new StatusUpdater()
  var sender = new NetworkSender('tcp://xxx.xxx.com', 1883, updater, undefined, undefined)
  var observer = new LocationObserver(sender, updater)

  sender.connect()
  observer.initialize()

  cordova.plugins.backgroundMode.setDefaults({
    title: 'Rednoize Radar v1.3',
    text: 'This app should be foreground to work correctly',
    color: 'F14F4D'
  })

  cordova.plugins.backgroundMode.enable()
  cordova.plugins.backgroundMode.overrideBackButton()

  window.powerManagement.acquire(function () {
    console.log('Wakelock acquired')
  }, function () {
    console.log('Failed to acquire wakelock')
  })
  window.powerManagement.setReleaseOnPause(false, function () {
    console.log('Set successfully')
  }, function () {
    console.log('Failed to set')
  })
  window.plugins.insomnia.keepAwake()

  cordova.plugins.backgroundMode.on('activate', function () {
    cordova.plugins.backgroundMode.disableWebViewOptimizations()
    window.plugins.insomnia.keepAwake()
  })
  cordova.plugins.backgroundMode.on('deactivate', function () {})
};

var LocationObserver = function (networkSender, stateUpdater) {
  var self = this
  this.networkSender = networkSender
  this.stateUpdater = stateUpdater
  this.updateTimeout = null
  this.lastUpdate = null

  this.initialize = function () {
    self.watchId = navigator.geolocation.watchPosition(self.trackLoc,
      self.errLoc, {
        maximumAge: 3000,
        timeout: 5000,
        enableHighAccuracy: true
      })
    self.restartUpdateTimeout()
  }

  this.trackLoc = function (position) {
    var kphSpeed = position.coords.speed * 3600 / 1000
    var newGeoData = {
      lat: position.coords.latitude,
      lon: position.coords.longitude,
      spd: Math.round(kphSpeed * 10) / 10,
      acc: Math.round(position.coords.accuracy * 10) / 10,
      tm: position.timestamp,
      working: true,
      error: ''
    }

    if (newGeoData.tm !== self.lastUpdate) {
      self.stateUpdater.updateGeo(newGeoData)
      self.networkSender.sendData(newGeoData)
      self.lastUpdate = newGeoData.tm
    };

    self.restartUpdateTimeout()
  }

  this.errLoc = function (error) {
    self.stateUpdater.updateGeo({
      error: error.message
    })
    self.stateUpdater.updateGeo({
      working: false
    })
    self.networkSender.sendData({
      working: false
    })
    self.restartUpdateTimeout()
  }

  this.restartUpdateTimeout = function () {
    if (self.updateTimeout) { clearTimeout(self.updateTimeout) }
    self.updateTimeout = setTimeout(self.forceUpdate, 5000)
  }

  this.forceUpdate = function () {
    console.log('Waiting for GPS data for a long time, lets try in a more aggressive way...')
    navigator.geolocation.getCurrentPosition(self.trackLoc,
      self.errLoc, {
        maximumAge: 3000,
        timeout: 3000,
        enableHighAccuracy: true
      })
    self.restartUpdateTimeout()
  }
}

var StatusUpdater = function () {
  var self = this

  this.net = {
    connect: false,
    error: '',
    sent: 0,
    listeners: null
  }
  this.geo = {
    working: false,
    error: '',
    lat: 0,
    lon: 0,
    spd: 0,
    acc: 0,
    tm: null
  }

  new Vue({
    el: '#container',
    data: {
      net: self.net,
      geo: self.geo
    }
  })

  this.updateNet = function (newState) {
    var sent = self.net.sent
    Object.assign(self.net, newState)
    if (newState.sent) { self.net.sent += sent }
  }

  this.updateGeo = function (newState) {
    Object.assign(self.geo, newState)
  }
}

var NetworkSender = function (addr, port, stateUpdater, clientId, uname, upass) {
  var self = this
  this.socketId = null
  this.addr = addr
  this.port = port
  this.stateUpdater = stateUpdater
  this.sentTime = null
  this.sentCounter = 0
  this.uname = uname
  this.upass = upass
  this.clientId = clientId

  this.lastDataUpdate = null
  this.dataUpdatesAvgInterval = 0
  this.lastPacket = null
  this.lastPacketSeq = 0

  this.pbRoot = null
  protobuf.load('protobuf/navi.proto', function (err, root) {
    if (err) {
      throw err
    } else {
      self.pbRoot = root
      self.clientMessage = root.lookupType('DataUpdateMessageToClient')
    }
  })

  this.connect = function () {
    console.log('Connecting...')
    try {
      cordova.plugins.CordovaMqTTPlugin.connect({
        url: self.addr,
        port: self.port,
        wsPort: 9001,
        clientId: self.clientId,
        connectionTimeout: 3000,
        reconnect: true,
        isBinaryPayload: false,
        username: self.uname,
        password: self.upass,
        keepAlive: 10,
        success: function (s) {
          self.stateUpdater.updateNet({
            connect: true,
            error: ''
          })
          cordova.plugins.CordovaMqTTPlugin.listen('$SYS/broker/clients/connected', function (payload, params) {
            var listeners = parseInt(payload, 10) - 1
            self.stateUpdater.updateNet({
              listeners: listeners
            })
          })
          cordova.plugins.CordovaMqTTPlugin.subscribe({
            topic: '$SYS/broker/clients/connected',
            qos: 0,
            success: function (s) {},
            error: function (e) {}
          })
        },
        error: function (e) {
          console.log('Connection error', e)
          self.stateUpdater.updateNet({
            connect: false,
            error: JSON.stringify(e)
          })
          setTimeout(self.connect, 1000)
        },
        onConnectionLost: function () {
          console.log('Connection lost')
          self.stateUpdater.updateNet({
            error: 'Connection lost',
            connect: false
          })
        }
      })
    } catch (err) {
      self.stateUpdater.updateNet({
        connect: false,
        error: err
      })
      setTimeout(self.connect, 1000)
    }
  }

  this.sendData = function (newGeoData) {
    if (self.lastDataUpdate) { self.dataUpdatesAvgInterval = (new Date().getTime() - self.lastDataUpdate + self.dataUpdatesAvgInterval) / (self.dataUpdatesAvgInterval ? 2 : 1) }
    self.lastDataUpdate = new Date().getTime()

    var carId = 1
    var data = {
      lon: newGeoData.working ? newGeoData.lon : 0,
      lat: newGeoData.working ? newGeoData.lat : 0,
      spd: newGeoData.working ? Math.trunc(newGeoData.spd) : 0,
      c: carId,
      seq: self.sentCounter,
      q: newGeoData.working ? 0 : 1
    }

    var err = self.clientMessage.verify(data)
    if (err) {
      alert(err)
    } else {
      var buffer = self.clientMessage.encode(data).finish().slice().buffer
      self.sendPacket(buffer)
    }
  }

  this.sendPacket = function (buffer) {
    try {
      cordova.plugins.CordovaMqTTPlugin.publish({
        topic: 'Pos',
        payload: buffer,
        qos: 0,
        retain: false,
        success: function (s) {
          self.stateUpdater.updateNet({
            sent: 1,
            error: ''
          })
        },
        error: function (e) {
          self.stateUpdater.updateNet({
            error: e
          })
        }
      })
      self.sentCounter++
    } catch (err) {
      self.stateUpdater.updateNet({
        connect: false,
        error: err
      })
      alert(err)
    }
    self.sentTime = new Date()
  }
}

document.addEventListener('deviceready', onDeviceReady, false)
