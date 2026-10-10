import Book from '../models/Book.js';
import Transaction from '../models/Transaction.js';

// @desc    Get all books with optional search, category filter, availability filter
// @route   GET /api/books
export const getAllBooks = async (req, res, next) => {
  try {
    const { search, category, status, sortBy = 'createdAt', order = 'desc' } = req.query;

    const query = {};

    // Search by title, author, or ISBN
    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: searchRegex },
        { author: searchRegex },
        { isbn: searchRegex },
        { publisher: searchRegex },
      ];
    }

    // Filter by category
    if (category && category !== 'All' && category.trim() !== '') {
      query.category = category;
    }

    // Filter by availability
    if (status === 'available') {
      query.availableQuantity = { $gt: 0 };
    } else if (status === 'out_of_stock') {
      query.availableQuantity = 0;
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const books = await Book.find(query).sort({ [sortBy]: sortOrder });

    res.json({
      success: true,
      count: books.length,
      data: books,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single book by ID
// @route   GET /api/books/:id
export const getBookById = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    // Fetch active borrowings for this book
    const activeTransactions = await Transaction.find({
      book: book._id,
      status: { $in: ['ISSUED', 'OVERDUE'] },
    }).populate('member', 'name email memberCode phone');

    res.json({
      success: true,
      data: {
        ...book.toJSON(),
        activeTransactions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new book
// @route   POST /api/books
export const createBook = async (req, res, next) => {
  try {
    const {
      title,
      isbn,
      author,
      category,
      publisher,
      publicationYear,
      quantity,
      description,
      rackLocation,
    } = req.body;

    const totalQty = parseInt(quantity, 10) || 1;
    if (totalQty < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
    }

    const existingIsbn = await Book.findOne({ isbn: isbn.trim().toUpperCase() });
    if (existingIsbn) {
      return res.status(400).json({
        success: false,
        message: `Book with ISBN ${isbn} already exists (${existingIsbn.title})`,
      });
    }

    const book = await Book.create({
      title: title.trim(),
      isbn: isbn.trim().toUpperCase(),
      author: author.trim(),
      category: category ? category.trim() : 'General',
      publisher: publisher ? publisher.trim() : 'Independent',
      publicationYear: parseInt(publicationYear, 10),
      quantity: totalQty,
      availableQuantity: totalQty,
      description: description ? description.trim() : '',
      rackLocation: rackLocation ? rackLocation.trim() : 'General Shelf',
    });

    res.status(201).json({
      success: true,
      message: 'Book created successfully',
      data: book,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update book details
// @route   PUT /api/books/:id
export const updateBook = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    const {
      title,
      isbn,
      author,
      category,
      publisher,
      publicationYear,
      quantity,
      description,
      rackLocation,
    } = req.body;

    // Check ISBN collision if changed
    if (isbn && isbn.trim().toUpperCase() !== book.isbn) {
      const existing = await Book.findOne({ isbn: isbn.trim().toUpperCase() });
      if (existing && existing._id.toString() !== book._id.toString()) {
        return res.status(400).json({
          success: false,
          message: `ISBN ${isbn} is already assigned to another book`,
        });
      }
      book.isbn = isbn.trim().toUpperCase();
    }

    // Handle quantity changes safely
    if (quantity !== undefined) {
      const newTotal = parseInt(quantity, 10);
      if (newTotal < 1) {
        return res.status(400).json({ success: false, message: 'Total quantity must be at least 1' });
      }

      const currentlyIssued = book.quantity - book.availableQuantity;
      if (newTotal < currentlyIssued) {
        return res.status(400).json({
          success: false,
          message: `Cannot decrease total quantity to ${newTotal}. There are currently ${currentlyIssued} copies issued to members.`,
        });
      }

      const diff = newTotal - book.quantity;
      book.quantity = newTotal;
      book.availableQuantity = book.availableQuantity + diff;
    }

    if (title) book.title = title.trim();
    if (author) book.author = author.trim();
    if (category) book.category = category.trim();
    if (publisher) book.publisher = publisher.trim();
    if (publicationYear) book.publicationYear = parseInt(publicationYear, 10);
    if (description !== undefined) book.description = description.trim();
    if (rackLocation !== undefined) book.rackLocation = rackLocation.trim();

    const updatedBook = await book.save();

    res.json({
      success: true,
      message: 'Book updated successfully',
      data: updatedBook,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete book
// @route   DELETE /api/books/:id
export const deleteBook = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    // Check if copies are currently issued
    const issuedCopies = book.quantity - book.availableQuantity;
    const activeLoans = await Transaction.countDocuments({
      book: book._id,
      status: { $in: ['ISSUED', 'OVERDUE'] },
    });

    if (issuedCopies > 0 || activeLoans > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete '${book.title}'. ${Math.max(
          issuedCopies,
          activeLoans
        )} copy/copies are currently issued to members. Please return them first.`,
      });
    }

    await Book.findByIdAndDelete(req.params.id);

    // Also clean up any past returned transactions if desired, or keep history
    res.json({
      success: true,
      message: `Book '${book.title}' was deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get list of unique categories
// @route   GET /api/books/categories
export const getCategories = async (req, res, next) => {
  try {
    const categories = await Book.distinct('category');
    res.json({
      success: true,
      data: categories.filter(Boolean),
    });
  } catch (error) {
    next(error);
  }
};
