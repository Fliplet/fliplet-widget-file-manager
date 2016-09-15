// VAR SETUP //
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
var counterOrganisation;

// CORE FUNCTIONS //
// Get organizations and apps list for left side menu
function getOrganizationsList() {
  counterOrganisation = 0;
  Fliplet.Organizations.get().then(function (organizations) {
    organizations.forEach(addOrganizations);
    $folderList = $('.folder-list');
  });
}

function getAppsList() {
  Fliplet.Apps.get().then(function (apps) {
    apps.forEach(addApps);
    $folderList = $('.folder-list');
  });
}

// Get folders and files depending on ID (Org, App, Folder) to add to the content area
function getFolderContents(el) {
  var currentAppID;
  var currentOrgID;

  if (el.attr('data-type') == "app") {
    currentAppID = el.attr('data-app-id');
    currentFolderId = '';
  } else if (el.attr('data-type') == "organization") {
    currentOrgID = el.attr('data-org-id');
    currentFolderId = '';
  } else {
    currentFolderId = el.attr('data-id');
  }

  currentFolders = [];
  currentFiles = [];
  $folderContents.html('');

  Fliplet.Media.Folders.get({
    organizationId: currentOrgID,
    appId: currentAppID,
    folderId: currentFolderId
  }).then(function (response) {
    response.folders.forEach(addFolder);
    response.files.forEach(addFile);
  });
}

// Get folders depending on ID (Org, App, Folder) to add as sub-folders
function getListFolders(listEl) {
  var currentAppID;
  var currentOrgID;
  $listElement = listEl;

  if ($listElement.attr('data-type') == "app") {
    currentAppID = $listElement.attr('data-app-id');
    currentFolderId = '';
  } else if ($listElement.attr('data-type') == "organization") {
    currentOrgID = $listElement.attr('data-org-id');
    currentFolderId = '';
  } else {
    currentFolderId = $listElement.attr('data-id');
  }

  Fliplet.Media.Folders.get({
    organizationId: currentOrgID,
    appId: currentAppID,
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
          $listElement.find('ul').first().append(templates.folderItem(i));
        }
        if ( !$folderList.is(':empty') ) {
          $folderList.parents('.active').first().removeClass('no-subfolder');
        }
      }
    });
  });
}

// Adds organization item template
function addOrganizations(organizations) {
  $organizationAppList.append(templates.organizations(organizations));

  if ($organizationAppList.find('li').length === 1) {
    $organizationAppList.find('li').first().addClass('active');

    var orgEl = $organizationAppList.find('li').first();
    var orgName = $organizationAppList.find('li').first().find('.list-text-holder span').first().text();

    $(".header-breadcrumbs").html('<strong>' + orgName + '</strong>');
    getFolderContents(orgEl);
  }
}

// Adds app item template
function addApps(apps) {
  $organizationAppList.append(templates.apps(apps));
}

// Adds folder item template
function addFolder(folder) {
  // Converts to readable date format
  var readableDate = moment(folder.updatedAt).format("Do MMM YYYY");
  folder.updatedAt = readableDate;

  currentFolders.push(folder);
  $folderContents.append(templates.folder(folder));
}

// Adds file item template
function addFile(file) {
  // Converts to readable date format
  var readableDate = moment(file.updatedAt).format("Do MMM YYYY");
  file.updatedAt = readableDate;

  currentFiles.push(file);
  $folderContents.append(templates.file(file));
}

// Templating
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
    getFolderContents($(this).parents('.file-row'));
  })
  .on('click', '.dropdown-menu-holder [data-browse-folder]', function (event) {
    getFolderContents($(this));
  })
  .on('click', '[data-create-folder]', function (event) {
    // Creates folder
    var folderName = prompt('Type folder name');
    var $selectedFolder = $('.dropdown-menu-holder li.active');
    if (!folderName) {
      return;
    }

    if ($selectedFolder.attr('data-type') == "app") {
      currentAppID = $selectedFolder.attr('data-app-id');
    } else if ($selectedFolder.attr('data-type') == "organization") {
      currentOrgID = $selectedFolder.attr('data-org-id');
    }

    Fliplet.Media.Folders.create({
      name: folderName,
      parentId: currentFolderId || undefined,
      organizationId: Fliplet.Env.get('organizationId'),
      appId: currentAppID
    }).then(addFolder);

    $('.new-btn').click();
  })
  .on('submit', '[data-upload-file]', function (event) {
    // Upload file
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
    // Click on folder structure
    // Gets sub-folder structure
    // Adds Breadcrumbs
    var $el = $(this);
    e.stopPropagation();

    getListFolders($el);

    $('.dropdown-menu-holder').find('li.active').removeClass('active');
    $el.first().addClass('active');

    var currentItem = $el;
    var path = '';

    $(currentItem.parentsUntil( '.dropdown-menu-holder', 'li' ).get().reverse()).each(function () {
      path += $(this).find('.list-text-holder span').first().text() + '<i class="fa fa-angle-right" aria-hidden="true"></i>';
    });

    if ( currentItem.attr('data-type') == 'organisation' ) {
      path = '<strong>' + currentItem.find('.list-text-holder span').first().text() + '</strong>';
    } else {
      path += '<strong>' + currentItem.find('.list-text-holder span').first().text() + '</strong>';
    }

    $(".header-breadcrumbs").html(path);
  })
  .on('click', '.dropdown-menu-holder li > .list-holder .fa', function(e) {
    // Changes arrow icon orientation
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
    // Opens options pop-up for folders/files
    contextualMenu( $(this).parents('.file-row').attr('data-id'), $(this).parents('.file-row') );

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
    // Deletes folder or file
    var itemID = $('#file-options-menu').attr('data-file-id');
    var $item = $('.file-row.active[data-id="' + itemID + '"]');

    if ( $item.attr('data-file-type') == 'folder' ) {
      var alertConfirmation = confirm("Are you sure you want to delete this folder?\nAll the content inside the folder will be deleted too.");
      if (alertConfirmation == true) {
        Fliplet.Media.Folders.delete( $item.attr('data-id') ).then(function () {
          $item.remove();
        });
      }
    } else {
      var alertConfirmation = confirm("Are you sure you want to delete this file?\nThe file will be deleted forever.");
      if (alertConfirmation == true) {
        Fliplet.Media.Files.delete({
          fileId: $item.attr('data-id'),
          folderId: $item.attr('data-folder')
        }).then(function () {
          $item.remove();
        });
      }
    }
  })
  .on('click', '#view-file', function() {
    // Open folder or file
    var itemID = $('#file-options-menu').attr('data-file-id');
    var $item = $('.file-row[data-id="' + itemID + '"]');
    var fileURL = $item.attr('data-file-url');

    if ( fileURL != undefined ) {
      window.open(fileURL, '_blank');
    } else {
      $item.find('.file-name').click();
    }
  });

// AUX FUNCTIONS //
function contextualMenu(fileID, element) {
  // Adds dynamic data to options pop-up
  $element = element;
  $('#file-options-menu').attr('data-file-id', fileID);
  if ( $element.attr('data-file-type') == 'folder' ) {
    $('#file-options-menu #view-file').html('Open folder');
  } else {
    $('#file-options-menu #view-file').html('View file');
  }
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
getOrganizationsList();
getAppsList();
