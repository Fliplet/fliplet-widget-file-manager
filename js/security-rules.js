/* ============================================
   FILE SECURITY RULES UI — Demo/Prototype
   ============================================
   This file handles the security rules UI for
   the file manager widget. Currently uses mock
   data; integration points are clearly marked.
   ============================================ */

(function() {
  'use strict';

  // -----------------------------------------
  // [FILEAPI] MOCK DATA — Replace with real API
  // -----------------------------------------
  // All mock data below should be replaced with real API calls.
  // Search for [FILEAPI] across this file to find all integration points.
  //
  // Expected API endpoints:
  //   GET    /v1/media/folders/:id/accessRules  → returns { accessRules: [...] }
  //   PUT    /v1/media/folders/:id/accessRules  → body: { accessRules: [...] }
  //   GET    /v1/media/files/:id/accessRules    → returns { accessRules: [...] }
  //   PUT    /v1/media/files/:id/accessRules    → body: { accessRules: [...] }
  //
  // Each rule object: { allow, type, enabled, appId }

  // [FILEAPI] Mock folder access rules — replace with API call to GET /v1/media/folders/:id/accessRules
  var mockFolderRules = {
    'root': [
      { allow: 'all', type: ['read'], enabled: true, appId: null },
      { allow: 'loggedIn', type: ['create'], enabled: true, appId: null }
    ],
    '101': [
      { allow: 'loggedIn', type: ['read', 'create', 'update', 'delete'], enabled: true, appId: null }
    ],
    '102': [
      {
        allow: { user: { Role: { equals: 'Manager' } } },
        type: ['read', 'create', 'update', 'delete'],
        enabled: true,
        appId: null
      }
    ]
  };

  // [FILEAPI] Mock file access rules — replace with API call to GET /v1/media/files/:id/accessRules
  var mockFileRules = {
    '201': [
      { allow: 'all', type: ['read'], enabled: true, appId: null }
    ]
  };

  // [FILEAPI] Mock folder hierarchy — replace with real folder parent lookup from file manager data
  var mockFolderParents = {
    '101': 'root',
    '102': '101',
    '103': '101',
    '104': 'root'
  };

  // [FILEAPI] Mock folder names — replace with real folder name lookup from file manager data
  var mockFolderNames = {
    'root': 'App Files',
    '101': 'dashboard',
    '102': 'reports',
    '103': 'assets',
    '104': 'public'
  };

  // -----------------------------------------
  // UTILITIES
  // -----------------------------------------

  function escapeHtml(str) {
    if (!str) return '';

    return $('<span>').text(String(str)).html();
  }

  /**
   * Navigate the file manager UI to a specific folder.
   * Uses getFolderContentsById from interface.js which handles
   * breadcrumbs, nav stack, and content rendering.
   *
   * @param {string|number} folderId - The folder ID to navigate to
   * @param {Function} [callback] - Optional callback after navigation completes
   */
  function navigateFileManagerToFolder(folderId, callback) {
    if (typeof getFolderContentsById === 'function') {
      // getFolderContentsById(id, type, isSearchNav) is defined in interface.js
      getFolderContentsById(folderId, 'folder');

      if (callback) {
        // Allow time for the file manager to render before calling back
        setTimeout(callback, 500);
      }
    } else {
      // [FILEAPI] Fallback if getFolderContentsById is not available
      console.warn('[FileSecurityRules] getFolderContentsById not available for navigation');
    }
  }

  // -----------------------------------------
  // STATE
  // -----------------------------------------

  var currentSecurityTarget = null; // { type: 'folder'|'file', id: string, name: string }
  var currentRules = [];           // Working copy of rules being edited
  var savedRules = [];             // Last saved state (to detect changes)
  var hasUnsavedChanges = false;

  // -----------------------------------------
  // [FILEAPI] RULE RESOLUTION — uses mock data, replace with real API
  // -----------------------------------------

  // [FILEAPI] Replace mock lookups with real API calls
  function getOwnRules(type, id) {
    if (type === 'folder') {
      return (mockFolderRules[id] || []).slice();
    }

    return (mockFileRules[id] || []).slice();
  }

  // [FILEAPI] Replace mock inheritance walk with real API or server-side resolution
  function getEffectiveRules(type, id) {
    var own = getOwnRules(type, id);

    if (own.length > 0) {
      return { rules: own, inheritedFrom: null };
    }

    // [FILEAPI] For files, get the real mediaFolderId from the file object
    var folderId;

    if (type === 'file') {
      folderId = '101'; // [FILEAPI] Replace with file.mediaFolderId from file manager data
    } else {
      folderId = mockFolderParents[id] || null; // [FILEAPI] Replace with real parent folder lookup
    }

    while (folderId) {
      var folderRules = mockFolderRules[folderId] || []; // [FILEAPI] Replace with real rules lookup

      if (folderRules.length > 0) {
        return {
          rules: folderRules.slice(),
          inheritedFrom: { folderId: folderId, folderName: mockFolderNames[folderId] || folderId }
        };
      }

      folderId = mockFolderParents[folderId] || null; // [FILEAPI] Replace with real parent lookup
    }

    return { rules: [], inheritedFrom: null };
  }

  /**
   * Build a breadcrumb path from root to the given folder.
   * e.g. "App Files > dashboard > reports"
   * [FILEAPI] Replace mockFolderParents/mockFolderNames with real folder hierarchy
   */
  function getFolderPath(folderId) {
    var parts = [];
    var current = folderId;

    while (current) {
      parts.unshift(mockFolderNames[current] || current);
      current = mockFolderParents[current] || null;
    }

    return parts.join(' > ');
  }

  // -----------------------------------------
  // SECURITY STATUS FOR FILE TABLE (Layer 1)
  // -----------------------------------------

  function getSecurityStatus(type, id) {
    var effective = getEffectiveRules(type, id);

    if (effective.rules.length > 0) {
      return 'accessible';
    }

    return 'not-accessible';
  }

  function getSecurityBadgeHTML(status, detail, options) {
    options = options || {};

    switch (status) {
      case 'accessible':
        if (options.tableCell) {
          // Table column: just show CRUD values comma-separated
          return '<span class="security-badge-actions">' + (detail || 'Accessible') + '</span>';
        }

        return '<span class="security-badge security-badge-accessible">Accessible</span>' +
          (detail ? '<span class="security-badge-detail">' + detail + '</span>' : '');
      case 'not-accessible':
        return '<span class="security-badge security-badge-not-accessible">Not accessible</span>';
      default:
        return '';
    }
  }

  // Called after folder contents are rendered to inject security badges
  function updateSecurityBadges() {
    isUpdatingBadges = true;

    $('.file-row').each(function() {
      var $row = $(this);
      var id = $row.data('id');
      var type = $row.data('file-type') === 'folder' ? 'folder' : 'file';

      if (!id) return;

      var effective = getEffectiveRules(type, String(id));
      var status = effective.rules.length > 0 ? 'accessible' : 'not-accessible';
      var summary = getActionsEnabledSummary(effective.rules);
      var $cell = $row.find('.file-security-cell');

      if ($cell.length) {
        // Table cell: show just CRUD actions or "Not accessible"
        $cell.html(getSecurityBadgeHTML(status, summary, { tableCell: true }));
      }
    });

    isUpdatingBadges = false;
  }

  // -----------------------------------------
  // FOLDER SECURITY CARD (Layer 2A)
  // -----------------------------------------

  function updateFolderSecurityCard(folderId, folderName) {
    var $card = $('.folder-security-card');
    var effective = getEffectiveRules('folder', String(folderId || 'root'));
    var own = getOwnRules('folder', String(folderId || 'root'));

    var $status = $card.find('.folder-security-status');
    var $alert = $card.find('.security-alert');
    var $addAction = $card.find('.folder-security-add-action');
    var $editAction = $card.find('.folder-security-edit-action');

    if (effective.rules.length > 0) {
      // Has rules — show "Users can:" summary, no badge
      var summary = getActionsEnabledSummary(effective.rules);

      $status.html(
        summary ? '<span class="folder-security-detail"><strong>Users can:</strong> ' + summary + '</span>' : ''
      ).show();
      $alert.hide();
      $addAction.hide();
      $editAction.show();
    } else {
      // Not accessible — show warning alert and Add rules button
      $status.hide();
      $alert.show();
      $addAction.show();
      $editAction.hide();
    }

    // Hide inheritance hint for root/app folders since there's no parent to inherit from
    var $hint = $card.find('.folder-security-hint');

    if (isRootFolder('folder', String(folderId || 'root'))) {
      $hint.hide();
    } else {
      $hint.show();
    }

    // Show folder name in heading
    $card.find('.folder-access-name').text(folderName || 'App Files');

    $card.addClass('active');
  }

  // [FILEAPI] Replace with real logic — should count children of folderId that have no effective rules
  function countUnprotectedChildren(folderId) {
    void folderId;

    return 0;
  }

  // -----------------------------------------
  // SELECTED ITEM SECURITY SECTION (Layer 2B)
  // -----------------------------------------

  function updateSelectedItemSecurity(type, id, name) {
    var $section = $('.selected-security-section');
    var effective = getEffectiveRules(type, String(id));
    var own = getOwnRules(type, String(id));

    var $status = $section.find('.selected-security-status');
    var $alertWarning = $section.find('.selected-security-alert');
    var $list = $section.find('.effective-rules-list');
    var $editBtn = $section.find('.btn-edit-rules-inline');
    var $addBtn = $section.find('.btn-add-rules-inline');

    // Reset
    var $actionsWrapper = $section.find('.selected-security-actions');

    $list.empty();
    $status.hide();
    $alertWarning.hide();
    $editBtn.hide();
    $addBtn.hide();
    $actionsWrapper.hide();

    if (effective.rules.length > 0) {
      // Has rules — show "Users can:" summary, no badge
      var summary = getActionsEnabledSummary(effective.rules);

      $status.html(
        summary ? '<span class="folder-security-detail"><strong>Users can:</strong> ' + summary + '</span>' : ''
      ).show();

      $actionsWrapper.show();
      $editBtn.show();
    } else {
      // Not accessible — show warning alert and Add rules button
      $status.hide();
      $alertWarning.show();
      $actionsWrapper.show();
      $addBtn.show();
    }

    // Store target for the Actions dropdown "Security rules" link
    $('.side-actions .btn-edit-rules')
      .data('target-type', type)
      .data('target-id', id)
      .data('target-name', name);

    // Also store on inline buttons
    $editBtn.data('target-type', type).data('target-id', id).data('target-name', name);
    $addBtn.data('target-type', type).data('target-id', id).data('target-name', name);

    // Hide inheritance hint for root/app folders
    var $hint = $section.find('.folder-security-hint');

    if (isRootFolder(type, String(id))) {
      $hint.hide();
    } else {
      $hint.show();
    }

    $section.show();
  }

  // -----------------------------------------
  // RULE DESCRIPTION HELPERS
  // -----------------------------------------

  function describeAllow(rule) {
    if (rule.allow === 'all') return 'All users';
    if (rule.allow === 'loggedIn') return 'Logged in users';

    if (rule.allow && rule.allow.user) {
      var conditions = [];

      Object.keys(rule.allow.user).forEach(function(key) {
        var cond = rule.allow.user[key];
        var op = Object.keys(cond)[0];

        conditions.push('<code>' + escapeHtml(key) + ' ' + escapeHtml(op) + ' ' + escapeHtml(cond[op]) + '</code>');
      });

      return conditions.join('<br />');
    }

    if (rule.allow && rule.allow.dataSource) {
      return 'Data source #' + rule.allow.dataSource.id;
    }

    if (rule.allow && rule.allow.tokens) {
      return 'Token: ' + rule.allow.tokens.join(', ');
    }

    return 'Unknown';
  }

  function describeType(rule) {
    if (!rule.type || rule.type.length === 0) return '-';

    return rule.type.map(function(t) {
      return t.charAt(0).toUpperCase() + t.slice(1);
    }).join(', ');
  }

  function describeApps(rule) {
    if (rule._appScope === 'current') {
      return 'Current app';
    }

    if (!rule.appId || (Array.isArray(rule.appId) && rule.appId.length === 0)) {
      return 'All apps';
    }

    if (rule.appId === null) return 'All apps';

    return 'App ' + (Array.isArray(rule.appId) ? rule.appId.join(', ') : rule.appId);
  }

  function describeRule(rule) {
    var allow = rule.allow === 'all' ? 'All users' : rule.allow === 'loggedIn' ? 'Logged in users' : 'Specific users';
    var actions = (rule.type || []).join(', ');

    return allow + ' can ' + actions;
  }

  /**
   * Aggregate enabled action types across all rules and format as summary.
   * e.g. "Read and Update by 3 rules"
   */
  function getActionsEnabledSummary(rules) {
    var actionSet = {};
    var enabledCount = 0;

    rules.forEach(function(rule) {
      if (rule.enabled === false) return;

      enabledCount++;

      (rule.type || []).forEach(function(t) {
        actionSet[t] = true;
      });
    });

    var actions = Object.keys(actionSet);

    if (actions.length === 0) return '';

    // Capitalize: 'read' → 'Read'
    var labels = actions.map(function(a) {
      return a.charAt(0).toUpperCase() + a.slice(1);
    });

    return labels.join(', ');
  }

  // -----------------------------------------
  // SLIDE-OUT PANEL (Layer 3)
  // -----------------------------------------

  function openSecurityPanel(type, id, name) {
    currentSecurityTarget = { type: type, id: String(id), name: name || '' };
    panelContextStack = [];

    var own = getOwnRules(type, currentSecurityTarget.id);
    var effective = getEffectiveRules(type, currentSecurityTarget.id);

    currentRules = own.slice();
    savedRules = JSON.parse(JSON.stringify(own));
    hasUnsavedChanges = false;

    var $overlay = $('#security-panel-overlay');
    var $panel = $overlay.find('.security-panel');

    // Hide context back link (fresh open, no stack)
    $panel.find('.panel-context-back').hide();

    // Set title with clear item identification
    var icon = type === 'folder' ? '<i class="fa fa-folder-open"></i>' : '<i class="fa fa-file"></i>';
    var statusText = effective.rules.length > 0 ? 'Accessible' : 'Not accessible';
    var actionsSummary = getActionsEnabledSummary(effective.rules);
    var ruleSource = own.length > 0
      ? own.length + ' own rule' + (own.length !== 1 ? 's' : '')
      : (effective.inheritedFrom ? 'Inheriting from ' + escapeHtml(effective.inheritedFrom.folderName) : 'No rules');

    $panel.find('.security-panel-header h3').html('Access Rules <a href="#" class="panel-help-link" target="_blank"><i class="fa fa-question-circle-o"></i></a>');

    // Inheritance banner
    renderInheritanceBanner(own, effective);

    // Render rules table
    renderRulesTable();

    // Render inherited rules (read-only) if applicable
    renderInheritedRules(own, effective);

    // Update save button
    updateSaveButton();

    // Show list state
    showPanelState('list');

    // Show panel
    $overlay.addClass('active');

    setTimeout(function() {
      $overlay.addClass('visible');
    }, 10);

    // Prevent body scroll
    $('body').css('overflow', 'hidden');
  }

  function closeSecurityPanel(force) {
    if (hasUnsavedChanges && !force) {
      Fliplet.Modal.confirm({
        title: 'Unsaved changes',
        message: 'You have unsaved changes. Discard them?'
      }).then(function(result) {
        if (result) {
          closeSecurityPanel(true);
        }
      });

      return;
    }

    var $overlay = $('#security-panel-overlay');

    $overlay.removeClass('visible');

    setTimeout(function() {
      $overlay.removeClass('active');
      $('body').css('overflow', '');
    }, 500);

    currentSecurityTarget = null;
    currentRules = [];
    hasUnsavedChanges = false;
    panelContextStack = [];
  }

  /**
   * Switch the panel to show rules for a different item (e.g. inherited folder)
   * without closing/reopening the overlay or navigating the file manager.
   */
  function switchPanelContext(type, id, name) {
    currentSecurityTarget = { type: type, id: String(id), name: name || '' };

    var own = getOwnRules(type, currentSecurityTarget.id);
    var effective = getEffectiveRules(type, currentSecurityTarget.id);

    currentRules = own.slice();
    savedRules = JSON.parse(JSON.stringify(own));
    hasUnsavedChanges = false;

    var $overlay = $('#security-panel-overlay');
    var $panel = $overlay.find('.security-panel');

    // Update header
    var icon = type === 'folder' ? '<i class="fa fa-folder-open"></i>' : '<i class="fa fa-file"></i>';
    var statusText = effective.rules.length > 0 ? 'Accessible' : 'Not accessible';
    var actionsSummary = getActionsEnabledSummary(effective.rules);
    var ruleSource = own.length > 0
      ? own.length + ' own rule' + (own.length !== 1 ? 's' : '')
      : (effective.inheritedFrom ? 'Inheriting from ' + escapeHtml(effective.inheritedFrom.folderName) : 'No rules');

    // Update "Back to [item]" link
    var $backLink = $panel.find('.panel-context-back');

    if (panelContextStack.length > 0) {
      var prevContext = panelContextStack[panelContextStack.length - 1];

      $backLink.find('.back-to-context-label').text('Back to ' + (prevContext.name || prevContext.type));
      $backLink.show();
    } else {
      $backLink.hide();
    }

    renderInheritanceBanner(own, effective);
    renderRulesTable();
    renderInheritedRules(own, effective);
    updateSaveButton();
    showPanelState('list');
  }

  // [FILEAPI] Replace with real check — a root/app folder has no parent in the folder hierarchy
  function isRootFolder(type, id) {
    if (type !== 'folder') return false;

    return !mockFolderParents[id]; // Root folders have no parent entry
  }

  function renderInheritanceBanner(own, effective) {
    var $banner = $('#security-panel-inheritance');
    var html = '';
    var isRoot = isRootFolder(currentSecurityTarget.type, currentSecurityTarget.id);

    if (own.length > 0 && !isRoot) {
      // Has own rules and is not root — show inheritance info with clear option
      html = '<div class="security-alert security-alert-info">' +
        '<span class="alert-icon"><i class="fa fa-info-circle"></i></span>' +
        '<div class="alert-content">' +
        '<div class="alert-title">This ' + currentSecurityTarget.type + ' has its own rules</div>' +
        '<div class="alert-message">Child items without their own rules will inherit these.</div>' +
        '</div></div>';
    } else if (own.length > 0 && isRoot) {
      // Has own rules and IS root — no inheritance concept, just mention children inherit
      html = '<div class="security-alert security-alert-info">' +
        '<span class="alert-icon"><i class="fa fa-info-circle"></i></span>' +
        '<div class="alert-content">' +
        '<div class="alert-title">This folder has access rules</div>' +
        '<div class="alert-message">Child items without their own rules will inherit these.</div>' +
        '</div></div>';
    } else if (!isRoot && effective.rules.length > 0 && effective.inheritedFrom) {
      html = '<div class="security-alert security-alert-info">' +
        '<span class="alert-icon"><i class="fa fa-info-circle"></i></span>' +
        '<div class="alert-content">' +
        '<div class="alert-title">Inheriting ' + effective.rules.length + ' rule' +
          (effective.rules.length !== 1 ? 's' : '') + ' from ' + escapeHtml(effective.inheritedFrom.folderName) + '</div>' +
        '<div class="alert-message">Add own rules below to override inheritance.</div>' +
        '</div></div>';
    } else if (effective.rules.length === 0) {
      html = '<div class="security-alert security-alert-warning">' +
        '<span class="alert-icon"><i class="fa fa-exclamation-triangle"></i></span>' +
        '<div class="alert-content">' +
        '<div class="alert-title">No access rules</div>' +
        '<div class="alert-message">This ' + currentSecurityTarget.type +
          ' has no rules and is not accessible to app users. Add rules below.</div>' +
        '</div></div>';
    }

    $banner.html(html);
  }

  function initRulesSortable($tbody) {
    if (!$tbody.length || !$.fn.sortable) return;

    // Destroy previous instance if any
    if ($tbody.data('ui-sortable')) {
      $tbody.sortable('destroy');
    }

    $tbody.sortable({
      handle: '.handle-sort',
      tolerance: 'pointer',
      cursor: '-webkit-grabbing; -moz-grabbing;',
      axis: 'y',
      forcePlaceholderSize: true,
      forceHelperSize: true,
      revert: 150,
      helper: function(event, row) {
        row.children().each(function() {
          $(this).width($(this).width());
        });

        return row;
      },
      start: function(event, ui) {
        var $original = ui.helper.children();

        ui.placeholder.children().each(function(i) {
          $(this).width($original.eq(i).width());
        });
      },
      update: function() {
        var result = $tbody.sortable('toArray', { attribute: 'data-rule-index' });

        currentRules = _.map(result, function(r) {
          return currentRules[parseInt(r, 10)];
        });

        // Re-render to update data-rule-index attributes
        renderRulesTable();
        updateSaveButton();
      }
    });
  }

  function renderRulesTable() {
    var $tbody = $('#security-rules-tbody');

    $tbody.empty();

    if (currentRules.length === 0) {
      // Hide empty placeholder if inherited rules are shown
      var effective = currentSecurityTarget
        ? getEffectiveRules(currentSecurityTarget.type, currentSecurityTarget.id)
        : { rules: [], inheritedFrom: null };
      var hasInherited = effective.inheritedFrom && effective.rules.length > 0;

      if (hasInherited) {
        $tbody.closest('.security-rules-table').find('.security-rules-empty').hide();
      } else {
        $tbody.closest('.security-rules-table').find('.security-rules-empty').show();
      }

      $tbody.closest('table').hide();
      return;
    }

    $tbody.closest('.security-rules-table').find('.security-rules-empty').hide();
    $tbody.closest('table').show();

    currentRules.forEach(function(rule, index) {
      var enabledClass = rule.enabled !== false ? 'rule-enabled' : 'rule-disabled';
      var isEnabled = rule.enabled !== false;
      var isCustom = typeof rule.script === 'string';

      var statusCell = '<td class="align-baseline opacity-full">' +
        '<span class="fa-stack handle-sort">' +
          '<i class="fa fa-ellipsis-v fa-stack-1x"></i>' +
          '<i class="fa fa-ellipsis-v fa-stack-1x"></i>' +
        '</span>' +
        '<a href="#" class="toggle-status" data-toggle-rule>' +
          '<div class="toggle-switch toggle-switch-sm">' +
            '<input class="switch-input" type="checkbox"' + (isEnabled ? ' checked' : '') + ' />' +
            '<label class="toggle"></label>' +
            '<label class="switch-label">' + (isEnabled ? 'Enabled' : 'Disabled') + '</label>' +
          '</div>' +
        '</a>' +
        '</td>';

      var actionsCell = '<td class="align-baseline opacity-full">' +
        '<button class="btn btn-default btn-sm" data-edit-rule="' + index + '">Edit</button> ' +
        '<button class="btn btn-danger btn-sm" data-delete-rule="' + index + '">Delete</button>' +
        '</td>';

      var html;

      if (isCustom) {
        html = '<tr data-rule-index="' + index + '" class="' + enabledClass + '">' +
          statusCell +
          '<td colspan="3" class="align-baseline"><span class="label label-default"><i class="fa fa-code"></i> Custom rule</span> ' + escapeHtml(rule.name || 'Untitled custom rule') + '</td>' +
          actionsCell +
          '</tr>';
      } else {
        html = '<tr data-rule-index="' + index + '" class="' + enabledClass + '">' +
          statusCell +
          '<td class="align-baseline">' + describeAllow(rule) + '</td>' +
          '<td class="align-baseline">' + describeType(rule) + '</td>' +
          '<td class="align-baseline">' + describeApps(rule) + '</td>' +
          actionsCell +
          '</tr>';
      }

      $tbody.append(html);
    });

    // Initialize sortable for drag-and-drop reordering
    initRulesSortable($tbody);
  }

  function renderInheritedRules(own, effective) {
    var $section = $('#security-inherited-rules');

    // When item has own rules, inherited rules from parent aren't displayed
    // because own rules take precedence (most specific wins)
    if (own.length > 0) {
      $section.hide();
      return;
    }

    if (effective.inheritedFrom && effective.rules.length > 0) {
      var $tbody = $section.find('tbody');

      $tbody.empty();

      effective.rules.forEach(function(rule) {
        var html = '<tr>' +
          '<td>' + (rule.enabled !== false ? '<i class="fa fa-check-circle" style="color:#10B981"></i>' : '<i class="fa fa-minus-circle" style="color:#ccc"></i>') + '</td>' +
          '<td>' + describeAllow(rule) + '</td>' +
          '<td>' + describeType(rule) + '</td>' +
          '<td>' + describeApps(rule) + '</td>' +
          '</tr>';

        $tbody.append(html);
      });

      // Show folder path instead of just folder name
      var folderPath = getFolderPath(effective.inheritedFrom.folderId);

      $section.find('.inherited-from-path').text(folderPath);

      // Set up "Edit inherited rules" button
      $section.find('[data-edit-inherited-rules]')
        .data('folder-id', effective.inheritedFrom.folderId)
        .data('folder-name', effective.inheritedFrom.folderName);

      $section.show();
    } else {
      $section.hide();
    }
  }

  function updateSaveButton() {
    var $btn = $('.btn-save-rules');
    var changed = JSON.stringify(currentRules) !== JSON.stringify(savedRules);

    hasUnsavedChanges = changed;

    if (changed) {
      $btn.addClass('has-changes');
    } else {
      $btn.removeClass('has-changes');
    }
  }

  // -----------------------------------------
  // RULE EDITOR MODAL
  // -----------------------------------------

  var editingRuleIndex = null; // null = adding new, number = editing existing
  var dataSourcesList = [];    // Cached data sources for the select dropdown
  var appsList = [];           // Cached apps for the "Specific apps" checkboxes
  var tokensList = [];         // Cached tokens for the "Specific token" select
  var panelContextStack = [];  // Stack for navigating between inherited folder contexts
  var customRuleEditor = null; // CodeMirror instance for custom JS rules

  function showPanelState(state) {
    $('.panel-state').removeClass('active');
    $('.panel-state-' + state).addClass('active');
  }

  function loadDataSources() {
    // [FILEAPI] Uses Fliplet.DataSources.get() — falls back to mock if unavailable
    if (typeof Fliplet !== 'undefined' && Fliplet.DataSources && typeof Fliplet.DataSources.get === 'function') {
      Fliplet.DataSources.get({
        attributes: 'id,name',
        type: null
      }).then(function(dataSources) {
        dataSourcesList = dataSources;
        populateDataSourceSelect();
      }).catch(function() {
        loadMockDataSources();
      });
    } else {
      loadMockDataSources();
    }
  }

  // [FILEAPI] Mock data sources — remove when Fliplet.DataSources.get() works in this context
  function loadMockDataSources() {
    dataSourcesList = [
      { id: 100, name: 'Users' },
      { id: 200, name: 'Expense Reports' },
      { id: 300, name: 'Event Registrations' }
    ];
    populateDataSourceSelect();
  }

  function populateDataSourceSelect() {
    var $select = $('#configure-file-rule [name="ds-id"]');

    $select.empty().append('<option value="">-- Select data source</option>');

    dataSourcesList.forEach(function(ds) {
      $select.append('<option value="' + ds.id + '">' + escapeHtml(ds.name) + ' (ID: ' + ds.id + ')</option>');
    });
  }

  function loadDataSourceColumns(dsId) {
    var $select = $('#configure-file-rule [name="ds-file-column"]');

    $select.empty().append('<option value="">-- Select column</option>');

    if (!dsId) {
      $select.prop('disabled', true);
      return;
    }

    $select.prop('disabled', false);

    // [FILEAPI] Fetch columns via Fliplet.DataSources.connect().getColumns()
    if (typeof Fliplet !== 'undefined' && Fliplet.DataSources && typeof Fliplet.DataSources.connect === 'function') {
      Fliplet.DataSources.connect(dsId).then(function(connection) {
        if (typeof connection.getColumns === 'function') {
          return connection.getColumns();
        }

        // Fallback: query one entry to infer columns
        return connection.find({ limit: 1 }).then(function(entries) {
          if (entries && entries.length > 0 && entries[0].data) {
            return Object.keys(entries[0].data);
          }

          return [];
        });
      }).then(function(columns) {
        if (columns && columns.length) {
          columns.forEach(function(col) {
            $select.append('<option value="' + escapeHtml(col) + '">' + escapeHtml(col) + '</option>');
          });
        }
      }).catch(function() {
        loadMockDataSourceColumns($select);
      });
    } else {
      loadMockDataSourceColumns($select);
    }
  }

  // [FILEAPI] Mock columns — remove when using real API
  function loadMockDataSourceColumns($select) {
    ['Email', 'First name', 'Last name', 'Role', 'Avatar', 'Document'].forEach(function(col) {
      $select.append('<option value="' + col + '">' + col + '</option>');
    });
  }

  function loadApps() {
    // [FILEAPI] Uses Fliplet.Apps.get() — falls back to mock if unavailable
    if (typeof Fliplet !== 'undefined' && Fliplet.Apps && typeof Fliplet.Apps.get === 'function') {
      Fliplet.Apps.get().then(function(apps) {
        appsList = apps.filter(function(app) {
          return !app.legacy;
        }).sort(function(a, b) {
          return (a.name || '').localeCompare(b.name || '');
        });
        populateAppsList();
      }).catch(function() {
        loadMockApps();
      });
    } else {
      loadMockApps();
    }
  }

  // [FILEAPI] Mock apps list — remove when Fliplet.Apps.get() works in this context
  function loadMockApps() {
    appsList = [
      { id: 1, name: 'My events solution' },
      { id: 2, name: 'Hugo\'s App' },
      { id: 3, name: 'Test Event Portal' }
    ];
    populateAppsList();
  }

  // [FILEAPI] Load API tokens for the "Specific token" select
  function loadTokens() {
    if (typeof Fliplet !== 'undefined' && Fliplet.API && typeof Fliplet.API.request === 'function') {
      Fliplet.API.request({ url: 'v1/tokens' }).then(function(response) {
        tokensList = response.tokens || response || [];
        populateTokenSelect();
      }).catch(function() {
        loadMockTokens();
      });
    } else {
      loadMockTokens();
    }
  }

  // [FILEAPI] Mock tokens — remove when real API works
  function loadMockTokens() {
    tokensList = [
      { id: 75, fullName: 'Zapier Integration', apps: [{ name: 'My events solution' }] },
      { id: 12, fullName: 'Read Token', apps: [{ name: 'My events solution' }] },
      { id: 88, fullName: 'Admin Token', apps: [{ name: "Hugo's Plat" }] }
    ];
    populateTokenSelect();
  }

  function populateTokenSelect() {
    var $select = $('#configure-file-rule [name="token-id"]');

    $select.empty().append('<option value="">-- Select API Token</option>');

    // Group tokens by app name
    var groups = {};

    tokensList.forEach(function(token) {
      var appName = (token.apps && token.apps.length > 0 && token.apps[0].name) || 'Other';

      if (!groups[appName]) groups[appName] = [];

      groups[appName].push(token);
    });

    Object.keys(groups).sort().forEach(function(appName) {
      var $group = $('<optgroup>').attr('label', appName);

      groups[appName].forEach(function(token) {
        $group.append(
          '<option value="' + token.id + '">ID#' + token.id + ' &ndash; ' + escapeHtml(token.fullName || token.name || '') + '</option>'
        );
      });

      $select.append($group);
    });
  }

  function populateAppsList(selectedIds) {
    var $list = $('#configure-file-rule .apps-list');
    var selected = selectedIds || [];

    $list.empty();

    appsList.forEach(function(app) {
      var checked = selected.indexOf(app.id) !== -1 ? ' checked' : '';

      $list.append(
        '<div class="checkbox checkbox-icon" style="display: inline-block; margin-right: 15px;">' +
          '<input type="checkbox" id="chk-app-' + app.id + '" value="' + app.id + '"' + checked + '>' +
          '<label for="chk-app-' + app.id + '">' +
            '<span class="check"><i class="fa fa-check"></i></span> ' + escapeHtml(app.name) +
          '</label>' +
        '</div>'
      );
    });
  }

  function initCustomRuleEditor() {
    if (customRuleEditor) return;

    if (typeof CodeMirror !== 'undefined') {
      customRuleEditor = CodeMirror.fromTextArea($('#custom-file-rule')[0], {
        lineNumbers: true,
        mode: 'javascript'
      });
    }
  }

  function openRuleEditor(rule, index) {
    editingRuleIndex = (typeof index === 'number') ? index : null;

    var $editor = $('#configure-file-rule');
    var isFolder = currentSecurityTarget && currentSecurityTarget.type === 'folder';
    var isCustom = rule && typeof rule.script === 'string';

    // Reset form
    resetRuleForm($editor);

    // Toggle standard vs custom form
    if (isCustom) {
      $editor.find('[data-rule-standard]').addClass('hidden');
      $editor.find('[data-rule-custom]').removeClass('hidden');

      $editor.find('.rule-editor-title').text(editingRuleIndex !== null ? 'Edit custom access rule' : 'Add custom access rule');
    } else {
      $editor.find('[data-rule-standard]').removeClass('hidden');
      $editor.find('[data-rule-custom]').addClass('hidden');

      $editor.find('.rule-editor-title').text(editingRuleIndex !== null ? 'Edit access rule' : 'Add new access rule');
    }

    $editor.find('[data-save-security-rule]').text(editingRuleIndex !== null ? 'Confirm' : 'Add rule');

    if (rule) {
      populateRuleForm($editor, rule);
    }

    // Show Create/Upload only for folders, hide entirely for files
    var $createCheckbox = $editor.find('.action-checkbox-create');

    if (isFolder) {
      $createCheckbox.show().find('input').prop('disabled', false);
    } else {
      $createCheckbox.hide().find('input').prop('checked', false).prop('disabled', true);
    }

    // Load data sources and apps if needed
    if (!dataSourcesList.length) {
      loadDataSources();
    }

    if (!appsList.length) {
      loadApps();
    }

    if (!tokensList.length) {
      loadTokens();
    }

    showPanelState('editor');

    // Validate button state after panel is visible
    updateSaveRuleValidation();

    // Refresh CodeMirror after DOM is visible
    if (isCustom && customRuleEditor) {
      setTimeout(function() {
        customRuleEditor.refresh();
      }, 10);
    }
  }

  function resetRuleForm($editor) {
    // Reset allow selection
    $editor.find('[data-allow-type]').removeClass('selected');
    $editor.find('[data-allow-type="all"]').addClass('selected');
    $editor.find('.required-fields').empty();
    $editor.find('.user-filters-wrapper, .ds-matching-wrapper, .tokens-wrapper').addClass('hidden');

    // Reset action checkboxes
    $editor.find('[name="type"]').prop('checked', false);

    // Reset app scope
    $editor.find('[data-app-scope]').removeClass('selected');
    $editor.find('[data-app-scope="all"]').addClass('selected');
    $editor.find('.apps-list-wrapper').addClass('hidden');

    // Reset DS fields
    $editor.find('[name="ds-id"]').val('');
    $editor.find('[name="ds-file-column"]').val('').prop('disabled', true);
    $editor.find('[name="token-id"]').val('');

    // Reset custom rule form
    $editor.find('[name="custom-rule-name"]').val('');

    if (customRuleEditor) {
      customRuleEditor.setValue('');
    }
  }

  function populateRuleForm($editor, rule) {
    // Custom rule
    if (typeof rule.script === 'string') {
      $editor.find('[name="custom-rule-name"]').val(rule.name || 'Untitled custom rule');

      if (customRuleEditor) {
        customRuleEditor.setValue(rule.script || '');
      }

      return;
    }

    // Allow
    $editor.find('[data-allow-type]').removeClass('selected');

    if (rule.allow === 'all') {
      $editor.find('[data-allow-type="all"]').addClass('selected');
    } else if (rule.allow === 'loggedIn') {
      $editor.find('[data-allow-type="loggedIn"]').addClass('selected');
    } else if (rule.allow && rule.allow.user) {
      $editor.find('[data-allow-type="filter"]').addClass('selected');
      $editor.find('.user-filters-wrapper').removeClass('hidden');

      var $filters = $editor.find('.user-filters-wrapper .required-fields');

      Object.keys(rule.allow.user).forEach(function(key) {
        var cond = rule.allow.user[key];
        var op = Object.keys(cond)[0];

        addUserFilterRow($filters, key, op, cond[op]);
      });
    } else if (rule.allow && rule.allow.dataSource) {
      $editor.find('[data-allow-type="dataSource"]').addClass('selected');
      $editor.find('.ds-matching-wrapper').removeClass('hidden');

      $editor.find('[name="ds-id"]').val(rule.allow.dataSource.id);

      // Load columns for the selected DS, then set the file column value
      var savedFileColumn = rule.allow.dataSource.fileColumn || '';

      loadDataSourceColumns(rule.allow.dataSource.id);

      // Set value after a tick to allow options to load
      setTimeout(function() {
        $editor.find('[name="ds-file-column"]').val(savedFileColumn);
      }, 300);

      if (rule.allow.dataSource.where) {
        var $whereFilters = $editor.find('.ds-where-filters');

        Object.keys(rule.allow.dataSource.where).forEach(function(key) {
          var cond = rule.allow.dataSource.where[key];
          var op = Object.keys(cond)[0];

          addUserFilterRow($whereFilters, key, op, cond[op]);
        });
      }
    } else if (rule.allow && rule.allow.tokens) {
      $editor.find('[data-allow-type="tokens"]').addClass('selected');
      $editor.find('.tokens-wrapper').removeClass('hidden');

      if (rule.allow.tokens.length > 0) {
        if (!tokensList.length) {
          // Load tokens first, then set the value
          var tokenVal = rule.allow.tokens[0];
          var origPopulate = window._origPopulateTokenSelect;

          loadTokens();
          // Set value after tokens are loaded (populateTokenSelect runs synchronously after load)
          setTimeout(function() {
            $editor.find('[name="token-id"]').val(tokenVal);
          }, 100);
        } else {
          $editor.find('[name="token-id"]').val(rule.allow.tokens[0]);
        }
      }
    }

    // Type
    (rule.type || []).forEach(function(t) {
      $editor.find('[name="type"][value="' + t + '"]').prop('checked', true);
    });

    // Apps
    $editor.find('[data-app-scope]').removeClass('selected');

    if (rule._appScope === 'current') {
      $editor.find('[data-app-scope="current"]').addClass('selected');
    } else if (rule.appId && Array.isArray(rule.appId) && rule.appId.length > 0) {
      // Check if the appId matches the current app
      var currentAppId = (typeof Fliplet !== 'undefined' && Fliplet.Env) ? Fliplet.Env.get('appId') : null;

      if (currentAppId && rule.appId.length === 1 && rule.appId[0] === currentAppId && !rule._appScope) {
        // Single app matching current app — could be "current app" scope
        $editor.find('[data-app-scope="current"]').addClass('selected');
      } else {
        $editor.find('[data-app-scope="filter"]').addClass('selected');
        $editor.find('.apps-list-wrapper').removeClass('hidden');
        populateAppsList(rule.appId);
      }
    } else {
      $editor.find('[data-app-scope="all"]').addClass('selected');
    }
  }

  function addUserFilterRow($container, column, operator, value) {
    var html = '<div class="required-field">' +
      '<button class="btn" data-remove-user-filter><i class="fa fa-minus fa-fw"></i></button>' +
      '<input name="column" class="form-control" type="text" placeholder="Field name" value="' + escapeHtml(column || '') + '" />' +
      '<label class="select-proxy-display">' +
        '<select class="hidden-select form-control" name="operator">' +
          '<option value="equals"' + (operator === 'equals' ? ' selected' : '') + '>Equals</option>' +
          '<option value="notequals"' + (operator === 'notequals' ? ' selected' : '') + '>Not equals</option>' +
          '<option value="contains"' + (operator === 'contains' ? ' selected' : '') + '>Contains</option>' +
        '</select>' +
        '<span class="icon fa fa-chevron-down"></span>' +
      '</label>' +
      '<span class="value-field-wrapper">' +
        '<input name="value" class="form-control" type="text" placeholder="Value" value="' + escapeHtml(value || '') + '" />' +
        '<span class="value-tooltip">To reference user data, use {{ user.[*] }}<br>e.g. {{ user.[Email] }}, {{ user.[First name] }}</span>' +
      '</span>' +
      '</div>';

    $container.append(html);
  }

  // Matches DS widget updateSaveRuleValidation() — disables save button if no action type is checked
  function updateSaveRuleValidation() {
    var $editor = $('#configure-file-rule');
    var $btn = $editor.find('[data-save-security-rule]');
    var isCustomRule = !$editor.find('[data-rule-standard]').is(':visible');

    // Custom rules: always enabled
    if (isCustomRule) {
      $btn.removeAttr('disabled').removeClass('disabled');
      return;
    }

    var types = $editor.find('[name="type"]:checked');

    if (types.length > 0) {
      $btn.removeAttr('disabled').removeClass('disabled');
    } else {
      $btn.attr('disabled', true).addClass('disabled');
    }
  }

  function validateHandlebarsValue(value, fieldName) {
    if (!value) return null;

    // Only validate if it contains Handlebars expressions
    if (value.indexOf('{{') === -1) return null;

    try {
      Handlebars.compile(value)();
      return null;
    } catch (e) {
      return 'The value for the field "' + fieldName + '" is not a valid Handlebars expression.';
    }
  }

  function collectRuleFromForm() {
    var $editor = $('#configure-file-rule');
    var rule = {};

    // Check if custom rule
    var isCustomRule = !$editor.find('[data-rule-standard]').is(':visible');

    if (isCustomRule) {
      rule = {
        name: $editor.find('[name="custom-rule-name"]').val() || 'Untitled custom rule',
        script: customRuleEditor ? customRuleEditor.getValue() : '',
        enabled: true
      };

      if (customRuleEditor) {
        customRuleEditor.setValue('');
      }

      return rule;
    }

    // Allow
    var allowType = $editor.find('[data-allow-type].selected').data('allow-type');

    if (allowType === 'all') {
      rule.allow = 'all';
    } else if (allowType === 'loggedIn') {
      rule.allow = 'loggedIn';
    } else if (allowType === 'filter') {
      var userConditions = {};

      $editor.find('.user-filters-wrapper .required-field').each(function() {
        var col = $(this).find('[name="column"]').val();
        var op = $(this).find('[name="operator"]').val();
        var val = $(this).find('[name="value"]').val();

        if (col) {
          var cond = {};

          cond[op] = val;
          userConditions[col] = cond;
        }
      });

      rule.allow = { user: userConditions };
    } else if (allowType === 'dataSource') {
      var dsId = parseInt($editor.find('[name="ds-id"]').val(), 10);
      var fileColumn = $editor.find('[name="ds-file-column"]').val();
      var where = {};

      $editor.find('.ds-where-filters .required-field').each(function() {
        var col = $(this).find('[name="column"]').val();
        var op = $(this).find('[name="operator"]').val();
        var val = $(this).find('[name="value"]').val();

        if (col) {
          var cond = {};

          cond[op] = val;
          where[col] = cond;
        }
      });

      rule.allow = {
        dataSource: {
          id: dsId || 0,
          fileColumn: fileColumn,
          where: where
        }
      };
    } else if (allowType === 'tokens') {
      var tokenId = parseInt($editor.find('[name="token-id"]').val(), 10);

      rule.allow = { tokens: tokenId ? [tokenId] : [] };
    }

    // Type
    rule.type = [];

    $editor.find('[name="type"]:checked').each(function() {
      rule.type.push($(this).val());
    });

    // App scope
    var appScope = $editor.find('[data-app-scope].selected').data('app-scope');

    if (appScope === 'all') {
      rule.appId = null;
    } else if (appScope === 'current') {
      // [FILEAPI] Uses Fliplet.Env.get('appId') for current app context
      var currentAppId = (typeof Fliplet !== 'undefined' && Fliplet.Env) ? Fliplet.Env.get('appId') : null;

      rule.appId = currentAppId ? [currentAppId] : null;
      rule._appScope = 'current'; // Internal flag to distinguish from specific apps
    } else {
      rule.appId = [];

      $editor.find('.apps-list input:checked').each(function() {
        rule.appId.push(parseInt($(this).val(), 10));
      });
    }

    rule.enabled = true;

    return rule;
  }

  // -----------------------------------------
  // PRE-CONFIGURED RULES
  // -----------------------------------------

  var preconfiguredRules = [
    {
      name: 'All users can read',
      rule: { allow: 'all', type: ['read'], enabled: true, appId: null }
    },
    {
      name: 'All users can upload',
      rule: { allow: 'all', type: ['create'], enabled: true, appId: null }
    },
    {
      name: 'Logged in users can upload',
      rule: { allow: 'loggedIn', type: ['create'], enabled: true, appId: null }
    },
    {
      name: 'Logged in users can read',
      rule: { allow: 'loggedIn', type: ['read'], enabled: true, appId: null }
    },
    {
      name: 'Logged in users can read, update and delete',
      rule: { allow: 'loggedIn', type: ['read', 'update', 'delete'], enabled: true, appId: null }
    }
  ];

  // -----------------------------------------
  // EVENT HANDLERS
  // -----------------------------------------

  function performSave() {
    if (!currentSecurityTarget) return;

    var target = currentSecurityTarget;

    // [FILEAPI] Replace mock save with real API call:
    // PUT /v1/media/folders/:id/accessRules  (for folders)
    // PUT /v1/media/files/:id/accessRules    (for files)
    // Body: { accessRules: currentRules }
    if (target.type === 'folder') {
      mockFolderRules[target.id] = JSON.parse(JSON.stringify(currentRules));
    } else {
      mockFileRules[target.id] = JSON.parse(JSON.stringify(currentRules));
    }

    savedRules = JSON.parse(JSON.stringify(currentRules));
    hasUnsavedChanges = false;
    updateSaveButton();

    updateSecurityBadges();

    if ($('.folder-security-card').hasClass('active')) {
      var $editBtn = $('.folder-security-card .btn-edit-folder-rules');

      updateFolderSecurityCard(
        $editBtn.data('folder-id') || 'root',
        $editBtn.data('folder-name') || 'App Files'
      );
    }

    // [FILEAPI] Remove this mock alert when real API is integrated
    Fliplet.Modal.alert({
      title: 'Rules saved',
      message: 'Access rules saved successfully.<br><small>(Mock — no actual API call made)</small>'
    });
  }

  function initEventHandlers() {
    // --- Layer 2A: Folder security card ---
    $(document).on('click.securityRules', '.folder-security-card .btn-edit-folder-rules', function(e) {
      e.preventDefault();

      var folderId = $(this).data('folder-id') || 'root';
      var folderName = $(this).data('folder-name') || 'App Files';

      openSecurityPanel('folder', folderId, folderName);
    });

    // --- Layer 2B: Selected item edit via Actions dropdown ---
    $(document).on('click.securityRules', '.side-actions .btn-edit-rules', function(e) {
      e.preventDefault();

      var type = $(this).data('target-type');
      var id = $(this).data('target-id');
      var name = $(this).data('target-name');

      if (type && id) {
        openSecurityPanel(type, id, name);
      }
    });

    // --- Layer 2B: Selected item edit/add via inline buttons ---
    $(document).on('click.securityRules', '.btn-edit-rules-inline, .btn-add-rules-inline', function(e) {
      e.preventDefault();

      var type = $(this).data('target-type');
      var id = $(this).data('target-id');
      var name = $(this).data('target-name');

      if (type && id) {
        openSecurityPanel(type, id, name);
      }
    });

    // --- Navigate to folder from inherited source link ---
    $(document).on('click.securityRules', '[data-navigate-folder]', function(e) {
      e.preventDefault();

      var folderId = $(this).data('navigate-folder');

      navigateFileManagerToFolder(folderId);
    });

    // --- Slide-out panel ---
    $(document).on('click.securityRules', '#security-panel-close', function(e) {
      e.preventDefault();
      closeSecurityPanel();
    });

    $(document).on('click.securityRules', '#security-panel-overlay', function(e) {
      if ($(e.target).is('#security-panel-overlay')) {
        closeSecurityPanel();
      }
    });

    // ESC to close
    $(document).on('keydown.securityRules', function(e) {
      if (e.keyCode === 27 && $('#security-panel-overlay').hasClass('active')) {
        // If in editor state, go back to list. Otherwise close panel.
        if ($('.panel-state-editor').hasClass('active')) {
          showPanelState('list');
        } else {
          closeSecurityPanel();
        }
      }
    });

    // --- Rules table actions ---
    $(document).on('click.securityRules', '[data-toggle-rule]', function(e) {
      e.preventDefault();
      e.stopPropagation();

      var index = parseInt($(this).closest('tr').data('rule-index'), 10);

      if (isNaN(index) || !currentRules[index]) return;

      currentRules[index].enabled = !currentRules[index].enabled;
      renderRulesTable();
      updateSaveButton();
    });

    $(document).on('click.securityRules', '[data-edit-rule]', function(e) {
      e.preventDefault();

      var index = parseInt($(this).data('edit-rule'), 10);

      if (isNaN(index) || !currentRules[index]) return;

      // Ensure CodeMirror is initialized for custom rules
      if (typeof currentRules[index].script === 'string') {
        initCustomRuleEditor();
      }

      openRuleEditor(currentRules[index], index);
    });

    $(document).on('click.securityRules', '[data-delete-rule]', function(e) {
      e.preventDefault();

      var index = parseInt($(this).data('delete-rule'), 10);

      if (isNaN(index) || !currentRules[index]) return;

      // Draft-based: remove immediately, no confirmation. User confirms on Save.
      currentRules.splice(index, 1);
      renderRulesTable();
      updateSaveButton();

      var effective = getEffectiveRules(currentSecurityTarget.type, currentSecurityTarget.id);

      renderInheritanceBanner(currentRules, effective);
      renderInheritedRules(currentRules, effective);
    });

    // Clear own rules (draft-based: no confirmation, user confirms on Save)
    $(document).on('click.securityRules', '[data-clear-own-rules]', function(e) {
      e.preventDefault();

      currentRules = [];
      renderRulesTable();
      updateSaveButton();

      var effective = getEffectiveRules(currentSecurityTarget.type, currentSecurityTarget.id);

      renderInheritanceBanner(currentRules, effective);
      renderInheritedRules(currentRules, effective);
    });

    // --- Add rule ---
    $(document).on('click.securityRules', '[data-add-security-rule]', function(e) {
      e.preventDefault();
      openRuleEditor(null, null);
    });

    // --- Add custom JS rule ---
    $(document).on('click.securityRules', '[data-add-custom-rule]', function(e) {
      e.preventDefault();
      initCustomRuleEditor();
      openRuleEditor({ script: '' }, null);
    });

    // Pre-configured rules
    $(document).on('click.securityRules', '[data-preconfigured-rule]', function(e) {
      e.preventDefault();

      var index = parseInt($(this).data('preconfigured-rule'), 10);

      if (isNaN(index) || !preconfiguredRules[index]) return;

      var newRule = JSON.parse(JSON.stringify(preconfiguredRules[index].rule));

      currentRules.push(newRule);
      renderRulesTable();
      updateSaveButton();

      var effective = getEffectiveRules(currentSecurityTarget.type, currentSecurityTarget.id);

      renderInheritanceBanner(currentRules, effective);
      renderInheritedRules(currentRules, effective);
    });

    // --- Rule editor ---
    // Action type checkboxes — update save button validation
    $(document).on('click.securityRules', '#configure-file-rule [name="type"]', function() {
      updateSaveRuleValidation();
    });

    // Allow type buttons
    $(document).on('click.securityRules', '#configure-file-rule [data-allow-type]', function(e) {
      e.preventDefault();

      var $editor = $('#configure-file-rule');

      $editor.find('[data-allow-type]').removeClass('selected');
      $(this).addClass('selected');

      var type = $(this).data('allow-type');

      // Show/hide relevant subsections
      $editor.find('.user-filters-wrapper').toggleClass('hidden', type !== 'filter');
      $editor.find('.ds-matching-wrapper').toggleClass('hidden', type !== 'dataSource');
      $editor.find('.tokens-wrapper').toggleClass('hidden', type !== 'tokens');

      // Auto-add first condition row when "Specific users" is selected
      if (type === 'filter') {
        var $filters = $editor.find('.security-user-filters');

        if ($filters.children().length === 0) {
          addUserFilterRow($filters, '', 'equals', '');
        }
      }

      // Load tokens when "Specific token" is selected
      if (type === 'tokens' && !tokensList.length) {
        loadTokens();
      }
    });

    // Add user condition
    $(document).on('click.securityRules', '[data-add-user-condition]', function(e) {
      e.preventDefault();

      var $container = $(this).siblings('.required-fields');

      addUserFilterRow($container, '', 'equals', '');
    });

    // Add DS where condition
    $(document).on('click.securityRules', '[data-add-ds-condition]', function(e) {
      e.preventDefault();

      var $container = $(this).siblings('.required-fields');

      addUserFilterRow($container, '', 'equals', '');
    });

    // Load columns when data source changes
    $(document).on('change.securityRules', '#configure-file-rule [name="ds-id"]', function() {
      var dsId = parseInt($(this).val(), 10);

      loadDataSourceColumns(dsId || null);
    });

    // Remove filter row
    $(document).on('click.securityRules', '[data-remove-user-filter]', function(e) {
      e.preventDefault();
      $(this).closest('.required-field').remove();
    });

    // App scope buttons
    $(document).on('click.securityRules', '#configure-file-rule [data-app-scope]', function(e) {
      e.preventDefault();

      var $editor = $('#configure-file-rule');

      $editor.find('[data-app-scope]').removeClass('selected');
      $(this).addClass('selected');

      var scope = $(this).data('app-scope');

      $editor.find('.apps-list-wrapper').toggleClass('hidden', scope !== 'filter');
    });

    // Save rule
    $(document).on('click.securityRules', '[data-save-security-rule]', function(e) {
      e.preventDefault();

      var $editor = $('#configure-file-rule');
      var isCustomRule = !$editor.find('[data-rule-standard]').is(':visible');
      var error = null;

      // Validate standard rules before collecting
      if (!isCustomRule) {
        // Must have at least one action type
        if ($editor.find('[name="type"]:checked').length === 0) {
          Fliplet.Modal.alert({
            message: 'Please select at least one action (Read, Create, Update, or Delete).'
          });
          return;
        }

        // Validate Handlebars in user filter conditions
        $editor.find('.user-filters-wrapper .required-field').each(function() {
          var col = $.trim($(this).find('[name="column"]').val());
          var val = $.trim($(this).find('[name="value"]').val());

          if (col && val) {
            error = error || validateHandlebarsValue(val, col);
          }
        });

        // Validate Handlebars in DS where conditions
        $editor.find('.ds-where-filters .required-field').each(function() {
          var col = $.trim($(this).find('[name="column"]').val());
          var val = $.trim($(this).find('[name="value"]').val());

          if (col && val) {
            error = error || validateHandlebarsValue(val, col);
          }
        });

        if (error) {
          Fliplet.Modal.alert({ message: error });
          return;
        }
      }

      var rule = collectRuleFromForm();

      if (editingRuleIndex !== null) {
        currentRules[editingRuleIndex] = rule;
      } else {
        currentRules.push(rule);
      }

      showPanelState('list');
      renderRulesTable();
      updateSaveButton();

      var effective = getEffectiveRules(currentSecurityTarget.type, currentSecurityTarget.id);

      renderInheritanceBanner(currentRules, effective);
      renderInheritedRules(currentRules, effective);
    });

    // Cancel rule editor
    $(document).on('click.securityRules', '[data-cancel-rule]', function(e) {
      e.preventDefault();
      showPanelState('list');
    });

    // Back to list link
    $(document).on('click.securityRules', '[data-back-to-list]', function(e) {
      e.preventDefault();
      showPanelState('list');
    });

    // --- Save all rules ---
    $(document).on('click.securityRules', '.btn-save-rules', function(e) {
      e.preventDefault();

      if (!currentSecurityTarget) return;

      // If going from rules → no rules, confirm before saving
      var hadRules = savedRules.length > 0;
      var hasNoRules = currentRules.length === 0;

      if (hadRules && hasNoRules) {
        Fliplet.Modal.confirm({
          title: 'Remove all access rules?',
          message: 'This ' + currentSecurityTarget.type + ' will no longer be accessible to app users.',
          buttons: {
            cancel: {
              label: 'Cancel',
              className: 'btn-default'
            },
            confirm: {
              label: 'Remove rules',
              className: 'btn-danger'
            }
          }
        }).then(function(result) {
          if (result) {
            performSave();
          }
        });

        return;
      }

      performSave();
    });

    // --- Edit inherited rules (switch panel context without navigating file manager) ---
    $(document).on('click.securityRules', '[data-edit-inherited-rules]', function(e) {
      e.preventDefault();

      var folderId = $(this).data('folder-id');
      var folderName = $(this).data('folder-name') || mockFolderNames[folderId] || folderId;

      // Push current context onto the stack so user can go back
      if (currentSecurityTarget) {
        panelContextStack.push({
          type: currentSecurityTarget.type,
          id: currentSecurityTarget.id,
          name: currentSecurityTarget.name
        });
      }

      // Switch panel context to the inherited folder (without navigating file manager)
      switchPanelContext('folder', folderId, folderName);
    });

    // --- Back to previous context ---
    $(document).on('click.securityRules', '[data-back-to-context]', function(e) {
      e.preventDefault();

      if (panelContextStack.length === 0) return;

      var prev = panelContextStack.pop();

      switchPanelContext(prev.type, prev.id, prev.name);
    });
  }

  // -----------------------------------------
  // INITIALIZATION
  // -----------------------------------------

  // Hook into file manager rendering lifecycle
  // We observe DOM changes to detect when folder contents are rendered

  var isUpdatingBadges = false;

  function init() {
    initEventHandlers();

    // Observe file table body for changes to inject security badges
    var observer = new MutationObserver(function(mutations) {
      if (isUpdatingBadges) return;

      var shouldUpdate = mutations.some(function(m) {
        return m.addedNodes.length > 0;
      });

      if (shouldUpdate) {
        updateSecurityBadges();
      }
    });

    var tableBody = document.querySelector('.file-table-body');

    if (tableBody) {
      observer.observe(tableBody, { childList: true });
    }

    // Initial badge update
    setTimeout(updateSecurityBadges, 500);

    // Show folder security card by default (for root)
    updateFolderSecurityCard('root', 'App Files');

    // Hide original help-tips when security card is active
    $('.help-tips').addClass('hidden');
  }

  // Expose functions for integration
  window.FileSecurityRules = {
    init: init,
    updateSecurityBadges: updateSecurityBadges,
    updateFolderSecurityCard: updateFolderSecurityCard,
    updateSelectedItemSecurity: updateSelectedItemSecurity,
    openSecurityPanel: openSecurityPanel,
    closeSecurityPanel: closeSecurityPanel,
    getSecurityStatus: getSecurityStatus,
    getSecurityBadgeHTML: getSecurityBadgeHTML
  };

  // Auto-init when DOM is ready
  $(document).ready(function() {
    init();
  });
})();
