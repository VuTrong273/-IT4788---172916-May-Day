import { useCallback, useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { appColors } from '@/constants/app-theme';
import type { Session } from '@/features/auth/session';
import type { MedicalRecordAnswer, TemplateQuestion } from '@/features/doctor/medical-records-api';
import {
  imageAttachmentsApi,
  validateImageSelection,
  type AnswerImage,
  type ImageAttachment,
  type ImageFileMetadata,
} from '@/features/records/image-attachments-api';

type SelectedImage = ImagePicker.ImagePickerAsset;

const imageMetadata = (asset: SelectedImage): ImageFileMetadata => ({
  fileName: asset.fileName,
  mimeType: asset.mimeType,
  fileSize: asset.fileSize,
  uri: asset.uri,
});

function imageName(asset: SelectedImage): string {
  if (asset.fileName) return asset.fileName;
  const extension = asset.mimeType?.split('/')[1] ?? 'jpg';
  return `image-${Date.now()}.${extension === 'jpeg' ? 'jpg' : extension}`;
}

async function appendImage(form: FormData, field: string, asset: SelectedImage): Promise<void> {
  const name = imageName(asset);
  const mimeType = asset.mimeType ?? 'image/jpeg';
  if (Platform.OS === 'web') {
    if (asset.file) {
      form.append(field, asset.file, name);
    } else {
      const response = await fetch(asset.uri);
      if (!response.ok) throw new Error('Không đọc được ảnh đã chọn trên trình duyệt.');
      form.append(field, await response.blob(), name);
    }
    return;
  }

  form.append(field, {
    uri: asset.uri,
    name,
    type: mimeType,
  } as unknown as Blob);
}

async function chooseImages(multiple: boolean): Promise<{
  assets: SelectedImage[];
  error?: string;
} | null> {
  if (Platform.OS !== 'web') {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        return {
          assets: [],
          error: 'Chưa được cấp quyền chọn ảnh. Hãy bật quyền Ảnh trong Cài đặt thiết bị hoặc tiếp tục không đính kèm ảnh.',
        };
      }
    } catch {
      return {
        assets: [],
        error: 'Không thể kiểm tra quyền truy cập ảnh. Hãy kiểm tra quyền Ảnh trong Cài đặt thiết bị.',
      };
    }
  }

  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: multiple,
      selectionLimit: multiple ? 10 : 1,
      quality: 1,
    });
    if (result.canceled) return null;
    const assets = result.assets ?? [];
    return { assets };
  } catch {
    return {
      assets: [],
      error: 'Không mở được trình chọn ảnh. Hãy kiểm tra quyền truy cập rồi thử lại.',
    };
  }
}

function displaySize(bytes?: number | null): string {
  if (bytes === undefined || bytes === null || !Number.isFinite(bytes)) {
    return 'Kích thước chưa được thiết bị cung cấp; máy chủ sẽ kiểm tra giới hạn 5 MB.';
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function loadRecordImages(
  session: Session,
  patientId: number,
  recordId: number,
  includeUploaderImages: boolean,
): Promise<{ images: ImageAttachment[]; warning: string | null }> {
  const userIds = [...new Set([
    patientId,
    ...(includeUploaderImages && session.user.user_id !== patientId ? [session.user.user_id] : []),
  ])];
  const results = await Promise.all(userIds.map(async (userId) => {
    try {
      return { userId, images: await imageAttachmentsApi.listForUser(session, userId) };
    } catch (error) {
      return {
        userId,
        error: error instanceof Error ? error : new Error('Không tải được thư viện ảnh.'),
      };
    }
  }));
  const loaded = results.filter(
    (result): result is { userId: number; images: ImageAttachment[] } => 'images' in result,
  );
  const failed = results.filter(
    (result): result is { userId: number; error: Error } => 'error' in result,
  );
  if (!loaded.length && failed.length) throw failed[0].error;

  const uniqueImages = new Map<string, ImageAttachment>();
  for (const result of loaded) {
    for (const image of result.images) {
      if (result.userId !== patientId && String(image.medical_record_id) !== String(recordId)) continue;
      uniqueImages.set(String(image.id), image);
    }
  }
  return {
    images: [...uniqueImages.values()],
    warning: failed.length
      ? `Không tải được một phần danh sách ảnh: ${failed.map((result) => result.error.message).join('; ')}`
      : null,
  };
}

function FilePreview({ asset }: { asset: SelectedImage }) {
  return (
    <View style={styles.filePreview}>
      <Image accessibilityLabel={`Ảnh xem trước ${imageName(asset)}`} source={{ uri: asset.uri }} style={styles.previewImage} />
      <View style={styles.fileDetails}>
        <Text numberOfLines={2} style={styles.fileName}>{imageName(asset)}</Text>
        <Text style={styles.meta}>{asset.mimeType ?? 'Không rõ định dạng'} · {displaySize(asset.fileSize)}</Text>
      </View>
    </View>
  );
}

export function RecordImageLibrary({
  session,
  patientId,
  recordId,
  refreshToken,
  canUpload,
  canDelete,
  onChanged,
}: {
  session: Session;
  patientId: number;
  recordId: number;
  refreshToken: number;
  canUpload: boolean;
  canDelete: boolean;
  onChanged: () => void;
}) {
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedImage[]>([]);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadImages = useCallback(async () => {
    try {
      const result = await loadRecordImages(session, patientId, recordId, canUpload);
      setImages(result.images);
      setLoadError(result.warning);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Không tải được thư viện ảnh.');
    } finally {
      setLoading(false);
    }
  }, [session, patientId, recordId, canUpload]);

  useEffect(() => {
    let active = true;
    void loadRecordImages(session, patientId, recordId, canUpload)
      .then((result) => {
        if (!active) return;
        setImages(result.images);
        setLoadError(result.warning);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Không tải được thư viện ảnh.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [session, patientId, recordId, canUpload, refreshToken]);

  async function pickImages() {
    setUploadError(null);
    setMessage(null);
    const result = await chooseImages(true);
    if (!result) return;
    if (result.error) {
      setSelectionError(result.error);
      setSelected([]);
      return;
    }
    const validation = validateImageSelection(result.assets.map(imageMetadata), 10);
    setSelected(result.assets);
    setSelectionError(validation);
  }

  async function uploadSelected() {
    if (!canUpload || uploading || !selected.length || selectionError) return;
    setUploading(true);
    setUploadError(null);
    setMessage(null);
    try {
      const form = new FormData();
      for (const asset of selected) await appendImage(form, 'images', asset);
      const result = await imageAttachmentsApi.uploadMultiple(session, form);
      setMessage(`Máy chủ xác nhận đã tải lên ${result.total ?? result.images.length} ảnh.`);
      setSelected([]);
      setSelectionError(null);
      await loadImages();
      onChanged();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Không tải được ảnh lên máy chủ.');
    } finally {
      setUploading(false);
    }
  }

  async function deleteImage(id: string | number) {
    if (!canDelete || deletingId) return;
    const value = String(id);
    setDeletingId(value);
    setUploadError(null);
    setMessage(null);
    try {
      await imageAttachmentsApi.deleteAttachment(session, id);
      setDeleteConfirmId(null);
      setMessage('Máy chủ xác nhận đã xóa ảnh.');
      await loadImages();
      onChanged();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Không xóa được ảnh.');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Thư viện ảnh bệnh án</Text>
      <Text style={styles.meta}>Ảnh của bệnh nhân và ảnh do người đang đăng nhập tải lên cho bệnh án này, theo quyền máy chủ. Ảnh đã tải lên chưa chắc đã được gắn vào câu trả lời.</Text>
      {loading ? <ActivityIndicator color={appColors.primary} style={styles.loading} /> : null}
      {loadError ? (
        <View accessibilityLiveRegion="polite">
          <Text style={styles.error}>Không tải được thư viện ảnh: {loadError}</Text>
          <TextButton label="Thử tải lại" onPress={() => void loadImages()} />
        </View>
      ) : null}
      {!loading && !loadError && images.length === 0 ? (
        <Text style={styles.meta}>Máy chủ trả về chưa có ảnh nào.</Text>
      ) : null}
      {images.map((image) => (
        <View key={String(image.id)} style={styles.galleryItem}>
          {image.file_url ? (
            <Image accessibilityLabel={image.file_name ?? 'Ảnh đính kèm'} source={{ uri: image.file_url }} style={styles.galleryImage} />
          ) : <View style={styles.missingPreview}><Text style={styles.meta}>Không có URL ảnh</Text></View>}
          <View style={styles.fileDetails}>
            <Text numberOfLines={2} style={styles.fileName}>{image.file_name ?? `Ảnh #${image.id}`}</Text>
            <Text style={styles.meta}>
              {image.file_type ?? 'Không rõ định dạng'}{image.question_id ? ` · Câu hỏi ${image.question_id}` : ''}
            </Text>
            {canDelete ? (
              deleteConfirmId === String(image.id) ? (
                <View style={styles.inlineActions}>
                  <TextButton
                    disabled={deletingId === String(image.id)}
                    label={deletingId === String(image.id) ? 'Đang xóa…' : 'Xác nhận xóa'}
                    onPress={() => void deleteImage(image.id)}
                  />
                  <TextButton label="Hủy" onPress={() => setDeleteConfirmId(null)} />
                </View>
              ) : (
                <TextButton label="Xóa ảnh" onPress={() => setDeleteConfirmId(String(image.id))} />
              )
            ) : null}
          </View>
        </View>
      ))}
      {canUpload ? (
        <>
          <Text style={styles.meta}>Chọn tối đa 10 ảnh JPG, JPEG, PNG hoặc WebP; mỗi ảnh tối đa 5 MB.</Text>
          <Button disabled={uploading} label="Chọn ảnh" onPress={() => void pickImages()} />
          {selected.map((asset) => <FilePreview key={`${asset.uri}-${asset.fileName}`} asset={asset} />)}
          {selectionError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{selectionError}</Text> : null}
          {selected.length > 0 && !selectionError ? (
            <Button disabled={uploading} label={uploading ? 'Đang tải ảnh…' : `Tải lên ${selected.length} ảnh`} onPress={() => void uploadSelected()} />
          ) : null}
        </>
      ) : null}
      {uploadError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{uploadError}</Text> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.success}>{message}</Text> : null}
    </View>
  );
}

export function QuestionImageWorkflow({
  session,
  recordId,
  question,
  answer,
  optionValue,
  canEdit,
  refreshToken,
  onChanged,
}: {
  session: Session;
  recordId: number;
  question: TemplateQuestion;
  answer?: MedicalRecordAnswer;
  optionValue?: string;
  canEdit: boolean;
  refreshToken: number;
  onChanged: () => void;
}) {
  const [linkedImages, setLinkedImages] = useState<AnswerImage[]>([]);
  const [loading, setLoading] = useState(!!answer);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedImage | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<ImageAttachment | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [unlinkConfirmId, setUnlinkConfirmId] = useState<string | null>(null);

  const loadLinkedImages = useCallback(async () => {
    if (!answer) {
      setLinkedImages([]);
      setLoading(false);
      return;
    }
    try {
      const result = await imageAttachmentsApi.listForAnswer(session, answer.id);
      setLinkedImages(result);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Không tải được ảnh của câu trả lời.');
    } finally {
      setLoading(false);
    }
  }, [answer, session]);

  useEffect(() => {
    let active = true;
    if (!answer) {
      void Promise.resolve([])
        .then((result) => {
          if (active) {
            setLinkedImages(result);
            setLoading(false);
          }
        });
      return () => { active = false; };
    }
    void imageAttachmentsApi.listForAnswer(session, answer.id)
      .then((result) => {
        if (!active) return;
        setLinkedImages(result);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Không tải được ảnh của câu trả lời.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [answer, session, refreshToken]);

  async function pickImage() {
    setSelectionError(null);
    setOperationError(null);
    setMessage(null);
    const result = await chooseImages(false);
    if (!result) return;
    if (result.error) {
      setSelectionError(result.error);
      setSelected(null);
      return;
    }
    const asset = result.assets[0];
    const validation = validateImageSelection(asset ? [imageMetadata(asset)] : [], 1);
    setSelected(asset ?? null);
    setSelectionError(validation);
  }

  async function uploadAndLink() {
    if (!canEdit || working || !selected || selectionError) return;
    setWorking(true);
    setOperationError(null);
    setMessage(null);
    try {
      const form = new FormData();
      await appendImage(form, 'file', selected);
      form.append('medical_record_id', String(recordId));
      form.append('question_id', question.question_id);
      form.append('media_type', 'image');
      const attachment = await imageAttachmentsApi.uploadOne(session, form);
      setPendingAttachment(attachment);
      setSelected(null);
      onChanged();
      if (answer) {
        await linkAttachment(attachment, answer.id, true);
      } else {
        setMessage('Máy chủ đã nhận ảnh, nhưng chưa gắn vào câu trả lời: chưa có câu trả lời đã lưu để lấy answer_id.');
      }
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Không tải được ảnh lên máy chủ.');
    } finally {
      setWorking(false);
    }
  }

  async function linkAttachment(
    attachment: ImageAttachment,
    answerId: number,
    uploadAlreadyInProgress = false,
  ) {
    if (!canEdit || (working && !uploadAlreadyInProgress)) return;
    setWorking(true);
    setOperationError(null);
    setMessage(null);
    try {
      await imageAttachmentsApi.linkToAnswer(session, {
        answer_id: answerId,
        attachment_id: attachment.id,
        ...(optionValue ? { option_value: optionValue } : {}),
      });
      setPendingAttachment(null);
      setMessage('Máy chủ xác nhận đã gắn ảnh vào câu trả lời.');
      await loadLinkedImages();
      onChanged();
    } catch (error) {
      setOperationError(
        `Ảnh đã tải lên nhưng chưa được gắn vào câu trả lời: ${error instanceof Error ? error.message : 'Lỗi API.'}`,
      );
    } finally {
      setWorking(false);
    }
  }

  async function unlinkImage(id: string | number) {
    if (!canEdit || unlinkingId) return;
    const value = String(id);
    setUnlinkingId(value);
    setOperationError(null);
    setMessage(null);
    try {
      await imageAttachmentsApi.unlinkFromAnswer(session, id);
      setUnlinkConfirmId(null);
      setMessage('Máy chủ xác nhận đã gỡ liên kết. Tệp ảnh vẫn còn trong thư viện.');
      await loadLinkedImages();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'Không gỡ được liên kết ảnh.');
    } finally {
      setUnlinkingId(null);
    }
  }

  const supportsImages = question.type_question === 'image'
    || question.allow_image === 1
    || question.options.some((option) => option.trigger_image_upload === 1);
  if (!supportsImages) return null;

  return (
    <View style={styles.imageWorkflow}>
      <Text style={styles.subtitle}>Ảnh đính kèm câu trả lời</Text>
      {loading ? <ActivityIndicator color={appColors.primary} /> : null}
      {loadError ? (
        <View accessibilityLiveRegion="polite">
          <Text style={styles.error}>Không tải được ảnh liên kết: {loadError}</Text>
          <TextButton label="Tải lại ảnh câu trả lời" onPress={() => void loadLinkedImages()} />
        </View>
      ) : null}
      {!loading && !loadError && linkedImages.length === 0 ? (
        <Text style={styles.meta}>Máy chủ chưa trả về ảnh đã gắn cho câu trả lời này.</Text>
      ) : null}
      {linkedImages.map((linked) => (
        <View key={String(linked.id)} style={styles.linkedImage}>
          {linked.attachment?.file_url ? (
            <Image accessibilityLabel={linked.attachment.file_name ?? 'Ảnh câu trả lời'} source={{ uri: linked.attachment.file_url }} style={styles.previewImage} />
          ) : <View style={styles.missingPreview}><Text style={styles.meta}>Không có URL ảnh</Text></View>}
          <View style={styles.fileDetails}>
            <Text style={styles.fileName}>{linked.attachment?.file_name ?? `Ảnh liên kết #${linked.id}`}</Text>
            {linked.option_value ? <Text style={styles.meta}>Lựa chọn: {linked.option_value}</Text> : null}
            {canEdit ? unlinkConfirmId === String(linked.id) ? (
              <View style={styles.inlineActions}>
                <TextButton
                  disabled={unlinkingId === String(linked.id)}
                  label={unlinkingId === String(linked.id) ? 'Đang gỡ…' : 'Xác nhận gỡ'}
                  onPress={() => void unlinkImage(linked.id)}
                />
                <TextButton label="Hủy" onPress={() => setUnlinkConfirmId(null)} />
              </View>
            ) : (
              <TextButton label="Gỡ liên kết" onPress={() => setUnlinkConfirmId(String(linked.id))} />
            ) : null}
          </View>
        </View>
      ))}
      {canEdit ? (
        <>
          {!answer ? (
            <Text style={styles.meta}>
              Cần lưu câu trả lời trước để máy chủ cấp answer_id. Có thể tải ảnh lên trước; ảnh sẽ được ghi nhận là chưa liên kết cho đến khi có câu trả lời.
            </Text>
          ) : null}
          {pendingAttachment ? (
            <View style={styles.pendingCard}>
              <Text style={styles.meta}>
                Ảnh #{pendingAttachment.id} đã tải lên{pendingAttachment.file_name ? ` (${pendingAttachment.file_name})` : ''}, hiện chưa liên kết.
              </Text>
              {answer ? (
                <Button
                  disabled={working}
                  label={working ? 'Đang gắn…' : 'Gắn ảnh đã tải lên'}
                  onPress={() => void linkAttachment(pendingAttachment, answer.id)}
                />
              ) : null}
            </View>
          ) : null}
          <Button disabled={working} label="Chọn ảnh cho câu trả lời" onPress={() => void pickImage()} />
          {selected ? <FilePreview asset={selected} /> : null}
          {selectionError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{selectionError}</Text> : null}
          {selected && !selectionError ? (
            <Button
              disabled={working}
              label={working ? 'Đang xử lý…' : answer ? 'Tải lên và gắn ảnh' : 'Tải ảnh lên'}
              onPress={() => void uploadAndLink()}
            />
          ) : null}
        </>
      ) : null}
      {operationError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{operationError}</Text> : null}
      {message ? <Text accessibilityLiveRegion="polite" style={styles.success}>{message}</Text> : null}
    </View>
  );
}

function Button({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.disabled]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

function TextButton({
  label,
  disabled = false,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={styles.textButton}>
      <Text style={[styles.link, disabled && styles.disabled]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: appColors.border, backgroundColor: appColors.surface, gap: 12 },
  title: { color: appColors.ink, fontSize: 18, fontWeight: '800' },
  subtitle: { color: appColors.ink, fontSize: 14, fontWeight: '800' },
  meta: { color: appColors.muted, fontSize: 12, lineHeight: 18 },
  loading: { marginVertical: 8 },
  galleryItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: appColors.border },
  galleryImage: { width: 76, height: 76, borderRadius: 10, backgroundColor: appColors.canvas },
  previewImage: { width: 88, height: 88, borderRadius: 10, backgroundColor: appColors.canvas },
  missingPreview: { width: 88, height: 76, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: appColors.canvas },
  filePreview: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderWidth: 1, borderColor: appColors.border, borderRadius: 12, backgroundColor: appColors.canvas },
  fileDetails: { flex: 1, gap: 4 },
  fileName: { color: appColors.ink, fontSize: 13, fontWeight: '700' },
  imageWorkflow: { marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: appColors.canvas, gap: 9 },
  linkedImage: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: appColors.border },
  pendingCard: { padding: 10, borderRadius: 10, borderWidth: 1, borderColor: appColors.border },
  button: { minHeight: 42, justifyContent: 'center', alignItems: 'center', marginTop: 4, paddingHorizontal: 13, borderRadius: 10, backgroundColor: appColors.primary },
  buttonText: { color: appColors.surface, fontSize: 13, fontWeight: '800' },
  textButton: { minHeight: 38, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 5 },
  link: { color: appColors.primaryDark, fontSize: 13, fontWeight: '700' },
  inlineActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  error: { color: '#A62F3D', fontSize: 12, lineHeight: 18 },
  success: { color: '#117447', fontSize: 12, fontWeight: '700', lineHeight: 18 },
  disabled: { opacity: 0.45 },
});
