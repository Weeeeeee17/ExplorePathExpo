import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

const memoryPhotoDirectory = `${FileSystem.documentDirectory ?? ''}explorepath-memory-photos/`;

export type MemoryPhotoResult =
  | { status: 'saved'; uri: string }
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'error' };

async function persistPhoto(sourceUri: string, recordId: string, extension = 'jpg') {
  await FileSystem.makeDirectoryAsync(memoryPhotoDirectory, { intermediates: true });
  const safeExtension = extension.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg';
  const destination = `${memoryPhotoDirectory}${recordId}-${Date.now()}.${safeExtension}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  return destination;
}

export async function captureMemoryPhoto(recordId: string): Promise<MemoryPhotoResult> {
  try {
    const current = await ImagePicker.getCameraPermissionsAsync();
    const permission = current.granted
      ? current
      : await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { status: 'denied' };
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      exif: false,
      mediaTypes: ['images'],
      quality: 0.82,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset?.uri) return { status: 'cancelled' };
    const extension = asset.fileName?.split('.').pop() ?? 'jpg';
    return { status: 'saved', uri: await persistPhoto(asset.uri, recordId, extension) };
  } catch {
    return { status: 'error' };
  }
}

export async function pickMemoryPhoto(recordId: string): Promise<MemoryPhotoResult> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [9, 16],
      exif: false,
      mediaTypes: ['images'],
      quality: 0.82,
    });
    const asset = result.assets?.[0];
    if (result.canceled || !asset?.uri) return { status: 'cancelled' };
    const extension = asset.fileName?.split('.').pop() ?? 'jpg';
    return { status: 'saved', uri: await persistPhoto(asset.uri, recordId, extension) };
  } catch {
    return { status: 'error' };
  }
}

export async function deleteMemoryPhoto(uri?: string | null): Promise<void> {
  if (!uri || !uri.startsWith(memoryPhotoDirectory)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}
