import { Hono } from "hono";
import type { D1Database } from "@cloudflare/workers-types";
import {
  getSubscriptions,
  getSubscription,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  getCategories,
  getDashboardStats,
  getUserSettings,
  updateUserSettings,
  getSubscriptionsForExpiryReminder,
  getSubscriptionsForRenewalReminder,
  logEmailSent,
} from "./db";
import { sendReminderEmail } from "./email";
import type { SubscriptionInput } from "./types";

// 版本信息
const VERSION = "1.0.0";
const COMMIT_HASH = "000000"; // 部署时由 CI 替换

type Bindings = {
  DB: D1Database;
};

type Variables = {
  userEmail: string;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ==================== 认证中间件 ====================
// Cloudflare Access 会注入已验证用户的邮箱到请求头
app.use("*", async (c, next) => {
  // API 路由需要认证
  if (c.req.path.startsWith("/api/")) {
    const email =
      c.req.header("Cf-Access-Authenticated-User-Email") ||
      // 本地开发回退
      c.req.header("X-Dev-User-Email") ||
      "dev@nitai.cc";

    c.set("userEmail", email);
  }
  await next();
});

// ==================== API: 用户信息 ====================
app.get("/api/user", (c) => {
  const email = c.get("userEmail");
  return c.json({ email, version: VERSION, commit: COMMIT_HASH });
});

// ==================== API: 仪表盘统计 ====================
app.get("/api/stats", async (c) => {
  const email = c.get("userEmail");
  const stats = await getDashboardStats(c.env.DB, email);
  return c.json(stats);
});

// ==================== API: 订阅列表 ====================
app.get("/api/subscriptions", async (c) => {
  const email = c.get("userEmail");
  const category = c.req.query("category");
  const search = c.req.query("search");
  const subs = await getSubscriptions(c.env.DB, email, category, search);
  return c.json(subs);
});

// ==================== API: 单个订阅 ====================
app.get("/api/subscriptions/:id", async (c) => {
  const email = c.get("userEmail");
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "无效的订阅 ID" }, 400);

  const sub = await getSubscription(c.env.DB, id, email);
  if (!sub) return c.json({ error: "订阅不存在" }, 404);
  return c.json(sub);
});

// ==================== API: 创建订阅 ====================
app.post("/api/subscriptions", async (c) => {
  const email = c.get("userEmail");
  const body = await c.req.json<SubscriptionInput>();

  if (!body.name || !body.category) {
    return c.json({ error: "名称和分类为必填项" }, 400);
  }

  const sub = await createSubscription(c.env.DB, email, body);
  return c.json(sub, 201);
});

// ==================== API: 更新订阅 ====================
app.put("/api/subscriptions/:id", async (c) => {
  const email = c.get("userEmail");
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "无效的订阅 ID" }, 400);

  const body = await c.req.json<SubscriptionInput>();
  if (!body.name || !body.category) {
    return c.json({ error: "名称和分类为必填项" }, 400);
  }

  const sub = await updateSubscription(c.env.DB, id, email, body);
  if (!sub) return c.json({ error: "订阅不存在" }, 404);
  return c.json(sub);
});

// ==================== API: 删除订阅 ====================
app.delete("/api/subscriptions/:id", async (c) => {
  const email = c.get("userEmail");
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) return c.json({ error: "无效的订阅 ID" }, 400);

  const deleted = await deleteSubscription(c.env.DB, id, email);
  if (!deleted) return c.json({ error: "订阅不存在" }, 404);
  return c.json({ success: true });
});

// ==================== API: 分类列表 ====================
app.get("/api/categories", async (c) => {
  const email = c.get("userEmail");
  const cats = await getCategories(c.env.DB, email);
  return c.json(cats);
});

// ==================== API: 用户设置 ====================
app.get("/api/settings", async (c) => {
  const email = c.get("userEmail");
  const settings = await getUserSettings(c.env.DB, email);
  return c.json(settings);
});

app.put("/api/settings", async (c) => {
  const email = c.get("userEmail");
  const body = await c.req.json<{ notification_email: string }>();
  if (!body.notification_email) {
    return c.json({ error: "通知邮箱不能为空" }, 400);
  }
  const settings = await updateUserSettings(c.env.DB, email, body.notification_email);
  return c.json(settings);
});

// ==================== 版本信息（无需认证） ====================
app.get("/api/version", (c) => {
  return c.json({ version: VERSION, commit: COMMIT_HASH });
});

// ==================== Cron 触发器：邮件提醒 ====================
async function handleScheduled(env: Bindings) {
  console.log("开始执行邮件提醒检查...");

  // 到期提醒
  const expirySubs = await getSubscriptionsForExpiryReminder(env.DB);
  for (const sub of expirySubs) {
    const sent = await sendReminderEmail(sub, "expiry");
    if (sent) {
      await logEmailSent(env.DB, sub.id, sub.user_email, "expiry");
      console.log(`到期提醒已发送: ${sub.name} (${sub.user_email})`);
    }
  }

  // 续费提醒
  const renewalSubs = await getSubscriptionsForRenewalReminder(env.DB);
  for (const sub of renewalSubs) {
    const sent = await sendReminderEmail(sub, "renewal");
    if (sent) {
      await logEmailSent(env.DB, sub.id, sub.user_email, "renewal");
      console.log(`续费提醒已发送: ${sub.name} (${sub.user_email})`);
    }
  }

  console.log(
    `邮件提醒检查完成。到期提醒: ${expirySubs.length}，续费提醒: ${renewalSubs.length}`,
  );
}

export default {
  fetch: app.fetch,
  async scheduled(
    _event: ScheduledEvent,
    env: Bindings,
    _ctx: ExecutionContext,
  ): Promise<void> {
    await handleScheduled(env);
  },
};