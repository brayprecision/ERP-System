================================================================================
                           OBSOLETE FILES ARCHIVE
                        Bray Precision Manufacturing ERP
================================================================================

This folder contains deprecated files from previous versions of the BPERP 
Dashboard system that are no longer used by the current modular implementation.

CONTENTS
--------
• index-nonmodular.html    - Original single-file version (6571 lines)
                            - All JavaScript and CSS embedded inline
                            - Replaced by modular system (index-modular.html)

CURRENT ACTIVE SYSTEM
---------------------
The BPERP Dashboard now uses a modular architecture:

Active Files:
• index-modular.html       - Main HTML entry point
• css/dashboard.css        - Centralized styling
• js/app.js               - Main application entry
• js/modules/*.js         - Modular JavaScript components
  - common.js             - Shared utilities
  - storage.js            - Data management
  - inventory.js          - Inventory functions
  - sales.js              - Sales and work orders
  - tasks.js              - Task and workflow management
  - maintenance.js        - Equipment maintenance
  - search.js             - Global search functionality

ADVANTAGES OF MODULAR SYSTEM
-----------------------------
✓ Better maintainability - Separate concerns
✓ Faster development - Individual module editing
✓ Better performance - Module lazy loading
✓ Easier debugging - Isolated functionality
✓ Team collaboration - Multiple developers can work on different modules
✓ Version control - Granular change tracking

MIGRATION HISTORY
-----------------
• v1.0 - Single file system (index.html)
• v2.0 - Modular system (index-modular.html + modules)

DO NOT DELETE
-------------
These files are kept for:
• Reference purposes
• Emergency rollback capability
• Code archaeology/debugging
• Understanding system evolution

SAFETY NOTE
-----------
If you need to restore the old system:
1. Copy index-nonmodular.html back to frontend/
2. Rename to index.html
3. Update launcher scripts to point to index.html instead of index-modular.html

================================================================================
                      Archive Date: January 15, 2026
================================================================================