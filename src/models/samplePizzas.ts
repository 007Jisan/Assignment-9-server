export interface SamplePizza {
  _id: string;
  itemName: string;
  category: string;
  description: string;
  price: number;
  location: string;
  images: string[];
  status: string;
  rating?: number;
  reviewCount?: number;
  vendorId?: {
    _id: string;
    name: string;
    businessName?: string;
    image?: string;
    subscriptionPlan?: 'free' | 'premium';
  };
}

export const FALLBACK_SAMPLE_PIZZAS: SamplePizza[] = [
  {
    _id: '673cc0000000000000000001',
    itemName: 'Classic Neapolitan Margherita',
    category: 'Classic Pizzas',
    description: 'San Marzano tomato sauce, fresh mozzarella di bufala, fragrant sweet basil, extra virgin olive oil on a charred stone-baked crust.',
    price: 16.99,
    location: 'Downtown Brooklyn, NY',
    images: [
      'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=800',
      'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800',
    ],
    status: 'approved',
    rating: 4.9,
    reviewCount: 28,
    vendorId: {
      _id: 'vendor_001',
      name: 'Luigi Rossi',
      businessName: "Luigi's Authentic Wood-Fired Pizzeria",
      image: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400',
      subscriptionPlan: 'premium',
    },
  },
  {
    _id: '673cc0000000000000000002',
    itemName: 'Double Pepperoni Overload',
    category: 'Meat Lovers',
    description: 'Generous layers of spicy crispy cupping pepperoni, aged mozzarella, provolone blend, and house herb tomato passata.',
    price: 19.99,
    location: 'Downtown Brooklyn, NY',
    images: [
      'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=800',
      'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=800',
    ],
    status: 'approved',
    rating: 4.8,
    reviewCount: 35,
    vendorId: {
      _id: 'vendor_001',
      name: 'Luigi Rossi',
      businessName: "Luigi's Authentic Wood-Fired Pizzeria",
      image: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400',
      subscriptionPlan: 'premium',
    },
  },
  {
    _id: '673cc0000000000000000003',
    itemName: 'Black Truffle Wild Mushroom & Goat Cheese',
    category: 'Specialty / Gourmet Pizzas',
    description: 'Truffle-infused garlic cream sauce, roasted cremini, shiitake and oyster mushrooms, creamy chèvre goat cheese, and fresh thyme.',
    price: 24.5,
    location: 'Downtown Brooklyn, NY',
    images: [
      'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800',
      'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=800',
    ],
    status: 'approved',
    rating: 5.0,
    reviewCount: 19,
    vendorId: {
      _id: 'vendor_001',
      name: 'Luigi Rossi',
      businessName: "Luigi's Authentic Wood-Fired Pizzeria",
      image: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400',
      subscriptionPlan: 'premium',
    },
  },
  {
    _id: '673cc0000000000000000004',
    itemName: 'Four Cheese Quattro Formaggi Gold',
    category: 'Classic Pizzas',
    description: 'Rich blend of creamy Taleggio, Gorgonzola Dolce, smoked provola, Parmigiano Reggiano, and hot honey drizzle.',
    price: 18.5,
    location: 'Manhattan Little Italy, NY',
    images: [
      'https://images.unsplash.com/photo-1573821663912-569905455b1c?w=800',
    ],
    status: 'approved',
    rating: 4.7,
    reviewCount: 14,
    vendorId: {
      _id: 'vendor_002',
      name: 'Marco Bellini',
      businessName: 'Bella Napoli Artisan Pies',
      image: 'https://images.unsplash.com/photo-1583394293214-28ded15ee548?w=400',
      subscriptionPlan: 'free',
    },
  },
  {
    _id: '673cc0000000000000000005',
    itemName: 'Garden Harvest Primavera Special',
    category: 'Vegetarian Pizzas',
    description: 'Charred bell peppers, artichoke hearts, kalamata olives, red onions, heirloom cherry tomatoes, and vegan basil pesto.',
    price: 17.5,
    location: 'Manhattan Little Italy, NY',
    images: [
      'https://images.unsplash.com/photo-1590947132387-155cc02f3212?w=800',
    ],
    status: 'approved',
    rating: 4.6,
    reviewCount: 12,
    vendorId: {
      _id: 'vendor_002',
      name: 'Marco Bellini',
      businessName: 'Bella Napoli Artisan Pies',
      image: 'https://images.unsplash.com/photo-1583394293214-28ded15ee548?w=400',
      subscriptionPlan: 'free',
    },
  },
  {
    _id: '673cc0000000000000000006',
    itemName: 'Smoky BBQ Chicken & Crispy Bacon',
    category: 'Meat Lovers',
    description: 'Hickory smoked pulled chicken, applewood smoked bacon, caramelized red onions, sharp cheddar blend, and smoky chipotle BBQ sauce.',
    price: 21.0,
    location: 'Queens Astoria, NY',
    images: [
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
    ],
    status: 'approved',
    rating: 4.9,
    reviewCount: 22,
    vendorId: {
      _id: 'vendor_003',
      name: 'Elena Rostova',
      businessName: 'Fire & Dough Pizza Kitchen',
      image: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400',
      subscriptionPlan: 'premium',
    },
  },
  {
    _id: '673cc0000000000000000007',
    itemName: 'Prosciutto di Parma & Baby Arugula',
    category: 'Specialty / Gourmet Pizzas',
    description: '24-month aged Prosciutto di Parma, shaved Parmigiano-Reggiano, fresh peppery baby arugula, and Modena balsamic reduction.',
    price: 23.99,
    location: 'Queens Astoria, NY',
    images: [
      'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=800',
    ],
    status: 'approved',
    rating: 4.9,
    reviewCount: 18,
    vendorId: {
      _id: 'vendor_003',
      name: 'Elena Rostova',
      businessName: 'Fire & Dough Pizza Kitchen',
      image: 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400',
      subscriptionPlan: 'premium',
    },
  },
  {
    _id: '673cc0000000000000000008',
    itemName: 'Garlic Butter Stuffed Dough Knots (6 pcs)',
    category: 'Sides & Appetizers',
    description: 'Fresh baked golden dough knots tossed in roasted garlic herb butter, grated Pecorino, served with warm marinara dipping sauce.',
    price: 8.99,
    location: 'Downtown Brooklyn, NY',
    images: [
      'https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?w=800',
    ],
    status: 'approved',
    rating: 4.8,
    reviewCount: 31,
    vendorId: {
      _id: 'vendor_001',
      name: 'Luigi Rossi',
      businessName: "Luigi's Authentic Wood-Fired Pizzeria",
      image: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400',
      subscriptionPlan: 'premium',
    },
  },
];

export function findSamplePizzaById(id: string): SamplePizza | null {
  if (!id) return null;
  const found = FALLBACK_SAMPLE_PIZZAS.find((p) => p._id === id);
  return found || null;
}
