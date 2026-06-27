import multer from "multer";
import { BadRequestException } from "./app-error.util";

const storage = multer.memoryStorage();

const imageFileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
        cb(new BadRequestException("Only image files are allowed"));
        return;
    }
    cb(null, true);
};

export const uploadImage = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: imageFileFilter,
});
