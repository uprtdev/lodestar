const connectURL = 'ws://somedomain.org/ws' // in case of running without reverse-proxy, it could be like 'ws://somedomain.org:8089'

window.addEventListener('load', function (event) {
  console.log('Rednoize Web Radar, v2.2')
  var map = new TrackingMap('mapid', [54.744773, 55.988830])
  var updater = new DataUpdater(map, document.getElementById('info'))
  var listener = new ServerListener(connectURL,
    updater.showConnected,
    updater.updateData,
    updater.showConnectError)
  listener.connect()
})

function TrackingMap (mapDiv, defaultCoords) {
  console.log('Creating map...')

  const mapsUrl = '/tiles/{id}/{z}/{x}/{y}.png32' // use this for local-cached mapbox
  // const mapsUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' // use this for default maps from OSM servers
  var MapBox = L.tileLayer(mapsUrl, {
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
