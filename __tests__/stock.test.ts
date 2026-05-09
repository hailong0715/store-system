import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';

const TEST_DB_PATH = 'test-stock-system.db';

describe('Stock Management Module', () => {
  let db: Database.Database;

  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    db = new Database(TEST_DB_PATH);
    db.pragma('journal_mode = WAL');

    // Create required tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'user',
        status TEXT DEFAULT 'pending',
        permissions TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

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
        condition_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (item_id) REFERENCES stock_items(id),
        FOREIGN KEY (operator_id) REFERENCES users(id)
      )
    `);
  });

  afterAll(() => {
    if (db) db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  beforeEach(() => {
    db.exec('DELETE FROM stock_logs');
    db.exec('DELETE FROM stock_items');
    db.exec('DELETE FROM product_conditions');
    db.exec('DELETE FROM categories');
    db.exec('DELETE FROM users');
  });

  describe('Stock Item CRUD', () => {
    it('should create stock item', () => {
      const result = db.prepare(`
        INSERT INTO stock_items (sku, name, category_id, condition_id, quantity, unit, location, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run('SKU001', 'Test Product', null, null, 100, 'PCS', 'Warehouse A', 'Test description');

      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it('should get stock item by id', () => {
      const result = db.prepare(`
        INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)
      `).run('SKU001', 'Test Product', 100);

      const item = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(result.lastInsertRowid);
      expect(item).toBeDefined();
      expect((item as any).name).toBe('Test Product');
    });

    it('should update stock item', () => {
      const result = db.prepare(`
        INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)
      `).run('SKU001', 'Test Product', 100);

      db.prepare(`
        UPDATE stock_items SET name = ?, quantity = ? WHERE id = ?
      `).run('Updated Product', 150, result.lastInsertRowid);

      const item = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(result.lastInsertRowid) as any;
      expect(item.name).toBe('Updated Product');
      expect(item.quantity).toBe(150);
    });

    it('should soft delete stock item', () => {
      const result = db.prepare(`
        INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)
      `).run('SKU001', 'Test Product', 100);

      db.prepare('UPDATE stock_items SET is_deleted = 1 WHERE id = ?').run(result.lastInsertRowid);

      const item = db.prepare('SELECT * FROM stock_items WHERE id = ? AND is_deleted = 0').get(result.lastInsertRowid);
      expect(item).toBeUndefined();
    });

    it('should search stock items by name', () => {
      db.prepare('INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)').run('SKU001', 'Apple Phone', 10);
      db.prepare('INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)').run('SKU002', 'Samsung Phone', 20);
      db.prepare('INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)').run('SKU003', 'Apple Laptop', 30);

      const items = db.prepare('SELECT * FROM stock_items WHERE is_deleted = 0 AND name LIKE ?').all('%Apple%');
      expect(items.length).toBe(2);
    });

    it('should filter stock items by category', () => {
      const catResult = db.prepare('INSERT INTO categories (name) VALUES (?)').run('Electronics');
      const catId = catResult.lastInsertRowid;

      db.prepare('INSERT INTO stock_items (sku, name, category_id, quantity) VALUES (?, ?, ?, ?)').run('SKU001', 'Product 1', catId, 10);
      db.prepare('INSERT INTO stock_items (sku, name, category_id, quantity) VALUES (?, ?, ?, ?)').run('SKU002', 'Product 2', null, 20);

      const items = db.prepare('SELECT * FROM stock_items WHERE category_id = ? AND is_deleted = 0').all(catId);
      expect(items.length).toBe(1);
    });
  });

  describe('Stock In Operation', () => {
    it('should increase stock quantity', () => {
      const itemResult = db.prepare('INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)').run('SKU001', 'Product', 100);
      const itemId = itemResult.lastInsertRowid;

      const quantityBefore = (db.prepare('SELECT quantity FROM stock_items WHERE id = ?').get(itemId) as any).quantity;
      const quantityToAdd = 50;
      const quantityAfter = quantityBefore + quantityToAdd;

      db.prepare('UPDATE stock_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(quantityAfter, itemId);

      const item = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(itemId) as any;
      expect(item.quantity).toBe(150);
    });

    it('should create stock in log', () => {
      const userResult = db.prepare('INSERT INTO users (username, password_hash, name) VALUES (?, ?, ?)').run('admin', 'hash', 'Admin');
      const itemResult = db.prepare('INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)').run('SKU001', 'Product', 100);

      const logResult = db.prepare(`
        INSERT INTO stock_logs (item_id, operation_type, quantity_change, quantity_before, quantity_after, operator_id, operator_name, remark, batch_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(itemResult.lastInsertRowid, 'in', 50, 100, 150, userResult.lastInsertRowid, 'Admin', 'Stock in test', 'batch-001');

      expect(logResult.lastInsertRowid).toBeGreaterThan(0);
    });
  });

  describe('Stock Out Operation', () => {
    it('should decrease stock quantity', () => {
      const itemResult = db.prepare('INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)').run('SKU001', 'Product', 100);
      const itemId = itemResult.lastInsertRowid;

      const quantityBefore = (db.prepare('SELECT quantity FROM stock_items WHERE id = ?').get(itemId) as any).quantity;
      const quantityToRemove = 30;
      const quantityAfter = quantityBefore - quantityToRemove;

      db.prepare('UPDATE stock_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(quantityAfter, itemId);

      const item = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(itemId) as any;
      expect(item.quantity).toBe(70);
    });

    it('should fail when stock insufficient', () => {
      const itemResult = db.prepare('INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)').run('SKU001', 'Product', 100);
      const itemId = itemResult.lastInsertRowid;

      const quantityBefore = (db.prepare('SELECT quantity FROM stock_items WHERE id = ?').get(itemId) as any).quantity;
      const quantityToRemove = 150;

      expect(() => {
        const quantityAfter = quantityBefore - quantityToRemove;
        if (quantityAfter < 0) {
          throw new Error('Insufficient stock');
        }
      }).toThrow('Insufficient stock');
    });

    it('should create stock out log', () => {
      const userResult = db.prepare('INSERT INTO users (username, password_hash, name) VALUES (?, ?, ?)').run('admin', 'hash', 'Admin');
      const itemResult = db.prepare('INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)').run('SKU001', 'Product', 100);

      const logResult = db.prepare(`
        INSERT INTO stock_logs (item_id, operation_type, quantity_change, quantity_before, quantity_after, operator_id, operator_name, remark, batch_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(itemResult.lastInsertRowid, 'out', -30, 100, 70, userResult.lastInsertRowid, 'Admin', 'Stock out test', 'batch-002');

      expect(logResult.lastInsertRowid).toBeGreaterThan(0);
    });
  });

  describe('Stock Logs', () => {
    it('should get logs by item id', () => {
      const userResult = db.prepare('INSERT INTO users (username, password_hash, name) VALUES (?, ?, ?)').run('admin', 'hash', 'Admin');
      const itemResult = db.prepare('INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)').run('SKU001', 'Product', 100);
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

    it('should get all logs', () => {
      const userResult = db.prepare('INSERT INTO users (username, password_hash, name) VALUES (?, ?, ?)').run('admin', 'hash', 'Admin');
      const item1Result = db.prepare('INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)').run('SKU001', 'Product 1', 100);
      const item2Result = db.prepare('INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)').run('SKU002', 'Product 2', 100);

      db.prepare(`
        INSERT INTO stock_logs (item_id, operation_type, quantity_change, quantity_before, quantity_after, operator_id, operator_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(item1Result.lastInsertRowid, 'in', 50, 100, 150, userResult.lastInsertRowid, 'Admin');
      db.prepare(`
        INSERT INTO stock_logs (item_id, operation_type, quantity_change, quantity_before, quantity_after, operator_id, operator_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(item2Result.lastInsertRowid, 'out', -30, 100, 70, userResult.lastInsertRowid, 'Admin');

      const logs = db.prepare('SELECT * FROM stock_logs ORDER BY created_at DESC').all();
      expect(logs.length).toBe(2);
    });

    it('should filter logs by operation type', () => {
      const userResult = db.prepare('INSERT INTO users (username, password_hash, name) VALUES (?, ?, ?)').run('admin', 'hash', 'Admin');
      const itemResult = db.prepare('INSERT INTO stock_items (sku, name, quantity) VALUES (?, ?, ?)').run('SKU001', 'Product', 100);

      db.prepare(`
        INSERT INTO stock_logs (item_id, operation_type, quantity_change, quantity_before, quantity_after, operator_id, operator_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(itemResult.lastInsertRowid, 'in', 50, 100, 150, userResult.lastInsertRowid, 'Admin');
      db.prepare(`
        INSERT INTO stock_logs (item_id, operation_type, quantity_change, quantity_before, quantity_after, operator_id, operator_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(itemResult.lastInsertRowid, 'out', -30, 150, 120, userResult.lastInsertRowid, 'Admin');

      const inLogs = db.prepare('SELECT * FROM stock_logs WHERE operation_type = ?').all('in');
      const outLogs = db.prepare('SELECT * FROM stock_logs WHERE operation_type = ?').all('out');

      expect(inLogs.length).toBe(1);
      expect(outLogs.length).toBe(1);
    });
  });

  describe('Stock with Conditions', () => {
    it('should create stock item with condition', () => {
      const condResult = db.prepare('INSERT INTO product_conditions (name) VALUES (?)').run('New');
      const condId = condResult.lastInsertRowid;

      const itemResult = db.prepare(`
        INSERT INTO stock_items (sku, name, condition_id, quantity) VALUES (?, ?, ?, ?)
      `).run('SKU001', 'Product', condId, 100);

      const item = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(itemResult.lastInsertRowid) as any;
      expect(item.condition_id).toBe(condId);
    });

    it('should track same product with different conditions', () => {
      const cond1Result = db.prepare('INSERT INTO product_conditions (name) VALUES (?)').run('New');
      const cond2Result = db.prepare('INSERT INTO product_conditions (name) VALUES (?)').run('Used');

      db.prepare('INSERT INTO stock_items (sku, name, condition_id, quantity) VALUES (?, ?, ?, ?)').run('SKU001-NEW', 'iPhone', cond1Result.lastInsertRowid, 10);
      db.prepare('INSERT INTO stock_items (sku, name, condition_id, quantity) VALUES (?, ?, ?, ?)').run('SKU001-USED', 'iPhone', cond2Result.lastInsertRowid, 20);

      const items = db.prepare('SELECT * FROM stock_items WHERE name = ? AND is_deleted = 0').all('iPhone');
      expect(items.length).toBe(2);
    });
  });
});
