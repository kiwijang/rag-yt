import { Component, ElementRef, ViewChild, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HlmButtonDirective, HlmCardDirective } from '@ragyt/ui';
import { WorkspaceNavComponent } from '../../components/workspace-nav.component';
import { FlatBodyMapComponent } from './flat-body-map.component';
import { BodyView, RELATED_MUSCLES, SYMPTOM_LOCATIONS, SYMPTOM_REGIONS } from './symptom-map-data';

@Component({
  selector:'app-symptom-map-page',standalone:true,
  imports:[FormsModule,RouterLink,HlmButtonDirective,HlmCardDirective,WorkspaceNavComponent,FlatBodyMapComponent],
  template:`
    <div class="rag-page"><main class="rag-page-shell">
      <app-workspace-nav />
      <header class="flex flex-wrap items-end justify-between gap-4">
        <div><p class="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">SYMPTOM AREA MAP</p><h1 class="mt-1 text-3xl font-semibold">平面肌肉地圖</h1><p class="mt-2 text-sm text-slate-600 dark:text-slate-400">從身體區域開始，逐步選擇疼痛位置與相關肌肉。</p></div>
        <button hlmBtn type="button" variant="outline" size="sm" [disabled]="!region()" (click)="reset()">重新選擇</button>
      </header>
      <nav aria-label="選取步驟"><ol class="grid grid-cols-3 gap-2 sm:gap-3">
        @for(step of steps;track step.number){
          <li><button type="button" class="step-button" [class.step-current]="currentStep()===step.number" [class.step-done]="currentStep()>step.number" [disabled]="step.number>currentStep()" [attr.aria-current]="currentStep()===step.number?'step':null" (click)="goToStep(step.number)"><span class="step-number">{{ step.number }}</span><span><span class="block text-sm font-semibold">{{ step.label }}</span><span class="mt-1 hidden text-xs text-slate-500 sm:block">{{ step.number===1 ? (region()?.name??'選擇大區') : step.number===2 ? (symptom()?.name??'選擇細部位置') : (muscle()?.name??'選擇肌肉與分部') }}</span></span></button></li>
        }
      </ol></nav>
      <div class="grid min-w-0 items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <section hlmCard class="grid min-w-0 gap-3 p-4 lg:sticky lg:top-4" aria-label="平面位置選擇">
          <app-flat-body-map [region]="region()" [locations]="locations()" [selected]="symptomId()" [view]="view()" (viewChange)="view.set($event)" (regionSelected)="pickRegion($event)" (symptomSelected)="pickSymptom($event)" />
          @if(region()){
            <button hlmBtn type="button" variant="ghost" size="sm" (click)="reset()">← 返回全身區域</button>
            <p class="text-xs leading-5 text-slate-500">編號為疼痛區域位置示意，並非激痛點定位。足底位置以足部標記表示。</p>
          }@else{<p class="text-xs leading-5 text-slate-500">人體圖可使用滑鼠、觸控或鍵盤操作，右側清單也能完成相同選擇。</p>}
        </section>
        <div class="grid min-w-0 gap-4" aria-live="polite">
          @if(!region()){
            <section hlmCard class="grid gap-5 p-5 sm:p-6">
              <header><p class="text-xs font-medium text-indigo-600 dark:text-indigo-400">STEP 01 · SELECT SYMPTOM AREA</p><h2 class="mt-2 text-xl font-semibold">先選擇症狀大區</h2><p class="mt-2 text-sm text-slate-500">目前提供 7 個區域、21 種常見疼痛位置，選定後再展開下一層。</p></header>
              <div class="grid gap-3 sm:grid-cols-2" role="group" aria-label="症狀大區清單">
                @for(area of regions;track area.id;let i=$index){<button type="button" class="area-card" (click)="pickRegion(area.id)"><span class="area-mark" [style.background]="area.color">{{ i+1 }}</span><span class="min-w-0"><span class="block font-semibold">{{ area.name }}</span><span class="mt-1 block text-xs leading-5 text-slate-500">{{ area.hint }}</span></span><span class="ml-auto text-slate-400" aria-hidden="true">→</span></button>}
              </div>
            </section>
          }@else if(!symptom()){
            <section hlmCard class="grid gap-5 p-5 sm:p-6">
              <header><p class="text-xs font-medium text-indigo-600 dark:text-indigo-400">STEP 02 · SELECT LOCATION</p><h2 #stepHeading tabindex="-1" class="mt-2 text-xl font-semibold">{{ region()!.name }}：選擇細部位置</h2><p class="mt-2 text-sm text-slate-500">點選位置清單或人體圖編號。正面與背面的位置都列在此處。</p></header>
              <div class="grid gap-3" role="group" aria-label="細部疼痛位置">
                @for(location of locations();track location.id;let i=$index){<button type="button" class="area-card" (click)="pickSymptom(location.id)"><span class="location-number">{{ i+1 }}</span><span class="min-w-0"><span class="block font-semibold">{{ location.name }}</span><span class="mt-1 block text-xs text-slate-500">{{ location.view==='front'?'正面位置':'背面位置' }}</span></span><span class="ml-auto text-indigo-500" aria-hidden="true">→</span></button>}
              </div>
              <a class="text-xs text-slate-500 underline" [href]="'https://www.triggerpoints.net/'+region()!.id" target="_blank" rel="noopener noreferrer">查看此症狀大區的參考來源 ↗</a>
            </section>
          }@else{
            <section hlmCard class="grid min-w-0 gap-5 p-5 sm:p-6">
              <header class="flex flex-wrap items-start justify-between gap-3"><div><p class="text-xs font-medium text-indigo-600 dark:text-indigo-400">STEP 03 · SELECT MUSCLE</p><h2 #stepHeading tabindex="-1" class="mt-2 text-xl font-semibold">{{ symptom()!.name }}</h2><p class="mt-2 text-sm text-slate-500">依參考來源列出相關肌肉，選取後可再選左右側與分部。</p></div><button hlmBtn type="button" variant="ghost" size="sm" (click)="goToStep(2)">← 更換疼痛位置</button></header>
              @for(group of candidateGroups();track group.label){
                @if(group.items.length){
                  <div><h3 class="mb-3 flex items-center gap-2 text-sm font-semibold">{{ group.label }}<span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">{{ group.items.length }}</span></h3><div class="grid gap-2 sm:grid-cols-2" role="group" [attr.aria-label]="group.label">
                    @for(item of group.items;track item.id){<button type="button" class="muscle-card" [attr.aria-pressed]="muscleId()===item.id" (click)="pickMuscle(item.id)"><span class="block font-semibold">{{ item.name }}</span><span lang="en" class="mt-1 block text-xs text-slate-500">{{ item.english }}</span><span class="mt-2 block text-xs" [class]="item.models.length?'text-indigo-600 dark:text-indigo-400':'text-slate-500'">{{ item.models.length ? item.models.length+' 個可選模型部件' : '尚無精確對應模型' }}</span></button>}
                  </div></div>
                }
              }
              <a class="text-xs text-slate-500 underline" [href]="symptom()!.sourceUrl" target="_blank" rel="noopener noreferrer">查看「{{ symptom()!.name }}」的肌肉關聯來源 ↗</a>
            </section>
            @if(muscle();as item){
              <section hlmCard class="grid min-w-0 gap-4 border-indigo-200 p-5 dark:border-indigo-900 sm:p-6" aria-label="肌肉與模型部件">
                <header><p class="text-xs font-medium text-indigo-600 dark:text-indigo-400">目前選擇</p><h2 #muscleHeading tabindex="-1" class="mt-1 text-xl font-semibold">{{ item.name }}</h2><p lang="en" class="mt-1 text-sm text-slate-500">{{ item.english }}</p></header>
                @if(item.models.length){
                  <label class="grid min-w-0 gap-2 text-sm font-medium">選擇左右側／肌肉分部<select class="w-full min-w-0 rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" aria-label="選擇肌肉模型部件" [ngModel]="modelId()" (ngModelChange)="modelId.set($event)"><option value="">請選擇一個模型部件</option>@for(part of item.models;track part.id){<option [value]="part.id">{{ part.name }} · {{ part.id }}</option>}</select></label>
                  @if(model();as part){<div class="rounded-lg bg-indigo-50 p-3 text-sm dark:bg-indigo-950"><p class="font-semibold">{{ part.name }}</p><p lang="en" class="mt-1 text-xs text-slate-500">{{ part.english }}</p><p class="mt-2 text-xs text-slate-500">{{ part.id }} · {{ part.source }} · {{ part.region }}</p></div>}
                }@else{<p role="status" class="rounded-lg bg-slate-100 p-3 text-sm leading-6 text-slate-600 dark:bg-slate-800 dark:text-slate-300">目前模型沒有精確對應的肌肉／分部，因此無法在 3D 定位。仍可查閱來源、帶入對話或檢索。</p>}
                <div class="flex flex-wrap gap-2">
                  @if(model();as part){<a hlmBtn size="sm" routerLink="/muscles" [queryParams]="{id:part.id,view:view()}">在 3D 中定位</a>}@else{<button hlmBtn type="button" size="sm" disabled>在 3D 中定位</button>}
                  <a hlmBtn size="sm" variant="outline" routerLink="/chat" [queryParams]="{muscle:contextName()}">帶入 LLM 對話</a>
                  <a hlmBtn size="sm" variant="outline" routerLink="/user-rag" [queryParams]="{q:contextName()}">帶入 RAG 檢索</a>
                </div>
                <a class="text-xs text-slate-500 underline" [href]="item.sourceUrl" target="_blank" rel="noopener noreferrer">查看肌肉參考頁 ↗</a>
              </section>
            }
          }
          <p class="px-1 text-xs leading-6 text-slate-500">肌肉關聯僅供查閱，不能單憑疼痛位置判斷病因。流程與關聯參考 <a class="underline" href="https://www.triggerpoints.net/" target="_blank" rel="noopener noreferrer">The Trigger Point & Referred Pain Guide</a>；人體圖為本專案繪製。此頁的症狀大區與 3D 模型的解剖分類分開使用。</p>
        </div>
      </div>
    </main></div>
  `,
  styles:[`
    .step-button{display:flex;align-items:center;gap:.75rem;width:100%;height:100%;padding:1rem;text-align:left;border:1px solid #e2e8f0;border-radius:.75rem;background:#fff;min-width:0}.step-number{display:grid;place-items:center;flex:none;width:1.75rem;height:1.75rem;border-radius:50%;background:#f1f5f9;color:#64748b;font-size:.8rem;font-weight:600}.step-current{border-color:#818cf8;background:#eef2ff}.step-current .step-number,.step-done .step-number{background:#4f46e5;color:#fff}.step-button:disabled{opacity:.55;cursor:not-allowed}.area-card{display:flex;align-items:center;gap:.85rem;width:100%;padding:1rem;border:1px solid #e2e8f0;border-radius:.8rem;text-align:left;transition:border-color .15s,background .15s}.area-card:hover,.muscle-card:hover{border-color:#818cf8;background:#f8fafc}.area-mark,.location-number{display:grid;place-items:center;flex:none;width:2rem;height:2rem;border-radius:.65rem;font-size:.8rem;font-weight:600;color:white}.location-number{background:#eef2ff;color:#4f46e5}.muscle-card{padding:1rem;border:1px solid #e2e8f0;border-radius:.75rem;text-align:left;overflow-wrap:anywhere}.muscle-card[aria-pressed=true]{border-color:#6366f1;background:#eef2ff}button:focus-visible,a:focus-visible,select:focus-visible{outline:2px solid #6366f1;outline-offset:3px}:host-context(.dark) .step-button,:host-context(.dark) .area-card,:host-context(.dark) .muscle-card{border-color:#334155;background:#0f172a}:host-context(.dark) .step-current,:host-context(.dark) .muscle-card[aria-pressed=true]{border-color:#818cf8;background:#1e1b4b}:host-context(.dark) .area-card:hover,:host-context(.dark) .muscle-card:hover{background:#1e293b}:host-context(.dark) .step-number{background:#334155;color:#e2e8f0}:host-context(.dark) .step-current .step-number,:host-context(.dark) .step-done .step-number{background:#4f46e5}@media(max-width:639px){.step-button{padding:.65rem;gap:.4rem;align-items:flex-start}.step-number{width:1.4rem;height:1.4rem}.area-card{padding:.85rem}}
  `],
})
export class SymptomMapPageComponent {
  @ViewChild('stepHeading') private stepHeading?:ElementRef<HTMLElement>;
  @ViewChild('muscleHeading') private muscleHeading?:ElementRef<HTMLElement>;
  readonly steps=[{number:1,label:'症狀大區'},{number:2,label:'細部位置'},{number:3,label:'相關肌肉'}];
  readonly regions=SYMPTOM_REGIONS;
  readonly regionId=signal<string|null>(null);readonly symptomId=signal<string|null>(null);
  readonly muscleId=signal<string|null>(null);readonly modelId=signal('');readonly view=signal<BodyView>('front');
  readonly region=computed(()=>this.regions.find(r=>r.id===this.regionId()));
  readonly locations=computed(()=>SYMPTOM_LOCATIONS.filter(p=>p.region===this.regionId()));
  readonly symptom=computed(()=>this.locations().find(p=>p.id===this.symptomId()));
  readonly muscle=computed(()=>RELATED_MUSCLES.find(m=>m.id===this.muscleId()));
  readonly model=computed(()=>this.muscle()?.models.find(m=>m.id===this.modelId()));
  readonly currentStep=computed(()=>this.symptom()?3:this.region()?2:1);
  readonly contextName=computed(()=>this.model()?.name??this.muscle()?.name??'');
  readonly candidateGroups=computed(()=>[
    {label:'主要關聯',items:(this.symptom()?.primary??[]).flatMap(id=>RELATED_MUSCLES.filter(m=>m.id===id))},
    {label:'次要關聯',items:(this.symptom()?.secondary??[]).flatMap(id=>RELATED_MUSCLES.filter(m=>m.id===id))},
  ]);
  pickRegion(id:string):void{if(!this.regions.some(r=>r.id===id))return;this.regionId.set(id);this.symptomId.set(null);this.clearMuscle();this.focusPanel('step');}
  pickSymptom(id:string):void{const point=this.locations().find(p=>p.id===id);if(!point)return;this.symptomId.set(id);this.view.set(point.view);this.clearMuscle();this.focusPanel('step');}
  pickMuscle(id:string):void{if(!this.candidateGroups().some(g=>g.items.some(m=>m.id===id)))return;this.muscleId.set(id);this.modelId.set('');this.focusPanel('muscle');}
  goToStep(step:number):void{if(step===1)this.reset();else if(step===2&&this.region()){this.symptomId.set(null);this.clearMuscle();}else if(step===3&&this.symptom())this.clearMuscle();}
  reset():void{this.regionId.set(null);this.symptomId.set(null);this.clearMuscle();this.view.set('front');}
  private clearMuscle():void{this.muscleId.set(null);this.modelId.set('');}
  private focusPanel(panel:'step'|'muscle'):void{
    setTimeout(()=>{
      const heading=(panel==='step'?this.stepHeading:this.muscleHeading)?.nativeElement;
      heading?.focus({preventScroll:true});
      heading?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    });
  }
}

