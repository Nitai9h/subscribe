-- 订阅管理表
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL DEFAULT 0.00,
  category TEXT NOT NULL,
  expiry_date TEXT,
  renewable_date TEXT,
  email_reminder_expiry INTEGER DEFAULT 0,
  email_reminder_renewal INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
  user_email TEXT PRIMARY KEY,
  notification_email TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 邮件发送记录表（用于调试和统计）
CREATE TABLE IF NOT EXISTS email_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL,
  user_email TEXT NOT NULL,
  type TEXT NOT NULL,
  sent_at TEXT DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expiry ON subscriptions(expiry_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_category ON subscriptions(user_email, category);
CREATE INDEX IF NOT EXISTS idx_email_logs_sub ON email_logs(subscription_id, type);