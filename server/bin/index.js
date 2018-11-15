'use strict'
const ws = require('ws')
const dgram = require('dgram')

process.once('SIGINT', function (code) {
  console.log(new Date().toString() + ' SIGINT received...')
  process.exit()
})

process.once('SIGTERM', function (code) {
  console.log(new Date().toString() + ' SIGINT received...')
  process.exit()
})

const Emitter = function (port) {
  const self = this
  this.server = new ws.Server({
    port: port
  })
  this.seqCounter = 0
  this.activeUsers = 0

  this.timeoutTimer = null

  const dataTimeout = 10000
  const emptyPosition = {
    lon: 0,
    lat: 0,
    spd: 0,
    c: 2
  }

  console.log('Emitter listening on ' + port)

  this.resetTimeout = function () {
    if (self.timeoutTimer) { clearTimeout(self.timeoutTimer) }
    self.timeoutTimer = setTimeout(function () {
      self.broadcast(emptyPosition)
      self.resetTimeout()
    }, dataTimeout)
  }

  this.encodeData = function (data) {
    const buffer = new ArrayBuffer(13)
    const view = new DataView(buffer)
    view.setFloat32(0, data.lon)
    view.setFloat32(4, data.lat)
    view.setUint8(8, data.spd)
    view.setUint8(9, data.c)
    view.setUint8(10, data.q)
    view.setUint16(11, self.seqCounter)
    self.seqCounter++
    return buffer
  }

  this.broadcast = function broadcast (data) {
    const encodedData = self.encodeData(data)
    self.server.clients.forEach(function each (client) {
      if (client.readyState === ws.OPEN) {
        client.send(encodedData)
      }
    })
    self.resetTimeout()
  }

  this.onConnect = function (socket) {
    self.activeUsers++
    console.log(new Date().toString() + ': ' + 'user connected [' + self.activeUsers + ' active]')
    socket.binaryType = 'arraybuffer'
    socket.on('close', function () {
      self.activeUsers--
      console.log(new Date().toString() + ': ' + 'user disconnected [' + self.activeUsers + ' active]')
    })
  }

  this.server.on('connection', self.onConnect)
  this.resetTimeout()
}

const Receiver = function (emitter, port) {
  const self = this
  this.emitter = emitter
  this.server = dgram.createSocket('udp4')
  this.lastReceivedSeq = -1

  this.server.on('listening', function () {
    console.log('UDP Server listening on ' + self.server.address().address + ':' + port)
  })

  this.server.on('message', function (msg, remote) {
    console.log('Message from ' + remote.address + ':' + remote.port + ' - ' + msg.length)
    const data = self.decodeData(msg)
    if (data) {
      if (data.senderSeq > self.lastReceivedSeq) { self.emitter.broadcast(data) }
      self.lastReceivedSeq = data.senderSeq
      const buffer = new Buffer.alloc(2)
      buffer.writeUInt8(data.senderSeq % 0xFF, 0)
      buffer.writeUInt8(emitter.activeUsers > 255 ? 255 : emitter.activeUsers, 1)
      self.server.send(buffer, 0, buffer.length, remote.port, remote.address, function (err, bytes) {
        if (err) console.log('Failed to send reply: ' + err.toString())
      })
    };
  })

  this.server.bind(port, '0.0.0.0')

  this.decodeData = function (view) {
    try {
      const data = {
        lon: view.readFloatBE(0),
        lat: view.readFloatBE(4),
        spd: view.readUInt8(8),
        c: view.readUInt8(9),
        q: view.readUInt8(10),
        senderSeq: view.readUInt16BE(11)
      }

      if (data.q === 0 && (isNaN(data.lon) || isNaN(data.lat))) {
        console.log('Got data from agent, data integrity check failed')
        return null
      }
      return data
    } catch (e) {
      console.log('data is broken: ' + e)
      return null
    }
  }
}

const emitter = new Emitter(8089)
const receiver = new Receiver(emitter, 8090)
