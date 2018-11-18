window.lastErrors = []
window.onerror = function (msg, url, lineNo, columnNo, errorObj) {
  var file = url.substring(url.lastIndexOf('/') + 1)
  var message = '[' + file + '] ' + lineNo + '.' + columnNo + ' : ' + msg.toString()
  window.lastErrors.push(message)
}

function startTheDance (config) {
  var updater = new StatusUpdater()
  var sender = new NetworkSender(config.addr, config.port, updater, config.id)
  var observer = new LocationObserver(sender, updater)

  sender.connect()
  observer.initialize()

  cordova.plugins.backgroundMode.setDefaults({
    title: 'Rednoize Radar v2.2',
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
}
function saveAll (config) {
  localStorage.setItem('radarConfig', JSON.stringify(config))
}

function onDeviceReady () {
  var config = localStorage.getItem('radarConfig')
  if (!config) {
    config = {
      addr: 'radar.rednoize.su',
      port: 8090,
      id: 1
    }
  } else {
    config = JSON.parse(config)
  };
  new Vue({
    el: '#initialView',
    data: {
      config: config,
      settsOpen: true,
      hidePreloader: true
    },
    methods: {
      save: saveAll.bind(this, config),
      start: startTheDance.bind(this, config)
    }
  })
}

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
    received: 0,
    retr: 0,
    observers: null
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
    el: '#workingView',
    data: {
      net: self.net,
      geo: self.geo,
      errs: window.lastErrors,
      started: true
    }
  })

  this.updateNet = function (newState) {
    var received = self.net.received
    var sent = self.net.sent
    var retr = self.net.retr
    Object.assign(self.net, newState)
    if (newState.received) { self.net.received += received }
    if (newState.sent) { self.net.sent += sent }
    if (newState.retr) { self.net.retr += retr }
  }

  this.updateGeo = function (newState) {
    Object.assign(self.geo, newState)
  }
}

var NetworkSender = function (addr, port, stateUpdater, id) {
  var self = this
  this.socketId = null
  this.addr = addr
  this.port = port
  this.stateUpdater = stateUpdater
  this.sentTime = null
  this.sentCounter = 0

  this.carId = id

  self.maxRetrsPerPeriod = 3

  this.retransmitTimer = null
  this.retransmitTimeout = null

  this.lastDataUpdate = null
  this.dataUpdatesAvgInterval = 0
  this.lastPing = null
  this.pingAvg = 0
  this.lastPacket = null
  this.lastPacketSeq = 0

  this.connect = function () {
    chrome.sockets.udp.create({}, function callback (i) {
      self.socketId = i.socketId
      chrome.sockets.udp.bind(i.socketId, '0.0.0.0', 0, function callback (r) {
        if (r === 0) {
          self.stateUpdater.updateNet({
            connect: true,
            error: ''
          })
        } else {
          self.stateUpdater.updateNet({
            connect: false,
            error: r.result
          })
        }
      })
    })

    chrome.sockets.udp.onReceive.addListener(function (i) {
      var ping = null
      var view = new DataView(i.data)
      var data = {
        seq: view.getUint8(0),
        w: view.getUint8(1)
      }
      if (data.seq === (self.lastPacketSeq % 255)) {
        self.cancelRetransmitTimer()
        ping = new Date().getTime() - self.sentTime.getTime()
        if (self.lastPing) { self.pingAvg = (self.lastPing + ping) / 2 }
        self.lastPing = ping
      }
      self.stateUpdater.updateNet({
        connect: true,
        error: '',
        received: 1,
        ping: ping,
        observers: data.w
      })
    })

    chrome.sockets.udp.onReceiveError.addListener(function (r) {
      self.stateUpdater.updateNet({
        error: r.result,
        connect: false
      })
      chrome.sockets.udp.setPaused(self.socketId, false)
    })
  }

  this.sendData = function (newGeoData) {
    if (self.lastDataUpdate) { self.dataUpdatesAvgInterval = (new Date().getTime() - self.lastDataUpdate + self.dataUpdatesAvgInterval) / (self.dataUpdatesAvgInterval ? 2 : 1) }
    self.lastDataUpdate = new Date().getTime()
    self.stateUpdater.updateNet({
      retr: 0
    })

    var data = {
      lon: newGeoData.lon,
      lat: newGeoData.lat,
      spd: Math.trunc(newGeoData.spd),
      q: newGeoData.working ? 0 : 1

    }

    var fullPacket = (data.q === 0)
    var buffer = null
    if (fullPacket) {
      buffer = new ArrayBuffer(13)
    } else {
      buffer = buffer = new ArrayBuffer(4)
    }

    var view = new DataView(buffer)

    view.setUint8(0, data.q)
    view.setUint8(1, self.carId)
    view.setUint16(2, self.sentCounter, false)
    if (fullPacket) {
      view.setFloat32(4, data.lon, false)
      view.setFloat32(8, data.lat, false)
      view.setUint8(12, data.spd)
    }
    self.lastPacket = buffer
    self.lastPacketSeq = self.sentCounter
    self.sendPacket(buffer)
  }

  this.sendPacket = function (buffer) {
    if (self.socketId !== null) {
      chrome.sockets.udp.send(self.socketId, buffer, self.addr, self.port, function (r) {
        if (r.resultCode === 0) {
          self.sentCounter++
          self.stateUpdater.updateNet({
            sent: 1,
            error: '',
            connect: true
          })
          self.resetRetransmitTimer()
        } else {
          self.stateUpdater.updateNet({
            error: r.resultCode,
            connect: false
          })
        }
      })
      self.sentTime = new Date()
    }
  }

  this.retransmit = function () {
    if (self.lastPacket) { self.sendPacket(self.lastPacket) }
  }

  this.cancelRetransmitTimer = function () {
    if (self.retransmitTimer) { clearTimeout(self.retransmitTimer) }
  }

  this.resetRetransmitTimer = function () {
    self.cancelRetransmitTimer()
    if (self.dataUpdatesAvgInterval > 0 && self.pingAvg > 0) {
      var now = new Date().getTime()
      var left = self.dataUpdatesAvgInterval - (now - self.lastDataUpdate)
      var timeout = Math.max(self.dataUpdatesAvgInterval / self.maxRetrsPerPeriod, self.pingAvg)
      if (left > timeout) {
        self.retransmitTimer = setTimeout(function () {
          self.stateUpdater.updateNet({
            retr: 1
          })
          self.retransmit()
        }, timeout)
      }
    }
  }
}

document.addEventListener('deviceready', onDeviceReady, false)
