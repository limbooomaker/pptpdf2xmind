FROM python:3.9-slim

# 安装系统依赖（pdf2image需要的poppler-utils）
RUN apt-get update && apt-get install -y \
    poppler-utils \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 安装Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

# 创建工作目录
WORKDIR /app

# 复制项目文件
COPY . .

# 安装Python依赖
RUN pip install -r requirements.txt

# 安装Node.js依赖
RUN npm install

# 创建必要的目录
RUN mkdir -p /tmp/uploads /tmp/outputs /tmp/temp

# 设置环境变量
ENV PORT=3000
ENV UPLOAD_DIR=/tmp/uploads
ENV OUTPUT_DIR=/tmp/outputs
ENV TEMP_DIR=/tmp/temp

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["node", "server.js"]