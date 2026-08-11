import { Request, Response } from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { BadRequestException } from '../../utils/app-error.util';
import { getLang } from '../../utils/get-lang.util';
import { t } from '../../i18n/translate';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo',
  api_key: process.env.CLOUDINARY_API_KEY || '123456789012345',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'abcdefghijklmnopqrstuvwxyz',
});

const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
];

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestException(t('VENDOR_INVALID_FILE_TYPE', getLang(req))));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

function isPdf(file: Express.Multer.File) {
  return file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
}

export class VendorFileUploadController {
  static uploadSingle = upload.single('file');

  static async uploadImage(req: Request, res: Response) {
    const lang = getLang(req);
    try {
      if (!req.file) {
        throw new BadRequestException(t('VENDOR_NO_FILE_UPLOADED', lang));
      }

      const pdf = isPdf(req.file);
      // PDFs must use raw; images use image + light transforms
      const resourceType = pdf ? 'raw' : 'image';

      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            resource_type: resourceType,
            folder: pdf ? 'provider-documents' : 'provider-profiles',
            ...(pdf
              ? {}
              : {
                  transformation: [
                    { width: 1600, height: 1600, crop: 'limit' },
                    { quality: 'auto' },
                  ],
                }),
          },
          (error, uploadResult) => {
            if (error) reject(error);
            else resolve(uploadResult);
          }
        ).end(req.file!.buffer);
      });

      const uploaded = result as {
        secure_url: string;
        public_id: string;
        resource_type?: string;
        format?: string;
        bytes?: number;
      };

      res.status(200).json({
        success: true,
        message: pdf ? t('VENDOR_DOCUMENT_UPLOADED', lang) : t('VENDOR_IMAGE_UPLOADED', lang),
        data: {
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
          resourceType: uploaded.resource_type || resourceType,
          format: uploaded.format || (pdf ? 'pdf' : undefined),
          mimeType: req.file.mimetype,
          originalName: req.file.originalname,
          bytes: uploaded.bytes,
        },
      });
    } catch (error) {
      console.error('File upload error:', error);
      throw new BadRequestException(t('VENDOR_FILE_UPLOAD_FAILED', lang));
    }
  }

  static async deleteImage(req: Request, res: Response) {
    const lang = getLang(req);
    try {
      const { publicId, resourceType } = req.body as {
        publicId?: string;
        resourceType?: string;
      };

      if (!publicId) {
        throw new BadRequestException(t('VENDOR_PUBLIC_ID_REQUIRED', lang));
      }

      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType === 'raw' ? 'raw' : 'image',
      });

      res.status(200).json({
        success: true,
        message: t('VENDOR_FILE_DELETED', lang),
      });
    } catch (error) {
      console.error('File deletion error:', error);
      throw new BadRequestException(t('VENDOR_FILE_DELETE_FAILED', lang));
    }
  }
}
