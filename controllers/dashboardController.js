import Book from '../models/Book.js';
import Member from '../models/Member.js';
import Transaction from '../models/Transaction.js';

// @desc    Get comprehensive dashboard metrics and analytics
// @route   GET /api/dashboard/stats
export const getDashboardStats = async (req, res, next) => {
  try {
    const now = new Date();

    // Books aggregation: total copies, unique titles, available copies
    const booksAgg = await Book.aggregate([
      {
        $group: {
          _id: null,
          totalTitles: { $sum: 1 },
          totalCopies: { $sum: '$quantity' },
          availableCopies: { $sum: '$availableQuantity' },
        },
      },
    ]);

    const totalTitles = booksAgg[0]?.totalTitles || 0;
    const totalCopies = booksAgg[0]?.totalCopies || 0;
    const availableCopies = booksAgg[0]?.availableCopies || 0;
    const issuedCopies = Math.max(0, totalCopies - availableCopies);

    // Members counts
    const totalMembers = await Member.countDocuments();
    const activeMembers = await Member.countDocuments({ status: 'Active' });

    // Active borrowings count
    const activeIssuedCount = await Transaction.countDocuments({
      status: { $in: ['ISSUED', 'OVERDUE'] },
    });

    // Overdue count
    const overdueCount = await Transaction.countDocuments({
      status: { $in: ['ISSUED', 'OVERDUE'] },
      dueDate: { $lt: now },
    });

    // Category distribution
    const categoryStats = await Book.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          copies: { $sum: '$quantity' },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Recent 5 transactions
    const recentTransactions = await Transaction.find()
      .populate('book', 'title isbn author category')
      .populate('member', 'name email memberCode')
      .sort({ createdAt: -1 })
      .limit(6);

    // Total returned count
    const totalReturned = await Transaction.countDocuments({ status: 'RETURNED' });

    const isCloud = Boolean(
      process.env.MONGODB_URI && process.env.MONGODB_URI.includes('mongodb+srv')
    );
    const dbType = process.env.MONGODB_URI
      ? isCloud
        ? 'MongoDB Atlas (Cloud)'
        : 'Local MongoDB'
      : 'Embedded In-Memory MongoDB';

    res.json({
      success: true,
      data: {
        totalBooks: totalCopies,
        totalTitles,
        availableBooks: availableCopies,
        issuedBooks: issuedCopies || activeIssuedCount,
        totalMembers,
        activeMembers,
        overdueCount,
        totalReturned,
        categoryStats,
        recentTransactions,
        dbInfo: {
          type: dbType,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
