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
    if (self.socketId != null) {
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
