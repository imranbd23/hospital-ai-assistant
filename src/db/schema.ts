import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Define the 'users' table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  fullName: text('full_name'),
  role: text('role'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Define the 'pdf_metadata' table
export const pdfMetadata = pgTable('pdf_metadata', {
  id: serial('id').primaryKey(),
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: text('mime_type').notNull(),
  userId: integer('user_id').references(() => users.id),
  uploadedAt: timestamp('uploaded_at').defaultNow(),
});

// Define relationships
export const usersRelations = relations(users, ({ many }) => ({
  pdfs: many(pdfMetadata),
}));

export const pdfMetadataRelations = relations(pdfMetadata, ({ one }) => ({
  user: one(users, {
    fields: [pdfMetadata.userId],
    references: [users.id],
  }),
}));
