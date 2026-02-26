export type OrderStatus = "new" | "preparing" | "ready" | "done";

export interface OrderItem {
  name: string;
  quantity: number;
  sauces: string[];
  supplements: string[];
  price: number;
}

export interface Order {
  id: string;
  number: number;
  customerName: string;
  customerPhone: string;
  type: "collect" | "delivery";
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  createdAt: Date;
  estimatedTime: string;
}

export const mockOrders: Order[] = [
  {
    id: "ord-1",
    number: 147,
    customerName: "Mehdi B.",
    customerPhone: "06 12 34 56 78",
    type: "collect",
    status: "new",
    items: [
      { name: "Kebab classique", quantity: 2, sauces: ["Samouraï", "Blanche"], supplements: ["Double viande"], price: 7.50 },
      { name: "Tacos M", quantity: 1, sauces: ["Algérienne"], supplements: [], price: 8.00 },
    ],
    total: 25.50,
    createdAt: new Date(Date.now() - 2 * 60000),
    estimatedTime: "15 min",
  },
  {
    id: "ord-2",
    number: 148,
    customerName: "Sarah L.",
    customerPhone: "07 98 76 54 32",
    type: "delivery",
    status: "new",
    items: [
      { name: "Assiette kebab", quantity: 1, sauces: ["Blanche"], supplements: ["Fromage supplémentaire"], price: 11.00 },
      { name: "Coca-Cola 33cl", quantity: 2, sauces: [], supplements: [], price: 2.00 },
    ],
    total: 17.99,
    createdAt: new Date(Date.now() - 5 * 60000),
    estimatedTime: "25 min",
  },
  {
    id: "ord-3",
    number: 146,
    customerName: "Lucas D.",
    customerPhone: "06 55 44 33 22",
    type: "collect",
    status: "preparing",
    items: [
      { name: "Tacos XL", quantity: 1, sauces: ["Samouraï", "Barbecue"], supplements: ["Double viande", "Œuf"], price: 10.50 },
    ],
    total: 14.00,
    createdAt: new Date(Date.now() - 12 * 60000),
    estimatedTime: "10 min",
  },
  {
    id: "ord-4",
    number: 145,
    customerName: "Amina K.",
    customerPhone: "07 11 22 33 44",
    type: "delivery",
    status: "ready",
    items: [
      { name: "Kebab galette", quantity: 1, sauces: ["Harissa"], supplements: [], price: 8.50 },
      { name: "Assiette mixte", quantity: 1, sauces: ["Blanche", "Samouraï"], supplements: [], price: 13.00 },
    ],
    total: 25.49,
    createdAt: new Date(Date.now() - 20 * 60000),
    estimatedTime: "—",
  },
  {
    id: "ord-5",
    number: 144,
    customerName: "Julien P.",
    customerPhone: "06 77 88 99 00",
    type: "collect",
    status: "done",
    items: [
      { name: "Kebab classique", quantity: 1, sauces: ["Ketchup"], supplements: [], price: 7.50 },
    ],
    total: 7.50,
    createdAt: new Date(Date.now() - 45 * 60000),
    estimatedTime: "—",
  },
];
