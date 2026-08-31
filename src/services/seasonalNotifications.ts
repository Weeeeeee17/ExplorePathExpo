import * as Notifications from 'expo-notifications';

import { seasonalReminderSchedule, seasonMeta } from '../domain/seasonalPromise';
import { SeasonalPromiseState } from '../domain/types';

export async function requestSeasonalNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch { return false; }
}

export async function syncSeasonalNotifications(state: SeasonalPromiseState, now: number): Promise<string[]> {
  await Promise.all(state.notificationIds.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  if (state.notificationsEnabled !== true || state.status !== 'active' || !state.expiresAt) return [];
  const requests = seasonalReminderSchedule(now, state.expiresAt).map((reminder) => ({
    at: reminder.at,
    title: reminder.kind === 'seasonStart'
      ? `${seasonMeta[reminder.season].title}季開始了`
      : `${seasonMeta[reminder.season].title}季還有 14 天`,
    body: reminder.kind === 'seasonStart'
      ? '四季之約正在等你回到同一個地方，看看新的變化。'
      : '若這一季還沒留下足跡，可以安排一次安全的再訪。',
  }));
  const ids = await Promise.all(requests.map(async (item) => {
    try {
      return await Notifications.scheduleNotificationAsync({ content: { title: item.title, body: item.body, sound: true, data: { source: 'explorepath-seasonal' } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(item.at) } });
    } catch { return null; }
  }));
  return ids.filter((id): id is string => typeof id === 'string');
}
