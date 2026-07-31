import { db } from "@/db";
import { notificationSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export type NotificationPrefs = {
  sendPending: boolean;
  sendApproved: boolean;
  showValue: boolean;
  showProduct: boolean;
  showUtmCampaign: boolean;
  showDashboardName: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  sendPending: false,
  sendApproved: true,
  showValue: true,
  showProduct: true,
  showUtmCampaign: false,
  showDashboardName: true,
};

export async function getNotificationSettings(dashboardId: string): Promise<NotificationPrefs> {
  const [row] = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.dashboardId, dashboardId))
    .limit(1);
  if (!row) return { ...DEFAULT_NOTIFICATION_PREFS };
  return {
    sendPending: row.sendPending,
    sendApproved: row.sendApproved,
    showValue: row.showValue,
    showProduct: row.showProduct,
    showUtmCampaign: row.showUtmCampaign,
    showDashboardName: row.showDashboardName,
  };
}
