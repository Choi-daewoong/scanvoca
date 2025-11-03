import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { WordbookItem } from '../../hooks/useWordbookManagement';

interface CreateGroupModalProps {
  visible: boolean;
  groupName: string;
  selectedWordbooks: number[];
  wordbooks: WordbookItem[];
  onChangeName: (name: string) => void;
  onCreate: () => void;
  onClose: () => void;
}

export default function CreateGroupModal({
  visible,
  groupName,
  selectedWordbooks,
  wordbooks,
  onChangeName,
  onCreate,
  onClose,
}: CreateGroupModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>새 그룹 만들기</Text>

          {/* Group Preview */}
          <View style={styles.groupPreview}>
            <Text style={styles.groupPreviewTitle}>그룹에 포함될 단어장:</Text>
            <ScrollView style={styles.groupPreviewItems}>
              {selectedWordbooks.map(id => {
                const wordbook = wordbooks.find(wb => wb.id === id);
                return (
                  <Text key={id} style={styles.groupPreviewItem}>
                    {wordbook?.icon} {wordbook?.name}
                  </Text>
                );
              })}
            </ScrollView>
          </View>

          <TextInput
            style={styles.modalInput}
            placeholder="그룹 이름을 입력하세요"
            value={groupName}
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
                !groupName.trim() && { opacity: 0.5 }
              ]}
              onPress={onCreate}
              disabled={!groupName.trim()}
            >
              <Text style={styles.modalBtnText}>그룹 만들기</Text>
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
  groupPreview: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  groupPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 8,
  },
  groupPreviewItems: {
    maxHeight: 120,
  },
  groupPreviewItem: {
    fontSize: 14,
    color: '#212529',
    marginBottom: 4,
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
