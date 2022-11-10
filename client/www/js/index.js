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

}
function saveAll (config) {
  localStorage.setItem('radarConfig', JSON.stringify(config))
}

function onDeviceReady () {
  var config = localStorage.getItem('radarConfig')
  if (!config) {
    config = {
      addr: 'somedomain.org',
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

document.addEventListener('deviceready', onDeviceReady, false)
