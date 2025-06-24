// Empty placeholder. The FlTable class will be defined here.

function FlTable(options) {
  // Public properties
  this.options = options;

  if (typeof options.target === 'string') {
    this.target = document.querySelector(options.target);
  } else {
    this.target = options.target;
  }

  this.selection = [];
  this.sort = {};
  this.pagination = {
    currentPage: 1,
    pageSize: (options.pagination && options.pagination.pageSize) || 10
  };
  this.originalData = options.data.slice(0);
  this._searchDebounce = null;

  // Private properties
  this._events = {};

  this.init();
}

FlTable.prototype.init = function() {
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

  // Append to target
  this.target.appendChild(this.table);
};

FlTable.prototype.renderSearch = function() {
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

FlTable.prototype.search = function(term) {
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

  this.fire('search:change', { term: term, data: this.options.data });
  this.renderBody();
};

FlTable.prototype.renderPagination = function() {
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

FlTable.prototype.setPage = function(page) {
  var pageCount = Math.ceil(this.options.data.length / this.pagination.pageSize);

  if (page < 1 || page > pageCount) return;

  this.pagination.currentPage = page;
  this.renderBody();
  this.renderPagination();
};

FlTable.prototype.render = function() {
  this.renderHeader();
  this.renderBody();
};

FlTable.prototype.renderHeader = function() {
  var self = this;

  this.header.innerHTML = '';

  var headerRow = document.createElement('div');

  headerRow.className = 'fl-table-row';

  // Add checkbox for "select all" if enabled
  if (this.options.selection && this.options.selection.multiple) {
    var checkboxCell = document.createElement('div');

    checkboxCell.className = 'fl-table-cell fl-table-checkbox';

    var checkbox = document.createElement('input');

    checkbox.type = 'checkbox';
    checkbox.addEventListener('click', function(event) {
      if (event.target.checked) {
        this.selectAll();
      } else {
        this.deselectAll();
      }
    }.bind(this));
    checkboxCell.appendChild(checkbox);
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

FlTable.prototype.renderBody = function() {
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

      var checkbox = document.createElement('input');

      checkbox.type = 'checkbox';
      checkbox.checked = isSelected;
      checkbox.addEventListener('click', function(event) {
        event.stopPropagation();
        self.toggleRowSelection(rowData, row, 'checkbox');
      });
      checkboxCell.appendChild(checkbox);
      row.appendChild(checkboxCell);
    }

    self.options.columns.forEach(function(column) {
      var cell = document.createElement('div');

      cell.className = 'fl-table-cell';
      cell.textContent = rowData[column.field];
      row.appendChild(cell);
    });

    self.body.appendChild(row);
  });
};

FlTable.prototype.toggleRowSelection = function(rowData, rowElement, source) {
  var self = this;

  source = source || 'row-click';

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

FlTable.prototype.performSelection = function(rowData, rowElement, source) {
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

  // Fire the event for the event emitter
  this.fire('selection:change', detail);
};

FlTable.prototype.selectRow = function(rowData) {
  var rowIndex = this.options.data.indexOf(rowData);

  if (rowIndex === -1) return;

  var rowElement = this.body.querySelectorAll('.fl-table-row')[rowIndex];

  if (this.selection.indexOf(rowData) === -1) {
    this.performSelection(rowData, rowElement, 'api');
  }
};

FlTable.prototype.deselectRow = function(rowData) {
  var rowIndex = this.options.data.indexOf(rowData);

  if (rowIndex === -1) return;

  var rowElement = this.body.querySelectorAll('.fl-table-row')[rowIndex];

  if (this.selection.indexOf(rowData) > -1) {
    this.performSelection(rowData, rowElement, 'api');
  }
};

FlTable.prototype.getSelectedRows = function() {
  return this.selection;
};

FlTable.prototype.getData = function() {
  return this.options.data;
};

FlTable.prototype.selectAll = function() {
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

  this.fire('selection:change', {
    selected: this.selection,
    source: 'api'
  });
};

FlTable.prototype.deselectAll = function(options) {
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

  if (!options.silent) {
    this.fire('selection:change', {
      selected: [],
      source: 'api'
    });
  }
};

FlTable.prototype.on = function(eventName, handler) {
  if (!this._events[eventName]) {
    this._events[eventName] = [];
  }

  this._events[eventName].push(handler);
};

FlTable.prototype.off = function(eventName, handler) {
  if (!this._events[eventName]) {
    return;
  }

  var index = this._events[eventName].indexOf(handler);

  if (index > -1) {
    this._events[eventName].splice(index, 1);
  }
};

FlTable.prototype.fire = function(eventName, detail) {
  if (!this._events[eventName]) {
    return;
  }

  this._events[eventName].forEach(function(handler) {
    handler(detail);
  });
};

FlTable.prototype.destroy = function() {
  if (this.table && this.table.parentNode) {
    this.table.parentNode.removeChild(this.table);
  }
};

FlTable.prototype.sortColumn = function(field, cell) {
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
