import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Product from '../models/Product';
import ActivityLog from '../models/ActivityLog';
import { AppError } from '../middleware/errorHandler';

// ─── Helper: Generate SKU ─────────────────────────────────────────────────────
const generateSKU = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let sku = 'VH-';
  for (let i = 0; i < 6; i++) {
    sku += chars[Math.floor(Math.random() * chars.length)];
  }
  return sku;
};

// ─── Helper: Log Product Changes ──────────────────────────────────────────────
const logProductChange = async (
  sellerId: mongoose.Types.ObjectId | string,
  userId: mongoose.Types.ObjectId | string,
  userName: string,
  action: 'product_created' | 'product_updated' | 'product_deleted',
  product: any,
  oldProduct?: any
) => {
  try {
    const details: any = {
      productId: product._id,
      productName: product.name,
      sku: product.sku,
    };

    if (action === 'product_updated' && oldProduct) {
      const changes: Array<{ field: string; oldVal: any; newVal: any }> = [];
      const fieldsToTrack = [
        'name',
        'sku',
        'sellingPrice',
        'purchasePrice',
        'stock',
        'status',
        'category',
        'brand',
      ];

      for (const field of fieldsToTrack) {
        // Stringify object/array fields or strictly compare primitive ones
        const oldVal = oldProduct[field];
        const newVal = product[field];
        if (oldVal !== newVal) {
          changes.push({ field, oldVal, newVal });
        }
      }

      // If no trackable fields changed, don't record an empty update log
      if (changes.length === 0) return;
      details.changes = changes;
    }

    await ActivityLog.create({
      sellerId,
      user: userId,
      userName,
      action,
      details,
    });
  } catch (err) {
    console.error('⚠️  Failed to log activity event:', err);
  }
};

// ─── GET ALL PRODUCTS ─────────────────────────────────────────────────────────
export const getProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sellerId = req.user!.sellerId || req.user!._id;
    const {
      page = '1',
      limit = '20',
      search,
      category,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query as {
      page?: string;
      limit?: string;
      search?: string;
      category?: string;
      status?: string;
      sortBy?: string;
      sortOrder?: string;
    };

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter: mongoose.FilterQuery<typeof Product> = {
      sellerId,
      status: { $ne: 'archived' }, // Exclude archived by default unless explicitly requested
    };

    if (status) {
      filter.status = status;
    }

    if (category) {
      filter.category = category;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    // Sort
    const sort: Record<string, 1 | -1> = {
      [sortBy]: sortOrder === 'asc' ? 1 : -1,
    };

    // Execute in parallel
    const [products, total] = await Promise.all([
      Product.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
      Product.countDocuments(filter),
    ]);

    // Stats for the seller
    const [stats] = await Product.aggregate([
      { $match: { sellerId: new mongoose.Types.ObjectId(sellerId.toString()), status: { $ne: 'archived' } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          drafts: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
          outOfStock: {
            $sum: {
              $cond: [{ $and: [{ $eq: ['$trackInventory', true] }, { $eq: ['$stock', 0] }] }, 1, 0],
            },
          },
          lowStock: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$trackInventory', true] },
                    { $gt: ['$stock', 0] },
                    { $lte: ['$stock', '$lowStockThreshold'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
          hasNext: pageNum < Math.ceil(total / limitNum),
          hasPrev: pageNum > 1,
        },
        stats: stats || { total: 0, drafts: 0, outOfStock: 0, lowStock: 0 },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET SINGLE PRODUCT ───────────────────────────────────────────────────────
export const getProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const sellerId = req.user!.sellerId || req.user!._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid product ID', 400);
    }

    const product = await Product.findOne({ _id: id, sellerId });

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

// ─── CREATE PRODUCT ───────────────────────────────────────────────────────────
export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const sellerId = req.user!.sellerId || req.user!._id;
    const body = req.body as Record<string, unknown>;

    // Check permissions
    if (req.user!.role === 'viewer') {
      throw new AppError('Viewers do not have permission to create products', 403);
    }

    // Auto-generate SKU if not provided
    if (!body.sku) {
      let sku: string;
      let attempts = 0;
      do {
        sku = generateSKU();
        attempts++;
      } while (
        (await Product.findOne({ sellerId, sku })) !== null &&
        attempts < 10
      );
      body.sku = sku;
    }

    // Validate selling price ≥ purchase price
    const purchasePrice = Number(body.purchasePrice);
    const sellingPrice = Number(body.sellingPrice);

    if (sellingPrice < purchasePrice) {
      throw new AppError(
        'Selling price cannot be less than purchase price',
        400
      );
    }

    const product = await Product.create({
      ...body,
      sellerId,
      currency: 'INR',
    });

    // Log Activity
    await logProductChange(sellerId, req.user!._id, req.user!.name, 'product_created', product);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// ─── UPDATE PRODUCT ───────────────────────────────────────────────────────────
export const updateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const sellerId = req.user!.sellerId || req.user!._id;

    // Check permissions
    if (req.user!.role === 'viewer') {
      throw new AppError('Viewers do not have permission to update products', 403);
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid product ID', 400);
    }

    const body = req.body as Record<string, unknown>;

    // Prevent changing sellerId
    delete body.sellerId;

    // Get old product details for change tracking
    const oldProduct = await Product.findOne({ _id: id, sellerId }).lean();
    if (!oldProduct) {
      throw new AppError('Product not found', 404);
    }

    const product = await Product.findOneAndUpdate(
      { _id: id, sellerId },
      { ...body },
      { new: true, runValidators: true }
    );

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Log Activity with change diff
    await logProductChange(sellerId, req.user!._id, req.user!.name, 'product_updated', product, oldProduct);

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

// ─── DELETE (SOFT) PRODUCT ────────────────────────────────────────────────────
export const deleteProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const sellerId = req.user!.sellerId || req.user!._id;

    // Check permissions
    if (req.user!.role === 'viewer') {
      throw new AppError('Viewers do not have permission to delete products', 403);
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid product ID', 400);
    }

    const product = await Product.findOneAndUpdate(
      { _id: id, sellerId },
      { status: 'archived' },
      { new: true }
    );

    if (!product) {
      throw new AppError('Product not found', 404);
    }

    // Log Activity
    await logProductChange(sellerId, req.user!._id, req.user!.name, 'product_deleted', product);

    res.status(200).json({
      success: true,
      message: 'Product archived successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ─── PATCH STOCK ──────────────────────────────────────────────────────────────
export const patchStock = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const sellerId = req.user!.sellerId || req.user!._id;

    // Check permissions
    if (req.user!.role === 'viewer') {
      throw new AppError('Viewers do not have permission to alter stock levels', 403);
    }

    const { stock, variantId } = req.body as {
      stock: number;
      variantId?: string;
    };

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid product ID', 400);
    }

    if (stock === undefined || stock < 0) {
      throw new AppError('Valid stock quantity is required', 400);
    }

    // Fetch old product for auditing
    const oldProduct = await Product.findOne({ _id: id, sellerId });
    if (!oldProduct) throw new AppError('Product not found', 404);

    let product: any;

    if (variantId) {
      const update = { 'variants.$[v].stock': stock };
      product = await Product.findOneAndUpdate(
        { _id: id, sellerId },
        { $set: update },
        {
          new: true,
          arrayFilters: [{ 'v._id': new mongoose.Types.ObjectId(variantId) }],
        }
      );

      if (!product) throw new AppError('Product not found', 404);

      // Audit change
      const oldVariant = oldProduct.variants.find(v => v._id?.toString() === variantId);
      const newVariant = product.variants.find((v: any) => v._id?.toString() === variantId);
      
      const variantName = `Stock (${(oldVariant?.size || '')} ${(oldVariant?.color || '')} Variant)`.trim();
      const changes = [{ field: variantName, oldVal: oldVariant?.stock ?? 0, newVal: newVariant?.stock ?? 0 }];
      
      await ActivityLog.create({
        sellerId,
        user: req.user!._id,
        userName: req.user!.name,
        action: 'product_updated',
        details: {
          productId: product._id,
          productName: product.name,
          sku: product.sku,
          changes
        }
      });

      res.status(200).json({
        success: true,
        message: 'Variant stock updated',
        data: product,
      });
    } else {
      product = await Product.findOneAndUpdate(
        { _id: id, sellerId },
        { stock },
        { new: true, runValidators: true }
      );

      if (!product) throw new AppError('Product not found', 404);

      // Audit change
      const changes = [{ field: 'stock', oldVal: oldProduct.stock, newVal: product.stock }];
      await ActivityLog.create({
        sellerId,
        user: req.user!._id,
        userName: req.user!.name,
        action: 'product_updated',
        details: {
          productId: product._id,
          productName: product.name,
          sku: product.sku,
          changes
        }
      });

      res.status(200).json({
        success: true,
        message: 'Stock updated successfully',
        data: product,
      });
    }
  } catch (error) {
    next(error);
  }
};
