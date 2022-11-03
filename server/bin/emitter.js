'use strict'
const ws = require('ws')
class Emitter {
  constructor (port) {
    this.server = new ws.Server({
      port: port
    })
    this.seqCounter = 0
    this.activeUsers = 0
    this.timeoutTimer = null
    this.server.on('connection', (ws) => { this.handleConnect(ws) })
    this.resetTimeout()
    console.log(`Emitter listening on ${port}`)
  }

  resetTimeout () {
    const dataTimeout = 10000
    const emptyPosition = {
      lon: 0,
      lat: 0,
      spd: 0,
      c: 1,
      q: 2
    }
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer)
    }
    this.timeoutTimer = setTimeout(() => {
      this.broadcast(emptyPosition)
      this.resetTimeout()
    }, dataTimeout)
  }

  encodeData (data) {
    const fullPacket = (data.q === 0)
    let buffer = null
    if (fullPacket) {
      buffer = new ArrayBuffer(11)
    } else {
      buffer = new ArrayBuffer(2)
    }
    const view = new DataView(buffer)
    view.setUint8(0, data.q)
    view.setUint8(1, data.c)
    if (fullPacket) {
      view.setFloat32(2, data.lon)
      view.setFloat32(6, data.lat)
      view.setUint8(10, data.spd)
    }
    this.seqCounter++
    return buffer
  }

  broadcast (data) {
    const encodedData = this.encodeData(data)
    this.server.clients.forEach((client) => {
      if (client.readyState === ws.OPEN) {
        client.send(encodedData)
      }
    })
    this.resetTimeout()
  }

  handleConnect (socket) {
    this.activeUsers++
    console.log(`${new Date().toString()} : user connected [${this.activeUsers} active]`)
    socket.binaryType = 'arraybuffer'
    socket.on('close', () => {
      this.activeUsers--
      console.log(`${new Date().toString()} : user disconnected [${this.activeUsers} active]`)
    })
  }
}

module.exports = Emitter
