# FlTable - Flexible Table Library

## Overview

FlTable is a lightweight, flexible table library that provides a modern, div-based table implementation with rich features like sorting, searching, and row selection. It is designed to be framework-agnostic and can be used with any data source.

## Project Structure

```
fl-table/
├── dist/
│   ├── fl-table.js         # Minified production bundle
│   ├── fl-table.css        # Minified CSS
│   └── fl-table.js.map     # Source map
├── src/
│   ├── fl-table.js         # Main library source
│   ├── styles/
│   │   └── fl-table.css    # Core styles
│   └── templates/
│       └── default.html    # Default Handlebars templates
├── demo/
│   ├── index.html          # Basic demo
│   ├── advanced.html       # Advanced features demo
│   └── styles/
│       └── demo.css        # Demo-specific styles
└── test/
    ├── index.html          # Test runner
    └── specs/
        └── fl-table.spec.js # Test suite
```

## Installation

Simply include the JavaScript and CSS files in your HTML:

```html
<!-- Include Handlebars first -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/handlebars.js/4.7.8/handlebars.min.js"></script>

<!-- Include FlTable -->
<link rel="stylesheet" href="path/to/fl-table/dist/fl-table.css">
<script src="path/to/fl-table/dist/fl-table.js"></script>
```

## Quick Start

```html
<!DOCTYPE html>
<html>
<head>
    <title>FlTable Demo</title>
    <link rel="stylesheet" href="../dist/fl-table.css">
</head>
<body>
    <div id="table-container"></div>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/handlebars.js/4.7.8/handlebars.min.js"></script>
    <script src="../dist/fl-table.js"></script>
    <script>
        const table = new FlTable({
            target: '#table-container',
            columns: [
                { name: 'Name', field: 'name', sortable: true },
                { name: 'Created', field: 'createdAt', sortable: true },
                { name: 'Size', field: 'size' }
            ],
            data: [
                { name: 'Document.pdf', createdAt: '2024-03-20', size: '2.1 MB' },
                { name: 'Image.jpg', createdAt: '2024-03-19', size: '1.5 MB' }
            ]
        });
    </script>
</body>
</html>
```

## Development Setup

1. Clone the repository:
```bash
git clone https://github.com/fliplet/fl-table.git
cd fl-table
```

2. Open the demo pages directly in your browser:
- Basic demo: Open `demo/index.html` in your browser
- Advanced demo: Open `demo/advanced.html` in your browser
- Tests: Open `test/index.html` in your browser

The demos and tests can be run directly from the filesystem without needing a local server. This makes development and testing as simple as editing the files and refreshing your browser.

### Test-Driven Development

The test suite uses Mocha and Chai for a robust TDD workflow:

1. Write a failing test in `test/specs/fl-table.spec.js`
2. Open or refresh `test/index.html` to see the failure
3. Implement the feature in `src/fl-table.js`
4. Refresh `test/index.html` to see the test pass
5. Refactor while keeping tests green

Example TDD workflow for adding a new feature:

```javascript
// test/specs/fl-table.spec.js

describe('FlTable Column Sorting', () => {
    let table;
    let container;

    beforeEach(() => {
        container = document.getElementById('test-container');
        container.innerHTML = '';

        table = new FlTable({
            target: '#test-container',
            columns: [
                { name: 'Name', field: 'name', sortable: true },
                { name: 'Size', field: 'size', sortable: true }
            ],
            data: [
                { name: 'B.pdf', size: '2 MB' },
                { name: 'A.pdf', size: '1 MB' },
                { name: 'C.pdf', size: '3 MB' }
            ]
        });
    });

    afterEach(() => {
        if (table) {
            table.destroy();
            table = null;
        }
    });

    it('should sort strings in ascending order', () => {
        // Click the Name column header
        const nameHeader = container.querySelector('[data-sort="name"]');
        nameHeader.click();

        // Get all rows
        const rows = container.querySelectorAll('.fl-table-row');

        // Verify sort order
        chai.expect(rows[0].textContent).to.contain('A.pdf');
        chai.expect(rows[1].textContent).to.contain('B.pdf');
        chai.expect(rows[2].textContent).to.contain('C.pdf');
    });

    it('should toggle sort direction on second click', () => {
        const nameHeader = container.querySelector('[data-sort="name"]');

        // First click - ascending
        nameHeader.click();
        let rows = container.querySelectorAll('.fl-table-row');
        chai.expect(rows[0].textContent).to.contain('A.pdf');

        // Second click - descending
        nameHeader.click();
        rows = container.querySelectorAll('.fl-table-row');
        chai.expect(rows[0].textContent).to.contain('C.pdf');
    });

    it('should handle custom sort functions', () => {
        table = new FlTable({
            target: '#test-container',
            columns: [
                {
                    name: 'Size',
                    field: 'size',
                    sortable: true,
                    sortFn: (a, b) => {
                        // Convert '1 MB' to 1, etc.
                        const getSize = (str) => parseInt(str);
                        return getSize(a.size) - getSize(b.size);
                    }
                }
            ],
            data: [
                { size: '2 MB' },
                { size: '1 MB' },
                { size: '10 MB' }
            ]
        });

        const sizeHeader = container.querySelector('[data-sort="size"]');
        sizeHeader.click();

        const rows = container.querySelectorAll('.fl-table-row');
        chai.expect(rows[0].textContent).to.contain('1 MB');
        chai.expect(rows[1].textContent).to.contain('2 MB');
        chai.expect(rows[2].textContent).to.contain('10 MB');
    });
});
```

This TDD approach ensures:
- Features are thoroughly tested
- Regressions are caught early
- Code remains maintainable
- Documentation through tests
- Confidence in changes

## Building for Production

To minify and bundle the library for production:

1. Install minification tools:
```bash
npm install -g uglify-js clean-css-cli
```

2. Run build script:
```bash
# Minify JavaScript
uglifyjs src/fl-table.js -o dist/fl-table.js -c -m --source-map

# Minify CSS
cleancss -o dist/fl-table.css src/styles/fl-table.css
```

## Key Features

- Div-based table layout for maximum styling flexibility
- Sortable columns with customizable sort functions
- Built-in search with customizable search implementation
- Single and multiple row selection with checkboxes
- Double-click handlers for row interactions
- Custom cell rendering via templates
- Pagination support
- Event-driven architecture
- No external dependencies

## Configuration Options

### Basic Configuration

```typescript
interface FlTableOptions {
  // Required options
  target: string | HTMLElement;  // CSS selector or DOM element where table will be mounted
  columns: ColumnDefinition[];   // Array of column definitions

  // Optional configuration
  data?: any[];                 // Initial data array
  selection?: {                 // Selection configuration
    enabled: boolean;           // Enable selection functionality (default: false)
    multiple: boolean;          // Allow multiple selections (default: false)
    rowClickEnabled: boolean;   // Enable row click selection (default: false)
    checkboxes: boolean;        // Show selection checkboxes (default: true if selection enabled)
    selectAllCheckbox: boolean; // Show select-all checkbox in header (default: true if multiple selection enabled)
    onBeforeSelect?: (row: any) => boolean | Promise<boolean>; // Return false to prevent selection
  };
  sortable?: boolean;           // Enable column sorting (default: true)
  searchable?: boolean;         // Show search input (default: false)
  pagination?: boolean | {      // Enable pagination (default: false)
    pageSize?: number;          // Items per page (default: 10)
    pageSizes?: number[];       // Available page size options
  };
  templates?: {                 // Custom cell templates
    [key: string]: HandlebarsTemplateDelegate;
  };
  className?: string;          // Additional CSS class for the table
}
```

### Column Definition

```typescript
interface ColumnDefinition {
  name: string;                // Display name for the column
  field: string;               // Data field to display
  sortable?: boolean;          // Enable sorting for this column
  width?: string;              // CSS width value
  template?: string;           // Name of template to use for cells
  templateSelector?: (row: any) => string;  // Dynamic template selection
  sortFn?: (a: any, b: any) => number;     // Custom sort function
  searchable?: boolean;        // Include this column in search
  className?: string;          // Additional CSS class for the column
}
```

## Templates

FlTable uses Handlebars for template rendering. Templates can be registered during initialization or added later.

```javascript
const table = new FlTable({
  // ... other options ...
  templates: {
    'image-cell': Handlebars.compile(`
      <div class="fl-table-image-cell">
        {{#if thumbnail}}
          <img src="{{thumbnail}}" alt="{{name}}" />
        {{/if}}
        <span>{{name}}</span>
      </div>
    `),
    'action-cell': Handlebars.compile(`
      <div class="fl-table-action-cell">
        <button onclick="handleEdit('{{id}}')">Edit</button>
        <button onclick="handleDelete('{{id}}')">Delete</button>
      </div>
    `)
  }
});

// Add template later
table.addTemplate('custom-cell', Handlebars.compile(`
  <div class="custom-cell">{{value}}</div>
`));
```

## Events

FlTable uses an event-driven architecture for maximum flexibility. All events provide relevant data in their detail property.

```javascript
// Available events
interface FlTableEvents {
  // Selection Events
  'checkbox:select': { row: any; selected: boolean };     // Checkbox clicked
  'checkbox:selectall': { selected: boolean };            // Select-all checkbox clicked
  'row:click': { row: any; event: MouseEvent };          // Row clicked
  'row:clickselect': { row: any; selected: boolean };    // Row selected via click
  'selection:change': {                                   // Any selection change (checkbox, row click, or API)
    selected: any[];           // Currently selected rows
    deselected: any[];        // Recently deselected rows
    source: 'checkbox' | 'row-click' | 'api';  // Source of the selection change
  };

  // Other Events
  'row:doubleclick': { row: any; event: MouseEvent };
  'sort:change': { column: string; direction: 'asc' | 'desc' };
  'search:input': { term: string };
  'search:complete': { results: any[] };
  'page:change': { page: number; pageSize: number };
}

// Example: Different ways to handle selection
const table = new FlTable({
  target: '#table',
  selection: {
    enabled: true,
    multiple: true,
    rowClickEnabled: true,
    checkboxes: true,
    onBeforeSelect: async (row) => {
      // Prevent selection of locked items
      return !row.isLocked;
    }
  }
});

// Listen for any selection change
table.on('selection:change', (event) => {
  const { selected, deselected, source } = event.detail;
  console.log(`Selection changed via ${source}:`, { selected, deselected });
});

// Listen specifically for checkbox selection
table.on('checkbox:select', (event) => {
  const { row, selected } = event.detail;
  console.log('Checkbox clicked:', row, selected);
});

// Listen for row click selection
table.on('row:clickselect', (event) => {
  const { row, selected } = event.detail;
  console.log('Row clicked for selection:', row, selected);
});

// Listen for raw row clicks (regardless of selection)
table.on('row:click', (event) => {
  const { row, event: clickEvent } = event.detail;
  // Handle row click (e.g., show details panel)
});
```

## Selection API

The selection API provides methods for programmatic control of row selection:

```typescript
interface FlTable {
  // ... existing methods ...

  // Selection Methods
  selectRow(row: any, options?: SelectionOptions): void;
  deselectRow(row: any, options?: SelectionOptions): void;
  selectRows(rows: any[], options?: SelectionOptions): void;
  deselectRows(rows: any[], options?: SelectionOptions): void;
  selectAll(options?: SelectionOptions): void;
  deselectAll(options?: SelectionOptions): void;
  isSelected(row: any): boolean;
  getSelectedRows(): any[];

  // Selection options
  interface SelectionOptions {
    silent?: boolean;      // Don't trigger events (default: false)
    source?: string;       // Custom source identifier for events
  }
}
```

## Public API

### Methods

```typescript
interface FlTable {
  // Data Methods
  setData(data: any[]): void;
  getData(): any[];
  getSelectedRows(): any[];

  // Selection Methods
  selectRow(row: any): void;
  deselectRow(row: any): void;
  selectAll(): void;
  deselectAll(): void;

  // Template Methods
  addTemplate(name: string, template: HandlebarsTemplateDelegate): void;
  removeTemplate(name: string): void;

  // Search Methods
  search(term: string): void;
  clearSearch(): void;

  // Sort Methods
  sort(column: string, direction?: 'asc' | 'desc'): void;

  // Pagination Methods
  setPage(page: number): void;
  setPageSize(size: number): void;

  // Event Methods
  on(event: string, handler: (event: CustomEvent) => void): void;
  off(event: string, handler: (event: CustomEvent) => void): void;

  // Lifecycle Methods
  destroy(): void;
}
```

## CSS Classes

FlTable provides a set of CSS classes for styling. All classes are prefixed with `fl-table-` to avoid conflicts.

```css
.fl-table-wrapper {}           /* Main container */
.fl-table {}                   /* Table element */
.fl-table-header {}           /* Header row */
.fl-table-body {}            /* Table body */
.fl-table-row {}             /* Data row */
.fl-table-cell {}            /* Table cell */
.fl-table-sortable {}        /* Sortable column header */
.fl-table-sorted-asc {}      /* Column sorted ascending */
.fl-table-sorted-desc {}     /* Column sorted descending */
.fl-table-selected {}        /* Selected row */
.fl-table-checkbox {}        /* Checkbox cell */
.fl-table-empty {}           /* Empty state */
.fl-table-loading {}         /* Loading state */
.fl-table-search {}          /* Search input container */
.fl-table-pagination {}      /* Pagination container */
```

## Examples

### Basic Table with Selection

```javascript
const table = new FlTable({
  target: '#table',
  selectable: true,
  multiSelect: true,
  columns: [
    {
      name: 'Name',
      field: 'name',
      sortable: true,
      template: 'name-cell'
    },
    {
      name: 'Type',
      field: 'type',
      template: 'type-cell'
    },
    {
      name: 'Actions',
      template: 'action-cell'
    }
  ],
  templates: {
    'name-cell': Handlebars.compile(`
      <div class="fl-table-name-cell">
        {{#if icon}}<i class="icon {{icon}}"></i>{{/if}}
        <span>{{name}}</span>
      </div>
    `),
    'type-cell': Handlebars.compile(`
      <span class="fl-table-type-badge {{type}}">{{type}}</span>
    `),
    'action-cell': Handlebars.compile(`
      <div class="fl-table-actions">
        <button onclick="handleEdit('{{id}}')">Edit</button>
        <button onclick="handleDelete('{{id}}')">Delete</button>
      </div>
    `)
  }
});

// Handle selection changes
table.on('row:select', (event) => {
  const { row, selected } = event.detail;
  updateUI(table.getSelectedRows());
});

// Handle double-click
table.on('row:doubleclick', (event) => {
  const { row } = event.detail;
  openEditor(row);
});
```

### Search and Pagination

```javascript
const table = new FlTable({
  target: '#table',
  searchable: true,
  pagination: {
    pageSize: 20,
    pageSizes: [10, 20, 50, 100]
  },
  columns: [
    { name: 'Name', field: 'name', sortable: true, searchable: true },
    { name: 'Email', field: 'email', searchable: true },
    { name: 'Role', field: 'role' }
  ]
});

// Custom search implementation
table.on('search:input', async (event) => {
  const { term } = event.detail;
  const results = await searchAPI(term);
  table.setData(results);
});

// Handle page changes
table.on('page:change', (event) => {
  const { page, pageSize } = event.detail;
  loadData(page, pageSize);
});
```

### Dynamic Templates

```javascript
const table = new FlTable({
  target: '#table',
  columns: [
    {
      name: 'File',
      field: 'name',
      templateSelector: (row) => {
        if (row.type === 'image') return 'image-cell';
        if (row.type === 'document') return 'document-cell';
        return 'default-cell';
      }
    }
  ],
  templates: {
    'image-cell': Handlebars.compile(`
      <div class="fl-table-file-cell">
        <img src="{{thumbnail}}" alt="{{name}}" />
        <span>{{name}}</span>
      </div>
    `),
    'document-cell': Handlebars.compile(`
      <div class="fl-table-file-cell">
        <i class="icon-document"></i>
        <span>{{name}}</span>
      </div>
    `),
    'default-cell': Handlebars.compile(`
      <div class="fl-table-file-cell">
        <span>{{name}}</span>
      </div>
    `)
  }
});
```

## Best Practices

1. **Template Management**
   - Keep templates focused on presentation
   - Use template selectors for dynamic template selection
   - Register all templates during initialization when possible

2. **Event Handling**
   - Use event delegation for dynamic content
   - Remove event listeners when destroying the table
   - Keep event handlers lightweight

3. **Performance**
   - Use pagination for large datasets
   - Implement virtual scrolling for very large datasets
   - Minimize DOM updates during sorting/filtering

4. **Accessibility**
   - Use ARIA attributes for better screen reader support
   - Ensure keyboard navigation works
   - Maintain proper focus management

5. **Styling**
   - Use provided CSS classes for consistency
   - Override styles using CSS custom properties when possible
   - Follow BEM naming convention for custom styles

## Browser Support

FlTable supports all modern browsers:

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and contribution guidelines.

## License

MIT License - see [LICENSE](./LICENSE) for details.
