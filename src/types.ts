/** 订阅记录 */
export interface Subscription {
  id: number;
  user_email: string;
  name: string;
  price: number;
  category: string;
  expiry_date: string | null;
  renewable_date: string | null;
  email_reminder_expiry: number;
  email_reminder_renewal: number;
  created_at: string;
  updated_at: string;
}

/** 创建 / 更新订阅的请求体 */
export interface SubscriptionInput {
  name: string;
  price: number;
  category: string;
  expiry_date: string | null;
  renewable_date: string | null;
  email_reminder_expiry: number;
  email_reminder_renewal: number;
}

/** 用户设置 */
export interface UserSettings {
  user_email: string;
  notification_email: string | null;
}

/** 仪表盘统计 */
export interface DashboardStats {
  total: number;
  upcoming: number;
  subscriptions: Subscription[];
}

/** 邮件发送记录 */
export interface EmailLog {
  id: number;
  subscription_id: number;
  user_email: string;
  type: "expiry" | "renewal";
  sent_at: string;
}