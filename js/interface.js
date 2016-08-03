var $folderContents = $('#folder-contents');
var templates = {
  file: template('file'),
  folder: template('folder')
};
var currentFolderId;

function getFolderContents(folderId) {
  currentFolderId = folderId;
  $folderContents.html('');

  Fliplet.Media.Folders.get({
    folderId: currentFolderId
  }).then(function (response) {
    response.folders.forEach(addFolder);
    response.files.forEach(addFile);
  });
}

function addFolder(folder) {
  $folderContents.append(templates.folder(folder));
}

function addFile(file) {
  $folderContents.append(templates.file(file));
}

function template(name) {
  return Handlebars.compile($('#template-' + name).html());
}

// events
$('#app')
  .on('click', '[data-browse-folder]', function (event) {
    event.preventDefault();
    getFolderContents($(this).closest('li').data('id'));
  })
  .on('click', '[data-delete-folder]', function (event) {
    event.preventDefault();
    var $item = $(this).closest('li');

    Fliplet.Media.Folders.delete($item.data('id')).then(function () {
      $item.remove();
    });
  })
  .on('click', '[data-delete-file]', function (event) {
    event.preventDefault();
    var $item = $(this).closest('li');

    Fliplet.Media.Files.delete({
      fileId: $item.data('id'),
      folderId: $item.data('folder')
    }).then(function () {
      $item.remove();
    });
  })
  .on('click', '[data-create-folder]', function (event) {
    event.preventDefault();
    var folderName = prompt('Type folder name');

    if (!folderName) {
      return;
    }

    Fliplet.Media.Folders.create({
      name: folderName,
      parentId: currentFolderId || undefined
    }).then(addFolder);
  })
  .on('submit', '[data-upload-file]', function (event) {
    var $form = $(this);
    event.preventDefault();

    var $input = $form.find('input');
    var file = $input[0].files[0];
    var formData = new FormData();

    formData.append('name', file.name);
    formData.append('file', file);

    Fliplet.Media.Files.upload({
      folderId: currentFolderId,
      name: file.name,
      data: formData
    }).then(function (files) {
      $input.val('');
      files.forEach(function (file) {
        addFile(file);
      });
    });
  });

// init
getFolderContents();
