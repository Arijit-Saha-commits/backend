import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Book from '../models/Book.js';
import Member from '../models/Member.js';
import Transaction from '../models/Transaction.js';
import { connectDB } from '../config/db.js';

dotenv.config();

export const seedDatabase = async () => {
  try {
    const bookCount = await Book.countDocuments();
    if (bookCount > 0) {
      console.log(`[Seed] Database already contains ${bookCount} books. Skipping initial seed.`);
      return;
    }

    console.log('[Seed] Database is empty. Seeding realistic sample data...');

    // Clear existing data just in case
    await Promise.all([
      Book.deleteMany({}),
      Member.deleteMany({}),
      Transaction.deleteMany({}),
    ]);

    // 1. Seed Books
    const booksData = [
      {
        title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
        isbn: '9780132350884',
        author: 'Robert C. Martin',
        category: 'Computers & Technology',
        publisher: 'Prentice Hall',
        publicationYear: 2008,
        quantity: 5,
        availableQuantity: 3,
        description: 'Even bad code can function. But if code isn’t clean, it can bring a development organization to its knees.',
        rackLocation: 'Tech-A1',
      },
      {
        title: 'The Pragmatic Programmer: Your Journey To Mastery',
        isbn: '9780135957059',
        author: 'David Thomas, Andrew Hunt',
        category: 'Computers & Technology',
        publisher: 'Addison-Wesley Professional',
        publicationYear: 2019,
        quantity: 4,
        availableQuantity: 3,
        description: 'One of the most significant books in software engineering, full of practical advice for developers.',
        rackLocation: 'Tech-A2',
      },
      {
        title: 'To Kill a Mockingbird',
        isbn: '9780061120084',
        author: 'Harper Lee',
        category: 'Fiction',
        publisher: 'J. B. Lippincott & Co.',
        publicationYear: 1960,
        quantity: 6,
        availableQuantity: 5,
        description: 'A timeless novel examining racism and injustice in the Deep South through the eyes of young Scout Finch.',
        rackLocation: 'Fict-B1',
      },
      {
        title: 'Atomic Habits: An Easy & Proven Way to Build Good Habits',
        isbn: '9780735211292',
        author: 'James Clear',
        category: 'Self-Help',
        publisher: 'Avery',
        publicationYear: 2018,
        quantity: 7,
        availableQuantity: 6,
        description: 'A supremely practical guide on how small changes can lead to remarkable results.',
        rackLocation: 'Self-C1',
      },
      {
        title: 'Sapiens: A Brief History of Humankind',
        isbn: '9780062316097',
        author: 'Yuval Noah Harari',
        category: 'History',
        publisher: 'Harper',
        publicationYear: 2014,
        quantity: 4,
        availableQuantity: 4,
        description: 'Explores how an insignificant ape became the ruler of planet Earth.',
        rackLocation: 'Hist-D1',
      },
      {
        title: 'Design Patterns: Elements of Reusable Object-Oriented Software',
        isbn: '9780201633610',
        author: 'Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides',
        category: 'Computers & Technology',
        publisher: 'Addison-Wesley',
        publicationYear: 1994,
        quantity: 3,
        availableQuantity: 2,
        description: 'The foundational Gang of Four guide to classic design patterns.',
        rackLocation: 'Tech-A3',
      },
      {
        title: 'Meditations',
        isbn: '9780140449334',
        author: 'Marcus Aurelius',
        category: 'Philosophy',
        publisher: 'Penguin Classics',
        publicationYear: 2006,
        quantity: 5,
        availableQuantity: 5,
        description: 'A collection of personal writings by Roman Emperor Marcus Aurelius on Stoic philosophy.',
        rackLocation: 'Phil-E1',
      },
      {
        title: 'A Brief History of Time',
        isbn: '9780553380163',
        author: 'Stephen Hawking',
        category: 'Science & Tech',
        publisher: 'Bantam Books',
        publicationYear: 1988,
        quantity: 4,
        availableQuantity: 4,
        description: 'A landmark exploration of space, time, black holes, and the cosmos.',
        rackLocation: 'Sci-F1',
      },
    ];

    const createdBooks = await Book.insertMany(booksData);
    console.log(`[Seed] Created ${createdBooks.length} sample books.`);

    // 2. Seed Members
    const membersData = [
      {
        name: 'Aarav Sharma',
        email: 'aarav.sharma@example.com',
        phone: '+91 98765 43210',
        memberCode: 'MEM-1001',
        membershipType: 'Student',
        address: 'B-14 Sector 62, Noida',
        status: 'Active',
        maxBorrowLimit: 5,
        activeBorrowsCount: 2,
      },
      {
        name: 'Priya Patel',
        email: 'priya.patel@example.com',
        phone: '+91 98123 45678',
        memberCode: 'MEM-1002',
        membershipType: 'Faculty',
        address: '42 MG Road, Bangalore',
        status: 'Active',
        maxBorrowLimit: 10,
        activeBorrowsCount: 1,
      },
      {
        name: 'Rohan Mukherjee',
        email: 'rohan.m@example.com',
        phone: '+91 97456 12345',
        memberCode: 'MEM-1003',
        membershipType: 'General',
        address: '15 Salt Lake City, Kolkata',
        status: 'Active',
        maxBorrowLimit: 3,
        activeBorrowsCount: 1,
      },
      {
        name: 'Ananya Verma',
        email: 'ananya.verma@example.com',
        phone: '+91 99001 88223',
        memberCode: 'MEM-1004',
        membershipType: 'Premium',
        address: '78 Bandra West, Mumbai',
        status: 'Active',
        maxBorrowLimit: 8,
        activeBorrowsCount: 0,
      },
    ];

    const createdMembers = await Member.insertMany(membersData);
    console.log(`[Seed] Created ${createdMembers.length} sample members.`);

    // 3. Seed Transactions (Issued, Overdue, and Returned)
    const now = new Date();
    const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
    const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const transactionsData = [
      // 1: Active Issued (Clean Code to Aarav)
      {
        book: createdBooks[0]._id,
        member: createdMembers[0]._id,
        issueDate: fourDaysAgo,
        dueDate: futureDate,
        status: 'ISSUED',
        remarks: 'Issued for college semester assignment',
      },
      // 2: Overdue (Clean Code to Rohan - 20 days ago, due 6 days ago)
      {
        book: createdBooks[0]._id,
        member: createdMembers[2]._id,
        issueDate: twentyDaysAgo,
        dueDate: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
        status: 'OVERDUE',
        fineAmount: 12, // 6 days * $2
        remarks: 'Automated reminder email sent',
      },
      // 3: Active Issued (Pragmatic Programmer to Priya)
      {
        book: createdBooks[1]._id,
        member: createdMembers[1]._id,
        issueDate: tenDaysAgo,
        dueDate: futureDate,
        status: 'ISSUED',
        remarks: 'Curriculum preparation',
      },
      // 4: Active Issued (Design Patterns to Aarav)
      {
        book: createdBooks[5]._id,
        member: createdMembers[0]._id,
        issueDate: fourDaysAgo,
        dueDate: futureDate,
        status: 'ISSUED',
        remarks: 'Study group reference',
      },
      // 5: Returned transaction (To Kill A Mockingbird to Ananya)
      {
        book: createdBooks[2]._id,
        member: createdMembers[3]._id,
        issueDate: twentyDaysAgo,
        dueDate: tenDaysAgo,
        returnDate: new Date(tenDaysAgo.getTime() - 24 * 60 * 60 * 1000), // returned on time
        status: 'RETURNED',
        fineAmount: 0,
        remarks: 'Returned in pristine condition',
      },
      // 6: Returned transaction (Atomic Habits to Rohan)
      {
        book: createdBooks[3]._id,
        member: createdMembers[2]._id,
        issueDate: twentyDaysAgo,
        dueDate: tenDaysAgo,
        returnDate: tenDaysAgo,
        status: 'RETURNED',
        fineAmount: 0,
        remarks: 'Returned on due date',
      },
    ];

    const createdTransactions = await Transaction.insertMany(transactionsData);
    console.log(`[Seed] Created ${createdTransactions.length} sample transactions.`);
    console.log('[Seed] Database initialization complete!');
  } catch (err) {
    console.error('[Seed Error]:', err);
  }
};

// If run directly via CLI (e.g. `npm run seed`)
if (process.argv[1] && process.argv[1].endsWith('seedData.js')) {
  (async () => {
    await connectDB();
    await seedDatabase();
    await mongoose.connection.close();
    process.exit(0);
  })();
}
