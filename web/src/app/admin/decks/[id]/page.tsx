'use client';

import DeckQuizView from '@/components/decks/DeckQuizView';
import { deckService } from '@/services/deckService';

export default function AdminDeckQuizPage() {
  return <DeckQuizView service={deckService} basePath="/admin/decks" />;
}
