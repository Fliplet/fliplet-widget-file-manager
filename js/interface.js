var $folderContents = $('.file-table-body');
var $folderList;
var $organizationAppList = $('.dropdown-menu-holder ul');
var templates = {
  file: template('file'),
  folder: template('folder'),
  folderItem: template('folder-item'),
  organizations: template('organizations'),
  apps: template('apps')
};

var currentFolderId;
var currentFolders;
var currentFiles;

function getOrganizationsList() {
  Fliplet.Organizations.get().then(function (organizations) {
    organizations.forEach(addOrganizations);
    $folderList = $('.folder-list');
  });
}

function getAppsList() {
  Fliplet.Apps.get().then(function (apps) {
    apps.forEach(addApps);
  });
}

function getFolderContents(folderId) {
  currentFolderId = folderId;
  currentFolders = [];
  currentFiles = [];
  $folderContents.html('');

  Fliplet.Media.Folders.get({
    folderId: currentFolderId
  }).then(function (response) {
    response.folders.forEach(function(i) {
      // Converts to readable date format
      var readableDate = moment(i.updatedAt).format("Do MMM YYYY");
      i.updatedAt = readableDate;

      addFolder(i);
    });
    response.files.forEach(function(i) {
      // Converts to readable date format
      var readableDate = moment(i.updatedAt).format("Do MMM YYYY");
      i.updatedAt = readableDate;

      addFile(i);
    });
  });
}

function getListFolders(folderId, listEl) {
  $listElement = listEl;
  currentFolderId = folderId;

  Fliplet.Media.Folders.get({
    folderId: currentFolderId
  }).then(function (response) {
    response.folders.forEach(function(i) {
      // Checks if is parent or children folders
      if (i.parentId != null) {
        $listElement.removeClass('no-subfolder');
        // Checks if entry already exists in the HTML
        if ( $listElement.find('ul').first().find('li[data-id="'+i.id+'"]').length == 0 ) {
          $listElement.find('ul').first().append(templates.folderItem(i));
        }
      } else {
        // Checks if entry already exists in the HTML
        if ( $folderList.find('li[data-id="'+i.id+'"]').length == 0 ) {
          $folderList.append(templates.folderItem(i));
        }
      }
    });
  });
}

function addOrganizations(organizations) {
  $organizationAppList.append(templates.organizations(organizations));
}

function addApps(apps) {
  $organizationAppList.append(templates.apps(apps));
}

function addFolder(folder) {
  currentFolders.push(folder);
  $folderContents.append(templates.folder(folder));
}

function addFile(file) {
  currentFiles.push(file);
  $folderContents.append(templates.file(file));
}

function template(name) {
  return Handlebars.compile($('#template-' + name).html());
}

// EVENTS //
// Removes options popup by clicking elsewhere
$(document).on("click", function(e) {
  if ( $(e.target).is("#file-options-menu") === false && $(e.target).is(".file-options") === false ) {
    $('.file-row.active').removeClass('active');
    $('#file-options-menu').removeClass('active');
  }
});

$('.file-manager-wrapper')
  .on('change', '#file_upload', function() {
    var $form = $('[data-upload-file]');

    $form.submit();

    $('.new-btn').click();
  })
  .on('click', '.file-table-body [data-browse-folder]', function (event) {
    getFolderContents($(this).parents('.file-row').data('id'));
  })
  .on('click', '.dropdown-menu-holder [data-browse-folder]', function (event) {
    getFolderContents($(this).data('id'));
  })
  .on('click', '[data-create-folder]', function (event) {
    var folderName = prompt('Type folder name');

    if (!folderName) {
      return;
    }

    Fliplet.Media.Folders.create({
      name: folderName,
      parentId: currentFolderId || undefined
    }).then(addFolder);

    $('.new-btn').click();
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
  })
  .on('change', '#sort-files', function() {
    var selectedValue = $(this).val();
    var selectedText = $(this).find("option:selected").text();
    $(this).parents('.select-proxy-display').find('.select-value-proxy').html(selectedText);
  })
  .on('click', '.dropdown-menu-holder li', function(e) {
    e.stopPropagation();

    var folderId = $(this).data('id');
    getListFolders(folderId, $(this));

    $('.dropdown-menu-holder').find('li.active').removeClass('active');
    $(this).first().addClass('active');
  })
  .on('click', '.dropdown-menu-holder li > .list-holder .fa', function(e) {
    e.stopPropagation();
    if ($(this).hasClass('fa-chevron-right')) {
      $(this).removeClass('fa-chevron-right').addClass('fa-chevron-down');
      $(this).parents('.list-holder').next('ul').addClass('expanded');
    } else if ($(this).hasClass('fa-chevron-down')) {
      $(this).removeClass('fa-chevron-down').addClass('fa-chevron-right');
      $(this).parents('.list-holder').next('.expanded').removeClass('expanded');
    }
  })
  .on('click', '.new-btn', function() {
  	$(this).next('.new-menu').toggleClass('active');
  })
  .on('click', '.file-options', function(event) {
    contextualMenu($(this).parents('.file-row').data('id'));

    // PREVENTS SEVERAL ITEMS BEING IN ACTIVE STATE
    if ( $('.file-row').hasClass('active') ) {
      $('.file-row.active').removeClass('active');
      $(this).parents('.file-row').toggleClass('active');
    } else {
      $(this).parents('.file-row').toggleClass('active');
    }

    // PREVENTS HIDDING POPUP BY CLICKING ON OTHER OPTIONS BUTTON
    if ( $('#file-options-menu').hasClass('active') ) {
      $('#file-options-menu').toggleClass('active');
      $('#file-options-menu').toggleClass('active');
      startTether($(this));
    } else {
      $('#file-options-menu').toggleClass('active');
      startTether($(this));
    }

  })
  .on('click', '#delete-file', function() {
    var itemID = $('#file-options-menu').attr('data-file-id');
    var $item = $('.file-row[data-id="' + itemID + '"]');

    if ( $item.data('file-type') == 'folder' ) {
      var alertConfirmation = confirm("Are you sure you want to delete this folder?\nAll the content inside the folder will be deleted too.");
      if (alertConfirmation == true) {
        Fliplet.Media.Folders.delete( $item.data('id') ).then(function () {
          $item.remove();
        });
      }
    } else {
      var alertConfirmation = confirm("Are you sure you want to delete this file?\nThe file will be deleted forever.");
      if (alertConfirmation == true) {
        Fliplet.Media.Files.delete({
          fileId: $item.data('id'),
          folderId: $item.data('folder')
        }).then(function () {
          $item.remove();
        });
      }
    }
  })
  .on('click', '#view-file', function() {
    var itemID = $('#file-options-menu').attr('data-file-id');
    var $item = $('.file-row[data-id="' + itemID + '"]');

    // TODO: Get file info based on ID
  });

// AUX FUNCTIONS //
function contextualMenu(fileID) {
  $('#file-options-menu').attr('data-file-id', fileID);
}

function startTether(target) {
  new Tether({
    element: '#file-options-menu',
    target: target,
    attachment: 'top left',
    targetAttachment: 'top right',
    constraints: [
      {
        to: 'scrollParent',
        attachment: 'together',
        pin: true
      }
    ]
  });
}

// INIT //
getFolderContents();
getOrganizationsList();
getAppsList();

/* NOT USED - BACKUP
********************
.on('click', '[data-delete-folder]', function (event) {
  event.preventDefault();
  var $item = $(this).closest('li');

  Fliplet.Media.Folders.delete($item.data('id')).then(function () {
    $item.remove();
  });
})
.on('click', '[data-select-file]', function (event) {
  event.preventDefault();
  var id = $(this).closest('li').data('id');
  currentFiles.forEach(function (file) {
    if (file.id === id) {
      Fliplet.Widget.save(file).then(Fliplet.Widget.complete);
    }
  })
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
********************
END - BACKUP */
