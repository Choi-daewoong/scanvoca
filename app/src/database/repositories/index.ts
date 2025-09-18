// Repository exports
export { BaseRepository } from './BaseRepository';
export { WordRepository } from './WordRepository';
export { WordbookRepository } from './WordbookRepository';
export { StudyProgressRepository } from './StudyProgressRepository';

// Repository factory
import * as SQLite from 'expo-sqlite';
import { WordRepository } from './WordRepository';
import { WordbookRepository } from './WordbookRepository';
import { StudyProgressRepository } from './StudyProgressRepository';

export class RepositoryManager {
  public words: WordRepository;
  public wordbooks: WordbookRepository;
  public studyProgress: StudyProgressRepository;

  constructor(database: SQLite.SQLiteDatabase) {
    this.words = new WordRepository(database);
    this.wordbooks = new WordbookRepository(database);
    this.studyProgress = new StudyProgressRepository(database);
  }
}

// 싱글톤 패턴으로 repository 관리
let repositoryManager: RepositoryManager | null = null;

export function initializeRepositories(database: SQLite.SQLiteDatabase): RepositoryManager {
  repositoryManager = new RepositoryManager(database);
  return repositoryManager;
}

export function getRepositories(): RepositoryManager {
  if (!repositoryManager) {
    throw new Error('Repositories not initialized. Call initializeRepositories() first.');
  }
  return repositoryManager;
}