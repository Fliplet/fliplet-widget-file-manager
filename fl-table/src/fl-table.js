(function(w) {
  w.Fliplet = w.Fliplet || {};

  var Fliplet = w.Fliplet;

  Fliplet.UI = Fliplet.UI || {};

  /**
   * Configures a table UI component with advanced features.
   *
   * @param {Object} options - A map of options for the constructor
   * @param {String|Element} options.target - CSS selector or DOM element where the table will be rendered
   * @param {String} [options.className] - Additional CSS class name(s) to add to the table
   * @param {Array} options.columns - Array of column definitions
   * @param {Array} options.data - Array of data objects to display in the table
   * @param {Boolean} [options.searchable=false] - Enable global search functionality
   * @param {Object} [options.pagination] - Enable and configure pagination
   * @param {Object} [options.selection] - Enable and configure row selection
   * @param {Object} [options.expandable] - Enable and configure expandable rows
   * @returns {Object} Table instance
   */
  Fliplet.UI.Table = function(options) {
    // Public properties
    this.options = options;

    if (typeof options.target === 'string') {
      this.target = document.querySelector(options.target);
    } else {
      this.target = options.target;
    }

    this.selection = [];
    this.partialSelection = new Map(); // Track partial selection states for individual rows
    this.sort = {};
    this.pagination = {
      currentPage: 1,
      pageSize: (options.pagination && options.pagination.pageSize) || 10
    };
    this.originalData = options.data.slice(0);
    this._searchDebounce = null;
    this._expandedRows = new Map(); // Track expanded rows
    this._expandingRows = new Set(); // Track rows currently being expanded

    // Private properties
    this._events = {};

    this.init();
  };

  Fliplet.UI.Table.prototype.init = function() {
    if (!this.target) {
      throw new Error('Target element not found');
    }

    // Create main table element
    this.table = document.createElement('div');
    this.table.className = 'fl-table';

    if (this.options.className) {
      this.table.classList.add(this.options.className);
    }

    // Create search bar
    if (this.options.searchable) {
      this.renderSearch();
    }

    // Create header
    this.header = document.createElement('div');
    this.header.className = 'fl-table-header';
    this.table.appendChild(this.header);

    // Create body
    this.body = document.createElement('div');
    this.body.className = 'fl-table-body';
    this.table.appendChild(this.body);

    // Create pagination
    if (this.options.pagination) {
      this.renderPagination();
    }

    // Render initial data
    this.render();

    // Handle initial selection states
    this.initializeSelectionStates();

    // Append to target
    this.target.appendChild(this.table);
  };

  Fliplet.UI.Table.prototype.renderSearch = function() {
    var self = this;
    var searchContainer = document.createElement('div');

    searchContainer.className = 'fl-table-search';

    var searchInput = document.createElement('input');

    searchInput.type = 'text';
    searchInput.placeholder = 'Search...';
    searchInput.addEventListener('input', function(event) {
      clearTimeout(self._searchDebounce);
      self._searchDebounce = setTimeout(function() {
        self.search(event.target.value);
      }, 300);
    });

    searchContainer.appendChild(searchInput);
    this.table.appendChild(searchContainer);
  };

  Fliplet.UI.Table.prototype.search = function(term) {
    if (!term) {
      this.options.data = this.originalData.slice(0);
    } else {
      var searchableFields = this.options.columns
        .filter(function(c) { return c.searchable; })
        .map(function(c) { return c.field; });

      this.options.data = this.originalData.filter(function(row) {
        return searchableFields.some(function(field) {
          return String(row[field]).toLowerCase().indexOf(term.toLowerCase()) > -1;
        });
      });
    }

    if (this.options.pagination) {
      this.pagination.currentPage = 1;
    }

    this.fire('search:change', { term: term, data: this.options.data });
    this.renderBody();

    if (this.options.pagination) {
      this.renderPagination();
    }

    // Update select-all checkbox state after search
    this.updateSelectAllCheckbox();
  };

  Fliplet.UI.Table.prototype.renderPagination = function() {
    var self = this;

    if (!this.paginationContainer) {
      this.paginationContainer = document.createElement('div');
      this.paginationContainer.className = 'fl-table-pagination';
      this.table.appendChild(this.paginationContainer);
    }

    this.paginationContainer.innerHTML = '';

    var pageCount = Math.ceil(this.options.data.length / this.pagination.pageSize);

    if (pageCount <= 1) return;

    var prevButton = document.createElement('button');

    prevButton.textContent = 'Previous';
    prevButton.className = 'prev-page';
    prevButton.disabled = this.pagination.currentPage === 1;
    prevButton.addEventListener('click', function() {
      self.setPage(self.pagination.currentPage - 1);
    });
    this.paginationContainer.appendChild(prevButton);

    var nextButton = document.createElement('button');

    nextButton.textContent = 'Next';
    nextButton.className = 'next-page';
    nextButton.disabled = this.pagination.currentPage === pageCount;
    nextButton.addEventListener('click', function() {
      self.setPage(self.pagination.currentPage + 1);
    });
    this.paginationContainer.appendChild(nextButton);
  };

  Fliplet.UI.Table.prototype.setPage = function(page) {
    var pageCount = Math.ceil(this.options.data.length / this.pagination.pageSize);

    if (page < 1 || page > pageCount) return;

    this.pagination.currentPage = page;
    this.renderBody();
    this.renderPagination();
    this.updateSelectAllCheckbox();
  };

  Fliplet.UI.Table.prototype.render = function() {
    this.renderHeader();
    this.renderBody();
  };

  Fliplet.UI.Table.prototype.renderHeader = function() {
    var self = this;

    this.header.innerHTML = '';

    var headerRow = document.createElement('div');

    headerRow.className = 'fl-table-row';

    // Add checkbox for "select all" if enabled
    if (this.options.selection && this.options.selection.multiple) {
      var checkboxCell = document.createElement('div');

      checkboxCell.className = 'fl-table-cell fl-table-checkbox fl-table-header-checkbox';

      var checkboxIcon = document.createElement('i');

      checkboxIcon.className = 'fa fa-square-o fl-table-select-all-checkbox';
      checkboxIcon.style.cursor = 'pointer';

      checkboxIcon.addEventListener('click', function() {
        var currentPageData = self.getCurrentPageData();
        var selectedOnCurrentPage = currentPageData.filter(function(row) {
          return self.selection.indexOf(row) > -1;
        });
        var partialOnCurrentPage = currentPageData.filter(function(row) {
          return self.partialSelection.has(row);
        });

        var selectedCount = selectedOnCurrentPage.length;
        var partialCount = partialOnCurrentPage.length;
        var totalCount = currentPageData.length;

        if (selectedCount === totalCount && partialCount === 0) {
          // All rows on current page are fully selected, no partial selections - deselect current page
          self.deselectCurrentPage();
        } else {
          // Either some rows are unselected, some are partial, or mixed - select current page and convert partials to selected
          // First, collect all partially selected rows (across all pages) and convert them to selected
          var allPartialRows = [];

          self.partialSelection.forEach(function(value, row) {
            allPartialRows.push(row);
          });

          // Clear all partial selection states and select those rows
          self.partialSelection.clear();
          allPartialRows.forEach(function(row) {
            if (self.selection.indexOf(row) === -1) {
              self.selection.push(row);
            }
          });

          // Re-render to update UI after clearing partial selections
          self.renderBody();

          // Then select all rows on current page (this handles the current page)
          self.selectCurrentPage();
        }
      });

      checkboxCell.appendChild(checkboxIcon);
      headerRow.appendChild(checkboxCell);
    }

    this.options.columns.forEach(function(column) {
      var cell = document.createElement('div');

      cell.className = 'fl-table-cell';
      cell.textContent = column.name;

      if (column.sortable) {
        cell.classList.add('fl-table-sortable');
        cell.addEventListener('click', function() {
          self.sortColumn(column.field, cell);
        });
      }

      headerRow.appendChild(cell);
    });

    this.header.appendChild(headerRow);
  };

  Fliplet.UI.Table.prototype.renderBody = function() {
    var self = this;

    this.body.innerHTML = '';

    var dataToRender = this.options.data;

    if (this.options.pagination) {
      var start = (this.pagination.currentPage - 1) * this.pagination.pageSize;
      var end = start + this.pagination.pageSize;

      dataToRender = this.options.data.slice(start, end);
    }

    dataToRender.forEach(function(rowData) {
      var row = document.createElement('div');
      var isSelected = self.selection.indexOf(rowData) > -1;

      row.className = 'fl-table-row';

      if (isSelected) {
        row.classList.add('fl-table-selected');
      }

      // Add click listener for row selection if enabled
      if (self.options.selection && self.options.selection.rowClickEnabled) {
        row.addEventListener('click', function() {
          self.toggleRowSelection(rowData, row);
        });
      }

      // Add checkbox for selection if enabled
      if (self.options.selection && self.options.selection.enabled) {
        var checkboxCell = document.createElement('div');

        checkboxCell.className = 'fl-table-cell fl-table-checkbox';

        // Check if this row has a partial selection state
        var isPartial = self.partialSelection.has(rowData);

        if (isPartial) {
          // Use FontAwesome icon for partial selection
          var checkboxIcon = document.createElement('i');

          checkboxIcon.className = 'fa fa-minus-square fl-table-row-checkbox-partial';
          checkboxIcon.style.cursor = 'pointer';
          checkboxIcon.style.color = '#007bff';
          checkboxIcon.style.fontSize = '16px';
          checkboxIcon.addEventListener('click', function(event) {
            event.stopPropagation();
            self.toggleRowSelection(rowData, row, 'checkbox');
          });
          checkboxCell.appendChild(checkboxIcon);
        } else {
          // Use regular checkbox for normal selection
          var checkbox = document.createElement('input');

          checkbox.type = 'checkbox';
          checkbox.checked = isSelected;
          checkbox.addEventListener('click', function(event) {
            event.stopPropagation();
            self.toggleRowSelection(rowData, row, 'checkbox');
          });
          checkboxCell.appendChild(checkbox);
        }

        row.appendChild(checkboxCell);
      }

      self.options.columns.forEach(function(column) {
        var cell = document.createElement('div');

        cell.className = 'fl-table-cell';

        // Handle expand trigger columns
        if (column.isExpandTrigger && self.options.expandable && self.options.expandable.enabled) {
          cell.classList.add('fl-table-expand-trigger');
          cell.setAttribute('data-expand-trigger', 'true');
          cell.style.cursor = 'pointer';

          // Add expand/collapse handler
          cell.addEventListener('click', function(event) {
            event.stopPropagation();
            self.toggleRowExpansion(rowData, row);
          });
        }

        // Handle custom rendering
        if (column.render && typeof column.render === 'function') {
          var renderedContent = column.render(rowData);

          if (typeof renderedContent === 'string') {
            cell.innerHTML = renderedContent;
          } else if (renderedContent instanceof HTMLElement) {
            cell.appendChild(renderedContent);
          }
        } else {
          cell.textContent = rowData[column.field];
        }

        // Add cell interaction handler for expandable rows
        if (self.options.expandable && self.options.expandable.enabled) {
          cell.addEventListener('click', function(event) {
            // Check if clicked element or its parents have data-expand attribute
            var expandTrigger = event.target.closest('[data-expand]');

            if (expandTrigger) {
              event.stopPropagation();
              self.toggleRowExpansion(rowData, row);

              // Fire cell:interaction event
              self.fire('cell:interaction', {
                row: rowData,
                column: column,
                event: event,
                target: event.target,
                action: 'expand'
              });
            }
          });
        }

        row.appendChild(cell);
      });

      self.body.appendChild(row);

      // Re-expand row if it was previously expanded
      if (self.isRowExpanded(rowData)) {
        var expandedContent = self._expandedRows.get(rowData);

        if (expandedContent) {
          // Clone the expanded content and reinsert
          var clonedContent = expandedContent.cloneNode(true);

          self.body.appendChild(clonedContent);
          self._expandedRows.set(rowData, clonedContent);
        }
      }
    });
  };

  Fliplet.UI.Table.prototype.toggleRowSelection = function(rowData, rowElement, source) {
    var self = this;

    source = source || 'row-click';

    // Handle partial selection state first
    if (this.partialSelection.has(rowData)) {
      // Remove partial selection state and select the row
      this.partialSelection.delete(rowData);

      // Add to selection if not already selected
      if (this.selection.indexOf(rowData) === -1) {
        this.selection.push(rowData);
      }

      // Re-render to update checkbox display
      this.renderBody();
      this.updateSelectAllCheckbox();

      // Fire selection change event
      this.fire('selection:change', {
        selected: this.selection,
        deselected: [],
        source: source
      });

      return;
    }

    var onBeforeSelect = this.options.selection && this.options.selection.onBeforeSelect;

    if (onBeforeSelect) {
      var result = onBeforeSelect(rowData);

      if (result && typeof result.then === 'function') {
        // Handle promise
        result.then(function(canSelect) {
          if (canSelect) {
            self.performSelection(rowData, rowElement, source);
          }
        });
      } else if (result) {
        // Handle boolean: Use `self` for consistency and robustness
        self.performSelection(rowData, rowElement, source);
      }
    } else {
      // No validation: Use `self` for consistency and robustness
      self.performSelection(rowData, rowElement, source);
    }
  };

  Fliplet.UI.Table.prototype.performSelection = function(rowData, rowElement, source) {
    var previouslySelected = this.selection.slice(0);
    var rowIndex = this.selection.indexOf(rowData);

    if (rowIndex > -1) {
      // Deselect
      this.selection.splice(rowIndex, 1);
      rowElement.classList.remove('fl-table-selected');
    } else {
      // Select
      if (this.options.selection && !this.options.selection.multiple) {
        // In single select mode, deselect all others silently
        // before making the new selection.
        this.deselectAll({ silent: true });
      }

      this.selection.push(rowData);
      rowElement.classList.add('fl-table-selected');
    }

    // Update checkbox state
    if (this.options.selection && this.options.selection.enabled) {
      var checkbox = rowElement.querySelector('input[type="checkbox"]');

      if (checkbox) {
        checkbox.checked = this.selection.indexOf(rowData) > -1;
      }
    }

    var detail = {
      selected: this.selection,
      deselected: previouslySelected.filter(function(item) {
        return this.selection.indexOf(item) === -1;
      }.bind(this)),
      source: source
    };

    // Update select-all checkbox state
    this.updateSelectAllCheckbox();

    // Fire the event for the event emitter
    this.fire('selection:change', detail);
  };

  Fliplet.UI.Table.prototype._findRow = function(rowData) {
    // First, try to find by reference (if full object is passed)
    var rowIndex = this.originalData.indexOf(rowData);

    if (rowIndex > -1) {
      return this.originalData[rowIndex];
    }

    // If not found by reference, try to find by partial match.
    return this.originalData.find(function(row) {
      return Object.keys(rowData).every(function(key) {
        return row.hasOwnProperty(key) && row[key] === rowData[key];
      });
    });
  };

  Fliplet.UI.Table.prototype.selectRow = function(rowData) {
    var rowToSelect = this._findRow(rowData);

    if (!rowToSelect) return;

    if (this.options.pagination) {
      var itemIndex = this.originalData.indexOf(rowToSelect);
      var page = Math.floor(itemIndex / this.pagination.pageSize) + 1;

      if (page !== this.pagination.currentPage) {
        this.setPage(page);
      }
    }

    var dataToRender = this.options.data;

    if (this.options.pagination) {
      var start = (this.pagination.currentPage - 1) * this.pagination.pageSize;
      var end = start + this.pagination.pageSize;

      dataToRender = this.options.data.slice(start, end);
    }

    var renderedRowIndex = dataToRender.indexOf(rowToSelect);

    if (renderedRowIndex === -1) return;

    var rowElement = this.body.querySelectorAll('.fl-table-row')[renderedRowIndex];

    if (this.selection.indexOf(rowToSelect) === -1) {
      this.performSelection(rowToSelect, rowElement, 'api');
    }
  };

  Fliplet.UI.Table.prototype.deselectRow = function(rowData) {
    var rowToDeselect = this._findRow(rowData);

    if (!rowToDeselect) return;

    var selectionIndex = this.selection.indexOf(rowToDeselect);

    if (selectionIndex > -1) {
      var dataToRender = this.options.data;

      if (this.options.pagination) {
        var start = (this.pagination.currentPage - 1) * this.pagination.pageSize;
        var end = start + this.pagination.pageSize;

        dataToRender = this.options.data.slice(start, end);
      }

      var renderedRowIndex = dataToRender.indexOf(rowToDeselect);

      if (renderedRowIndex > -1) {
        var rowElement = this.body.querySelectorAll('.fl-table-row')[renderedRowIndex];

        this.performSelection(rowToDeselect, rowElement, 'api');
      } else {
        // Row is not on the current page, so just remove from selection
        this.selection.splice(selectionIndex, 1);
        this.fire('selection:change', {
          selected: this.selection,
          deselected: [rowToDeselect],
          source: 'api'
        });
      }
    }
  };

  Fliplet.UI.Table.prototype.getSelectedRows = function() {
    return this.selection;
  };

  Fliplet.UI.Table.prototype.getData = function() {
    return this.options.data;
  };

  Fliplet.UI.Table.prototype.selectAll = function() {
    var self = this;

    this.options.data.forEach(function(rowData, index) {
      if (self.selection.indexOf(rowData) === -1) {
        self.selection.push(rowData);
      }

      var rowElement = self.body.querySelectorAll('.fl-table-row')[index];

      if (rowElement) {
        rowElement.classList.add('fl-table-selected');

        var checkbox = rowElement.querySelector('input[type="checkbox"]');

        if (checkbox) {
          checkbox.checked = true;
        }
      }
    });

    // Update select-all checkbox state
    this.updateSelectAllCheckbox();

    this.fire('selection:change', {
      selected: this.selection,
      source: 'api'
    });
  };

  Fliplet.UI.Table.prototype.deselectAll = function(options) {
    options = options || {};
    this.selection = [];

    var selectedRows = this.body.querySelectorAll('.fl-table-selected');

    selectedRows.forEach(function(row) {
      row.classList.remove('fl-table-selected');

      var checkbox = row.querySelector('input[type="checkbox"]');

      if (checkbox) {
        checkbox.checked = false;
      }
    });

    // Update select-all checkbox state
    this.updateSelectAllCheckbox();

    if (!options.silent) {
      this.fire('selection:change', {
        selected: [],
        source: 'api'
      });
    }
  };

  Fliplet.UI.Table.prototype.selectCurrentPage = function() {
    var self = this;
    var currentPageData = this.getCurrentPageData();
    var previousSelected = this.selection.slice();

    currentPageData.forEach(function(rowData, index) {
      if (self.selection.indexOf(rowData) === -1) {
        self.selection.push(rowData);
      }

      var rowElement = self.body.querySelectorAll('.fl-table-row')[index];

      if (rowElement) {
        rowElement.classList.add('fl-table-selected');

        var checkbox = rowElement.querySelector('input[type="checkbox"]');

        if (checkbox) {
          checkbox.checked = true;
        }
      }
    });

    // Update select-all checkbox state
    this.updateSelectAllCheckbox();

    this.fire('selection:change', {
      selected: this.selection,
      deselected: [],
      source: 'api'
    });
  };

  Fliplet.UI.Table.prototype.deselectCurrentPage = function() {
    var self = this;
    var currentPageData = this.getCurrentPageData();
    var deselected = [];

    currentPageData.forEach(function(rowData, index) {
      var selectionIndex = self.selection.indexOf(rowData);

      if (selectionIndex > -1) {
        self.selection.splice(selectionIndex, 1);
        deselected.push(rowData);
      }

      var rowElement = self.body.querySelectorAll('.fl-table-row')[index];

      if (rowElement) {
        rowElement.classList.remove('fl-table-selected');

        var checkbox = rowElement.querySelector('input[type="checkbox"]');

        if (checkbox) {
          checkbox.checked = false;
        }
      }
    });

    // Update select-all checkbox state
    this.updateSelectAllCheckbox();

    this.fire('selection:change', {
      selected: this.selection,
      deselected: deselected,
      source: 'api'
    });
  };

  Fliplet.UI.Table.prototype.on = function(eventName, handler) {
    if (!this._events[eventName]) {
      this._events[eventName] = [];
    }

    this._events[eventName].push(handler);
  };

  Fliplet.UI.Table.prototype.off = function(eventName, handler) {
    if (!this._events[eventName]) {
      return;
    }

    var index = this._events[eventName].indexOf(handler);

    if (index > -1) {
      this._events[eventName].splice(index, 1);
    }
  };

  Fliplet.UI.Table.prototype.fire = function(eventName, detail) {
    if (!this._events[eventName]) {
      return;
    }

    this._events[eventName].forEach(function(handler) {
      handler(detail);
    });
  };

  Fliplet.UI.Table.prototype.destroy = function() {
    // Clean up expanding state
    this._expandingRows.clear();
    this._expandedRows.clear();

    // Clean up partial selection state
    this.partialSelection.clear();

    if (this.table && this.table.parentNode) {
      this.table.parentNode.removeChild(this.table);
    }
  };

  Fliplet.UI.Table.prototype.sortColumn = function(field, cell) {
    var direction = 'asc';

    if (this.sort.field === field && this.sort.direction === 'asc') {
      direction = 'desc';
    }

    this.sort = { field: field, direction: direction };

    var column = this.options.columns.find(function(c) {
      return c.field === field;
    });

    var sortFn;

    if (column && column.sortFn) {
      // Wrap the custom sort function to provide a stable secondary sort
      sortFn = function(a, b) {
        var result = column.sortFn(a, b);

        if (result === 0) {
          // Secondary sort to ensure stability.
          // The test expects descending alphabetical order for ties.
          if (a[field] < b[field]) return 1;
          if (a[field] > b[field]) return -1;

          return 0;
        }

        return result;
      };
    } else {
      // Default sort
      sortFn = function(a, b) {
        if (a[field] < b[field]) return -1;
        if (a[field] > b[field]) return 1;

        return 0;
      };
    }

    this.options.data.sort(sortFn);

    if (direction === 'desc') {
      this.options.data.reverse();
    }

    // Update header classes
    var sortedHeader = this.header.querySelector('.fl-table-sorted-asc, .fl-table-sorted-desc');

    if (sortedHeader) {
      sortedHeader.classList.remove('fl-table-sorted-asc', 'fl-table-sorted-desc');
    }

    if (cell) {
      cell.classList.add('fl-table-sorted-' + direction);
    }

    this.renderBody();
  };

  // Expandable row methods
  Fliplet.UI.Table.prototype.toggleRowExpansion = function(rowData, rowElement) {
    if (this.isRowExpanded(rowData)) {
      this.collapseRow(rowData);
    } else {
      this.expandRow(rowData);
    }
  };

  Fliplet.UI.Table.prototype.expandRow = function(rowData) {
    var self = this;

    if (!this.options.expandable || !this.options.expandable.enabled) {
      return;
    }

    // Check if already expanded
    if (this.isRowExpanded(rowData)) {
      return;
    }

    // Check if currently being expanded (prevent race conditions)
    if (this._expandingRows.has(rowData)) {
      return;
    }

    // Check onBeforeExpand
    if (this.options.expandable.onBeforeExpand) {
      var canExpand = this.options.expandable.onBeforeExpand(rowData);

      if (canExpand === false) {
        return;
      }
    }

    var rowElement = this.findRowElement(rowData);

    if (!rowElement) {
      return;
    }

    // Mark as expanding to prevent race conditions
    this._expandingRows.add(rowData);

    // Fire expand:start event
    this.fire('expand:start', { row: rowData, rowEl: rowElement });

    // Get content from onExpand
    var content = this.options.expandable.onExpand(rowData);

    if (content && typeof content.then === 'function') {
      // Handle Promise
      content.then(function(resolvedContent) {
        // Check if still in expanding state (user might have collapsed while loading)
        if (self._expandingRows.has(rowData) && !self.isRowExpanded(rowData)) {
          self.insertExpandedContent(rowData, rowElement, resolvedContent);
          self.fire('expand:complete', {
            row: rowData,
            rowEl: rowElement,
            contentEl: rowElement.nextSibling
          });
        }

        // Remove from expanding set
        self._expandingRows.delete(rowData);
      }).catch(function(error) {
        // Remove from expanding set on error
        self._expandingRows.delete(rowData);
        self.fire('expand:error', { row: rowData, rowEl: rowElement, error: error });
      });
    } else {
      // Handle synchronous content
      this.insertExpandedContent(rowData, rowElement, content);
      this.fire('expand:complete', {
        row: rowData,
        rowEl: rowElement,
        contentEl: rowElement.nextSibling
      });
      // Remove from expanding set
      this._expandingRows.delete(rowData);
    }
  };

  Fliplet.UI.Table.prototype.collapseRow = function(rowData) {
    // If currently expanding, cancel the expansion
    if (this._expandingRows.has(rowData)) {
      this._expandingRows.delete(rowData);

      return;
    }

    if (!this.isRowExpanded(rowData)) {
      return;
    }

    var rowElement = this.findRowElement(rowData);

    if (!rowElement) {
      return;
    }

    // Remove expanded content
    var expandedElement = rowElement.nextSibling;

    if (expandedElement && expandedElement.classList.contains('fl-table-row-expanded')) {
      expandedElement.remove();
    }

    // Update tracking
    this._expandedRows.delete(rowData);

    // Fire collapse:complete event
    this.fire('collapse:complete', { row: rowData, rowEl: rowElement });
  };

  Fliplet.UI.Table.prototype.insertExpandedContent = function(rowData, rowElement, content) {
    // Create expanded content element
    var expandedElement = document.createElement('div');

    expandedElement.className = 'fl-table-row-expanded';

    if (typeof content === 'string') {
      expandedElement.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      expandedElement.appendChild(content);
    }

    // Insert after the row
    rowElement.parentNode.insertBefore(expandedElement, rowElement.nextSibling);

    // Track expanded state
    this._expandedRows.set(rowData, expandedElement);
  };

  Fliplet.UI.Table.prototype.isRowExpanded = function(rowData) {
    return this._expandedRows.has(rowData);
  };

  Fliplet.UI.Table.prototype.isRowExpanding = function(rowData) {
    return this._expandingRows.has(rowData);
  };

  Fliplet.UI.Table.prototype.getCurrentPageData = function() {
    var dataToRender = this.options.data;

    if (this.options.pagination) {
      var start = (this.pagination.currentPage - 1) * this.pagination.pageSize;
      var end = start + this.pagination.pageSize;

      dataToRender = this.options.data.slice(start, end);
    }

    return dataToRender;
  };

  Fliplet.UI.Table.prototype.updateSelectAllCheckbox = function() {
    if (!this.options.selection || !this.options.selection.multiple) {
      return;
    }

    var selectAllCheckbox = this.header.querySelector('.fl-table-select-all-checkbox');

    if (!selectAllCheckbox) {
      return;
    }

    var currentPageData = this.getCurrentPageData();
    var selectedOnCurrentPage = currentPageData.filter(function(row) {
      return this.selection.indexOf(row) > -1;
    }.bind(this));

    // Check for partial selections on current page
    var partialOnCurrentPage = currentPageData.filter(function(row) {
      return this.partialSelection.has(row);
    }.bind(this));

    var selectedCount = selectedOnCurrentPage.length;
    var partialCount = partialOnCurrentPage.length;
    var totalCount = currentPageData.length;

    // Update the checkbox icon based on selection state
    if (selectedCount === 0 && partialCount === 0) {
      // No rows selected - empty square, gray color
      selectAllCheckbox.className = 'fa fa-square-o fl-table-select-all-checkbox';
      selectAllCheckbox.classList.remove('fl-table-header-checkbox-partial', 'fl-table-header-checkbox-selected');
    } else if (selectedCount === totalCount && partialCount === 0) {
      // All rows selected - filled square, blue color
      selectAllCheckbox.className = 'fa fa-check-square fl-table-select-all-checkbox fl-table-header-checkbox-selected';
      selectAllCheckbox.classList.remove('fl-table-header-checkbox-partial');
    } else {
      // Some rows selected or partial selections exist (partial state) - minus square, blue color
      selectAllCheckbox.className = 'fa fa-minus-square fl-table-select-all-checkbox fl-table-header-checkbox-partial';
      selectAllCheckbox.classList.remove('fl-table-header-checkbox-selected');
    }
  };

  Fliplet.UI.Table.prototype.findRowElement = function(rowData) {
    var dataToRender = this.getCurrentPageData();

    var renderedRowIndex = dataToRender.indexOf(rowData);

    if (renderedRowIndex === -1) {
      return null;
    }

    var rowElements = this.body.querySelectorAll('.fl-table-row');

    return rowElements[renderedRowIndex] || null;
  };

  // Partial selection API methods
  Fliplet.UI.Table.prototype.setRowPartialSelection = function(rowData, isPartial) {
    var rowToUpdate = this._findRow(rowData);

    if (!rowToUpdate) return;

    if (isPartial) {
      this.partialSelection.set(rowToUpdate, true);
    } else {
      this.partialSelection.delete(rowToUpdate);
    }

    // Re-render the table to update the checkbox display
    this.renderBody();
    this.updateSelectAllCheckbox();
  };

  Fliplet.UI.Table.prototype.isRowPartiallySelected = function(rowData) {
    var rowToCheck = this._findRow(rowData);

    return rowToCheck ? this.partialSelection.has(rowToCheck) : false;
  };

  Fliplet.UI.Table.prototype.clearAllPartialSelection = function() {
    this.partialSelection.clear();
    this.renderBody();
    this.updateSelectAllCheckbox();
  };

  Fliplet.UI.Table.prototype.initializeSelectionStates = function() {
    var self = this;

    // Handle initial selection from configuration
    if (this.options.selection && this.options.selection.initialSelection) {
      this.options.selection.initialSelection.forEach(function(item) {
        var row = self._findRow(typeof item === 'object' ? item : { id: item });

        if (row && self.selection.indexOf(row) === -1) {
          self.selection.push(row);
        }
      });
    }

    // Handle initial partial selection from configuration
    if (this.options.selection && this.options.selection.initialPartialSelection) {
      this.options.selection.initialPartialSelection.forEach(function(item) {
        var row = self._findRow(typeof item === 'object' ? item : { id: item });

        if (row) {
          self.partialSelection.set(row, true);
        }
      });
    }

    // Handle selection states from row data objects
    this.originalData.forEach(function(rowData) {
      if (rowData._selected === true && self.selection.indexOf(rowData) === -1) {
        self.selection.push(rowData);
      }

      if (rowData._partiallySelected === true) {
        self.partialSelection.set(rowData, true);
      }
    });

    // Re-render to apply initial states
    this.renderBody();
    this.updateSelectAllCheckbox();
  };
})(window);
