/* eslint-disable */
var widgetId = parseInt(Fliplet.Widget.getDefaultId(), 10);
var data = Fliplet.Widget.getData(widgetId) || {};
var $folderContents = $('.file-table-body');
var $organizationList = $('.dropdown-menu-holder .panel-group');
var $progress = $('.progress');
var $progressBar = $progress.find('.progress-bar');
var $dropZone = $('#drop-zone');
var $dropZoneWrapper = $('.drop-zone-wrapper');
var templates = {
  file: template('file'),
  folder: template('folder'),
  organizations: template('organizations'),
  apps: template('apps')
};
var $searchType = $('.search-type');
var $searchTerm = $('.search-term');
var $searchTermClearBtn = $('#search-term-clear');
var $fileTable = $('.file-table');
var $pagination = $('.pagination');
var goToFolderAlertTimeout = 5000;
var $spinner = $('.spinner-holder');
var $newBtn = $('.new-btn');
var $selectAllCheckbox =  $('.file-cell.selectable');

var appList;
// This should contain either app/org/folder of current folder
var currentSelection;

var currentOrganizationId;
var currentFolderId;
var currentAppId;
var currentFolders;
var currentFiles;
var restoredItems = 0;
var counterOrganization;
var currentSearchResult;

var tetherBox;

var folders = [];
var apps;
var organizations;
var navStack = [];
var beforeSearchNavStack = [];

var sideBarMinWidth = 240;
var sideBarMaxWidth = 395;

var searchDebounceTime = 500;
var isActiveSearch = false;

// Keep it as false because people copy this URL and use it into their apps,
// therefore we want this to be an clean direct link to the API with no token.
var useCdn = false;

// CORE FUNCTIONS //
// Get organizations and apps list for left side menu
function getOrganizationsList() {
  counterOrganization = 0;

  $('[restore-action]').hide();
  $('[file-remove-trash]').hide();

  showSpinner(true);

  Fliplet.Organizations.get().then(function(organizations) {
    // Sort alphabetically
    organizations = _.sortBy(organizations, [function(o) {
      return o.name;
    }]);
    // Add to HTML
    organizations.forEach(addOrganizations);
  }).then(function() {
    getAppsList();
    $selectAllCheckbox.addClass('active');
    showSpinner(false);

    if(data.context === 'app-overlay' || data.appId) {
      $('[data-help-link]').addClass('hidden');
    }
  }).catch(function (err) {
    showSpinner(false);
    Fliplet.Modal.alert({
      message: Fliplet.parseError(err)
    })
  });
}

function parseThumbnail(file) {
  if (file.thumbnail) {
    file.thumbnail = Fliplet.Media.authenticate(file.thumbnail);
    return;
  }

  file.thumbnail = Fliplet.Media.authenticate(file.url.replace(Fliplet.Env.get('apiUrl'), Fliplet.Env.get('apiCdnUrl')));
}

function navigateToRootFolder(options) {
  var $itemFolder = options.appId
    ? $('[data-app-id="' + options.appId + '"][data-browse-folder]')
    : $('[data-org-id="' + options.orgId +'"][data-browse-folder]');

  // Deselection of  all active files when user switches folder
  $itemFolder.parents('.file-manager-body').find('.file-row.active input[type="checkbox"]').click();
  $('[restore-action], [file-remove-trash]').hide();
  $('[rename-action], [delete-action]').show();

  disableSearchState();
  resetUpTo($itemFolder);
  updateSearchTypeOptions($itemFolder.data('type'));

  return getFolderContents($itemFolder, true);
}

function navigateToFolder($item) {
  var id = $item.data('id');
  var backItem;

  removeSelection();
  hideSideActions();
  disableSearchState();

  // Making a backstack item
  backItem = _.find(folders, ['id', id]);
  backItem.tempElement = $item;
  backItem.back = function() {
    getFolderContents(backItem.tempElement);
  };
  backItem.type = 'folderId';

  navStack.push(backItem);

  updatePaths();
  getFolderContents($item);
}

function navigateToFolderItem(item) {
  var rootId = item.data('app-id')
    ? { appId: item.data('app-id') }
    : { orgId: item.data('org-id') };

  if (item.data('folder')) {
    navigateToRootFolder(rootId)
      .then(function() {
        navigateToFolder($('.file-row[data-id="' + item.data('folder') + '"][data-file-type="folder"]'));
      });
  } else {
    navigateToRootFolder(rootId);
  }
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

  if (data.appId) {
    getFolderContents($el, true);
    return;
  }
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
  }
  getFolderContentsById(folderId, type);
}

function getAppsList() {
  showSpinner(true);

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
    appList = apps;

    navigateToDefaultFolder();
    showSpinner(false);
  }).catch(function (err) {
    showSpinner(false);
    Fliplet.Modal.alert({
      message: Fliplet.parseError(err)
    })
  });
}

function getFolderContentsById(id, type, isSearchNav) {
  var options = {
    cdn: useCdn
  };

  var filterFiles = function(files) {
    return true
  };
  var filterFolders = function(folders) {
    return true
  };

  if (type === "app") {
    options.appId = currentAppId = id;
    currentFolderId = null;

    // Filter functions
    filterFiles = function(file) {
      return !file.mediaFolderId;
    };
    filterFolders = function(folder) {
      return !folder.parentFolderId;
    };
  } else if (type  === "organization") {
    options.organizationId = currentOrganizationId = id;
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
    options.folderId = currentFolderId = id;
  }

  currentFolders = [];
  currentFiles = [];
  $folderContents.empty();

  showSpinner(true);

  Fliplet.Media.Folders.get(options).then(function(response) {
    if (!isSearchNav) {
      var navItem = navStack[navStack.length - 1];
      switch (navItem.type) {
        case 'organizationId':
          return;
        case 'appId':
          // User is no longer browsing the app folder
          if (!options.hasOwnProperty('appId') || parseInt(options.appId, 10) !== navItem.id) {
            return;
          }
          break;
        case 'folderId':
          // User is no longer browsing folder
          if (!options.hasOwnProperty('folderId') || parseInt(options.folderId, 10) !== navItem.id) {
            return;
          }
          break;
      }

      if (!$folderContents.is(':empty')) {
        // Content already rendered from a recent request. Do nothing.
        return;
      }
    }
    if (response.files.length === 0 && response.folders.length === 0) {
      $('.empty-state').addClass('active');
      $selectAllCheckbox.addClass('active');
    } else {
      folders = response.folders;

      // Filter only the files from that request app/org/folder
      var mediaFiles = response.files.filter(filterFiles);
      var mediaFolders = response.folders.filter(filterFolders);

      mediaFiles.forEach(parseThumbnail);

      mediaFolders.forEach(addFolder);
      mediaFiles.forEach(addFile);

      renderList();
    }
  }, function() {
    $('.empty-state').addClass('active');
  }).then(function () {
    showSpinner(false);
  }).catch(function (err) {
    showSpinner(false);
    Fliplet.Modal.alert({
      message: Fliplet.parseError(err)
    })
  });
}

function loadTrashFolder() {
  $('[data-browse-trash] span').addClass('active-trash');
  $('[restore-action]').show(); 
  $('[file-remove-trash]').show();  
  $('[rename-action]').hide();
  $('[delete-action]').hide();

  var $element = $('[data-browse-trash]');

  disableSearchState();
  resetUpTo($element);
  getFolderContents($element, true);
  updateSearchTypeOptions($element.data('type'));
}

function restoreAction(type, id) {
  var url = 'v1/media/' + type + '/' + id + '/restore';

  return Fliplet.API.request({
    url: url,
    method: 'POST',
  }).then(function() {
    updateCheckboxStatus();
    restoredItems++;

    $('.file-table-header input[type="checkbox"]').prop('checked', false);
  });
}

function restoreParentFolder(options) {
  Fliplet.API.request(options.request)
    .then(function(result) {
      if (!result) { return; }

      showSpinner(false);
      loadTrashFolder();

      Fliplet.Modal.confirm({
        title: 'Restore complete',
        message: options.parentFolderName + ' restored',
        buttons: {
          cancel: {
            label: 'Go to folder',
            className: 'btn-default'
          },
          confirm: {
            label: 'OK',
            className: 'btn-primary'
          }
        }
      }).then(function(result) {
        if (!result) {
          navigateToFolderItem(options.element);
        }
      });
    }).catch(function(error) {
      showSpinner(false);
      
      Fliplet.Modal.alert({
        title: 'Restore failed',
        message: Fliplet.parseError(error)
      });

      $('.file-table-body .file-row').removeClass('restore-fade');
    });
}

function restoreTrashItems(items) {
  restoredItems = 0;

  var restorePromises = [];

  $(items).each(function() {
    var $element = $(this);
    var itemID = Number($element.attr('data-id'));
    var itemName = $element.attr('data-name');
    var parentFolderId = $element.attr('data-folder');
    var itemType = $element.data('file-type') === 'folder'
      ? 'folders'
      : 'files'

    showSpinner(true);

    $element.addClass('restore-fade');

    if (navStack.length > 1 && parentFolderId) {
      var parentFolderName = navStack[navStack.length - 1].name;

      Fliplet.Modal.confirm({
        title: 'Restoration failed',
        message: '<span style="font-weight: bold;">' + itemName + '</span> cannot be restored. To restore this file, you`ll need to restore the <span style="font-weight: bold;">' + parentFolderName + '</span> folder',
        buttons: {
          cancel: {
            label: 'Cancel',
            className: 'btn-default'
          },
          confirm: {
            label: 'Restore',
            className: 'btn-primary'
          },
        },
      }).then(function(result) {
        if (result) {
          restoreParentFolder({
            request: {
              url: 'v1/media/folders/' + parentFolderId + '/restore',
              method: 'POST'
            },
            parentFolderName: parentFolderName,
            element: $element
          });
        }
      });

      return false;
    }

    if ($('[data-browse-trash] span').hasClass('active-trash')) {
      restoreAction(itemType, itemID).then(function() {
        $element.removeClass('restore-fade');
        showSpinner(false);

        _.remove(itemType === 'folders'
          ? currentFolders
          : currentFiles, function(item) {
            return item.id !== itemID;
          });

        $element.remove();

        if (!currentFolders.length || !currentFiles.length) {
          $('.empty-state').addClass('active');
        }

        if (restoredItems === items.length && restoredItems !== 1) {
          Fliplet.Modal.alert({
            title: 'Restore complete',
            message: items.length + ' items restored'
          });
        } else if (restoredItems === items.length && restoredItems === 1) {
          Fliplet.Modal.confirm({
            title: 'Restore complete',
            message: itemName + ' restored',
            buttons: {
              cancel: {
                label: 'Go to folder',
                className: 'btn-default'
              },
              confirm: {
                label: 'OK',
                className: 'btn-primary'
              },
            },
          }).then(function(result) {
            if (!result) {
              navigateToFolderItem($element);
            }
          });
        }
      }).catch(function(error) {
        showSpinner(false);

        Fliplet.Modal.alert({
          title: 'Restore failed',
          message: Fliplet.parseError(error),
        });
      });

      return;
    }

    showSpinner(false);
    $element.removeClass('restore-fade');

    return restorePromises.push(restoreAction(itemType, itemID));
  });

  if (restorePromises.length) {
    return Promise.all(restorePromises);
  }
}

function removeTrashItems(items) {
  restoredItems = 0;

  $(items).each(function() {
    var $element = $(this);
    var itemID = $element.attr('data-id');
    var itemName = $element.attr('data-name');
    var deletePromise;

    showSpinner(true);

    if ($element.attr('data-file-type') === 'folder') {
      deletePromise = Fliplet.API.request({
        url: 'v1/media/deleted/folders/' + itemID,
        method: 'DELETE'
      }).then(function() {
        $element.remove();
        updateCheckboxStatus();
        restoredItems++;

        currentFolders = currentFolders.filter(function(folder){
          return folder.id != itemID;
        });
        $('.file-table-header input[type="checkbox"]').prop('checked', false);
      })
    } else {
      deletePromise = Fliplet.API.request({
        url: 'v1/media/deleted/files/' + itemID,
        method: 'DELETE'
      }).then(function() {
        $element.remove();
        updateCheckboxStatus();
        restoredItems++;

        currentFiles = currentFiles.filter(function(file){
          return file.id != itemID;
        });

        $('.file-table-header input[type="checkbox"]').prop('checked', false);
      })
    }

    deletePromise.then(function(result) {
      showSpinner(false);

      if (restoredItems === items.length) {
        var title = 'Deletion complete'
        Fliplet.Modal.alert({
          title: title,
          message: restoredItems !== 1 ? items.length + ' items deleted' : itemName + ' deleted',
        })
      }
    }).catch(function(error) {
      showSpinner(false);
      Fliplet.Modal.alert({
        title: 'Deletion failed',
        message: Fliplet.parseError(error)
      })
    })
  })
}

// Get folders and files depending on ID (Org, App, Folder) to add to the content area
function getFolderContents(el, isRootFolder) {
  if (isRootFolder) {
    // Restart breadcrumbs
    var $el = el;
    var $listHolder;
    
    if ($el.data('type') === 'organization') {
      $listHolder = $el;
    } else if ($el.data('type') === 'trash') {
      $listHolder = $el;
    } else {
      $listHolder = $el.find('.list-holder');
    }

    $('.dropdown-menu-holder').find('.list-holder.active').removeClass('active');
    if ($el.data('type') === 'trash') {
      $('[data-browse-trash] span').addClass('active-trash');
    } else if ($el.data('type') === 'organization' || $el.data('type') === 'app') {
      $('[data-browse-trash] span').removeClass('active-trash');
      $listHolder.first().addClass('active');
    } else {
      $listHolder.first().addClass('active');
    }
  }

  var options = {
    cdn: useCdn
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
    options.organizationId = currentOrganizationId = el.attr('data-org-id');
    currentAppId = null;
    currentFolderId = null;

    // Filter functions
    filterFiles = function(file) {
      return !(file.appId || file.mediaFolderId);
    };
    filterFolders = function(folder) {
      return !(folder.appId || folder.parentFolderId);
    };
  } else if (el.attr('data-type') === 'trash') {
    currentFolderId = null;
  } else {
    options.folderId = el.attr('data-id');
    currentFolderId = el.attr('data-id');
  }

  currentFolders = [];
  currentFiles = [];
  $folderContents.empty();

  showSpinner(true);

  // Default filter functions
  var filterFiles = function() {
    return true
  };
  var filterFolders = function() {
    return true
  };

  if (el.attr('data-type') === 'trash') {
    return getTrashFilesData(filterFiles, filterFolders);
  }

  return getFoldersData(options, filterFiles, filterFolders);
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
  folder.formattedDate = formatDate(folder.createdAt);

  if(folder.deletedAt !== null) {
    folder.deletedAt = formatDate(folder.deletedAt)
  }

  currentFolders.push(folder);
  folders.push(folder);

  $('.empty-state').removeClass('active');
  // Toggle checkbox header to false
  $('.file-table-header input[type="checkbox"]').prop('checked', false);
  $selectAllCheckbox.css({'opacity': '1', 'visibility': 'visible'});
}

// Adds file item template
function addFile(file) {
  file.formattedDate = formatDate(file.createdAt);

  if(file.deletedAt !== null) {
    file.deletedAt = formatDate(file.deletedAt)
  }

  currentFiles.push(file);

  $('.empty-state').removeClass('active');
  $('.new-menu').removeClass('active');

  // Toggle checkbox header to false
  $('.file-table-header input[type="checkbox"]').prop('checked', false);
  $selectAllCheckbox.css({'opacity': '1', 'visibility': 'visible'});
}

// Templating
function template(name) {
  return Handlebars.compile($('#template-' + name).html());
}

function updateCheckboxStatus() {
  var numberOfRows = $('.file-row').length;
  var numberOfActiveRows = $('.file-row.active').length;
  var fileURL = $('.file-row.active').data('file-url');
  $('.items-selected').html(numberOfActiveRows > 1 ? numberOfActiveRows + ' items' : numberOfActiveRows + ' item');

  if (numberOfRows === 0) {
    $('.empty-state').addClass('active');
    $selectAllCheckbox.removeClass('active');
  }

  if ($('.file-row').hasClass('active')) {
    $('.side-actions').addClass('active');
    $selectAllCheckbox.addClass('active');
    $('.file-row').not(this).addClass('passive');
    $('.help-tips').addClass('hidden');
  } else {
    $('.side-actions').removeClass('active');
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
      $('.side-actions').addClass('active');
      $('.help-tips').addClass('hidden');
    });
  } else {
    $('.file-row input[type="checkbox"]').each(function() {
      $(this).prop('checked', false);
      $(this).parents('.file-row').removeClass('active');
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
    var type = '';
    var idType = '';
    var dataType = '';

    for (var i = 0; i < navStack.length; i++) {
      switch (navStack[i].type) {
        case 'organizationId':
          type = 'organization';
          idType = 'data-org-id';
          dataType = 'data-type';
          break;
        case 'appId':
          type = 'app';
          idType = 'data-app-id';
          dataType = 'data-type';
          break;
        case 'folderId':
          type = 'folder';
          idType = 'data-id';
          dataType = 'data-file-type';
          break;
        default:
          throw new Error('Not supported type');
      }

      breadcrumbsPath += '<span class="bread-link"' + dataType + '="' + type + '" ' + idType + '="'
        + navStack[i].id + '"><a href="#" data-breadcrumb="' + i + '">' + navStack[i].name + '</a></span>';
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

// Resets navigation to first item
function resetToTop(){
  navStack = [navStack[0]];
  updatePaths();
}

function getFoldersData(options, filterFiles, filterFolders) {
  return Fliplet.Media.Folders.get(options).then(function(response) {
    var navItem = navStack[navStack.length - 1];
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
      $selectAllCheckbox.addClass('active');
      $('.empty-state').addClass('active');
    } else {
      folders = response.folders;

      // Filter only the files from that request app/org/folder
      var mediaFiles = response.files.filter(filterFiles);
      var mediaFolders = response.folders.filter(filterFolders);

      mediaFolders.forEach(addFolder);
      mediaFiles.forEach(addFile);

      mediaFiles.forEach(parseThumbnail);

      $('.file-date-cell').show();
      $('.file-deleted-cell').hide();

      renderList();
    }
  }, function() {
    $('.empty-state').addClass('active');
  }).then(function () {
    showSpinner(false);
  }).catch(function (err) {
    showSpinner(false);
    Fliplet.Modal.alert({
      message: Fliplet.parseError(err)
    })
  });
}

function getTrashFilesData(filterFiles, filterFolders) {  
  Fliplet.API.request('v1/media/deleted').then(function(result) {
    if (result.files.length === 0 && result.folders.length === 0) {
      $selectAllCheckbox.addClass('active');
      $('.empty-state').addClass('active');
    } else {
      folders = result.folders;

      // Filter only the files from that request app/org/folder
      var mediaFiles = result.files.filter(filterFiles);
      var mediaFolders = result.folders.filter(filterFolders);

      mediaFolders.forEach(addFolder);
      mediaFiles.forEach(addFile);

      mediaFiles.forEach(parseThumbnail);

      $('.file-date-cell').hide();
      $('.file-deleted-cell').show();

      renderList();
    }

    showSpinner(false);
  })
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

    // Folders have no extension and are less than 1KB in size
    if (!file.type && file.size <= 1024) {
      return Fliplet.Modal.alert({
        message: 'Uploading folders is not supported. Please create a folder and upload files into the folder.'
      });
    }

    formData.append('name[' + i + ']', file.name);
    formData.append('files[' + i + ']', file);
  }

  $progressBar.css({
    width: '0%'
  });
  $progress.removeClass('hidden');

  Fliplet.Media.Files.upload({
    organizationId: currentOrganizationId,
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
      insertItem(file);
    });

    $progress.addClass('hidden');
  });
}


// Sorts items by name
function sortItems(items) {
  return _.sortBy(items, [
    function (item) {
      return item.name.toLowerCase();
    },
    'id'
  ]);
}

// Adds single item to DOM
function renderItem(item, isFolder, insertIndex) {
  var template = isFolder ? templates.folder(item) : templates.file(item);

  if (insertIndex >= 0) {
    var $item = $folderContents.find('.file-row').eq(insertIndex);
    $item.before(template);
  } else {
    $folderContents.append(template);
  }
}

// Renders sorted list of folders and files
function renderList() {
  var folders = sortItems(currentFolders);
  var files = sortItems(currentFiles);

  $folderContents.empty();

  folders.forEach(function (folder) {
    renderItem(folder, true);
  });

  files.forEach(function (file) {
    renderItem(file, false);
  });

  $selectAllCheckbox.addClass('active');
}

//Finds insert index for a new item
function findItemInsertIndex(item, isFolder) {
  var items = sortItems(currentFolders).concat(sortItems(currentFiles));
  items = items.filter(function (i) {
    return i.id !== item.id;
  });

  var insertIndex = -1;

  for (var i = 0; i < items.length; i++) {
    if (items[i].name.toLowerCase() > item.name.toLowerCase()) {
      insertIndex = i;
      break;
    }
  }

  if (insertIndex === -1) {
    if (isFolder) {
      if (currentFolders.length) {
        if (currentFiles.length) {
          insertIndex = currentFolders.length - 1;
        }
      } else {
        if (currentFiles.length) {
          insertIndex = 0;
        }
      }
    }
  }

  return insertIndex;
}

//Inserts new item to a specific position to the item list
function insertItem(item, isFolder) {
  var insertIndex = findItemInsertIndex(item, isFolder);
  renderItem(item, isFolder, insertIndex);
}

function search(type, term) {
  var query = {
    name: term
  };

  // If the user put anything except a numbers _.toNumber function will return a NaN result
  if (_.toNumber(term)) {
    query.id = term
  }

  if (type == 'all') {
    if (currentAppId) {
      query.appId = currentAppId;
    } else {
      query.organizationId = currentOrganizationId;
    }
  } else {
    if (currentFolderId) {
      query.folderId = currentFolderId;
    } else if (currentAppId) {
      query.appId = currentAppId;
    } else {
      query.organizationId = currentOrganizationId;
    }
  }

  isActiveSearch = true;

  return Fliplet.Media.Folders.search(query).then(function (result) {
    if (isActiveSearch) {
      currentSearchResult = result;
      renderSearchResult(result, type);
    }
  });
}

function renderSearchResult(result, searchType) {
  enableSearchState();

  if (!result || !result.length) {
    showNothingFoundAlert(true);
    removePagination();
    return;
  }

  if (searchType == 'all') {
    resetToTop();
  }

  result = result
    .filter(function (item) {
      if (currentAppId || currentFolderId || searchType === 'all') {
        return !item.deletedAt;
      } else {
        return !item.deletedAt && !item.mediaFolderId && !item.appId;
      }
    })
    .map(function (item) {
      item.relativePath = calculatePath(item);

      if (item.parentId) {
        item.parentItemType = 'folder';
        item.parentItemId = item.parentId;
      } else if (item.appId) {
        item.parentItemType = 'app';
        item.parentItemId = item.appId;
      } else {
        item.parentItemType = 'organization';
        item.parentItemId = item.organizationId;
      }

      if (item.type !== 'folder') {
        item.dimensions = item.size ? item.size.join('x') : null;
      }

      return item;
    });

  $pagination.pagination({
    dataSource: result,
    pageSize: 10,
    callback: function (data) {

      $folderContents.empty();
      currentFolders = [];
      currentFiles = [];

      data.forEach(function (item) {
        if (item.type === 'folder') {
          addFolder(item)
        } else {
          item.dimensions = item.size ? item.size.join('x') : null;
          addFile(item);
        }
      });

      renderList();
    }
  });
}

// Builds a relative path to folder or file
function calculatePath(item) {
  var path = [];
  var separator = '/';
  var isLast = false;

  var getNames = function (item) {
    if (!item) {
      return;
    }
    if (item.parentFolder) {
      getNames(item.parentFolder);
    } else {
      isLast = true;
    }

    if (isLast && item.id === +currentFolderId) {
      return;
    }

    path.push(item.name);
  };

  getNames(item.parentFolder);
  return separator + path.join(separator);
}

// Converts date to readable date format
function formatDate(date) {
  return moment(date).format("MMM D, YYYY");
}

// Remove any selected field
function removeSelection() {
  $('.file-row input[type="checkbox"]').each(function () {
    var $item = $(this);
    $item.prop('checked', false);
    $item.parents('.file-row').removeClass('active');
    $selectAllCheckbox.removeClass('active');
    $('.file-row').removeClass('passive');
  });
}

// Hide side action menu
function hideSideActions() {
  $('.side-actions').removeClass('active');
  $('.side-actions .item').removeClass('show');
  $('.help-tips').removeClass('hidden');
}

function updateBreadcrumbsBySearchItem(item) {
  if (!item) {
    return;
  }

  var nav = [];
  var isLast = false;

  var getParents = function (parent) {
    if (parent.parentFolder) {
      getParents(parent.parentFolder);
    } else {
      isLast = true;
    }

    if (isLast && parent.id === +currentFolderId) {
      return;
    }

    nav.push({
      id: parent.id,
      name: parent.name,
      type: 'folderId',
      back: function () {
        getFolderContentsById(parent.id, 'folder');
      }
    });
  };

  getParents(item);

  navStack = navStack.concat(nav);
  updatePaths();
}

function enableSearchState() {
  $folderContents.empty();
  $fileTable.addClass('search-result');
  $newBtn.prop('disabled', true);
  $searchTermClearBtn.removeClass('hide');
  showNothingFoundAlert(false);
  beforeSearchNavStack = navStack;
}

function disableSearchState() {
  isActiveSearch = false;
  $fileTable.removeClass('search-result');
  $searchTerm.val('');
  $newBtn.prop('disabled', false);
  $searchTermClearBtn.addClass('hide');
  showNothingFoundAlert(false);
  removePagination();
}

function removePagination() {
  if (!$pagination.is(':empty')) {
    $pagination.pagination('destroy');
  }
}

function updateSearchTypeOptions(type) {
  var optionName = 'This organization';
  if (type === 'app') {
    optionName = 'This app';
  }

  $searchType.find('option:first').text(optionName);
}

// Shows content of the last folder before run search
function backToLastFolderBeforeSearch() {
  var navItem = _.last(beforeSearchNavStack);
  navItem.back();
  navStack = beforeSearchNavStack;
  updatePaths();
}

function showNothingFoundAlert(isShow) {
  if (isShow) {
    $('.empty-state').removeClass('active');
    $('.search-empty-state').addClass('active');
  } else {
    $('.search-empty-state').removeClass('active');
  }
}

function showGoToFolderAlert(item, area) {
  var goToButton = $('#alert-btn-action').attr('data-type', area.type);

  if (area.type === 'organization') {
    goToButton.attr('data-id', area.orgId);
  } else if (area.type === 'app') {
    goToButton.attr('data-id', area.appId);
  } else {
    goToButton.attr('data-id', area.id);
  }

  $('.alert-action').addClass('active');
  $('.alert-message').text(item.length + ' item(s) moved');
  setTimeout(function() {
    setAlertVisibilityWhenMovingItems(false);
  }, goToFolderAlertTimeout);
}

// Check items if they are checked before moving
function checkDraggedFileIfSelected(draggedItem, selectedItems) {
  var res = false;
  if (!selectedItems.length) {
    return false;
  }
  for (var i = 0; i <= selectedItems.length; i++) {
    if($(selectedItems[i]).attr('data-id') === draggedItem.id.toString()) {
      res = true;
      break;
    }
  }
  return res;
}

// Change opacity when moving folders or files
function setOpacityWhenMovingItems(item) {
  $(item).css({ opacity: '0.3' }).removeClass('active');
}

// Create object for moving Items
function moveItem(dropZone, isFolder) {
  var movedPlace = {};
  var parent = isFolder ? 'parentId' : 'mediaFolderId';
  if (dropZone.type === 'organization') {
    movedPlace.appId = null;
    movedPlace[parent] = null;
    movedPlace.organizationId = dropZone.orgId;
  } else if (dropZone.type === 'app') {
    movedPlace.appId = dropZone.appId;
    movedPlace[parent] = null;
  } else if (dropZone.fileType === 'folder') {
    movedPlace[parent] = dropZone.id;
  } else {
    return false;
  }
  return movedPlace;
}

function moveItems(folderType, id, dropArea, element, items) {
  if (folderType === 'folder') {
    Fliplet.Media.Folders.update(id, moveItem(dropArea, true)).then(function(response) {
      if (response.folder) {
        element.remove();
        showGoToFolderAlert(items || element, dropArea);
        hideSideActions();
      }
    }).catch(function() {
        alert('Folder could not be moved');
      });
  } else {
    Fliplet.Media.Files.update(id, moveItem(dropArea, false)).then(function(response) {
      if (response.file) {
        element.remove();
        showGoToFolderAlert(items || element, dropArea);
        hideSideActions();
      }
    }).catch(function() {
        alert('File could not be moved');
      });
  }
}

function setAlertVisibilityWhenMovingItems(isShow) {
  if (isShow) {
    $('.alert-action').removeClass('active');
    $('.alert-wrapper').addClass('active');
  } else {
    $('.alert-wrapper').removeClass('active');
    $('#alert-btn-action').removeAttr('data-type');
  }
}

// Go to folder where dropped items
$('#alert-btn-action').on('click', function() {
  var $button = $(this);
  var dataType = $button.attr('data-type');
  var dataIdAttribute = $button.attr('data-id');

  if (dataType === 'organization') {
    $('.list-holder[data-org-id="' + dataIdAttribute + '"]').click();
  } else if (dataType === 'app') {
    $('.app-holder[data-app-id="' + dataIdAttribute + '"]').click();
  } else {
    $('.file-row[data-id="' + dataIdAttribute + '"]').find('.file-name').dblclick();
    $('.header-breadcrumbs  [data-id="' + dataIdAttribute + '"] [data-breadcrumb]').click();
  }
  setAlertVisibilityWhenMovingItems(false);
});

function showSpinner(isShow) {
  if (isShow) {
    $spinner.addClass('animated');
  } else {
    $spinner.removeClass('animated');
  }
}

// Hide Global drop zone for moving files in the app and activate Global drop zone for moving files from desktop
function changeGlobalDropZoneState (enableGlobalDropZone) {
  if (enableGlobalDropZone) {
    $dropZoneWrapper.addClass('hide');
  } else {
    $dropZoneWrapper.removeClass('hide');
    hideDropZone();
  }
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

// Generate correct modal delete message
function generateDeleteMessage(items) {
  var foldersCount = 0;
  var filesCount = 0;

  $(items).each(function() {
    if ($(this).data('file-type') === 'folder') {
      foldersCount++;
    } else {
      filesCount++;
    }
  });

  if (foldersCount === 0 && filesCount === 1) {
    return 'Are you sure you want to delete the file?';
  } else if (foldersCount === 0 && filesCount > 1) {
    return 'Are you sure you want to delete the selected files?';
  } else if (foldersCount === 1 && filesCount === 0) {
    return 'Are you sure you want to delete the folder?\nAll content inside the folder will be deleted too.';
  } else if (foldersCount > 1 && filesCount === 0) {
    return 'Are you sure you want to delete the selected folders?\nAll content inside the folders will be deleted too.';
  } else {
    return 'Are you sure you want to delete the selected items?\nAll the content inside any folders will be deleted too.';
  }
}

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

    $newBtn.click();
  })
  .on('dblclick', '.file-table-body [data-browse-folder], .file-table-body [data-open-file]', function(event) {
    var $el = $(this);
    var $parent = $el.parents('.file-row');
    var id = $el.parents('.file-row').data('id');

    removeSelection();
    hideSideActions();

    if ($parent.data('file-type') === 'folder') {
      navigateToFolder($parent);
    } else {
      var fileURL = $('.file-row[data-id="' + id + '"]').attr('data-file-url');

      if (fileURL !== undefined) {
        window.open(fileURL, '_blank');
      }
    }
  })
  .on('click', '[data-browse-trash]', function() {
    loadTrashFolder();
  })
  .on('click', '[restore-action]', function(event) {
    event.preventDefault();

    var $items = $('.file-row.active');
    restoreTrashItems($items);
  })
  .on('click', '[file-remove-trash]', function(event) {
    event.preventDefault();

    var $items = $('.file-row.active');
    Fliplet.Modal.confirm({
      titile: 'Delete items',
      message: 'The action will delete '
        + ($items.length > 1 ? $items.length + ' files' : 'the file')
        + ' forever and it can not be undone.',
      buttons: {
        cancel: {
          label: 'Cancel',
          className: 'btn-default'
        },
        confirm: {
          label: 'OK',
          className: 'btn-danger'
        }
      }
    }).then(function(confirmAlert) {
      if (confirmAlert){
        removeTrashItems($items)
      }
    })
  })
  .on('click', '.dropdown-menu-holder [data-browse-folder]', function(event) {
    var rootId = $(this).data('app-id')
      ? { appId: $(this).data('app-id') }
      : { orgId: $(this).data('org-id') };

    navigateToRootFolder(rootId);
  })
  .on('click', '[data-create-folder]', function(event) {
    // Creates folder
    Fliplet.Modal.prompt({
      title: 'Type folder name'
    }).then(function(result) {
      if (result === null) {
        return;
      }

      var dataSourceName = result.trim();
      var lastFolderSelected = navStack[navStack.length - 1];
      var options = {
        name: dataSourceName,
        parentId: currentFolderId || undefined
      };

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

      showSpinner(true);

      Fliplet.Media.Folders.create(options).then(function(folder) {
        addFolder(folder);
        insertItem(folder, true);
        showSpinner(false);
      }).catch(function(err) {
        showSpinner(false);
        Fliplet.Modal.alert({
          message: Fliplet.parseError(err)
        });
      });

      $newBtn.click();
    });
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
      organizationId: currentOrganizationId,
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
        insertItem(file);
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
    updateCheckboxStatus();
  })
  .on('change', '.file-table-header input[type="checkbox"]', function() {
    toggleAll($(this));
  })
  .on('click', '[delete-action]', function() {
    var items = $('.file-row.active');
    Fliplet.Modal.confirm({
      message: generateDeleteMessage(items),
      buttons: {
        cancel: {
          label: 'Cancel',
          className: 'btn-default'
        },
        confirm: {
          label: 'OK',
          className: 'btn-danger'
        }
      }
    }).then(function(result) {
      if (result) {
        var itemsToDelete = [];
        var itemType;

        showSpinner(true);

        $(items).each(function() {
          var $element = $(this);
          var itemID = Number($element.attr('data-id'));

          itemType = $element.attr('data-file-type');

          var deletionItemMethod = itemType === 'folder'
          ? 'Folders'
          : 'Files';

          itemsToDelete.push(Fliplet.Media[deletionItemMethod].delete(itemID));
        });

        Promise.all(itemsToDelete).then(function() {
          showSpinner(false);
          updateCheckboxStatus();

          var deletionMessage = itemsToDelete.length === 1
            ? 'You can access the deleted ' + itemType + ' in <b>File manager > Trash</b>'
            : 'You can access the deleted items in <b>File manager > Trash</b>';

          Fliplet.Modal.confirm({
            title: 'Moved to Trash',
            message: deletionMessage,
            buttons: {
              cancel: {
                label: 'Undo',
                className: 'btn-default'
              },
              confirm: {
                label: 'OK',
                className: 'btn-primary'
              }
            }
          }).then(function(deleteResult) {
            if (!deleteResult) {
              restoreTrashItems(items).then(function() {
                Fliplet.Modal.alert({
                  message: itemsToDelete.length === 1
                    ?  itemType +' restored from Trash'
                    : 'items restored from Trash'
                });
              }).catch(function(err) {
                Fliplet.Modal.confirm({
                  title: itemsToDelete.length === 1
                    ?  itemType +' restore failed'
                    : 'items restore failed',
                  message: Fliplet.parseError(err)
                });
              });

              return;
            }

            $('.file-table-header input[type="checkbox"]').prop('checked', false);

            $(items).each(function() {
              var $element = $(this);
              var itemID = Number($element.attr('data-id'));

              _.remove(itemType === 'folder'
                ? currentFolders
                : currentFiles, function(item) {
                  return item.id === itemID;
                });

              $element.remove();

            })

            if (!currentFolders.length && !currentFiles.length) {
              $('.empty-state').addClass('active');
            }
          })
        }).catch(function(err) {
          showSpinner(false);

          Fliplet.Modal.alert({
            message: Fliplet.parseError(err)
          });
        });
      }
    });
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

    Fliplet.Modal.prompt({
      title: 'Please enter the file name',
      value: fileName
    }).then(function(result) {
      if (result === null) {
        return;
      }

      var changedName = result.trim();
      var updatePromise;

      showSpinner(true);

      if (itemType === "folder") {
        updatePromise = Fliplet.Media.Folders.update(itemID, {
          name: changedName
        }).then(function() {
          $('.file-row[data-id="' + itemID + '"]').find('.file-name span').html(changedName);

          var folder = _.find(currentFolders, ['id', itemID]);
          folder.name = changedName;
        });
      } else {
        updatePromise = Fliplet.Media.Files.update(itemID, {
          name: changedName
        }).then(function() {
          $('.file-row[data-id="' + itemID + '"]').find('.file-name span').html(changedName);

          var file = _.find(currentFiles, ['id', itemID]);
          file.name = changedName;
        });
      }

      updatePromise.then(function () {
        showSpinner(false);
      }).catch(function (err) {
        showSpinner(false);
        Fliplet.Modal.alert({
          message: Fliplet.parseError(err)
        });
      });
    });
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
  })
  .on('keyup', '.search-term', _.debounce(function(){
    var term = $searchTerm.val();

    if (!term) {
      disableSearchState();
      backToLastFolderBeforeSearch();
      return;
    }

    removeSelection();
    hideSideActions();

    var type = $searchType.val();

    showSpinner(true);

    search(type, term)
      .then(function () {
        showSpinner(false);
      })
      .catch(function () {
        showSpinner(false);
        alert('Error on search files');
      });

  }, searchDebounceTime))
  .on('click', '#search-term-clear', function () {
    $searchTerm.val('').keyup();
    $searchTermClearBtn.addClass('hide');
  })
  .on('click', '.path-link', function () {
    var $el = $(this);
    var type = $el.data('type');
    var id = $el.data('id');

    if (type === 'app' || type === 'organization') {
      resetToTop();
    } else {
      var item = _.find(currentSearchResult, ['id', id]);
      updateBreadcrumbsBySearchItem(item);
    }

    getFolderContentsById(id, type, true);

    removeSelection();
    hideSideActions();
    disableSearchState();
  })
  .on('change', '.search-type', function(){
    if (!$searchTerm.val()){
      return;
    }

    var type = $searchType.val();
    if (type === 'all'){
      currentFolderId = null;
    }

    $searchTerm.keyup();
  })
  .on('dragstart', '.file-row', function(e) {
    changeGlobalDropZoneState(true);
    var dragingItem = $(e.target).data();
    e.originalEvent.dataTransfer.setData('text', JSON.stringify(dragingItem));
    $('.panel-title.list-holder').addClass('drop-area');
    $('.app-holder').addClass('drop-area');
    $('.file-row[data-file-type="folder"]').each(function() {
      var item = $(this);
      if (dragingItem.id != item[0].dataset.id && !$(item).hasClass('active')) {
        $(item).addClass('drop-area');
      }
    });
    $('.bread-link').addClass('drop-area').last().removeClass('drop-area');
  })
  .on('dragend', function(e) {
    $('.panel-title.list-holder').removeClass('drop-area');
    $('.app-holder').removeClass('drop-area');
    $('.file-row[data-file-type="folder"]').removeClass('drop-area');
    $('.bread-link').removeClass('drop-area');
    changeGlobalDropZoneState(false);
  })
  .on('drop', '.drop-area', function(e) {
    e.preventDefault();
    var area = $(this);
    var dropArea = area.data();
    var items = $('.file-row.active');
    var itemType = JSON.parse(e.originalEvent.dataTransfer.getData('text'));
    var $element = $('.file-row[data-id=' + itemType.id + ']');
    var checkDraggedItems = checkDraggedFileIfSelected(itemType, items);

    Fliplet.Modal.confirm({
      message: 'Are you sure you want to move these item(s)?'
    }).then(function(result) {
      if (!result) {
        return;
      }

      $('.drop-area').removeClass('highlight');

      setOpacityWhenMovingItems($element);

      // Show alert when moving item(s)
      setAlertVisibilityWhenMovingItems(true);

      if (checkDraggedItems) {
        $('.alert-message').text('Moving ' + items.length + ' item(s)...');
        $(items).each(function() {
          var $element = $(this);
          var folderType = $element.attr('data-file-type');
          var itemId = $element.attr('data-id');
          setOpacityWhenMovingItems($element);
          moveItems(folderType, itemId, dropArea, $element, items);
        });
      } else {
        $('.alert-message').text('Moving ' + $element.length + ' item(s)...');
        moveItems(itemType.fileType, itemType.id, dropArea, $element);
      }
    });
  })
  .on('dragover', '.drop-area', function (e) {
    e.preventDefault();
    $(this).addClass('highlight');
  })
  .on('dragleave', '.drop-area', function () {
    $(this).removeClass('highlight');
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
