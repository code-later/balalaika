var express = require('express')
  , app = express.createServer()
  , io = require('socket.io').listen(app)
  , http = require("http")
  , fs = require("fs")
  , _ = require("underscore")
  , Email = require("./lib/email").Email

app.configure(function() {
  app.use(express.bodyParser())
  app.use(app.router)
  app.use(express.static(__dirname + "/public"))
})

var couchdb_default_options = {
  host: "localhost",
  port: 5984,
  method: "GET",
  headers: {
    "Content-Type": "application/json"
  }
}

var config = JSON.parse(fs.readFileSync("config/development.json", "utf8"))

function couchdb_request(options, data, cb) {
  if (typeof data === 'function') {
    cb = data
    data = undefined
  }
  else {
    if (typeof data !== "string") data = JSON.stringify(data)
  }

  return http.request(_.defaults(options, couchdb_default_options), function (res) {
    var body = ""
    res.on("data", function (chunk) { body += chunk })
    res.on("end", function() {
      var parsed_response = JSON.parse(body)

      cb(undefined, parsed_response)
    })
  }).end(data)
}

function map_couchdb_document(doc) {
  doc.id = doc._id
  doc.rev = doc._rev

  return doc
}

function send_response(socket, response_id, payload) {
  socket.emit("response", {
    header: {response_id: response_id},
    payload: payload
  })

  return socket
}

var issues = io.of("/issues").on('connection', function (socket) {

  setInterval(function() {
    email.fetch(function(headers, body) {
      var model = {
        subject: headers.subject,
        description: body.bodyText,
        reporter: headers.addressesFrom[0],
        created_at: new Date(headers.messageDate).toJSON(),
        message_id: headers.messageId
      }

      couchdb_request({
        path: "/hotboy_inc_development/",
        method: "POST"
      }, model, function (err, response) {
        console.log("Error: ", err)
        console.log("Response: ", response)

        model.id = response.id
        model.rev = response.rev

        socket.emit("new", {payload: model})
      })
    })
  }, 15000)

  socket.on("read", function (request) {
    var options = {}
      , response_processor

    if (request.payload.id) {
      options = { path: "/hotboy_inc_development/" + request.payload.id }
      response_processor = function (err, doc, cb) {
        cb(map_couchdb_document(doc))
      }
    }
    else {
      options = {path: "/hotboy_inc_development/_design/couchapp/_view/by_created_at?descending=true&include_docs=true"}
      response_processor = function (err, data, cb) {
        cb(data.rows.map(function(row) {
          return map_couchdb_document(row.doc)
        }))
      }
    }

    couchdb_request(options, function(err, data) {
      response_processor(err, data, function(processed_data) {
        send_response(socket, request.header.response_id, processed_data)
      })

    })
  })
})

var email = new Email(config.email)

app.listen(3000)