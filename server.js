var express = require('express')
  , app = express.createServer()
  , io = require('socket.io').listen(app)
  , http = require("http")

app.configure(function() {
  app.use(express.bodyParser())
  app.use(app.router)
  app.use(express.static(__dirname + "/public"))
})

var id = 0

var issues = io.of("/issues").on('connection', function (socket) {
  socket.on("read", function (request) {
    http.request({
      host: "localhost",
      port: 5984,
      path: "/hotboy_inc_development/_all_docs?include_docs=true",
      method: "GET"
    }, function (res) {
      var body = ""
      res.on("data", function (chunk) { body += chunk })
      res.on("end", function() {
        var parsed_response = JSON.parse(body)

        var payload = parsed_response.rows.map(function(row) {
          var doc = row.doc
          doc.id = doc._id
          doc.rev = doc._rev
          return row.doc
        })

        socket.emit("response", {
          header: {response_id: request.header.response_id},
          payload: payload
        })
      })
    }).end()
  })
})

app.listen(3000)