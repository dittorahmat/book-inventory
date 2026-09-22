## Purpose

Provides quick and instant filtering capabilities across cataloged books by title, ISBN, author, or publisher.

## ADDED Requirements

### Requirement: Instant Search Filtering
The system SHALL provide an instant search input field on the Book Catalog interface that filters visible book titles against title, ISBN, author, and publisher attributes without requiring a page reload.

#### Scenario: User searches for a book by title or author
- **WHEN** the user types keywords into the catalog search bar
- **THEN** the book list updates dynamically to display only books whose title, ISBN, author, or publisher contains the search term (case-insensitive).

#### Scenario: User clears search query
- **WHEN** the user clears the search input field
- **THEN** all books in the catalog are restored and displayed.
