'use client';

import Link from 'next/link';
import DeckListView from '@/components/decks/DeckListView';
import { userDeckService } from '@/services/deckService';

export default function SentenceBooksPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
      <Link
        href="/settings"
        className="inline-block text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        ← 설정
      </Link>
      <DeckListView service={userDeckService} basePath="/settings/sentences" title="문장 단어장" />
    </div>
  );
}
