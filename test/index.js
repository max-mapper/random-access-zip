var Dat = require('dat-js')

var hyperdrive = require('hyperdrive')
var level = require('level')
var raz = require('../index.js')
var db = level('./.dat')
var drive = hyperdrive(db)
var zip = raz('./cool.txt.zip')

var link = new Buffer('43af32eddbbc5dfc01fd69503e51589329a43145bcc79a7e704066cb38923915', 'hex')
var archive = drive.createArchive(link, {
  file: function (name) {
    return zip.get(name)
  }
})

archive.get(0, function (err, entry) { // get the first file entry
  var stream = archive.createFileReadStream(entry)
  stream.on('data', function (data) {
    console.log(data)
  })
})
