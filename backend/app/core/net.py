"""SSRF 防护：校验 Provider 自定义 URL，拒绝内网/环回/链路本地地址。"""

import ipaddress
import socket
from urllib.parse import urlparse

from app.core.config import get_settings


class UrlNotAllowed(Exception):
    pass


_BLOCKED_NETWORKS = tuple(
    ipaddress.ip_network(c)
    for c in (
        "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8",
        "169.254.0.0/16", "172.16.0.0/12", "192.168.0.0/16", "198.18.0.0/15",
        "::/128", "::1/128", "fc00::/7", "fe80::/10",
    )
)


def _is_blocked(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    return any(addr in net for net in _BLOCKED_NETWORKS)


def validate_provider_url(url: str, allow_private: bool | None = None) -> str:
    """校验并规范化 base_url（https/http）。allow_private 缺省取全局配置。"""
    if allow_private is None:
        allow_private = get_settings().allow_private_urls
    parsed = urlparse(url.strip())
    if parsed.scheme not in ("https", "http"):
        raise UrlNotAllowed("仅支持 http/https 协议")
    host = parsed.hostname
    if not host:
        raise UrlNotAllowed("URL 缺少主机名")
    if allow_private:
        return url.rstrip("/")

    # 直接 IP 形式
    try:
        if _is_blocked(host):
            raise UrlNotAllowed("不允许指向内网或环回地址")
    except ValueError:
        pass  # 域名形式，继续 DNS 解析

    # DNS 解析后检查全部解析结果
    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80), proto=socket.IPPROTO_TCP)
    except socket.gaierror as e:
        raise UrlNotAllowed(f"域名无法解析: {host}") from e
    for info in infos:
        if _is_blocked(info[4][0]):
            raise UrlNotAllowed("域名解析到内网或环回地址，已拒绝")
    return url.rstrip("/")
