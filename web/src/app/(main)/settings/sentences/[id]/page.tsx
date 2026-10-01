'use client';

import DeckQuizView from '@/components/decks/DeckQuizView';
import { userDeckService } from '@/services/deckService';

export default function SentenceBookQuizPage() {
  return (
    <div className="px-4 py-4">
      <DeckQuizView service={userDeckService} basePath="/settings/sentences" />
    </div>
  );
}
