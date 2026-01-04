const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const uploadSection = document.getElementById('uploadSection');
const processingSection = document.getElementById('processingSection');
const resultSection = document.getElementById('resultSection');
const errorSection = document.getElementById('errorSection');
const downloadBtn = document.getElementById('downloadBtn');
const restartBtn = document.getElementById('restartBtn');
const errorRestartBtn = document.getElementById('errorRestartBtn');
const resultFilename = document.getElementById('resultFilename');
const errorMessage = document.getElementById('errorMessage');

let currentDownloadUrl = null;
let currentFilename = null;

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

function handleFile(file) {
    if (file.type !== 'application/pdf') {
        showError('请上传PDF格式的文件');
        return;
    }
    
    if (file.size > 50 * 1024 * 1024) {
        showError('文件大小不能超过50MB');
        return;
    }
    
    uploadFile(file);
}

async function uploadFile(file) {
    showSection('processing');
    updateProgress(1);
    
    const formData = new FormData();
    formData.append('pdf', file);
    
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || '上传失败');
        }
        
        updateProgress(2);
        await pollStatus(result.sessionId);
        
    } catch (error) {
        showError(error.message);
    }
}

async function pollStatus(sessionId) {
    const maxAttempts = 300; // 延长到5分钟（300秒）
    let attempts = 0;
    
    const poll = async () => {
        try {
            const response = await fetch(`/api/status/${sessionId}`);
            const data = await response.json();
            
            if (data.status === 'completed') {
                updateProgress(3);
                setTimeout(() => {
                    showResult(data.filename, data.downloadUrl);
                }, 500);
                return true;
            }
            
            attempts++;
            if (attempts >= maxAttempts) {
                throw new Error('处理超时，请稍后重试');
            }
            
            return false;
        } catch (error) {
            throw error;
        }
    };
    
    while (true) {
        const completed = await poll();
        if (completed) break;
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

function showSection(section) {
    uploadSection.classList.add('hidden');
    processingSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    errorSection.classList.add('hidden');
    
    switch (section) {
        case 'upload':
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
    
    steps.forEach(s => {
        const stepEl = document.getElementById(`step${s}`);
        stepEl.classList.remove('active', 'completed');
        
        if (s < step) {
            stepEl.classList.add('completed');
        } else if (s === step) {
            stepEl.classList.add('active');
        }
    });
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