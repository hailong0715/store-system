import { sql } from '@vercel/postgres';
import bcrypt from 'bcryptjs';

let initialized = false;

export async function initDb() {
  if (initialized) return;

  try {
    // Users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE,
        phone VARCHAR(20) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100),
        role VARCHAR(20) DEFAULT 'user',
        status VARCHAR(20) DEFAULT 'pending',
        permissions TEXT DEFAULT NULL,
        wechat_openid VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Categories table
    await sql`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Product conditions table
    await sql`
      CREATE TABLE IF NOT EXISTS product_conditions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Stock items table
    await sql`
      CREATE TABLE IF NOT EXISTS stock_items (
        id SERIAL PRIMARY KEY,
        sku VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        category_id INTEGER REFERENCES categories(id),
        condition_id INTEGER REFERENCES product_conditions(id),
        quantity INTEGER DEFAULT 0,
        unit VARCHAR(20),
        location VARCHAR(100),
        description TEXT,
        is_deleted INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Stock logs table
    await sql`
      CREATE TABLE IF NOT EXISTS stock_logs (
        id SERIAL PRIMARY KEY,
        item_id INTEGER REFERENCES stock_items(id),
        operation_type VARCHAR(20) NOT NULL,
        quantity_change INTEGER,
        quantity_before INTEGER,
        quantity_after INTEGER,
        operator_id INTEGER REFERENCES users(id),
        operator_name VARCHAR(100),
        remark TEXT,
        batch_id VARCHAR(50),
        is_revised INTEGER DEFAULT 0,
        condition_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Purchase orders table
    await sql`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        logistics_name VARCHAR(100) NOT NULL,
        logistics_no VARCHAR(100) NOT NULL,
        sender VARCHAR(100),
        phone VARCHAR(20),
        total_amount REAL DEFAULT 0,
        status VARCHAR(20) DEFAULT 'completed',
        operator_id INTEGER REFERENCES users(id),
        operator_name VARCHAR(100),
        remark TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Purchase order items table
    await sql`
      CREATE TABLE IF NOT EXISTS purchase_order_items (
        id SERIAL PRIMARY KEY,
        purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id),
        item_id INTEGER REFERENCES stock_items(id),
        item_name VARCHAR(200) NOT NULL,
        category_id INTEGER REFERENCES categories(id),
        condition_id INTEGER REFERENCES product_conditions(id),
        good_quantity INTEGER DEFAULT 0,
        bad_quantity INTEGER DEFAULT 0,
        unit_price REAL DEFAULT 0,
        total_price REAL DEFAULT 0,
        remark TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Sales orders table
    await sql`
      CREATE TABLE IF NOT EXISTS sales_orders (
        id SERIAL PRIMARY KEY,
        order_no VARCHAR(50) UNIQUE NOT NULL,
        logistics_name VARCHAR(100),
        logistics_no VARCHAR(100),
        receiver VARCHAR(100),
        phone VARCHAR(20),
        total_amount REAL DEFAULT 0,
        payment_status VARCHAR(20) DEFAULT 'unpaid',
        status VARCHAR(20) DEFAULT 'completed',
        operator_id INTEGER REFERENCES users(id),
        operator_name VARCHAR(100),
        remark TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Sales order items table
    await sql`
      CREATE TABLE IF NOT EXISTS sales_order_items (
        id SERIAL PRIMARY KEY,
        sales_order_id INTEGER NOT NULL REFERENCES sales_orders(id),
        item_id INTEGER REFERENCES stock_items(id),
        item_name VARCHAR(200) NOT NULL,
        category_id INTEGER REFERENCES categories(id),
        condition_id INTEGER REFERENCES product_conditions(id),
        quantity INTEGER DEFAULT 0,
        unit_price REAL DEFAULT 0,
        total_price REAL DEFAULT 0,
        remark TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Wechat bind codes table
    await sql`
      CREATE TABLE IF NOT EXISTS wechat_bind_codes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id),
        status VARCHAR(20) DEFAULT 'pending',
        openid VARCHAR(100),
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create admin user if not exists
    const adminResult = await sql`SELECT id FROM users WHERE username = 'admin'`;
    if (adminResult.rows.length === 0) {
      const passwordHash = bcrypt.hashSync('admin123', 10);
      await sql`
        INSERT INTO users (username, password_hash, name, role, status, permissions)
        VALUES ('admin', ${passwordHash}, 'Administrator', 'admin', 'approved', ${JSON.stringify({
          canCreate: true,
          canEdit: true,
          canDelete: true,
          canIn: true,
          canOut: true
        })})
      `;
      console.log('Admin user created');
    }

    initialized = true;
    console.log('Database initialized successfully');
  } catch (e) {
    console.error('Error initializing database:', e);
  }
}

// Helper function to get a single row
export async function getOne(sqlQuery: TemplateStringsArray, ...params: any[]) {
  const result = await sql(sqlQuery, ...params);
  return result.rows[0] || null;
}

// Helper function to get all rows
export async function getAll(sqlQuery: TemplateStringsArray, ...params: any[]) {
  const result = await sql(sqlQuery, ...params);
  return result.rows;
}

// Helper function to run insert/update/delete
export async function run(sqlQuery: TemplateStringsArray, ...params: any[]) {
  const result = await sql(sqlQuery, ...params);
  return result;
}

// Helper function to get last inserted id
export async function getLastInsertId(): Promise<number> {
  const result = await sql`SELECT lastval() as id`;
  return result.rows[0].id;
}

export { sql };
