import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
} from 'react-native';

interface RenameGroupModalProps {
  visible: boolean;
  currentName: string;
  newName: string;
  onChangeName: (name: string) => void;
  onRename: () => void;
  onClose: () => void;
}

export default function RenameGroupModal({
  visible,
  currentName,
  newName,
  onChangeName,
  onRename,
  onClose,
}: RenameGroupModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>그룹 이름 변경</Text>

          <View style={styles.currentNameContainer}>
            <Text style={styles.currentNameLabel}>현재 이름:</Text>
            <Text style={styles.currentName}>{currentName}</Text>
          </View>

          <TextInput
            style={styles.modalInput}
            placeholder="새로운 그룹 이름을 입력하세요"
            value={newName}
            onChangeText={onChangeName}
            maxLength={20}
            autoFocus
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
                !newName.trim() && { opacity: 0.5 }
              ]}
              onPress={onRename}
              disabled={!newName.trim()}
            >
              <Text style={styles.modalBtnText}>변경</Text>
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
    marginBottom: 16,
    textAlign: 'center',
  },
  currentNameContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  currentNameLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 4,
  },
  currentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
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
