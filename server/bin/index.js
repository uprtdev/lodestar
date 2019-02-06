'use strict'
const emitterPort = 8089
const receiverPort = 8090

const Emitter = require('./emitter')
const Receiver = require('./receiver')

const emitter = new Emitter(emitterPort)
const receiver = new Receiver(emitter, receiverPort)

process.once('SIGINT', () => {
  console.log(new Date().toString() + ' SIGINT received...')
  process.exit()
})

process.once('SIGTERM',() => {
  // Actually, don't think we really will be alive for this time
  console.log(new Date().toString() + ' SIGTERM received...')
  process.exit()
})
