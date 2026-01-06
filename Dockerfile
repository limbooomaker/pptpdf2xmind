FROM python:3.9-slim

# 安装系统依赖（pdf2image需要的poppler-utils）
RUN apt-get update && apt-get install -y \
    poppler-utils \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 安装Node.js（使用官方方法）
RUN apt-get update && apt-get install -y curl gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 创建工作目录
WORKDIR /app

# 复制项目文件
COPY . .

# 确保Python脚本有执行权限
RUN chmod +x pdf_processor.py

# 安装Python依赖
RUN pip install -r requirements.txt

# 安装Node.js依赖
RUN npm install

# 创建必要的目录
RUN mkdir -p /tmp/uploads /tmp/outputs /tmp/temp

# 设置环境变量
ENV PORT=3000
ENV UPLOAD_DIR=/app/uploads
ENV OUTPUT_DIR=/app/outputs
ENV TEMP_DIR=/app/temp
ENV NODE_ENV=production

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# 设置启动脚本权限
RUN chmod +x start.sh

# 启动应用
CMD ["./start.sh"]