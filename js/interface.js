// VAR SETUP //
var $folderContents = $('.file-table-body');
var $organizationList = $('.dropdown-menu-holder .panel-group');
var $progress = $('.progress');
var $progressBar = $progress.find('.progress-bar');
var templates = {
  file: template('file'),
  folder: template('folder'),
  organizations: template('organizations'),
  apps: template('apps')
};

// This should contain either app/org/folder of current folder
var currentSelection;

var currentFolderId;
var currentAppId;
var currentFolders;
var currentFiles;
var counterOrganisation;

var tetherBox;

var folders = [],
  apps,
  organizations;
var upTo = [];

var sideBarMinWidth = 240;
var sideBarMaxWidth = 395;

// CORE FUNCTIONS //
// Get organizations and apps list for left side menu
function getOrganizationsList() {
  counterOrganisation = 0;
  Fliplet.Organizations.get().then(function(organizations) {
    // Sort alphabetically
    organizations = _.sortBy(organizations, [function(o) {
      return o.name;
    }]);
    // Add to HTML
    organizations.forEach(addOrganizations);
  }).then(function() {
    getAppsList();
  });
}

function getAppsList() {
  Fliplet.Apps.get().then(function(apps) {
    // Remove V1 apps
    apps.filter(function(app) {
      return !app.legacy;
    });
    // Sort alphabetically
    apps = _.sortBy(apps, [function(o) {
      return o.name;
    }]);
    // Add to HTML
    apps.forEach(addApps);
  });
}

// Get folders and files depending on ID (Org, App, Folder) to add to the content area
function getFolderContents(el) {
  var options = {};
  // Default filter functions
  var filterFiles = function(files) {
    return true
  };
  var filterFolders = function(folders) {
    return true
  };

  if (el.attr('data-type') === "app") {
    options.appId = el.attr('data-app-id');
    currentAppId = el.attr('data-app-id');
    currentFolderId = null;

    // Filter functions
    filterFiles = function(file) {
      return !file.mediaFolderId;
    };
    filterFolders = function(folder) {
      return !folder.parentFolderId;
    };
  } else if (el.attr('data-type') === "organization") {
    options.organizationId = el.attr('data-org-id');
    currentAppId = null;
    currentFolderId = null;

    // Filter functions
    filterFiles = function(file) {
      return !(file.appId || file.mediaFolderId);
    };
    filterFolders = function(folder) {
      return !(folder.appId || folder.parentFolderId);
    };
  } else {
    options.folderId = el.attr('data-id');
    currentFolderId = el.attr('data-id');
  }

  currentFolders = [];
  currentFiles = [];
  $folderContents.html('');

  Fliplet.Media.Folders.get(options).then(function(response) {
    if (response.files.length === 0 && response.folders.length === 0) {
      $('.empty-state').addClass('active');
    } else {
      folders = response.folders;

      // Filter only the files from that request app/org/folder
      var mediaFiles = response.files.filter(filterFiles);
      var mediaFolders = response.folders.filter(filterFolders);

      mediaFolders.forEach(addFolder);
      mediaFiles.forEach(addFile);
    }
  }, function() {
    $('.empty-state').addClass('active');
  });
}

// Adds organization item template
function addOrganizations(organizations) {
  $organizationList.append(templates.organizations(organizations));

  if ($organizationList.find('.panel-title').length === 1) {
    var orgEl = $organizationList.find('.panel-title').first();
    var orgName = $organizationList.find('.panel-title').first().find('.list-text-holder span').first().text();

    $organizationList.find('.panel-title').first().addClass('active');

    // Store to nav stack
    backItem = {
      id: $organizationList.find('.panel-title').first().data('org-id'),
      name: orgName,
      tempElement: $organizationList.find('.panel-title').first()
    };
    backItem.back = function() {
      getFolderContents(backItem.tempElement);
    };
    backItem.type = 'organizationId';
    upTo.push(backItem);

    $('.header-breadcrumbs .current-folder-title').html('<span class="bread-link"><a href="#">' + orgName + '</a></span>');
    getFolderContents(orgEl);
  }
}

// Adds app item template
function addApps(apps) {
  var $appList = $('.dropdown-menu-holder #organisation-' + apps.organizationId + ' .panel-body');
  $appList.append(templates.apps(apps));
}

// Adds folder item template
function addFolder(folder) {
  // Converts to readable date format
  var readableDate = moment(folder.updatedAt).format("Do MMM YYYY");
  folder.updatedAt = readableDate;

  currentFolders.push(folder);
  folders.push(folder);
  $folderContents.append(templates.folder(folder));
  $('.empty-state').removeClass('active');
}

// Adds file item template
function addFile(file) {
  // Converts to readable date format
  var readableDate = moment(file.updatedAt).format("Do MMM YYYY");
  file.updatedAt = readableDate;

  currentFiles.push(file);
  $folderContents.append(templates.file(file));
  $('.empty-state').removeClass('active');
}

// Templating
function template(name) {
  return Handlebars.compile($('#template-' + name).html());
}

function checkboxStatus() {
  var numberOfRows = $('.file-row').length;
  var numberOfActiveRows = $('.file-row.active').length;
  $('.delete-holder').find('.badge').html(numberOfActiveRows);
  $('.items-selected').html(numberOfActiveRows > 1 ? numberOfActiveRows + ' items' : numberOfActiveRows + ' item');

  if ($('.file-row').hasClass('active')) {
    $('.side-actions').addClass('active');
    $('.file-cell.selectable').addClass('active');
    $('.file-row').not(this).addClass('passive');
    $('.help-tips').addClass('hidden');
  } else {
    $('.side-actions').removeClass('active');
    $('.file-cell.selectable').removeClass('active');
    $('.file-row').not(this).removeClass('passive');
    $('.help-tips').removeClass('hidden');
    $('.side-actions .item').removeClass('show');
  }

  if (numberOfActiveRows > 1) {
    $('.side-actions .item').removeClass('show');
    $('.side-actions .item.multiple').addClass('show');
  } else if (numberOfActiveRows === 1) {
    var itemType = $('.file-row.active').data('file-type');

    if (itemType === 'folder') {
      $('.side-actions .item').removeClass('show');
      $('.side-actions .item.folder').addClass('show');
    } else {
      $('.side-actions .item').removeClass('show');
      $('.side-actions .item.file').addClass('show');
    }
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
  $('.items-selected').html(numberOfActiveRows > 1 ? numberOfActiveRows + ' items' : numberOfActiveRows + ' item');

  if (!$('.file-row').hasClass('active')) {
    $('.side-actions').removeClass('active');
    $('.side-actions .item').removeClass('show');
    $('.help-tips').removeClass('hidden');
  }
}

function updatePaths() {
  if (upTo.length > 1) {
    var breadcrumbsPath = '';

    for (var i = 0; i < upTo.length; i++) {
      breadcrumbsPath += '<span class="bread-link"><a href="#" data-breadcrumb="' + i + '">' + upTo[i].name + '</a></span>';
    }

    $('.header-breadcrumbs .current-folder-title').html(breadcrumbsPath);
    return;
  }

  // Current folder
  $('.header-breadcrumbs .current-folder-title').html('<span class="bread-link"><a href="#">' + upTo[upTo.length - 1].name + '</a></span>');
}

function resetUpTo(element) {
  upTo = [];

  if (element.attr('data-type') === "app") {
    backItem = {
      id: element.data('app-id'),
      name: element.find('.list-text-holder span').first().text(),
      tempElement: element
    };
    backItem.type = 'appId';
  } else if (element.attr('data-type') === "organization") {
    backItem = {
      id: element.data('org-id'),
      name: element.find('.list-text-holder span').first().text(),
      tempElement: element
    };
    backItem.type = 'organizationId';
  } else {
    backItem = {
      id: element.data('id'),
      name: element.find('.list-text-holder span').first().text(),
      tempElement: element
    };
    backItem.type = 'folderId';
  }
  backItem.back = function() {
    getFolderContents(backItem.tempElement);
  };

  upTo.push(backItem);
  updatePaths();
}

// EVENTS //
// Removes options popup by clicking elsewhere
$(document).on("click", function(e) {
    if ($(e.target).is("#file-options-menu") === false && $(e.target).is(".file-options") === false) {
      $('.file-row.focused').removeClass('focused');
      $('#file-options-menu').removeClass('active');
      $('.new-menu').removeClass('active');
    }
  })
  .mouseup(function(e) {
    $(document).unbind('mousemove');
  });

$('.file-manager-wrapper')
  .on('change', '#file_upload', function() {
    var $form = $('[data-upload-file]');

    $form.submit();

    $('.new-btn').click();
  })
  .on('dblclick', '.file-table-body [data-browse-folder], .file-table-body [data-open-file]', function(event) {
    var $el = $(this);
    var $parent = $el.parents('.file-row');
    var id = $el.parents('.file-row').data('id');
    var backItem;

    if ($parent.data('file-type') === 'folder') {
      // Store to nav stack
      backItem = _.find(folders, ['id', id]);
      backItem.tempElement = $('.file-row[data-id="' + id + '"]');
      backItem.back = function() {
        getFolderContents(backItem.tempElement);
      };
      backItem.type = 'folderId';
      upTo.push(backItem);

      // Update paths
      updatePaths();
      getFolderContents($(this).parents('.file-row'));
    } else {
      var fileURL = $('.file-row[data-id="' + id + '"]').attr('data-file-url');

      if (fileURL !== undefined) {
        window.open(fileURL, '_blank');
      }
    }
  })
  .on('click', '.dropdown-menu-holder [data-browse-folder]', function(event) {
    resetUpTo($(this));
    getFolderContents($(this));
  })
  .on('click', '[data-create-folder]', function(event) {
    // Creates folder
    var folderName = prompt('Type folder name');
    var lastFolderSelected = upTo[upTo.length - 1];

    var options = {
      name: folderName,
      parentId: currentFolderId || undefined
    };

    if (!folderName) {
      return;
    }

    if (lastFolderSelected.type === "appId") {
      options.appId = lastFolderSelected.id;
    } else if (lastFolderSelected.type === "organizationId") {
      options.organizationId = lastFolderSelected.id;
    } else {
      options.parentId = lastFolderSelected.id;

      if (lastFolderSelected.organizationId !== null) {
        options.organizationId = lastFolderSelected.organizationId;
      } else if (lastFolderSelected.appId !== null) {
        options.appId = lastFolderSelected.appId;
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
      appId: currentAppId,
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
  .on('click', '.dropdown-menu-holder .list-holder', function(e) {
    // Click on folder structure
    // Adds Breadcrumbs
    var $el = $(this);

    $('.dropdown-menu-holder').find('.list-holder.active').removeClass('active');
    $el.first().addClass('active');

    var currentItem = $el;
    $('.header-breadcrumbs .current-folder-title').html('<span class="bread-link"><a href="#">' + currentItem.find('.list-text-holder span').first().text() + '</a></span>');
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
      $(this).parents('.file-row').removeClass('focused');
    } else {
      $('#file-options-menu').addClass('active');
      $(this).parents('.file-row').addClass('focused');
      $('.file-row.focused').not($(this).parents('.file-row')).removeClass('focused');
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
      $item.find('.file-name').dblclick();
    }
  })
  .on('click', '#rename-file', function() {
    // Rename folder or file
    var itemID = $('#file-options-menu').attr('data-file-id');
    var $item = $('.file-row[data-id="' + itemID + '"]');
    var fileName = $('.file-row[data-id="' + itemID + '"]').find('.file-name span').text();

    var changedName = prompt("Please enter the file name", fileName);

    if (changedName != null) {
      Fliplet.Media.Files.update(itemID, {
        name: changedName
      }).then(function() {
        $('.file-row[data-id="' + itemID + '"]').find('.file-name span').html(changedName);
      });
    }
  })
  .on('click', '#rename-folder', function() {
    // Rename folder or file
    var itemID = $('#file-options-menu').attr('data-file-id');
    var $item = $('.file-row[data-id="' + itemID + '"]');

    var fileName = $('.file-row[data-id="' + itemID + '"]').find('.file-name span').text();

    var changedName = prompt("Please enter the file name", fileName);

    if (changedName != null) {
      Fliplet.Media.Folders.update(itemID, {
        name: changedName
      }).then(function() {
        $('.file-row[data-id="' + itemID + '"]').find('.file-name span').html(changedName);
      });
    }
  })
  .on('click', '.header-breadcrumbs [data-breadcrumb]', function() {
    var index = $(this).data('breadcrumb');
    var position = index + 1;

    upTo.splice(position, 9999);
    upTo[index].back();
    updatePaths();
  })
  .on('show.bs.collapse', '.panel-collapse', function() {
    $(this).siblings('.panel-heading').find('.fa').addClass('rotate');
  })
  .on('hide.bs.collapse', '.panel-collapse', function() {
    $(this).siblings('.panel-heading').find('.fa').removeClass('rotate');
  });
/* Resize sidebar
.on('mousedown', '.split-bar', function(e) {
  e.preventDefault();
  $(document).mousemove(function(e) {
    e.preventDefault();
    var x = e.pageX - $('.file-manager-leftside').offset().left;
    if (x > sideBarMinWidth && x < sideBarMaxWidth) {
      $('.file-manager-leftside').css("width", x);
    }
  });
});
*/

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
