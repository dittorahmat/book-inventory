## Purpose

Mengatur perilaku pencarian siswa di portal publik orang tua ketika hasil kosong, agar pengguna membuat keputusan sadar lewat modal konfirmasi sebelum masuk ke pendaftaran murid baru.

## ADDED Requirements

### Requirement: Empty search result opens confirmation dialog

The system SHALL show a confirmation dialog when a parent public-portal student search completes with zero results, instead of automatically switching to the new-student form.

#### Scenario: Zero results trigger dialog and stay on search step
- **WHEN** parent submits a search query (min 2 chars) and `searchStudents` returns an empty list
- **THEN** the system keeps the user on Step 1 search mode, preserves the query text, clears displayed results, and opens the `Data Tidak Ditemukan` dialog echoing the trimmed query.

#### Scenario: Non-empty results never trigger dialog
- **WHEN** parent submits a search query and `searchStudents` returns one or more students
- **THEN** the system shows the result list as today and does NOT open the dialog.

### Requirement: Deferred new-student prefill

The system SHALL only prefill the new-student name after the user explicitly confirms creation from the dialog.

#### Scenario: Prefill happens on confirm
- **WHEN** user clicks `Buat Siswa Baru` in the dialog
- **THEN** the system closes the dialog, enters new-student mode, and prefills the name field with the trimmed search query.

#### Scenario: No silent prefill on search
- **WHEN** a search returns zero results and the dialog is still open (or dismissed via Batal / Ubah Kata Kunci)
- **THEN** the system MUST NOT enter new-student mode and MUST NOT modify the new-student form values.

### Requirement: Batal dismisses dialog and stays on search

The system SHALL treat `Batal`, the close (X) button, and backdrop/Esc dismissal as cancellation that returns the user to the search step untouched.

#### Scenario: Cancel keeps query intact
- **WHEN** user clicks `Batal` (or X / backdrop / Esc)
- **THEN** the dialog closes, the user stays on Step 1 search mode, the search query text is preserved, and no new-student form is shown.

### Requirement: Ubah Kata Kunci refocuses search input

The system SHALL provide an `Ubah Kata Kunci` action that closes the dialog and returns keyboard focus to the search input so the parent can correct typos.

#### Scenario: Edit keyword refocuses input
- **WHEN** user clicks `Ubah Kata Kunci` in the dialog
- **THEN** the dialog closes, the user stays on Step 1 search mode with the query preserved, and focus moves to the search text input.

### Requirement: Dialog copy and accessibility

The system SHALL present the dialog with an explicit title, the searched keyword echo, anti-duplicate guidance, three labeled actions, and accessible modal semantics.

#### Scenario: Dialog content is complete and accessible
- **WHEN** the dialog is open
- **THEN** it shows title `Siswa Tidak Ditemukan`, the quoted query, guidance text reminding parents to check spelling before creating new data to avoid duplicates, buttons `Batal` / `Ubah Kata Kunci` / `Buat Siswa Baru`, exposes `role="dialog"` with `aria-modal="true"` and an `aria-label`/`aria-labelledby`, traps focus while open, and closes on Esc.

#### Scenario: Dialog state never leaks across flows
- **WHEN** the user resets the order flow or switches between the `order` and `return` portal tabs
- **THEN** any open dialog state is cleared along with search results and errors.
