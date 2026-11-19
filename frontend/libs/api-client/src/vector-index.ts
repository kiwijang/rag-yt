// UI projection only; HTTP operations are generated in RagService.
export type VectorIndexProgress = {
  state: string; processed: number; total: number; updated: number; error?: string;
  sourceType?: number; sourceId?: number; transcriptId?: number;
  supportsScopedEmbedding?: boolean; supportsAtomicChunkEmbedding?: boolean;
  supportsOriginalTextEmbedding?: boolean;
};
