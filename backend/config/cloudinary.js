const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadImageToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      options, // 👈 pass options here
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

module.exports = {
  cloudinary,
  uploadImageToCloudinary,
};