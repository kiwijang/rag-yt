import { Component, DestroyRef, Input, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RagIndexStatusService } from '../../services/rag-index-status.service';
import { ApiError, RagService, VectorIndexProgress } from '@ragyt/api-client';
import { HlmButtonDirective } from '@ragyt/ui';

@Component({selector:'app-source-embedding-button',standalone:true,imports:[HlmButtonDirective],template:`
  <div class="grid gap-1">
    <button hlmBtn variant="outline" size="sm" type="button" [disabled]="disabled || pending() || active() || !ready()" (click)="start()">{{ pending() ? '送出中…' : '進行 embedding' }}</button>
    @if (progress() && !ready()) { <p role="status" class="text-xs text-amber-700">需更新後端 API；請先讓目前的工作完成，再重新啟動。</p> }
    @if (!transcriptId) { <p class="text-xs text-slate-500">{{ sourceType === 1 ? '此來源所有影片的最新已存逐字稿（不限目前 tab）' : '此 PDF 的文字與頁面圖像' }}</p> }
    @if (matches(); as p) { <p role="status" class="text-xs">{{ label(p.state) }} · {{ p.processed }} / {{ p.total }} · 更新 {{ p.updated }}</p>
      @if (p.error) { <p role="alert" class="text-xs text-red-600">{{ p.error }}</p> }
    }
    @if (error()) { <p role="alert" class="text-xs text-red-600">{{ error() }}</p> }
  </div>`})
export class SourceEmbeddingButtonComponent {
  @Input({required:true}) sourceType!:number;
  @Input({required:true}) sourceId!:number;
  @Input() transcriptId?:number;
  @Input() disabled=false;
  private readonly api=inject(RagService);
  private readonly destroy=inject(DestroyRef);
  private readonly indexStatus=inject(RagIndexStatusService);
  readonly progress=signal<VectorIndexProgress|null>(null);
  readonly pending=signal(false);readonly error=signal('');
  constructor() {
    this.indexStatus.state$.pipe(takeUntilDestroyed(this.destroy))
      .subscribe(state=>{this.progress.set(state.progress);this.error.set(state.error);});
  }
  active() {return ['queued','running','stopping'].includes(this.progress()?.state??'');}
  ready() {return this.progress()?.supportsScopedEmbedding===true&&this.progress()?.supportsOriginalTextEmbedding===true;}
  matches() {const p=this.progress();return p?.sourceType===this.sourceType&&p.sourceId===this.sourceId&&(p.transcriptId??undefined)===this.transcriptId?p:null;}
  label(state:string) {return ({queued:'等待 embedding',running:'Embedding 中',stopping:'停止中',completed:'Embedding 完成',cancelled:'已停止',failed:'Embedding 失敗'} as Record<string,string>)[state]??state;}
  start() {
    if(this.disabled||this.active()||this.pending()||!this.ready())return;
    this.pending.set(true);this.error.set('');
    this.api.postApiRagIndex({sourceType:this.sourceType,sourceId:this.sourceId,transcriptId:this.transcriptId}).pipe(takeUntilDestroyed(this.destroy))
      .subscribe({next:p=>{this.progress.set(p);this.pending.set(false);},error:e=>{this.pending.set(false);this.error.set(e instanceof ApiError&&e.body?.message?e.body.message:'無法啟動 embedding，請稍後重試。');}});
  }
}
