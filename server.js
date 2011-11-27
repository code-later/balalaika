var express = require('express')
  , app = express.createServer()
  , io = require('socket.io').listen(app)
  , http = require("http")
  , fs = require("fs")
  , crypto = require("crypto")
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

function add_gravatar_to_reporter(reporter) {
  var gravatar_md5 = crypto.createHash("md5")
  reporter.gravatar_md5 = gravatar_md5.update(reporter.address.toLowerCase().trim())
  return reporter
}

function send_response(socket, response_id, payload) {
  socket.emit("response", {
    header: {response_id: response_id},
    payload: payload
  })

  return socket
}

function lookup_issue_by_message_id(headers, callback) {
  var message_id
  if (typeof headers === "string") message_id = headers
  else {
    message_id = _.find(headers.secondary, function(header) {
      return header.name == "references"
    }).value[0].toString()
  }

  couchdb_request({
    path: "http://127.0.0.1:5984/hotboy_inc_development/_design/couchapp/_view/by_message_id?reduce=false&limit=1&include_docs=true&key=%22"+message_id+"%22"
  }, function (err, data) {
    if (err || data.rows.length === 0) callback()
    else callback(data.rows[0].doc)
  })
}

var issues = io.of("/issues").on('connection', function (socket) {

  setInterval(function() {
    email.fetch(function(headers, body) {
      var model = {
        subject: headers.subject,
        description: body.bodyText,
        reporter: add_gravatar_to_reporter(headers.addressesFrom[0]),
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

        var message = ""
        message += "Hey " + model.reporter.name + "! \n"
        message += "Your issue has been created!\n\n"
        message += "http://localhost/4567/issues/"+model.id+"\n\n"
        message += "Kiss,\nFelicia"

        var to = model.reporter.name + " <"+model.reporter.address+">"

        email.send(to, "Issue created!", message, model.message_id, function(err, message){
          if (err) console.log("Error: ", err)
          // if (message) console.log("Message: ", message)
        })
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