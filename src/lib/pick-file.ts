import { File as DeviceFile } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Alert, Linking } from "react-native";

/** A local file ready to upload (useUploadTaskFile). */
export type PickedFile = { uri: string; name: string; mimeType: string; size?: number | null };

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  mov: "video/quicktime",
  pdf: "application/pdf",
};

function guessMime(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function fromAsset(a: ImagePicker.ImagePickerAsset): PickedFile {
  const ext = a.type === "video" ? "mp4" : "jpg";
  const name = a.fileName || a.uri.split("/").pop() || `${a.type === "video" ? "video" : "photo"}-${Date.now()}.${ext}`;
  return { uri: a.uri, name, mimeType: a.mimeType || guessMime(name), size: a.fileSize ?? null };
}

const IMAGE_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images", "videos"],
  quality: 0.85,
  // iOS: hand us JPEG / H.264, not HEIC / HEVC, so the file opens in every browser.
  preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
};

/** Photo library (iOS shows the system picker; no permission prompt needed). */
export async function pickFromLibrary(): Promise<PickedFile | null> {
  const r = await ImagePicker.launchImageLibraryAsync(IMAGE_OPTIONS);
  return r.canceled || !r.assets?.[0] ? null : fromAsset(r.assets[0]);
}

/** Camera — asks for permission the first time; points to Settings if it was refused. */
export async function takePhoto(): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Camera access is off", "Allow Ninja Loop to use the camera in Settings to attach photos.", [
      { text: "Not now", style: "cancel" },
      { text: "Open Settings", onPress: () => void Linking.openSettings() },
    ]);
    return null;
  }
  const r = await ImagePicker.launchCameraAsync({ ...IMAGE_OPTIONS, mediaTypes: ["images"] });
  return r.canceled || !r.assets?.[0] ? null : fromAsset(r.assets[0]);
}

/** Any document (iOS Files / Android document picker) — expo-file-system's built-in picker. */
export async function pickDocument(): Promise<PickedFile | null> {
  const r = await DeviceFile.pickFileAsync();
  if (r.canceled || !r.result) return null;
  const f = r.result;
  const name = f.name || `file-${Date.now()}`;
  return { uri: f.uri, name, mimeType: f.type || guessMime(name), size: f.size };
}
