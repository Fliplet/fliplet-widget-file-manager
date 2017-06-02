// VAR SETUP //
var $folderContents = $('.file-table-body');
var $organizationAppList = $('.dropdown-menu-holder ul');
var $progress = $('.progress');
var $progressBar = $progress.find('.progress-bar');
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

var tetherBox;

var folders,
  apps,
  organizations;
var upTo = [];

// CORE FUNCTIONS //
// Get organizations and apps list for left side menu
function getOrganizationsList() {
  counterOrganisation = 0;
  Fliplet.Organizations.get().then(function(organizations) {
    organizations.forEach(addOrganizations);
  });
}

function getAppsList() {
  Fliplet.Apps.get().then(function(apps) {
    apps.filter(function(app) {
        return !app.legacy;
      })
      .forEach(addApps);
    checkForSubfolders();
  });
}

// Get folders and files depending on ID (Org, App, Folder) to add to the content area
function getFolderContents(el) {
  var options = {};

  if (el.attr('data-type') === "app") {
    options.appId = el.attr('data-app-id');
  } else if (el.attr('data-type') === "organization") {
    options.organizationId = el.attr('data-org-id');
  } else {
    options.folderId = el.attr('data-id');
    currentFolderId = el.attr('data-id');
  }

  currentFolders = [];
  currentFiles = [];
  $folderContents.html('');

  Fliplet.Media.Folders.get(options).then(function(response) {
    folders = response.folders;

    // Filter only the files from that request app/org/folder 
    var mediaFiles;
    var mediaFolders;

    if (options.organizationId) {
      mediaFiles = response.files.filter(function removeNonRootOrganizationFiles(file) {
        return !(file.appId || file.mediaFolderId);
      });
      mediaFolders = response.files.filter(function removeNonRootOrganizationFolders(folder) {
        return !(file.appId || file.parentFolderId);
      });
    }

    if (options.appId) {
      mediaFiles = response.files.filter(function removeNonRootAppFiles(file) {
        return !file.mediaFolderId;
      });
      mediaFolders = response.files.filter(function removeNonRootAppFolders(folder) {
        return !folder.parentFolderId;
      });
    }

    // Render files and folders
    mediaFolders.folders.forEach(addFolder);
    mediaFiles.forEach(addFile);
  });
}

// Get folders depending on ID (Org, App, Folder) to add as sub-folders
function getListFolders(listEl, init) {
  var options = {};
  var $listElement = listEl;

  if ($listElement.attr('data-type') == "app") {
    options.appId = $listElement.attr('data-app-id');
  } else if ($listElement.attr('data-type') == "organization") {
    options.organizationId = $listElement.attr('data-org-id');
  } else {
    options.folderId = $listElement.attr('data-id');
  }

  Fliplet.Media.Folders.get(options).then(function(response) {
    response.folders.forEach(function(i) {
      // Checks if is parent or children folders
      if (i.parentId != null) {
        $listElement.removeClass('no-subfolder');
        // Checks if entry already exists in the HTML
        if ($listElement.find('ul').first().find('li[data-id="' + i.id + '"]').length == 0) {
          $listElement.find('ul').first().append(templates.folderItem(i));
        }
      } else {
        // Checks if entry already exists in the HTML
        if ($listElement.find('ul').first().find('li[data-id="' + i.id + '"]').length == 0) {
          $listElement.find('ul').first().append(templates.folderItem(i));
        }
        if (!$listElement.find('.folder-list').is(':empty') && !init) {
          $listElement.removeClass('no-subfolder');
          //$listElement.find('ul').first().append(templates.folderItem(i));
        } else {
          $listElement.removeClass('no-subfolder');
        }
      }
    });
  });
}

// Adds organization item template
function addOrganizations(organizations) {
  $organizationAppList.append(templates.organizations(organizations));

  if ($organizationAppList.find('li').length === 1) {
    var orgEl = $organizationAppList.find('li').first();
    var orgName = $organizationAppList.find('li').first().find('.list-text-holder span').first().text();

    $organizationAppList.find('li').first().addClass('active');

    // Store to nav stack
    backItem = {
      id: $organizationAppList.find('li').first().data('org-id'),
      name: orgName
    };
    backItem.back = function() {
      getFolderContents($organizationAppList.find('li').first());
    };
    backItem.type = 'organizationId';
    upTo.push(backItem);

    $(".header-breadcrumbs .current-folder-title").html(orgName);
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

function checkForSubfolders() {
  $('.dropdown-menu-holder li.no-subfolder').each(function(i, el) {
    getListFolders($(el), true);
  });
}

function checkboxStatus() {
  var numberOfRows = $('.file-row').length;
  var numberOfActiveRows = $('.file-row.active').length;
  $('.delete-holder').find('.badge').html(numberOfActiveRows);

  if ($('.file-row').hasClass('active')) {
    $('.delete-holder').addClass('active');
    $('.file-cell.selectable').addClass('active');
    $('.file-row').not(this).addClass('passive');
  } else {
    $('.delete-holder').removeClass('active');
    $('.file-cell.selectable').removeClass('active');
    $('.file-row').not(this).removeClass('passive');
  }

  if (numberOfRows === numberOfActiveRows) {
    $('.file-table-header input[type="checkbox"]').prop('checked', true);
  } else {
    $('.file-table-header input[type="checkbox"]').prop('checked', false);
  }
}

function toggleAll(el) {
  if (el.is(':checked')) {
    $('.file-row input[type="checkbox"]').each(function() {
      $(this).prop('checked', true);
      $(this).parents('.file-row').addClass('active');
      $(this).parents('.file-cell.selectable').addClass('active');
    });
  } else {
    $('.file-row input[type="checkbox"]').each(function() {
      $(this).prop('checked', false);
      $(this).parents('.file-row').removeClass('active');
      $('.file-cell.selectable').removeClass('active');
      $('.file-row').removeClass('passive');
    });
  }

  var numberOfActiveRows = $('.file-row.active').length;
  $('.delete-holder').find('.badge').html(numberOfActiveRows);

  if (!$('.file-row').hasClass('active')) {
    $('.delete-holder').removeClass('active');
  }
}

function openRoot() {
  // Update paths
  $('.header-breadcrumbs').removeClass('child');
  $('.back-btn').addClass('hidden');
}

function updatePaths() {
  if (upTo.length === 1) {
    // Hide them
    $('.back-btn').addClass('hidden');
    $('.header-breadcrumbs').removeClass('child');
  } else if (upTo.length > 1) {
    // Show them
    $('.back-btn').removeClass('hidden');
    $('.header-breadcrumbs').addClass('child');
  }

  // Current folder
  $('.header-breadcrumbs .current-folder-title').html(upTo[upTo.length - 1].name);
}

function resetUpTo(element) {
  upTo = [];

  if (element.attr('data-type') === "app") {
    backItem = {
      id: element.data('app-id'),
      name: element.find('.list-text-holder span').first().text()
    };
    backItem.type = 'appId';
  } else if (element.attr('data-type') === "organization") {
    backItem = {
      id: element.data('org-id'),
      name: element.find('.list-text-holder span').first().text()
    };
    backItem.type = 'organizationId';
  } else {
    backItem = {
      id: element.data('id'),
      name: element.find('.list-text-holder span').first().text()
    };
    backItem.type = 'folderId';
  }
  backItem.back = function() {
    getFolderContents(element);
  };

  upTo.push(backItem);
  updatePaths();
}

// EVENTS //
// Removes options popup by clicking elsewhere
$(document).on("click", function(e) {
  if ($(e.target).is("#file-options-menu") === false && $(e.target).is(".file-options") === false) {
    $('#file-options-menu').removeClass('active');
    $('.new-menu').removeClass('active');
  }
});

$('.file-manager-wrapper')
  .on('change', '#file_upload', function() {
    var $form = $('[data-upload-file]');

    $form.submit();

    $('.new-btn').click();
  })
  .on('dblclick', '.file-table-body [data-browse-folder]', function(event) {
    var $el = $(this);
    var id = $el.parents('.file-row').data('id');
    var backItem;

    // Store to nav stack
    backItem = _.find(folders, ['id', id]);
    backItem.back = function() {
      getFolderContents($('.file-row[data-id="' + id + '"]'));
    };
    backItem.type = 'folderId';
    upTo.push(backItem);

    // Update paths
    updatePaths();
    getFolderContents($(this).parents('.file-row'));
  })
  .on('click', '.dropdown-menu-holder [data-browse-folder]', function(event) {
    resetUpTo($(this));
    getFolderContents($(this));
  })
  .on('click', '[data-create-folder]', function(event) {
    // Creates folder
    var folderName = prompt('Type folder name');
    var $selectedFolder = $('.dropdown-menu-holder li.active');

    var options = {
      name: folderName,
      parentId: currentFolderId || undefined
    };

    if (!folderName) {
      return;
    }

    if ($selectedFolder.attr('data-type') == "app") {
      options.appId = $selectedFolder.attr('data-app-id');
    } else if ($selectedFolder.attr('data-type') == "organization") {
      options.organizationId = $selectedFolder.attr('data-org-id');
    } else {
      options.parentId = $selectedFolder.attr('data-id');

      if ($selectedFolder.parents('li[data-org]') != undefined) {
        options.organizationId = $selectedFolder.parents('li[data-org]').attr('data-org-id');
      } else if ($selectedFolder.parents('li[data-app]') != undefined) {
        options.appId = $selectedFolder.parents('li[data-org]').attr('data-org-id');
      }
    }


    Fliplet.Media.Folders.create(options).then(addFolder);

    $('.new-btn').click();
  })
  .on('submit', '[data-upload-file]', function(event) {
    // Upload file
    event.preventDefault();

    var formData = new FormData();
    var $form = $(this);
    var $input = $form.find('input');
    var files = $input[0].files;
    var file;

    for (var i = 0; i < files.length; i++) {
      file = files.item(i);
      formData.append('name[' + i + ']', file.name);
      formData.append('files[' + i + ']', file);
    }

    $progressBar.css({
      width: '0%'
    });
    $progress.removeClass('hidden');

    Fliplet.Media.Files.upload({
      folderId: currentFolderId,
      name: file.name,
      data: formData,
      progress: function(percentage) {
        $progressBar.css({
          width: percentage + '%'
        });
      }
    }).then(function(files) {
      $input.val('');
      files.forEach(function(file) {
        addFile(file);
      });

      $progress.addClass('hidden');
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

    $(".header-breadcrumbs .current-folder-title").html(currentItem.find('.list-text-holder span').first().text());
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

    event.stopPropagation();
  })
  .on('change', '.file-row input[type="checkbox"]', function() {
    $(this).parents('.file-row').toggleClass('active');
    checkboxStatus();
  })
  .on('change', '.file-table-header input[type="checkbox"]', function() {
    toggleAll($(this));
  })
  .on('click', '.file-options', function(event) {
    var itemId = $('#file-options-menu.active').attr('data-file-id');
    var rowItemId = $(this).parents('.file-row').attr('data-id');

    // Opens options pop-up for folders/files
    contextualMenu($(this).parents('.file-row').attr('data-id'), $(this).parents('.file-row'));

    if (itemId === rowItemId) {
      $('#file-options-menu').removeClass('active');
      $(this).parents('.file-row').removeClass('active');
    } else {
      $('#file-options-menu').addClass('active');
      $(this).parents('.file-row').addClass('active');
      $('.file-row.active').not($(this).parents('.file-row')).removeClass('active');
      startTether($(this));
    }

    event.stopPropagation();
  })
  .on('click', '#delete-file', function() {
    // Deletes folder or file
    var itemID = $('#file-options-menu').attr('data-file-id');
    var $item = $('.file-row.active[data-id="' + itemID + '"]');
    var alertConfirmation;

    if ($item.attr('data-file-type') == 'folder') {
      alertConfirmation = confirm("Are you sure you want to delete this folder?\nAll the content inside the folder will be deleted too.");
      if (alertConfirmation === true) {
        Fliplet.Media.Folders.delete($item.attr('data-id')).then(function() {
          $item.remove();
        });
      }
    } else {
      alertConfirmation = confirm("Are you sure you want to delete this file?\nThe file will be deleted forever.");
      if (alertConfirmation === true) {
        Fliplet.Media.Files.delete($item.attr('data-id')).then(function() {
          $item.remove();
        });
      }
    }
  })
  .on('click', '.delete-multiple', function() {
    var items = $('.file-row.active');

    var alertConfirmation = confirm("Are you sure you want to delete all selected items?\nAll the content inside a folder will be deleted too.");

    if (alertConfirmation === true) {
      $(items).each(function() {
        var $element = $(this);

        if ($element.attr('data-file-type') == 'folder') {
          Fliplet.Media.Folders.delete($element.attr('data-id')).then(function() {
            $element.remove();
            checkboxStatus();
          });
        } else {
          Fliplet.Media.Files.delete($element.attr('data-id')).then(function() {
            $element.remove();
            checkboxStatus();
          });
        }
      });
    }
  })
  .on('click', '#view-file', function() {
    // Open folder or file
    var itemID = $('#file-options-menu').attr('data-file-id');
    var $item = $('.file-row[data-id="' + itemID + '"]');
    var fileURL = $item.attr('data-file-url');

    if (fileURL != undefined) {
      window.open(fileURL, '_blank');
    } else {
      $item.find('.file-name').click();
    }
  })
  .on('click', '#rename-file', function() {
    // Rename folder or file
    var itemID = $('#file-options-menu').attr('data-file-id');
    var $item = $('.file-row[data-id="' + itemID + '"]');

    // @TODO: Rename file
  })
  .on('click', '#rename-folder', function() {
    // Rename folder or file
    var itemID = $('#file-options-menu').attr('data-file-id');
    var $item = $('.file-row[data-id="' + itemID + '"]');

    // @TODO: Rename folder
  })
  .on('click', '.header-breadcrumbs .back-btn', function() {
    upTo.pop();
    upTo[upTo.length - 1].back();
    updatePaths();
  });

// AUX FUNCTIONS //
function contextualMenu(fileID, element) {
  // Adds dynamic data to options pop-up
  $element = element;
  $('#file-options-menu').attr('data-file-id', fileID);
  if ($element.attr('data-file-type') === 'folder') {
    $('#file-options-menu #view-file').html('Open folder');
    $('#file-options-menu #rename-file').removeClass('show');
    $('#file-options-menu #rename-folder').addClass('show');
  } else {
    $('#file-options-menu #view-file').html('View file');
    $('#file-options-menu #rename-folder').removeClass('show');
    $('#file-options-menu #rename-file').addClass('show');
  }
}

function startTether(target) {
  if (tetherBox) {
    tetherBox.destroy();
  }

  tetherBox = new Tether({
    element: '#file-options-menu',
    target: target,
    attachment: 'top left',
    targetAttachment: 'top right',
    constraints: [{
      to: 'scrollParent',
      attachment: 'together',
      pin: true
    }]
  });
}

// INIT //
getOrganizationsList();
getAppsList();
