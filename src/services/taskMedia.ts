import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';

const taskPhotoDirectory = `${FileSystem.documentDirectory ?? ''}explorepath-task-photos/`;

export type TaskPhotoResult =
  | { status: 'saved'; uri: string }
  | { status: 'cancelled' }
  | { status: 'denied' }
  | { status: 'error' };

export async function captureTaskPhoto(journeyId: string): Promise<TaskPhotoResult> {
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
      quality: 0.78,
    });
    if (result.canceled || !result.assets[0]?.uri) return { status: 'cancelled' };

    await FileSystem.makeDirectoryAsync(taskPhotoDirectory, { intermediates: true });
    const extension = result.assets[0].fileName?.split('.').pop()?.toLowerCase() || 'jpg';
    const destination = `${taskPhotoDirectory}${journeyId}-${Date.now()}.${extension}`;
    await FileSystem.copyAsync({ from: result.assets[0].uri, to: destination });
    return { status: 'saved', uri: destination };
  } catch {
    return { status: 'error' };
  }
}

export async function saveTaskPhotoToLibrary(uri: string): Promise<boolean> {
  try {
    const current = await MediaLibrary.getPermissionsAsync(true);
    const permission = current.granted ? current : await MediaLibrary.requestPermissionsAsync(true);
    if (!permission.granted) return false;
    await MediaLibrary.saveToLibraryAsync(uri);
    return true;
  } catch {
    return false;
  }
}
