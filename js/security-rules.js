/* ============================================
   FILE SECURITY RULES UI
   ============================================
   This file handles the security rules UI for
   the file manager widget.
   ============================================ */

(function() {
  'use strict';

  // -----------------------------------------
  // API HELPERS
  // -----------------------------------------

  let appId = null;
  let organizationId = null;
  let currentAppRoleId = null;   // 1=Publisher, 2=Editor, 3=Viewer, 4=Tester
  let currentOrgRoleId = null;   // 1=Admin, 2+=Standard
  let rulesCache = {}; // Keyed by 'type:id', stores API response

  function getAppId() {
    return appId || (typeof currentAppId !== 'undefined' ? currentAppId : Fliplet.Env.get('appId'));
  }

  function getOrganizationId() {
    return organizationId || (typeof currentOrganizationId !== 'undefined' ? currentOrganizationId : null);
  }

  /**
   * Check if the file manager is currently browsing at org level (no app selected).
   */
  function isOrgContext() {
    return !getAppId() && !!getOrganizationId();
  }

  /**
   * Check if the current user can edit access rules in the current context.
   * App context: Publisher (1) or Editor (2). Org context: Admin (1).
   */
  function canEditRules() {
    if (isOrgContext()) {
      return currentOrgRoleId === 1;
    }

    // App context: publisher (1) or editor (2)
    return currentAppRoleId && currentAppRoleId <= 2;
  }

  function getCacheKey(type, id) {
    return type + ':' + id;
  }

  function invalidateCache(type, id) {
    delete rulesCache[getCacheKey(type, id)];
  }

  function clearCache() {
    rulesCache = {};
  }

  function getAccessRulesUrl(type, id) {
    if (type === 'organization') {
      return 'v1/media/organizations/' + id + '/accessRules';
    }

    if (type === 'folder' && String(id) === 'root') {
      return 'v1/media/apps/' + getAppId() + '/accessRules';
    }

    if (type === 'folder') {
      return 'v1/media/folders/' + id + '/accessRules';
    }

    return 'v1/media/files/' + id + '/accessRules';
  }

  function fetchAccessRules(type, id) {
    if (type === 'folder' && String(id) === 'root') {
      const currentApp = getAppId();

      if (!currentApp) {
        // At org level — fetch org rules instead of app rules
        const orgId = getOrganizationId();

        if (!orgId) {
          return Promise.resolve({ accessRules: [], effectiveRules: [], inheritedFrom: null });
        }

        return fetchAccessRules('organization', orgId);
      }
    }

    const url = getAccessRulesUrl(type, id);

    return Fliplet.API.request({ url: url }).then(function(response) {
      rulesCache[getCacheKey(type, id)] = response;

      return response;
    });
  }

  function saveAccessRules(type, id, rules) {
    const url = getAccessRulesUrl(type, id);

    return Fliplet.API.request({
      url: url,
      method: 'PUT',
      data: { accessRules: rules.length > 0 ? rules : null }
    });
  }

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

  let currentSecurityTarget = null; // { type: 'folder'|'file', id: string, name: string }
  let currentRules = [];           // Working copy of rules being edited
  let savedRules = [];             // Last saved state (to detect changes)
  let hasUnsavedChanges = false;
  let serverInheritedFrom = null;  // Original inheritedFrom from API (for draft inheritance preview)
  let serverEffectiveRules = [];   // Original effectiveRules from API (for draft inheritance preview)

  // -----------------------------------------
  // RULE RESOLUTION — uses cached API data
  // -----------------------------------------

  /**
   * Get cached rules for an item. Returns null if not cached.
   * Use fetchAccessRules() to populate the cache first.
   */
  function getCachedRules(type, id) {
    return rulesCache[getCacheKey(type, id)] || null;
  }

  /**
   * Get own rules from cache (synchronous, for UI rendering after fetch).
   */
  function getOwnRulesFromCache(type, id) {
    const cached = getCachedRules(type, id);

    if (!cached) return [];

    return (cached.accessRules || []).slice();
  }

  /**
   * Get effective rules from cache (synchronous, for UI rendering after fetch).
   */
  function getEffectiveFromCache(type, id) {
    const cached = getCachedRules(type, id);

    if (!cached) return { rules: [], inheritedFrom: null };

    const own = cached.accessRules || [];

    if (own.length > 0) {
      return { rules: own.slice(), inheritedFrom: null };
    }

    return {
      rules: (cached.effectiveRules || []).slice(),
      inheritedFrom: cached.inheritedFrom || null
    };
  }

  /**
   * Get effective rules for the current draft state.
   * When currentRules is empty but the item originally had own rules,
   * the cache still shows inheritedFrom: null. This function uses
   * the stored server response to simulate inheritance preview.
   */
  function getDraftEffective() {
    if (currentRules.length > 0) {
      return { rules: currentRules.slice(), inheritedFrom: null };
    }

    // Draft has no rules — show what would be inherited
    if (serverInheritedFrom && serverEffectiveRules.length > 0) {
      return {
        rules: serverEffectiveRules.slice(),
        inheritedFrom: serverInheritedFrom
      };
    }

    // Fall back to cache
    if (currentSecurityTarget) {
      return getEffectiveFromCache(currentSecurityTarget.type, currentSecurityTarget.id);
    }

    return { rules: [], inheritedFrom: null };
  }

  // -----------------------------------------
  // SECURITY STATUS FOR FILE TABLE (Layer 1)
  // -----------------------------------------

  function getSecurityStatus(type, id) {
    const effective = getEffectiveFromCache(type, id);

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
          // Table column: show comma-separated text
          const tableText = Array.isArray(detail) ? detail.join(', ') : (detail || 'Accessible');

          return '<span class="security-badge-actions">' + tableText + '</span>';
        }

        return '<span class="security-badge security-badge-accessible">Accessible</span>' +
          (detail ? '<span class="security-badge-detail">' + (Array.isArray(detail) ? detail.join(', ') : detail) + '</span>' : '');
      case 'not-accessible':
        return '<span class="security-badge security-badge-not-accessible">No access rules</span>';
      default:
        return '';
    }
  }

  // Called after folder contents are rendered to inject security badges
  function updateSecurityBadges() {
    const generation = ++badgeGeneration;

    isUpdatingBadges = true;

    const items = [];

    $('.file-row').each(function() {
      const $row = $(this);
      const id = $row.data('id');
      const type = $row.data('file-type') === 'folder' ? 'folder' : 'file';

      if (!id) return;

      items.push({ $row: $row, type: type, id: String(id) });
    });

    if (items.length === 0) {
      isUpdatingBadges = false;

      return;
    }

    const fetchPromises = items.map(function(item) {
      // Use cache if available, otherwise fetch
      if (getCachedRules(item.type, item.id)) {
        return Promise.resolve();
      }

      return fetchAccessRules(item.type, item.id).catch(function() {
        // Silently handle errors for individual items
      });
    });

    Promise.all(fetchPromises).then(function() {
      // Discard stale results if a newer update has started
      if (generation !== badgeGeneration) return;

      items.forEach(function(item) {
        const effective = getEffectiveFromCache(item.type, item.id);
        const status = effective.rules.length > 0 ? 'accessible' : 'not-accessible';
        const summary = getActionsEnabledSummary(effective.rules);
        const $cell = item.$row.find('.file-security-cell');

        if ($cell.length) {
          $cell.html(getSecurityBadgeHTML(status, summary, { tableCell: true }));
        }
      });

      isUpdatingBadges = false;
    });
  }

  // -----------------------------------------
  // FOLDER SECURITY CARD (Layer 2A)
  // -----------------------------------------

  function updateFolderSecurityCard(folderId, folderName) {
    const $card = $('.folder-security-card');
    const id = String(folderId || 'root');

    $('.help-tips').addClass('hidden');

    // Determine if we're at org level or app level
    const isOrg = isOrgContext() && id === 'root';
    const fetchType = isOrg ? 'organization' : 'folder';
    const fetchId = isOrg ? String(getOrganizationId()) : id;

    // Set name and context immediately (before async fetch) to avoid showing stale data
    let displayName;

    if (isOrg) {
      displayName = folderName || 'Organization Files';
    } else {
      displayName = folderName || (typeof currentAppName !== 'undefined' && currentAppName) || 'App Files';
    }

    $card.find('.folder-access-name').text(displayName);
    $card.data('folder-id', fetchId).data('folder-name', displayName);

    if (isOrg) {
      $card.data('folder-type', 'organization');
    } else {
      $card.removeData('folder-type');
    }

    $card.addClass('active');

    fetchAccessRules(fetchType, fetchId).then(function() {
      const effective = getEffectiveFromCache(fetchType, fetchId);
      const $status = $card.find('.folder-security-status');
      const $callout = $card.find('.folder-no-rules-callout');

      if (effective.rules.length > 0) {
        const summary = getActionsEnabledSummary(effective.rules);
        let badgesHtml = '';

        if (summary && summary.length) {
          badgesHtml = '<span class="security-action-badge">Access: ' + summary.join(', ') + '</span>';
        }

        $status.html(badgesHtml).show();
        $callout.hide();
      } else {
        $status.hide();
        $callout.show();
      }

      // Hide inheritance hint for root/app folders
      const $hint = $card.find('.folder-security-hint');

      if (String(id) === 'root') {
        $hint.hide();
      } else {
        $hint.show();
      }

      // Show/hide edit button based on user role
      const $rulesBtn = $card.find('.btn-open-folder-rules');

      if (canEditRules()) {
        $rulesBtn.text('Access rules').show();
      } else {
        $rulesBtn.text('View access rules').show();
      }
    }).catch(function(err) {
      console.warn('[FileSecurityRules] Failed to fetch folder security card rules:', err);
    });
  }

  // -----------------------------------------
  // SELECTED ITEM SECURITY SECTION (Layer 2B)
  // -----------------------------------------

  function updateSelectedItemSecurity(type, id, name) {
    const $noRulesSection = $('.selected-no-rules-section');
    const $hasRulesSection = $('.selected-has-rules-section');

    // Store target immediately (before async fetch)
    $('.side-actions .btn-edit-rules')
      .data('target-type', type)
      .data('target-id', id)
      .data('target-name', name);

    // Reset
    $noRulesSection.hide();
    $hasRulesSection.hide();

    fetchAccessRules(type, String(id)).then(function() {
      const effective = getEffectiveFromCache(type, String(id));

      if (effective.rules.length > 0) {
        const summary = getActionsEnabledSummary(effective.rules);
        let badgesHtml = '';

        if (summary && summary.length) {
          badgesHtml = '<span class="security-action-badge">Access: ' + summary.join(', ') + '</span>';
        }

        $hasRulesSection.find('.selected-security-status').html(badgesHtml);
        $hasRulesSection.show();
      } else {
        $noRulesSection.show();
      }
    }).catch(function(err) {
      console.warn('[FileSecurityRules] Failed to fetch selected item rules:', err);
    });
  }

  // -----------------------------------------
  // RULE DESCRIPTION HELPERS
  // -----------------------------------------

  function describeAllow(rule) {
    if (rule.allow === 'all') return 'All users';
    if (rule.allow === 'loggedIn') return 'Logged in users';

    if (rule.allow && rule.allow.user) {
      const conditions = [];

      Object.keys(rule.allow.user).forEach(function(key) {
        const cond = rule.allow.user[key];
        const op = Object.keys(cond)[0];

        conditions.push('<code>' + escapeHtml(key) + ' ' + escapeHtml(op) + ' ' + escapeHtml(cond[op]) + '</code>');
      });

      return conditions.join('<br />');
    }

    if (rule.allow && rule.allow.dataSource) {
      return 'Data source #' + rule.allow.dataSource.id;
    }

    if (rule.allow && rule.allow.tokens) {
      return 'Token: ' + escapeHtml(rule.allow.tokens.join(', '));
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
    if (!rule.appId || (Array.isArray(rule.appId) && rule.appId.length === 0)) {
      return 'All apps';
    }

    if (rule.appId === null) return 'All apps';

    const ids = Array.isArray(rule.appId) ? rule.appId : [rule.appId];

    const names = ids.map(function(id) {
      const app = appsList.find(function(a) { return a.id === id; });

      return app ? escapeHtml(app.name) : 'App ' + id;
    });

    return names.join(', ');
  }

  function describeRule(rule) {
    const allow = rule.allow === 'all' ? 'All users' : rule.allow === 'loggedIn' ? 'Logged in users' : 'Specific users';
    const actions = (rule.type || []).join(', ');

    return allow + ' can ' + actions;
  }

  /**
   * Aggregate enabled action types across all rules and format as summary.
   * e.g. "Read and Update by 3 rules"
   */
  function getActionsEnabledSummary(rules) {
    const actionSet = {};
    let enabledCount = 0;

    rules.forEach(function(rule) {
      if (rule.enabled === false) return;

      enabledCount++;

      if (typeof rule.script === 'string') {
        actionSet['custom'] = true;
      } else {
        (rule.type || []).forEach(function(t) {
          actionSet[t] = true;
        });
      }
    });

    const actions = Object.keys(actionSet);

    if (actions.length === 0) return [];

    // Capitalize: 'read' → 'Read'
    const labels = actions.map(function(a) {
      if (a === 'custom') return 'Custom rule';

      return a.charAt(0).toUpperCase() + a.slice(1);
    });

    return labels;
  }

  // -----------------------------------------
  // SLIDE-OUT PANEL (Layer 3)
  // -----------------------------------------

  /**
   * Render a breadcrumb path in the overlay panel header area.
   */
  function renderPanelPath($panel) {
    let $pathEl = $panel.find('.security-panel-path');

    if (!$pathEl.length) {
      $pathEl = $('<div class="security-panel-path"></div>');
      // Insert after the context-back link but before panel states
      const $contextBack = $panel.find('.panel-context-back');

      if ($contextBack.length) {
        $contextBack.after($pathEl);
      } else {
        $panel.find('.security-panel-body').prepend($pathEl);
      }
    }

    const parts = [];
    let targetAlreadyInPath = false;

    if (typeof navStack !== 'undefined' && navStack.length > 0) {
      // When context has been switched, trim path to just the org root
      const stackItems = panelContextStack.length > 0 ? [navStack[0]] : navStack;

      stackItems.forEach(function(item) {
        parts.push(escapeHtml(item.name || item.id));
      });

      // Check if the last navStack item is the same as the security target
      // (happens when opening rules for the folder you're currently browsing)
      if (currentSecurityTarget) {
        const lastItem = stackItems[stackItems.length - 1];

        if (lastItem) {
          const targetId = String(currentSecurityTarget.id);
          const lastId = String(lastItem.id);

          // Direct ID match (subfolder case), or root folder matching the app entry
          if (lastId === targetId
            || (targetId === 'root' && lastItem.type === 'appId')
            || (lastItem.name && lastItem.name === currentSecurityTarget.name && lastId !== 'undefined')) {
            targetAlreadyInPath = true;
          }
        }
      }
    }

    if (currentSecurityTarget && currentSecurityTarget.name && !targetAlreadyInPath) {
      parts.push('<strong>' + escapeHtml(currentSecurityTarget.name) + '</strong>');
    } else if (targetAlreadyInPath && parts.length > 0) {
      // Bold the last item since it's the target
      parts[parts.length - 1] = '<strong>' + parts[parts.length - 1] + '</strong>';
    }

    if (parts.length > 0) {
      let pathHtml = parts.join(' <i class="fa fa-chevron-right"></i> ');

      // Add folder children badge if applicable
      const childrenBadge = getFolderChildrenBadge();

      if (childrenBadge) {
        pathHtml += ' ' + childrenBadge;
      }

      $pathEl.html(pathHtml).show();
    } else {
      $pathEl.hide();
    }
  }

  /**
   * Get folder children count badge HTML for the panel path area.
   */
  function getFolderChildrenBadge() {
    if (!currentSecurityTarget || currentSecurityTarget.type !== 'folder') return '';

    // Only show badge when the security target is the currently browsed folder,
    // since currentFolders/currentFiles reflect the file manager's listed contents
    const browsedFolderId = String(typeof currentFolderId !== 'undefined' && currentFolderId ? currentFolderId : 'root');

    if (String(currentSecurityTarget.id) !== browsedFolderId) return '';

    let folderCount = 0;
    let fileCount = 0;

    if (typeof currentFolders !== 'undefined' && Array.isArray(currentFolders)) {
      folderCount = currentFolders.length;
    }

    if (typeof currentFiles !== 'undefined' && Array.isArray(currentFiles)) {
      fileCount = currentFiles.length;
    }

    if (folderCount === 0 && fileCount === 0) return '';

    const parts = [];

    if (folderCount > 0) parts.push(folderCount + ' folder' + (folderCount !== 1 ? 's' : ''));
    if (fileCount > 0) parts.push(fileCount + ' file' + (fileCount !== 1 ? 's' : ''));

    return '<span class="panel-children-badge">' + parts.join(', ') + '</span>';
  }

  function openSecurityPanel(type, id, name) {
    currentSecurityTarget = { type: type, id: String(id), name: name || '' };
    panelContextStack = [];

    const $overlay = $('#security-panel-overlay');
    const $panel = $overlay.find('.security-panel');

    // Show panel immediately with loading state
    $panel.find('.panel-context-back').hide();
    $panel.find('.security-panel-header h3').html('Access Rules <a href="#" class="panel-help-link" target="_blank"><i class="fa fa-question-circle-o"></i></a>');

    // Render path breadcrumb below header
    renderPanelPath($panel);

    showPanelState('list');
    $overlay.addClass('active');

    setTimeout(function() {
      $overlay.addClass('visible');
    }, 10);

    $('body').css('overflow', 'hidden');

    // Apply read-only mode for users without edit permission
    const readOnly = !canEditRules();

    $panel.toggleClass('read-only', readOnly);

    $panel.find('.read-only-banner').remove();

    if (readOnly) {
      $panel.find('.security-rules-toolbar').hide();
      $panel.find('.security-panel-body').prepend(
        '<div class="read-only-banner callout callout-warning">' +
        '<p>You don\'t have permission to edit access rules.</p></div>'
      );
    } else {
      $panel.find('.security-rules-toolbar').show();
    }

    // Fetch rules from API
    fetchAccessRules(type, currentSecurityTarget.id).then(function(response) {
      const own = (response.accessRules || []).slice();
      const effective = {
        rules: own.length > 0 ? own : (response.effectiveRules || []).slice(),
        inheritedFrom: response.inheritedFrom || null
      };

      currentRules = own.slice();
      savedRules = JSON.parse(JSON.stringify(own));
      hasUnsavedChanges = false;
      serverInheritedFrom = response.inheritedFrom || null;
      serverEffectiveRules = (response.effectiveRules || []).slice();

      renderInheritanceBanner(own, effective);

      renderRulesTable();
      renderInheritedRules(own, effective);
      updateSaveButton();
    }).catch(function(err) {
      console.error('[FileSecurityRules] Failed to fetch access rules:', err);

      currentRules = [];
      savedRules = [];
      hasUnsavedChanges = false;

      renderInheritanceBanner([], { rules: [], inheritedFrom: null });

      renderRulesTable();
      renderInheritedRules([], { rules: [], inheritedFrom: null });
      updateSaveButton();
    });
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

    const $overlay = $('#security-panel-overlay');

    $overlay.removeClass('visible');

    setTimeout(function() {
      $overlay.removeClass('active');
      $('body').css('overflow', '');
    }, 500);

    currentSecurityTarget = null;
    currentRules = [];
    hasUnsavedChanges = false;
    panelContextStack = [];

    // Refresh badges and sidebar after closing (catches saves made during session)
    clearCache();
    updateSecurityBadges();

    if ($('.folder-security-card').hasClass('active')) {
      const $card = $('.folder-security-card');
      const cardType = $card.data('folder-type');

      if (cardType === 'organization') {
        const orgId = $card.data('folder-id');

        fetchAccessRules('organization', orgId).then(function() {
          const effective = getEffectiveFromCache('organization', String(orgId));
          const $status = $card.find('.folder-security-status');
          const $callout = $card.find('.folder-no-rules-callout');

          if (effective.rules.length > 0) {
            const summary = getActionsEnabledSummary(effective.rules);
            let badgesHtml = '';

            if (summary && summary.length) {
              badgesHtml = '<span class="security-action-badge">Access: ' + summary.join(', ') + '</span>';
            }

            $status.html(badgesHtml).show();
            $callout.hide();
          } else {
            $status.hide();
            $callout.show();
          }
        });
      } else {
        updateFolderSecurityCard(
          $card.data('folder-id') || 'root',
          $card.data('folder-name') || 'App Files'
        );
      }
    }
  }

  /**
   * Switch the panel to show rules for a different item (e.g. inherited folder)
   * without closing/reopening the overlay or navigating the file manager.
   */
  function switchPanelContext(type, id, name) {
    currentSecurityTarget = { type: type, id: String(id), name: name || '' };

    const $overlay = $('#security-panel-overlay');
    const $panel = $overlay.find('.security-panel');

    // Update "Back to [item]" link
    const $backLink = $panel.find('.panel-context-back');

    if (panelContextStack.length > 0) {
      const prevContext = panelContextStack[panelContextStack.length - 1];

      $backLink.find('.back-to-context-label').text('Back to ' + (prevContext.name || prevContext.type));
      $backLink.show();
    } else {
      $backLink.hide();
    }

    // Update breadcrumbs to reflect the new context
    renderPanelPath($panel);

    fetchAccessRules(type, currentSecurityTarget.id).then(function(response) {
      const own = (response.accessRules || []).slice();
      const effective = {
        rules: own.length > 0 ? own : (response.effectiveRules || []).slice(),
        inheritedFrom: response.inheritedFrom || null
      };

      currentRules = own.slice();
      savedRules = JSON.parse(JSON.stringify(own));
      hasUnsavedChanges = false;
      serverInheritedFrom = response.inheritedFrom || null;
      serverEffectiveRules = (response.effectiveRules || []).slice();

      renderInheritanceBanner(own, effective);
      renderRulesTable();
      renderInheritedRules(own, effective);
      updateSaveButton();
      showPanelState('list');
    }).catch(function(err) {
      console.error('[FileSecurityRules] Failed to fetch rules for context switch:', err);
    });
  }

  function renderInheritanceBanner(own, effective) {
    const $banner = $('#security-panel-inheritance');
    let html = '';
    const isRoot = currentSecurityTarget.type === 'folder' && String(currentSecurityTarget.id) === 'root';
    const isOrg = currentSecurityTarget.type === 'organization';
    const isFile = currentSecurityTarget.type === 'file';

    if (own.length > 0 && isOrg) {
      html = '<div class="callout callout-primary">' +
        '<p>Organization-level access rules. Apps and files without their own rules will inherit these.</p>' +
        '</div>';
    } else if (own.length === 0 && isOrg) {
      html = '<div class="callout callout-warning">' +
        '<p>No organization-level access rules. Files without app or folder rules will be denied.</p>' +
        '</div>';
    } else if (own.length > 0 && !isRoot && !isFile) {
      html = '<div class="callout callout-primary">' +
        '<p>This folder has its own rules. Child items without their own rules will inherit these.</p>' +
        '</div>';
    } else if (own.length > 0 && isFile) {
      html = '<div class="callout callout-primary">' +
        '<p>This file has its own access rules.</p>' +
        '</div>';
    } else if (own.length > 0 && isRoot) {
      html = '<div class="callout callout-primary">' +
        '<p>This folder has access rules. Child items without their own rules will inherit these.</p>' +
        '</div>';
    } else if (own.length === 0 && effective.inheritedFrom && effective.rules.length > 0) {
      // Draft preview: user removed all own rules, showing what would be inherited
      let inheritSource = 'parent';

      if (effective.inheritedFrom.type === 'organization') {
        inheritSource = 'organization';
      } else if (effective.inheritedFrom.type === 'app') {
        inheritSource = 'app';
      }

      html = '<div class="callout callout-primary">' +
        '<p>No own rules. This ' + currentSecurityTarget.type +
          ' will inherit access rules from its ' + inheritSource + '.</p>' +
        '</div>';
    } else if (effective.rules.length === 0) {
      html = '<div class="callout callout-warning">' +
        '<p>No access rules. This ' + currentSecurityTarget.type +
          ' is not accessible to app users. Add rules below.</p>' +
        '</div>';
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
        const $original = ui.helper.children();

        ui.placeholder.children().each(function(i) {
          $(this).width($original.eq(i).width());
        });
      },
      update: function() {
        const result = $tbody.sortable('toArray', { attribute: 'data-rule-index' });

        currentRules = result.map(function(r) {
          return currentRules[parseInt(r, 10)];
        });

        // Re-render to update data-rule-index attributes
        renderRulesTable();
        updateSaveButton();
      }
    });
  }

  function renderRulesTable() {
    const $tbody = $('#security-rules-tbody');

    $tbody.empty();

    if (currentRules.length === 0) {
      // Hide empty placeholder if inherited rules are shown
      const effective = getDraftEffective();
      const hasInherited = effective.inheritedFrom && effective.rules.length > 0;

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
      let enabledClass = rule.enabled !== false ? 'rule-enabled' : 'rule-disabled';
      const isEnabled = rule.enabled !== false;
      const isCustom = typeof rule.script === 'string';
      const isStop = rule.stop === true;

      if (isStop) {
        enabledClass += ' rule-stop';
      }

      const statusCell = '<td class="align-baseline opacity-full">' +
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

      const stopCell = '<td class="align-baseline rule-stop-cell">' +
        (isStop
          ? '<span class="rule-stop-label">Stop</span>'
          : '<span class="rule-continue-label">Continue</span>') +
        '</td>';

      const actionsCell = '<td class="align-baseline opacity-full">' +
        '<button class="btn btn-default btn-sm" data-edit-rule="' + index + '">Edit</button> ' +
        '<button class="btn btn-danger btn-sm" data-delete-rule="' + index + '">Delete</button>' +
        '</td>';

      let html;

      if (isCustom) {
        html = '<tr data-rule-index="' + index + '" class="' + enabledClass + '">' +
          statusCell +
          '<td colspan="3" class="align-baseline"><span class="label label-default"><i class="fa fa-code"></i> Custom rule</span> ' + escapeHtml(rule.name || 'Untitled custom rule') + '</td>' +
          stopCell +
          actionsCell +
          '</tr>';
      } else {
        html = '<tr data-rule-index="' + index + '" class="' + enabledClass + '">' +
          statusCell +
          '<td class="align-baseline">' + describeAllow(rule) + '</td>' +
          '<td class="align-baseline">' + describeType(rule) + '</td>' +
          '<td class="align-baseline">' + describeApps(rule) + '</td>' +
          stopCell +
          actionsCell +
          '</tr>';
      }

      $tbody.append(html);
    });

    // Initialize sortable for drag-and-drop reordering
    initRulesSortable($tbody);
  }

  function renderInheritedRules(own, effective) {
    const $section = $('#security-inherited-rules');

    // When item has own rules, inherited rules from parent aren't displayed
    // because own rules take precedence (most specific wins)
    if (own.length > 0) {
      $section.hide();
      return;
    }

    if (effective.inheritedFrom && effective.rules.length > 0) {
      const $tbody = $section.find('tbody');

      $tbody.empty();

      effective.rules.forEach(function(rule) {
        const isStop = rule.stop === true;
        const stopCell = '<td class="rule-stop-cell">' +
          (isStop
            ? '<span class="rule-stop-label">Stop</span>'
            : '<span class="rule-continue-label">Continue</span>') +
          '</td>';

        const html = '<tr' + (isStop ? ' class="rule-stop"' : '') + '>' +
          '<td>' + (rule.enabled !== false ? '<i class="fa fa-check-circle" style="color:#10B981"></i>' : '<i class="fa fa-minus-circle" style="color:#ccc"></i>') + '</td>' +
          '<td>' + describeAllow(rule) + '</td>' +
          '<td>' + describeType(rule) + '</td>' +
          '<td>' + describeApps(rule) + '</td>' +
          stopCell +
          '</tr>';

        $tbody.append(html);
      });

      // Show source name from server response
      let inheritedName;
      let inheritedId;

      if (effective.inheritedFrom.type === 'organization') {
        inheritedName = effective.inheritedFrom.organizationName || 'Organization';
        inheritedId = effective.inheritedFrom.organizationId;

        $section.find('.inherited-from-path').text('Inherited from organization: ' + inheritedName);
        $section.find('[data-edit-inherited-rules]')
          .show()
          .data('folder-id', inheritedId)
          .data('folder-name', inheritedName)
          .data('inherited-type', 'organization');
      } else if (effective.inheritedFrom.type === 'app') {
        inheritedName = effective.inheritedFrom.appName || (typeof currentAppName !== 'undefined' ? currentAppName : 'App Files');
        inheritedId = 'root';

        $section.find('.inherited-from-path').text('Inherited from app: ' + inheritedName);
        $section.find('[data-edit-inherited-rules]')
          .show()
          .data('folder-id', inheritedId)
          .data('folder-name', inheritedName)
          .data('inherited-type', 'app');
      } else {
        inheritedName = effective.inheritedFrom.folderName || 'Parent folder';
        inheritedId = effective.inheritedFrom.folderId;

        $section.find('.inherited-from-path').text('Inherited from folder: ' + inheritedName);
        $section.find('[data-edit-inherited-rules]')
          .show()
          .data('folder-id', inheritedId)
          .data('folder-name', inheritedName)
          .data('inherited-type', 'folder');
      }

      $section.show();
    } else {
      $section.hide();
    }
  }

  function updateSaveButton() {
    const $btn = $('.btn-save-rules');
    const changed = JSON.stringify(currentRules) !== JSON.stringify(savedRules);

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

  let editingRuleIndex = null; // null = adding new, number = editing existing
  let dataSourcesList = [];    // Cached data sources for the select dropdown
  let appsList = [];           // Cached apps for the "Specific apps" checkboxes
  let tokensList = [];         // Cached tokens for the "Specific token" select
  let panelContextStack = [];  // Stack for navigating between inherited folder contexts
  let customRuleEditor = null; // CodeMirror instance for custom JS rules

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

  function loadMockDataSources() {
    dataSourcesList = [];
    populateDataSourceSelect();
  }

  function populateDataSourceSelect() {
    const $select = $('#configure-file-rule [name="ds-id"]');

    $select.empty().append('<option value="">-- Select data source</option>');

    dataSourcesList.forEach(function(ds) {
      $select.append('<option value="' + ds.id + '">' + escapeHtml(ds.name) + ' (ID: ' + ds.id + ')</option>');
    });
  }

  function loadDataSourceColumns(dsId) {
    const $select = $('#configure-file-rule [name="ds-file-column"]');

    $select.empty().append('<option value="">-- Select column</option>');

    if (!dsId) {
      $select.prop('disabled', true);
      return Promise.resolve();
    }

    $select.prop('disabled', false);

    // [FILEAPI] Fetch columns via Fliplet.DataSources.connect().getColumns()
    if (typeof Fliplet !== 'undefined' && Fliplet.DataSources && typeof Fliplet.DataSources.connect === 'function') {
      return Fliplet.DataSources.connect(dsId).then(function(connection) {
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
    }

    loadMockDataSourceColumns($select);

    return Promise.resolve();
  }

  function loadMockDataSourceColumns($select) {
    $select.prop('disabled', true);
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

  function loadMockApps() {
    appsList = [];
    populateAppsList();
  }

  // [FILEAPI] Load API tokens for the "Specific token" select
  function loadTokens() {
    if (typeof Fliplet !== 'undefined' && Fliplet.API && typeof Fliplet.API.request === 'function') {
      return Fliplet.API.request({ url: 'v1/tokens' }).then(function(response) {
        tokensList = response.tokens || response || [];
        populateTokenSelect();
      }).catch(function() {
        loadMockTokens();
      });
    }

    loadMockTokens();

    return Promise.resolve();
  }

  function loadMockTokens() {
    tokensList = [];
    populateTokenSelect();
  }

  function populateTokenSelect() {
    const $select = $('#configure-file-rule [name="token-id"]');

    $select.empty().append('<option value="">-- Select API Token</option>');

    // Group tokens by app name
    const groups = {};

    tokensList.forEach(function(token) {
      const appName = (token.apps && token.apps.length > 0 && token.apps[0].name) || 'Other';

      if (!groups[appName]) groups[appName] = [];

      groups[appName].push(token);
    });

    Object.keys(groups).sort().forEach(function(appName) {
      const $group = $('<optgroup>').attr('label', appName);

      groups[appName].forEach(function(token) {
        $group.append(
          '<option value="' + token.id + '">ID#' + token.id + ' &ndash; ' + escapeHtml(token.fullName || token.name || '') + '</option>'
        );
      });

      $select.append($group);
    });
  }

  function populateAppsList(selectedIds) {
    const $list = $('#configure-file-rule .apps-list');
    const selected = selectedIds || [];

    $list.empty();

    appsList.forEach(function(app) {
      const checked = selected.indexOf(app.id) !== -1 ? ' checked' : '';

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

    const $editor = $('#configure-file-rule');
    const isFolder = currentSecurityTarget && (currentSecurityTarget.type === 'folder' || currentSecurityTarget.type === 'organization');
    const isCustom = rule && typeof rule.script === 'string';

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
    const $createCheckbox = $editor.find('.action-checkbox-create');

    if (isFolder) {
      $createCheckbox.show().find('input').prop('disabled', false);
    } else {
      $createCheckbox.hide().find('input').prop('checked', false).prop('disabled', true);
    }

    // "Applies to" (app scope) — hide for org rules since org files have no app
    const isOrganization = currentSecurityTarget && currentSecurityTarget.type === 'organization';
    const $appScopeSection = $editor.find('.rule-app-scope-section');

    if (isOrganization) {
      $appScopeSection.hide();
    } else {
      $appScopeSection.show();
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

    // Reset stop controls
    $editor.find('[name="rule-stop"][value="false"]').prop('checked', true);
    $editor.find('[name="custom-rule-stop"][value="false"]').prop('checked', true);
  }

  function populateRuleForm($editor, rule) {
    // Custom rule
    if (typeof rule.script === 'string') {
      $editor.find('[name="custom-rule-name"]').val(rule.name || 'Untitled custom rule');

      if (customRuleEditor) {
        customRuleEditor.setValue(rule.script || '');
      }

      // Stop control
      $editor.find('[name="custom-rule-stop"][value="' + (rule.stop ? 'true' : 'false') + '"]').prop('checked', true);

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

      const $filters = $editor.find('.user-filters-wrapper .required-fields');

      Object.keys(rule.allow.user).forEach(function(key) {
        const cond = rule.allow.user[key];
        const op = Object.keys(cond)[0];

        addUserFilterRow($filters, key, op, cond[op]);
      });
    } else if (rule.allow && rule.allow.dataSource) {
      $editor.find('[data-allow-type="dataSource"]').addClass('selected');
      $editor.find('.ds-matching-wrapper').removeClass('hidden');

      $editor.find('[name="ds-id"]').val(rule.allow.dataSource.id);

      // Load columns for the selected DS, then set the file column value
      const savedFileColumn = rule.allow.dataSource.fileColumn || '';

      loadDataSourceColumns(rule.allow.dataSource.id).then(function() {
        $editor.find('[name="ds-file-column"]').val(savedFileColumn);
      });

      if (rule.allow.dataSource.where) {
        const $whereFilters = $editor.find('.ds-where-filters');

        Object.keys(rule.allow.dataSource.where).forEach(function(key) {
          const cond = rule.allow.dataSource.where[key];
          const op = Object.keys(cond)[0];

          addUserFilterRow($whereFilters, key, op, cond[op]);
        });
      }
    } else if (rule.allow && rule.allow.tokens) {
      $editor.find('[data-allow-type="tokens"]').addClass('selected');
      $editor.find('.tokens-wrapper').removeClass('hidden');

      if (rule.allow.tokens.length > 0) {
        if (!tokensList.length) {
          // Load tokens first, then set the value
          const tokenVal = rule.allow.tokens[0];

          loadTokens().then(function() {
            $editor.find('[name="token-id"]').val(tokenVal);
          });
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

    if (rule.appId && Array.isArray(rule.appId) && rule.appId.length > 0) {
      $editor.find('[data-app-scope="filter"]').addClass('selected');
      $editor.find('.apps-list-wrapper').removeClass('hidden');
      populateAppsList(rule.appId);
    } else {
      $editor.find('[data-app-scope="all"]').addClass('selected');
    }

    // Stop control
    $editor.find('[name="rule-stop"][value="' + (rule.stop ? 'true' : 'false') + '"]').prop('checked', true);
  }

  function addUserFilterRow($container, column, operator, value) {
    const html = '<div class="required-field">' +
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
    const $editor = $('#configure-file-rule');
    const $btn = $editor.find('[data-save-security-rule]');
    const isCustomRule = !$editor.find('[data-rule-standard]').is(':visible');

    // Custom rules: always enabled
    if (isCustomRule) {
      $btn.removeAttr('disabled').removeClass('disabled');
      return;
    }

    const types = $editor.find('[name="type"]:checked');

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
    const $editor = $('#configure-file-rule');
    let rule = {};

    // Check if custom rule
    const isCustomRule = !$editor.find('[data-rule-standard]').is(':visible');

    if (isCustomRule) {
      rule = {
        name: $editor.find('[name="custom-rule-name"]').val() || 'Untitled custom rule',
        script: customRuleEditor ? customRuleEditor.getValue() : '',
        enabled: true
      };

      // Stop control
      const customStop = $editor.find('[name="custom-rule-stop"]:checked').val();

      if (customStop === 'true') {
        rule.stop = true;
      }

      if (customRuleEditor) {
        customRuleEditor.setValue('');
      }

      return rule;
    }

    // Allow
    const allowType = $editor.find('[data-allow-type].selected').data('allow-type');

    if (allowType === 'all') {
      rule.allow = 'all';
    } else if (allowType === 'loggedIn') {
      rule.allow = 'loggedIn';
    } else if (allowType === 'filter') {
      const userConditions = {};

      $editor.find('.user-filters-wrapper .required-field').each(function() {
        const col = $(this).find('[name="column"]').val();
        const op = $(this).find('[name="operator"]').val();
        const val = $(this).find('[name="value"]').val();

        if (col) {
          const cond = {};

          cond[op] = val;
          userConditions[col] = cond;
        }
      });

      rule.allow = { user: userConditions };
    } else if (allowType === 'dataSource') {
      const dsId = parseInt($editor.find('[name="ds-id"]').val(), 10);
      const fileColumn = $editor.find('[name="ds-file-column"]').val();
      const where = {};

      $editor.find('.ds-where-filters .required-field').each(function() {
        const col = $(this).find('[name="column"]').val();
        const op = $(this).find('[name="operator"]').val();
        const val = $(this).find('[name="value"]').val();

        if (col) {
          const cond = {};

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
      const tokenId = parseInt($editor.find('[name="token-id"]').val(), 10);

      rule.allow = { tokens: tokenId ? [tokenId] : [] };
    }

    // Type
    rule.type = [];

    $editor.find('[name="type"]:checked').each(function() {
      rule.type.push($(this).val());
    });

    // App scope
    const appScope = $editor.find('[data-app-scope].selected').data('app-scope');

    if (appScope === 'all') {
      rule.appId = null;
    } else {
      rule.appId = [];

      $editor.find('.apps-list input:checked').each(function() {
        rule.appId.push(parseInt($(this).val(), 10));
      });
    }

    rule.enabled = true;

    // Stop control
    const stopVal = $editor.find('[name="rule-stop"]:checked').val();

    if (stopVal === 'true') {
      rule.stop = true;
    }

    return rule;
  }

  // -----------------------------------------
  // PRE-CONFIGURED RULES
  // -----------------------------------------

  const preconfiguredRules = [
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
    },
    {
      name: 'Deny access',
      rule: { name: 'Deny access', script: 'return { granted: false };', stop: true, enabled: true }
    }
  ];

  // -----------------------------------------
  // EVENT HANDLERS
  // -----------------------------------------

  function performSave() {
    if (!currentSecurityTarget) return;

    const target = currentSecurityTarget;

    saveAccessRules(target.type, target.id, currentRules).then(function() {
      savedRules = JSON.parse(JSON.stringify(currentRules));
      hasUnsavedChanges = false;
      updateSaveButton();

      // Re-fetch and re-render the overlay panel to reflect inheritance changes
      fetchAccessRules(target.type, target.id).then(function(response) {
        const own = (response.accessRules || []).slice();
        const effective = {
          rules: own.length > 0 ? own : (response.effectiveRules || []).slice(),
          inheritedFrom: response.inheritedFrom || null
        };

        currentRules = own.slice();
        savedRules = JSON.parse(JSON.stringify(own));
        serverInheritedFrom = response.inheritedFrom || null;
        serverEffectiveRules = (response.effectiveRules || []).slice();

        renderInheritanceBanner(own, effective);
        renderRulesTable();
        renderInheritedRules(own, effective);
        updateSaveButton();

        // Update panel path with current children count
        const $panel = $('#security-panel-overlay .security-panel');

        renderPanelPath($panel);

        // Clear client cache and refresh all badges/sidebar AFTER the panel
        // re-fetch completes, so server-side cache invalidation has propagated
        clearCache();
        updateSecurityBadges();

        if ($('.folder-security-card').hasClass('active')) {
          const $card = $('.folder-security-card');
          const cardType = $card.data('folder-type');

          if (cardType === 'organization') {
            // Re-fetch org rules directly
            const orgId = $card.data('folder-id');

            fetchAccessRules('organization', orgId).then(function() {
              const effective = getEffectiveFromCache('organization', String(orgId));
              const $status = $card.find('.folder-security-status');
              const $callout = $card.find('.folder-no-rules-callout');

              if (effective.rules.length > 0) {
                const summary = getActionsEnabledSummary(effective.rules);
                let badgesHtml = '';

                if (summary && summary.length) {
                  badgesHtml = '<span class="security-action-badge">Access: ' + summary.join(', ') + '</span>';
                }

                $status.html(badgesHtml).show();
                $callout.hide();
              } else {
                $status.hide();
                $callout.show();
              }
            });
          } else {
            updateFolderSecurityCard(
              $card.data('folder-id') || 'root',
              $card.data('folder-name') || 'App Files'
            );
          }
        }

        const $activeRow = $('.file-row.active');

        if ($activeRow.length === 1 && window.FileSecurityRules) {
          const selType = $activeRow.data('file-type') === 'folder' ? 'folder' : 'file';

          updateSelectedItemSecurity(selType, $activeRow.data('id'), $activeRow.find('.file-name span').first().text());
        }
      });

      Fliplet.Modal.alert({
        title: 'Rules saved',
        message: 'Access rules saved successfully.'
      });
    }).catch(function(err) {
      console.error('[FileSecurityRules] Failed to save access rules:', err);

      const statusCode = err && err.status;
      const message = statusCode === 403
        ? 'You don\'t have permission to modify access rules. Contact a publisher or organization admin.'
        : 'Failed to save access rules. Please try again.';

      Fliplet.Modal.alert({
        title: statusCode === 403 ? 'Permission denied' : 'Error',
        message: message
      });
    });
  }

  function initEventHandlers() {
    // --- Layer 2A: Folder security card "Access rules" button ---
    $(document).on('click.securityRules', '.folder-security-card .btn-open-folder-rules', function(e) {
      e.preventDefault();

      const $card = $('.folder-security-card');
      const cardType = $card.data('folder-type');
      const folderId = $card.data('folder-id') || 'root';
      const folderName = $card.data('folder-name') || 'App Files';

      if (cardType === 'organization') {
        openSecurityPanel('organization', folderId, folderName);
      } else {
        openSecurityPanel('folder', folderId, folderName);
      }
    });

    // --- Layer 2B: Selected item edit via Actions dropdown ---
    $(document).on('click.securityRules', '.side-actions .btn-edit-rules', function(e) {
      e.preventDefault();
      e.stopPropagation();

      const type = $(this).data('target-type');
      const id = $(this).data('target-id');
      const name = $(this).data('target-name');

      if (type && id !== undefined && id !== null) {
        openSecurityPanel(type, id, name);
      }
    });


    // --- Navigate to folder from inherited source link ---
    $(document).on('click.securityRules', '[data-navigate-folder]', function(e) {
      e.preventDefault();

      const folderId = $(this).data('navigate-folder');

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

      const index = parseInt($(this).closest('tr').data('rule-index'), 10);

      if (isNaN(index) || !currentRules[index]) return;

      currentRules[index].enabled = !currentRules[index].enabled;
      renderRulesTable();
      updateSaveButton();
    });

    $(document).on('click.securityRules', '[data-edit-rule]', function(e) {
      e.preventDefault();

      const index = parseInt($(this).data('edit-rule'), 10);

      if (isNaN(index) || !currentRules[index]) return;

      // Ensure CodeMirror is initialized for custom rules
      if (typeof currentRules[index].script === 'string') {
        initCustomRuleEditor();
      }

      openRuleEditor(currentRules[index], index);
    });

    $(document).on('click.securityRules', '[data-delete-rule]', function(e) {
      e.preventDefault();

      const index = parseInt($(this).data('delete-rule'), 10);

      if (isNaN(index) || !currentRules[index]) return;

      // Draft-based: remove immediately, no confirmation. User confirms on Save.
      currentRules.splice(index, 1);
      renderRulesTable();
      updateSaveButton();

      const effective = getDraftEffective();

      renderInheritanceBanner(currentRules, effective);
      renderInheritedRules(currentRules, effective);
    });

    // Clear own rules (draft-based: no confirmation, user confirms on Save)
    $(document).on('click.securityRules', '[data-clear-own-rules]', function(e) {
      e.preventDefault();

      currentRules = [];
      renderRulesTable();
      updateSaveButton();

      const effective = getDraftEffective();

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

      const index = parseInt($(this).data('preconfigured-rule'), 10);

      if (isNaN(index) || !preconfiguredRules[index]) return;

      const newRule = JSON.parse(JSON.stringify(preconfiguredRules[index].rule));

      currentRules.push(newRule);
      renderRulesTable();
      updateSaveButton();

      const effective = getDraftEffective();

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

      const $editor = $('#configure-file-rule');

      $editor.find('[data-allow-type]').removeClass('selected');
      $(this).addClass('selected');

      const type = $(this).data('allow-type');

      // Show/hide relevant subsections
      $editor.find('.user-filters-wrapper').toggleClass('hidden', type !== 'filter');
      $editor.find('.ds-matching-wrapper').toggleClass('hidden', type !== 'dataSource');
      $editor.find('.tokens-wrapper').toggleClass('hidden', type !== 'tokens');

      // Auto-add first condition row when "Specific users" is selected
      if (type === 'filter') {
        const $filters = $editor.find('.security-user-filters');

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

      const $container = $(this).siblings('.required-fields');

      addUserFilterRow($container, '', 'equals', '');
    });

    // Add DS where condition
    $(document).on('click.securityRules', '[data-add-ds-condition]', function(e) {
      e.preventDefault();

      const $container = $(this).siblings('.required-fields');

      addUserFilterRow($container, '', 'equals', '');
    });

    // Load columns when data source changes
    $(document).on('change.securityRules', '#configure-file-rule [name="ds-id"]', function() {
      const dsId = parseInt($(this).val(), 10);

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

      const $editor = $('#configure-file-rule');

      $editor.find('[data-app-scope]').removeClass('selected');
      $(this).addClass('selected');

      const scope = $(this).data('app-scope');

      $editor.find('.apps-list-wrapper').toggleClass('hidden', scope !== 'filter');
    });

    // Save rule
    $(document).on('click.securityRules', '[data-save-security-rule]', function(e) {
      e.preventDefault();

      const $editor = $('#configure-file-rule');
      const isCustomRule = !$editor.find('[data-rule-standard]').is(':visible');
      let error = null;

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
          const col = $.trim($(this).find('[name="column"]').val());
          const val = $.trim($(this).find('[name="value"]').val());

          if (col && val) {
            error = error || validateHandlebarsValue(val, col);
          }
        });

        // Validate Handlebars in DS where conditions
        $editor.find('.ds-where-filters .required-field').each(function() {
          const col = $.trim($(this).find('[name="column"]').val());
          const val = $.trim($(this).find('[name="value"]').val());

          if (col && val) {
            error = error || validateHandlebarsValue(val, col);
          }
        });

        if (error) {
          Fliplet.Modal.alert({ message: error });
          return;
        }
      }

      const rule = collectRuleFromForm();

      if (editingRuleIndex !== null) {
        currentRules[editingRuleIndex] = rule;
      } else {
        currentRules.push(rule);
      }

      showPanelState('list');
      renderRulesTable();
      updateSaveButton();

      const effective = getDraftEffective();

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
      const hadRules = savedRules.length > 0;
      const hasNoRules = currentRules.length === 0;

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

      const inheritedType = $(this).data('inherited-type');
      const targetId = $(this).data('folder-id');
      const targetName = $(this).data('folder-name') || targetId;

      // Push current context onto the stack so user can go back
      if (currentSecurityTarget) {
        panelContextStack.push({
          type: currentSecurityTarget.type,
          id: currentSecurityTarget.id,
          name: currentSecurityTarget.name
        });
      }

      if (inheritedType === 'organization') {
        switchPanelContext('organization', targetId, targetName);
      } else {
        // For app-level inheritance, use 'root' which maps to app endpoint
        switchPanelContext('folder', targetId || 'root', targetName);
      }
    });

    // --- Back to previous context ---
    $(document).on('click.securityRules', '[data-back-to-context]', function(e) {
      e.preventDefault();

      if (panelContextStack.length === 0) return;

      const prev = panelContextStack.pop();

      switchPanelContext(prev.type, prev.id, prev.name);
    });
  }

  // -----------------------------------------
  // INITIALIZATION
  // -----------------------------------------

  // Hook into file manager rendering lifecycle
  // We observe DOM changes to detect when folder contents are rendered

  let isUpdatingBadges = false;
  let badgeGeneration = 0;

  function init(options) {
    options = options || {};

    if (options.appId) {
      appId = options.appId;
    }

    if (options.organizationId) {
      organizationId = options.organizationId;
    }

    if (options.appRoleId !== undefined) {
      currentAppRoleId = options.appRoleId;
    }

    if (options.orgRoleId !== undefined) {
      currentOrgRoleId = options.orgRoleId;
    }

    initEventHandlers();

    // Observe file table body for changes to inject security badges
    const observer = new MutationObserver(function(mutations) {
      if (isUpdatingBadges) return;

      const shouldUpdate = mutations.some(function(m) {
        return m.addedNodes.length > 0;
      });

      if (shouldUpdate) {
        // Clear cache on folder navigation (new content rendered)
        clearCache();
        updateSecurityBadges();
      }
    });

    const tableBody = document.querySelector('.file-table-body');

    if (tableBody) {
      observer.observe(tableBody, { childList: true });
    }

    // Initial badge update — only when app context exists
    if (getAppId()) {
      setTimeout(updateSecurityBadges, 500);
      updateFolderSecurityCard('root', 'App Files');
      $('.help-tips').addClass('hidden');
    }
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
    getSecurityBadgeHTML: getSecurityBadgeHTML,
    canEditRules: canEditRules,
    setRoles: function(appRoleId, orgRoleId) {
      currentAppRoleId = appRoleId;
      currentOrgRoleId = orgRoleId;
    }
  };

  // Auto-init when DOM is ready
  $(document).ready(function() {
    init();
  });
})();
