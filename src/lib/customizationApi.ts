import { supabase } from "@/integrations/supabase/client";
import type {
  DbBase,
  DbViande,
  DbGarniture,
  DbSauce,
  DbAccompagnement,
  DbOrderConfig,
  CustomizationData,
  DbCuisineStepTemplate,
  CuisineType,
  UniversalCustomizationData,
} from "@/types/customization";

// ============================================================
// Fetch all customization data for a restaurant (6 parallel queries)
// ============================================================

export async function fetchCustomizationData(restaurantId: string): Promise<CustomizationData> {
  const [basesRes, viandesRes, garnituresRes, saucesRes, accompRes, configRes] = await Promise.all([
    supabase.from("restaurant_bases").select("*").eq("restaurant_id", restaurantId).eq("enabled", true).order("sort_order"),
    supabase.from("restaurant_viandes").select("*").eq("restaurant_id", restaurantId).eq("enabled", true).order("sort_order"),
    supabase.from("restaurant_garnitures").select("*").eq("restaurant_id", restaurantId).eq("enabled", true).order("sort_order"),
    supabase.from("restaurant_sauces").select("*").eq("restaurant_id", restaurantId).eq("enabled", true).order("sort_order"),
    supabase.from("restaurant_accompagnements").select("*").eq("restaurant_id", restaurantId).eq("enabled", true).order("sort_order"),
    supabase.from("restaurant_order_config").select("*").eq("restaurant_id", restaurantId).maybeSingle(),
  ]);

  return {
    bases: (basesRes.data ?? []) as unknown as DbBase[],
    viandes: (viandesRes.data ?? []) as unknown as DbViande[],
    garnitures: (garnituresRes.data ?? []) as unknown as DbGarniture[],
    sauces: (saucesRes.data ?? []) as unknown as DbSauce[],
    accompagnements: (accompRes.data ?? []) as unknown as DbAccompagnement[],
    config: (configRes.data as unknown as DbOrderConfig) ?? null,
  };
}

// ============================================================
// Fetch ALL (including disabled) for dashboard CRUD
// ============================================================

export async function fetchAllBases(restaurantId: string): Promise<DbBase[]> {
  const { data } = await supabase.from("restaurant_bases").select("*").eq("restaurant_id", restaurantId).order("sort_order");
  return (data ?? []) as unknown as DbBase[];
}

export async function fetchAllViandes(restaurantId: string): Promise<DbViande[]> {
  const { data } = await supabase.from("restaurant_viandes").select("*").eq("restaurant_id", restaurantId).order("sort_order");
  return (data ?? []) as unknown as DbViande[];
}

export async function fetchAllGarnitures(restaurantId: string): Promise<DbGarniture[]> {
  const { data } = await supabase.from("restaurant_garnitures").select("*").eq("restaurant_id", restaurantId).order("sort_order");
  return (data ?? []) as unknown as DbGarniture[];
}

export async function fetchAllSauces(restaurantId: string): Promise<DbSauce[]> {
  const { data } = await supabase.from("restaurant_sauces").select("*").eq("restaurant_id", restaurantId).order("sort_order");
  return (data ?? []) as unknown as DbSauce[];
}

export async function fetchAllAccompagnements(restaurantId: string): Promise<DbAccompagnement[]> {
  const { data } = await supabase.from("restaurant_accompagnements").select("*").eq("restaurant_id", restaurantId).order("sort_order");
  return (data ?? []) as unknown as DbAccompagnement[];
}

export async function fetchOrderConfig(restaurantId: string): Promise<DbOrderConfig | null> {
  const { data } = await supabase.from("restaurant_order_config").select("*").eq("restaurant_id", restaurantId).maybeSingle();
  return (data as unknown as DbOrderConfig) ?? null;
}

// ============================================================
// CRUD: Bases
// ============================================================

export async function insertBase(data: Partial<DbBase> & { restaurant_id: string; name: string }) {
  const { error } = await supabase.from("restaurant_bases").insert(data);
  if (error) throw error;
}

export async function updateBase(id: string, data: Partial<DbBase>) {
  const { error } = await supabase.from("restaurant_bases").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteBase(id: string) {
  const { error } = await supabase.from("restaurant_bases").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// CRUD: Viandes
// ============================================================

export async function insertViande(data: Partial<DbViande> & { restaurant_id: string; name: string }) {
  const { error } = await supabase.from("restaurant_viandes").insert(data);
  if (error) throw error;
}

export async function updateViande(id: string, data: Partial<DbViande>) {
  const { error } = await supabase.from("restaurant_viandes").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteViande(id: string) {
  const { error } = await supabase.from("restaurant_viandes").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// CRUD: Garnitures
// ============================================================

export async function insertGarniture(data: Partial<DbGarniture> & { restaurant_id: string; name: string }) {
  const { error } = await supabase.from("restaurant_garnitures").insert(data);
  if (error) throw error;
}

export async function updateGarniture(id: string, data: Partial<DbGarniture>) {
  const { error } = await supabase.from("restaurant_garnitures").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteGarniture(id: string) {
  const { error } = await supabase.from("restaurant_garnitures").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// CRUD: Sauces
// ============================================================

export async function insertSauce(data: Partial<DbSauce> & { restaurant_id: string; name: string }) {
  const { error } = await supabase.from("restaurant_sauces").insert(data);
  if (error) throw error;
}

export async function updateSauce(id: string, data: Partial<DbSauce>) {
  const { error } = await supabase.from("restaurant_sauces").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteSauce(id: string) {
  const { error } = await supabase.from("restaurant_sauces").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// CRUD: Accompagnements
// ============================================================

export async function insertAccompagnement(data: Partial<DbAccompagnement> & { restaurant_id: string; name: string }) {
  const { error } = await supabase.from("restaurant_accompagnements").insert(data);
  if (error) throw error;
}

export async function updateAccompagnement(id: string, data: Partial<DbAccompagnement>) {
  const { error } = await supabase.from("restaurant_accompagnements").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function deleteAccompagnement(id: string) {
  const { error } = await supabase.from("restaurant_accompagnements").delete().eq("id", id);
  if (error) throw error;
}

// ============================================================
// CRUD: Order Config
// ============================================================

export async function upsertOrderConfig(restaurantId: string, data: Partial<DbOrderConfig>) {
  const { error } = await supabase
    .from("restaurant_order_config")
    .upsert({ ...data, restaurant_id: restaurantId, updated_at: new Date().toISOString() }, { onConflict: "restaurant_id" });
  if (error) throw error;
}

// ============================================================
// Universal Order Engine: fetch cuisine templates
// ============================================================

export async function fetchCuisineStepTemplates(cuisineType: string): Promise<DbCuisineStepTemplate[]> {
  const { data } = await supabase
    .from("cuisine_step_templates")
    .select("*")
    .eq("cuisine_type", cuisineType)
    .order("sort_order");
  return (data ?? []) as unknown as DbCuisineStepTemplate[];
}

export async function fetchRestaurantCuisineType(restaurantId: string): Promise<CuisineType> {
  const { data } = await supabase
    .from("restaurants")
    .select("cuisine_type")
    .eq("id", restaurantId)
    .maybeSingle();
  return ((data as any)?.cuisine_type as CuisineType) ?? "generic";
}

export async function fetchUniversalCustomizationData(restaurantId: string): Promise<UniversalCustomizationData> {
  const [baseData, cuisineType] = await Promise.all([
    fetchCustomizationData(restaurantId),
    fetchRestaurantCuisineType(restaurantId),
  ]);
  const stepTemplates = await fetchCuisineStepTemplates(cuisineType);
  return {
    ...baseData,
    cuisine_type: cuisineType,
    stepTemplates,
  };
}

// ============================================================
// Batch sort order updates
// ============================================================

export async function batchUpdateBaseSortOrder(updates: { id: string; sort_order: number }[]) {
  for (const u of updates) {
    await supabase.from("restaurant_bases").update({ sort_order: u.sort_order }).eq("id", u.id);
  }
}

export async function batchUpdateViandeSortOrder(updates: { id: string; sort_order: number }[]) {
  for (const u of updates) {
    await supabase.from("restaurant_viandes").update({ sort_order: u.sort_order }).eq("id", u.id);
  }
}

export async function batchUpdateGarnitureSortOrder(updates: { id: string; sort_order: number }[]) {
  for (const u of updates) {
    await supabase.from("restaurant_garnitures").update({ sort_order: u.sort_order }).eq("id", u.id);
  }
}

export async function batchUpdateSauceSortOrder(updates: { id: string; sort_order: number }[]) {
  for (const u of updates) {
    await supabase.from("restaurant_sauces").update({ sort_order: u.sort_order }).eq("id", u.id);
  }
}

export async function batchUpdateAccompagnementSortOrder(updates: { id: string; sort_order: number }[]) {
  for (const u of updates) {
    await supabase.from("restaurant_accompagnements").update({ sort_order: u.sort_order }).eq("id", u.id);
  }
}
