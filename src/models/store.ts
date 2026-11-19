import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.join(__dirname, '../../data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

export interface StoredUser {
  _id: string;
  name: string;
  email: string;
  password?: string;
  image?: string;
  role: 'customer' | 'vendor' | 'admin';
  isBlocked: boolean;
  businessName?: string;
  subscriptionPlan: 'free' | 'premium';
  subscriptionExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMenuItem {
  _id: string;
  vendorId: string | any;
  itemName: string;
  category: string;
  description: string;
  price: number;
  location: string;
  images: string[];
  status: 'pending' | 'approved' | 'rejected' | 'inactive';
  rating?: number;
  reviewCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoredOrder {
  _id: string;
  itemId: string | any;
  vendorId: string | any;
  customerId: string | any;
  deliveryDate: string;
  deliveryAddress: string;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  statusTimeline: Array<{ status: string; timestamp: string; note: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface StoredTransaction {
  _id: string;
  vendorId: string | any;
  plan: string;
  amount: number;
  currency: string;
  stripeSessionId?: string;
  stripeSubscriptionId?: string;
  status: string;
  createdAt: string;
}

export interface StoredReview {
  _id: string;
  itemId: string;
  userId: string | any;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface StoredFavorite {
  _id: string;
  userId: string;
  itemId: string | any;
  createdAt: string;
}

interface DataStore {
  users: StoredUser[];
  menuItems: StoredMenuItem[];
  orders: StoredOrder[];
  transactions: StoredTransaction[];
  reviews: StoredReview[];
  favorites: StoredFavorite[];
}

// Generate unique Mongo-like ObjectId
export const generateId = () => {
  const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const random = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return timestamp + random;
};

class MemoryStore {
  private data: DataStore;

  constructor() {
    this.data = this.loadFromDisk();
  }

  private loadFromDisk(): DataStore {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Error reading store.json, re-initializing with seeds:', e);
    }

    return this.initializeDefaultData();
  }

  public saveToDisk(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving store to disk:', e);
    }
  }

  private initializeDefaultData(): DataStore {
    const salt = bcrypt.genSaltSync(10);
    const adminPass = bcrypt.hashSync('Admin@123456', salt);
    const vendorPass = bcrypt.hashSync('Vendor@123456', salt);
    const customerPass = bcrypt.hashSync('Customer@123456', salt);

    const now = new Date().toISOString();

    const admin: StoredUser = {
      _id: '673cc0000000000000000001',
      name: 'PizzaHub Admin',
      email: 'admin@pizzahub.com',
      password: adminPass,
      role: 'admin',
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      isBlocked: false,
      subscriptionPlan: 'free',
      createdAt: now,
      updatedAt: now,
    };

    const vendor1: StoredUser = {
      _id: '673cc0000000000000000002',
      name: 'Luigi Rossi',
      email: 'luigi@pizzahub.com',
      password: vendorPass,
      role: 'vendor',
      businessName: "Luigi's Authentic Wood-Fired Pizzeria",
      image: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400',
      isBlocked: false,
      subscriptionPlan: 'premium',
      subscriptionExpiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      createdAt: now,
      updatedAt: now,
    };

    const vendor2: StoredUser = {
      _id: '673cc0000000000000000003',
      name: 'Marco Bellini',
      email: 'marco@pizzahub.com',
      password: vendorPass,
      role: 'vendor',
      businessName: 'Bella Napoli Artisan Pies',
      image: 'https://images.unsplash.com/photo-1583394293214-28ded15ee548?w=400',
      isBlocked: false,
      subscriptionPlan: 'free',
      createdAt: now,
      updatedAt: now,
    };

    const customer1: StoredUser = {
      _id: '673cc0000000000000000004',
      name: 'Alex Rivera',
      email: 'alex@gmail.com',
      password: customerPass,
      role: 'customer',
      image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400',
      isBlocked: false,
      subscriptionPlan: 'free',
      createdAt: now,
      updatedAt: now,
    };

    const menuItems: StoredMenuItem[] = [
      {
        _id: '673cc0000000000000000010',
        vendorId: vendor1._id,
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
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: '673cc0000000000000000011',
        vendorId: vendor1._id,
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
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: '673cc0000000000000000012',
        vendorId: vendor1._id,
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
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: '673cc0000000000000000013',
        vendorId: vendor2._id,
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
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: '673cc0000000000000000014',
        vendorId: vendor2._id,
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
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: '673cc0000000000000000015',
        vendorId: vendor1._id,
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
        createdAt: now,
        updatedAt: now,
      },
    ];

    const orders: StoredOrder[] = [
      {
        _id: '673cc0000000000000000020',
        itemId: menuItems[0]._id,
        vendorId: vendor1._id,
        customerId: customer1._id,
        deliveryDate: '2026-11-20',
        deliveryAddress: '742 Evergreen Terrace, Brooklyn, NY 11201',
        message: 'Leave by door, ring bell twice please.',
        status: 'accepted',
        statusTimeline: [
          { status: 'pending', timestamp: now, note: 'Order placed by customer.' },
          { status: 'accepted', timestamp: now, note: 'Confirmed by Luigi’s Pizzeria.' },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ];

    const transactions: StoredTransaction[] = [
      {
        _id: '673cc0000000000000000030',
        vendorId: vendor1._id,
        plan: 'premium',
        amount: 19.99,
        currency: 'usd',
        stripeSessionId: 'cs_test_seed_001',
        status: 'succeeded',
        createdAt: now,
      },
    ];

    const initial: DataStore = {
      users: [admin, vendor1, vendor2, customer1],
      menuItems,
      orders,
      transactions,
      reviews: [],
      favorites: [],
    };

    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    } catch (e) {}

    return initial;
  }

  // Users API
  public getUsers() {
    return this.data.users;
  }

  public findUserById(id: string) {
    return this.data.users.find((u) => u._id === id);
  }

  public findUserByEmail(email: string) {
    return this.data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  }

  public createUser(user: Omit<StoredUser, '_id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString();
    const newUser: StoredUser = {
      ...user,
      _id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    this.data.users.push(newUser);
    this.saveToDisk();
    return newUser;
  }

  public updateUser(id: string, updates: Partial<StoredUser>) {
    const user = this.findUserById(id);
    if (!user) return null;
    Object.assign(user, updates, { updatedAt: new Date().toISOString() });
    this.saveToDisk();
    return user;
  }

  // Menu Items API
  public getMenuItems() {
    return this.data.menuItems;
  }

  public findMenuItemById(id: string) {
    return this.data.menuItems.find((i) => i._id === id);
  }

  public createMenuItem(item: Omit<StoredMenuItem, '_id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString();
    const newItem: StoredMenuItem = {
      ...item,
      _id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    this.data.menuItems.push(newItem);
    this.saveToDisk();
    return newItem;
  }

  public updateMenuItem(id: string, updates: Partial<StoredMenuItem>) {
    const item = this.findMenuItemById(id);
    if (!item) return null;
    Object.assign(item, updates, { updatedAt: new Date().toISOString() });
    this.saveToDisk();
    return item;
  }

  public deleteMenuItem(id: string) {
    const idx = this.data.menuItems.findIndex((i) => i._id === id);
    if (idx === -1) return false;
    this.data.menuItems.splice(idx, 1);
    this.saveToDisk();
    return true;
  }

  // Orders API
  public getOrders() {
    return this.data.orders;
  }

  public findOrderById(id: string) {
    return this.data.orders.find((o) => o._id === id);
  }

  public createOrder(order: Omit<StoredOrder, '_id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString();
    const newOrder: StoredOrder = {
      ...order,
      _id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    this.data.orders.push(newOrder);
    this.saveToDisk();
    return newOrder;
  }

  public updateOrder(id: string, updates: Partial<StoredOrder>) {
    const order = this.findOrderById(id);
    if (!order) return null;
    Object.assign(order, updates, { updatedAt: new Date().toISOString() });
    this.saveToDisk();
    return order;
  }

  // Transactions API
  public getTransactions() {
    return this.data.transactions;
  }

  public createTransaction(tx: Omit<StoredTransaction, '_id' | 'createdAt'>) {
    const newTx: StoredTransaction = {
      ...tx,
      _id: generateId(),
      createdAt: new Date().toISOString(),
    };
    this.data.transactions.push(newTx);
    this.saveToDisk();
    return newTx;
  }

  // Reviews API
  public getReviews(itemId?: string) {
    if (!this.data.reviews) this.data.reviews = [];
    if (itemId) {
      return this.data.reviews.filter((r) => r.itemId === itemId);
    }
    return this.data.reviews;
  }

  public createReview(review: Omit<StoredReview, '_id' | 'createdAt'>) {
    if (!this.data.reviews) this.data.reviews = [];
    const newReview: StoredReview = {
      ...review,
      _id: generateId(),
      createdAt: new Date().toISOString(),
    };
    this.data.reviews.push(newReview);
    this.saveToDisk();
    return newReview;
  }

  // Favorites API
  public getFavorites(userId: string) {
    if (!this.data.favorites) this.data.favorites = [];
    return this.data.favorites.filter((f) => f.userId === userId);
  }

  public toggleFavorite(userId: string, itemId: string) {
    if (!this.data.favorites) this.data.favorites = [];
    const index = this.data.favorites.findIndex((f) => f.userId === userId && f.itemId === itemId);
    if (index !== -1) {
      this.data.favorites.splice(index, 1);
      this.saveToDisk();
      return { isFavorited: false };
    } else {
      const fav: StoredFavorite = {
        _id: generateId(),
        userId,
        itemId,
        createdAt: new Date().toISOString(),
      };
      this.data.favorites.push(fav);
      this.saveToDisk();
      return { isFavorited: true };
    }
  }
}

export const dbStore = new MemoryStore();
