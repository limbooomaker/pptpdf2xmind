FROM node:18-alpine

# 安装Python和系统依赖（pdf2image需要的poppler-utils）
RUN apk add --no-cache \
    python3 \
    py3-pip \
    poppler-utils \
    && ln -sf python3 /usr/bin/python

# 创建工作目录
WORKDIR /app

# 先复制requirements.txt安装Python依赖（利用Docker缓存）
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# 复制项目文件
COPY . .

# 安装Node.js依赖
RUN npm install --production

# 创建必要的目录
RUN mkdir -p /app/uploads /app/outputs /app/temp

# 设置环境变量
ENV PORT=3000
ENV UPLOAD_DIR=/app/uploads
ENV OUTPUT_DIR=/app/outputs
ENV TEMP_DIR=/app/temp
ENV NODE_ENV=production

# 修复文件权限
RUN chmod +x pdf_processor.py

# 暴露端口
EXPOSE 3000

# 启动应用（使用生产环境设置）
CMD ["node", "server.js"]