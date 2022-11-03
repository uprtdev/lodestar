'use strict'
const dgram = require('dgram')
class Receiver {
  constructor (emitter, port) {
    this.emitter = emitter
    this.server = dgram.createSocket('udp4')
    this.lastReceivedSeq = -1

    this.server.on('listening', () => {
      console.log(`UDP Server listening on ${this.server.address().address} :${port}`)
    })

    this.server.on('message', (msg, remote) => { this.handleMessage(msg, remote) })
    this.server.bind(port, '0.0.0.0')
  }

  handleMessage (msg, remote) {
    const data = this.decodeData(msg)
    if (data) {
      console.log(`Message from ${remote.address} : ${remote.port} ${msg.length} : ${data.c} / ${data.q} / ${data.senderSeq}`)
      if (data.senderSeq > this.lastReceivedSeq) {
        this.emitter.broadcast(data)
      }
      this.lastReceivedSeq = data.senderSeq
      const buffer = new Buffer.alloc(2)
      buffer.writeUInt8(data.senderSeq % 0xFF, 0)
      buffer.writeUInt8(this.emitter.activeUsers > 255 ? 255 : this.emitter.activeUsers, 1)
      this.server.send(buffer, 0, buffer.length, remote.port, remote.address, (err, bytes) => {
        if (err) console.log(`Failed to send reply: ${err.toString()}`)
      })
    } else {
      console.log(`Message from ${remote.address} : ${remote.port} - ${msg.length} : something went wrong`)
    };
  }

  decodeData (buf) {
    try {
      if (buf.length !== 4 && buf.length !== 13) {
        console.log('Got data from agent, wrong packet length!')
        return null
      }

      const q = buf.readUInt8(0)
      let data = null
      if (q === 0) {
        data = {
          q: q,
          c: buf.readUInt8(1),
          lon: buf.readFloatBE(4),
          lat: buf.readFloatBE(8),
          spd: buf.readUInt8(12),
          senderSeq: buf.readUInt16BE(2)
        }
      } else {
        data = {
          lon: null,
          lat: null,
          spd: null,
          q: q,
          c: buf.readUInt8(1),
          senderSeq: buf.readUInt16BE(2)
        }
      }

      if (data.q === 0 && (isNaN(data.lon) || isNaN(data.lat))) {
        console.log('Got data from agent, data integrity check failed')
        return null
      }
      return data
    } catch (e) {
      console.log(`data is broken: ${e}`)
      return null
    }
  }
}

module.exports = Receiver
