# JVScrew 用户试用端

基于无影 AI（WuyingAI）API 构建的智能体对话试用客户端，支持多专家切换、文件管理、沙箱预览、定时任务等功能。

## 环境要求

- **Node.js** >= 18.x
- **npm** >= 9.x

## 项目结构

```
├── client/          # 前端 React + Vite + Tailwind CSS
├── server/          # 后端 Express (AK/SK API 代理)
├── .env.example     # 环境变量模板
└── package.json     # workspace 根配置
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，填入阿里云 AccessKey：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```
ALIBABA_CLOUD_ACCESS_KEY_ID=你的AK
ALIBABA_CLOUD_ACCESS_KEY_SECRET=你的SK
```

> ⚠️ AK/SK 需要有无影 AI（WuyingAI）服务的访问权限。

### 3. 启动开发服务

```bash
npm run dev
```

该命令会同时启动：
- 前端开发服务器（默认 http://localhost:5173）
- 后端 API 服务器（默认 http://localhost:3001）

浏览器打开 http://localhost:5173 即可使用。

## 配置说明

### API Endpoint

当前配置使用线上环境：

| 配置文件 | 说明 |
|---------|------|
| `client/vite.config.ts` | 前端 `/jvs` 代理目标地址 |
| `server/src/utils/popRequest.ts` | 后端 AK/SK 请求的 endpoint |

默认值为 `https://wuyingai.cn-shanghai.aliyuncs.com`。如需切换到其他环境，请同步修改这两个文件。

### 端口配置

- 前端端口：在 `client/vite.config.ts` 中配置
- 后端端口：通过环境变量 `PORT` 设置，默认 3001

## 功能概述

- **智能体对话**：支持 SSE 流式对话、推理过程展示、工具调用展示
- **多专家切换**：支持多个 Agent 模板切换
- **文件空间**：文件列表浏览、下载、预览（支持 Markdown 渲染）
- **沙箱预览**：实时预览 Agent 操作的云端沙箱环境
- **定时任务**：创建/编辑/删除定时执行任务
- **文件上传**：支持上传文件供 Agent 使用

## 生产部署

如需生产部署，分别构建前后端：

```bash
# 构建前端静态文件
npm run build --workspace=client
# 产出在 client/dist/

# 构建后端
npm run build --workspace=server
# 产出在 server/dist/

# 启动后端
npm run start --workspace=server
```

生产环境需要用 Nginx 或类似工具：
1. 将前端 `client/dist/` 作为静态文件服务
2. 将 `/api/*` 请求反向代理到后端服务（默认 3001 端口）
3. 将 `/jvs/*` 请求反向代理到 `https://wuyingai.cn-shanghai.aliyuncs.com`（去掉 `/jvs` 前缀）

### Nginx 配置参考

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /path/to/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 无影 AI API 代理（JWT 认证的接口）
    location /jvs/ {
        rewrite ^/jvs/(.*)$ /$1 break;
        proxy_pass https://wuyingai.cn-shanghai.aliyuncs.com;
        proxy_set_header Host wuyingai.cn-shanghai.aliyuncs.com;
        proxy_ssl_server_name on;
    }
}
```

## 注意事项

1. `.env` 文件包含敏感密钥，请勿泄露或提交到版本控制
2. AK/SK 仅在后端使用，前端不会接触到密钥
3. 首次使用需要在登录页输入 `ExternalUserId` 进行登录
