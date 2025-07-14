const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;


app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});


app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use(express.static(path.join(__dirname, 'public')));


const imagesDir = path.join(__dirname, 'images');
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
}


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, imagesDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Sadece resim dosyaları yüklenebilir!'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 
    }
});


app.get('/', (req, res) => {
    res.json({
        message: 'Image API\'ye hoş geldiniz!',
        endpoints: {
            'GET /images': 'Tüm resimleri listele',
            'GET /images/:filename': 'Belirli bir resmi görüntüle',
            'POST /upload': 'Resim yükle',
            'DELETE /images/:filename': 'Resmi sil'
        }
    });
});


app.get('/images', (req, res) => {
    try {
        const files = fs.readdirSync(imagesDir);
        const imageFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext);
        });

        const imageList = imageFiles.map(file => {
            const filePath = path.join(imagesDir, file);
            const stats = fs.statSync(filePath);
            return {
                filename: file,
                size: stats.size,
                uploadDate: stats.mtime,
                url: `${req.protocol}://${req.get('host')}/images/${file}`
            };
        });

        res.json({
            count: imageList.length,
            images: imageList
        });
    } catch (error) {
        res.status(500).json({ error: 'Resimler listelenirken hata oluştu' });
    }
});


app.get('/images/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(imagesDir, filename);


    if (!filename || filename.includes('..')) {
        return res.status(400).json({ error: 'Geçersiz dosya adı' });
    }

 
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Resim bulunamadı' });
    }


    const ext = path.extname(filename).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    
    if (!allowedExtensions.includes(ext)) {
        return res.status(400).json({ error: 'Desteklenmeyen dosya türü' });
    }


    const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.webp': 'image/webp'
    };

    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    try {
      
        const stats = fs.statSync(filePath);
        
        
        res.set({
            'Content-Type': mimeType,
            'Content-Length': stats.size,
            'Cache-Control': 'public, max-age=31536000', 
            'Last-Modified': stats.mtime.toUTCString(),
            'ETag': `"${stats.mtime.getTime()}-${stats.size}"`
        });

        
        const readStream = fs.createReadStream(filePath);
        readStream.pipe(res);
    } catch (error) {
        res.status(500).json({ error: 'Resim okunurken hata oluştu' });
    }
});


app.post('/upload', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Resim dosyası gerekli' });
        }

        const fileInfo = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            uploadDate: new Date(),
            url: `${req.protocol}://${req.get('host')}/images/${req.file.filename}`
        };

        res.status(201).json({
            message: 'Resim başarıyla yüklendi',
            file: fileInfo
        });
    } catch (error) {
        res.status(500).json({ error: 'Resim yüklenirken hata oluştu' });
    }
});


app.delete('/images/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(imagesDir, filename);

   
    if (!filename || filename.includes('..')) {
        return res.status(400).json({ error: 'Geçersiz dosya adı' });
    }

    try {
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Resim bulunamadı' });
        }

        fs.unlinkSync(filePath);
        res.json({ message: 'Resim başarıyla silindi' });
    } catch (error) {
        res.status(500).json({ error: 'Resim silinirken hata oluştu' });
    }
});


app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Dosya boyutu çok büyük (max 5MB)' });
        }
    }
    
    if (error.message === 'Sadece resim dosyaları yüklenebilir!') {
        return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Sunucu hatası' });
});


app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint bulunamadı' });
});


app.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
    console.log(`Frontend: http://localhost:${PORT}`);
    console.log(`API dokümantasyonu: http://localhost:${PORT}/`);
});

module.exports = app;