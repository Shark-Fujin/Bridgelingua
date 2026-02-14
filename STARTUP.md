# Bridgelingua 启动指南

## 环境要求

| 依赖 | 最低版本 | 说明 |
|------|---------|------|
| Python | 3.10+ | 后端运行时 |
| Node.js | 18+ | 前端构建与开发服务器 |
| npm | 9+ | 随 Node.js 安装 |
| GPU + CUDA（可选） | CUDA 11.8+ | 运行 OmniASR / NLLB 模型推理，无 GPU 时自动降级为 Mock 模式 |

---

## 一、后端启动

### 1. 进入后端目录

```bash
cd E:\duoyuyan\backend
```

### 2. 创建虚拟环境

```bash
python -m venv .venv
```

激活虚拟环境：

```bash
# Windows CMD
.venv\Scripts\activate

# Windows PowerShell
.venv\Scripts\Activate.ps1

```

### 3. 安装依赖

基础依赖（不含 ML 模型，以 Mock 模式运行）：

```bash
pip install -e .
```

如需启用 ASR / 翻译模型推理：

```bash
pip install -e ".[ml]"
```

> `[ml]` 额外安装 `torch` 和 `transformers`。OmniASR 需单独安装：`pip install omniasr`

### 4. 启动开发服务器

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

启动后访问：

- API 文档：http://localhost:8000/docs
- 健康检查：http://localhost:8000/api/health

### 5. 验证后端

```bash
curl http://localhost:8000/api/health
# 预期返回：{"status":"ok","version":"0.1.0"}
```

### 后端环境变量（可选）

所有配置项均以 `BL_` 为前缀，可通过环境变量或 `.env` 文件覆盖：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `BL_DEBUG` | `false` | 开启 SQLAlchemy SQL 日志 |
| `BL_DATABASE_URL` | `sqlite+aiosqlite:///./app/storage/db/bridgelingua.db` | 数据库连接串 |
| `BL_UPLOAD_DIR` | `app/storage/uploads` | 音频文件上传存储目录 |
| `BL_MAX_UPLOAD_SIZE` | `104857600` (100MB) | 最大上传文件大小（字节） |
| `BL_CORS_ORIGINS` | `["http://localhost:5173"]` | CORS 允许的前端地址 |

> 数据库和上传目录会在首次启动时自动创建，无需手动初始化。

---

## 二、前端启动

### 1. 进入前端目录

```bash
cd E:\duoyuyan\frontend
```

### 2. 安装依赖

```bash
npm install
```

### 3. 启动开发服务器

```bash
npm run dev
```

默认地址：http://localhost:5173

### 4. 生产构建

```bash
npm run build
```

构建产物输出到 `frontend/dist/`，可部署到任意静态服务器。

预览生产构建：

```bash
npm run preview
```

### 前端环境变量

| 文件 | 变量 | 默认值 | 说明 |
|------|------|--------|------|
| `.env.development` | `VITE_API_BASE_URL` | `http://localhost:8000` | 开发环境后端地址 |

生产环境可创建 `.env.production`：

```
VITE_API_BASE_URL=https://your-api-domain.com
```

---

## 三、完整启动流程（快速参考）

打开两个终端窗口，分别执行：

**终端 1 — 后端**

```bash
cd E:\duoyuyan\backend
python -m venv .venv
.venv\Scripts\activate
pip install -e .
uvicorn app.main:app --reload --port 8001
```

**终端 2 — 前端**

```bash
cd E:\duoyuyan\frontend
npm install
npm run dev
```

浏览器打开 http://localhost:5173 即可使用。

---

## 四、功能模式说明

### Mock 模式（无 GPU / 无模型）

不安装 `omniasr` 和 `transformers` 时，系统自动进入 Mock 模式：

- **ASR**：返回 3 段模拟转写文本
- **翻译**：返回 `[Mock translation to {lang}] 原文` 格式的模拟翻译

适用于前端开发和 UI 调试，无需任何硬件要求。

### 完整推理模式（需要 GPU）

```bash
pip install -e ".[ml]"
pip install omniasr
```

- **ASR 模型**：`omniASR_LLM_Unlimited_7B_v2`，首次运行自动下载至 `~/.cache/fairseq2/assets/`
- **翻译模型**：`facebook/nllb-200-distilled-600M`，首次运行自动下载至 `~/.cache/huggingface/`
- 显存建议：16GB+（7B ASR 模型 + 600M 翻译模型）

---

## 五、项目目录结构

```
E:\duoyuyan\
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 入口
│   │   ├── config.py            # 环境配置
│   │   ├── database.py          # SQLAlchemy async 引擎
│   │   ├── models/              # ORM 模型 (Setting, Folder, AudioFile, Lexicon, Entry...)
│   │   ├── schemas/             # Pydantic 请求/响应模型
│   │   ├── routers/             # API 路由 (settings, languages, transcribe, library, lexicon)
│   │   ├── services/            # 业务逻辑 (asr_service, translation_service)
│   │   ├── data/languages.json  # 语言元数据
│   │   └── storage/             # 运行时数据 (db/ + uploads/)
│   ├── pyproject.toml
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # 路由 + 代码分割
│   │   ├── styles/              # 9 个 CSS 模块文件
│   │   ├── i18n/                # 中英双语 (en.json, zh.json)
│   │   ├── hooks/               # useApi, useAudioRecorder, useTheme
│   │   ├── stores/              # Zustand (settings, languages, workspace, library, lexicon)
│   │   ├── utils/               # exporters (JSON/CSV/SRT/TXT)
│   │   └── components/          # layout/ common/ workspace/ library/ lexicon/ settings/
│   ├── .env.development
│   └── package.json
├── Demo.html                    # UI 原型参考
└── MVP_PRD.md                   # 产品需求文档
```

---

## 六、常见问题

### Q: 启动后端报 `ModuleNotFoundError: No module named 'app'`

确保在 `backend/` 目录下执行 `uvicorn`，且已通过 `pip install -e .` 安装项目。

### Q: 前端请求后端返回 CORS 错误

检查后端 `BL_CORS_ORIGINS` 是否包含前端地址。默认仅允许 `http://localhost:5173`。

### Q: 转写/翻译返回 Mock 数据

这是正常的 Mock 模式。安装 `omniasr` 和 `transformers` 后会自动切换为真实推理。

### Q: SQLite 数据库文件在哪里？

`backend/app/storage/db/bridgelingua.db`，首次启动自动创建。删除此文件可重置所有数据。

### Q: 如何切换暗色主题？

顶部导航栏右侧有主题切换按钮，或在 Settings → Interface → Theme 中选择。

### Q: 如何切换界面语言？

顶部导航栏的语言按钮可在中/英之间切换。
