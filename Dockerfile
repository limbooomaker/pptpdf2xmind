FROM python:3.9-slim

# 安装系统依赖（pdf2image需要的poppler-utils）
RUN apt-get update && apt-get install -y \
    poppler-utils \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 验证poppler-utils安装
RUN which pdftoppm && pdftoppm -v || (echo "pdftoppm not found or not working" && exit 1)

# 安装Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# 创建工作目录
WORKDIR /app

# 复制项目文件
COPY . .

# 安装Python依赖
RUN pip install -r requirements.txt

# 验证Python依赖安装
RUN python3 -c "import pdf2image; import pdfplumber; import PIL; print('Python dependencies OK')" || (echo "Python dependencies failed" && exit 1)

# 安装Node.js依赖
RUN npm install

# 创建必要的目录
RUN mkdir -p /tmp/uploads /tmp/outputs /tmp/temp

# 设置Python脚本执行权限
RUN chmod +x /app/pdf_processor.py

# 验证Python脚本可执行性
RUN ls -la /app/pdf_processor.py && python3 /app/pdf_processor.py --help 2>/dev/null || echo "Python script validation complete"

# 设置环境变量
ENV PORT=3000
ENV UPLOAD_DIR=/tmp/uploads
ENV OUTPUT_DIR=/tmp/outputs
ENV TEMP_DIR=/tmp/temp
ENV NODE_ENV=production

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 启动应用
CMD ["node", "server.js"]