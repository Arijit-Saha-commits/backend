import Member from '../models/Member.js';
import Transaction from '../models/Transaction.js';

// Helper to generate member code
const generateMemberCode = async () => {
  const count = await Member.countDocuments();
  const num = (count + 101).toString().padStart(4, '0');
  let code = `MEM-${num}`;
  let exists = await Member.findOne({ memberCode: code });
  while (exists) {
    const random = Math.floor(1000 + Math.random() * 9000);
    code = `MEM-${random}`;
    exists = await Member.findOne({ memberCode: code });
  }
  return code;
};

// @desc    Get all members with search and status filtering
// @route   GET /api/members
export const getAllMembers = async (req, res, next) => {
  try {
    const { search, status, sortBy = 'createdAt', order = 'desc' } = req.query;

    const query = {};

    if (search && search.trim() !== '') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { memberCode: searchRegex },
      ];
    }

    if (status && status !== 'All' && status.trim() !== '') {
      query.status = status;
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const members = await Member.find(query).sort({ [sortBy]: sortOrder });

    res.json({
      success: true,
      count: members.length,
      data: members,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single member by ID along with their transactions
// @route   GET /api/members/:id
export const getMemberById = async (req, res, next) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const transactions = await Transaction.find({ member: member._id })
      .populate('book', 'title isbn author category')
      .sort({ issueDate: -1 });

    res.json({
      success: true,
      data: {
        ...member.toJSON(),
        transactions,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new library member
// @route   POST /api/members
export const createMember = async (req, res, next) => {
  try {
    const { name, email, phone, memberCode, membershipType, address, status, maxBorrowLimit } =
      req.body;

    const existingEmail = await Member.findOne({ email: email.trim().toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: `Member with email ${email} already exists`,
      });
    }

    let code = memberCode ? memberCode.trim().toUpperCase() : await generateMemberCode();

    const existingCode = await Member.findOne({ memberCode: code });
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: `Member Code ${code} is already in use`,
      });
    }

    const member = await Member.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      memberCode: code,
      membershipType: membershipType || 'General',
      address: address ? address.trim() : '',
      status: status || 'Active',
      maxBorrowLimit: maxBorrowLimit ? parseInt(maxBorrowLimit, 10) : 5,
    });

    res.status(201).json({
      success: true,
      message: 'Member created successfully',
      data: member,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update member details
// @route   PUT /api/members/:id
export const updateMember = async (req, res, next) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    const { name, email, phone, memberCode, membershipType, address, status, maxBorrowLimit } =
      req.body;

    if (email && email.trim().toLowerCase() !== member.email) {
      const existing = await Member.findOne({ email: email.trim().toLowerCase() });
      if (existing && existing._id.toString() !== member._id.toString()) {
        return res.status(400).json({
          success: false,
          message: `Email ${email} is already taken by another member`,
        });
      }
      member.email = email.trim().toLowerCase();
    }

    if (memberCode && memberCode.trim().toUpperCase() !== member.memberCode) {
      const existingCode = await Member.findOne({ memberCode: memberCode.trim().toUpperCase() });
      if (existingCode && existingCode._id.toString() !== member._id.toString()) {
        return res.status(400).json({
          success: false,
          message: `Member Code ${memberCode} is already assigned to another member`,
        });
      }
      member.memberCode = memberCode.trim().toUpperCase();
    }

    if (name) member.name = name.trim();
    if (phone) member.phone = phone.trim();
    if (membershipType) member.membershipType = membershipType;
    if (address !== undefined) member.address = address.trim();
    if (status) member.status = status;
    if (maxBorrowLimit !== undefined) member.maxBorrowLimit = parseInt(maxBorrowLimit, 10);

    const updated = await member.save();

    res.json({
      success: true,
      message: 'Member updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a member
// @route   DELETE /api/members/:id
export const deleteMember = async (req, res, next) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    // Check if member has active borrows
    const activeBorrows = await Transaction.countDocuments({
      member: member._id,
      status: { $in: ['ISSUED', 'OVERDUE'] },
    });

    if (activeBorrows > 0 || (member.activeBorrowsCount || 0) > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete member '${member.name}'. They still have ${Math.max(
          activeBorrows,
          member.activeBorrowsCount || 0
        )} book(s) issued. Please return the books first.`,
      });
    }

    await Member.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: `Member '${member.name}' deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};
