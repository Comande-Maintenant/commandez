export type POSOrderType = "sur_place" | "a_emporter" | "telephone";
export type POSScreen = "order_type" | "covers" | "builder" | "upsell" | "recap" | "success";

export interface POSPersonOrder {
  personIndex: number;
  label: string;
  items: POSItem[];
}

export interface POSItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
}

export interface POSState {
  screen: POSScreen;
  orderType: POSOrderType;
  covers: number;
  persons: POSPersonOrder[];
  currentPerson: number;
  notes: string;
  customerName: string;
}
