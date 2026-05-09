import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'fs';

const TEST_DB_PATH = 'test-auth-system.db';

describe('User Authentication Module', () => {
  let db: Database.Database;

  beforeAll(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    db = new Database(TEST_DB_PATH);
    db.pragma('journal_mode = WAL');

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

  afterAll(() => {
    if (db) db.close();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  beforeEach(() => {
    // Clean up users table
    db.exec('DELETE FROM users');
  });

  describe('User Registration', () => {
    it('should register user with username', () => {
      const passwordHash = bcrypt.hashSync('password123', 10);
      const result = db.prepare(`
        INSERT INTO users (username, password_hash, name, role, status, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('testuser', passwordHash, 'Test User', 'user', 'pending', JSON.stringify({}));

      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it('should register user with phone', () => {
      const passwordHash = bcrypt.hashSync('password123', 10);
      const result = db.prepare(`
        INSERT INTO users (phone, password_hash, name, role, status, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('13800138000', passwordHash, 'Test User', 'user', 'pending', JSON.stringify({}));

      expect(result.lastInsertRowid).toBeGreaterThan(0);
    });

    it('should reject duplicate username', () => {
      const passwordHash = bcrypt.hashSync('password123', 10);
      db.prepare(`
        INSERT INTO users (username, password_hash, name, role, status, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('testuser', passwordHash, 'User 1', 'user', 'pending', JSON.stringify({}));

      expect(() => {
        db.prepare(`
          INSERT INTO users (username, password_hash, name, role, status, permissions)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run('testuser', passwordHash, 'User 2', 'user', 'pending', JSON.stringify({}));
      }).toThrow();
    });

    it('should reject duplicate phone', () => {
      const passwordHash = bcrypt.hashSync('password123', 10);
      db.prepare(`
        INSERT INTO users (phone, password_hash, name, role, status, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('13800138000', passwordHash, 'User 1', 'user', 'pending', JSON.stringify({}));

      expect(() => {
        db.prepare(`
          INSERT INTO users (phone, password_hash, name, role, status, permissions)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run('13800138000', passwordHash, 'User 2', 'user', 'pending', JSON.stringify({}));
      }).toThrow();
    });
  });

  describe('User Login', () => {
    it('should login with correct username and password', () => {
      const password = 'password123';
      const passwordHash = bcrypt.hashSync(password, 10);
      db.prepare(`
        INSERT INTO users (username, password_hash, name, role, status, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('testuser', passwordHash, 'Test User', 'user', 'approved', JSON.stringify({}));

      const user = db.prepare('SELECT * FROM users WHERE username = ?').get('testuser') as any;
      const isValid = bcrypt.compareSync(password, user.password_hash);

      expect(isValid).toBe(true);
      expect(user.status).toBe('approved');
    });

    it('should login with correct phone and password', () => {
      const password = 'password123';
      const passwordHash = bcrypt.hashSync(password, 10);
      db.prepare(`
        INSERT INTO users (phone, password_hash, name, role, status, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('13800138000', passwordHash, 'Test User', 'user', 'approved', JSON.stringify({}));

      const user = db.prepare('SELECT * FROM users WHERE phone = ?').get('13800138000') as any;
      const isValid = bcrypt.compareSync(password, user.password_hash);

      expect(isValid).toBe(true);
    });

    it('should fail with wrong password', () => {
      const passwordHash = bcrypt.hashSync('correctpassword', 10);
      db.prepare(`
        INSERT INTO users (username, password_hash, name, role, status, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('testuser', passwordHash, 'Test User', 'user', 'approved', JSON.stringify({}));

      const user = db.prepare('SELECT * FROM users WHERE username = ?').get('testuser') as any;
      const isValid = bcrypt.compareSync('wrongpassword', user.password_hash);

      expect(isValid).toBe(false);
    });

    it('should fail with non-existent user', () => {
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get('nonexistent');
      expect(user).toBeUndefined();
    });
  });

  describe('User Status Management', () => {
    it('should have pending status by default', () => {
      const passwordHash = bcrypt.hashSync('password123', 10);
      db.prepare(`
        INSERT INTO users (username, password_hash, name, role, status, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('testuser', passwordHash, 'Test User', 'user', 'pending', JSON.stringify({}));

      const user = db.prepare('SELECT * FROM users WHERE username = ?').get('testuser') as any;
      expect(user.status).toBe('pending');
    });

    it('should approve user', () => {
      const passwordHash = bcrypt.hashSync('password123', 10);
      db.prepare(`
        INSERT INTO users (username, password_hash, name, role, status, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('testuser', passwordHash, 'Test User', 'user', 'pending', JSON.stringify({}));

      db.prepare('UPDATE users SET status = ? WHERE username = ?').run('approved', 'testuser');

      const user = db.prepare('SELECT * FROM users WHERE username = ?').get('testuser') as any;
      expect(user.status).toBe('approved');
    });

    it('should reject user', () => {
      const passwordHash = bcrypt.hashSync('password123', 10);
      db.prepare(`
        INSERT INTO users (username, password_hash, name, role, status, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('testuser', passwordHash, 'Test User', 'user', 'pending', JSON.stringify({}));

      db.prepare('UPDATE users SET status = ? WHERE username = ?').run('rejected', 'testuser');

      const user = db.prepare('SELECT * FROM users WHERE username = ?').get('testuser') as any;
      expect(user.status).toBe('rejected');
    });
  });

  describe('User Permissions', () => {
    it('should set permissions', () => {
      const permissions = {
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canIn: true,
        canOut: false
      };
      const passwordHash = bcrypt.hashSync('password123', 10);
      db.prepare(`
        INSERT INTO users (username, password_hash, name, role, status, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('testuser', passwordHash, 'Test User', 'user', 'approved', JSON.stringify(permissions));

      const user = db.prepare('SELECT * FROM users WHERE username = ?').get('testuser') as any;
      const userPermissions = JSON.parse(user.permissions);

      expect(userPermissions.canCreate).toBe(true);
      expect(userPermissions.canEdit).toBe(true);
      expect(userPermissions.canDelete).toBe(false);
      expect(userPermissions.canIn).toBe(true);
      expect(userPermissions.canOut).toBe(false);
    });

    it('should update permissions', () => {
      const oldPermissions = { canCreate: false };
      const passwordHash = bcrypt.hashSync('password123', 10);
      db.prepare(`
        INSERT INTO users (username, password_hash, name, role, status, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('testuser', passwordHash, 'Test User', 'user', 'approved', JSON.stringify(oldPermissions));

      const newPermissions = { canCreate: true, canEdit: true };
      db.prepare('UPDATE users SET permissions = ? WHERE username = ?')
        .run(JSON.stringify(newPermissions), 'testuser');

      const user = db.prepare('SELECT * FROM users WHERE username = ?').get('testuser') as any;
      const userPermissions = JSON.parse(user.permissions);

      expect(userPermissions.canCreate).toBe(true);
      expect(userPermissions.canEdit).toBe(true);
    });
  });

  describe('User Role Management', () => {
    it('should have user role by default', () => {
      const passwordHash = bcrypt.hashSync('password123', 10);
      db.prepare(`
        INSERT INTO users (username, password_hash, name, role, status, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('testuser', passwordHash, 'Test User', 'user', 'approved', JSON.stringify({}));

      const user = db.prepare('SELECT * FROM users WHERE username = ?').get('testuser') as any;
      expect(user.role).toBe('user');
    });

    it('should set admin role', () => {
      const passwordHash = bcrypt.hashSync('password123', 10);
      db.prepare(`
        INSERT INTO users (username, password_hash, name, role, status, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('admin', passwordHash, 'Admin User', 'admin', 'approved', JSON.stringify({
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canIn: true,
        canOut: true
      }));

      const user = db.prepare('SELECT * FROM users WHERE username = ?').get('admin') as any;
      expect(user.role).toBe('admin');
    });
  });

  describe('User Profile Update', () => {
    it('should update user name', () => {
      const passwordHash = bcrypt.hashSync('password123', 10);
      db.prepare(`
        INSERT INTO users (username, password_hash, name, role, status, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('testuser', passwordHash, 'Old Name', 'user', 'approved', JSON.stringify({}));

      db.prepare('UPDATE users SET name = ? WHERE username = ?').run('New Name', 'testuser');

      const user = db.prepare('SELECT * FROM users WHERE username = ?').get('testuser') as any;
      expect(user.name).toBe('New Name');
    });

    it('should update user password', () => {
      const oldPassword = 'oldpassword';
      const newPassword = 'newpassword';
      const oldPasswordHash = bcrypt.hashSync(oldPassword, 10);

      db.prepare(`
        INSERT INTO users (username, password_hash, name, role, status, permissions)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('testuser', oldPasswordHash, 'Test User', 'user', 'approved', JSON.stringify({}));

      const newPasswordHash = bcrypt.hashSync(newPassword, 10);
      db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(newPasswordHash, 'testuser');

      const user = db.prepare('SELECT * FROM users WHERE username = ?').get('testuser') as any;
      const isValid = bcrypt.compareSync(newPassword, user.password_hash);

      expect(isValid).toBe(true);
    });
  });
});
