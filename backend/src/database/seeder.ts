require('dotenv').config();

if (process.env['NODE_ENV'] === 'production') {
  console.error('ERROR: Cannot run seeder in production environment! Aborting.');
  process.exit(1);
}

import mongoose from 'mongoose';
import { UserSchema } from '../auth/schemas/user.schema';
import { TodoSchema } from '../todos/schemas/todo.schema';

const User = mongoose.model('User', UserSchema);
const Todo = mongoose.model('Todo', TodoSchema);

async function seed() {
  const uri = process.env['MONGODB_URI'];
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }

  await mongoose.connect(uri);

  await Todo.deleteMany({});
  await User.deleteMany({});

  const alice = await User.create({
    name: 'Alice Smith',
    email: 'alice@todoapp.com',
    password: 'Alice@123',
  });
  await User.create({
    name: 'Bob Johnson',
    email: 'bob@todoapp.com',
    password: 'Bob@123',
  });
  await User.create({
    name: 'Carol White',
    email: 'carol@todoapp.com',
    password: 'Carol@123',
  });

  await Todo.create([
    {
      title: 'Buy groceries',
      description: '',
      priority: 'low',
      completed: false,
      user: alice._id,
    },
    {
      title: 'Finish project report',
      description: '',
      priority: 'high',
      completed: false,
      user: alice._id,
    },
    {
      title: 'Call dentist',
      description: '',
      priority: 'medium',
      completed: true,
      user: alice._id,
    },
  ]);

  console.log(`
==================================================
DATABASE SEEDED SUCCESSFULLY
==================================================
Default Users:
  Email: alice@todoapp.com  | Password: Alice@123
  Email: bob@todoapp.com    | Password: Bob@123
  Email: carol@todoapp.com  | Password: Carol@123
==================================================
Use these credentials to log in at http://localhost:3000
==================================================
`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
