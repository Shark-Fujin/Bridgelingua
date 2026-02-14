import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

NLLB_TIMEOUT = httpx.Timeout(connect=10.0, read=30.0, write=10.0, pool=10.0)


def _resolve_endpoint(endpoint: str | None = None) -> str:
    base = (endpoint or "").rstrip("/")
    return base if base else settings.nllb_endpoint


async def translate(texts: list[str], src_lang: str, tgt_lang: str, endpoint: str | None = None) -> list[str]:
    """调用远程 NLLB 翻译服务进行批量翻译。"""
    base = _resolve_endpoint(endpoint)
    url = f"{base}/nllb/translate"
    try:
        async with httpx.AsyncClient(timeout=NLLB_TIMEOUT) as client:
            resp = await client.post(
                url,
                json={"texts": texts, "source_lang": src_lang, "target_lang": tgt_lang},
            )
            resp.raise_for_status()
            data = resp.json()
            return [t["text"] for t in data["translations"]]
    except httpx.ConnectError:
        logger.warning("NLLB 服务不可达 (%s)，使用 mock 翻译", base)
        return [f"[Mock translation to {tgt_lang}] {t}" for t in texts]
    except httpx.HTTPStatusError as e:
        error_body = _parse_error(e.response)
        logger.error("NLLB 请求失败 [%s]: %s", e.response.status_code, error_body)
        raise RuntimeError(f"翻译失败: {error_body}") from e
    except httpx.TimeoutException as e:
        logger.error("NLLB 请求超时: %s", e)
        raise RuntimeError("翻译超时，请检查文本量或服务状态") from e


async def fetch_languages(endpoint: str | None = None) -> list[dict] | None:
    """从 NLLB 服务获取支持的语言列表，不可达时返回 None。"""
    base = _resolve_endpoint(endpoint)
    url = f"{base}/nllb/languages"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            return data.get("languages", [])
    except httpx.HTTPError:
        return None


async def check_health(endpoint: str | None = None) -> dict | None:
    """检查 NLLB 服务健康状态，不可达时返回 None。"""
    base = _resolve_endpoint(endpoint)
    url = f"{base}/nllb/health"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPError:
        return None


def _parse_error(resp: httpx.Response) -> str:
    try:
        body = resp.json()
        err = body.get("error", {})
        return err.get("message", str(body))
    except Exception:
        return resp.text[:200]
