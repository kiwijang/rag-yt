import { Component, computed, input, output } from '@angular/core';
import { BodyView, SYMPTOM_REGIONS, SymptomLocation, SymptomRegion } from './symptom-map-data';

@Component({
  selector:'app-flat-body-map', standalone:true,
  template:`
    <div class="map-stage">
      <div class="map-toolbar"><span>{{ region()?.name ?? '全身區域' }}</span><div role="group" aria-label="平面人體視角">
        <button type="button" [attr.aria-pressed]="view()==='front'" (click)="viewChange.emit('front')">正面</button>
        <button type="button" [attr.aria-pressed]="view()==='back'" (click)="viewChange.emit('back')">背面</button>
      </div></div>
      <svg [attr.viewBox]="region()?.box ?? '24 8 272 602'" xmlns="http://www.w3.org/2000/svg" role="group" [attr.aria-label]="region() ? region()!.name+'細部位置圖' : '選擇症狀區域人體圖'">
        <defs><linearGradient id="flat-body-base" x1="0" x2="1"><stop stop-color="#cbd5e1"/><stop offset=".5" stop-color="#f8fafc"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient></defs>
        <g fill="url(#flat-body-base)" stroke="#94a3b8" stroke-width="1.1">
          <ellipse cx="160" cy="54" rx="28" ry="35"/>
          <path d="M147 83 Q149 98 143 109 L177 109 Q171 98 173 83 Z"/>
          <path d="M143 104 Q121 107 106 121 Q95 131 94 157 L81 211 Q73 242 66 276 L58 301 Q47 307 47 321 L51 341 Q56 347 61 340 L63 322 L67 342 Q73 345 75 337 L72 315 L81 296 L97 255 L112 212 L124 178 Q130 219 124 251 Q118 278 119 313 L116 352 Q112 391 119 432 L124 454 Q119 481 125 512 L131 552 L127 571 L116 582 Q111 592 120 595 L143 592 Q153 587 150 574 L150 550 L153 505 L155 460 L160 365 L165 460 L167 505 L170 550 L170 574 Q167 587 177 592 L200 595 Q209 592 204 582 L193 571 L189 552 L195 512 Q201 481 196 454 L201 432 Q208 391 204 352 L201 313 Q202 278 196 251 Q190 219 196 178 L208 212 L223 255 L239 296 L248 315 L245 337 Q247 345 253 342 L257 322 L259 340 Q264 347 269 341 L273 321 Q273 307 262 301 L254 276 Q247 242 239 211 L226 157 Q225 131 214 121 Q199 107 177 104 Z"/>
        </g>
        <g fill="none" stroke="#94a3b8" stroke-width=".8" opacity=".55"><path d="M160 122 L160 291 M128 310 Q147 320 160 344 Q173 320 192 310 M122 433 Q135 442 151 434 M169 434 Q185 442 198 433"/>
          @if(view()==='front'){<path d="M127 151 Q141 160 158 153 M162 153 Q179 160 193 151 M150 230 Q160 236 170 230"/>}
          @else{<path d="M137 130 L147 173 L126 183 M183 130 L173 173 L194 183 M124 310 Q140 341 157 319 M163 319 Q180 341 196 310"/>}
        </g>
        @for(area of regions;track area.id){
          <g [attr.role]="region() ? null : 'button'" [attr.aria-hidden]="region() ? 'true' : null" [attr.tabindex]="region() ? -1 : 0" [attr.aria-label]="'選擇區域：'+area.name" [attr.aria-pressed]="region()?.id===area.id" class="body-region" [class.region-muted]="region() && region()?.id!==area.id" [style.--area-color]="area.color" (click)="chooseRegion(area.id)" (keydown)="regionKey($event,area.id)">
            <title>{{ area.name }}</title><path [attr.d]="shape(area.id)"/>
          </g>
        }
        @if(region()){
          @for(point of visibleLocations();track point.id;let i=$index){
            <g class="symptom-pin" role="button" tabindex="0" [attr.aria-label]="'選擇位置：'+point.name" [attr.aria-pressed]="selected()===point.id" [class.pin-selected]="selected()===point.id" (click)="symptomSelected.emit(point.id)" (keydown)="pointKey($event,point.id)">
              <title>{{ point.name }}</title><circle [attr.cx]="point.x" [attr.cy]="point.y" r="10"/><text [attr.x]="point.x" [attr.y]="point.y+3.3" text-anchor="middle">{{ number(point.id) }}</text>
            </g>
          }
        }
      </svg>
      <p class="map-caption">{{ region() ? '點選編號，或使用右側位置清單' : '點選色塊，或使用右側區域清單' }}</p>
      <p class="map-note">平面位置示意 · {{ view()==='front' ? '正面' : '背面' }} · 左右兩側皆適用</p>
    </div>
  `,
  styles:[`
    :host{display:block;min-width:0}.map-stage{border:1px solid var(--map-border,#e2e8f0);border-radius:1rem;background:linear-gradient(160deg,#f8fafc,#eef2ff);overflow:hidden}.map-toolbar{display:flex;align-items:center;justify-content:space-between;padding:1rem;font-size:.8rem;color:#475569;gap:.5rem}.map-toolbar div{display:flex;gap:.25rem;background:#fff;border:1px solid #e2e8f0;border-radius:.6rem;padding:.2rem}.map-toolbar button{border-radius:.4rem;padding:.35rem .6rem;min-height:32px}.map-toolbar button[aria-pressed=true]{background:#4f46e5;color:white}svg{display:block;width:100%;height:450px;padding:.75rem;overflow:hidden}.body-region{cursor:pointer;outline:none}.body-region path{fill:var(--area-color);fill-opacity:.26;stroke:var(--area-color);stroke-width:1;transition:fill-opacity .15s}.body-region:hover path,.body-region:focus path,.body-region[aria-pressed=true] path{fill-opacity:.56;stroke-width:2}.body-region:focus path{stroke:#312e81;stroke-width:3}.body-region.region-muted path{fill-opacity:.05;stroke-opacity:.12}.symptom-pin{cursor:pointer;outline:none}.symptom-pin circle{fill:#fff;stroke:#4f46e5;stroke-width:1.5}.symptom-pin text{font-size:9px;font-weight:700;fill:#4338ca;pointer-events:none}.symptom-pin:hover circle,.symptom-pin:focus circle,.symptom-pin.pin-selected circle{fill:#4f46e5;stroke:#fff;stroke-width:2}.symptom-pin:hover text,.symptom-pin:focus text,.symptom-pin.pin-selected text{fill:#fff}.map-caption{text-align:center;font-size:.8rem;color:#475569;margin:.5rem 1rem}.map-note{text-align:center;font-size:.7rem;color:#64748b;margin:.5rem 1rem 1rem}button:focus-visible{outline:2px solid #4f46e5;outline-offset:2px}@media(max-width:639px){svg{height:340px}}:host-context(.dark) .map-stage{background:linear-gradient(160deg,#1e293b,#172554);--map-border:#334155}:host-context(.dark) .map-toolbar,:host-context(.dark) .map-caption{color:#cbd5e1}:host-context(.dark) .map-toolbar div{background:#0f172a;border-color:#334155}:host-context(.dark) .map-note{color:#94a3b8}
  `],
})
export class FlatBodyMapComponent {
  readonly regions=SYMPTOM_REGIONS;
  readonly region=input<SymptomRegion>();
  readonly locations=input<SymptomLocation[]>([]);
  readonly selected=input<string|null>(null);
  readonly view=input<BodyView>('front');
  readonly regionSelected=output<string>();readonly symptomSelected=output<string>();readonly viewChange=output<BodyView>();
  readonly visibleLocations=computed(()=>this.locations().filter(point=>point.view===this.view()));
  number(id:string):number{return this.locations().findIndex(p=>p.id===id)+1;}
  chooseRegion(id:string):void{if(!this.region())this.regionSelected.emit(id);}
  regionKey(event:KeyboardEvent,id:string):void{if(event.key==='Enter'||event.key===' '){event.preventDefault();this.chooseRegion(id);}}
  pointKey(event:KeyboardEvent,id:string):void{if(event.key==='Enter'||event.key===' '){event.preventDefault();this.symptomSelected.emit(id);}}
  shape(id:string):string{
    switch(id){
      case 'head-and-neck':return 'M160 20 C126 20 126 87 145 91 L143 108 L177 108 L175 91 C194 87 194 20 160 20 Z';
      case 'upper-back-shoulder-and-arm':return 'M126 111 Q101 113 97 143 L83 211 L107 218 L124 168 L131 133 Z M194 111 Q219 113 223 143 L237 211 L213 218 L196 168 L189 133 Z'+(this.view()==='back'?' M135 111 L185 111 L193 188 L127 188 Z':'');
      case 'forearm-hand-pain':return 'M82 215 L105 221 L81 296 L73 316 L75 337 L67 341 L62 320 L59 340 L51 339 L48 318 L61 301 Z M238 215 L215 221 L239 296 L247 316 L245 337 L253 341 L258 320 L261 340 L269 339 L272 318 L259 301 Z';
      case 'torso':return this.view()==='front'?'M132 114 L188 114 L194 174 Q187 215 194 259 L126 259 Q133 215 126 174 Z':'M127 193 L193 193 L194 259 L126 259 Z';
      case 'lower-torso':return 'M126 264 L194 264 L199 310 Q178 312 160 339 Q142 312 121 310 Z';
      case 'hip-thigh-knee':return 'M121 315 Q145 324 157 346 L151 440 Q135 450 121 440 Q112 392 118 352 Z M199 315 Q175 324 163 346 L169 440 Q185 450 199 440 Q208 392 202 352 Z';
      default:return 'M124 446 Q137 452 151 445 L150 506 L147 550 L149 574 Q151 587 142 591 L120 594 L116 585 L131 569 L134 551 L127 512 Q120 480 124 446 Z M196 446 Q183 452 169 445 L170 506 L173 550 L171 574 Q169 587 178 591 L200 594 L204 585 L189 569 L186 551 L193 512 Q200 480 196 446 Z';
    }
  }
}


