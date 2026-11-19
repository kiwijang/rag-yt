import { ACTIVE_STRUCTURES, ACTIVE_ZONES, ACTIVE_ALIASES } from './active-anatomy.generated';

export const ANATOMY_REGIONS: Record<string, string> = ACTIVE_ZONES;
export type StructureType = 'muscle' | 'bone' | 'support';
export type VisibleType = 'all' | 'myofascial' | 'bone';
export type AnatomyStructure = {
  id: string; name: string; english: string; type: StructureType; zone: string;
  region: string; location: string; side: string; file: string; zones: string[]; source: string; referenceId: string | null; aggregate: boolean;
};
export const ANATOMY_ITEMS: AnatomyStructure[] = ACTIVE_STRUCTURES.map(item => ({
  ...item, type: item.type as StructureType, region: item.zones.map(zone => ANATOMY_REGIONS[zone] ?? zone).join('、'),
}));
export const ANATOMY_COUNTS = {
  total: ANATOMY_ITEMS.length,
  muscles: ANATOMY_ITEMS.filter(item => item.type === 'muscle').length,
  bones: ANATOMY_ITEMS.filter(item => item.type === 'bone').length,
  support: ANATOMY_ITEMS.filter(item => item.type === 'support').length,
};


export function resolveAnatomyId(id: string): string | null {
  const resolved = ACTIVE_ALIASES[id] ?? id;
  return ANATOMY_ITEMS.some(item => item.id === resolved) ? resolved : null;
}


export function isVisibleInSystem(type: StructureType, system: VisibleType): boolean {
  return system === 'all' || (system === 'myofascial' ? type === 'muscle' || type === 'support' : type === 'bone');
}

