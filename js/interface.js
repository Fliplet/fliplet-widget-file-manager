/* eslint-disable */
var widgetId = parseInt(Fliplet.Widget.getDefaultId(), 10);
var data = Fliplet.Widget.getData(widgetId) || {};
var $folderContents = $('.file-table-body');
var $organizationList = $('.dropdown-menu-holder .panel-group');
var $progress = $('.progress');
var $progressBar = $progress.find('.progress-bar');
var $dropZone = $('#drop-zone');
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
var counterOrganization;

var tetherBox;

var folders = [];
var apps;
var organizations;
var navStack = [];

var sideBarMinWidth = 240;
var sideBarMaxWidth = 395;

// CORE FUNCTIONS //
// Get organizations and apps list for left side menu
function getOrganizationsList() {
  counterOrganization = 0;
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

function navigateToDefaultFolder() {
  if (typeof data === 'undefined' || !data || !data.appId) {
    // No folder was specified
    return;
  }

  var $listHolder;
  var folderId;
  var type;
  var $el = $('[data-app-id="' + data.appId + '"][data-browse-folder]');

  // Activate folder on left sidebar
  if ($el.data('type') === 'organization') {
    $listHolder = $el;
  } else {
    $listHolder = $el.find('.list-holder');
  }

  $('.dropdown-menu-holder').find('.list-holder.active').removeClass('active');
  $listHolder.first().addClass('active');

  // Set first folder of breadcrumbs
  resetUpTo($el);

  if (data.navStack && data.folder) {
    // Updates navStack with folders before the selected one
    var newNavStack = data.navStack.upTo.slice(1);
    newNavStack.forEach(function(obj, idx) {
      navStack.push(obj);
    });

    // Updates navStack with selected folder
    navStack.push(data.folder);
    navStack.forEach(function(obj, idx) {
      if (idx !== 0) {
        obj.back = function() {
          getFolderContentsById(obj.id);
        }
      }
    });

    folderId = data.folder.id;
    type = 'folder';
    updatePaths();
  } else {
    folderId = data.appId;
    type = 'app';
  }

  getFolderContentsById(folderId, type);
}

function getAppsList() {
  Fliplet.Apps.get().then(function(apps) {
    // Remove V1 apps
    apps.filter(function(app) {
      return !app.legacy;
    });
    // Sort apps alphabetically
    apps = _.sortBy(apps, [function(o) {
      return o.name;
    }]);
    // Add apps to HTML
    apps.forEach(addApps);

    navigateToDefaultFolder();
  });
}

function getFolderContentsById(id, type) {
  var options = {};
  var filterFiles = function(files) {
    return true
  };
  var filterFolders = function(folders) {
    return true
  };

  if (type === "app") {
    options.appId = id
    currentAppId = id
    currentFolderId = null;

    // Filter functions
    filterFiles = function(file) {
      return !file.mediaFolderId;
    };
    filterFolders = function(folder) {
      return !folder.parentFolderId;
    };
  } else {
    options.folderId = id;
    currentFolderId = id;
  }

  currentFolders = [];
  currentFiles = [];
  $folderContents.empty();

  Fliplet.Media.Folders.get(options).then(function(response) {
    var navItem = navStack[navStack.length-1];
    switch (navItem.type) {
      case 'organizationId':
        return;
        break;
      case 'appId':
        // User is no longer browsing the app folder
        if (!options.hasOwnProperty('appId') || parseInt(options.appId, 10) !== navItem.id) {
          return;
        }
        break;
      case 'folderId':
        // User us no longer browsing folder
        if (!options.hasOwnProperty('folderId') || parseInt(options.folderId, 10) !== navItem.id) {
          return;
        }
        break;
    }

    if (!$folderContents.is(':empty')) {
      // Content already rendered from a recent request. Do nothing.
      return;
    }

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

// Get folders and files depending on ID (Org, App, Folder) to add to the content area
function getFolderContents(el, isRootFolder) {
  if (isRootFolder) {
    // Restart breadcrumbs
    var $el = el;
    var $listHolder;

    if ($el.data('type') === 'organization') {
      $listHolder = $el;
    } else {
      $listHolder = $el.find('.list-holder');
    }

    $('.dropdown-menu-holder').find('.list-holder.active').removeClass('active');
    $listHolder.first().addClass('active');
  }

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
  $folderContents.empty();

  Fliplet.Media.Folders.get(options).then(function(response) {
    var navItem = navStack[navStack.length-1];
    switch (navItem.type) {
      case 'organizationId':
        // User is no longer browsing the organization folder
        if (options.hasOwnProperty('folderId') || !options.hasOwnProperty('organizationId') || parseInt(options.organizationId, 10) !== navItem.id) {
          return;
        }
        break;
      case 'appId':
        // User is no longer browsing the app folder
        if (!options.hasOwnProperty('appId') || parseInt(options.appId, 10) !== navItem.id) {
          return;
        }
        break;
      case 'folderId':
        // User is no longer browsing the folder
        if (!options.hasOwnProperty('folderId') || parseInt(options.folderId, 10) !== navItem.id) {
          return;
        }
        break;
    }

    if (!$folderContents.is(':empty')) {
      // Content already rendered from a recent request. Do nothing.
      return;
    }

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

  if ($organizationList.find('.panel-title').length !== 1) {
    return;
  }

  $(".panel-collapse").first().collapse('show');
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
  navStack.push(backItem);

  $('.header-breadcrumbs .current-folder-title').html('<span class="bread-link"><a href="#">' + orgName + '</a></span>');

  if (typeof data === 'undefined' || !data || !data.appId) {
    getFolderContents(orgEl);
  }
}

// Adds app item template
function addApps(apps) {
  var $appList = $('.dropdown-menu-holder #organization-' + apps.organizationId + ' .panel-body');
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
  var fileURL = $('.file-row.active').data('file-url');
  $('.items-selected').html(numberOfActiveRows > 1 ? numberOfActiveRows + ' items' : numberOfActiveRows + ' item');

  if (numberOfRows === 0) {
    $('.empty-state').addClass('active');
  }

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

  $('.side-actions .item').removeClass('show');
  $('.side-actions .item-actions').removeClass('single multiple');
  if (numberOfActiveRows > 1) {
    $('.side-actions .item.multiple').addClass('show');
    $('.side-actions .item-actions').addClass('multiple');
  } else if (numberOfActiveRows === 1) {
    var itemType = $('.file-row.active').data('file-type');
    $('.side-actions .item-actions').addClass('single');
    if (itemType === 'folder') {
      $('.side-actions .item.folder').addClass('show');
    } else if (itemType === 'image') {
      $('.side-actions .item.image').addClass('show');
      $('.side-actions .item.image').find('img').attr('src', fileURL);
    } else {
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
  $('.items-selected').html(numberOfActiveRows > 1 ? numberOfActiveRows + ' items' : numberOfActiveRows + ' item');

  $('.side-actions .item').removeClass('show');
  $('.side-actions .item-actions').removeClass('single multiple');
  if (numberOfActiveRows > 1) {
    $('.side-actions .item.multiple').addClass('show');
    $('.side-actions .item-actions').addClass('multiple');
  } else if (numberOfActiveRows === 1) {
    $('.side-actions .item-actions').addClass('single');
  }

  if (!$('.file-row').hasClass('active')) {
    $('.side-actions').removeClass('active');
    $('.side-actions .item').removeClass('show');
    $('.help-tips').removeClass('hidden');
  }
}

function updatePaths() {
  if (navStack.length > 1) {
    var breadcrumbsPath = '';

    for (var i = 0; i < navStack.length; i++) {
      breadcrumbsPath += '<span class="bread-link"><a href="#" data-breadcrumb="' + i + '">' + navStack[i].name + '</a></span>';
    }

    $('.header-breadcrumbs .current-folder-title').html(breadcrumbsPath);
    return;
  }

  // Current folder
  $('.header-breadcrumbs .current-folder-title').html('<span class="bread-link"><a href="#">' + navStack[navStack.length - 1].name + '</a></span>');
}

function resetUpTo(element) {
  navStack = [];

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

  navStack.push(backItem);
  updatePaths();
}

function showDropZone() {
  $('.drop-zone-folder-name').html(navStack[navStack.length - 1].name);
  $dropZone.addClass('active');
}

function hideDropZone() {
  $dropZone.removeClass('active');
}

function uploadFiles(files) {
  var formData = new FormData();
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
    files.forEach(function(file) {
      addFile(file);
    });

    $progress.addClass('hidden');
  });
}

$dropZone.on('drop', function(e) {
  e.preventDefault();
  hideDropZone();
  var dataTransfer = e.originalEvent.dataTransfer;
  var files = dataTransfer.files;
  if (!files.length) return hideDropZone();
  uploadFiles(files);
});

$dropZone.on('dragover', function(e) {
  e.preventDefault();
});

$dropZone.on('dragleave', function(e) {
  e.preventDefault();
  hideDropZone();
});

$('html').on('dragenter', function(e) {
  e.preventDefault();
  showDropZone();
});

// EVENTS //
// Removes options popup by clicking elsewhere
$(document).on("click", function(e) {
    if ($(e.target).is(".new-menu") === false && $(e.target).is("ul") === false) {
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

    // Remove any selected field
    $('.file-row input[type="checkbox"]').each(function() {
      $(this).prop('checked', false);
      $(this).parents('.file-row').removeClass('active');
      $('.file-cell.selectable').removeClass('active');
      $('.file-row').removeClass('passive');
    });
    // Hide side actions
    $('.side-actions').removeClass('active');
    $('.side-actions .item').removeClass('show');
    $('.help-tips').removeClass('hidden');

    if ($parent.data('file-type') === 'folder') {
      // Store to nav stack
      backItem = _.find(folders, ['id', id]);
      backItem.tempElement = $('.file-row[data-id="' + id + '"]');
      backItem.back = function() {
        getFolderContents(backItem.tempElement);
      };
      backItem.type = 'folderId';
      navStack.push(backItem);

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
    getFolderContents($(this), true);
  })
  .on('click', '[data-create-folder]', function(event) {
    // Creates folder
    var folderName = prompt('Type folder name');
    var lastFolderSelected = navStack[navStack.length - 1];

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
  .on('click', '.new-btn', function(event) {
    $(this).next('.new-menu').toggleClass('active');

    event.stopPropagation();
  })
  .on('click', '.file-row > div:not(.selectable)', function() {
    $(this).parents('.file-table-body').find('.file-row.active input[type="checkbox"]').click();
    $(this).parents('.file-row').find('input[type="checkbox"]').click();
  })
  .on('change', '.file-row input[type="checkbox"]', function() {
    $(this).parents('.file-row').toggleClass('active');
    checkboxStatus();
  })
  .on('change', '.file-table-header input[type="checkbox"]', function() {
    toggleAll($(this));
  })
  .on('click', '[delete-action]', function() {
    var items = $('.file-row.active');

    var alertConfirmation = confirm("Are you sure you want to delete all selected items?\nAll the content inside a folder will be deleted too.");

    if (alertConfirmation === true) {
      $(items).each(function() {
        var $element = $(this);

        if ($element.attr('data-file-type') === 'folder') {
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
  .on('click', '[download-action]', function() {
    var items = $('.file-row.active'),
        context = navStack[navStack.length - 1],
        contextType = context.type,
        contextId = context.id,
        files,
        folders,
        params = '',
        contentToZip = {
          files: [],
          folders: []
        };

    $(items).each(function() {
      var $element = $(this);

      if ($element.attr('data-file-type') === 'folder') {
        contentToZip.folders.push($element.attr('data-id'));
      } else {
        contentToZip.files.push($element.attr('data-id'));
      }
    });

    if (contentToZip.files.length) {
      files = contentToZip.files.toString();
      params += '&files=' + files;
    }
    if (contentToZip.folders.length) {
      folders = contentToZip.folders.toString();
      params += '&folders=' + folders;
    }

    window.location.href = '/v1/media/zip?' + contextType + '=' + contextId + params;
  })
  .on('click', '[open-action]', function() {
    // Open folder or file
    var itemID = $('.file-row.active').data('id');
    var fileURL = $('.file-row.active').data('file-url');

    if (fileURL !== undefined) {
      window.open(fileURL, '_blank');
    } else {
      $('.file-row.active').find('.file-name').dblclick();
    }
  })
  .on('click', '[rename-action]', function() {
    // Rename folder or file
    var itemID = $('.file-row.active').data('id');
    var itemType = $('.file-row.active').data('file-type');
    var fileName = $('.file-row[data-id="' + itemID + '"]').find('.file-name span').text();

    var changedName = prompt("Please enter the file name", fileName);

    if (changedName !== null) {
      if (itemType === "folder") {
        Fliplet.Media.Folders.update(itemID, {
          name: changedName
        }).then(function() {
          $('.file-row[data-id="' + itemID + '"]').find('.file-name span').html(changedName);
        });
      } else {
        Fliplet.Media.Files.update(itemID, {
          name: changedName
        }).then(function() {
          $('.file-row[data-id="' + itemID + '"]').find('.file-name span').html(changedName);
        });
      }
    }
  })
  .on('click', '.header-breadcrumbs [data-breadcrumb]', function() {
    var index = $(this).data('breadcrumb');
    var position = index + 1;

    navStack.splice(position, 9999);
    navStack[index].back();
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

// INIT //
getOrganizationsList();
