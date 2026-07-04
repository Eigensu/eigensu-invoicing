import { v2 as cloudinary } from 'cloudinary'

// Server-only: reads API secrets from env. Import from server actions /
// route handlers only.
cloudinary.config({
  cloud_name: process.env['CLOUDINARY_CLOUD_NAME'] ?? '',
  api_key: process.env['CLOUDINARY_API_KEY'] ?? '',
  api_secret: process.env['CLOUDINARY_API_SECRET'] ?? '',
})

export { cloudinary }
