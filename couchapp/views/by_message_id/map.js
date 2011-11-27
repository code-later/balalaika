function(doc) {
  if (doc && doc.message_id) {
    emit(doc.message_id, null);
  }
}