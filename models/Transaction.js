import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      required: [true, 'Book reference is required'],
    },
    member: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Member',
      required: [true, 'Member reference is required'],
    },
    issueDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
    },
    returnDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['ISSUED', 'RETURNED', 'OVERDUE'],
      default: 'ISSUED',
    },
    fineAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Method to check and update overdue status dynamically
transactionSchema.methods.updateOverdueStatus = function () {
  if (this.status === 'ISSUED' && new Date() > this.dueDate) {
    this.status = 'OVERDUE';
    const overdueDays = Math.ceil((new Date() - this.dueDate) / (1000 * 60 * 60 * 24));
    this.fineAmount = overdueDays * 2; // $2 or 2 currency units per day overdue
  }
  return this;
};

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
