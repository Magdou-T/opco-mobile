// ============================================================
// @opco/backend — pipeline auto-correctif des montants OPCO.
// SCRAPE -> EXTRACT (IA) -> VERIFY -> CORRECT -> VALIDATE -> PUBLISH
// Point d'entrée CLI : src/run.ts
// ============================================================

export * from './types';
export * from './util';
export * from './scrape';
export * from './extract';
export * from './verify';
export * from './correct';
export * from './validate';
export * from './publish';
