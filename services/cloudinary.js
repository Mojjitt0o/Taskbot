// services/cloudinary.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');

// Konfigurasi Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Tentukan folder berdasarkan tipe file
const getFolder = (mimetype) => {
    if (mimetype.startsWith('image/')) {
        return `${process.env.CLOUDINARY_FOLDER || 'taskbot'}/images`;
    } else if (mimetype.startsWith('video/')) {
        return `${process.env.CLOUDINARY_FOLDER || 'taskbot'}/videos`;
    } else {
        return `${process.env.CLOUDINARY_FOLDER || 'taskbot'}/documents`;
    }
};

// Storage untuk profile pictures
const profilePictureStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: `${process.env.CLOUDINARY_FOLDER || 'taskbot'}/profiles`,
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [{ width: 400, height: 400, crop: 'limit' }],
        public_id: (req, file) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            return `profile-${req.user.id}-${uniqueSuffix}`;
        }
    }
});

// Storage untuk task files
const taskFileStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        const folder = getFolder(file.mimetype);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const originalName = path.basename(file.originalname, path.extname(file.originalname))
            .replace(/[^a-zA-Z0-9]/g, '_');
        
        let resourceType = 'auto';
        if (file.mimetype.startsWith('image/')) {
            resourceType = 'image';
        } else if (file.mimetype.startsWith('video/')) {
            resourceType = 'video';
        } else {
            resourceType = 'raw';
        }
        
        return {
            folder: folder,
            public_id: `task-${uniqueSuffix}-${originalName}`,
            resource_type: resourceType
        };
    }
});

// Storage untuk chat files
const chatFileStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
        const folder = getFolder(file.mimetype);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        
        let resourceType = 'auto';
        if (file.mimetype.startsWith('image/')) {
            resourceType = 'image';
        } else if (file.mimetype.startsWith('video/')) {
            resourceType = 'video';
        } else {
            resourceType = 'raw';
        }
        
        return {
            folder: folder,
            public_id: `chat-${req.params.roomId}-${uniqueSuffix}`,
            resource_type: resourceType
        };
    }
});

// Storage untuk test case screenshots
const screenshotStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: `${process.env.CLOUDINARY_FOLDER || 'taskbot'}/screenshots`,
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        public_id: (req, file) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            return `screenshot-${req.params.taskId}-${uniqueSuffix}`;
        }
    }
});

// Filter file yang diizinkan
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'application/zip',
        'application/x-rar-compressed',
        'video/mp4', 'video/mpeg',
        'audio/mpeg', 'audio/wav'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipe file tidak diizinkan'), false);
    }
};

// Buat multer instances
const uploadProfilePicture = multer({
    storage: profilePictureStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: fileFilter
});

const uploadTaskFile = multer({
    storage: taskFileStorage,
    limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE) || 50) * 1024 * 1024 },
    fileFilter: fileFilter
});

const uploadChatFile = multer({
    storage: chatFileStorage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    fileFilter: fileFilter
});

const uploadScreenshot = multer({
    storage: screenshotStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: fileFilter
});

// Fungsi untuk menghapus file dari Cloudinary
const deleteFromCloudinary = async (publicId) => {
    try {
        if (!publicId) return null;
        
        // Tentukan resource type berdasarkan public_id
        let resourceType = 'image';
        if (publicId.includes('/videos/')) {
            resourceType = 'video';
        } else if (publicId.includes('/documents/') || publicId.includes('/raw/')) {
            resourceType = 'raw';
        }
        
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType
        });
        
        console.log('✅ File deleted from Cloudinary:', publicId);
        return result;
    } catch (error) {
        console.error('❌ Error deleting from Cloudinary:', error);
        return null;
    }
};

// Ekstrak public ID dari URL Cloudinary
const extractPublicIdFromUrl = (url) => {
    if (!url) return null;
    
    try {
        // Format URL Cloudinary: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/public_id.jpg
        const parts = url.split('/');
        const filename = parts[parts.length - 1];
        const publicIdWithExt = filename.split('.')[0];
        
        // Cari folder
        const uploadIndex = parts.indexOf('upload');
        if (uploadIndex !== -1 && parts.length > uploadIndex + 2) {
            const folder = parts[uploadIndex + 2]; // v1234567890 adalah version, skip
            return `${folder}/${publicIdWithExt}`;
        }
        
        return publicIdWithExt;
    } catch (error) {
        console.error('Error extracting public ID:', error);
        return null;
    }
};

module.exports = {
    cloudinary,
    uploadProfilePicture,
    uploadTaskFile,
    uploadChatFile,
    uploadScreenshot,
    deleteFromCloudinary,
    extractPublicIdFromUrl
};