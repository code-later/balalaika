var express = require('express')
  , app = express.createServer()
  , io = require('socket.io').listen(app)

app.configure(function() {
  app.use(express.bodyParser())
  app.use(app.router)
  app.use(express.static(__dirname + "/public"))
})

var id = 0

var issues = io.of("/issues").on('connection', function (socket) {
  // setInterval(function() {
  //   socket.emit("new", {
  //     id: id++, subject: "New issue " + id
  //   })
  // }, 1500)

  socket.on('get', function (data) {
    
    var response = {
      foo: "bar",
      issue_number: ++id
    }
    
    socket.emit("response", {header: {response_id: data.header.response_id}, payload: response})
  })
})

app.listen(3000)