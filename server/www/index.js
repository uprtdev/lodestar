document.addEventListener('DOMContentLoaded', function (event) {
  console.log('Rednoize Web Radar, v2.2')
  console.log('Данный говнокод был набросан Кириллом в обеденный перерыв на работе во имя процветания уфимского энкаунтера ^_^')
  var map = new TrackingMap('mapid', [54.744773, 55.988830])
  var updater = new DataUpdater(map, document.getElementById('info'))
  var listener = new ServerListener('ws://somedomain.org/ws',
    updater.showConnected,
    updater.updateData,
    updater.showConnectError)
  listener.connect()
})

function TrackingMap (mapDiv, defaultCoords) {
  console.log('Создаем карту...')

  var MapBox = L.tileLayer('/tiles/{id}/{z}/{x}/{y}.png32', {
    maxZoom: 18,
    minZoom: 15,
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
            '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
            'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    id: 'mapbox.streets'
  })

  var LeafIcon = L.Icon.extend({
    options: {
      iconSize: [32, 32]
    }
  })

  var carIconB = new LeafIcon({
    iconUrl: 'target-b.png'
  })
  var carIconG = new LeafIcon({
    iconUrl: 'target-g.png'
  })

  this.map = L.map(mapDiv).setView(defaultCoords, 17)
  this.marker = L.marker([0, 0], {
    icon: carIconB
  }).addTo(this.map)
  this.markerG = L.marker([0, 0], {
    icon: carIconG
  }).addTo(this.map)

  MapBox.addTo(this.map)
}

function DataUpdater (map, infoDiv) {
  this.lastData = {}
  this.isFresh = false
  this.isShowing = false
  this.map = map
  this.infoDiv = infoDiv
  this.silenceTimer = null

  var self = this

  this.showConnected = function () {
    infoDiv.innerHTML = 'Соединение установлено!'
  }

  this.showConnectError = function () {
    infoDiv.innerHTML = 'Проблемы с соединением :('
  }

  this.markInactive = function () {
    self.isFresh = false
    self.updateData()
  }

  this.restartSilenceTimer = function () {
    if (self.silenceTimer) { clearTimeout(self.silenceTimer) }
    self.silenceTimer = setTimeout(self.silenceTimerStep1, 3000)
  }

  this.silenceTimerStep1 = function () {
    self.isFresh = false
    self.updateData()
    self.silenceTimer = setTimeout(self.silenceTimerStep2, 7000)
  }

  this.silenceTimerStep2 = function () {
    self.isShowing = false
    self.updateData()
  }

  this.updateData = function (newData) {
    if (newData) {
      self.lastData.state = newData.state
      if (newData.state.isValid) {
        self.lastData.coords = newData.coords
        self.isFresh = true
        self.isShowing = true
        self.restartSilenceTimer()
      }
    }

    var fromUpd = self.lastData.state.updated.toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, '$1')

    if (self.isShowing) {
      if (self.isFresh) {
        map.markerG.setLatLng([0, 0])
        if (self.lastData.coords) { map.marker.setLatLng([self.lastData.coords.lon, self.lastData.coords.lat]) }
      } else {
        map.marker.setLatLng([0, 0])
        if (self.lastData.coords) { map.markerG.setLatLng([self.lastData.coords.lon, self.lastData.coords.lat]) }
      }
      if (self.lastData.state.isValid) {
        self.infoDiv.innerHTML = '- долгота: ' + Math.round(self.lastData.coords.lon * 100000) / 100000 + ', <br/>- широта: ' + Math.round(self.lastData.coords.lat * 100000) / 100000 + ', <br/><!-- - скорость: ' + self.lastData.coords.spd + ' км/ч, <br/> -->- обновлено: ' + fromUpd
        self.map.map.setView([self.lastData.coords.lon, self.lastData.coords.lat], map.map.getZoom())
      }
    } else {
      self.map.marker.setLatLng([0, 0])
      self.map.markerG.setLatLng([0, 0])
      if (self.lastData && self.lastData.state.isAgentOnline) { self.infoDiv.innerHTML = 'Ожидаем данные местоположения от объекта...<br/><br/><br/>' } else { self.infoDiv.innerHTML = 'Ожидаем установления связи с объектом...<br/><br/><br/>' }
    }
  }
};

function ServerListener (url, onconnect, ondata, onerror) {
  this.timeoutTimer = null
  this.socket = null
  this.url = url

  var self = this

  this.decodeData = function (data) {
    var view = new DataView(data)
    var coords = {
      lat: view.getFloat32(0, false),
      lon: view.getFloat32(4, false),
      spd: view.getUint8(8),
      q: view.getUint8(10),
      seq: view.getUint16(11, false)
    }
    var state = {
      updated: new Date(),
      isValid: coords.q === 0,
      isAgentOnline: coords.q === 0 || coords.q === 1
    }
    var parsedData = {
      coords: coords,
      state: state
    }
    return parsedData
  }

  this.clearNoDataTimeout = function () {
    if (self.timeoutTimer) { clearTimeout(self.timeoutTimer) }
  }

  this.setNoDataTimeout = function () {
    self.clearNoDataTimeout()
    self.timeoutTimer = setTimeout(() => self.socket.close(), 12500)
  }

  this.connect = function () {
    self.socket = new WebSocket(self.url)
    self.socket.binaryType = 'arraybuffer'

    self.socket.onopen = function () {
      console.log('Соединение установлено.')
      onconnect()
      self.setNoDataTimeout()
    }

    self.socket.onclose = function (event) {
      if (event.wasClean) {
        console.log('Соединение закрыто чисто')
      } else {
        console.log('Обрыв соединения')
      }
      console.log('Код: ' + event.code + ' причина: ' + event.reason)
      onerror()
      setTimeout(self.connect, 1000)
      self.clearNoDataTimeout()
    }
    self.socket.onmessage = function (event) {
      var data = self.decodeData(event.data)
      console.log(JSON.stringify(data))
      self.setNoDataTimeout()
      ondata(data)
    }
  }
};
