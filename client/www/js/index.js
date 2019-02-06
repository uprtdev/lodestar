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
