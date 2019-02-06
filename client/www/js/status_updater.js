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
