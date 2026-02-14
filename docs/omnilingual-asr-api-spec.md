# Omnilingual ASR API 接口规范

> **文档版本**: v1.0
> **项目**: Bridgelingua
> **用途**: 供 ASR 工程师按此规范封装 Omnilingual ASR 推理服务，对接 Bridgelingua 后端调用

---

## 1. 概述

Bridgelingua 后端需要调用独立部署的 Omnilingual ASR 服务完成语音转录。当前 ASR 模型以 Gradio 应用形式运行于本地，需要在其基础上封装标准 HTTP API，供 Bridgelingua 后端通过 HTTP 请求调用。

### 核心需求

| 能力 | 说明 |
|------|------|
| 语音转录 | 接收音频文件 + 目标语言，返回带时间戳的分段转录文本 |
| 多语言支持 | 支持 1600+ 语言，语言编码采用 BCP-47 格式 (如 `eng_Latn`, `zho_Hans`, `yue_Hans`) |
| 长音频处理 | 支持最大 100MB 音频文件，时长不限 |
| 格式兼容 | 支持 `.wav`, `.mp3`, `.flac`, `.ogg`, `.m4a` 音频格式 |

---

## 2. 接口定义

### 2.1 语音转录 (核心接口)

**`POST /asr/transcribe`**

将音频文件发送至 ASR 服务，获取分段转录结果。

#### Request

**Content-Type**: `multipart/form-data`

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `audio` | `file` | 是 | - | 音频文件，支持 wav/mp3/flac/ogg/m4a |
| `language` | `string` | 是 | - | 目标语言 BCP-47 编码，见附录 A |

#### Response — 成功 (`200 OK`)

**Content-Type**: `application/json`

```json
{
  "segments": [
    {
      "start": 0.0,
      "end": 4.52,
      "text": "选择文本对应的语言和您喜欢的语音风格"
    },
    {
      "start": 4.52,
      "end": 9.18,
      "text": "每种语言均有多种语音包风格"
    },
    {
      "start": 9.18,
      "end": 15.03,
      "text": "如果您需要调节语速下载文件格式声音大小调整音调等"
    },
    {
      "start": 15.03,
      "end": 18.76,
      "text": "请点击高级设置配置集者"
    }
  ],
  "language": "yue_Hans",
  "duration": 18.76
}
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `segments` | `array` | 转录分段列表，按时间顺序排列 |
| `segments[].start` | `float` | 分段起始时间 (秒)，精度至小数点后两位 |
| `segments[].end` | `float` | 分段结束时间 (秒)，精度至小数点后两位 |
| `segments[].text` | `string` | 该时间段内的转录文本，已去除首尾空白 |
| `language` | `string` | 实际使用的语言编码，与请求中的 `language` 一致 |
| `duration` | `float` | 音频总时长 (秒)，等于最后一个 segment 的 `end` 值 |

**关键约束**:

- `segments` 必须按 `start` 升序排列
- 相邻 segment 不应有时间重叠 (`segments[i].end <= segments[i+1].start`)
- `start` 必须 `>= 0`，`end` 必须 `> start`
- `text` 不应为空字符串；无语音活动的区间不生成 segment
- 静默段 (无语音活动) 无需返回，直接跳过即可

#### Response — 失败

**`400 Bad Request`** — 请求参数错误

```json
{
  "error": {
    "code": "INVALID_AUDIO_FORMAT",
    "message": "不支持的音频格式: .aac，支持的格式: wav, mp3, flac, ogg, m4a"
  }
}
```

**`400 Bad Request`** — 语言编码错误

```json
{
  "error": {
    "code": "UNSUPPORTED_LANGUAGE",
    "message": "不支持的语言编码: xyz_Latn"
  }
}
```

**`413 Payload Too Large`** — 文件超限

```json
{
  "error": {
    "code": "FILE_TOO_LARGE",
    "message": "文件大小超过限制，最大允许 100MB"
  }
}
```

**`500 Internal Server Error`** — 推理异常

```json
{
  "error": {
    "code": "TRANSCRIPTION_FAILED",
    "message": "转录失败: GPU 内存不足"
  }
}
```

#### cURL 示例

```bash
curl -X POST http://localhost:7860/asr/transcribe \
  -F "audio=@recording.wav" \
  -F "language=yue_Hans"
```

---

### 2.2 健康检查

**`GET /asr/health`**

用于 Bridgelingua 后端验证 ASR 服务连通性和模型就绪状态。

#### Response — 成功 (`200 OK`)

```json
{
  "status": "ok",
  "model": "omniASR_LLM_Unlimited_7B_v2",
  "device": "cuda:0",
  "languages_count": 1600
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | `string` | 服务状态，`ok` 表示模型已加载且可接受推理请求 |
| `model` | `string` | 当前加载的 ASR 模型标识 |
| `device` | `string` | 推理设备 (如 `cuda:0`, `cpu`) |
| `languages_count` | `int` | 支持的语言总数 |

#### Response — 模型未就绪 (`503 Service Unavailable`)

```json
{
  "status": "loading",
  "message": "模型加载中，请稍后重试"
}
```

---

### 2.3 支持语言列表

**`GET /asr/languages`**

返回当前 ASR 模型支持的所有语言列表。前端语言选择器依赖完整字段进行地区分类、原生名称展示和濒危状态标注，**所有字段均为必填**。

#### Response — 成功 (`200 OK`)

```json
{
  "languages": [
    {
      "code": "yue_Hans",
      "name": "Cantonese (Simplified)",
      "native": "粤语",
      "iso639_3": "yue",
      "region": "asia",
      "speakers": "85M",
      "status": ""
    },
    {
      "code": "zho_Hans",
      "name": "Chinese (Simplified)",
      "native": "中文",
      "iso639_3": "zho",
      "region": "asia",
      "speakers": "1.3B",
      "status": ""
    },
    {
      "code": "eng_Latn",
      "name": "English",
      "native": "English",
      "iso639_3": "eng",
      "region": "europe",
      "speakers": "1.5B",
      "status": ""
    },
    {
      "code": "nav_Latn",
      "name": "Navajo",
      "native": "Diné bizaad",
      "iso639_3": "nav",
      "region": "americas",
      "speakers": "170K",
      "status": "endangered"
    }
  ]
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `languages` | `array` | 是 | 支持的语言列表 |
| `languages[].code` | `string` | 是 | BCP-47 语言编码 (格式: `{iso639_3}_{script}`) |
| `languages[].name` | `string` | 是 | 语言英文名称 |
| `languages[].native` | `string` | 是 | 语言原生名称 (如 中文、English、Cymraeg) |
| `languages[].iso639_3` | `string` | 是 | ISO 639-3 三字母代码 (如 `yue`, `zho`, `eng`) |
| `languages[].region` | `string` | 是 | 地理区域，枚举值: `africa`, `americas`, `asia`, `europe`, `pacific` |
| `languages[].speakers` | `string` | 是 | 使用人数 (如 `85M`, `170K`, `<10`) |
| `languages[].status` | `string` | 是 | 濒危状态，枚举值: `""` (无), `vulnerable`, `endangered`, `critically endangered` |

---

## 3. 通用规范

### 3.1 错误响应格式

所有错误响应统一使用以下结构:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "人类可读的错误描述"
  }
}
```

### 3.2 错误码清单

| HTTP 状态码 | 错误码 | 说明 |
|-------------|--------|------|
| 400 | `INVALID_AUDIO_FORMAT` | 音频格式不支持 |
| 400 | `UNSUPPORTED_LANGUAGE` | 语言编码不在支持列表中 |
| 400 | `EMPTY_AUDIO` | 音频文件为空或时长为 0 |
| 413 | `FILE_TOO_LARGE` | 文件超过 100MB 限制 |
| 500 | `TRANSCRIPTION_FAILED` | 模型推理过程发生错误 |
| 503 | `MODEL_NOT_READY` | 模型尚未加载完成 |

### 3.3 CORS

ASR 服务需允许 Bridgelingua 后端的跨域请求:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

> 生产环境建议将 `Allow-Origin` 限制为 Bridgelingua 后端的实际地址。

### 3.4 超时

| 场景 | 建议超时 |
|------|----------|
| 短音频 (< 30s) | 30 秒 |
| 中等音频 (30s - 5min) | 120 秒 |
| 长音频 (> 5min) | 600 秒 |

Bridgelingua 后端将使用 **120 秒**作为默认请求超时，请确保常规长度音频 (< 5min) 能在此时限内完成推理。

---

## 4. 语言编码规范

### 4.1 编码格式

采用 BCP-47 变体: `{iso639_3}_{script}`

- `iso639_3`: ISO 639-3 三字母语言代码
- `script`: ISO 15924 四字母文字代码

### 4.2 常用语言编码对照

| 编码 | 语言 |
|------|------|
| `zho_Hans` | 中文 (简体) |
| `zho_Hant` | 中文 (繁体) |
| `yue_Hans` | 粤语 (简体) |
| `eng_Latn` | 英语 |
| `jpn_Jpan` | 日语 |
| `kor_Hang` | 韩语 |
| `fra_Latn` | 法语 |
| `deu_Latn` | 德语 |
| `spa_Latn` | 西班牙语 |
| `ara_Arab` | 阿拉伯语 |
| `hin_Deva` | 印地语 |
| `rus_Cyrl` | 俄语 |

完整语言列表可通过 `GET /asr/languages` 获取。

---

## 5. 对接示意

Bridgelingua 后端调用流程:

```
Bridgelingua Frontend           Bridgelingua Backend          Omnilingual ASR Service
       |                               |                               |
       |  上传音频 + 选择语言            |                               |
       |  POST /api/transcribe -------->|                               |
       |                               |  POST /asr/transcribe ------->|
       |                               |  (转发 audio + language)       |
       |                               |                               | 模型推理
       |                               |                               |
       |                               |<---- segments + duration ------|
       |                               |                               |
       |<----- TranscribeResponse ------|                               |
       |  {segments, language, duration}|                               |
```

### 后端对接代码参考

Bridgelingua 后端的 `asr_service.py` 将以如下方式调用 ASR API:

```python
import httpx
from pathlib import Path

ASR_ENDPOINT = "http://localhost:7860"  # 从 settings 读取

async def transcribe(audio_path: Path, language: str) -> dict:
    async with httpx.AsyncClient(timeout=120.0) as client:
        with open(audio_path, "rb") as f:
            resp = await client.post(
                f"{ASR_ENDPOINT}/asr/transcribe",
                files={"audio": (audio_path.name, f)},
                data={"language": language},
            )
        resp.raise_for_status()
        return resp.json()
```

---

## 6. 验收标准

工程师交付 ASR API 时，需满足以下验收条件:

- [ ] `POST /asr/transcribe` 能正确接收音频文件和语言参数，返回符合上述 JSON 格式的分段结果
- [ ] `segments` 中的时间戳与音频实际内容对应，误差不超过 0.5 秒
- [ ] `text` 内容为实际转录结果，非空、无多余空白字符
- [ ] `GET /asr/health` 返回模型状态，可用于连通性检测
- [ ] `GET /asr/languages` 返回完整的支持语言列表
- [ ] 错误场景 (格式不支持、语言不存在) 返回规范的错误响应，而非 500 或 HTML 页面
- [ ] 支持并发请求 (至少 2 个同时推理请求)
- [ ] 30 秒以内的音频，响应时间不超过 30 秒
