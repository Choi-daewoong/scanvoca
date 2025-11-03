import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput } from 'react-native';

interface CreateWordbookModalProps {
  visible: boolean;
  wordbookName: string;
  onChangeName: (name: string) => void;
  onCreate: () => void;
  onClose: () => void;
}

export default function CreateWordbookModal({
  visible,
  wordbookName,
  onChangeName,
  onCreate,
  onClose,
}: CreateWordbookModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>새 단어장 만들기</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="단어장 이름을 입력하세요"
            value={wordbookName}
            onChangeText={onChangeName}
            maxLength={20}
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnCancel]}
              onPress={onClose}
            >
              <Text style={styles.modalBtnText}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modalBtn,
                styles.modalBtnConfirm,
                !wordbookName.trim() && { opacity: 0.5 }
              ]}
              onPress={onCreate}
              disabled={!wordbookName.trim()}
            >
              <Text style={styles.modalBtnText}>만들기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: '#6c757d',
    marginRight: 8,
  },
  modalBtnConfirm: {
    backgroundColor: '#4f46e5',
    marginLeft: 8,
  },
  modalBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
