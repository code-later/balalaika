function(doc) {
  if (doc && doc.created_at) {
    function zeroPad(v) { return v < 10 ? '0' + v : v; }
    var ts = doc.created_at.replace(/[TZ]/g, ' ').split(' ');
    emit(ts[0].split('-').concat(ts[1].split(':')), doc._id);
  }
}