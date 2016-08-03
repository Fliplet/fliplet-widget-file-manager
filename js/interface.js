$('form').submit(function (event) {
  event.preventDefault();

  Fliplet.Widget.save({
    // TODO
  }).then(function () {
    Fliplet.Widget.complete();
  });
});

// Fired from Fliplet Studio when the external save button is clicked
Fliplet.Widget.onSaveRequest(function () {
  // TODO
});

Fliplet.Media.Folders.get().then(function (folders) {
  folders.forEach(function (folder) {
    $('#folders').append('<p>' + folder.name + '</p>');
  });
});