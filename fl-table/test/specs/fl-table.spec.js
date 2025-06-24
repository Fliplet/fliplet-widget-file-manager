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

      var headerCheckbox = container.querySelector('.fl-table-header input[type="checkbox"]');

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
});
