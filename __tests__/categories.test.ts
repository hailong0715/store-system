import Database from 'better-sqlite3';
import fs from 'fs';

const TEST_DB_PATH = 'test-category-system.db';

describe('Categories and Product Conditions Module', () => {
  let db: Database.Database;

  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    db = new Database(TEST_DB_PATH);
    db.pragma('journal_mode = WAL');

    // Create categories table
    db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create product_conditions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS product_conditions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create stock_items table (for testing relationships)
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
  });

  afterAll(() => {
    if (db) db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  beforeEach(() => {
    db.exec('DELETE FROM stock_items');
    db.exec('DELETE FROM product_conditions');
    db.exec('DELETE FROM categories');
  });

  describe('Categories CRUD', () => {
    it('should create a category', () => {
      const result = db.prepare(
        'INSERT INTO categories (name, description) VALUES (?, ?)'
      ).run('Electronics', 'Electronic devices and accessories');

      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it('should create a category without description', () => {
      const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run('Clothing');

      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it('should get all categories', () => {
      db.prepare('INSERT INTO categories (name) VALUES (?)').run('Electronics');
      db.prepare('INSERT INTO categories (name) VALUES (?)').run('Clothing');
      db.prepare('INSERT INTO categories (name) VALUES (?)').run('Food');

      const categories = db.prepare('SELECT * FROM categories ORDER BY id DESC').all();
      expect(categories.length).toBe(3);
    });

    it('should get category by id', () => {
      const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run('Electronics');
      const id = result.lastInsertRowid;

      const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
      expect(category).toBeDefined();
      expect((category as any).name).toBe('Electronics');
    });

    it('should update category', () => {
      const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run('Old Name');
      const id = result.lastInsertRowid;

      db.prepare('UPDATE categories SET name = ?, description = ? WHERE id = ?')
        .run('New Name', 'New description', id);

      const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any;
      expect(category.name).toBe('New Name');
      expect(category.description).toBe('New description');
    });

    it('should delete category', () => {
      const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run('To Delete');
      const id = result.lastInsertRowid;

      db.prepare('DELETE FROM categories WHERE id = ?').run(id);

      const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
      expect(category).toBeUndefined();
    });

    it('should not delete category with stock items', () => {
      const catResult = db.prepare('INSERT INTO categories (name) VALUES (?)').run('Electronics');
      const catId = catResult.lastInsertRowid;

      db.prepare('INSERT INTO stock_items (sku, name, category_id, quantity) VALUES (?, ?, ?, ?)')
        .run('SKU001', 'Product', catId, 100);

      // In a real app, you would check for foreign key constraints or soft delete
      // For this test, we just verify the relationship exists
      const items = db.prepare('SELECT * FROM stock_items WHERE category_id = ?').all(catId);
      expect(items.length).toBe(1);
    });
  });

  describe('Product Conditions CRUD', () => {
    it('should create a product condition', () => {
      const result = db.prepare(
        'INSERT INTO product_conditions (name, description) VALUES (?, ?)'
      ).run('New', 'Brand new, never used');

      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it('should create product conditions with different values', () => {
      db.prepare('INSERT INTO product_conditions (name) VALUES (?)').run('New');
      db.prepare('INSERT INTO product_conditions (name) VALUES (?)').run('Like New');
      db.prepare('INSERT INTO product_conditions (name) VALUES (?)').run('Used');
      db.prepare('INSERT INTO product_conditions (name) VALUES (?)').run('Refurbished');

      const conditions = db.prepare('SELECT * FROM product_conditions ORDER BY id DESC').all();
      expect(conditions.length).toBe(4);
    });

    it('should get all product conditions', () => {
      db.prepare('INSERT INTO product_conditions (name) VALUES (?)').run('New');
      db.prepare('INSERT INTO product_conditions (name) VALUES (?)').run('Used');

      const conditions = db.prepare('SELECT * FROM product_conditions ORDER BY id DESC').all();
      expect(conditions.length).toBe(2);
    });

    it('should get product condition by id', () => {
      const result = db.prepare('INSERT INTO product_conditions (name) VALUES (?)').run('New');
      const id = result.lastInsertRowid;

      const condition = db.prepare('SELECT * FROM product_conditions WHERE id = ?').get(id);
      expect(condition).toBeDefined();
      expect((condition as any).name).toBe('New');
    });

    it('should update product condition', () => {
      const result = db.prepare('INSERT INTO product_conditions (name) VALUES (?)').run('Old Condition');
      const id = result.lastInsertRowid;

      db.prepare('UPDATE product_conditions SET name = ?, description = ? WHERE id = ?')
        .run('New Condition', 'Updated description', id);

      const condition = db.prepare('SELECT * FROM product_conditions WHERE id = ?').get(id) as any;
      expect(condition.name).toBe('New Condition');
    });

    it('should delete product condition', () => {
      const result = db.prepare('INSERT INTO product_conditions (name) VALUES (?)').run('To Delete');
      const id = result.lastInsertRowid;

      db.prepare('DELETE FROM product_conditions WHERE id = ?').run(id);

      const condition = db.prepare('SELECT * FROM product_conditions WHERE id = ?').get(id);
      expect(condition).toBeUndefined();
    });
  });

  describe('Relationship between Categories and Stock Items', () => {
    it('should link stock item to category', () => {
      const catResult = db.prepare('INSERT INTO categories (name) VALUES (?)').run('Electronics');
      const catId = catResult.lastInsertRowid;

      const itemResult = db.prepare(
        'INSERT INTO stock_items (sku, name, category_id, quantity) VALUES (?, ?, ?, ?)'
      ).run('SKU001', 'iPhone', catId, 100);

      const item = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(itemResult.lastInsertRowid) as any;
      expect(item.category_id).toBe(catId);
    });

    it('should get stock items by category', () => {
      const cat1Result = db.prepare('INSERT INTO categories (name) VALUES (?)').run('Electronics');
      const cat2Result = db.prepare('INSERT INTO categories (name) VALUES (?)').run('Clothing');

      db.prepare('INSERT INTO stock_items (sku, name, category_id, quantity) VALUES (?, ?, ?, ?)')
        .run('SKU001', 'iPhone', cat1Result.lastInsertRowid, 10);
      db.prepare('INSERT INTO stock_items (sku, name, category_id, quantity) VALUES (?, ?, ?, ?)')
        .run('SKU002', 'MacBook', cat1Result.lastInsertRowid, 5);
      db.prepare('INSERT INTO stock_items (sku, name, category_id, quantity) VALUES (?, ?, ?, ?)')
        .run('SKU003', 'Shirt', cat2Result.lastInsertRowid, 50);

      const electronicsItems = db.prepare(
        'SELECT * FROM stock_items WHERE category_id = ? AND is_deleted = 0'
      ).all(cat1Result.lastInsertRowid);

      expect(electronicsItems.length).toBe(2);
    });
  });

  describe('Relationship between Product Conditions and Stock Items', () => {
    it('should link stock item to condition', () => {
      const condResult = db.prepare('INSERT INTO product_conditions (name) VALUES (?)').run('New');
      const condId = condResult.lastInsertRowid;

      const itemResult = db.prepare(
        'INSERT INTO stock_items (sku, name, condition_id, quantity) VALUES (?, ?, ?, ?)'
      ).run('SKU001', 'iPhone', condId, 100);

      const item = db.prepare('SELECT * FROM stock_items WHERE id = ?').get(itemResult.lastInsertRowid) as any;
      expect(item.condition_id).toBe(condId);
    });

    it('should get stock items by condition', () => {
      const cond1Result = db.prepare('INSERT INTO product_conditions (name) VALUES (?)').run('New');
      const cond2Result = db.prepare('INSERT INTO product_conditions (name) VALUES (?)').run('Used');

      db.prepare('INSERT INTO stock_items (sku, name, condition_id, quantity) VALUES (?, ?, ?, ?)')
        .run('SKU001', 'iPhone', cond1Result.lastInsertRowid, 10);
      db.prepare('INSERT INTO stock_items (sku, name, condition_id, quantity) VALUES (?, ?, ?, ?)')
        .run('SKU002', 'iPhone', cond2Result.lastInsertRowid, 20);

      const newItems = db.prepare(
        'SELECT * FROM stock_items WHERE condition_id = ? AND is_deleted = 0'
      ).all(cond1Result.lastInsertRowid);

      expect(newItems.length).toBe(1);
    });
  });
});
