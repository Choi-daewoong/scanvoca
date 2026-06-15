'use client';

import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import Link from 'next/link';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { wordbookService } from '@/services/wordbookService';
import { Wordbook, WordbookOrderItem } from '@/types';

export interface WordbookWithProgress extends Wordbook {
  masteredCount?: number;
}

const ROOT = 'root';
const folderKey = (id: number) => `folder-${id}`;
const folderIdFromKey = (key: string) => Number(key.slice('folder-'.length));

const COMBINE_HOLD_MS = 600;

interface WordbookBoardProps {
  wordbooks: WordbookWithProgress[];
  setWordbooks: Dispatch<SetStateAction<WordbookWithProgress[]>>;
  onDelete: (id: number, name: string) => void;
  onRename: (id: number, currentName: string) => void;
}

export default function WordbookBoard({ wordbooks, setWordbooks, onDelete, onRename }: WordbookBoardProps) {
  const wbById = useMemo(() => {
    const map = new Map<number, WordbookWithProgress>();
    wordbooks.forEach((wb) => map.set(wb.id, wb));
    return map;
  }, [wordbooks]);

  const buildContainers = (wbs: WordbookWithProgress[]): Record<string, number[]> => {
    const idSet = new Set(wbs.map((wb) => wb.id));
    const root: number[] = [];
    const byParent: Record<number, number[]> = {};
    const sorted = [...wbs].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    for (const wb of sorted) {
      if (wb.parent_id != null && idSet.has(wb.parent_id)) {
        (byParent[wb.parent_id] ??= []).push(wb.id);
      } else {
        root.push(wb.id);
      }
    }
    const next: Record<string, number[]> = { [ROOT]: root };
    for (const [pid, ids] of Object.entries(byParent)) {
      next[folderKey(Number(pid))] = ids;
    }
    return next;
  };

  const signature = useMemo(
    () =>
      JSON.stringify(
        [...wordbooks]
          .sort((a, b) => a.id - b.id)
          .map((wb) => [wb.id, wb.parent_id ?? null, wb.sort_order, wb.is_folder])
      ),
    [wordbooks]
  );

  const [containers, setContainers] = useState<Record<string, number[]>>(() => buildContainers(wordbooks));
  const [prevSignature, setPrevSignature] = useState(signature);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [activeId, setActiveId] = useState<number | null>(null);
  // 폴더로 합치기 후보(드래그 오버 시 즉시 표시되는 시각적 하이라이트)
  const [hoverTarget, setHoverTarget] = useState<{ id: number; mode: 'folder' | 'merge' } | null>(null);
  // 일정 시간 이상 머무르면 실제 합치기를 실행할 대상 (ref: 드롭 시점 동기 판정용, state: 모션 표시용)
  const armedTargetRef = useRef<{ id: number; mode: 'folder' | 'merge' } | null>(null);
  const [armedTarget, setArmedTarget] = useState<{ id: number; mode: 'folder' | 'merge' } | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  // 단어장 목록이 바뀔 때(최초 로드, 생성/삭제) 컨테이너 구조를 다시 계산
  if (signature !== prevSignature && activeId === null) {
    setPrevSignature(signature);
    setContainers(buildContainers(wordbooks));
  }

  const findContainer = (id: number): string | undefined => {
    if (containers[ROOT]?.includes(id)) return ROOT;
    for (const key of Object.keys(containers)) {
      if (key !== ROOT && containers[key]?.includes(id)) return key;
    }
    return undefined;
  };

  const persistOrder = async (cont: Record<string, number[]>) => {
    const orderItems: WordbookOrderItem[] = [];
    cont[ROOT]?.forEach((id, idx) => orderItems.push({ id, parent_id: null, sort_order: idx }));
    for (const key of Object.keys(cont)) {
      if (key === ROOT) continue;
      const folderId = folderIdFromKey(key);
      cont[key]?.forEach((id, idx) => orderItems.push({ id, parent_id: folderId, sort_order: idx }));
    }
    setWordbooks((prev) =>
      prev.map((wb) => {
        const item = orderItems.find((o) => o.id === wb.id);
        return item ? { ...wb, parent_id: item.parent_id, sort_order: item.sort_order } : wb;
      })
    );
    try {
      await wordbookService.reorder(orderItems);
    } catch {
      // 동기화 실패 시 다음 새로고침에서 복구됨
    }
  };

  const clearHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    armedTargetRef.current = null;
    setArmedTarget(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(Number(event.active.id));
    setHoverTarget(null);
    clearHold();
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      clearHold();
      setHoverTarget(null);
      return;
    }
    const activeIdNum = Number(active.id);
    const overIdNum = Number(over.id);
    if (activeIdNum === overIdNum) {
      clearHold();
      setHoverTarget(null);
      return;
    }

    const activeWb = wbById.get(activeIdNum);
    const overWb = wbById.get(overIdNum);
    const activeContainer = findContainer(activeIdNum);
    const overContainer = findContainer(overIdNum);

    // 다른 단어장 위에 일정 시간 머무르면: 폴더로 합치기 / 기존 폴더에 넣기
    let mode: 'folder' | 'merge' | null = null;
    if (activeWb && !activeWb.is_folder) {
      if (overWb?.is_folder) {
        mode = 'folder';
      } else if (overWb && !overWb.is_folder && activeContainer === ROOT && overContainer === ROOT) {
        mode = 'merge';
      }
    }

    if (mode) {
      if (armedTargetRef.current?.id !== overIdNum || armedTargetRef.current?.mode !== mode) {
        clearHold();
        setHoverTarget({ id: overIdNum, mode });
        const target = { id: overIdNum, mode };
        holdTimerRef.current = setTimeout(() => {
          armedTargetRef.current = target;
          setArmedTarget(target);
        }, COMBINE_HOLD_MS);
      }
    } else {
      clearHold();
      setHoverTarget(null);
    }

    if (activeWb?.is_folder) return; // 폴더는 최상위에서만 순서 변경
    if (!activeContainer || !overContainer) return;
    if (activeContainer !== overContainer) {
      setContainers((prev) => {
        const sourceItems = prev[activeContainer]?.filter((id) => id !== activeIdNum) ?? [];
        const overItems = prev[overContainer] ?? [];
        const overIndex = overItems.indexOf(overIdNum);
        const newIndex = overIndex >= 0 ? overIndex : overItems.length;
        const targetItems = [...overItems];
        targetItems.splice(newIndex, 0, activeIdNum);
        return { ...prev, [activeContainer]: sourceItems, [overContainer]: targetItems };
      });
    }
  };

  const moveIntoFolder = async (movedId: number, folderId: number) => {
    const sourceContainer = findContainer(movedId);
    if (!sourceContainer) return;
    const next = { ...containers };
    next[sourceContainer] = next[sourceContainer].filter((id) => id !== movedId);
    const fKey = folderKey(folderId);
    next[fKey] = [...(next[fKey] ?? []), movedId];
    setContainers(next);
    await persistOrder(next);
  };

  const removeFromFolder = async (movedId: number, folderId: number) => {
    const fKey = folderKey(folderId);
    const next = { ...containers };
    next[fKey] = (next[fKey] ?? []).filter((id) => id !== movedId);
    const folderIndex = next[ROOT].indexOf(folderId);
    const rootItems = [...next[ROOT]];
    rootItems.splice(folderIndex >= 0 ? folderIndex + 1 : rootItems.length, 0, movedId);
    next[ROOT] = rootItems;
    setContainers(next);
    await persistOrder(next);
  };

  const mergeIntoNewFolder = async (movedId: number, targetId: number) => {
    const name = window.prompt('새 폴더 이름을 입력하세요', '새 폴더');
    if (!name || !name.trim()) return;
    try {
      const folder = await wordbookService.createFolder(name.trim());
      setWordbooks((prev) => [...prev, { ...folder, masteredCount: 0 }]);

      const next = { ...containers };
      const rootItems = next[ROOT].filter((id) => id !== movedId && id !== targetId);
      const targetIndex = next[ROOT].indexOf(targetId);
      rootItems.splice(Math.min(Math.max(targetIndex, 0), rootItems.length), 0, folder.id);
      next[ROOT] = rootItems;
      next[folderKey(folder.id)] = [targetId, movedId];

      setContainers(next);
      await persistOrder(next);
    } catch {
      alert('폴더 생성에 실패했습니다.');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const activeIdNum = Number(active.id);
    const combine = armedTargetRef.current;
    setActiveId(null);
    setHoverTarget(null);
    clearHold();

    if (combine) {
      if (combine.mode === 'folder') {
        await moveIntoFolder(activeIdNum, combine.id);
      } else {
        await mergeIntoNewFolder(activeIdNum, combine.id);
      }
      return;
    }

    if (!over) {
      await persistOrder(containers);
      return;
    }

    const overIdNum = Number(over.id);
    const activeContainer = findContainer(activeIdNum);
    const overContainer = findContainer(overIdNum);

    if (!activeContainer || !overContainer || activeContainer !== overContainer || activeIdNum === overIdNum) {
      await persistOrder(containers);
      return;
    }

    const items = containers[activeContainer];
    const oldIndex = items.indexOf(activeIdNum);
    const newIndex = items.indexOf(overIdNum);
    const reordered = arrayMove(items, oldIndex, newIndex);
    const next = { ...containers, [activeContainer]: reordered };
    setContainers(next);
    await persistOrder(next);
  };

  const handleRenameFolder = async (folderId: number, currentName: string) => {
    const name = window.prompt('폴더 이름 변경', currentName);
    if (!name || !name.trim() || name.trim() === currentName) return;
    try {
      await wordbookService.update(folderId, { name: name.trim() });
      setWordbooks((prev) => prev.map((wb) => (wb.id === folderId ? { ...wb, name: name.trim() } : wb)));
    } catch {
      alert('폴더 이름 변경에 실패했습니다.');
    }
  };

  const handleDeleteFolder = async (folderId: number, name: string) => {
    if (!confirm(`"${name}" 폴더를 삭제하시겠습니까? 안의 단어장은 최상위로 이동됩니다.`)) return;
    try {
      await wordbookService.delete(folderId);
      const fKey = folderKey(folderId);
      const children = containers[fKey] ?? [];
      const next = { ...containers };
      delete next[fKey];
      const folderIndex = next[ROOT].indexOf(folderId);
      const rootItems = next[ROOT].filter((id) => id !== folderId);
      rootItems.splice(Math.min(Math.max(folderIndex, 0), rootItems.length), 0, ...children);
      next[ROOT] = rootItems;
      setContainers(next);
      setWordbooks((prev) =>
        prev
          .filter((wb) => wb.id !== folderId)
          .map((wb) => (children.includes(wb.id) ? { ...wb, parent_id: null } : wb))
      );
      await persistOrder(next);
    } catch {
      alert('폴더 삭제에 실패했습니다.');
    }
  };

  const toggleExpand = (folderId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const rootItems = containers[ROOT] ?? [];
  const activeWb = activeId != null ? wbById.get(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setActiveId(null); setHoverTarget(null); clearHold(); }}
    >
      <SortableContext items={rootItems} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {rootItems.map((id) => {
            const wb = wbById.get(id);
            if (!wb) return null;
            if (wb.is_folder) {
              return (
                <FolderCard
                  key={wb.id}
                  folder={wb}
                  childIds={containers[folderKey(wb.id)] ?? []}
                  wbById={wbById}
                  expanded={expanded.has(wb.id)}
                  onToggle={() => toggleExpand(wb.id)}
                  onRename={() => handleRenameFolder(wb.id, wb.name)}
                  onDeleteFolder={() => handleDeleteFolder(wb.id, wb.name)}
                  onDeleteWordbook={onDelete}
                  onRenameWordbook={onRename}
                  onRemoveFromFolder={(childId) => removeFromFolder(childId, wb.id)}
                  isCombineTarget={hoverTarget?.id === wb.id}
                  isArmed={armedTarget?.id === wb.id}
                  activeId={activeId}
                  hoverTarget={hoverTarget}
                  armedTarget={armedTarget}
                  freeze={hoverTarget !== null}
                />
              );
            }
            return (
              <SortableWordbookCard
                key={wb.id}
                wb={wb}
                onDelete={onDelete}
                onRename={onRename}
                isCombineTarget={hoverTarget?.id === wb.id}
                isArmed={armedTarget?.id === wb.id}
                isDragging={activeId === wb.id}
                freeze={hoverTarget !== null}
              />
            );
          })}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeWb ? (
          <div
            className={`relative rounded-2xl border bg-white px-4 py-3 shadow-lg transition-transform duration-200 ease-out dark:bg-gray-900 ${
              armedTarget
                ? 'scale-75 border-amber-400 dark:border-amber-500'
                : 'border-indigo-200 dark:border-indigo-800'
            }`}
          >
            <p className="font-semibold text-gray-900 dark:text-gray-100">
              {activeWb.is_folder && '📁 '}{activeWb.name}
            </p>
            {armedTarget && <FolderBadge />}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function FolderBadge() {
  return (
    <div className="absolute -right-2 -top-2 flex h-7 w-7 animate-bounce items-center justify-center rounded-full bg-amber-400 text-white shadow-md">
      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
      </svg>
    </div>
  );
}

function DragHandle({
  attributes,
  listeners,
}: {
  attributes: ReturnType<typeof useSortable>['attributes'];
  listeners: ReturnType<typeof useSortable>['listeners'];
}) {
  return (
    <button
      {...attributes}
      {...listeners}
      style={{ touchAction: 'none' }}
      className="flex h-10 w-7 flex-shrink-0 cursor-grab items-center justify-center text-gray-300 active:cursor-grabbing dark:text-gray-600"
      aria-label="순서 변경"
    >
      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
        <circle cx="9" cy="6" r="1.5" />
        <circle cx="15" cy="6" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="18" r="1.5" />
        <circle cx="15" cy="18" r="1.5" />
      </svg>
    </button>
  );
}

function FolderCard({
  folder,
  childIds,
  wbById,
  expanded,
  onToggle,
  onRename,
  onDeleteFolder,
  onDeleteWordbook,
  onRenameWordbook,
  onRemoveFromFolder,
  isCombineTarget,
  isArmed,
  activeId,
  hoverTarget,
  armedTarget,
  freeze,
}: {
  folder: WordbookWithProgress;
  childIds: number[];
  wbById: Map<number, WordbookWithProgress>;
  expanded: boolean;
  onToggle: () => void;
  onRename: () => void;
  onDeleteFolder: () => void;
  onDeleteWordbook: (id: number, name: string) => void;
  onRenameWordbook: (id: number, currentName: string) => void;
  onRemoveFromFolder: (id: number) => void;
  isCombineTarget: boolean;
  isArmed: boolean;
  activeId: number | null;
  hoverTarget: { id: number; mode: 'folder' | 'merge' } | null;
  armedTarget: { id: number; mode: 'folder' | 'merge' } | null;
  freeze: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: folder.id });

  const baseTransform = freeze ? '' : (CSS.Translate.toString(transform) ?? '');
  const style = {
    transform: isArmed ? `${baseTransform} scale(1.04)`.trim() : baseTransform,
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-2xl border bg-gray-50 p-3 transition dark:bg-gray-900/60 ${
        isDragging ? 'opacity-40' : ''
      } ${
        isArmed
          ? 'border-amber-400 ring-2 ring-amber-300 dark:border-amber-500 dark:ring-amber-700'
          : isCombineTarget
          ? 'border-indigo-400 ring-2 ring-indigo-300 dark:border-indigo-500 dark:ring-indigo-700'
          : 'border-gray-200 dark:border-gray-800'
      }`}
    >
      {isArmed && <FolderBadge />}
      <div className="flex items-center gap-2">
        <DragHandle attributes={attributes} listeners={listeners} />
        <button
          onClick={onToggle}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-500 dark:bg-amber-950/40 dark:text-amber-400"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-gray-900 dark:text-gray-100">{folder.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{childIds.length}개 단어장</p>
        </div>
        <button
          onClick={onRename}
          className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-indigo-500 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-indigo-400"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={onDeleteFolder}
          className="rounded-xl p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500 dark:text-gray-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
        <button onClick={onToggle} className="rounded-xl p-2 text-gray-400 dark:text-gray-500">
          <svg className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-dashed border-gray-200 pt-3 pl-2 dark:border-gray-700">
          <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
            {childIds.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-400 dark:text-gray-500">
                단어장을 여기로 끌어다 놓으세요.
              </p>
            ) : (
              childIds.map((id) => {
                const wb = wbById.get(id);
                if (!wb) return null;
                return (
                  <SortableWordbookCard
                    key={wb.id}
                    wb={wb}
                    onDelete={onDeleteWordbook}
                    onRename={onRenameWordbook}
                    isCombineTarget={hoverTarget?.id === wb.id}
                    isArmed={armedTarget?.id === wb.id}
                    isDragging={activeId === wb.id}
                    freeze={freeze}
                    compact
                    onRemoveFromFolder={() => onRemoveFromFolder(wb.id)}
                  />
                );
              })
            )}
          </SortableContext>
        </div>
      )}
    </div>
  );
}

function SortableWordbookCard({
  wb,
  onDelete,
  onRename,
  isCombineTarget,
  isArmed,
  isDragging,
  freeze,
  compact,
  onRemoveFromFolder,
}: {
  wb: WordbookWithProgress;
  onDelete: (id: number, name: string) => void;
  onRename: (id: number, currentName: string) => void;
  isCombineTarget: boolean;
  isArmed: boolean;
  isDragging: boolean;
  freeze: boolean;
  compact?: boolean;
  onRemoveFromFolder?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: wb.id });

  const baseTransform = freeze ? '' : (CSS.Translate.toString(transform) ?? '');
  const style = {
    transform: isArmed ? `${baseTransform} scale(1.04)`.trim() : baseTransform,
    transition,
  };

  const total = wb.word_count;
  const mastered = wb.masteredCount;
  const pct = total > 0 && mastered !== undefined ? Math.round((mastered / total) * 100) : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-2xl border bg-white p-4 transition dark:bg-gray-900 ${
        isDragging ? 'opacity-40' : ''
      } ${
        isArmed
          ? 'border-amber-400 ring-2 ring-amber-300 dark:border-amber-500 dark:ring-amber-700'
          : isCombineTarget
          ? 'border-indigo-400 ring-2 ring-indigo-300 dark:border-indigo-500 dark:ring-indigo-700'
          : 'border-gray-100 dark:border-gray-800'
      }`}
    >
      {isArmed && <FolderBadge />}
      <div className="flex items-center">
        <DragHandle attributes={attributes} listeners={listeners} />
        <Link href={`/wordbooks/${wb.id}`} className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate dark:text-gray-100">{wb.name}</p>
          <div className="mt-0.5 flex items-center gap-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">{total}개 단어</p>
            {mastered !== undefined && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">· 암기 {mastered}개</p>
            )}
          </div>
        </Link>
        <div className="ml-3 flex items-center gap-2">
          <Link
            href={`/wordbooks/${wb.id}`}
            className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-600 transition hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400 dark:hover:bg-indigo-950/70"
          >
            학습하기
          </Link>
          {compact && onRemoveFromFolder && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemoveFromFolder(); }}
              title="폴더에서 빼기"
              className="rounded-xl p-2 text-gray-400 transition hover:bg-indigo-50 hover:text-indigo-500 dark:text-gray-500 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-400"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onRename(wb.id, wb.name); }}
            className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100 hover:text-indigo-500 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-indigo-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(wb.id, wb.name); }}
            className="rounded-xl p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500 dark:text-gray-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {!compact && total > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-gray-400 dark:text-gray-500">암기 진행률</span>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              {pct !== null ? `${pct}%` : '로딩 중...'}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all duration-500"
              style={{ width: pct !== null ? `${pct}%` : '0%' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
