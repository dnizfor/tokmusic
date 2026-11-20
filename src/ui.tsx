import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export const C = {
  bg: '#0B0B0F',
  card: '#16161D',
  card2: '#1E1E27',
  line: '#24242E',
  text: '#F5F5F7',
  dim: '#8A8A96',
  pink: '#FE2C55',
  cyan: '#25F4EE',
};

export function Cover({ uri, size, radius = 8 }: { uri: string | null | undefined; size: number; radius?: number }) {
  return uri ? (
    <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius }} contentFit="cover" />
  ) : (
    <View style={[{ width: size, height: size, borderRadius: radius }, u.coverFallback]}>
      <Ionicons name="musical-note" size={size * 0.45} color={C.dim} />
    </View>
  );
}

/** Bottom sheet with a dimmed backdrop. */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={u.backdrop} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={u.sheet}>
          <View style={u.grabber} />
          {title ? (
            <Text style={u.sheetTitle} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {children}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SheetItem({
  icon,
  label,
  onPress,
  danger,
  right,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [u.item, pressed && { backgroundColor: C.card2 }]}>
      <Ionicons name={icon} size={20} color={danger ? C.pink : C.text} />
      <Text style={[u.itemText, danger && { color: C.pink }]} numberOfLines={1}>
        {label}
      </Text>
      {right}
    </Pressable>
  );
}

/** Small "enter a name" dialog (Alert.prompt is iOS-only). */
type PromptProps = {
  visible: boolean;
  title: string;
  initial?: string;
  placeholder?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
};

export function NamePrompt(props: PromptProps) {
  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onCancel} statusBarTranslucent>
      {props.visible ? <PromptBody {...props} /> : null}
    </Modal>
  );
}

function PromptBody({ title, initial = '', placeholder, confirmLabel = 'Save', onCancel, onSubmit }: PromptProps) {
  const [value, setValue] = useState(initial);
  const ok = value.trim().length > 0;
  const submit = () => ok && onSubmit(value.trim());
  return (
    <KeyboardAvoidingView style={u.center} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
      <View style={u.dialog}>
        <Text style={u.dialogTitle}>{title}</Text>
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          placeholderTextColor={C.dim}
          style={u.input}
          autoFocus
          onSubmitEditing={submit}
          returnKeyType="done"
          selectTextOnFocus
        />
        <View style={u.dialogBtns}>
          <Pressable onPress={onCancel} hitSlop={8} style={u.dialogBtn}>
            <Text style={{ color: C.dim, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
          <Pressable onPress={submit} hitSlop={8} style={[u.dialogBtn, !ok && { opacity: 0.4 }]}>
            <Text style={{ color: C.pink, fontWeight: '700' }}>{confirmLabel}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** In-app confirm dialog (replaces the native Android Alert). */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Delete',
  danger = true,
  icon = 'trash-outline',
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const accent = danger ? C.pink : C.cyan;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={u.center}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={[u.dialog, { alignItems: 'center', paddingTop: 26 }]}>
          <View style={[u.confirmIcon, { backgroundColor: danger ? 'rgba(254,44,85,0.12)' : 'rgba(37,244,238,0.12)' }]}>
            <Ionicons name={icon} size={28} color={accent} />
          </View>
          <Text style={[u.dialogTitle, { textAlign: 'center' }]}>{title}</Text>
          {message ? <Text style={u.confirmMsg}>{message}</Text> : null}
          <View style={u.confirmBtns}>
            <Pressable onPress={onCancel} style={({ pressed }) => [u.confirmBtn, u.confirmCancel, pressed && { opacity: 0.7 }]}>
              <Text style={{ color: C.text, fontWeight: '700', fontSize: 15 }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [u.confirmBtn, { backgroundColor: accent }, pressed && { opacity: 0.8 }]}
            >
              <Text style={{ color: danger ? '#fff' : C.bg, fontWeight: '700', fontSize: 15 }}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function Chip({
  label,
  active,
  onPress,
  onLongPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [u.chip, active && u.chipActive, pressed && { opacity: 0.7 }]}
    >
      {icon ? <Ionicons name={icon} size={14} color={active ? '#fff' : C.text} /> : null}
      <Text style={[u.chipText, active && { color: '#fff' }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export const u = StyleSheet.create({
  coverFallback: { backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 8, paddingBottom: 8, maxHeight: '88%' },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.line, marginBottom: 8 },
  sheetTitle: { color: C.text, fontSize: 16, fontWeight: '700', paddingHorizontal: 20, paddingVertical: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  itemText: { color: C.text, fontSize: 15, flex: 1 },
  center: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  dialog: { width: '100%', backgroundColor: C.card, borderRadius: 18, padding: 20, gap: 14 },
  dialogTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  dialogBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 22 },
  dialogBtn: { paddingVertical: 4 },
  input: { backgroundColor: C.bg, color: C.text, borderRadius: 12, paddingHorizontal: 14, height: 46, fontSize: 15, borderWidth: 1, borderColor: C.line },
  confirmIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  confirmMsg: { color: C.dim, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: -4 },
  confirmBtns: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 6 },
  confirmBtn: { flex: 1, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  confirmCancel: { backgroundColor: C.card2, borderWidth: 1, borderColor: C.line },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, maxWidth: 200 },
  chipActive: { backgroundColor: C.pink, borderColor: C.pink },
  chipText: { color: C.text, fontSize: 13, fontWeight: '600' },
});
