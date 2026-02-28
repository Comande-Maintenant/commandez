export interface Supplement {
  id: string;
  name: string;
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  popular?: boolean;
  supplements: Supplement[];
  sauces: string[];
}

export interface Restaurant {
  id: string;
  slug: string;
  name: string;
  description: string;
  cuisine: string;
  image: string;
  coverImage: string;
  rating: number;
  reviewCount: number;
  address: string;
  city: string;
  estimatedTime: string;
  minimumOrder: number;
  isOpen: boolean;
  hours: string;
  categories: string[];
  menu: MenuItem[];
}

const commonSauces = ["Blanche", "Samouraï", "Algérienne", "Harissa", "Ketchup", "Mayonnaise", "Barbecue"];

const commonSupplements: Supplement[] = [
  { id: "sup-1", name: "Double viande", price: 2.50 },
  { id: "sup-2", name: "Fromage supplémentaire", price: 1.00 },
  { id: "sup-3", name: "Frites", price: 2.00 },
  { id: "sup-4", name: "Boisson 33cl", price: 1.50 },
  { id: "sup-5", name: "Œuf", price: 1.00 },
];

export const restaurants: Restaurant[] = [
  {
    id: "r1",
    slug: "istanbul-kebab-paris",
    name: "Istanbul Kebab",
    description: "Le meilleur kebab artisanal de Paris. Viande fraîche grillée chaque jour, sauces maison.",
    cuisine: "Kebab · Turc",
    image: "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400&h=300&fit=crop",
    coverImage: "https://images.unsplash.com/photo-1561651188-d207bbec4ec3?w=1200&h=400&fit=crop",
    rating: 4.7,
    reviewCount: 342,
    address: "42 Rue du Faubourg Saint-Denis",
    city: "Paris 10e",
    estimatedTime: "15-25 min",
    minimumOrder: 10,
    isOpen: true,
    hours: "11h00 - 23h00",
    categories: ["Sandwichs", "Assiettes", "Boissons", "Desserts"],
    menu: [
      { id: "m1", name: "Kebab classique", description: "Viande grillée, salade, tomates, oignons dans un pain frais", price: 7.50, image: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=300&h=200&fit=crop", category: "Sandwichs", popular: true, supplements: commonSupplements, sauces: commonSauces },
      { id: "m2", name: "Kebab galette", description: "Kebab enroulé dans une galette de blé croustillante", price: 8.50, image: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?w=300&h=200&fit=crop", category: "Sandwichs", supplements: commonSupplements, sauces: commonSauces },
      { id: "m3", name: "Tacos M", description: "Viande, frites, fromage fondu dans une galette grillée", price: 8.00, image: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=300&h=200&fit=crop", category: "Sandwichs", popular: true, supplements: commonSupplements, sauces: commonSauces },
      { id: "m4", name: "Tacos XL", description: "Double viande, frites, fromage, sauce au choix", price: 10.50, image: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=300&h=200&fit=crop", category: "Sandwichs", supplements: commonSupplements, sauces: commonSauces },
      { id: "m5", name: "Assiette kebab", description: "Viande grillée, riz, salade, sauce blanche", price: 11.00, image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=300&h=200&fit=crop", category: "Assiettes", popular: true, supplements: commonSupplements, sauces: commonSauces },
      { id: "m6", name: "Assiette mixte", description: "Mélange de viandes, frites, salade, sauces", price: 13.00, image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=300&h=200&fit=crop", category: "Assiettes", supplements: commonSupplements, sauces: commonSauces },
      { id: "m7", name: "Coca-Cola 33cl", description: "", price: 2.00, image: "", category: "Boissons", supplements: [], sauces: [] },
      { id: "m8", name: "Orangina 33cl", description: "", price: 2.00, image: "", category: "Boissons", supplements: [], sauces: [] },
      { id: "m9", name: "Eau minérale 50cl", description: "", price: 1.50, image: "", category: "Boissons", supplements: [], sauces: [] },
      { id: "m10", name: "Baklava (2 pièces)", description: "Pâtisserie turque au miel et pistaches", price: 3.50, image: "", category: "Desserts", supplements: [], sauces: [] },
    ],
  },
  {
    id: "r2",
    slug: "chez-ali-tacos-lyon",
    name: "Chez Ali Tacos",
    description: "Tacos français XXL faits maison. Viande hachée fraîche, fromage fondu, sauces secrètes.",
    cuisine: "Tacos · Fast-food",
    image: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&h=300&fit=crop",
    coverImage: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&h=400&fit=crop",
    rating: 4.5,
    reviewCount: 218,
    address: "15 Rue de la République",
    city: "Lyon 2e",
    estimatedTime: "20-30 min",
    minimumOrder: 12,
    isOpen: true,
    hours: "11h30 - 00h00",
    categories: ["Tacos", "Burgers", "Boissons", "Desserts"],
    menu: [
      { id: "m11", name: "Tacos S", description: "1 viande, frites, fromage, sauce", price: 6.50, image: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=300&h=200&fit=crop", category: "Tacos", supplements: commonSupplements, sauces: commonSauces },
      { id: "m12", name: "Tacos L", description: "2 viandes, frites, fromage, sauce", price: 9.50, image: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=300&h=200&fit=crop", category: "Tacos", popular: true, supplements: commonSupplements, sauces: commonSauces },
      { id: "m13", name: "Tacos XXL", description: "3 viandes, frites, fromage, double sauce", price: 12.00, image: "https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=300&h=200&fit=crop", category: "Tacos", popular: true, supplements: commonSupplements, sauces: commonSauces },
      { id: "m14", name: "Smash Burger", description: "Steak haché smashé, cheddar, oignons caramélisés", price: 8.50, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=200&fit=crop", category: "Burgers", popular: true, supplements: commonSupplements, sauces: commonSauces },
      { id: "m15", name: "Double Smash", description: "Double steak smashé, double cheddar, sauce maison", price: 11.00, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=200&fit=crop", category: "Burgers", supplements: commonSupplements, sauces: commonSauces },
      { id: "m16", name: "Ice Tea 33cl", description: "", price: 2.00, image: "", category: "Boissons", supplements: [], sauces: [] },
      { id: "m17", name: "Sprite 33cl", description: "", price: 2.00, image: "", category: "Boissons", supplements: [], sauces: [] },
      { id: "m18", name: "Tiramisu", description: "Tiramisu maison au café", price: 4.00, image: "", category: "Desserts", supplements: [], sauces: [] },
    ],
  },
  {
    id: "r3",
    slug: "le-sultan-marseille",
    name: "Le Sultan",
    description: "Spécialités orientales et kebab premium. Viande à la broche, pain maison cuit au four.",
    cuisine: "Oriental · Kebab",
    image: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop",
    coverImage: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&h=400&fit=crop",
    rating: 4.8,
    reviewCount: 567,
    address: "8 Cours Julien",
    city: "Marseille 6e",
    estimatedTime: "15-20 min",
    minimumOrder: 8,
    isOpen: true,
    hours: "11h00 - 22h30",
    categories: ["Sandwichs", "Assiettes", "Boissons"],
    menu: [
      { id: "m19", name: "Chawarma poulet", description: "Poulet mariné, salade, pickles, sauce ail", price: 7.00, image: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=300&h=200&fit=crop", category: "Sandwichs", popular: true, supplements: commonSupplements, sauces: commonSauces },
      { id: "m20", name: "Chawarma mixte", description: "Mélange poulet & viande, légumes grillés", price: 8.50, image: "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=300&h=200&fit=crop", category: "Sandwichs", supplements: commonSupplements, sauces: commonSauces },
      { id: "m21", name: "Falafel wrap", description: "Falafels maison, houmous, taboulé, sauce tahini", price: 7.50, image: "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=300&h=200&fit=crop", category: "Sandwichs", supplements: commonSupplements, sauces: commonSauces },
      { id: "m22", name: "Assiette royale", description: "Mélange de viandes, riz parfumé, salade, houmous", price: 14.00, image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=300&h=200&fit=crop", category: "Assiettes", popular: true, supplements: commonSupplements, sauces: commonSauces },
      { id: "m23", name: "Ayran", description: "Boisson lactée traditionnelle", price: 2.50, image: "", category: "Boissons", supplements: [], sauces: [] },
      { id: "m24", name: "Thé à la menthe", description: "Thé vert à la menthe fraîche", price: 2.00, image: "", category: "Boissons", supplements: [], sauces: [] },
    ],
  },
  {
    id: "r4",
    slug: "king-burger-bordeaux",
    name: "King Burger",
    description: "Burgers gourmet et frites maison. Tout est frais, tout est bon.",
    cuisine: "Burger · Américain",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop",
    coverImage: "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=1200&h=400&fit=crop",
    rating: 4.3,
    reviewCount: 156,
    address: "22 Place de la Victoire",
    city: "Bordeaux",
    estimatedTime: "25-35 min",
    minimumOrder: 15,
    isOpen: false,
    hours: "12h00 - 22h00",
    categories: ["Burgers", "Sides", "Boissons"],
    menu: [
      { id: "m25", name: "Classic Burger", description: "Steak, salade, tomate, cheddar, sauce maison", price: 9.00, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=200&fit=crop", category: "Burgers", popular: true, supplements: commonSupplements, sauces: commonSauces },
      { id: "m26", name: "Bacon Lover", description: "Double steak, bacon croustillant, cheddar fondu", price: 12.00, image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=200&fit=crop", category: "Burgers", popular: true, supplements: commonSupplements, sauces: commonSauces },
      { id: "m27", name: "Frites maison", description: "Frites fraîches coupées main", price: 3.50, image: "", category: "Sides", supplements: [], sauces: commonSauces },
      { id: "m28", name: "Onion Rings", description: "Rondelles d'oignon panées croustillantes", price: 4.00, image: "", category: "Sides", supplements: [], sauces: commonSauces },
      { id: "m29", name: "Milkshake vanille", description: "", price: 4.50, image: "", category: "Boissons", supplements: [], sauces: [] },
    ],
  },
  {
    id: "r5",
    slug: "pizza-napoli-nice",
    name: "Pizza Napoli",
    description: "Pizzas napolitaines au feu de bois. Pâte fermentée 48h, ingrédients importés d'Italie.",
    cuisine: "Pizza · Italien",
    image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop",
    coverImage: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1200&h=400&fit=crop",
    rating: 4.9,
    reviewCount: 891,
    address: "5 Rue Masséna",
    city: "Nice",
    estimatedTime: "20-30 min",
    minimumOrder: 12,
    isOpen: true,
    hours: "11h30 - 23h00",
    categories: ["Pizzas", "Entrées", "Boissons", "Desserts"],
    menu: [
      { id: "m30", name: "Margherita", description: "Tomate, mozzarella di bufala, basilic frais", price: 9.00, image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&h=200&fit=crop", category: "Pizzas", popular: true, supplements: [{ id: "sp1", name: "Supplément mozzarella", price: 2.00 }, { id: "sp2", name: "Jambon de Parme", price: 3.00 }], sauces: [] },
      { id: "m31", name: "4 Formaggi", description: "Mozzarella, gorgonzola, parmesan, chèvre", price: 12.00, image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&h=200&fit=crop", category: "Pizzas", supplements: [{ id: "sp1", name: "Supplément mozzarella", price: 2.00 }], sauces: [] },
      { id: "m32", name: "Diavola", description: "Tomate, mozzarella, salami piquant, piment", price: 11.00, image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300&h=200&fit=crop", category: "Pizzas", popular: true, supplements: [{ id: "sp1", name: "Supplément mozzarella", price: 2.00 }], sauces: [] },
      { id: "m33", name: "Bruschetta", description: "Pain grillé, tomates fraîches, ail, basilic", price: 5.50, image: "", category: "Entrées", supplements: [], sauces: [] },
      { id: "m34", name: "San Pellegrino 33cl", description: "", price: 3.00, image: "", category: "Boissons", supplements: [], sauces: [] },
      { id: "m35", name: "Panna Cotta", description: "Crème cuite vanille, coulis de fruits rouges", price: 5.00, image: "", category: "Desserts", supplements: [], sauces: [] },
    ],
  },
];

export const getRestaurantBySlug = (slug: string): Restaurant | undefined => {
  return restaurants.find((r) => r.slug === slug);
};
