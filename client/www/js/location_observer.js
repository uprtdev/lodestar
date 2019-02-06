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
    console.log("Waiting for GPS data for a long time, let's try in a more aggressive way...")
    navigator.geolocation.getCurrentPosition(self.trackLoc,
      self.errLoc, {
        maximumAge: 3000,
        timeout: 3000,
        enableHighAccuracy: true
      })
    self.restartUpdateTimeout()
  }
}
