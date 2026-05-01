import 'dotenv/config';
import prisma from './lib/prisma';
import bcrypt from 'bcryptjs';

const today = new Date().toISOString().slice(0, 10);

async function seed() {
  console.log('🗑️  Clearing test database...');

  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.reservation.deleteMany({});
  await prisma.callLog.deleteMany({});
  await prisma.menuItem.deleteMany({});
  await prisma.menuCategory.deleteMany({});
  await prisma.table.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('👥 Creating users...');

  const password = await bcrypt.hash('Test123!', 12);

  const superAdmin = await prisma.user.create({
    data: { name: 'Super Admin', email: 'superadmin@test.com', password, role: 'SUPER_ADMIN' },
  });
  const admin = await prisma.user.create({
    data: { name: 'Admin User', email: 'admin@test.com', password, role: 'ADMIN' },
  });
  const staff = await prisma.user.create({
    data: { name: 'Staff User', email: 'staff@test.com', password, role: 'STAFF' },
  });
  const cook = await prisma.user.create({
    data: { name: 'Cook User', email: 'cook@test.com', password, role: 'COOK' },
  });
  await prisma.user.create({
    data: { name: 'Blocked User', email: 'blocked@test.com', password, role: 'STAFF', isBlocked: true },
  });

  console.log(`✅ Created users: ${superAdmin.email}, ${admin.email}, ${staff.email}, ${cook.email}, blocked@test.com`);

  console.log('🪑 Creating tables...');

  const table1 = await prisma.table.create({ data: { number: 1, capacity: 4, floor: 'Main', status: 'AVAILABLE' } });
  const table2 = await prisma.table.create({ data: { number: 2, capacity: 6, floor: 'Main', status: 'AVAILABLE' } });
  await prisma.table.create({ data: { number: 3, capacity: 2, floor: 'Upper', status: 'AVAILABLE' } });

  console.log('✅ Created 3 tables');

  console.log('📋 Creating menu categories and items...');

  await prisma.menuCategory.create({ data: { name: 'Appetizers' } });
  await prisma.menuCategory.create({ data: { name: 'Main Course' } });
  await prisma.menuCategory.create({ data: { name: 'Desserts' } });
  await prisma.menuCategory.create({ data: { name: 'Drinks' } });

  const salad = await prisma.menuItem.create({
    data: {
      name: 'Caesar Salad',
      description: 'Classic caesar salad with croutons',
      price: 12.99,
      category: 'Appetizers',
      available: true,
    },
  });
  const salmon = await prisma.menuItem.create({
    data: {
      name: 'Grilled Salmon',
      description: 'Fresh grilled salmon with herbs',
      price: 24.99,
      category: 'Main Course',
      available: true,
    },
  });
  await prisma.menuItem.create({
    data: {
      name: 'Tiramisu',
      description: 'Classic Italian dessert',
      price: 8.99,
      category: 'Desserts',
      available: true,
    },
  });

  console.log('✅ Created 4 categories, 3 menu items');

  console.log('📦 Creating orders...');

  const order1 = await prisma.order.create({
    data: {
      tableId: table1.id,
      customerName: 'Seed Customer 1',
      phone: '',
      status: 'PENDING',
      type: 'DINE_IN',
      date: today,
      total: salad.price,
    },
  });
  await prisma.orderItem.create({
    data: { orderId: order1.id, menuItemId: salad.id, quantity: 1, price: salad.price },
  });

  const order2 = await prisma.order.create({
    data: {
      tableId: table2.id,
      customerName: 'Seed Customer 2',
      phone: '',
      status: 'PREPARING',
      type: 'DINE_IN',
      date: today,
      total: salmon.price,
    },
  });
  await prisma.orderItem.create({
    data: { orderId: order2.id, menuItemId: salmon.id, quantity: 1, price: salmon.price },
  });

  const order3 = await prisma.order.create({
    data: {
      tableId: table1.id,
      customerName: 'Seed Customer 3',
      phone: '',
      status: 'SERVED',
      type: 'DINE_IN',
      date: today,
      total: salad.price * 2,
    },
  });
  await prisma.orderItem.create({
    data: { orderId: order3.id, menuItemId: salad.id, quantity: 2, price: salad.price },
  });

  console.log('✅ Created 3 orders');

  console.log('📅 Creating reservations...');

  await prisma.reservation.create({
    data: {
      customerName: 'Reservation Alpha',
      phone: '+1234567890',
      email: 'alpha@test.com',
      date: today,
      time: '12:00',
      partySize: 4,
      status: 'CONFIRMED',
      tableId: table1.id,
    },
  });
  await prisma.reservation.create({
    data: {
      customerName: 'Reservation Beta',
      phone: '+1987654321',
      email: 'beta@test.com',
      date: today,
      time: '18:00',
      partySize: 2,
      status: 'PENDING',
      tableId: table2.id,
    },
  });

  console.log('✅ Created 2 reservations');
  console.log('🎉 Test database seeded successfully!');
}

seed()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
