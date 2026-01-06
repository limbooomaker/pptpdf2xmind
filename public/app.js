const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const uploadSection = document.getElementById('uploadSection');
const filePreviewSection = document.getElementById('filePreviewSection');
const processingSection = document.getElementById('processingSection');
const resultSection = document.getElementById('resultSection');
const errorSection = document.getElementById('errorSection');
const downloadBtn = document.getElementById('downloadBtn');
const restartBtn = document.getElementById('restartBtn');
const errorRestartBtn = document.getElementById('errorRestartBtn');
const resultFilename = document.getElementById('resultFilename');
const errorMessage = document.getElementById('errorMessage');
const previewFilename = document.getElementById('previewFilename');
const previewFilesize = document.getElementById('previewFilesize');
const changeFileBtn = document.getElementById('changeFileBtn');
const generateBtn = document.getElementById('generateBtn');
const progressPercentage = document.getElementById('progressPercentage');
const processingStatus = document.getElementById('processingStatus');
const progressBar = document.querySelector('.progress-circle-bar');

let currentDownloadUrl = null;
let currentFilename = null;
let selectedFile = null;

uploadArea.addEventListener('click', () => {
    fileInput.click();
});

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

changeFileBtn.addEventListener('click', () => {
    fileInput.click();
});

generateBtn.addEventListener('click', () => {
    if (selectedFile) {
        uploadFile(selectedFile);
    }
});

function handleFile(file) {
    if (file.type !== 'application/pdf') {
        showError('请上传PDF格式的文件');
        return;
    }
    
    if (file.size > 50 * 1024 * 1024) {
        showError('文件大小不能超过50MB');
        return;
    }
    
    selectedFile = file;
    showFilePreview(file);
}

function showFilePreview(file) {
    previewFilename.textContent = file.name;
    previewFilesize.textContent = formatFileSize(file.size);
    
    uploadSection.classList.add('hidden');
    filePreviewSection.classList.remove('hidden');
    
    generateBtn.disabled = false;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function uploadFile(file) {
    generateBtn.disabled = true;
    showSection('processing');
    updateProgress(1);
    setProgress(0);
    
    // 立即开始进度动画
    let currentProgress = 0;
    const state = { isCompleted: false };
    
    const progressInterval = setInterval(() => {
        if (currentProgress < 99 && !state.isCompleted) {
            currentProgress += 1;
            setProgress(currentProgress);
            
            // 根据进度更新步骤显示
            if (currentProgress === 33) {
                updateProgress(2);
            } else if (currentProgress === 66) {
                updateProgress(3);
            }
        }
    }, 1210);
    
    const formData = new FormData();
    formData.append('pdf', file);
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            clearInterval(progressInterval);
            throw new Error(result.error || '上传失败');
        }
        
        await pollStatus(result.sessionId, progressInterval, state);
        
    } catch (error) {
        clearInterval(progressInterval);
        showError(error.message);
    }
}

async function pollStatus(sessionId, progressInterval, state) {
    const maxAttempts = 600;
    let attempts = 0;
    
    // 轮询服务器状态
    const poll = async () => {
        try {
            const response = await fetch(`/api/status/${sessionId}`);
            const data = await response.json();
            
            if (data.status === 'completed') {
                state.isCompleted = true;
                clearInterval(progressInterval);
                setProgress(100);
                setTimeout(() => {
                    showResult(data.filename, data.downloadUrl);
                }, 500);
                return true;
            }
            
            attempts++;
            if (attempts >= maxAttempts) {
                clearInterval(progressInterval);
                throw new Error('处理超时，请稍后重试');
            }
            
            return false;
        } catch (error) {
            clearInterval(progressInterval);
            throw error;
        }
    };
    
    while (true) {
        const completed = await poll();
        if (completed) break;
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

function showSection(section) {
    uploadSection.classList.add('hidden');
    filePreviewSection.classList.add('hidden');
    processingSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    errorSection.classList.add('hidden');
    
    switch (section) {
        case 'upload':
            uploadSection.classList.remove('hidden');
            break;
        case 'preview':
            uploadSection.classList.remove('hidden');
            break;
        case 'processing':
            processingSection.classList.remove('hidden');
            break;
        case 'result':
            resultSection.classList.remove('hidden');
            break;
        case 'error':
            errorSection.classList.remove('hidden');
            break;
    }
}

function updateProgress(step) {
    const steps = [1, 2, 3];
    const statuses = [
        '正在解析您的PDF...',
        'AI正在分析文档结构...',
        '正在生成思维导图...'
    ];
    
    steps.forEach(s => {
        const stepEl = document.getElementById(`step${s}`);
        stepEl.classList.remove('active', 'completed');
        
        if (s < step) {
            stepEl.classList.add('completed');
        } else if (s === step) {
            stepEl.classList.add('active');
        }
    });

    if (step > 0 && step <= statuses.length) {
        processingStatus.textContent = statuses[step - 1];
    }
}

function setProgress(percentage) {
    console.log('Setting progress to:', percentage);
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (percentage / 100) * circumference;
    progressBar.style.strokeDashoffset = offset;
    progressPercentage.textContent = Math.round(percentage) + '%';
}

function showResult(filename, downloadUrl) {
    currentFilename = filename;
    currentDownloadUrl = downloadUrl;
    
    // 正确显示中文文件名
    try {
        // 尝试解码URL编码的文件名
        const decodedFilename = decodeURIComponent(filename);
        resultFilename.textContent = decodedFilename;
    } catch (e) {
        // 如果解码失败，使用原始文件名
        resultFilename.textContent = filename;
    }
    
    showSection('result');
}

function showError(message) {
    errorMessage.textContent = message;
    showSection('error');
}

downloadBtn.addEventListener('click', () => {
    if (currentDownloadUrl) {
        window.location.href = currentDownloadUrl;
    }
});

restartBtn.addEventListener('click', resetForm);
errorRestartBtn.addEventListener('click', resetForm);

function resetForm() {
    fileInput.value = '';
    currentDownloadUrl = null;
    currentFilename = null;
    showSection('upload');
}