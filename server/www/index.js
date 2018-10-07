document.addEventListener('DOMContentLoaded', function (event) {
  console.log('Rednoize Web Radar, v1.3')
  var map = new TrackingMap('mapid', [54.744773, 55.988830])
  var updater = new DataUpdater(map, document.getElementById('info'))
  var listener = new ServerListener('xxx.xxx.com', 9001,
    updater.showConnected,
    updater.updateData,
    updater.showConnectError)
  listener.connect()
})

function TrackingMap (mapDiv, defaultCoords) {
  console.log('Creating map...')

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
        self.infoDiv.innerHTML = '- долгота: ' + Math.round(self.lastData.coords.lon * 100000) / 100000 + /* longtitude */
                ', <br/>- широта: ' + Math.round(self.lastData.coords.lat * 100000) / 100000 + /* latitude */
                ', <br/>- скорость: ' + self.lastData.coords.spd + ' км/ч, <br/>- обновлено: ' + fromUpd /* speed; last update */
        self.map.map.setView([self.lastData.coords.lon, self.lastData.coords.lat], map.map.getZoom())
      }
    } else {
      self.map.marker.setLatLng([0, 0])
      self.map.markerG.setLatLng([0, 0])
      if (self.lastData && self.lastData.state.isAgentOnline) { self.infoDiv.innerHTML = 'Ожидаем данные местоположения от объекта...<br/><br/><br/>' } /* waiting for data from the object */
      else { self.infoDiv.innerHTML = 'Ожидаем установления связи с объектом...<br/><br/><br/>' } /* waiting for establishing connection with the object */
    }
  }
};

function ServerListener (url, port, onconnect, ondata, onerror) {
  this.timeoutTimer = null
  this.url = url
  this.port = port

  var self = this

  var clientId = 'brwsr' + parseInt(Math.random() * 1000000, 10)
  this.client = new Paho.Client(this.url, Number(this.port), clientId)

  this.decodeData = function (data) {
    var parsedData = null
    try {
      var view = protobuf.roots.default.DataUpdateMessageToClient.decode(data)
      var coords = {
        lat: view.lon,
        lon: view.lat,
        spd: view.spd,
        seq: view.seq
      }
      var state = {
        updated: new Date(),
        isValid: view.q === 0,
        isAgentOnline: view.q === 0 || view.q === 2
      }
      parsedData = {
        coords: coords,
        state: state
      }
    } catch (e) {
      console.log(e)
    }
    return parsedData
  }

  this.client.onConnectionLost = function (responseObject) {
    console.log('Connection lost')
    console.log('Code: ' + responseObject.errorCode + ' reason: ' + responseObject.errorMessage)
    onerror()
  }

  this.client.onMessageArrived = function (message) {
    console.log(message.payloadBytes)
    if (message.payloadBytes !== undefined) {
      var data = self.decodeData(new Uint8Array(message.payloadBytes))
      if (data) {
        ondata(data)
      }
    }
  }

  this.connect = function () {
    self.client.connect({
      onSuccess: function () {
        console.log('Connection established.')
        onconnect()
        self.client.subscribe('Pos')
      },
      onFailure: function (context, errorCode, errorMessage) {
        console.log(errorMessage + ' (' + errorCode + ')')
      },
      mqttVersion: 4,
      reconnect: true,
      keepAliveInterval: 10
    })
  }
};
