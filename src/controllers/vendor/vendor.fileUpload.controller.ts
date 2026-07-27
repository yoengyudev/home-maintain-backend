import { Request, Response } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { BadRequestException } from '../../utils/app-error.util';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo',
  api_key: process.env.CLOUDINARY_API_KEY || '123456789012345',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'abcdefghijklmnopqrstuvwxyz',
});

// Configure Multer for memory storage
const storage = multer.memoryStorage();

// File filter to accept only images
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestException('Only image files (JPEG, PNG, WebP) are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

export class VendorFileUploadController {
  static uploadSingle = upload.single('file');

  static async uploadImage(req: Request, res: Response) {
    try {
      if (!req.file) {
        throw new BadRequestException('No file uploaded');
      }

      // Upload to Cloudinary
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            resource_type: 'image',
            folder: 'provider-profiles',
            transformation: [
              { width: 500, height: 500, crop: 'limit' },
              { quality: 'auto' },
            ],
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(req.file!.buffer);
      });

      res.status(200).json({
        success: true,
        message: 'Image uploaded successfully',
        data: {
          url: (result as any).secure_url,
          publicId: (result as any).public_id,
        },
      });
    } catch (error) {
      console.error('File upload error:', error);
      throw new BadRequestException('Failed to upload image');
    }
  }

  static async deleteImage(req: Request, res: Response) {
    try {
      const { publicId } = req.body;

      if (!publicId) {
        throw new BadRequestException('Public ID is required');
      }

      await cloudinary.uploader.destroy(publicId);

      res.status(200).json({
        success: true,
        message: 'Image deleted successfully',
      });
    } catch (error) {
      console.error('Image deletion error:', error);
      throw new BadRequestException('Failed to delete image');
    }
  }
}
