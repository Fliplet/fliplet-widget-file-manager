describe('FlTable', function() {
  var expect = chai.expect;
  var table;
  var container;

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
  });

  describe('Sorting', function() {
    it('should sort data in ascending order', function() {
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

    it('should toggle sort direction on second click', function() {
      var data = [ { name: 'C' }, { name: 'A' }, { name: 'B' } ];

      table = new FlTable({
        target: '#test-container',
        columns: [ { name: 'Name', field: 'name', sortable: true } ],
        data: data
      });

      var nameHeader = container.querySelector('.fl-table-header .fl-table-cell');

      nameHeader.click(); // Ascending
      nameHeader.click(); // Descending

      var rows = container.querySelectorAll('.fl-table-body .fl-table-row');

      expect(rows[0].textContent).to.equal('C');
      expect(rows[1].textContent).to.equal('B');
      expect(rows[2].textContent).to.equal('A');
    });

    it('should add sort indicator class to header', function() {
      table = new FlTable({
        target: '#test-container',
        columns: [ { name: 'Name', field: 'name', sortable: true } ],
        data: [ { name: 'A' } ]
      });

      var nameHeader = container.querySelector('.fl-table-header .fl-table-cell');

      nameHeader.click();
      expect(nameHeader.classList.contains('fl-table-sorted-asc')).to.be.true;

      nameHeader.click();
      expect(nameHeader.classList.contains('fl-table-sorted-desc')).to.be.true;
    });

    it('should use custom sort function if provided', function() {
      var data = [ { name: 'Banana' }, { name: 'Apple' }, { name: 'Cherry' } ];

      table = new FlTable({
        target: '#test-container',
        columns: [ {
          name: 'Name',
          field: 'name',
          sortable: true,
          sortFn: function(a, b) {
            return a.name.length - b.name.length;
          }
        } ],
        data: data
      });

      var nameHeader = container.querySelector('.fl-table-header .fl-table-cell');

      nameHeader.click();

      var rows = container.querySelectorAll('.fl-table-body .fl-table-row');

      expect(rows[0].textContent).to.equal('Apple');
      expect(rows[1].textContent).to.equal('Cherry');
      expect(rows[2].textContent).to.equal('Banana');
    });
  });

  describe('Search', function() {
    it('should render a search input if searchable is true', function() {
      table = new FlTable({
        target: '#test-container',
        searchable: true,
        columns: [ { name: 'Name', field: 'name' } ],
        data: []
      });
      expect(container.querySelector('.fl-table-search')).to.exist;
    });

    it('should filter data based on search term', function(done) {
      table = new FlTable({
        target: '#test-container',
        searchable: true,
        columns: [ { name: 'Name', field: 'name', searchable: true } ],
        data: [ { name: 'Apple' }, { name: 'Banana' }, { name: 'Cherry' } ]
      });

      var searchInput = container.querySelector('.fl-table-search input');

      searchInput.value = 'an';

      var inputEvent = new Event('input');

      searchInput.dispatchEvent(inputEvent);

      setTimeout(function() {
        var rows = container.querySelectorAll('.fl-table-body .fl-table-row');

        expect(rows).to.have.lengthOf(1);
        expect(rows[0].textContent).to.equal('Banana');
        done();
      }, 350); // wait for debounce
    });

    it('should restore data when search is cleared', function(done) {
      table = new FlTable({
        target: '#test-container',
        searchable: true,
        columns: [ { name: 'Name', field: 'name', searchable: true } ],
        data: [ { name: 'Apple' }, { name: 'Banana' } ]
      });

      var searchInput = container.querySelector('.fl-table-search input');

      searchInput.value = 'an';

      var inputEvent = new Event('input');

      searchInput.dispatchEvent(inputEvent);

      setTimeout(function() {
        searchInput.value = '';
        searchInput.dispatchEvent(inputEvent);

        setTimeout(function() {
          var rows = container.querySelectorAll('.fl-table-body .fl-table-row');

          expect(rows).to.have.lengthOf(2);
          done();
        }, 350);
      }, 350);
    });
  });

  describe('Pagination', function() {
    it('should render pagination controls if pagination is enabled', function() {
      table = new FlTable({
        target: '#test-container',
        pagination: { pageSize: 2 },
        columns: [ { name: 'Name', field: 'name' } ],
        data: [ { name: 'A' }, { name: 'B' }, { name: 'C' } ]
      });
      expect(container.querySelector('.fl-table-pagination')).to.exist;
    });

    it('should display the correct number of rows per page', function() {
      table = new FlTable({
        target: '#test-container',
        pagination: { pageSize: 2 },
        columns: [ { name: 'Name', field: 'name' } ],
        data: [ { name: 'A' }, { name: 'B' }, { name: 'C' } ]
      });

      var rows = container.querySelectorAll('.fl-table-body .fl-table-row');

      expect(rows).to.have.lengthOf(2);
    });

    it('should navigate to the next page', function() {
      table = new FlTable({
        target: '#test-container',
        pagination: { pageSize: 2 },
        columns: [ { name: 'Name', field: 'name' } ],
        data: [ { name: 'A' }, { name: 'B' }, { name: 'C' } ]
      });
      container.querySelector('.fl-table-pagination .next-page').click();

      var rows = container.querySelectorAll('.fl-table-body .fl-table-row');

      expect(rows).to.have.lengthOf(1);
      expect(rows[0].textContent).to.equal('C');
    });
  });
});
