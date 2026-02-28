export type POSOrderType = "sur_place" | "a_emporter" | "telephone";
export type POSScreen = "order_type" | "person_builder" | "boissons" | "desserts" | "recap" | "success";
export type GarnitureLevel = "non" | "oui" | "x2";

export interface POSGarnitureChoice {
  optionId: string;
  name: string;
  level: GarnitureLevel;
}

export interface POSAccompagnement {
  optionId: string;
  name: string;
  portion: "normale" | "double";
  portionPriceMod: number;
  subSauceId?: string;
  subSauceName?: string;
}

export interface POSSupplement {
  optionId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface POSCustomization {
  baseId: string;
  baseName: string;
  viandeIds: string[];
  viandeNames: string[];
  garnitures: POSGarnitureChoice[];
  sauceIds: string[];
  sauceNames: string[];
  accompagnement: POSAccompagnement | null;
  supplements: POSSupplement[];
}

export interface POSPersonOrder {
  personIndex: number;
  label: string;
  customization: POSCustomization | null;
  itemPrice: number;
}

export interface POSDrinkItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface POSDessertItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface POSState {
  screen: POSScreen;
  orderType: POSOrderType;
  persons: POSPersonOrder[];
  currentPerson: number;
  drinks: POSDrinkItem[];
  desserts: POSDessertItem[];
  dessertPending: boolean;
  notes: string;
  customerName: string;
  tableNumber: string;
  orderNumber: number;
  submitting: boolean;
}
