# Requirements Document

## Introduction

This feature adds bulk upload support to the Work Allocation module in the SkyCity application. Administrators and managers can upload a CSV or Excel (.xlsx) file containing multiple work allocation rows, preview the parsed data before submission, and create all valid allocations in a single API call. The feature mirrors the existing bulk upload pattern used in Property Management and follows the same backend convention established by `POST /works/bulk`.

## Glossary

- **BulkUpload_UI**: The React component that renders the bulk upload dialog on the Work Allocation admin page.
- **BulkUpload_API**: The `POST /workallocations/bulk` ASP.NET Core endpoint that accepts and persists a list of allocation rows.
- **BulkUploadRow**: A single data row parsed from the uploaded file, containing the fields required to create one WorkAllocation record.
- **Template_File**: A downloadable CSV or Excel file that shows the expected column headers and sample data for a valid bulk upload.
- **WorkCategory**: An existing entity (`WorkCategory`) identified by `workCode` or `workTitle`, used to resolve the `WorkId` foreign key.
- **AssignedUser**: An existing `User` record within the same association, identified by `username` or `fullName`, used to resolve the `AssignedTo` foreign key.
- **AssociationId**: The association identifier extracted from the authenticated user's JWT claims, used to scope all lookups and created records.
- **BulkResult**: The summary object returned by the API and displayed in the UI, containing counts of successfully created and failed rows along with per-row error messages.
- **Parser**: The client-side module that reads a CSV or Excel file and converts it into an array of `BulkUploadRow` objects.
- **Pretty_Printer**: The client-side module that generates a downloadable Template_File from a fixed schema definition.

---

## Requirements

### Requirement 1: Template File Download

**User Story:** As an administrator, I want to download a pre-formatted template file, so that I can fill in work allocation data in the correct format before uploading.

#### Acceptance Criteria

1. THE BulkUpload_UI SHALL provide a "Download Template" button that is visible before any file is selected.
2. WHEN the user clicks "Download Template", THE Pretty_Printer SHALL generate and download an Excel (.xlsx) file named `work_allocation_bulk_upload_template.xlsx`.
3. THE Pretty_Printer SHALL include the following column headers in the template, in order: `title`, `workCode`, `workTitle`, `assignedTo`, `priority`, `dueDate`, `description`.
4. THE Pretty_Printer SHALL include at least one sample data row in the template to illustrate the expected format.
5. WHERE the user prefers CSV, THE BulkUpload_UI SHALL also provide a "Download CSV Template" option that downloads a file named `work_allocation_bulk_upload_template.csv` with the same column headers and sample row.

---

### Requirement 2: File Upload and Parsing

**User Story:** As an administrator, I want to upload a CSV or Excel file containing work allocation rows, so that the system can parse and preview the data before I submit it.

#### Acceptance Criteria

1. THE BulkUpload_UI SHALL accept files with the extensions `.csv`, `.xlsx`, and `.xls`.
2. WHEN a `.csv` file is selected, THE Parser SHALL read the file as UTF-8 text and parse each non-header row into a `BulkUploadRow`.
3. WHEN an `.xlsx` or `.xls` file is selected, THE Parser SHALL read the file as an ArrayBuffer using the `xlsx` library and parse each non-header row into a `BulkUploadRow`.
4. THE Parser SHALL treat the first row as a header row WHEN the first cell of that row matches any of the expected column names (case-insensitive).
5. THE Parser SHALL map columns by name (case-insensitive) and SHALL also support positional mapping as a fallback WHEN named headers are absent.
6. IF a selected file has an extension other than `.csv`, `.xlsx`, or `.xls`, THEN THE BulkUpload_UI SHALL display an error message "Unsupported file type. Please upload a CSV or Excel file." and SHALL NOT attempt to parse the file.
7. IF the parsed file contains zero data rows after header detection, THEN THE BulkUpload_UI SHALL display the message "No data rows found in the uploaded file."
8. FOR ALL valid CSV files, parsing then formatting then parsing SHALL produce an equivalent set of `BulkUploadRow` objects (round-trip property).

---

### Requirement 3: Preview Table

**User Story:** As an administrator, I want to see a preview of the parsed rows before submitting, so that I can verify the data is correct.

#### Acceptance Criteria

1. WHEN a file is successfully parsed and contains at least one row, THE BulkUpload_UI SHALL display a preview table showing all parsed rows.
2. THE BulkUpload_UI SHALL display the following columns in the preview table: `Title`, `Work Code / Title`, `Assigned To`, `Priority`, `Due Date`, `Description`.
3. WHILE the preview table is visible, THE BulkUpload_UI SHALL display the total row count above the table (e.g., "X rows ready to upload").
4. THE BulkUpload_UI SHALL allow the user to clear the selected file and preview by clicking a "Clear" or "Remove" control, resetting the dialog to its initial state.

---

### Requirement 4: Bulk Upload Submission (Frontend)

**User Story:** As an administrator, I want to submit the previewed rows to the server in one action, so that all valid allocations are created without manual entry.

#### Acceptance Criteria

1. WHEN the user clicks the "Upload" submit button, THE BulkUpload_UI SHALL send a POST request to `POST /workallocations/bulk` with the array of parsed rows as the request body.
2. WHILE the upload request is in progress, THE BulkUpload_UI SHALL display a loading indicator and SHALL disable the submit button to prevent duplicate submissions.
3. WHEN the API responds with success, THE BulkUpload_UI SHALL display a `BulkResult` summary showing the count of successfully created allocations and the count of failed rows.
4. WHEN the API responds with success and at least one allocation was created, THE BulkUpload_UI SHALL invalidate the allocations query cache so the Allocation Records table refreshes automatically.
5. WHEN the API responds with one or more row-level errors, THE BulkUpload_UI SHALL display each error message in the result summary.
6. IF the API call fails with a network or server error, THEN THE BulkUpload_UI SHALL display a toast notification with the error message and SHALL NOT close the dialog.

---

### Requirement 5: Bulk Upload API Endpoint

**User Story:** As a backend system, I want a dedicated bulk endpoint for work allocations, so that multiple allocations can be created atomically from a single request.

#### Acceptance Criteria

1. THE BulkUpload_API SHALL expose the route `POST /workallocations/bulk` and SHALL require a valid JWT bearer token.
2. THE BulkUpload_API SHALL require the `work_orders` `create` permission (via the existing `[RequirePermission]` attribute).
3. WHEN a valid request body is received, THE BulkUpload_API SHALL resolve each row's `WorkId` by matching `workCode` (exact, case-insensitive) against `WorkCategory.WorkCode`, falling back to matching `workTitle` (case-insensitive) against `WorkCategory.WorkTitle`.
4. WHEN a valid request body is received, THE BulkUpload_API SHALL resolve each row's `AssignedTo` user ID by matching the `assignedTo` field (case-insensitive) against `User.Username` first, then `User.FullName`, scoped to the current `AssociationId`.
5. THE BulkUpload_API SHALL set `AssignedBy` to the `CurrentUserId` extracted from JWT claims for every created allocation.
6. THE BulkUpload_API SHALL set `AssociationId` to the `CurrentAssocId` extracted from JWT claims for every created allocation.
7. THE BulkUpload_API SHALL default `Priority` to `"medium"` WHEN the `priority` field in a row is absent or empty.
8. THE BulkUpload_API SHALL default `Status` to `"pending"` for every created allocation.
9. IF a row's `title` field is empty or whitespace, THEN THE BulkUpload_API SHALL record a row-level error for that row and SHALL skip creating an allocation for it.
10. IF a row's `dueDate` field cannot be parsed as a valid date, THEN THE BulkUpload_API SHALL record a row-level error for that row and SHALL skip creating an allocation for it.
11. IF a row's `assignedTo` value does not match any active user in the association, THEN THE BulkUpload_API SHALL record a row-level error for that row and SHALL skip creating an allocation for it.
12. IF a row's `workCode` and `workTitle` both fail to match any active `WorkCategory`, THEN THE BulkUpload_API SHALL record a row-level error for that row and SHALL skip creating an allocation for it.
13. IF the request body contains zero rows, THEN THE BulkUpload_API SHALL return HTTP 400 with the message "No allocation rows provided."
14. WHEN all valid rows have been processed, THE BulkUpload_API SHALL persist all valid allocations in a single `SaveChangesAsync` call and SHALL return HTTP 200 with a `BulkResult` containing `created`, `failed`, and `errors` fields.

---

### Requirement 6: Bulk Upload UI Entry Point

**User Story:** As an administrator, I want a clearly visible "Bulk Upload" button on the Work Allocation page, so that I can access the bulk upload dialog without navigating away.

#### Acceptance Criteria

1. THE BulkUpload_UI SHALL render a "Bulk Upload" button in the Work Allocation page header, positioned adjacent to the existing "+ Allocate New Work" button.
2. WHEN the user clicks "Bulk Upload", THE BulkUpload_UI SHALL open a modal dialog containing the bulk upload controls.
3. WHEN the dialog is closed (via cancel, backdrop click, or after a successful upload), THE BulkUpload_UI SHALL reset all internal state (selected file, parsed rows, result summary) to the initial empty state.
4. THE BulkUpload_UI SHALL render the "Bulk Upload" button on both the desktop layout and the mobile layout of the Work Allocation page.

---

### Requirement 7: Priority Validation

**User Story:** As an administrator, I want the system to accept common priority spellings and default gracefully, so that minor formatting differences in the uploaded file do not cause unnecessary failures.

#### Acceptance Criteria

1. THE BulkUpload_API SHALL accept `priority` values of `"low"`, `"medium"`, and `"high"` (case-insensitive).
2. IF a row's `priority` value is not one of the accepted values and is not empty, THEN THE BulkUpload_API SHALL default the priority to `"medium"` and SHALL NOT treat it as a row-level error.

---

### Requirement 8: Date Parsing

**User Story:** As an administrator, I want the system to accept common date formats in the uploaded file, so that I do not need to reformat dates manually.

#### Acceptance Criteria

1. THE BulkUpload_API SHALL accept `dueDate` values in ISO 8601 format (`yyyy-MM-dd` and `yyyy-MM-ddTHH:mm:ssZ`).
2. THE BulkUpload_API SHALL accept `dueDate` values in the formats `dd/MM/yyyy` and `MM/dd/yyyy`.
3. IF a `dueDate` value cannot be parsed by any of the accepted formats, THEN THE BulkUpload_API SHALL record a row-level error with the message `"Row {n}: Invalid date format for dueDate '{value}'"`.
