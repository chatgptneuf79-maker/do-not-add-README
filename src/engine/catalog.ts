import type { CatalogV1, ActivityDef, ItemDef, WorldDef } from "./types";

export function getWorld(c: CatalogV1, worldId: string): WorldDef | undefined {
  return c.worlds.find(w => w.world_id === worldId);
}

export function getActivity(c: CatalogV1, id: string): ActivityDef | undefined {
  return c.activities.find(a => a.activity_id === id);
}

export function getItem(c: CatalogV1, id: string): ItemDef | undefined {
  return c.items.find(i => i.item_id === id);
}
