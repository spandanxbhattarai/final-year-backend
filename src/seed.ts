import prisma from './lib/prisma';
import bcrypt from 'bcryptjs';

const seed = async () => {
  console.log('Seeding database...');

  // Clean existing data
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.callLog.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.table.deleteMany();
  await prisma.user.deleteMany();

  // Users
  const adminPassword = await bcrypt.hash('admin123', 12);
  const staffPassword = await bcrypt.hash('staff123', 12);

  const admin = await prisma.user.create({
    data: { name: 'Admin User', email: 'admin@restaurant.com', password: adminPassword, role: 'ADMIN' },
  });

  const staff = await prisma.user.create({
    data: { name: 'Staff User', email: 'staff@restaurant.com', password: staffPassword, role: 'STAFF' },
  });

  console.log('Created users:', admin.email, staff.email);

  // Tables
  const tables = await Promise.all([
    prisma.table.create({ data: { number: 1, capacity: 2, floor: 'Main', status: 'AVAILABLE' } }),
    prisma.table.create({ data: { number: 2, capacity: 4, floor: 'Main', status: 'AVAILABLE' } }),
    prisma.table.create({ data: { number: 3, capacity: 4, floor: 'Main', status: 'OCCUPIED' } }),
    prisma.table.create({ data: { number: 4, capacity: 6, floor: 'Main', status: 'AVAILABLE' } }),
    prisma.table.create({ data: { number: 5, capacity: 8, floor: 'Main', status: 'RESERVED' } }),
    prisma.table.create({ data: { number: 6, capacity: 2, floor: 'Upper', status: 'AVAILABLE' } }),
    prisma.table.create({ data: { number: 7, capacity: 4, floor: 'Upper', status: 'AVAILABLE' } }),
    prisma.table.create({ data: { number: 8, capacity: 6, floor: 'Upper', status: 'OCCUPIED' } }),
    prisma.table.create({ data: { number: 9, capacity: 10, floor: 'Upper', status: 'AVAILABLE' } }),
    prisma.table.create({ data: { number: 10, capacity: 4, floor: 'Upper', status: 'AVAILABLE' } }),
  ]);

  console.log(`Created ${tables.length} tables`);

  // Menu Categories
  const appetizers = await prisma.menuCategory.create({ data: { name: 'Appetizers' } });
  const mains = await prisma.menuCategory.create({ data: { name: 'Main Courses' } });
  const desserts = await prisma.menuCategory.create({ data: { name: 'Desserts' } });
  const beverages = await prisma.menuCategory.create({ data: { name: 'Beverages' } });

  // Menu Items
  const menuItems = await Promise.all([
    // Appetizers
    prisma.menuItem.create({ data: { name: 'Bruschetta', description: 'Grilled bread with tomato, garlic, and basil', price: 12.99, category: appetizers.name, available: true } }),
    prisma.menuItem.create({ data: { name: 'Calamari Fritti', description: 'Crispy fried calamari with marinara sauce', price: 14.99, category: appetizers.name, available: true } }),
    prisma.menuItem.create({ data: { name: 'Caesar Salad', description: 'Romaine lettuce, croutons, parmesan, caesar dressing', price: 11.99, category: appetizers.name, available: true } }),
    // Mains
    prisma.menuItem.create({ data: { name: 'Grilled Salmon', description: 'Atlantic salmon with lemon butter sauce and seasonal vegetables', price: 28.99, category: mains.name, available: true } }),
    prisma.menuItem.create({ data: { name: 'Filet Mignon', description: '8oz premium beef tenderloin with red wine jus', price: 42.99, category: mains.name, available: true } }),
    prisma.menuItem.create({ data: { name: 'Truffle Risotto', description: 'Arborio rice with black truffle and aged parmesan', price: 24.99, category: mains.name, available: true } }),
    prisma.menuItem.create({ data: { name: 'Lamb Rack', description: 'Herb-crusted lamb rack with rosemary jus', price: 38.99, category: mains.name, available: false } }),
    // Desserts
    prisma.menuItem.create({ data: { name: 'Tiramisu', description: 'Classic Italian coffee-flavored dessert', price: 12.99, category: desserts.name, available: true } }),
    prisma.menuItem.create({ data: { name: 'Crème Brûlée', description: 'Vanilla custard with caramelized sugar top', price: 11.99, category: desserts.name, available: true } }),
    // Beverages
    prisma.menuItem.create({ data: { name: 'Espresso', description: 'Double shot Italian espresso', price: 4.99, category: beverages.name, available: true } }),
    prisma.menuItem.create({ data: { name: 'House Red Wine', description: 'Glass of selected Cabernet Sauvignon', price: 14.99, category: beverages.name, available: true } }),
    prisma.menuItem.create({ data: { name: 'Sparkling Water', description: 'San Pellegrino 500ml', price: 3.99, category: beverages.name, available: true } }),
  ]);

  console.log(`Created ${menuItems.length} menu items`);

  // Reservations
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  await Promise.all([
    prisma.reservation.create({ data: { customerName: 'John Smith', phone: '5550101', date: today, time: '18:00', partySize: 4, status: 'CONFIRMED', tableId: tables[4].id } }),
    prisma.reservation.create({ data: { customerName: 'Emily Davis', phone: '5550102', email: 'emily@example.com', date: today, time: '19:30', partySize: 2, status: 'PENDING' } }),
    prisma.reservation.create({ data: { customerName: 'Michael Brown', phone: '5550103', date: tomorrow, time: '20:00', partySize: 6, status: 'CONFIRMED', tableId: tables[3].id } }),
    prisma.reservation.create({ data: { customerName: 'Sarah Wilson', phone: '5550104', date: tomorrow, time: '18:30', partySize: 3, status: 'PENDING' } }),
  ]);

  console.log('Created 4 reservations');

  // Orders
  const order1 = await prisma.order.create({
    data: {
      tableId: tables[2].id,
      customerName: 'Table 3 Guest',
      status: 'PREPARING',
      total: 56.97,
      items: {
        create: [
          { menuItemId: menuItems[0].id, quantity: 1, price: 12.99 },
          { menuItemId: menuItems[3].id, quantity: 1, price: 28.99 },
          { menuItemId: menuItems[10].id, quantity: 1, price: 14.99 },
        ],
      },
    },
  });

  const order2 = await prisma.order.create({
    data: {
      tableId: tables[7].id,
      customerName: 'Table 8 Guest',
      status: 'PENDING',
      total: 73.97,
      items: {
        create: [
          { menuItemId: menuItems[1].id, quantity: 1, price: 14.99 },
          { menuItemId: menuItems[4].id, quantity: 1, price: 42.99 },
          { menuItemId: menuItems[7].id, quantity: 1, price: 12.99 },
          { menuItemId: menuItems[11].id, quantity: 1, price: 3.99 },
        ],
      },
    },
  });

  console.log('Created 2 orders');

  // Call Logs
  await Promise.all([
    prisma.callLog.create({ data: { callerName: 'Robert Johnson', callerPhone: '555-0201', duration: 180, status: 'COMPLETED', transcript: 'Called to make a reservation for Friday evening, party of 4.' } }),
    prisma.callLog.create({ data: { callerName: 'Lisa Anderson', callerPhone: '555-0202', duration: 120, status: 'COMPLETED', transcript: 'Inquired about gluten-free menu options.' } }),
    prisma.callLog.create({ data: { callerName: 'David Martinez', callerPhone: '555-0203', duration: 60, status: 'MISSED' } }),
    prisma.callLog.create({ data: { callerName: 'Jennifer Taylor', callerPhone: '555-0204', duration: 240, status: 'COMPLETED', transcript: 'Booked private dining room for corporate event, 20 guests.' } }),
  ]);

  console.log('Created 4 call logs');
  console.log('Seeding complete!');
};

seed()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
