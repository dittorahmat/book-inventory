## Purpose

Provides central book catalog management including metadata (title, author, publisher, ISBN) and cover image storage via S3/R2 compatible object storage.

## ADDED Requirements

### Requirement: Book catalog entry creation
The system SHALL allow authorized users to create and update book catalog records containing ISBN, title, author, publisher, and publication year.

#### Scenario: Creating a valid book catalog item
- **WHEN** an admin submits a book form with valid ISBN, title, and metadata
- **THEN** the book record is saved to the central catalog and ready for physical copy generation

### Requirement: Book cover image upload
The system SHALL allow uploading and associating cover images with book records, storing files in R2/S3 storage.

#### Scenario: Uploading cover image
- **WHEN** an admin uploads an image file (JPEG, PNG, or WebP) for a book
- **THEN** the system stores the file in object storage and saves the public/signed URL or object key in the book record
