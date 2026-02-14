# NLLB-200 翻译服务 API 接口规范

> **文档版本**: v1.0
> **项目**: Bridgelingua
> **用途**: 供翻译工程师按此规范封装 NLLB-200 推理服务，对接 Bridgelingua 后端调用

---

## 1. 概述

Bridgelingua 后端需要调用独立部署的 NLLB-200 翻译服务完成多语言文本翻译。NLLB-200 模型基于 HuggingFace Transformers 加载运行，需要在其基础上封装标准 HTTP API，供 Bridgelingua 后端通过 HTTP 请求调用。

### 核心需求

| 能力 | 说明 |
|------|------|
| 文本翻译 | 接收源文本 + 源语言 + 目标语言，返回翻译结果 |
| 批量翻译 | 支持单次请求传入多段文本，批量返回翻译结果 |
| 多语言支持 | 支持 200 种语言互译，语言编码采用 FLORES-200 BCP-47 格式 (如 `eng_Latn`, `zho_Hans`) |
| 模型可选 | 支持加载不同规格的 NLLB-200 模型，通过健康检查接口暴露当前模型信息 |

### 调用场景

| 场景 | 说明 | 调用方式 |
|------|------|----------|
| 工作台段落翻译 | ASR 转写完成后，将多个分段文本批量翻译为目标语言 | 批量 (texts 数组) |
| 工作台单段重译 | 用户编辑某段转写文本后，重新翻译该段 | 单条 (texts 数组长度为 1) |
| 词典建议翻译 | 快速录入模式下，为词条提供候选释义 | 单条 (texts 数组长度为 1) |

### 模型选型参考

| 模型 | 参数量 | 显存需求 (FP16) | 适用场景 |
|------|--------|-----------------|----------|
| `facebook/nllb-200-distilled-600M` | 600M | ~2 GB | 资源受限 / 快速原型验证 |
| `facebook/nllb-200-distilled-1.3B` | 1.3B | ~4 GB | 平衡性能与质量 |
| `facebook/nllb-200-3.3B` | 3.3B | ~8 GB | **推荐生产环境使用** |

> 工程师根据实际 GPU 资源选择模型，接口协议不变。

---

## 2. 接口定义

### 2.1 文本翻译 (核心接口)

**`POST /nllb/translate`**

接收一段或多段文本，翻译为目标语言后返回。

#### Request

**Content-Type**: `application/json`

```json
{
  "texts": [
    "UN Chief says there is no military solution in Syria",
    "The weather is nice today"
  ],
  "source_lang": "eng_Latn",
  "target_lang": "zho_Hans"
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `texts` | `string[]` | 是 | - | 待翻译文本数组，至少 1 条，最多 50 条 |
| `source_lang` | `string` | 是 | - | 源语言 FLORES-200 编码，见第 4 节 |
| `target_lang` | `string` | 是 | - | 目标语言 FLORES-200 编码，见第 4 节 |
| `max_length` | `int` | 否 | `256` | 生成翻译的最大 token 数，范围 [1, 512] |

**关键约束**:

- 每条 `texts[i]` 不得超过 **512 tokens** (约 200-300 个中文字 / 300-400 个英文词)
- 超长文本应在调用前由 Bridgelingua 后端拆分，本服务不负责分段
- `texts` 数组为空或超过 50 条时拒绝请求
- `source_lang` 和 `target_lang` 不得相同

#### Response — 成功 (`200 OK`)

**Content-Type**: `application/json`

```json
{
  "translations": [
    {
      "text": "联合国秘书长表示叙利亚没有军事解决方案",
      "source_lang": "eng_Latn",
      "target_lang": "zho_Hans"
    },
    {
      "text": "今天天气很好",
      "source_lang": "eng_Latn",
      "target_lang": "zho_Hans"
    }
  ],
  "model": "nllb-200-3.3B"
}
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `translations` | `array` | 翻译结果列表，与 `texts` 数组一一对应、顺序一致 |
| `translations[].text` | `string` | 翻译后的文本，已去除首尾空白和特殊 token |
| `translations[].source_lang` | `string` | 源语言编码，与请求一致 |
| `translations[].target_lang` | `string` | 目标语言编码，与请求一致 |
| `model` | `string` | 当前使用的模型标识 |

**关键约束**:

- `translations` 数组长度必须与请求 `texts` 数组长度一致
- `translations[i]` 对应 `texts[i]` 的翻译结果
- `text` 不应包含 `<s>`, `</s>`, `<pad>` 等特殊 token
- 如果某条文本翻译失败，该条 `text` 返回空字符串 `""`，不影响其他条目

#### Response — 失败

**`400 Bad Request`** — 请求参数错误

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "texts 数组不得为空"
  }
}
```

**`400 Bad Request`** — 语言编码错误

```json
{
  "error": {
    "code": "UNSUPPORTED_LANGUAGE",
    "message": "不支持的源语言编码: xyz_Latn"
  }
}
```

**`400 Bad Request`** — 相同语言对

```json
{
  "error": {
    "code": "SAME_LANGUAGE_PAIR",
    "message": "源语言和目标语言不得相同: eng_Latn"
  }
}
```

**`400 Bad Request`** — 文本超长

```json
{
  "error": {
    "code": "TEXT_TOO_LONG",
    "message": "texts[2] 超过 512 token 限制"
  }
}
```

**`400 Bad Request`** — 批量超限

```json
{
  "error": {
    "code": "BATCH_TOO_LARGE",
    "message": "texts 数组最多 50 条，当前 65 条"
  }
}
```

**`500 Internal Server Error`** — 推理异常

```json
{
  "error": {
    "code": "TRANSLATION_FAILED",
    "message": "翻译失败: GPU 内存不足"
  }
}
```

#### cURL 示例

**单条翻译**:

```bash
curl -X POST http://localhost:7861/nllb/translate \
  -H "Content-Type: application/json" \
  -d '{
    "texts": ["water"],
    "source_lang": "eng_Latn",
    "target_lang": "zho_Hans"
  }'
```

**批量翻译** (工作台分段场景):

```bash
curl -X POST http://localhost:7861/nllb/translate \
  -H "Content-Type: application/json" \
  -d '{
    "texts": [
      "UN Chief says there is no military solution in Syria",
      "The weather is nice today",
      "We are here"
    ],
    "source_lang": "eng_Latn",
    "target_lang": "zho_Hans"
  }'
```

---

### 2.2 健康检查

**`GET /nllb/health`**

用于 Bridgelingua 后端验证翻译服务连通性和模型就绪状态。

#### Response — 成功 (`200 OK`)

```json
{
  "status": "ok",
  "model": "nllb-200-3.3B",
  "device": "cuda:0",
  "languages_count": 200
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | `string` | 服务状态，`ok` 表示模型已加载且可接受推理请求 |
| `model` | `string` | 当前加载的翻译模型标识 (如 `nllb-200-3.3B`, `nllb-200-distilled-1.3B`) |
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

**`GET /nllb/languages`**

返回当前翻译模型支持的所有语言列表。

#### Response — 成功 (`200 OK`)

```json
{
  "languages": [
    {
      "code": "eng_Latn",
      "name": "English"
    },
    {
      "code": "zho_Hans",
      "name": "Chinese (Simplified)"
    },
    {
      "code": "zho_Hant",
      "name": "Chinese (Traditional)"
    },
    {
      "code": "fra_Latn",
      "name": "French"
    },
    {
      "code": "ium_Latn",
      "name": "Iu Mien"
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `languages` | `array` | 支持的语言列表 |
| `languages[].code` | `string` | FLORES-200 语言编码 (格式: `{iso639_3}_{script}`) |
| `languages[].name` | `string` | 语言英文名称 |

> **注意**: 翻译服务支持的语言数 (~200) 远少于 ASR 服务 (~1600)，这是两份不同的列表。Bridgelingua 后端需分别请求两个服务的语言列表，用于前端的源语言选择器 (ASR) 和目标语言选择器 (翻译)。

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
| 400 | `INVALID_REQUEST` | 请求体格式错误或必填字段缺失 |
| 400 | `UNSUPPORTED_LANGUAGE` | 语言编码不在支持列表中 |
| 400 | `SAME_LANGUAGE_PAIR` | 源语言和目标语言相同 |
| 400 | `TEXT_TOO_LONG` | 单条文本超过 512 token 限制 |
| 400 | `BATCH_TOO_LARGE` | texts 数组超过 50 条上限 |
| 500 | `TRANSLATION_FAILED` | 模型推理过程发生错误 |
| 503 | `MODEL_NOT_READY` | 模型尚未加载完成 |

### 3.3 CORS

翻译服务需允许 Bridgelingua 后端的跨域请求:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

> 生产环境建议将 `Allow-Origin` 限制为 Bridgelingua 后端的实际地址。

### 3.4 超时

| 场景 | 建议超时 |
|------|----------|
| 单条短文本 (< 50 词) | 10 秒 |
| 批量翻译 (≤ 20 条) | 30 秒 |
| 批量翻译 (21-50 条) | 60 秒 |

Bridgelingua 后端将使用 **30 秒**作为默认请求超时。超过 20 条的批量翻译，后端会自动分批发送。

---

## 4. 语言编码规范

### 4.1 编码格式

采用 FLORES-200 BCP-47 变体: `{iso639_3}_{script}`

- `iso639_3`: ISO 639-3 三字母语言代码
- `script`: ISO 15924 四字母文字代码

> 与 ASR 服务使用相同的编码体系，确保 Bridgelingua 前后端统一处理语言代码。

### 4.2 常用语言编码对照

| 编码 | 语言 |
|------|------|
| `zho_Hans` | 中文 (简体) |
| `zho_Hant` | 中文 (繁体) |
| `eng_Latn` | 英语 |
| `fra_Latn` | 法语 |
| `deu_Latn` | 德语 |
| `spa_Latn` | 西班牙语 |
| `ara_Arab` | 阿拉伯语 |
| `hin_Deva` | 印地语 |
| `rus_Cyrl` | 俄语 |
| `jpn_Jpan` | 日语 |
| `kor_Hang` | 韩语 |
| `bod_Tibt` | 藏语 |
| `que_Latn` | 克丘亚语 |

完整语言列表可通过 `GET /nllb/languages` 获取，也可参考 [FLORES-200 语言列表](https://github.com/facebookresearch/flores/blob/main/flores200/README.md#languages-in-flores-200)。

---

## 5. 对接示意

### 5.1 工作台翻译流程

ASR 转写完成后，Bridgelingua 后端将转写分段批量发送至翻译服务:

```
Bridgelingua Frontend           Bridgelingua Backend          NLLB Translation Service
       |                               |                               |
       |  转写完成，请求翻译              |                               |
       |  POST /api/translate -------->|                               |
       |  {segments, src, tgt}         |                               |
       |                               |  POST /nllb/translate ------->|
       |                               |  {texts[], src_lang, tgt_lang}|
       |                               |                               | 模型推理
       |                               |                               |
       |                               |<--- translations[] -----------|
       |                               |                               |
       |<----- TranslateResponse ------|                               |
       |  {translated_segments}        |                               |
```

### 5.2 词典建议翻译流程

快速录入模式下，ASR 填入词形后请求翻译建议:

```
Bridgelingua Frontend           Bridgelingua Backend          NLLB Translation Service
       |                               |                               |
       |  ASR 识别词形 "mbuo"            |                               |
       |  请求建议翻译                    |                               |
       |  POST /api/translate -------->|                               |
       |  {text: "mbuo", src, tgt}     |                               |
       |                               |  POST /nllb/translate ------->|
       |                               |  {texts:["mbuo"], src, tgt}   |
       |                               |                               | 模型推理
       |                               |                               |
       |                               |<--- translations[] -----------|
       |                               |                               |
       |<--- {suggestion: "water"} ----|                               |
       |  用户可采纳/修改/忽略            |                               |
```

### 5.3 后端对接代码参考

Bridgelingua 后端的 `translation_service.py` 将以如下方式调用翻译 API:

```python
import httpx

NLLB_ENDPOINT = "http://localhost:7861"  # 从 settings 读取

async def translate(
    texts: list[str],
    source_lang: str,
    target_lang: str,
) -> list[str]:
    """批量翻译文本，返回翻译结果列表"""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{NLLB_ENDPOINT}/nllb/translate",
            json={
                "texts": texts,
                "source_lang": source_lang,
                "target_lang": target_lang,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return [t["text"] for t in data["translations"]]


async def translate_single(
    text: str,
    source_lang: str,
    target_lang: str,
) -> str:
    """单条翻译，用于词典建议"""
    results = await translate([text], source_lang, target_lang)
    return results[0]
```

---

## 6. 实现参考

以下代码片段仅供工程师参考推理层实现思路，**不限定具体实现方式**:

```python
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

# 加载模型 (启动时一次性加载)
model_name = "facebook/nllb-200-3.3B"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSeq2SeqLM.from_pretrained(model_name, torch_dtype="auto").to("cuda")

def translate_batch(texts: list[str], source_lang: str, target_lang: str) -> list[str]:
    """
    核心推理逻辑参考:
    1. 设置 tokenizer 的 src_lang
    2. 批量编码输入文本
    3. 通过 forced_bos_token_id 指定目标语言
    4. 解码生成结果
    """
    tokenizer.src_lang = source_lang
    inputs = tokenizer(texts, return_tensors="pt", padding=True, truncation=True, max_length=512).to("cuda")

    target_lang_id = tokenizer.convert_tokens_to_ids(target_lang)
    translated_tokens = model.generate(
        **inputs,
        forced_bos_token_id=target_lang_id,
        max_length=256,
    )

    return tokenizer.batch_decode(translated_tokens, skip_special_tokens=True)
```

> 工程师可自行选择 Web 框架 (FastAPI / Flask 等) 和部署方式，只需确保 HTTP 接口符合第 2 节定义。

---

## 7. 验收标准

工程师交付翻译 API 时，需满足以下验收条件:

- [ ] `POST /nllb/translate` 能正确接收 JSON 请求体，返回符合上述格式的翻译结果
- [ ] 单条翻译: `texts` 长度为 1 时正常工作，翻译结果语义基本正确
- [ ] 批量翻译: `texts` 长度为 20 时正常工作，结果数组长度一致且顺序对应
- [ ] 语言对覆盖: `eng_Latn ↔ zho_Hans`, `eng_Latn ↔ fra_Latn`, `zho_Hans ↔ spa_Latn` 至少 3 组语言对可用
- [ ] `GET /nllb/health` 返回模型状态，可用于连通性检测
- [ ] `GET /nllb/languages` 返回完整的 200 种支持语言列表，编码格式正确
- [ ] 错误场景 (语言不支持、文本超长、批量超限) 返回规范的错误响应，而非 500 或 HTML 页面
- [ ] 支持并发请求 (至少 2 个同时推理请求)
- [ ] 单条短文本 (< 50 词) 翻译响应时间不超过 5 秒
- [ ] 20 条批量翻译响应时间不超过 30 秒
