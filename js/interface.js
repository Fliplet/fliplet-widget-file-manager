// $('form').submit(function (event) {
//   event.preventDefault();

//   Fliplet.Widget.save({
//     // TODO
//   }).then(function () {
//     Fliplet.Widget.complete();
//   });
// });

// // Fired from Fliplet Studio when the external save button is clicked
// Fliplet.Widget.onSaveRequest(function () {
//   // TODO
// });

/////

var $folderContents = $('#folder-contents');
var templates = {
  folder: template('folder')
};

function getFolderContents() {
  Fliplet.Media.Folders.get().then(function (folders) {
    folders.forEach(addFolder);
  });
}

function addFolder(folder) {
  $folderContents.append(templates.folder(folder));
}

function template(name) {
  return Handlebars.compile($('#template-' + name).html());
}

// events
$('#app')
  .on('click', '[data-delete-folder]', function (event) {
    event.preventDefault();
    var $item = $(this).closest('li');

    Fliplet.Media.Folders.delete().then(function () {
      $item.remove();
    });
  })
  .on('click', '#create-folder', function (event) {
    event.preventDefault();
    Fliplet.Media.Folders.create({
      name: prompt('Type folder name')
    }).then(addFolder);
  });

// init
getFolderContents();
