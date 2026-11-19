import { Component, Input, inject, signal } from '@angular/core';
import { RagService } from '@ragyt/api-client';
import { HlmButtonDirective } from '@ragyt/ui';
@Component({selector:'app-rag-image-result',standalone:true,imports:[HlmButtonDirective],template:`
  <button hlmBtn type="button" size="sm" variant="outline" (click)="open()" [disabled]="loading()">查看 PDF 第 {{ page }} 頁</button>
  @if (error()) { <p role="alert">{{ error() }}</p> }
  @if (image()) { <div class="mt-3 grid gap-2"><button hlmBtn type="button" size="sm" variant="ghost" (click)="image.set('')">收起預覽</button><img class="max-h-[70vh] max-w-full object-contain" [src]="'data:image/png;base64,' + image()" [alt]="'PDF 第 ' + page + ' 頁'" /></div> }
`})
export class RagImageResultComponent {
  @Input({required:true}) sourceId!:number;
  @Input({required:true}) page!:number;
  private readonly api=inject(RagService);
  readonly image=signal(''); readonly error=signal(''); readonly loading=signal(false);
  open() { this.loading.set(true);this.error.set('');this.api.getApiRagPdfPagesImage({id:this.sourceId,page:this.page}).subscribe({next:p=>{this.image.set(p.imageBase64);this.loading.set(false);},error:()=>{this.error.set('無法載入頁面預覽。');this.loading.set(false);}}); }
}
