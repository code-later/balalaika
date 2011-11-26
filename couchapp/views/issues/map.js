function(doc) {
  if (doc.subject) {
    emit(doc._id, doc.subject)
  }
}