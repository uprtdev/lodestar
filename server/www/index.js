const connectURL = (window.location.protocol != "https:" ? "ws://" : "wss://") + location.hostname + "/ws"

window.addEventListener('load', function (event) {
  console.log('Rednoize Web Radar, v2.2.1')
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

  const mapsUrl = '/tiles/{s}/{z}/{x}/{y}'
  var MapBox = L.tileLayer(mapsUrl, {
    maxZoom: 19,
    minZoom: 16,
// You may need to uncomment this if you are using Mapbox tiles and text labels are very small
//    tileSize: 1024,
//    zoomOffset: -2,
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
            '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
    id: 'mapbox.streets'
  })

  var LeafIcon = L.Icon.extend({
    options: {
      iconSize: [48, 48]
    }
  })

  var carIconB = new LeafIcon({
    iconUrl: 'target-b.png'
  })
  var carIconG = new LeafIcon({
    iconUrl: 'target-g.png'
  })

  this.map = L.map(mapDiv).setView(defaultCoords, 18)
  this.marker = L.marker([0, 0], {
    icon: carIconB
  }).addTo(this.map)
  this.markerG = L.marker([0, 0], {
    icon: carIconG
  }).addTo(this.map)

  MapBox.addTo(this.map)
}
