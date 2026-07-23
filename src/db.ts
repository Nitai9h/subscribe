import type { D1Database } from "@cloudflare/workers-types";
import type { Subscription, SubscriptionInput, UserSettings, DashboardStats } from "./types";

/** 获取用户的所有订阅，按到期日升序排列 */
export async function getSubscriptions(
  db: D1Database,
  userEmail: string,
  category?: string,
  search?: string,
): Promise<Subscription[]> {
  let sql = "SELECT * FROM subscriptions WHERE user_email = ?";
  const params: unknown[] = [userEmail];

  if (category && category !== "全部") {
    sql += " AND category = ?";
    params.push(category);
  }

  if (search) {
    sql += " AND name LIKE ?";
    params.push(`%${search}%`);
  }

  sql += " ORDER BY CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END, expiry_date ASC";
  const result = await db.prepare(sql).bind(...params).all<Subscription>();
  return result.results;
}

/** 获取单个订阅 */
export async function getSubscription(
  db: D1Database,
  id: number,
  userEmail: string,
): Promise<Subscription | null> {
  const result = await db
    .prepare("SELECT * FROM subscriptions WHERE id = ? AND user_email = ?")
    .bind(id, userEmail)
    .first<Subscription>();
  return result ?? null;
}

/** 创建订阅 */
export async function createSubscription(
  db: D1Database,
  userEmail: string,
  input: SubscriptionInput,
): Promise<Subscription> {
  const now = new Date().toISOString();
  const result = await db
    .prepare(
      `INSERT INTO subscriptions (user_email, name, price, category, expiry_date, renewable_date, email_reminder_expiry, email_reminder_renewal, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      userEmail,
      input.name,
      input.price,
      input.category,
      input.expiry_date,
      input.renewable_date,
      input.email_reminder_expiry,
      input.email_reminder_renewal,
      now,
      now,
    )
    .run();

  const sub = await getSubscription(db, result.meta.last_row_id as unknown as number, userEmail);
  return sub!;
}

/** 更新订阅 */
export async function updateSubscription(
  db: D1Database,
  id: number,
  userEmail: string,
  input: SubscriptionInput,
): Promise<Subscription | null> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE subscriptions SET name=?, price=?, category=?, expiry_date=?, renewable_date=?, email_reminder_expiry=?, email_reminder_renewal=?, updated_at=? WHERE id=? AND user_email=?`,
    )
    .bind(
      input.name,
      input.price,
      input.category,
      input.expiry_date,
      input.renewable_date,
      input.email_reminder_expiry,
      input.email_reminder_renewal,
      now,
      id,
      userEmail,
    )
    .run();

  return getSubscription(db, id, userEmail);
}

/** 删除订阅 */
export async function deleteSubscription(
  db: D1Database,
  id: number,
  userEmail: string,
): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM subscriptions WHERE id = ? AND user_email = ?")
    .bind(id, userEmail)
    .run();
  return result.meta.changes > 0;
}

/** 获取所有分类 */
export async function getCategories(
  db: D1Database,
  userEmail: string,
): Promise<string[]> {
  const result = await db
    .prepare("SELECT DISTINCT category FROM subscriptions WHERE user_email = ? ORDER BY category")
    .bind(userEmail)
    .all<{ category: string }>();
  return result.results.map((r) => r.category);
}

/** 获取仪表盘数据 */
export async function getDashboardStats(
  db: D1Database,
  userEmail: string,
): Promise<DashboardStats> {
  const subs = await getSubscriptions(db, userEmail);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = subs.filter((s) => {
    if (!s.expiry_date) return false;
    const expiryDate = new Date(s.expiry_date);
    const diffDays = Math.ceil(
      (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    return diffDays >= 0 && diffDays <= 7;
  }).length;

  return { total: subs.length, upcoming, subscriptions: subs };
}

/** 获取用户设置 */
export async function getUserSettings(
  db: D1Database,
  userEmail: string,
): Promise<UserSettings> {
  const result = await db
    .prepare("SELECT * FROM user_settings WHERE user_email = ?")
    .bind(userEmail)
    .first<UserSettings>();

  return result ?? { user_email: userEmail, notification_email: null };
}

/** 更新用户设置 */
export async function updateUserSettings(
  db: D1Database,
  userEmail: string,
  notificationEmail: string,
): Promise<UserSettings> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO user_settings (user_email, notification_email, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_email) DO UPDATE SET notification_email=?, updated_at=?`,
    )
    .bind(userEmail, notificationEmail, now, now, notificationEmail, now)
    .run();

  return getUserSettings(db, userEmail);
}

/** 获取需要发送到期提醒的订阅 */
export async function getSubscriptionsForExpiryReminder(
  db: D1Database,
): Promise<Subscription[]> {
  const result = await db
    .prepare(
      `SELECT s.*, us.notification_email FROM subscriptions s
       LEFT JOIN user_settings us ON s.user_email = us.user_email
       WHERE s.email_reminder_expiry = 1 AND s.expiry_date IS NOT NULL
       AND date(s.expiry_date) >= date('now')
       AND date(s.expiry_date) <= date('now', '+7 days')`,
    )
    .all<Subscription & { notification_email: string | null }>();
  return result.results;
}

/** 获取需要发送续费提醒的订阅 */
export async function getSubscriptionsForRenewalReminder(
  db: D1Database,
): Promise<Subscription[]> {
  const result = await db
    .prepare(
      `SELECT s.*, us.notification_email FROM subscriptions s
       LEFT JOIN user_settings us ON s.user_email = us.user_email
       WHERE s.email_reminder_renewal = 1 AND s.renewable_date IS NOT NULL
       AND date(s.renewable_date) >= date('now')
       AND date(s.renewable_date) <= date('now', '+7 days')`,
    )
    .all<Subscription & { notification_email: string | null }>();
  return result.results;
}

/** 记录已发送的邮件 */
export async function logEmailSent(
  db: D1Database,
  subscriptionId: number,
  userEmail: string,
  type: "expiry" | "renewal",
): Promise<void> {
  await db
    .prepare("INSERT INTO email_logs (subscription_id, user_email, type) VALUES (?, ?, ?)")
    .bind(subscriptionId, userEmail, type)
    .run();
}