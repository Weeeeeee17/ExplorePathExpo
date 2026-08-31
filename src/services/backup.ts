import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import {
  ExplorePathBackupPayload,
  parseBackupPayload,
} from '../domain/backupFormat';

export async function exportBackupFile(payload: ExplorePathBackupPayload): Promise<void> {
  const date = new Date(payload.exportedAt).toISOString().slice(0, 10);
  const uri = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}ExplorePath-v0.9.1-backup-${date}.json`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(payload, null, 2));
  if (!(await Sharing.isAvailableAsync())) throw new Error('這支裝置目前無法開啟分享選單。');
  await Sharing.shareAsync(uri, {
    dialogTitle: '儲存 ExplorePath 備份',
    mimeType: 'application/json',
    UTI: 'public.json',
  });
}

export async function chooseBackupFile(): Promise<ExplorePathBackupPayload | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/json', 'public.json'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets[0]?.uri) return null;
  const text = await FileSystem.readAsStringAsync(result.assets[0].uri);
  return parseBackupPayload(text);
}

export async function shareMemoryImage(uri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('這支裝置目前無法開啟分享選單。');
  await Sharing.shareAsync(uri, {
    dialogTitle: '分享 ExplorePath 旅程回憶',
    mimeType: 'image/png',
    UTI: 'public.png',
  });
}
