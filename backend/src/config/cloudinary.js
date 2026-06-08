import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Uploads a file buffer directly to Cloudinary
 * @param {Buffer} fileBuffer 
 * @param {string} folder 
 * @returns {Promise<string>} Secure URL of uploaded image/file
 */
export const uploadToCloudinary = (fileBuffer, folder = 'sri_murugan_finance') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload failure:', error);
          reject(error);
        } else {
          resolve(result.secure_url);
        }
      }
    );
    uploadStream.end(fileBuffer);
  });
};

export default cloudinary;
