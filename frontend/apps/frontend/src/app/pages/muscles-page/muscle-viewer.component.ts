import { AfterViewInit, Component, computed, ElementRef, NgZone, OnDestroy, ViewChild, effect, inject, input, output, signal } from '@angular/core';
import * as THREE from 'three';
import { untracked } from '@angular/core';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ACTIVE_STRUCTURES } from './active-anatomy.generated';
import { VisibleType, isVisibleInSystem } from './muscle-catalog';

@Component({
  selector: 'app-muscle-viewer', standalone: true,
  host: { class: 'block min-w-0' },
  template: `
    <div class="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
      <div #host class="h-[500px] w-full touch-none sm:h-[620px]" role="img" aria-label="Muscle Atlas 3D 肌肉骨骼模型；也可使用結構清單選擇" (pointerdown)="pointerDown($event)" (pointerup)="pick($event)"></div>
      <p class="pointer-events-none absolute left-4 top-4 rounded-lg bg-slate-950/70 px-3 py-2 text-xs text-slate-200">Muscle Atlas 3D {{ explosion() > 0 ? '· 爆炸圖' : '' }} · 左右側獨立選取</p>
      <p class="pointer-events-none absolute bottom-4 left-4 right-4 text-center text-xs text-slate-300">拖曳旋轉 · 滾輪／雙指縮放 · 點選肌肉</p>
      <div role="status" aria-live="polite" aria-atomic="true" aria-label="模型選取名稱" class="pointer-events-none absolute inset-x-4 bottom-12 rounded-xl border border-white/15 bg-slate-950/90 px-4 py-3 text-white shadow-lg backdrop-blur-sm sm:right-auto sm:max-w-sm">
        @if (selectedInfo(); as item) {
          <p class="text-xs text-slate-400">目前選取 · {{ item.type === 'muscle' ? '肌肉' : item.type === 'bone' ? '骨骼系統' : '筋膜相關結構' }}</p>
          <p class="mt-1 break-words text-base font-semibold text-amber-300">{{ item.name }}</p>
          <p lang="en" class="mt-1 break-words text-xs text-slate-200">{{ item.english }}</p>
          <p class="mt-1 text-xs text-slate-400">{{ item.id }} · {{ item.location }}</p>
        } @else {
          <p class="text-sm text-slate-200">點選模型以查看名稱</p>
        }
      </div>
      @if (loading()) { <p role="status" class="absolute inset-x-4 top-20 flex items-center gap-2 rounded-lg bg-slate-800 p-4 text-sm text-white"><span aria-hidden="true" class="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"></span>載入肌肉與骨骼模型中…</p> }
      @if (loaded()) { <span role="status" class="pointer-events-none absolute right-4 top-16 text-xs text-slate-300">模型已載入</span> }
      @if (error()) { <div role="alert" class="absolute inset-x-4 top-20 rounded-lg bg-slate-800 p-4 text-sm text-white"><p>{{ error() }} 結構清單仍可使用。</p>@if (canRetry()) { <button type="button" class="mt-3 rounded border border-slate-500 px-3 py-2" (click)="retry()">重新載入模型</button> }</div> }
    </div>
  `,
})
export class MuscleViewerComponent implements AfterViewInit, OnDestroy {
  readonly selected = input<string | null>(null);
  readonly selectedInfo = computed(() => ACTIVE_STRUCTURES.find(item => item.id === this.selected()));
  readonly locateTarget = input<string | null>(null);
  readonly view = input<'front' | 'back'>('front');
  readonly isolated = input(false);
  readonly visibleType = input<VisibleType>('all');
  readonly regionFilter = input('');
  readonly muscleOpacity = input(100);
  readonly boneOpacity = input(100);
  readonly supportOpacity = input(40);
  readonly showAggregates = input(false);
  readonly wireframe = input(false);
  readonly explosion = input(0);
  readonly muscleSelected = output<string>();
  readonly error = signal('');
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly canRetry = signal(false);
  @ViewChild('host') private host!: ElementRef<HTMLDivElement>;
  private readonly zone = inject(NgZone);
  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private controls?: OrbitControls;
  private observer?: ResizeObserver;
  private model?: THREE.Group;
  private readonly bodyBox = new THREE.Box3();
  private readonly meshes: THREE.Mesh[] = [];
  private readonly originals = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private readonly highlightMaterial = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0x6b3500, roughness: .55, side: THREE.DoubleSide });
  private readonly knownIds = new Set(ACTIVE_STRUCTURES.map(structure => structure.id));
  private readonly availableIds = new Set<string>();
  private readonly parts = new Map<THREE.Object3D, { base: THREE.Vector3; direction: THREE.Vector3 }>();
  private currentExplosion = 0;
  private explosionRegion = '';
  private animation?: number;
  private down = { x: 0, y: 0 };
  private loadAbort?: AbortController;
  private destroyed = false;

  constructor() {
    effect(() => { this.updateAppearance(); });
    effect(() => {
      const view = this.view(), target = this.locateTarget(), ready = this.loaded();
      if (target) this.selected();
      if (ready) this.setView(view);
    });
    effect(() => {
      const region = this.regionFilter(), target = region ? this.explosion() : 0;
      this.zone.runOutsideAngular(() => {
        if (region !== this.explosionRegion) {
          if (this.animation !== undefined) cancelAnimationFrame(this.animation);
          this.animation = undefined;
          this.explosionRegion = region;
          this.applyExplosion(0);
        }
        this.animateExplosion(target);
      });
    });
  }
  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      try {
        const host = this.host.nativeElement;
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x0f172a);
        this.renderer.domElement.setAttribute('aria-hidden', 'true');
        host.appendChild(this.renderer.domElement);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(38, 1, .01, 100);
        this.camera.position.set(0, 0, 5.5);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enablePan = true; this.controls.minDistance = .15; this.controls.maxDistance = 15;
        this.controls.addEventListener('change', this.render);
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 2.2));
        const light = new THREE.DirectionalLight(0xffffff, 2.5); light.position.set(2, 3, 4); this.scene.add(light);
        const rim = new THREE.DirectionalLight(0xbccaff, 1.2); rim.position.set(-3, 2, -4); this.scene.add(rim);
        this.observer = new ResizeObserver(() => {
          const { width, height } = host.getBoundingClientRect();
          if (!width || !height || !this.camera || !this.renderer) return;
          this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
          this.renderer.setSize(width, height); this.render();
        });
        this.observer.observe(host);
        void this.loadModel();
      } catch { this.zone.run(() => this.error.set('此瀏覽器無法啟用 WebGL 3D 顯示。')); }
    });
  }
  retry(): void { this.zone.runOutsideAngular(() => { void this.loadModel(); }); }
  private async loadModel(): Promise<void> {
    this.loadAbort?.abort();
    if (this.animation !== undefined) cancelAnimationFrame(this.animation);
    const abort = new AbortController(); this.loadAbort = abort;
    this.zone.run(() => { this.loading.set(true); this.loaded.set(false); this.error.set(''); this.canRetry.set(false); });
    try {
      const response = await fetch('assets/anatomy/startup-reconciled/atlas.glb', { signal: abort.signal });
      if (!response.ok) throw new Error(`Model HTTP ${response.status}`);
      const data = await response.arrayBuffer();
      if (abort.signal.aborted) return;
      const gltf = await new GLTFLoader().parseAsync(data, 'assets/anatomy/startup-reconciled/');
      if (this.destroyed || this.loadAbort !== abort) { this.disposeModel(gltf.scene); return; }
      if (this.model) { this.scene?.remove(this.model); this.disposeModel(this.model); }
      this.meshes.length = 0; this.originals.clear(); this.parts.clear(); this.availableIds.clear();
      const owners = new Set<THREE.Object3D>();
      let invalid = false;
      gltf.scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        let ancestor: THREE.Object3D | null = object, owner: THREE.Object3D | undefined;
        while (ancestor) { if (ancestor.userData['atlasRole']) owner = ancestor; ancestor = ancestor.parent; }
        const role = owner?.userData['atlasRole'];
        const id = owner?.userData['anatomyId'];
        if (!id || !this.knownIds.has(id) || !['muscle', 'bone', 'support'].includes(role)) { invalid = true; return; }
        object.userData['muscleId'] = id;
        object.userData['atlasRole'] = role;
        object.userData['region'] = owner?.userData['region'];
        object.userData['zones'] = owner?.userData['zones'];
        object.userData['aggregate'] = owner?.userData['aggregate'];
        this.meshes.push(object); this.originals.set(object, object.material);
        if (id) this.availableIds.add(id);
        if (role === 'muscle' && owner) owners.add(owner);
      });
      if (invalid || this.availableIds.size !== this.knownIds.size) {
        this.disposeModel(gltf.scene); this.meshes.length = 0; this.originals.clear();
        throw new Error('Model/catalog mismatch; regenerate the catalog.');
      }
      gltf.scene.updateMatrixWorld(true);
      const box = new THREE.Box3();
      for (const mesh of this.meshes) box.expandByObject(mesh);
      const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
      for (const owner of owners) {
        const direction = new THREE.Box3().setFromObject(owner).getCenter(new THREE.Vector3()).sub(center);
        direction.y *= .25; direction.z *= 1.4;
        if (direction.lengthSq() < .00001) direction.set(0, 0, 1);
        direction.normalize().multiplyScalar(.48);
        this.parts.set(owner, { base: owner.position.clone(), direction });
      }
      gltf.scene.position.sub(center);
      this.model = new THREE.Group(); this.model.add(gltf.scene);
      this.model.scale.setScalar(3.2 / Math.max(size.x, size.y, size.z));
      this.scene!.add(this.model); this.model.updateMatrixWorld(true);
      this.bodyBox.makeEmpty();
      for (const mesh of this.meshes) this.bodyBox.expandByObject(mesh);
      this.currentExplosion = 0;
      this.updateAppearance(); this.setView(this.view());
      this.zone.run(() => this.loaded.set(true));
      this.animateExplosion(this.explosion());
    } catch (error) {
      if (!abort.signal.aborted && !this.destroyed) this.zone.run(() => {
        this.error.set(error instanceof Error && error.message.includes('mismatch') ? '模型與結構清單不一致，請重新產生模型清單。' : '人體模型載入失敗，請確認模型檔案或網路後重試。');
        this.canRetry.set(true);
      });
    } finally {
      if (!this.destroyed && this.loadAbort === abort) this.zone.run(() => this.loading.set(false));
    }
  }
  private updateAppearance(): void {
    const id = this.selected(), isolated = this.isolated(), type = this.visibleType(), region = this.regionFilter();
    const muscleOpacity = this.muscleOpacity() / 100, boneOpacity = this.boneOpacity() / 100, wireframe = this.wireframe();
    const supportOpacity = this.supportOpacity() / 100, showAggregates = this.showAggregates();
    for (const mesh of this.meshes) {
      const selected = mesh.userData['muscleId'] === id;
      const role = mesh.userData['atlasRole'];
      const opacity = role === 'bone' ? boneOpacity : role === 'support' ? supportOpacity : muscleOpacity;
      const original = this.originals.get(mesh)!;
      for (const material of Array.isArray(original) ? original : [original]) {
        if (material.transparent !== (opacity < 1)) { material.transparent = opacity < 1; material.needsUpdate = true; }
        material.opacity = opacity; material.depthWrite = opacity >= 1;
        if (material instanceof THREE.MeshStandardMaterial) material.wireframe = wireframe;
      }
      this.highlightMaterial.wireframe = wireframe;
      mesh.material = selected ? this.highlightMaterial : this.originals.get(mesh)!;
      const supported = isVisibleInSystem(role, type) && (!region || mesh.userData['zones']?.includes(region)) && opacity > 0 && (!mesh.userData['aggregate'] || showAggregates || selected);
      mesh.layers.set(supported && (!isolated || !id || selected) ? 0 : 1);
    }
    this.render();
  }
  private setView(view: 'front' | 'back'): void {
    if (!this.camera || !this.controls || this.bodyBox.isEmpty()) return;
    const direction = new THREE.Vector3(0, 0, view === 'front' ? 1 : -1);
    if (this.locateTarget() && this.locateTarget() === this.selected()) { this.focusSelected(direction); return; }
    this.fitBox(this.bodyBox.clone().expandByScalar(untracked(() => this.explosion()) / 100 * .9), direction);
  }
  private applyExplosion(value: number): void {
    this.currentExplosion = value;
    for (const [part, state] of this.parts) {
      const amount = this.explosionRegion && part.userData['zones']?.includes(this.explosionRegion) ? value / 100 : 0;
      part.position.copy(state.base).addScaledVector(state.direction, amount);
    }
    this.model?.updateMatrixWorld(true); this.render();
  }
  private animateExplosion(value: number): void {
    if (!this.parts.size || this.destroyed) return;
    if (this.animation !== undefined) cancelAnimationFrame(this.animation);
    const target = Math.max(0, Math.min(100, value));
    const from = this.currentExplosion, start = performance.now();
    if (this.camera && this.controls) {
      if (target === 0 && this.locateTarget() && this.locateTarget() === this.selected()) this.setView(this.view());
      else this.fitBox(this.bodyBox.clone().expandByScalar(target / 100 * .9), this.camera.position.clone().sub(this.controls.target));
    }
    const frame = (now: number): void => {
      if (this.destroyed) return;
      const t = Math.min(1, (now - start) / 350);
      this.applyExplosion(from + (target - from) * (1 - (1-t) ** 3));
      this.animation = t < 1 ? requestAnimationFrame(frame) : undefined;
    };
    this.animation = requestAnimationFrame(frame);
  }
  private fitBox(box: THREE.Box3, direction: THREE.Vector3): void {
    if (!this.camera || !this.controls || box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const vertical = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const distance = Math.max(size.y / (2 * vertical), size.x / (2 * vertical * this.camera.aspect), .15) * 1.15 + size.z / 2;
    this.controls.target.copy(center);
    this.camera.position.copy(center).add(direction.normalize().multiplyScalar(distance));
    this.controls.update(); this.render();
  }
  focusSelected(direction?: THREE.Vector3): void {
    if (!this.camera || !this.controls || !this.selected()) return;
    const box = new THREE.Box3();
    for (const mesh of this.meshes) if (mesh.userData['muscleId'] === this.selected()) box.expandByObject(mesh);
    this.fitBox(box, direction ?? this.camera.position.clone().sub(this.controls.target));
  }
  reset(): void { this.setView(this.view()); }
  pointerDown(event: PointerEvent): void { this.down = { x: event.clientX, y: event.clientY }; }
  pick(event: PointerEvent): void {
    if (!this.camera || !this.loaded() || Math.hypot(event.clientX-this.down.x, event.clientY-this.down.y)>6) return;
    const rect = this.host.nativeElement.getBoundingClientRect();
    const pointer = new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1, -(event.clientY-rect.top)/rect.height*2+1);
    const ray = new THREE.Raycaster(); ray.setFromCamera(pointer, this.camera);
    const hit = ray.intersectObjects(this.meshes.filter(mesh => mesh.layers.isEnabled(0)), false)[0];
    const id = hit?.object.userData['muscleId'];
    if (id) this.muscleSelected.emit(id);
  }
  private readonly render = (): void => { if (this.renderer && this.scene && this.camera) this.renderer.render(this.scene, this.camera); };
  private disposeModel(root: THREE.Object3D): void {
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    root.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const material = this.originals.get(object) ?? object.material;
      for (const item of Array.isArray(material) ? material : [material]) materials.add(item);
    });
    for (const material of materials) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      if (material !== this.highlightMaterial) material.dispose();
    }
    for (const geometry of geometries) geometry.dispose();
    for (const texture of textures) texture.dispose();
  }
  ngOnDestroy(): void {
    this.destroyed = true; this.loadAbort?.abort(); this.observer?.disconnect(); this.controls?.dispose();
    if (this.animation !== undefined) cancelAnimationFrame(this.animation);
    if (this.model) this.disposeModel(this.model);
    this.highlightMaterial.dispose(); this.originals.clear(); this.meshes.length = 0;
    this.renderer?.dispose(); this.renderer?.domElement.remove();
  }
}




