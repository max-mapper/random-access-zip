var yauzl = require('yauzl')
var thunky = require('thunky')
var path = require('path')
var inherits = require('inherits')
var events = require('events')
var through = require('through2')
var pump = require('pump')

module.exports = RandomAccessZip

function RandomAccessZip (zipname, opts, onopen) {
  if (!(this instanceof RandomAccessZip)) return new RandomAccessZip(zipname, opts, onopen)
  if (typeof opts === 'function') {
    onopen = opts
    opts = {}
  }
  if (!opts) opts = {}
  if (!onopen) onopen = noop
  var self = this
  this.zipname = zipname
  this.opened = false
  this.open = thunky(open)
  this.open(onopen)
  this.entries = {}
  
  function open (cb) {
    yauzl.open(zipname, {autoClose: false}, function (err, zipfile) {
      if (err) return cb(err)
      zipfile.on('entry', function (entry) {
        self.entries[entry.fileName] = entry
      })
      zipfile.on('end', function () {
        self.opened = true
        cb()        
      })
      self.zipfile = zipfile
      self.zipfile.on('error', function (err) { throw err })
    })
  }
}

RandomAccessZip.prototype.get = function (filename, options) {
  return new RandomAccessZipEntry(this, filename, options)
}

function RandomAccessZipEntry (zip, filename, options) {
  if (!(this instanceof RandomAccessZipEntry)) return new RandomAccessZipEntry(filename, opts)
  this.zip = zip
  this.filename = filename
  this.readable = true
  this.writable = false
  events.EventEmitter.call(this)
}

inherits(RandomAccessZipEntry, events.EventEmitter)

RandomAccessZipEntry.prototype.read = function (offset, length, cb) {
  if (!this.zip.opened) return openAndRead(this, offset, length, cb)
  if (!this.zip.zipfile.isOpen) return cb(new Error('zip has been closed'))
  var self = this

  if (!length) return cb(null, new Buffer())
  
  var entry = self.zip.entries[self.filename]

  self.zip.zipfile.openReadStream(entry, function (err, readStream) {
    if (err) return cb(err)
    var pos = 0
    var done = false
    var buf = new Buffer(0)
    pump(readStream, through(function (data, enc, next) {
      if (done) return next()
      pos += data.length
      if (pos > offset) {
        if (pos - data.length < offset) {
          data = data.slice(pos, data.length)
        }
        
        buf = Buffer.concat([buf, data])
        
        if (buf.length === length) {
          done = true
          cb(null, buf)
          return next()
        }
        if (buf.length > length) {
          buf = buf.slice(0, length)
          done = true
          cb(null, buf)
          return next()
        }
      }
      next()
    }, function (next) {
      if (!done) cb(null, buf)
      next()
    }))
  })
}

RandomAccessZipEntry.prototype.write = function (offset, buf, cb) {
  return cb(new Error('File is not writable'))
}

RandomAccessZipEntry.prototype.close = function (cb) {
  var self = this
  this.zip.close(function (err) {
    if (err) return cb(err)
    self.emit('close')      
  })
}

RandomAccessZipEntry.prototype.end = function (opts, cb) {
  return cb(new Error('File is not writable'))
}

RandomAccessZipEntry.prototype.unlink = function (cb) {
  return cb(new Error('File is not writable'))
}

function noop () {}

function openAndRead (self, offset, length, cb) {
  self.zip.open(function (err) {
    if (err) return cb(err)
    self.read(offset, length, cb)
  })
}
