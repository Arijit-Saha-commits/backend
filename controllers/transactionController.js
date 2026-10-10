import Transaction from '../models/Transaction.js';
import Book from '../models/Book.js';
import Member from '../models/Member.js';

// @desc    Issue a book to a member
// @route   POST /api/transactions/issue
export const issueBook = async (req, res, next) => {
  try {
    const { bookId, memberId, dueDate, remarks } = req.body;

    if (!bookId || !memberId) {
      return res.status(400).json({
        success: false,
        message: 'Both Book ID and Member ID are required',
      });
    }

    // Check book availability
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    if (book.availableQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: `Book '${book.title}' is currently out of stock. Total: ${book.quantity}, Available: 0.`,
      });
    }

    // Check member status and limits
    const member = await Member.findById(memberId);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    if (member.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: `Member account is ${member.status}. Only Active members can borrow books.`,
      });
    }

    const currentBorrows = await Transaction.countDocuments({
      member: member._id,
      status: { $in: ['ISSUED', 'OVERDUE'] },
    });

    if (currentBorrows >= member.maxBorrowLimit) {
      return res.status(400).json({
        success: false,
        message: `Member has reached the maximum borrowing limit of ${member.maxBorrowLimit} books.`,
      });
    }

    // Check if the member already holds a copy of this book
    const existingBorrow = await Transaction.findOne({
      member: member._id,
      book: book._id,
      status: { $in: ['ISSUED', 'OVERDUE'] },
    });

    if (existingBorrow) {
      return res.status(400).json({
        success: false,
        message: `Member '${member.name}' already has an active borrowed copy of '${book.title}'.`,
      });
    }

    // Determine due date (default to 14 days from now if not provided)
    const issueDate = new Date();
    let calculatedDueDate;
    if (dueDate) {
      calculatedDueDate = new Date(dueDate);
      if (isNaN(calculatedDueDate.getTime()) || calculatedDueDate <= issueDate) {
        return res.status(400).json({
          success: false,
          message: 'Due date must be a valid future date',
        });
      }
    } else {
      calculatedDueDate = new Date(issueDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    }

    // Create transaction
    const transaction = await Transaction.create({
      book: book._id,
      member: member._id,
      issueDate,
      dueDate: calculatedDueDate,
      status: 'ISSUED',
      remarks: remarks ? remarks.trim() : '',
    });

    // Update Book and Member
    book.availableQuantity = Math.max(0, book.availableQuantity - 1);
    await book.save();

    member.activeBorrowsCount = currentBorrows + 1;
    await member.save();

    const populatedTransaction = await Transaction.findById(transaction._id)
      .populate('book', 'title isbn author category')
      .populate('member', 'name email memberCode phone');

    res.status(201).json({
      success: true,
      message: `Book '${book.title}' successfully issued to ${member.name}`,
      data: populatedTransaction,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Return a borrowed book
// @route   POST /api/transactions/return/:id
export const returnBook = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { returnDate, remarks, fineAmount } = req.body;

    const transaction = await Transaction.findById(id)
      .populate('book')
      .populate('member');

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.status === 'RETURNED') {
      return res.status(400).json({
        success: false,
        message: 'This book has already been returned.',
      });
    }

    const actualReturnDate = returnDate ? new Date(returnDate) : new Date();

    // Calculate fine if overdue
    let calculatedFine = 0;
    if (actualReturnDate > transaction.dueDate) {
      const diffTime = actualReturnDate - new Date(transaction.dueDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      calculatedFine = diffDays * 2; // $2 per day
    }

    transaction.returnDate = actualReturnDate;
    transaction.status = 'RETURNED';
    transaction.fineAmount = fineAmount !== undefined ? Number(fineAmount) : calculatedFine;
    if (remarks) {
      transaction.remarks = remarks.trim();
    }

    await transaction.save();

    // Increment book available quantity
    if (transaction.book) {
      const book = await Book.findById(transaction.book._id);
      if (book) {
        book.availableQuantity = Math.min(book.quantity, book.availableQuantity + 1);
        await book.save();
      }
    }

    // Decrement member active borrows
    if (transaction.member) {
      const member = await Member.findById(transaction.member._id);
      if (member) {
        member.activeBorrowsCount = Math.max(0, (member.activeBorrowsCount || 1) - 1);
        await member.save();
      }
    }

    res.json({
      success: true,
      message: `Book '${transaction.book?.title || 'Book'}' successfully returned`,
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all transactions with filtering and search
// @route   GET /api/transactions
export const getAllTransactions = async (req, res, next) => {
  try {
    const { status, memberId, bookId, search, limit = 50 } = req.query;

    const query = {};

    if (status && status !== 'All') {
      query.status = status;
    }

    if (memberId) {
      query.member = memberId;
    }

    if (bookId) {
      query.book = bookId;
    }

    // Find and populate
    let transactions = await Transaction.find(query)
      .populate('book', 'title isbn author category publisher rackLocation')
      .populate('member', 'name email memberCode phone status')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    // Update overdue status on-the-fly for any currently issued items
    const now = new Date();
    transactions = await Promise.all(
      transactions.map(async (tx) => {
        if (tx.status === 'ISSUED' && now > tx.dueDate) {
          tx.status = 'OVERDUE';
          const overdueDays = Math.ceil((now - tx.dueDate) / (1000 * 60 * 60 * 24));
          tx.fineAmount = overdueDays * 2;
          await tx.save();
        }
        return tx;
      })
    );

    // Filter by search query across book or member info if provided
    if (search && search.trim() !== '') {
      const term = search.trim().toLowerCase();
      transactions = transactions.filter((tx) => {
        const bookTitle = tx.book?.title?.toLowerCase() || '';
        const bookIsbn = tx.book?.isbn?.toLowerCase() || '';
        const bookAuthor = tx.book?.author?.toLowerCase() || '';
        const memberName = tx.member?.name?.toLowerCase() || '';
        const memberEmail = tx.member?.email?.toLowerCase() || '';
        const memberCode = tx.member?.memberCode?.toLowerCase() || '';

        return (
          bookTitle.includes(term) ||
          bookIsbn.includes(term) ||
          bookAuthor.includes(term) ||
          memberName.includes(term) ||
          memberEmail.includes(term) ||
          memberCode.includes(term)
        );
      });
    }

    res.json({
      success: true,
      count: transactions.length,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get overdue transactions
// @route   GET /api/transactions/overdue
export const getOverdueTransactions = async (req, res, next) => {
  try {
    const now = new Date();

    const overdueList = await Transaction.find({
      status: { $in: ['ISSUED', 'OVERDUE'] },
      dueDate: { $lt: now },
    })
      .populate('book', 'title isbn author category')
      .populate('member', 'name email memberCode phone')
      .sort({ dueDate: 1 });

    const enriched = overdueList.map((tx) => {
      const overdueDays = Math.ceil((now - new Date(tx.dueDate)) / (1000 * 60 * 60 * 24));
      const fine = overdueDays * 2;
      return {
        ...tx.toJSON(),
        overdueDays,
        suggestedFine: fine,
      };
    });

    res.json({
      success: true,
      count: enriched.length,
      data: enriched,
    });
  } catch (error) {
    next(error);
  }
};
