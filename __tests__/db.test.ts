import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

// Test database configuration
const TEST_DB_PATH = 'test-store-system.db';

describe('Database Module', () => {
  let db: Database.Database;

  beforeAll(() => {
    // Clean up test database if exists
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Create test database connection
    db = new Database(TEST_DB_PATH);
    db.pragma('journal_mode = WAL');
  });

  afterAll(() => {
    if (db) {
      db.close();
    }
    // Clean up test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('Users Table', () => {
    beforeEach(() => {
      // Create users table
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE,
          phone TEXT UNIQUE,
          password_hash TEXT NOT NULL,
          name TEXT,
          role TEXT DEFAULT 'user',
          status TEXT DEFAULT 'pending',
          permissions TEXT DEFAULT NULL,
          wechat_openid TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    });

    afterEach(() => {
      db.exec('DROP TABLE IF EXISTS users');
    });

    it('should create a user', () => {
      const passwordHash = bcrypt.hashSync('test123', 10);
      const result = db.prepare(`
        INSERT INTO users (username, password_hash, name, role, status, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('testuser', passwordHash, 'Test User', 'user', 'approved', JSON.stringify({ canCreate: true }));

      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it('should reject duplicate username', () => {
      const passwordHash = bcrypt.hashSync('test123', 10);
      db.prepare(`
        INSERT INTO users (username, password_hash, name, role, status, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('testuser', passwordHash, 'Test User', 'user', 'approved', JSON.stringify({}));

      expect(() => {
        db.prepare(`
          INSERT INTO users (username, password_hash, name, role, status, permissions)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run('testuser', passwordHash, 'Test User 2', 'user', 'approved', JSON.stringify({}));
      }).toThrow();
    });

    it('should authenticate user with correct password', () => {
      const password = 'test123';
      const passwordHash = bcrypt.hashSync(password, 10);
      db.prepare(`
        INSERT INTO users (username, password_hash, name, role, status, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('testuser', passwordHash, 'Test User', 'user', 'approved', JSON.stringify({}));

      const user = db.prepare('SELECT * FROM users WHERE username = ?').get('testuser') as any;
      const isValid = bcrypt.compareSync(password, user.password_hash);
      expect(isValid).toBe(true);
    });

    it('should reject wrong password', () => {
      const passwordHash = bcrypt.hashSync('correctpassword', 10);
      db.prepare(`
        INSERT INTO users (username, password_hash, name, role, status, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('testuser', passwordHash, 'Test User', 'user', 'approved', JSON.stringify({}));

      const user = db.prepare('SELECT * FROM users WHERE username = ?').get('testuser') as any;
      const isValid = bcrypt.compareSync('wrongpassword', user.password_hash);
      expect(isValid).toBe(false);
    });
  });

  describe('Categories Table', () => {
    beforeEach(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    });

    afterEach(() => {
      db.exec('DROP TABLE IF EXISTS categories');
    });

    it('should create a category', () => {
      const result = db.prepare(
        'INSERT INTO categories (name, description) VALUES (?, ?)'
      ).run('Electronics', 'Electronic devices');

      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it('should get all categories', () => {
      db.prepare('INSERT INTO categories (name) VALUES (?)').run('Category 1');
      db.prepare('INSERT INTO categories (name) VALUES (?)').run('Category 2');

      const categories = db.prepare('SELECT * FROM categories ORDER BY id DESC').all();
      expect(categories.length).toBe(2);
    });

    it('should update a category', () => {
      const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run('Old Name');
      const id = result.lastInsertRowid;

      db.prepare('UPDATE categories SET name = ? WHERE id = ?').run('New Name', id);
      const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any;
      expect(category.name).toBe('New Name');
    });

    it('should delete a category', () => {
      const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run('To Delete');
      const id = result.lastInsertRowid;

      db.prepare('DELETE FROM categories WHERE id = ?').run(id);
      const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
      expect(category).toBeUndefined();
    });
  });

  describe('Product Conditions Table', () => {
    beforeEach(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS product_conditions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
    });

    afterEach(() => {
      db.exec('DROP TABLE IF EXISTS product_conditions');
    });

    it('should create a product condition', () => {
      const result = db.prepare(
        'INSERT INTO product_conditions (name, description) VALUES (?, ?)'
      ).run('New', 'Brand new condition');

      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it('should get all product conditions', () => {
      db.prepare('INSERT INTO product_conditions (name) VALUES (?)').run('New');
      db.prepare('INSERT INTO product_conditions (name) VALUES (?)').run('Used');

      const conditions = db.prepare('SELECT * FROM product_conditions ORDER BY id DESC').all();
      expect(conditions.length).toBe(2);
    });
  });

  describe('Stock Items Table', () => {
    beforeEach(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS product_conditions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE,
          phone TEXT UNIQUE,
          password_hash TEXT NOT NULL,
          name TEXT,
          role TEXT DEFAULT 'user',
          status TEXT DEFAULT 'pending',
          permissions TEXT DEFAULT NULL,
          wechat_openid TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS stock_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sku TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          category_id INTEGER,
          condition_id INTEGER,
          quantity INTEGER DEFAULT 0,
          unit TEXT,
          location TEXT,
          description TEXT,
          is_deleted INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (category_id) REFERENCES categories(id),
          FOREIGN KEY (condition_id) REFERENCES product_conditions(id)
        )
      `);
    });

    afterEach(() => {
      db.exec('DROP TABLE IF EXISTS stock_items');
      db.exec('DROP TABLE IF EXISTS users');
      db.exec('DROP TABLE IF EXISTS product_conditions');
      db.exec('DROP TABLE IF EXISTS categories');
    });

    it('should create a stock item', () => {
      const result = db.prepare(`
        INSERT INTO stock_items (sku, name, category_id, condition_id, quantity, unit, location)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run('SKU001', 'Test Product', null, null, 100, 'PCS', 'Warehouse A');

      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it('should get all stock items', () => {
      db.prepare(`
        INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)
      `).run('SKU001', 'Product 1', 10);
      db.prepare(`
        INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)
      `).run('SKU002', 'Product 2', 20);

      const items = db.prepare('SELECT * FROM stock_items WHERE is_deleted = 0').all();
      expect(items.length).toBe(2);
    });

    it('should update stock quantity', () => {
      const result = db.prepare(`
        INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)
      `).run('SKU001', 'Product 1', 100);
      const id = result.lastInsertRowid;

      db.prepare('UPDATE stock_items SET quantity = ? WHERE id = ?').run(150, id);
      const item = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(id) as any;
      expect(item.quantity).toBe(150);
    });

    it('should soft delete stock item', () => {
      const result = db.prepare(`
        INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)
      `).run('SKU001', 'Product 1', 100);
      const id = result.lastInsertRowid;

      db.prepare('UPDATE stock_items SET is_deleted = 1 WHERE id = ?').run(id);
      const item = db.prepare('SELECT * FROM stock_items WHERE id = ? AND is_deleted = 0').get(id);
      expect(item).toBeUndefined();
    });

    it('should reject duplicate SKU', () => {
      db.prepare(`
        INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)
      `).run('SKU001', 'Product 1', 100);

      expect(() => {
        db.prepare(`
          INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)
        `).run('SKU001', 'Product 2', 50);
      }).toThrow();
    });
  });

  describe('Stock Logs Table', () => {
    beforeEach(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE,
          password_hash TEXT NOT NULL,
          name TEXT,
          role TEXT DEFAULT 'user'
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS product_conditions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS stock_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sku TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          category_id INTEGER,
          condition_id INTEGER,
          quantity INTEGER DEFAULT 0,
          is_deleted INTEGER DEFAULT 0,
          FOREIGN KEY (category_id) REFERENCES categories(id),
          FOREIGN KEY (condition_id) REFERENCES product_conditions(id)
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS stock_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id INTEGER,
          operation_type TEXT NOT NULL,
          quantity_change INTEGER,
          quantity_before INTEGER,
          quantity_after INTEGER,
          operator_id INTEGER,
          operator_name TEXT,
          remark TEXT,
          batch_id TEXT,
          is_revised INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (item_id) REFERENCES stock_items(id),
          FOREIGN KEY (operator_id) REFERENCES users(id)
        )
      `);
    });

    afterEach(() => {
      db.exec('DROP TABLE IF EXISTS stock_logs');
      db.exec('DROP TABLE IF EXISTS stock_items');
      db.exec('DROP TABLE IF EXISTS users');
      db.exec('DROP TABLE IF EXISTS product_conditions');
      db.exec('DROP TABLE IF EXISTS categories');
    });

    it('should create stock in log', () => {
      const userResult = db.prepare('INSERT INTO users (username, password_hash, name) VALUES (?, ?, ?)').run('admin', 'hash', 'Admin');
      const itemResult = db.prepare('INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)').run('SKU001', 'Product 1', 100);

      const logResult = db.prepare(`
        INSERT INTO stock_logs (item_id, operation_type, quantity_change, quantity_before, quantity_after, operator_id, operator_name, remark)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(itemResult.lastInsertRowid, 'in', 50, 100, 150, userResult.lastInsertRowid, 'Admin', 'Stock in');

      expect(logResult.lastInsertRowid).toBeGreaterThan(0);
    });

    it('should create stock out log', () => {
      const userResult = db.prepare('INSERT INTO users (username, password_hash, name) VALUES (?, ?, ?)').run('admin', 'hash', 'Admin');
      const itemResult = db.prepare('INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)').run('SKU001', 'Product 1', 100);

      const logResult = db.prepare(`
        INSERT INTO stock_logs (item_id, operation_type, quantity_change, quantity_before, quantity_after, operator_id, operator_name, remark)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(itemResult.lastInsertRowid, 'out', -30, 100, 70, userResult.lastInsertRowid, 'Admin', 'Stock out');

      expect(logResult.lastInsertRowid).toBeGreaterThan(0);
    });

    it('should get logs by item id', () => {
      const userResult = db.prepare('INSERT INTO users (username, password_hash, name) VALUES (?, ?, ?)').run('admin', 'hash', 'Admin');
      const itemResult = db.prepare('INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)').run('SKU001', 'Product 1', 100);
      const itemId = itemResult.lastInsertRowid;

      db.prepare(`
        INSERT INTO stock_logs (item_id, operation_type, quantity_change, quantity_before, quantity_after, operator_id, operator_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(itemId, 'in', 50, 100, 150, userResult.lastInsertRowid, 'Admin');
      db.prepare(`
        INSERT INTO stock_logs (item_id, operation_type, quantity_change, quantity_before, quantity_after, operator_id, operator_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(itemId, 'out', -30, 150, 120, userResult.lastInsertRowid, 'Admin');

      const logs = db.prepare('SELECT * FROM stock_logs WHERE item_id = ? ORDER BY created_at DESC').all(itemId);
      expect(logs.length).toBe(2);
    });
  });
});
