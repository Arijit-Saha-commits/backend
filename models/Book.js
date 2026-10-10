import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Book title is required'],
      trim: true,
      minlength: [1, 'Title cannot be empty'],
    },
    isbn: {
      type: String,
      required: [true, 'ISBN is required'],
      unique: true,
      trim: true,
      uppercase: true,
    },
    author: {
      type: String,
      required: [true, 'Author name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      default: 'General',
    },
    publisher: {
      type: String,
      required: [true, 'Publisher is required'],
      trim: true,
    },
    publicationYear: {
      type: Number,
      required: [true, 'Publication year is required'],
      min: [1000, 'Invalid publication year'],
      max: [new Date().getFullYear() + 1, 'Publication year cannot be in the far future'],
    },
    quantity: {
      type: Number,
      required: [true, 'Total quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      default: 1,
    },
    availableQuantity: {
      type: Number,
      required: [true, 'Available quantity is required'],
      min: [0, 'Available quantity cannot be negative'],
      default: 1,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    rackLocation: {
      type: String,
      trim: true,
      default: 'General Shelf',
    },
  },
  {
    timestamps: true,
  }
);

// Virtual field for borrowed copies
bookSchema.virtual('borrowedQuantity').get(function () {
  return this.quantity - this.availableQuantity;
});

// Ensure virtuals are serialized in JSON
bookSchema.set('toJSON', { virtuals: true });
bookSchema.set('toObject', { virtuals: true });

const Book = mongoose.model('Book', bookSchema);
export default Book;
