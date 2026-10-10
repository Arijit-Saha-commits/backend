import assert from 'assert';

const BASE_URL = 'http://localhost:5000/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function runTests() {
  console.log('🧪 Starting Comprehensive Audit & Integration Test Suite...');
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
    }
  }

  // 1. Health check & DB mode
  await test('Server Health Check & DB Persistence Mode', async () => {
    const res = await request('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'online');
    assert(res.data.database, 'Health check should contain database info');
  });

  // 2. Dashboard Stats
  await test('Dashboard Metrics Aggregation', async () => {
    const res = await request('/dashboard/stats');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(res.data.data.totalBooks > 0, 'Total books should be > 0');
    assert(res.data.data.totalMembers > 0, 'Total members should be > 0');
  });

  // 3. Books Search
  await test('Books Catalog Search & Retrieval', async () => {
    const res = await request('/books?search=Clean');
    assert.strictEqual(res.status, 200);
    assert(res.data.count >= 1, 'Should find at least 1 book matching "Clean"');
  });

  // 4. Create Book & Uniqueness
  let createdBookId = null;
  const testIsbn = '978888' + Math.floor(1000000 + Math.random() * 9000000);
  await test('Create Book & Unique ISBN Validation', async () => {
    const newBook = {
      title: 'The Pragmatic Architect',
      isbn: testIsbn,
      author: 'Jane Architect',
      category: 'Computers & Technology',
      publisher: 'TechPress',
      publicationYear: 2024,
      quantity: 4,
      rackLocation: 'Rack B-1',
    };
    const res = await request('/books', {
      method: 'POST',
      body: JSON.stringify(newBook),
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.data.quantity, 4);
    assert.strictEqual(res.data.data.availableQuantity, 4);
    createdBookId = res.data.data._id;

    // Duplicate ISBN attempt
    const dupRes = await request('/books', {
      method: 'POST',
      body: JSON.stringify(newBook),
    });
    assert.strictEqual(dupRes.status, 400, 'Duplicate ISBN must return 400');
  });

  // 5. Edit Book Operations
  await test('Edit Book Operations & Stock Recalculation', async () => {
    const editPayload = {
      title: 'The Pragmatic Architect (2nd Edition)',
      quantity: 6, // Increase from 4 to 6 -> available should become 6
      rackLocation: 'Rack B-2',
    };
    const res = await request(`/books/${createdBookId}`, {
      method: 'PUT',
      body: JSON.stringify(editPayload),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.title, 'The Pragmatic Architect (2nd Edition)');
    assert.strictEqual(res.data.data.quantity, 6);
    assert.strictEqual(res.data.data.availableQuantity, 6);
    assert.strictEqual(res.data.data.rackLocation, 'Rack B-2');
  });

  // 6. Create Member
  let createdMemberId = null;
  const testEmail = `audit_member_${Date.now()}@librarytest.com`;
  await test('Create Member & Auto Member Code Generation', async () => {
    const newMember = {
      name: 'Alex Auditor',
      email: testEmail,
      phone: '+1 555-8888',
      membershipType: 'Student',
      maxBorrowLimit: 4,
    };
    const res = await request('/members', {
      method: 'POST',
      body: JSON.stringify(newMember),
    });
    assert.strictEqual(res.status, 201);
    assert(res.data.data.memberCode.startsWith('MEM-'));
    createdMemberId = res.data.data._id;
  });

  // 7. Edit Member Operations
  await test('Edit Member Profile & Information Persistence', async () => {
    const editPayload = {
      name: 'Alex Auditor Jr.',
      phone: '+1 555-9999',
      membershipType: 'Premium',
      status: 'Active',
      maxBorrowLimit: 8,
    };
    const res = await request(`/members/${createdMemberId}`, {
      method: 'PUT',
      body: JSON.stringify(editPayload),
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.name, 'Alex Auditor Jr.');
    assert.strictEqual(res.data.data.phone, '+1 555-9999');
    assert.strictEqual(res.data.data.membershipType, 'Premium');
    assert.strictEqual(res.data.data.maxBorrowLimit, 8);
  });

  // 8. Issue Book Flow
  let transactionId = null;
  await test('Issue Book Flow & Availability Decrement', async () => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    const issueRes = await request('/transactions/issue', {
      method: 'POST',
      body: JSON.stringify({
        bookId: createdBookId,
        memberId: createdMemberId,
        dueDate: dueDate.toISOString(),
      }),
    });
    assert.strictEqual(issueRes.status, 201);
    assert.strictEqual(issueRes.data.data.status, 'ISSUED');
    transactionId = issueRes.data.data._id;

    // Check book availableQuantity decreased from 6 to 5
    const bookCheck = await request(`/books/${createdBookId}`);
    assert.strictEqual(bookCheck.data.data.availableQuantity, 5);

    // Check member activeBorrowsCount increased to 1
    const memberCheck = await request(`/members/${createdMemberId}`);
    assert.strictEqual(memberCheck.data.data.activeBorrowsCount, 1);
  });

  // 9. Safeguard: Prevent deleting book while actively borrowed
  await test('Delete Safeguard: Prevent Deleting Book With Active Loans', async () => {
    const delRes = await request(`/books/${createdBookId}`, { method: 'DELETE' });
    assert.strictEqual(delRes.status, 400, 'Must reject deleting actively issued book');
  });

  // 10. Safeguard: Prevent deleting member with active loans
  await test('Delete Safeguard: Prevent Deleting Member With Active Loans', async () => {
    const delRes = await request(`/members/${createdMemberId}`, { method: 'DELETE' });
    assert.strictEqual(delRes.status, 400, 'Must reject deleting member with active borrows');
  });

  // 11. Return Book Flow & Restock
  await test('Return Book Flow & Automatic Stock Restock', async () => {
    const returnRes = await request(`/transactions/return/${transactionId}`, {
      method: 'POST',
      body: JSON.stringify({ remarks: 'Audit test return' }),
    });
    assert.strictEqual(returnRes.status, 200);
    assert.strictEqual(returnRes.data.data.status, 'RETURNED');

    // Check book restocked back to 6
    const bookCheck = await request(`/books/${createdBookId}`);
    assert.strictEqual(bookCheck.data.data.availableQuantity, 6);

    // Check member active loans reset to 0
    const memberCheck = await request(`/members/${createdMemberId}`);
    assert.strictEqual(memberCheck.data.data.activeBorrowsCount, 0);
  });

  // 12. Delete Book Success
  await test('Delete Book Operation (When Unborrowed)', async () => {
    const delRes = await request(`/books/${createdBookId}`, { method: 'DELETE' });
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.data.success, true);

    // Confirm book no longer exists
    const checkRes = await request(`/books/${createdBookId}`);
    assert.strictEqual(checkRes.status, 404);
  });

  // 13. Delete Member Success
  await test('Delete Member Operation (When 0 Active Borrows)', async () => {
    const delRes = await request(`/members/${createdMemberId}`, { method: 'DELETE' });
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.data.success, true);

    // Confirm member no longer exists
    const checkRes = await request(`/members/${createdMemberId}`);
    assert.strictEqual(checkRes.status, 404);
  });

  // 14. Overdue Books and Penalty Calculation
  await test('Overdue Circulation Verification', async () => {
    const overdueRes = await request('/transactions/overdue');
    assert.strictEqual(overdueRes.status, 200);
    assert(Array.isArray(overdueRes.data.data));
  });

  console.log(`\n🏁 Audit Test Suite Completed: ${passed}/${total} passed!`);
  if (passed === total) {
    console.log('🎉 ALL AUDIT CHECKS AND CRUD OPERATIONS PASSED 100%!\n');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
