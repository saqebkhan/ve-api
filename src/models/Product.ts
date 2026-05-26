import mongoose, { Document, Schema, Model } from 'mongoose';

// ─── Interfaces ───────────────────────────────────────────────────────────────
export interface IProductVariant {
  _id?: mongoose.Types.ObjectId | string;
  size?: string;
  color?: string;
  stock: number;
  sku?: string;
  purchasePrice?: number;
  sellingPrice?: number;
}

export interface IProductDimensions {
  l: number;
  w: number;
  h: number;
}

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  sellerId: mongoose.Types.ObjectId;
  name: string;
  sku: string;
  description?: string;
  category: string;
  brand?: string;
  images: string[];

  // Pricing
  purchasePrice: number;
  sellingPrice: number;
  discountedPrice?: number;
  currency: string;

  // Stock
  stock: number;
  lowStockThreshold: number;
  trackInventory: boolean;

  // Variants
  hasVariants: boolean;
  variants: IProductVariant[];

  // Metadata
  status: 'active' | 'draft' | 'archived';
  tags: string[];
  weight?: number;
  dimensions?: IProductDimensions;

  createdAt: Date;
  updatedAt: Date;
}

// ─── Sub-schemas ──────────────────────────────────────────────────────────────
const variantSchema = new Schema<IProductVariant>(
  {
    size: { type: String, trim: true },
    color: { type: String, trim: true },
    stock: { type: Number, required: true, min: 0, default: 0 },
    sku: { type: String, trim: true },
    purchasePrice: { type: Number, min: 0 },
    sellingPrice: { type: Number, min: 0 },
  },
  { _id: true }
);

const dimensionsSchema = new Schema<IProductDimensions>(
  {
    l: { type: Number, min: 0 },
    w: { type: Number, min: 0 },
    h: { type: Number, min: 0 },
  },
  { _id: false }
);

// ─── Product Schema ────────────────────────────────────────────────────────────
const productSchema = new Schema<IProduct>(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      minlength: [3, 'Product name must be at least 3 characters'],
      maxlength: [200, 'Product name must not exceed 200 characters'],
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Z0-9\-]+$/, 'SKU must be alphanumeric with hyphens only'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description must not exceed 2000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: [
        'Electronics',
        'Clothing',
        'Food & Beverage',
        'Home & Garden',
        'Beauty',
        'Sports',
        'Books',
        'Other',
      ],
    },
    brand: {
      type: String,
      trim: true,
    },
    images: {
      type: [String],
      default: [],
    },

    // Pricing
    purchasePrice: {
      type: Number,
      required: [true, 'Purchase price is required'],
      min: [0, 'Purchase price cannot be negative'],
    },
    sellingPrice: {
      type: Number,
      required: [true, 'Selling price is required'],
      min: [0, 'Selling price cannot be negative'],
    },
    discountedPrice: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },

    // Stock
    stock: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: 0,
    },
    trackInventory: {
      type: Boolean,
      default: true,
    },

    // Variants
    hasVariants: {
      type: Boolean,
      default: false,
    },
    variants: {
      type: [variantSchema],
      default: [],
    },

    // Metadata
    status: {
      type: String,
      enum: ['active', 'draft', 'archived'],
      default: 'draft',
    },
    tags: {
      type: [String],
      default: [],
    },
    weight: {
      type: Number,
      min: 0,
    },
    dimensions: {
      type: dimensionsSchema,
    },
  },
  {
    timestamps: true,
  }
);

// ─── Compound Index — SKU unique per seller ───────────────────────────────────
productSchema.index({ sellerId: 1, sku: 1 }, { unique: true });
productSchema.index({ sellerId: 1, status: 1 });
productSchema.index({ sellerId: 1, category: 1 });
productSchema.index({ name: 'text', sku: 'text', description: 'text' });

// ─── Model ────────────────────────────────────────────────────────────────────
const Product: Model<IProduct> = mongoose.model<IProduct>('Product', productSchema);
export default Product;
