const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 增加超时设置
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// 设置服务器超时时间（30分钟）
app.use((req, res, next) => {
    req.setTimeout(30 * 60 * 1000); // 30分钟
    res.setTimeout(30 * 60 * 1000); // 30分钟
    next();
});

const upload = multer({
    dest: process.env.UPLOAD_DIR || './uploads',
    limits: {
        fileSize: 50 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'));
        }
    }
});

const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

ensureDir(process.env.UPLOAD_DIR || './uploads');
ensureDir(process.env.OUTPUT_DIR || './outputs');
ensureDir(process.env.TEMP_DIR || './temp');

const executePython = async (script, args) => {
    return new Promise((resolve, reject) => {
        const command = `python3 ${script} ${args.join(' ')}`;
        console.log('Executing Python command:', command);
        
        exec(command, (error, stdout, stderr) => {
            console.log('Python stdout:', stdout);
            if (stderr) {
                console.log('Python stderr:', stderr);
            }
            
            if (error) {
                console.error('Python execution error:', error);
                reject(new Error(`Python execution failed: ${error.message}`));
                return;
            }
            
            if (!stdout || stdout.trim() === '') {
                reject(new Error('Python script produced no output'));
                return;
            }
            
            // 检查输出是否包含错误信息（如Bad Gateway）
            const output = stdout.trim();
            if (output.includes('Bad Gateway') || output.includes('error') || output.includes('Error')) {
                console.error('Python script returned error output:', output);
                reject(new Error(`Python script error: ${output}`));
                return;
            }
            
            try {
                const result = JSON.parse(output);
                resolve(result);
            } catch (e) {
                console.error('JSON parse error:', e.message);
                console.error('Raw output:', output);
                reject(new Error(`Failed to parse Python output as JSON: ${output}`));
            }
        });
    });
};

const cleanup = async (sessionId) => {
    const dirs = [
        path.join(process.env.UPLOAD_DIR || './uploads', sessionId),
        path.join(process.env.TEMP_DIR || './temp', sessionId)
    ];
    
    for (const dir of dirs) {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    }
};

app.post('/api/upload', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const sessionId = uuidv4().substring(0, 8);
        const sessionDir = path.join(process.env.TEMP_DIR || './temp', sessionId);
        ensureDir(sessionDir);

        const pdfPath = req.file.path;
        
        // 正确处理中文文件名编码
        let originalFilename = req.file.originalname;
        
        // 如果文件名看起来像乱码，尝试解码
        if (originalFilename.includes('ã') || originalFilename.includes('ä')) {
            // 尝试从UTF-8编码恢复
            try {
                const buffer = Buffer.from(originalFilename, 'binary');
                originalFilename = buffer.toString('utf8');
            } catch (e) {
                console.log('文件名解码失败，使用原始文件名:', originalFilename);
            }
        }
        
        console.log('处理后的原始文件名:', originalFilename);
        const outputDir = path.join(sessionDir, 'pages');
        
        try {
            // 设置超时保护
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Processing timeout after 15 minutes')), 15 * 60 * 1000);
            });

            // 处理PDF页面
            const pagesData = await Promise.race([
                executePython('./pdf_processor.py', [pdfPath, outputDir]),
                timeoutPromise
            ]);
            
            // 生成知识树（最多重试2次）
            const { generateKnowledgeTree } = require('./aiService');
            let knowledgeTree;
            let retryCount = 0;
            
            while (retryCount < 3) {
                try {
                    knowledgeTree = await Promise.race([
                        generateKnowledgeTree(pagesData.data),
                        timeoutPromise
                    ]);
                    break;
                } catch (aiError) {
                    retryCount++;
                    if (retryCount === 3) {
                        throw aiError;
                    }
                    console.log(`AI服务重试 ${retryCount}/3`);
                    await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒后重试
                }
            }
            
            // 生成XMind文件
            const { generateXMind } = require('./xmindGenerator');
            const xmindResult = await Promise.race([
                generateXMind(pagesData.data, knowledgeTree, originalFilename, sessionId, process.env.OUTPUT_DIR || './outputs'),
                timeoutPromise
            ]);
            
            // 清理临时文件
            await cleanup(sessionId);
            
            // 更新状态缓存 - 使用显示文件名和安全的文件系统文件名
            const displayFilename = xmindResult.displayFilename;
            const safeFilename = xmindResult.safeFilename;
            sessionStatus.set(sessionId, {
                status: 'completed',
                filename: displayFilename, // 使用与上传文件相同的显示文件名
                downloadUrl: `/api/download/${safeFilename}` // 下载时使用安全的文件系统文件名
            });
            
            // 发送最终结果 - 设置UTF-8编码
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.json({ 
                status: 'completed',
                sessionId: sessionId,
                message: 'XMind file created successfully',
                filename: displayFilename, // 使用与上传文件相同的显示文件名
                downloadUrl: `/api/download/${safeFilename}` // 下载时使用安全的文件系统文件名
            });
            
            console.log(`Session ${sessionId} completed successfully`);
        } catch (error) {
            console.error(`Session ${sessionId} failed:`, error);
            await cleanup(sessionId);
            
            // 发送错误响应
            res.status(500).json({ 
                status: 'error',
                sessionId: sessionId,
                message: 'Processing failed: ' + error.message
            });
        }

    } catch (error) {
        console.error('Upload error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

// 存储会话状态的内存缓存
const sessionStatus = new Map();

app.get('/api/status/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    const outputDir = process.env.OUTPUT_DIR || './outputs';
    
    // 检查内存缓存中的状态
    if (sessionStatus.has(sessionId)) {
        const status = sessionStatus.get(sessionId);
        if (status.status === 'completed') {
            res.json(status);
            return;
        }
    }
    
    // 检查所有XMind文件，查找包含sessionId的文件
    const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.xmind'));
    
    // 查找与当前sessionId相关的文件
    const matchingFiles = files.filter(f => {
        // 检查文件名是否包含sessionId（作为标识符）
        const fileNameWithoutExt = f.replace('.xmind', '');
        return fileNameWithoutExt.includes(sessionId) || 
               sessionStatus.has(sessionId);
    });
    
    if (matchingFiles.length > 0) {
        const status = {
            status: 'completed', 
            filename: matchingFiles[0],
            downloadUrl: `/api/download/${matchingFiles[0]}`
        };
        // 更新缓存
        sessionStatus.set(sessionId, status);
        res.json(status);
    } else {
        res.json({ status: 'processing' });
    }
});

app.get('/api/download/:filename', (req, res) => {
    const safeFilename = req.params.filename;
    const filepath = path.join(process.env.OUTPUT_DIR || './outputs', safeFilename);
    
    if (fs.existsSync(filepath)) {
        // 从sessionStatus中查找对应的显示文件名
        let displayFilename = safeFilename; // 默认使用安全文件名
        
        // 遍历sessionStatus查找匹配的条目
        for (let [sessionId, status] of sessionStatus) {
            const downloadUrlParts = status.downloadUrl?.split('/');
            const urlSafeFilename = downloadUrlParts?.[downloadUrlParts.length - 1];
            
            if (urlSafeFilename === safeFilename && status.filename) {
                displayFilename = status.filename;
                break;
            }
        }
        
        // 正确设置中文文件名编码
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(displayFilename)}`);
        
        res.download(filepath, displayFilename, (err) => {
            if (!err) {
                fs.unlinkSync(filepath);
            }
        });
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

// 健康检查路由
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'SlideMind API is running',
        timestamp: new Date().toISOString()
    });
});

// 健康检查API
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'SlideMind',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`SlideMind server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Upload directory: ${process.env.UPLOAD_DIR}`);
    console.log(`Output directory: ${process.env.OUTPUT_DIR}`);
});