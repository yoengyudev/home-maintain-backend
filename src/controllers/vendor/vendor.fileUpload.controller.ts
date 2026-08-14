import { Request, Response } from 'express';
import multer from 'multer';
import cloudinary, { isCloudinaryConfigured } from '../../utils/cloudinary.util';
import { BadRequestException } from '../../utils/app-error.util';
import { getLang } from '../../utils/get-lang.util';
import { t } from '../../i18n/translate';

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
      const resourceType = pdf ? 'raw' : 'image';

      let secureUrl = '';
      let publicId = `file_${Date.now()}`;

      if (isCloudinaryConfigured()) {
        try {
          const result = await new Promise((resolve, reject) => {
            cloudinary.uploader
              .upload_stream(
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
              )
              .end(req.file!.buffer);
          });

          const uploaded = result as {
            secure_url: string;
            public_id: string;
          };

          if (uploaded?.secure_url) {
            secureUrl = uploaded.secure_url;
            publicId = uploaded.public_id;
          }
        } catch (cloudErr) {
          console.warn('[cloudinary upload warning] fallback to data URL:', cloudErr);
        }
      }

      // Fallback if Cloudinary is not configured or throws
      if (!secureUrl) {
        secureUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }

      return res.status(200).json({
        success: true,
        message: pdf ? t('VENDOR_DOCUMENT_UPLOADED', lang) : t('VENDOR_IMAGE_UPLOADED', lang),
        data: {
          url: secureUrl,
          publicId,
          resourceType,
          format: pdf ? 'pdf' : undefined,
          mimeType: req.file.mimetype,
          originalName: req.file.originalname,
          bytes: req.file.size,
        },
      });
    } catch (error: any) {
      console.error('File upload error:', error);
      return res.status(error?.statusCode || 400).json({
        success: false,
        message: error?.message || t('VENDOR_FILE_UPLOAD_FAILED', lang),
      });
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

      if (isCloudinaryConfigured() && !publicId.startsWith('file_')) {
        try {
          await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType === 'raw' ? 'raw' : 'image',
          });
        } catch (delErr) {
          console.warn('[cloudinary delete warning]:', delErr);
        }
      }

      return res.status(200).json({
        success: true,
        message: t('VENDOR_FILE_DELETED', lang),
      });
    } catch (error: any) {
      console.error('File deletion error:', error);
      return res.status(error?.statusCode || 400).json({
        success: false,
        message: error?.message || t('VENDOR_FILE_DELETE_FAILED', lang),
      });
    }
  }
}
