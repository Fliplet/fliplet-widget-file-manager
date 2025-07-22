describe('FlTable', function() {
  var expect = chai.expect;
  var table;
  var container;
  var sinon = window.sinon;

  beforeEach(function() {
    // Create a container for the test table if it doesn't exist
    var testContainer = document.getElementById('test-container');

    if (!testContainer) {
      testContainer = document.createElement('div');
      testContainer.id = 'test-container';
      document.body.appendChild(testContainer);
    }

    container = testContainer;
    container.innerHTML = '';
  });

  afterEach(function() {
    if (table) {
      table.destroy();
      table = null;
    }

    if (container) {
      container.innerHTML = '';
    }
  });

  it('should initialize with basic configuration', function() {
    table = new FlTable({
      target: '#test-container',
      columns: [
        { name: 'Name', field: 'name' }
      ],
      data: [
        { name: 'Test' }
      ]
    });

    expect(container.querySelector('.fl-table')).to.exist;
    expect(container.querySelector('.fl-table-body .fl-table-row')).to.exist;
  });

  it('should apply custom className to the table', function() {
    table = new FlTable({
      target: '#test-container',
      columns: [{ name: 'Name', field: 'name' }],
      data: [{ name: 'Test' }],
      className: 'my-custom-table'
    });
    expect(container.querySelector('.fl-table.my-custom-table')).to.exist;
  });

  describe('Selection', function() {
    it('should handle selection via checkbox', function() {
      table = new FlTable({
        target: '#test-container',
        selection: {
          enabled: true,
          multiple: true
        },
        columns: [
          { name: 'Name', field: 'name' }
        ],
        data: [
          { name: 'Item 1' },
          { name: 'Item 2' }
        ]
      });

      var firstRow = container.querySelector('.fl-table-body .fl-table-row');
      var checkbox = firstRow.querySelector('input[type="checkbox"]');

      checkbox.click();

      expect(table.getSelectedRows()).to.have.lengthOf(1);
      expect(firstRow.classList.contains('fl-table-selected')).to.be.true;
    });

    it('should handle selection via row click', function() {
      table = new FlTable({
        target: '#test-container',
        selection: {
          enabled: true,
          rowClickEnabled: true
        },
        columns: [
          { name: 'Name', field: 'name' }
        ],
        data: [
          { name: 'Item 1' },
          { name: 'Item 2' }
        ]
      });

      var firstRow = container.querySelector('.fl-table-body .fl-table-row');

      firstRow.click();

      expect(table.getSelectedRows()).to.have.lengthOf(1);
      expect(firstRow.classList.contains('fl-table-selected')).to.be.true;
    });

    it('should fire selection:change event', function(done) {
      var data = [{ name: 'Item 1' }, { name: 'Item 2' }];

      table = new FlTable({
        target: '#test-container',
        selection: {
          enabled: true,
          rowClickEnabled: true
        },
        columns: [
          { name: 'Name', field: 'name' }
        ],
        data: data
      });

      table.on('selection:change', function(detail) {
        try {
          expect(detail.selected).to.have.lengthOf(1);
          expect(detail.selected[0]).to.equal(data[0]);
          expect(detail.source).to.equal('row-click');
          done();
        } catch (err) {
          done(err);
        }
      });

      var firstRow = container.querySelector('.fl-table-body .fl-table-row');

      setTimeout(function() {
        firstRow.click();
      }, 0);
    });

    it('should prevent selection if onBeforeSelect returns false', function() {
      table = new FlTable({
        target: '#test-container',
        selection: {
          enabled: true,
          rowClickEnabled: true,
          onBeforeSelect: function(row) {
            return row.name !== 'Item 1';
          }
        },
        columns: [ { name: 'Name', field: 'name' } ],
        data: [ { name: 'Item 1' }, { name: 'Item 2' } ]
      });

      var firstRow = container.querySelector('.fl-table-body .fl-table-row');

      firstRow.click();

      expect(table.getSelectedRows()).to.have.lengthOf(0);
    });

    it('should allow selection if onBeforeSelect returns true', function() {
      table = new FlTable({
        target: '#test-container',
        selection: {
          enabled: true,
          rowClickEnabled: true,
          onBeforeSelect: function() {
            return true;
          }
        },
        columns: [ { name: 'Name', field: 'name' } ],
        data: [ { name: 'Item 1' }, { name: 'Item 2' } ]
      });

      var firstRow = container.querySelector('.fl-table-body .fl-table-row');

      firstRow.click();

      expect(table.getSelectedRows()).to.have.lengthOf(1);
    });

    it('should handle multiple selections', function() {
      table = new FlTable({
        target: '#test-container',
        selection: {
          enabled: true,
          multiple: true,
          rowClickEnabled: true
        },
        columns: [ { name: 'Name', field: 'name' } ],
        data: [ { name: 'Item 1' }, { name: 'Item 2' } ]
      });

      var rows = container.querySelectorAll('.fl-table-body .fl-table-row');

      rows[0].click();
      rows[1].click();

      expect(table.getSelectedRows()).to.have.lengthOf(2);
    });

    it('should select all rows when header checkbox is clicked', function() {
      table = new FlTable({
        target: '#test-container',
        selection: {
          enabled: true,
          multiple: true
        },
        columns: [ { name: 'Name', field: 'name' } ],
        data: [ { name: 'Item 1' }, { name: 'Item 2' } ]
      });

      var headerCheckbox = container.querySelector('.fl-table-select-all-checkbox');

      headerCheckbox.click();

      expect(table.getSelectedRows()).to.have.lengthOf(2);
    });

    it('should select a row via the API', function() {
      var data = [{ name: 'Item 1' }, { name: 'Item 2' }];

      table = new FlTable({
        target: '#test-container',
        selection: { enabled: true },
        columns: [ { name: 'Name', field: 'name' } ],
        data: data
      });

      table.selectRow(data[0]);
      expect(table.getSelectedRows()).to.have.lengthOf(1);
      expect(table.getSelectedRows()[0]).to.equal(data[0]);
    });

    it('should deselect a row via the API', function() {
      var data = [{ name: 'Item 1' }, { name: 'Item 2' }];

      table = new FlTable({
        target: '#test-container',
        selection: { enabled: true, multiple: true },
        columns: [ { name: 'Name', field: 'name' } ],
        data: data
      });

      table.selectRow(data[0]);
      table.selectRow(data[1]);
      table.deselectRow(data[0]);

      expect(table.getSelectedRows()).to.have.lengthOf(1);
      expect(table.getSelectedRows()[0]).to.equal(data[1]);
    });

    it('should select all rows via the API', function() {
      var data = [{ name: 'Item 1' }, { name: 'Item 2' }];

      table = new FlTable({
        target: '#test-container',
        selection: { enabled: true, multiple: true },
        columns: [ { name: 'Name', field: 'name' } ],
        data: data
      });

      table.selectAll();
      expect(table.getSelectedRows()).to.have.lengthOf(2);
    });

    it('should deselect all rows via the API', function() {
      var data = [{ name: 'Item 1' }, { name: 'Item 2' }];

      table = new FlTable({
        target: '#test-container',
        selection: { enabled: true, multiple: true },
        columns: [ { name: 'Name', field: 'name' } ],
        data: data
      });

      table.selectAll();
      table.deselectAll();
      expect(table.getSelectedRows()).to.have.lengthOf(0);
    });

    describe('with partial matching', function() {
      it('should select a row with a partial object', function() {
        var data = [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }];

        table = new FlTable({
          target: '#test-container',
          selection: { enabled: true },
          columns: [ { name: 'Name', field: 'name' } ],
          data: data
        });

        table.selectRow({ id: 1 });
        expect(table.getSelectedRows()).to.have.lengthOf(1);
        expect(table.getSelectedRows()[0]).to.deep.equal({ id: 1, name: 'Item 1' });
      });

      it('should select the first matching row if multiple match', function() {
        var data = [
          { id: 1, name: 'Apple', type: 'Fruit' },
          { id: 2, name: 'Banana', type: 'Fruit' },
          { id: 3, name: 'Carrot', type: 'Vegetable' }
        ];

        table = new FlTable({
          target: '#test-container',
          selection: { enabled: true, multiple: true },
          columns: [{ name: 'Name', field: 'name' }],
          data: data
        });

        table.selectRow({ type: 'Fruit' });
        expect(table.getSelectedRows()).to.have.lengthOf(1);
        expect(table.getSelectedRows()[0]).to.deep.equal({ id: 1, name: 'Apple', type: 'Fruit' });
      });

      it('should deselect a row with a partial object', function() {
        var data = [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' },
          { id: 3, name: 'Item 3' }
        ];

        table = new FlTable({
          target: '#test-container',
          selection: { enabled: true, multiple: true },
          columns: [{ name: 'Name', field: 'name' }],
          data: data
        });

        table.selectAll();
        expect(table.getSelectedRows()).to.have.lengthOf(3);

        table.deselectRow({ id: 2 });
        expect(table.getSelectedRows()).to.have.lengthOf(2);
        expect(table.getSelectedRows().find(function(r) { return r.id === 2; })).to.be.undefined;
      });

      it('should switch pages to select a row if pagination is enabled', function() {
        var data = [];

        for (var i = 1; i <= 20; i++) {
          data.push({ id: i, name: 'Item ' + i });
        }

        table = new FlTable({
          target: '#test-container',
          columns: [{ name: 'Name', field: 'name' }],
          data: data,
          pagination: {
            pageSize: 5
          },
          selection: {
            enabled: true
          }
        });

        // We are on page 1 (Items 1-5)
        expect(table.pagination.currentPage).to.equal(1);

        // Select item 12, which is on page 3
        table.selectRow({ id: 12 });

        // Check if we switched to page 3
        expect(table.pagination.currentPage).to.equal(3);

        // Check if row is selected
        expect(table.getSelectedRows()).to.have.lengthOf(1);
        expect(table.getSelectedRows()[0].id).to.equal(12);

        // Check if the DOM updated
        var rows = container.querySelectorAll('.fl-table-body .fl-table-row');

        expect(rows[0].textContent).to.contain('Item 11'); // First item on page 3

        var selectedRow = container.querySelector('.fl-table-row.fl-table-selected');

        expect(selectedRow).to.exist;
        expect(selectedRow.textContent).to.contain('Item 12');
      });
    });
  });

  describe('Partial Selection UI', function() {
    it('should show empty square when no rows are selected', function() {
      table = new FlTable({
        target: '#test-container',
        selection: {
          enabled: true,
          multiple: true
        },
        columns: [
          { name: 'Name', field: 'name' }
        ],
        data: [
          { name: 'Item 1' },
          { name: 'Item 2' },
          { name: 'Item 3' }
        ]
      });

      var selectAllCheckbox = container.querySelector('.fl-table-select-all-checkbox');
      expect(selectAllCheckbox).to.exist;
      expect(selectAllCheckbox.classList.contains('fa-square-o')).to.be.true;
      expect(selectAllCheckbox.classList.contains('fa-check-square')).to.be.false;
      expect(selectAllCheckbox.classList.contains('fa-minus-square')).to.be.false;
    });

    it('should show check square when all rows are selected', function() {
      table = new FlTable({
        target: '#test-container',
        selection: {
          enabled: true,
          multiple: true
        },
        columns: [
          { name: 'Name', field: 'name' }
        ],
        data: [
          { name: 'Item 1' },
          { name: 'Item 2' },
          { name: 'Item 3' }
        ]
      });

      // Select all rows
      table.selectAll();

      var selectAllCheckbox = container.querySelector('.fl-table-select-all-checkbox');
      expect(selectAllCheckbox.classList.contains('fa-check-square')).to.be.true;
      expect(selectAllCheckbox.classList.contains('fa-square-o')).to.be.false;
      expect(selectAllCheckbox.classList.contains('fa-minus-square')).to.be.false;
    });

    it('should show minus square when some rows are selected (partial state)', function() {
      var data = [
        { name: 'Item 1' },
        { name: 'Item 2' },
        { name: 'Item 3' }
      ];

      table = new FlTable({
        target: '#test-container',
        selection: {
          enabled: true,
          multiple: true
        },
        columns: [
          { name: 'Name', field: 'name' }
        ],
        data: data
      });

      // Select only first row
      table.selectRow(data[0]);

      var selectAllCheckbox = container.querySelector('.fl-table-select-all-checkbox');
      expect(selectAllCheckbox.classList.contains('fa-minus-square')).to.be.true;
      expect(selectAllCheckbox.classList.contains('fl-table-header-checkbox-partial')).to.be.true;
      expect(selectAllCheckbox.classList.contains('fa-square-o')).to.be.false;
      expect(selectAllCheckbox.classList.contains('fa-check-square')).to.be.false;
    });

    it('should update checkbox state when selection changes via row click', function() {
      var data = [
        { name: 'Item 1' },
        { name: 'Item 2' }
      ];

      table = new FlTable({
        target: '#test-container',
        selection: {
          enabled: true,
          multiple: true,
          rowClickEnabled: true
        },
        columns: [
          { name: 'Name', field: 'name' }
        ],
        data: data
      });

      var selectAllCheckbox = container.querySelector('.fl-table-select-all-checkbox');
      var firstRow = container.querySelector('.fl-table-body .fl-table-row');

      // Initially empty
      expect(selectAllCheckbox.classList.contains('fa-square-o')).to.be.true;

      // Select first row via click
      firstRow.click();

      // Should show partial state
      expect(selectAllCheckbox.classList.contains('fa-minus-square')).to.be.true;

      // Select second row via click
      var secondRow = container.querySelectorAll('.fl-table-body .fl-table-row')[1];
      secondRow.click();

      // Should show all selected state
      expect(selectAllCheckbox.classList.contains('fa-check-square')).to.be.true;
    });

    it('should handle partial selection with pagination', function() {
      var data = [];
      for (var i = 1; i <= 6; i++) {
        data.push({ id: i, name: 'Item ' + i });
      }

      table = new FlTable({
        target: '#test-container',
        selection: {
          enabled: true,
          multiple: true
        },
        columns: [
          { name: 'Name', field: 'name' }
        ],
        data: data,
        pagination: {
          pageSize: 3
        }
      });

      var selectAllCheckbox = container.querySelector('.fl-table-select-all-checkbox');

      // Select first 2 rows on page 1
      table.selectRow(data[0]);
      table.selectRow(data[1]);

      // Should show partial state (2 of 3 visible rows selected)
      expect(selectAllCheckbox.classList.contains('fa-minus-square')).to.be.true;

      // Select third row on page 1
      table.selectRow(data[2]);

      // Should show all selected state (all 3 visible rows selected)
      expect(selectAllCheckbox.classList.contains('fa-check-square')).to.be.true;

      // Go to page 2
      table.setPage(2);

      // Should show empty state (no rows selected on page 2)
      expect(selectAllCheckbox.classList.contains('fa-square-o')).to.be.true;
    });

    it('should toggle selection correctly when clicking select-all checkbox', function() {
      var data = [
        { name: 'Item 1' },
        { name: 'Item 2' },
        { name: 'Item 3' }
      ];

      table = new FlTable({
        target: '#test-container',
        selection: {
          enabled: true,
          multiple: true
        },
        columns: [
          { name: 'Name', field: 'name' }
        ],
        data: data
      });

      var selectAllCheckbox = container.querySelector('.fl-table-select-all-checkbox');

      // Initially no selection
      expect(table.getSelectedRows()).to.have.lengthOf(0);

      // Click select-all checkbox (should select all)
      selectAllCheckbox.click();
      expect(table.getSelectedRows()).to.have.lengthOf(3);
      expect(selectAllCheckbox.classList.contains('fa-check-square')).to.be.true;

      // Click again (should deselect all)
      selectAllCheckbox.click();
      expect(table.getSelectedRows()).to.have.lengthOf(0);
      expect(selectAllCheckbox.classList.contains('fa-square-o')).to.be.true;

      // Select one row first
      table.selectRow(data[0]);
      expect(selectAllCheckbox.classList.contains('fa-minus-square')).to.be.true;

      // Click select-all checkbox (should select all remaining)
      selectAllCheckbox.click();
      expect(table.getSelectedRows()).to.have.lengthOf(3);
      expect(selectAllCheckbox.classList.contains('fa-check-square')).to.be.true;
    });

    it('should update checkbox state after search operations', function() {
      var data = [
        { name: 'Apple', type: 'Fruit' },
        { name: 'Banana', type: 'Fruit' },
        { name: 'Carrot', type: 'Vegetable' }
      ];

      table = new FlTable({
        target: '#test-container',
        searchable: true,
        selection: {
          enabled: true,
          multiple: true
        },
        columns: [
          { name: 'Name', field: 'name', searchable: true }
        ],
        data: data
      });

      var selectAllCheckbox = container.querySelector('.fl-table-select-all-checkbox');

      // Select all items initially
      table.selectAll();
      expect(selectAllCheckbox.classList.contains('fa-check-square')).to.be.true;

      // Search for "fruit" - should show Apple and Banana
      table.search('a');

      // Should show all selected (both visible items are selected)
      expect(selectAllCheckbox.classList.contains('fa-check-square')).to.be.true;

      // Deselect Apple
      table.deselectRow(data[0]);

      // Should show partial state (Banana still selected)
      expect(selectAllCheckbox.classList.contains('fa-minus-square')).to.be.true;
    });
  });

  describe('Search', function() {
    it('should filter the table based on search input', function(done) {
      table = new FlTable({
        target: '#test-container',
        searchable: true,
        columns: [
          { name: 'Name', field: 'name', searchable: true },
          { name: 'Type', field: 'type' }
        ],
        data: [
          { name: 'Apple', type: 'Fruit' },
          { name: 'Banana', type: 'Fruit' }
        ]
      });

      var searchInput = container.querySelector('.fl-table-search input');

      searchInput.value = 'an';

      var inputEvent = new Event('input');

      searchInput.dispatchEvent(inputEvent);

      setTimeout(function() {
        var rows = container.querySelectorAll('.fl-table-body .fl-table-row');

        expect(rows).to.have.lengthOf(1);
        expect(rows[0].textContent).to.contain('Banana');
        done();
      }, 300); // Wait for debounce
    });

    it('should clear the search and show all rows', function(done) {
      table = new FlTable({
        target: '#test-container',
        searchable: true,
        columns: [
          { name: 'Name', field: 'name', searchable: true }
        ],
        data: [
          { name: 'Apple' },
          { name: 'Banana' }
        ]
      });

      var searchInput = container.querySelector('.fl-table-search input');

      searchInput.value = 'an';

      var inputEvent = new Event('input');

      searchInput.dispatchEvent(inputEvent);

      setTimeout(function() {
        searchInput.value = '';

        var clearEvent = new Event('input');

        searchInput.dispatchEvent(clearEvent);

        setTimeout(function() {
          var rows = container.querySelectorAll('.fl-table-body .fl-table-row');

          expect(rows).to.have.lengthOf(2);
          done();
        }, 300);
      }, 350);
    });

    it('should fire "search:change" event when search term changes', function(done) {
      var data = [{ name: 'Apple' }, { name: 'Banana' }];

      table = new FlTable({
        target: '#test-container',
        searchable: true,
        columns: [{ name: 'Name', field: 'name', searchable: true }],
        data: data
      });

      table.on('search:change', function(detail) {
        try {
          expect(detail.term).to.equal('an');
          expect(detail.data).to.have.lengthOf(1);
          expect(detail.data[0].name).to.equal('Banana');
          done();
        } catch (err) {
          done(err);
        }
      });

      var searchInput = container.querySelector('.fl-table-search input');

      searchInput.value = 'an';

      var inputEvent = new Event('input', { bubbles: true });

      searchInput.dispatchEvent(inputEvent);
    });
  });

  describe('Sorting', function() {
    it('should sort the table when a sortable column header is clicked', function() {
      var data = [ { name: 'C' }, { name: 'A' }, { name: 'B' } ];

      table = new FlTable({
        target: '#test-container',
        columns: [ { name: 'Name', field: 'name', sortable: true } ],
        data: data
      });

      var nameHeader = container.querySelector('.fl-table-header .fl-table-cell');

      nameHeader.click();

      var rows = container.querySelectorAll('.fl-table-body .fl-table-row');

      expect(rows[0].textContent).to.equal('A');
      expect(rows[1].textContent).to.equal('B');
      expect(rows[2].textContent).to.equal('C');
    });

    it('should toggle sort direction on subsequent clicks', function() {
      var data = [ { name: 'C' }, { name: 'A' }, { name: 'B' } ];

      table = new FlTable({
        target: '#test-container',
        columns: [ { name: 'Name', field: 'name', sortable: true } ],
        data: data
      });

      var nameHeader = container.querySelector('.fl-table-header .fl-table-cell');

      // First click: ASC
      nameHeader.click();
      // Second click: DESC
      nameHeader.click();

      var rows = container.querySelectorAll('.fl-table-body .fl-table-row');

      expect(rows[0].textContent).to.equal('C');
      expect(rows[1].textContent).to.equal('B');
      expect(rows[2].textContent).to.equal('A');
    });

    it('should use custom sort function if provided', function() {
      var data = [
        { name: 'Item 10' },
        { name: 'Item 2' }
      ];

      table = new FlTable({
        target: '#test-container',
        columns: [
          {
            name: 'Name',
            field: 'name',
            sortable: true,
            sortFn: function(a, b) {
              var numA = parseInt(a.name.match(/(\d+)/)[0], 10);
              var numB = parseInt(b.name.match(/(\d+)/)[0], 10);

              return numA - numB;
            }
          }
        ],
        data: data
      });

      var nameHeader = container.querySelector('.fl-table-header .fl-table-cell');

      nameHeader.click(); // ASC

      var rows = container.querySelectorAll('.fl-table-body .fl-table-row');

      expect(rows[0].textContent).to.equal('Item 2');
      expect(rows[1].textContent).to.equal('Item 10');
    });

    it('should provide a stable sort', function() {
      var data = [
        { category: 'A', value: 2, name: 'A2' },
        { category: 'B', value: 1, name: 'B1' },
        { category: 'A', value: 1, name: 'A1' }
      ];

      table = new FlTable({
        target: '#test-container',
        columns: [
          { name: 'Category', field: 'category', sortable: true },
          { name: 'Value', field: 'value' },
          { name: 'Name', field: 'name' }
        ],
        data: data,
        sort: {
          field: 'name',
          direction: 'asc'
        }
      });

      var categoryHeader = container.querySelector('.fl-table-header .fl-table-cell');

      categoryHeader.click(); // Sort by category

      var rows = container.querySelectorAll('.fl-table-body .fl-table-row');

      // After sorting by category 'A', the original order should be preserved for ties
      expect(rows[0].textContent).to.contain('A2');
      expect(rows[1].textContent).to.contain('A1');
      expect(rows[2].textContent).to.contain('B1');
    });
  });

  describe('Pagination', function() {
    it('should only show the first page of results', function() {
      var data = [];

      for (var i = 1; i <= 20; i++) {
        data.push({ name: 'Item ' + i });
      }

      table = new FlTable({
        target: '#test-container',
        columns: [{ name: 'Name', field: 'name' }],
        data: data,
        pagination: {
          enabled: true,
          pageSize: 10
        }
      });

      var rows = container.querySelectorAll('.fl-table-body .fl-table-row');

      expect(rows).to.have.lengthOf(10);
      expect(rows[0].textContent).to.contain('Item 1');
    });

    it('should navigate to the next page', function() {
      var data = [];

      for (var i = 1; i <= 20; i++) {
        data.push({ name: 'Item ' + i });
      }

      table = new FlTable({
        target: '#test-container',
        columns: [{ name: 'Name', field: 'name' }],
        data: data,
        pagination: {
          enabled: true,
          pageSize: 10
        }
      });

      var nextButton = container.querySelector('.fl-table-pagination .next-page');

      nextButton.click();

      var rows = container.querySelectorAll('.fl-table-body .fl-table-row');

      expect(rows).to.have.lengthOf(10);
      expect(rows[0].textContent).to.contain('Item 11');
    });
  });

  describe('Event System', function() {
    it('should subscribe to and fire a custom event', function(done) {
      table = new FlTable({
        target: '#test-container',
        columns: [{ name: 'Name', field: 'name' }],
        data: [{ name: 'Test' }]
      });

      var eventData = { message: 'Hello, World!' };

      table.on('custom:event', function(detail) {
        try {
          expect(detail).to.deep.equal(eventData);
          done();
        } catch (err) {
          done(err);
        }
      });

      // Manually fire the event for testing purposes
      table.fire('custom:event', eventData);
    });
  });

  describe('Expandable Rows', function() {
    it('should expand and collapse row on trigger click', function() {
      table = new FlTable({
        target: '#test-container',
        columns: [
          { name: 'Expander', field: 'expander', isExpandTrigger: true, width: '40px' },
          { name: 'Name', field: 'name' }
        ],
        data: [{ name: 'Item 1' }, { name: 'Item 2' }],
        expandable: {
          enabled: true,
          onExpand: function(row) {
            return '<div class="expanded-content">Details for ' + row.name + '</div>';
          }
        }
      });

      var firstRow = container.querySelector('.fl-table-body .fl-table-row');
      var expandTrigger = firstRow.querySelector('[data-expand-trigger]');

      // Initially not expanded
      expect(container.querySelector('.fl-table-row-expanded')).to.not.exist;

      // Click to expand
      expandTrigger.click();

      // Should be expanded now
      var expandedContent = container.querySelector('.fl-table-row-expanded');
      expect(expandedContent).to.exist;
      expect(expandedContent.textContent).to.contain('Details for Item 1');

      // Click to collapse
      expandTrigger.click();

      // Should be collapsed now
      expect(container.querySelector('.fl-table-row-expanded')).to.not.exist;
    });

    it('should prevent expansion if onBeforeExpand returns false', function() {
      table = new FlTable({
        target: '#test-container',
        columns: [
          { name: 'Expander', field: 'expander', isExpandTrigger: true },
          { name: 'Name', field: 'name' }
        ],
        data: [{ name: 'Locked Item' }],
        expandable: {
          enabled: true,
          onBeforeExpand: function(row) {
            return row.name !== 'Locked Item';
          },
          onExpand: function(row) {
            return '<div>Content</div>';
          }
        }
      });

      var firstRow = container.querySelector('.fl-table-body .fl-table-row');
      var expandTrigger = firstRow.querySelector('[data-expand-trigger]');

      expandTrigger.click();

      // Should not be expanded
      expect(container.querySelector('.fl-table-row-expanded')).to.not.exist;
    });

    it('should handle async onExpand and fire expand:start and expand:complete events', function(done) {
      var expandStartFired = false;
      var expandCompleteFired = false;

      table = new FlTable({
        target: '#test-container',
        columns: [
          { name: 'Expander', field: 'expander', isExpandTrigger: true },
          { name: 'Name', field: 'name' }
        ],
        data: [{ name: 'Item 1' }],
        expandable: {
          enabled: true,
          onExpand: function(row) {
            return new Promise(function(resolve) {
              setTimeout(function() {
                resolve('<div class="async-content">Async content for ' + row.name + '</div>');
              }, 50);
            });
          }
        }
      });

      table.on('expand:start', function(detail) {
        expect(detail.row.name).to.equal('Item 1');
        expandStartFired = true;
      });

      table.on('expand:complete', function(detail) {
        expect(detail.row.name).to.equal('Item 1');
        expect(detail.contentEl).to.exist;
        expandCompleteFired = true;
        
        // Check that content was loaded
        var expandedContent = container.querySelector('.fl-table-row-expanded .async-content');
        expect(expandedContent).to.exist;
        expect(expandedContent.textContent).to.contain('Async content for Item 1');
        
        // Verify both events fired
        expect(expandStartFired).to.be.true;
        expect(expandCompleteFired).to.be.true;
        done();
      });

      var firstRow = container.querySelector('.fl-table-body .fl-table-row');
      var expandTrigger = firstRow.querySelector('[data-expand-trigger]');

      expandTrigger.click();
    });

    it('should fire expand:error event on async failure', function(done) {
      table = new FlTable({
        target: '#test-container',
        columns: [
          { name: 'Expander', field: 'expander', isExpandTrigger: true },
          { name: 'Name', field: 'name' }
        ],
        data: [{ name: 'Item 1' }],
        expandable: {
          enabled: true,
          onExpand: function(row) {
            return new Promise(function(resolve, reject) {
              setTimeout(function() {
                reject(new Error('Failed to load content'));
              }, 50);
            });
          }
        }
      });

      table.on('expand:error', function(detail) {
        expect(detail.row.name).to.equal('Item 1');
        expect(detail.error).to.be.an('error');
        expect(detail.error.message).to.equal('Failed to load content');
        done();
      });

      var firstRow = container.querySelector('.fl-table-body .fl-table-row');
      var expandTrigger = firstRow.querySelector('[data-expand-trigger]');

      expandTrigger.click();
    });

    it('should fire collapse:complete event when row is collapsed', function(done) {
      table = new FlTable({
        target: '#test-container',
        columns: [
          { name: 'Expander', field: 'expander', isExpandTrigger: true },
          { name: 'Name', field: 'name' }
        ],
        data: [{ name: 'Item 1' }],
        expandable: {
          enabled: true,
          onExpand: function(row) {
            return '<div>Content</div>';
          }
        }
      });

      table.on('collapse:complete', function(detail) {
        expect(detail.row.name).to.equal('Item 1');
        done();
      });

      var firstRow = container.querySelector('.fl-table-body .fl-table-row');
      var expandTrigger = firstRow.querySelector('[data-expand-trigger]');

      // First expand
      expandTrigger.click();
      
      // Then collapse
      setTimeout(function() {
        expandTrigger.click();
      }, 10);
    });

    it('should support expandRow and collapseRow API methods', function() {
      var data = [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }];

      table = new FlTable({
        target: '#test-container',
        columns: [
          { name: 'Expander', field: 'expander', isExpandTrigger: true },
          { name: 'Name', field: 'name' }
        ],
        data: data,
        expandable: {
          enabled: true,
          onExpand: function(row) {
            return '<div class="api-expanded">API expanded ' + row.name + '</div>';
          }
        }
      });

      // Expand via API
      table.expandRow(data[0]);

      var expandedContent = container.querySelector('.fl-table-row-expanded .api-expanded');
      expect(expandedContent).to.exist;
      expect(expandedContent.textContent).to.contain('API expanded Item 1');

      // Collapse via API
      table.collapseRow(data[0]);

      expect(container.querySelector('.fl-table-row-expanded')).to.not.exist;
    });

    it('should handle row expansion with pagination', function() {
      var data = [];
      for (var i = 1; i <= 10; i++) {
        data.push({ id: i, name: 'Item ' + i });
      }

      table = new FlTable({
        target: '#test-container',
        columns: [
          { name: 'Expander', field: 'expander', isExpandTrigger: true },
          { name: 'Name', field: 'name' }
        ],
        data: data,
        pagination: { pageSize: 3 },
        expandable: {
          enabled: true,
          onExpand: function(row) {
            return '<div>Expanded ' + row.name + '</div>';
          }
        }
      });

      // Should only show 3 rows on first page
      var rows = container.querySelectorAll('.fl-table-body .fl-table-row');
      expect(rows).to.have.lengthOf(3);

      // Expand first row
      var expandTrigger = rows[0].querySelector('[data-expand-trigger]');
      expandTrigger.click();

      var expandedContent = container.querySelector('.fl-table-row-expanded');
      expect(expandedContent).to.exist;
      expect(expandedContent.textContent).to.contain('Expanded Item 1');
    });

    it('should support custom expand triggers within rendered content', function() {
      table = new FlTable({
        target: '#test-container',
        columns: [
          {
            name: 'Name',
            field: 'name',
            render: function(row) {
              return row.name + ' <button data-expand class="expand-btn">Expand</button>';
            }
          }
        ],
        data: [{ name: 'Item 1' }],
        expandable: {
          enabled: true,
          onExpand: function(row) {
            return '<div class="custom-expanded">Details for ' + row.name + '</div>';
          }
        }
      });

      // Find the custom expand button
      var expandButton = container.querySelector('.expand-btn');
      expect(expandButton).to.exist;

      // Initially not expanded
      expect(container.querySelector('.fl-table-row-expanded')).to.not.exist;

      // Click the custom expand button
      expandButton.click();

      // Should be expanded now
      var expandedContent = container.querySelector('.fl-table-row-expanded .custom-expanded');
      expect(expandedContent).to.exist;
      expect(expandedContent.textContent).to.contain('Details for Item 1');
    });

    it('should fire cell:interaction event when custom expand trigger is clicked', function(done) {
      table = new FlTable({
        target: '#test-container',
        columns: [
          {
            name: 'Name',
            field: 'name',
            render: function(row) {
              return '<span>' + row.name + ' <i data-expand class="expand-icon">▶</i></span>';
            }
          }
        ],
        data: [{ name: 'Item 1' }],
        expandable: {
          enabled: true,
          onExpand: function(row) {
            return '<div>Expanded</div>';
          }
        }
      });

      table.on('cell:interaction', function(detail) {
        try {
          expect(detail.row.name).to.equal('Item 1');
          expect(detail.action).to.equal('expand');
          expect(detail.target).to.exist;
          expect(detail.column).to.exist;
          done();
        } catch (err) {
          done(err);
        }
      });

      var expandIcon = container.querySelector('.expand-icon');
      expandIcon.click();
    });

    it('should support multiple custom expand triggers in different cells', function() {
      table = new FlTable({
        target: '#test-container',
        columns: [
          {
            name: 'Name',
            field: 'name',
            render: function(row) {
              return row.name + ' <span data-expand class="name-expand">🔽</span>';
            }
          },
          {
            name: 'Actions',
            field: 'actions',
            render: function(row) {
              return '<button data-expand class="action-expand">Details</button>';
            }
          }
        ],
        data: [{ name: 'Item 1', actions: '' }],
        expandable: {
          enabled: true,
          onExpand: function(row) {
            return '<div>Expanded from any trigger</div>';
          }
        }
      });

      // Test name column expand trigger
      var nameExpand = container.querySelector('.name-expand');
      nameExpand.click();

      var expandedContent = container.querySelector('.fl-table-row-expanded');
      expect(expandedContent).to.exist;

      // Collapse
      nameExpand.click();
      expect(container.querySelector('.fl-table-row-expanded')).to.not.exist;

      // Test action column expand trigger
      var actionExpand = container.querySelector('.action-expand');
      actionExpand.click();

      expandedContent = container.querySelector('.fl-table-row-expanded');
      expect(expandedContent).to.exist;
      expect(expandedContent.textContent).to.contain('Expanded from any trigger');
    });

    it('should prevent race conditions when expand trigger is clicked rapidly', function(done) {
      var expandCallCount = 0;

      table = new FlTable({
        target: '#test-container',
        columns: [
          {
            name: 'Name',
            field: 'name',
            render: function(row) {
              return row.name + ' <button data-expand class="rapid-expand-btn">Expand</button>';
            }
          }
        ],
        data: [{ name: 'Item 1' }],
        expandable: {
          enabled: true,
          onExpand: function(row) {
            expandCallCount++;
            return new Promise(function(resolve) {
              setTimeout(function() {
                resolve('<div class="race-test-content">Content ' + expandCallCount + '</div>');
              }, 100);
            });
          }
        }
      });

      var expandButton = container.querySelector('.rapid-expand-btn');

      // Rapidly click the expand button multiple times
      expandButton.click();
      expandButton.click();
      expandButton.click();

      // Wait for async operations to complete
      setTimeout(function() {
        var expandedContents = container.querySelectorAll('.fl-table-row-expanded .race-test-content');
        
        // Should only have one expanded content instance, despite multiple clicks
        expect(expandedContents).to.have.lengthOf(1);
        
        // Should only have called onExpand once
        expect(expandCallCount).to.equal(1);
        
        done();
      }, 200);
    });

    it('should provide isRowExpanding method to check expansion state', function(done) {
      table = new FlTable({
        target: '#test-container',
        columns: [
          { name: 'Name', field: 'name' },
          { name: 'Expander', field: 'expander', isExpandTrigger: true }
        ],
        data: [{ name: 'Item 1' }],
        expandable: {
          enabled: true,
          onExpand: function(row) {
            return new Promise(function(resolve) {
              setTimeout(function() {
                resolve('<div>Async content</div>');
              }, 100);
            });
          }
        }
      });

      var firstRow = container.querySelector('.fl-table-body .fl-table-row');
      var expandTrigger = firstRow.querySelector('[data-expand-trigger]');
      var rowData = table.getData()[0];

      // Initially not expanding
      expect(table.isRowExpanding(rowData)).to.be.false;

      // Click to expand
      expandTrigger.click();

      // Should be expanding now
      expect(table.isRowExpanding(rowData)).to.be.true;
      expect(table.isRowExpanded(rowData)).to.be.false;

      // Wait for expansion to complete
      setTimeout(function() {
        // Should no longer be expanding, but should be expanded
        expect(table.isRowExpanding(rowData)).to.be.false;
        expect(table.isRowExpanded(rowData)).to.be.true;
        done();
      }, 150);
    });
  });

  describe('Destroy', function() {
    it('should remove the table from the DOM', function() {
      table = new FlTable({
        target: '#test-container',
        columns: [{ name: 'Name', field: 'name' }],
        data: [{ name: 'Test' }]
      });

      table.destroy();
      expect(container.querySelector('.fl-table')).to.not.exist;
    });

    it('should remove event listeners', function() {
      var clickSpy = sinon.spy();

      table = new FlTable({
        target: '#test-container',
        columns: [{ name: 'Name', field: 'name' }],
        data: [{ name: 'Test' }]
      });

      table.on('row:click', clickSpy);
      table.destroy();

      var rowEl = document.createElement('div');

      // Simulate a row click by creating a dummy element
      // This is not perfect but checks if the global listener on the container is gone
      rowEl.className = 'fl-table-row';

      var cellEl = document.createElement('div');

      cellEl.className = 'fl-table-cell';
      rowEl.appendChild(cellEl);
      container.appendChild(rowEl);

      cellEl.click();

      expect(clickSpy.called).to.be.false;
    });
  });

  describe('Partial Selection API', function() {
    it('should set a row to partial selection state', function() {
      var data = [{ name: 'Item 1' }, { name: 'Item 2' }];

      table = new FlTable({
        target: '#test-container',
        selection: { enabled: true, multiple: true },
        columns: [{ name: 'Name', field: 'name' }],
        data: data
      });

      table.setRowPartialSelection(data[0], true);

      expect(table.isRowPartiallySelected(data[0])).to.be.true;
      expect(table.isRowPartiallySelected(data[1])).to.be.false;
    });

    it('should remove partial selection state from a row', function() {
      var data = [{ name: 'Item 1' }];

      table = new FlTable({
        target: '#test-container',
        selection: { enabled: true, multiple: true },
        columns: [{ name: 'Name', field: 'name' }],
        data: data
      });

      table.setRowPartialSelection(data[0], true);
      expect(table.isRowPartiallySelected(data[0])).to.be.true;

      table.setRowPartialSelection(data[0], false);
      expect(table.isRowPartiallySelected(data[0])).to.be.false;
    });

    it('should clear all partial selection states', function() {
      var data = [{ name: 'Item 1' }, { name: 'Item 2' }];

      table = new FlTable({
        target: '#test-container',
        selection: { enabled: true, multiple: true },
        columns: [{ name: 'Name', field: 'name' }],
        data: data
      });

      table.setRowPartialSelection(data[0], true);
      table.setRowPartialSelection(data[1], true);

      expect(table.isRowPartiallySelected(data[0])).to.be.true;
      expect(table.isRowPartiallySelected(data[1])).to.be.true;

      table.clearAllPartialSelection();

      expect(table.isRowPartiallySelected(data[0])).to.be.false;
      expect(table.isRowPartiallySelected(data[1])).to.be.false;
    });

    it('should render FontAwesome icon for partially selected rows', function() {
      var data = [{ name: 'Item 1' }, { name: 'Item 2' }];

      table = new FlTable({
        target: '#test-container',
        selection: { enabled: true, multiple: true },
        columns: [{ name: 'Name', field: 'name' }],
        data: data
      });

      table.setRowPartialSelection(data[0], true);

      var firstRowCheckbox = container.querySelector('.fl-table-body .fl-table-row .fl-table-checkbox i');
      var secondRowCheckbox = container.querySelector('.fl-table-body .fl-table-row:nth-child(2) .fl-table-checkbox input');

      // First row should have FontAwesome icon
      expect(firstRowCheckbox).to.exist;
      expect(firstRowCheckbox.classList.contains('fa-minus-square')).to.be.true;
      expect(firstRowCheckbox.classList.contains('fl-table-row-checkbox-partial')).to.be.true;

      // Second row should have regular checkbox
      expect(secondRowCheckbox).to.exist;
      expect(secondRowCheckbox.type).to.equal('checkbox');
    });

    it('should show header checkbox in partial state when any row has partial selection', function() {
      var data = [{ name: 'Item 1' }, { name: 'Item 2' }];

      table = new FlTable({
        target: '#test-container',
        selection: { enabled: true, multiple: true },
        columns: [{ name: 'Name', field: 'name' }],
        data: data
      });

      var selectAllCheckbox = container.querySelector('.fl-table-select-all-checkbox');

      // Initially empty
      expect(selectAllCheckbox.classList.contains('fa-square-o')).to.be.true;

      // Set one row to partial
      table.setRowPartialSelection(data[0], true);

      // Should show partial state
      expect(selectAllCheckbox.classList.contains('fa-minus-square')).to.be.true;
      expect(selectAllCheckbox.classList.contains('fl-table-header-checkbox-partial')).to.be.true;
    });

    it('should handle partial selection with regular selection', function() {
      var data = [{ name: 'Item 1' }, { name: 'Item 2' }, { name: 'Item 3' }];

      table = new FlTable({
        target: '#test-container',
        selection: { enabled: true, multiple: true },
        columns: [{ name: 'Name', field: 'name' }],
        data: data
      });

      var selectAllCheckbox = container.querySelector('.fl-table-select-all-checkbox');

      // Set one row to partial and one to selected
      table.setRowPartialSelection(data[0], true);
      table.selectRow(data[1]);

      // Should show partial state (mixed partial + selected)
      expect(selectAllCheckbox.classList.contains('fa-minus-square')).to.be.true;
      expect(selectAllCheckbox.classList.contains('fl-table-header-checkbox-partial')).to.be.true;

      // Clear partial selection
      table.clearAllPartialSelection();

      // Should still show partial state (1 of 3 selected)
      expect(selectAllCheckbox.classList.contains('fa-minus-square')).to.be.true;

      // Select all remaining
      table.selectAll();

      // Should show full state (all selected, no partial)
      expect(selectAllCheckbox.classList.contains('fa-check-square')).to.be.true;
      expect(selectAllCheckbox.classList.contains('fl-table-header-checkbox-selected')).to.be.true;
    });
  });

  describe('Selection State Initialization', function() {
    it('should initialize selection states from configuration', function() {
      var data = [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }, { id: 3, name: 'Item 3' }];

      table = new FlTable({
        target: '#test-container',
        selection: {
          enabled: true,
          multiple: true,
          initialSelection: [{ id: 1 }],
          initialPartialSelection: [{ id: 2 }]
        },
        columns: [{ name: 'Name', field: 'name' }],
        data: data
      });

      expect(table.getSelectedRows()).to.have.lengthOf(1);
      expect(table.getSelectedRows()[0]).to.equal(data[0]);
      expect(table.isRowPartiallySelected(data[1])).to.be.true;
      expect(table.isRowPartiallySelected(data[0])).to.be.false;
    });

    it('should initialize selection states from row data', function() {
      var data = [
        { id: 1, name: 'Item 1', _selected: true },
        { id: 2, name: 'Item 2', _partiallySelected: true },
        { id: 3, name: 'Item 3' }
      ];

      table = new FlTable({
        target: '#test-container',
        selection: { enabled: true, multiple: true },
        columns: [{ name: 'Name', field: 'name' }],
        data: data
      });

      expect(table.getSelectedRows()).to.have.lengthOf(1);
      expect(table.getSelectedRows()[0]).to.equal(data[0]);
      expect(table.isRowPartiallySelected(data[1])).to.be.true;
      expect(table.isRowPartiallySelected(data[2])).to.be.false;
    });

    it('should combine configuration and data-driven initialization', function() {
      var data = [
        { id: 1, name: 'Item 1', _selected: true },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3', _partiallySelected: true },
        { id: 4, name: 'Item 4' }
      ];

      table = new FlTable({
        target: '#test-container',
        selection: {
          enabled: true,
          multiple: true,
          initialSelection: [{ id: 2 }],
          initialPartialSelection: [{ id: 4 }]
        },
        columns: [{ name: 'Name', field: 'name' }],
        data: data
      });

      // Should have 2 selected rows (1 from data, 1 from config)
      expect(table.getSelectedRows()).to.have.lengthOf(2);
      expect(table.getSelectedRows()).to.include(data[0]); // From data
      expect(table.getSelectedRows()).to.include(data[1]); // From config

      // Should have 2 partially selected rows (1 from data, 1 from config)
      expect(table.isRowPartiallySelected(data[2])).to.be.true; // From data
      expect(table.isRowPartiallySelected(data[3])).to.be.true; // From config
    });
  });

  describe('Partial Selection Interaction Behavior', function() {
    it('should remove partial state when clicking on partial row', function() {
      var data = [{ name: 'Item 1' }, { name: 'Item 2' }];

      table = new FlTable({
        target: '#test-container',
        selection: { enabled: true, multiple: true, rowClickEnabled: true },
        columns: [{ name: 'Name', field: 'name' }],
        data: data
      });

      // Set first row to partial
      table.setRowPartialSelection(data[0], true);
      expect(table.isRowPartiallySelected(data[0])).to.be.true;

      // Click the partial row checkbox
      var partialIcon = container.querySelector('.fl-table-row-checkbox-partial');
      partialIcon.click();

      // Should no longer be partial
      expect(table.isRowPartiallySelected(data[0])).to.be.false;
      // Should now be selected (partial click = select)
      expect(table.getSelectedRows()).to.have.lengthOf(1);
      expect(table.getSelectedRows()[0]).to.equal(data[0]);
    });

    it('should deselect current page when clicking select-all checkbox in partial state', function() {
      var data = [];
      for (var i = 1; i <= 6; i++) {
        data.push({ id: i, name: 'Item ' + i });
      }

      table = new FlTable({
        target: '#test-container',
        selection: { enabled: true, multiple: true },
        columns: [{ name: 'Name', field: 'name' }],
        data: data,
        pagination: { pageSize: 3 }
      });

      var selectAllCheckbox = container.querySelector('.fl-table-select-all-checkbox');

      // Set some rows to different states on first page
      table.selectRow(data[0]); // Selected
      table.setRowPartialSelection(data[1], true); // Partial
      // data[2] remains unselected

      // Header should show partial state
      expect(selectAllCheckbox.classList.contains('fa-minus-square')).to.be.true;

      // Click select-all checkbox
      selectAllCheckbox.click();

      // Should clear partial selection and select all on current page
      expect(table.isRowPartiallySelected(data[1])).to.be.false;
      expect(table.getSelectedRows()).to.have.lengthOf(3); // All 3 on page 1

      // Click select-all checkbox again
      selectAllCheckbox.click();

      // Should deselect current page
      var selectedCurrentPage = table.getCurrentPageData().filter(function(row) {
        return table.getSelectedRows().indexOf(row) > -1;
      });
      expect(selectedCurrentPage).to.have.lengthOf(0);
    });

    it('should handle mixed partial and selected states correctly with select-all', function() {
      var data = [
        { name: 'Item 1' },
        { name: 'Item 2' },
        { name: 'Item 3' }
      ];

      table = new FlTable({
        target: '#test-container',
        selection: { enabled: true, multiple: true },
        columns: [{ name: 'Name', field: 'name' }],
        data: data
      });

      var selectAllCheckbox = container.querySelector('.fl-table-select-all-checkbox');

      // Set up mixed state: one selected, one partial, one unselected
      table.selectRow(data[0]);
      table.setRowPartialSelection(data[1], true);
      // data[2] is unselected

      expect(selectAllCheckbox.classList.contains('fa-minus-square')).to.be.true;

      // Click select-all (should select all and clear partials)
      selectAllCheckbox.click();

      expect(table.getSelectedRows()).to.have.lengthOf(3);
      expect(table.isRowPartiallySelected(data[1])).to.be.false;
      expect(selectAllCheckbox.classList.contains('fa-check-square')).to.be.true;

      // Click again (should deselect all)
      selectAllCheckbox.click();

      expect(table.getSelectedRows()).to.have.lengthOf(0);
      expect(selectAllCheckbox.classList.contains('fa-square-o')).to.be.true;
    });

    it('should follow consistent click behavior for individual rows: partial → selected → unselected', function() {
      var data = [{ name: 'Item 1' }];

      table = new FlTable({
        target: '#test-container',
        selection: { enabled: true, multiple: true },
        columns: [{ name: 'Name', field: 'name' }],
        data: data
      });

      // Start with partial state
      table.setRowPartialSelection(data[0], true);
      expect(table.isRowPartiallySelected(data[0])).to.be.true;
      expect(table.getSelectedRows()).to.have.lengthOf(0);

      var rowCheckbox = container.querySelector('.fl-table-row-checkbox-partial');

      // Click 1: partial → selected
      rowCheckbox.click();
      expect(table.isRowPartiallySelected(data[0])).to.be.false;
      expect(table.getSelectedRows()).to.have.lengthOf(1);

      // Now it should be a regular checkbox
      rowCheckbox = container.querySelector('.fl-table-checkbox input[type="checkbox"]');

      // Click 2: selected → unselected
      rowCheckbox.click();
      expect(table.getSelectedRows()).to.have.lengthOf(0);
    });

    it('should follow consistent click behavior for select-all: empty → partial → selected → empty', function() {
      var data = [{ name: 'Item 1' }, { name: 'Item 2' }, { name: 'Item 3' }];

      table = new FlTable({
        target: '#test-container',
        selection: { enabled: true, multiple: true },
        columns: [{ name: 'Name', field: 'name' }],
        data: data
      });

      var selectAllCheckbox = container.querySelector('.fl-table-select-all-checkbox');

      // Start: empty state
      expect(selectAllCheckbox.classList.contains('fa-square-o')).to.be.true;

      // Create partial state by selecting one row
      table.selectRow(data[0]);
      expect(selectAllCheckbox.classList.contains('fa-minus-square')).to.be.true;

      // Click 1: partial → all selected
      selectAllCheckbox.click();
      expect(table.getSelectedRows()).to.have.lengthOf(3);
      expect(selectAllCheckbox.classList.contains('fa-check-square')).to.be.true;

      // Click 2: all selected → empty
      selectAllCheckbox.click();
      expect(table.getSelectedRows()).to.have.lengthOf(0);
      expect(selectAllCheckbox.classList.contains('fa-square-o')).to.be.true;
    });
  });
});
