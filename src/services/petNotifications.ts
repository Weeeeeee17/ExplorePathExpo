import * as Notifications from 'expo-notifications';

import {
  activePet,
  dayMilliseconds,
  departureCountdownMilliseconds,
  memoryDeadlineMilliseconds,
  moodDecayPerDay,
} from '../domain/petRules';
import { PetCollectionState } from '../domain/types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestPetNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

async function cancelKnown(ids: string[]): Promise<void> {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
}

export async function cancelPetNotifications(ids: string[]): Promise<void> {
  await cancelKnown(ids);
}

async function scheduleAt(
  at: number,
  title: string,
  body: string,
  now: number,
): Promise<string | null> {
  if (!Number.isFinite(at) || at <= now) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true, data: { source: 'explorepath-pet' } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(at),
      },
    });
  } catch {
    return null;
  }
}

export async function syncPetNotifications(
  collection: PetCollectionState,
  now: number,
): Promise<string[]> {
  await cancelKnown(collection.notificationIds);
  if (collection.notificationsEnabled !== true) return [];
  const pet = activePet(collection);
  if (!pet || pet.stage === 'egg' || pet.lifecycle === 'memory') return [];
  const scheduled: Array<Promise<string | null>> = [];

  if (pet.lifecycle === 'available') {
    const daysUntilLowMood = Math.max(0, (pet.mood - 20) / moodDecayPerDay);
    const lowMoodAt = pet.lastNeedsUpdatedAt + daysUntilLowMood * dayMilliseconds;
    scheduled.push(scheduleAt(
      lowMoodAt,
      `${pet.nickname} 有點想你了`,
      '心情快接近低點。打開 ExplorePath 陪伴牠，或完成一趟一般探索。',
      now,
    ));
  }

  if (pet.lifecycle === 'countdown' && pet.countdownStartedAt != null) {
    scheduled.push(scheduleAt(
      pet.countdownStartedAt + departureCountdownMilliseconds,
      `${pet.nickname} 暫時離開了`,
      '你仍有 7 天可以用尋回探索或照顧道具把牠帶回來。',
      now,
    ));
  }

  if (pet.lifecycle === 'departed' && pet.departedAt != null) {
    scheduled.push(scheduleAt(
      pet.departedAt + memoryDeadlineMilliseconds - dayMilliseconds,
      `尋回 ${pet.nickname} 還剩 24 小時`,
      '完成尋回探索或使用照顧道具，超過期限後會成為永久回憶。',
      now,
    ));
  }

  if (pet.lifecycle === 'rescuing' && pet.rescueReadyAt != null) {
    scheduled.push(scheduleAt(
      pet.rescueReadyAt,
      `${pet.nickname} 回來了`,
      '照顧道具已完成尋回，打開 ExplorePath 看看牠。',
      now,
    ));
  }

  return (await Promise.all(scheduled)).filter((id): id is string => typeof id === 'string');
}
