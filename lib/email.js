var util = require("util")
  , _ = require("underscore")
  , MailParser = require("mailparser").MailParser
  , ImapConnection = require('imap').ImapConnection

var imap_defaults = {
  host: 'imap.gmail.com',
  port: 993,
  secure: true
}

exports.Email = Email = function(options) {
  this.imap_options = _.defaults(options, imap_defaults)
  this.imap = new ImapConnection(this.imap_options)
}

Email.prototype.setup = function setup(callback) {
  var self = this
  
  if (self.imap.isAuthenticated()) {
    callback()
  } else {
    self.imap = new ImapConnection(self.imap_options)
    self.imap.connect(function(err) {
      self.imap.openBox("INBOX", false, callback)
    })    
  }
}

Email.prototype.fetch = function fetch(callback) {
  var self = this
  
  self.setup(function(err, box) {
    self.box = box || self.box

    if (self.box.messages.new == 0) {
      console.log("No new unseen E-Mails")      
      return
    } else {
      console.log("We have " + self.box.messages.new + " new mails!")
    }

    self.imap.search([ 'UNSEEN', ['SINCE', 'May 20, 2010'] ], function(err, matches) {
      if (err) throw err

      var fetch = self.imap.fetch(matches, {
        markSeen: true,
        request: {
          headers: false,
          body: "full"
        }
      })

      fetch.on('message', function(msg) {
        var parser = new MailParser()
          , message_headers
          , message_body

        parser.on("headers", function(headers) {
          message_headers = headers
        })

        parser.on("body", function(body) {
          message_body = body
        })

        msg.on('data', function(data) {
          parser.feed(data.toString())
        })
        msg.on('end', function() {
          parser.end()

          callback(message_headers, message_body)
        })
      })

      fetch.on('end', function() {
        self.imap.logout()
      })
    })
  })  
}

// var email = new Email({
//   username: 'blackcat@galaxycats.com',
//   password: 'zQM38nN79r',
// })
// 
// setInterval(function() {
//   email.fetch(function(headers, body) {
//     console.log(headers)
// 
//     var email = {
//       subject: headers.subject,
//       description: body.bodyText,
//       reporter: headers.addressesFrom[0],
//       created_at: new Date(headers.messageDate).toJSON(),
//       message_id: headers.messageId
//     }
// 
//     console.log(email)
//     console.log("=========================")
//   })  
// }, 1000)
