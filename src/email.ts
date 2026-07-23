import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";
import type { Subscription } from "./types";

const SENDER = "reminder@nitai.cc";
const SENDER_NAME = "Subscribe 订阅提醒";

/** 通过 Cloudflare Email Sending 发送提醒邮件 */
export async function sendReminderEmail(
  seb: SendEmail,
  subscription: Subscription & { notification_email?: string | null },
  type: "expiry" | "renewal",
): Promise<boolean> {
  const toEmail = subscription.notification_email || subscription.user_email;
  if (!toEmail) {
    console.warn(`跳过 ${type} 提醒 (${subscription.name}): 无收件邮箱`);
    return false;
  }

  const isExpiry = type === "expiry";
  const dateStr = isExpiry ? subscription.expiry_date : subscription.renewable_date;
  const typeLabel = isExpiry ? "到期" : "可续费";

  const subject = `[订阅提醒] ${subscription.name} 即将${typeLabel}`;
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f9f9f9; border-radius: 16px;">
      <h2 style="color: #2c2824; margin-bottom: 16px;">订阅提醒</h2>
      <p style="font-size: 16px; color: #333;">您的订阅 <strong>${subscription.name}</strong> 即将${typeLabel}。</p>
      <div style="background: #fff; border-radius: 12px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>服务名称：</strong>${subscription.name}</p>
        <p style="margin: 4px 0;"><strong>${typeLabel}日期：</strong>${dateStr}</p>
        <p style="margin: 4px 0;"><strong>价格：</strong>¥${subscription.price.toFixed(2)}</p>
        <p style="margin: 4px 0;"><strong>分类：</strong>${subscription.category}</p>
      </div>
      <p style="font-size: 12px; color: #999; margin-top: 24px;">
        此邮件由 Subscribe 订阅管理系统自动发送，请勿回复。
      </p>
    </div>
  `;

  try {
    console.log(`准备发送${typeLabel}提醒: ${subscription.name} → ${toEmail}`);
    const msg = createMimeMessage();
    msg.setSender({ name: SENDER_NAME, addr: SENDER });
    msg.setRecipient(toEmail);
    msg.setSubject(subject);
    msg.addMessage({ contentType: "text/html", data: htmlBody });

    await seb.send(new EmailMessage(SENDER, toEmail, msg.asRaw()));
    return true;
  } catch (e) {
    console.error(`发送${typeLabel}提醒失败 (${subscription.name}): ${e}`);
    return false;
  }
}