'use client';

import DeckListView from '@/components/decks/DeckListView';
import { deckService } from '@/services/deckService';

export default function AdminDecksPage() {
  return <DeckListView service={deckService} basePath="/admin/decks" />;
}
